#!/usr/bin/env python3
"""
Fetch feedback rows from Supabase, rewrite outputs using GPT guided by the reviewer's
notes, and append the improved pairs to dataset.tutor.jsonl.

Usage (from repo root):
  set -a && source backend/.env && set +a

  # Preview first 5 rewrites without writing anything:
  python ml/rewrite_from_feedback.py --dry-run --limit 5

  # Full run — append all rows with rating ≤ 4:
  python ml/rewrite_from_feedback.py

  # Include 5-star rows too (e.g. notes say something useful):
  python ml/rewrite_from_feedback.py --max-score 5

  # Only fix the worst responses:
  python ml/rewrite_from_feedback.py --max-score 2

Flags:
  --dry-run       Print rewrites to stdout; do not write to dataset
  --limit N       Process only first N qualifying rows (useful for previews)
  --max-score N   Only process rows with rating <= N  (default: 4)
  --min-score N   Only process rows with rating >= N  (default: 1)
  --no-dedup      Append even if the prompt already exists in the dataset
  --output PATH   Append to this file instead of ml/dataset.tutor.jsonl
  --model NAME    OpenAI model (default: gpt-4o)
  --sleep S       Seconds between API calls (default: 0.2)
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path


REWRITE_SYSTEM = """\
You are a debate coach rewriting a tutor chatbot's response to a student's debate question.
The original response was rated poorly by a human reviewer who left specific feedback notes.
Your job: produce an improved answer that addresses the reviewer's critique.

ANSWER-FIRST (most important):
- The first sentence MUST directly answer the student's question, naming the actual subject.
  Examples:
    Q: "Why can't the AFF weigh case against the K?"
    → "The aff can't weigh case against the K because theory resolves before substance — \
the same reason 'extinction outweighs' doesn't beat condo."
    Q: "Why should the neg go for condo in the 2NR?"
    → "The neg should go for condo in the 2NR because …"
- Do NOT open with abstract restatement like "This claim argues…", "The argument centers on…".

VOICE:
- Neutral assistant tone; talk like a debater, not an essayist.
- Use debate shorthand naturally (K, 1NC, 2NR, condo, perm, T, NIB, PIC, RVI, link, alt, FW).
- Refer to sides as "the aff" / "the neg". Contractions are fine.
- Cut filler: no "it is important to note," "this highlights that," "ultimately," "thus."

LENGTH:
- Target 3–5 sentences (≈50–90 words). Go up to ~120 words ONLY if multiple distinct
  warrants are present. Never pad.

SUBSTANCE:
- Preserve every claim and warrant from the original that the reviewer did NOT criticise.
- Directly fix whatever the reviewer flagged — if they said "too vague", be specific;
  if they said "wrong side", correct it; if they said "missing X", add X.
- Do NOT add new facts, studies, or authors that weren't in the original.

Output ONLY the rewritten answer text. No preamble, no meta-commentary, no quotes.

EXAMPLES OF GOOD FINISHED ANSWERS (study voice, length, answer-first structure):

Q: Why does utilitarianism fail as a moral framework?
A: Utilitarianism fails for three core reasons. First, demandingness: it requires \
sacrificing everything for the greater good, which makes morality psychologically \
unlivable. Second, the repugnant conclusion: maximizing total happiness justifies a \
massive population of barely happy people over a small, flourishing one. Third, the \
utility monster problem: one person with extreme capacity for pleasure could justify \
enslaving everyone else, proving util has no principled constraint on distribution.

Q: Why can't the AFF weigh case against the K?
A: The aff can't weigh case against the K because the K is procedural, similar to condo \
or disclosure. Theoretical practices, like those addressed in the K, are resolved before \
substantive impacts like extinction.

Q: Why doesn't winning ethical consequences mean winning ethical representations?
A: Winning ethical consequences doesn't mean winning ethical representations because of \
reverse causality. Ethical consequences focus on outcomes, while ethical representations \
are about the underlying justifications and motivations. For example, both antisemites and \
pro-Palestinians may oppose Israel, but their reasons differ significantly. This \
distinction shows that similar consequences can arise from vastly different ethical \
representations.\
"""

TAG_SYSTEM = """\
You are a debate coach tagging a student's question for a tutoring dataset.

Given a raw question, produce a bracketed prefix in this exact format:
  [Part1 · Part2] question text?
or
  [Part1 · Part2 · Part3] question text?

Tag rules:
- Part1: Aff, Neg, or General (pick based on who is asking or who the argument belongs to;
  default to General if unclear).
- Part2: SPECIFIC debate lane / argument name (e.g. "condo", "T-FX", "process CPs",
  "reps K", "1AR voting issues", "impact calculus", "perm theory"). Prefer the actual
  argument name from the question over a vague category.
- Part3: optional speech/role (e.g. 2NR, 1AR, CX). Omit if unclear.

Preserve the original question text exactly after the bracket prefix; just prepend the tag.

EXAMPLES:
  Input:  Why does utilitarianism fail as a moral framework?
  Output: [General · util] Why does utilitarianism fail as a moral framework?

  Input:  Why can't the AFF weigh case against the K?
  Output: [Neg · reps K] Why can't the AFF weigh case against the K?

  Input:  Why doesn't winning ethical consequences mean winning ethical representations?
  Output: [General · Kritik] Why doesn't winning ethical consequences mean winning ethical representations?

Return ONLY the tagged question — no explanation, no JSON, no quotes.\
"""

CATEGORY_SYSTEM = """\
Classify a debate tutoring Q/A pair into one category.
Valid categories: Kritik, Theory, T, DA, CP, Case, Framework, Topicality, Philosophy
Reply with ONLY the single category word, nothing else.

Examples:
  Q: Why does utilitarianism fail as a moral framework?  → Philosophy
  Q: Why can't the AFF weigh case against the K?         → Kritik
  Q: Why doesn't winning ethical consequences mean winning ethical representations? → Kritik\
"""


def _rewrite(client, model: str, question: str, bad_output: str, notes: str) -> str:
    user_msg = (
        f"STUDENT QUESTION: {question.strip()}\n\n"
        f"ORIGINAL (POOR) ANSWER:\n{bad_output.strip()}\n\n"
        f"REVIEWER FEEDBACK (must address):\n{notes.strip() if notes.strip() else '(no specific notes — improve clarity and directness)'}"
    )
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=260,
    )
    return (r.choices[0].message.content or "").strip()


def _add_tags(client, model: str, question: str) -> str:
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": TAG_SYSTEM},
            {"role": "user", "content": question.strip()},
        ],
        temperature=0.1,
        max_tokens=120,
    )
    result = (r.choices[0].message.content or "").strip()
    # If GPT didn't add brackets, fall back to the raw question
    if not result.startswith("["):
        return question.strip()
    return result


def _infer_category(client, model: str, question: str, output: str) -> str:
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CATEGORY_SYSTEM},
            {"role": "user", "content": f"Q: {question.strip()}\nA: {output[:400]}"},
        ],
        temperature=0.0,
        max_tokens=10,
    )
    cat = (r.choices[0].message.content or "").strip()
    valid = {"Kritik", "Theory", "T", "DA", "CP", "Case", "Framework", "Topicality"}
    return cat if cat in valid else "Theory"


def _existing_prompts(dataset_path: Path) -> set[str]:
    if not dataset_path.exists():
        return set()
    prompts: set[str] = set()
    for line in dataset_path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            inp = row.get("input", "")
            # Store the bare question (strip bracket prefix) for fuzzy dedup
            if inp.startswith("[") and "] " in inp:
                bare = inp.split("] ", 1)[1]
            else:
                bare = inp
            prompts.add(bare.strip().lower())
        except json.JSONDecodeError:
            pass
    return prompts


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite feedback rows and append to dataset")
    parser.add_argument("--output", type=Path, default=Path("ml/dataset.tutor.jsonl"))
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--max-score", type=int, default=4, help="Only process rows with rating <= N")
    parser.add_argument("--min-score", type=int, default=1, help="Only process rows with rating >= N")
    parser.add_argument("--limit", type=int, default=0, help="Max rows to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print rewrites; do not write to dataset")
    parser.add_argument("--no-dedup", action="store_true", help="Append even if prompt already exists in dataset")
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    for var in ("OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            raise SystemExit(f"{var} is required — source backend/.env first")

    from openai import OpenAI
    from supabase import create_client

    openai = OpenAI()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    # Fetch all feedback rows
    print("Fetching feedback rows from Supabase…")
    resp = (
        sb.table("feedback")
        .select("*")
        .gte("rating", args.min_score)
        .lte("rating", args.max_score)
        .order("rating", desc=False)   # worst first so the most impactful rewrites run first
        .execute()
    )
    rows = resp.data or []
    print(f"  {len(rows)} rows match rating {args.min_score}–{args.max_score}")

    if not rows:
        print("Nothing to do.")
        return

    # Dedup against existing dataset
    existing: set[str] = set()
    if not args.no_dedup:
        existing = _existing_prompts(args.output)
        print(f"  {len(existing)} prompts already in dataset (will skip duplicates)")

    qualifying = []
    for row in rows:
        prompt = (row.get("prompt") or "").strip()
        if not prompt:
            continue
        bare = prompt.lower()
        if not args.no_dedup and bare in existing:
            print(f"  [SKIP duplicate] {prompt[:80]}")
            continue
        qualifying.append(row)

    if args.limit:
        qualifying = qualifying[: args.limit]

    print(f"  {len(qualifying)} rows to rewrite")
    if not qualifying:
        return

    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        out_fh = args.output.open("a", encoding="utf-8")
    else:
        out_fh = None

    written = 0
    try:
        for i, row in enumerate(qualifying):
            prompt = (row.get("prompt") or "").strip()
            bad_output = (row.get("bad_output") or "").strip()
            notes = (row.get("notes") or "").strip()
            rating = row.get("rating", "?")

            print(f"\n[{i + 1}/{len(qualifying)}] rating={rating}  prompt={prompt[:70]}…")
            if notes:
                print(f"  notes: {notes[:120]}")

            # Step 1: rewrite the output
            new_output = _rewrite(openai, args.model, prompt, bad_output, notes)

            # Step 2: add bracket tags to the input
            tagged_input = _add_tags(openai, args.model, prompt)

            # Step 3: infer category
            category = _infer_category(openai, args.model, tagged_input, new_output)

            entry = {
                "input": tagged_input,
                "output": new_output,
                "category": category,
                "mode": "normal",
            }
            line = json.dumps(entry, ensure_ascii=False)

            if args.dry_run:
                print(f"  input:    {tagged_input}")
                print(f"  output:   {new_output[:200]}{'…' if len(new_output) > 200 else ''}")
                print(f"  category: {category}")
            else:
                out_fh.write(line + "\n")
                out_fh.flush()
                written += 1
                print(f"  → appended (category={category})")

            if args.sleep and i < len(qualifying) - 1:
                time.sleep(args.sleep)

    finally:
        if out_fh is not None:
            out_fh.close()

    if args.dry_run:
        print(f"\nDry run complete — {len(qualifying)} rows previewed, nothing written.")
    else:
        print(f"\nDone. {written} rows appended to {args.output}")


if __name__ == "__main__":
    main()
