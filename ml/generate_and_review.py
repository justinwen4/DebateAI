#!/usr/bin/env python3
"""
Generate debate questions, get answers from the live backend (RAG), grade them
with an AI judge, then interactively review each row — provide feedback or
accept — before rewriting and appending to review_batch.jsonl.

Requires the backend to be running locally (uvicorn backend.main:app).

Usage (from repo root):
  set -a && source backend/.env && set +a

  # Generate from a topics file (one topic per line):
  python ml/generate_and_review.py --topics-file topics.txt --category Theory --per-topic 3

  # Pipe topics directly:
  echo "condo
  process CPs
  ableism K" | python ml/generate_and_review.py --category Kritik --per-topic 2

  # Use a batch_prompts-style file (auto-parses category from header):
  python ml/generate_and_review.py --batch-file ml/batch_prompts.md --batch-id 21

  # Point at deployed backend instead of localhost:
  python ml/generate_and_review.py --api-url https://your-app.railway.app --topics-file t.txt
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm_utils import chat_completion
from prompts import rewrite, add_tags


# ---------------------------------------------------------------------------
# Question generator prompt (answers come from the live backend)
# ---------------------------------------------------------------------------

QUESTION_GEN_SYSTEM = """\
You are generating debate tutoring QUESTIONS for a given topic. You do NOT write answers.

FORMAT — return STRICT JSON:
  {{"question": "...", "tagged_question": "...", "category": "..."}}

QUESTION field:
- A specific, practical question a debater would ask their coach about this topic.
- Phrase as: "why should we...", "how do we respond to...", "what's the answer to...",
  "why does X outweigh...", "what is X and how does it work..."
- Make it specific enough that a single focused answer can address it.

TAGGED_QUESTION field:
- The same question with a bracketed prefix: [Side · lane · optional speech]
- Side: Aff, Neg, or General
- Lane: the specific argument name from the topic
- Use middle dot · (with spaces) as separator
- Examples:
  "[General · util] Why does utilitarianism fail as a moral framework?"
  "[Neg · reps K] Why can't the AFF weigh case against the K?"
  "[Aff · condo · 1AR] How should the 1AR respond to conditionality?"

CATEGORY field:
- Exactly one of: Theory, Philosophy, Kritik, T, DA, CP, Case, Framework, Topicality

Output ONLY the JSON object. No markdown, no explanation.\
"""


# ---------------------------------------------------------------------------
# Judge prompt
# ---------------------------------------------------------------------------

JUDGE_SYSTEM = """\
You are grading a debate tutoring Q/A pair for training data quality.

Score 1–5 using these binary checks:

1. ANSWER-FIRST: Does the first sentence directly answer the question by naming the subject?
   - FAIL examples: opens with "This argument...", "The claim suggests...", a single-word label like "Logic."
   - PASS examples: "The aff can't weigh case because...", "Condo is a voter because..."

2. FACTUAL ACCURACY: Are the debate mechanics/claims correct?
   - FAIL: wrong side, reversed logic, misattributed argument structure
   - PASS: claims match how this argument actually works in debate rounds

3. LENGTH: Is it 50–120 words, 3–5 sentences?
   - FAIL: under 40 words (too sparse) or over 130 words (padded)

4. VOICE: Debate shorthand, no essay tone, no filler?
   - FAIL: "it is important to note", "ultimately", "this highlights", defines basic terms
   - PASS: uses K/perm/condo/FW/link/alt naturally, contractions, "the aff"/"the neg"

5. WARRANT DEPTH: Does every claim have a mechanism, not just a label?
   - FAIL: "condo is bad because it's unfair" (no mechanism for WHY it's unfair)
   - PASS: "condo is bad because it lets the neg moot 1AC prep by kicking arguments after the block"

SCORING:
- 5 = all checks pass, ready for training data as-is
- 4 = minor voice/length issue, substance is correct
- 3 = mostly correct but vague or missing a key warrant
- 2 = has a factual error or significant structural problem
- 1 = fundamentally wrong or unusable

NOTES: write 1–2 sentences of specific, actionable feedback that a rewriter can use to fix
the answer. Name exactly what's wrong and what should change. If score=5, notes can be empty.

Return STRICT JSON:
  {{"score": <int 1-5>, "notes": "<feedback string>"}}\
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _generate_question(client, model: str, topic: str, category: str) -> dict | None:
    """Generate a question for a topic. Returns {question, tagged_question, category} or None."""
    user_msg = f"Generate a debate tutoring question.\nTOPIC: {topic}\nCATEGORY: {category}"
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": QUESTION_GEN_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.8,
        max_tokens=200,
        response_format={"type": "json_object"},
    )
    content = (r.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        print(f"  ! Generator returned non-JSON, skipping: {content[:100]}", file=sys.stderr)
        return None
    question = (data.get("question") or "").strip()
    tagged = (data.get("tagged_question") or "").strip()
    cat = (data.get("category") or category).strip()
    if not question:
        return None
    if not tagged or not tagged.startswith("["):
        tagged = question
    return {"question": question, "tagged_question": tagged, "category": cat}


def _get_backend_answer(api_url: str, question: str) -> str | None:
    """Call the live backend /generate endpoint to get a RAG-powered answer."""
    import requests
    try:
        resp = requests.post(
            f"{api_url}/generate",
            json={"prompt": question},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("output", "").strip()
    except Exception as e:
        print(f"  ! Backend error: {e}", file=sys.stderr)
        return None


def _generate_pair(client, model: str, topic: str, category: str, api_url: str) -> dict | None:
    """Generate a question via GPT, get the answer from the live backend."""
    q = _generate_question(client, model, topic, category)
    if q is None:
        return None

    answer = _get_backend_answer(api_url, q["question"])
    if not answer:
        return None

    return {
        "input": q["tagged_question"],
        "output": answer,
        "category": q["category"],
    }


def _judge(client, model: str, question: str, answer: str) -> tuple[int, str]:
    """Grade a Q/A pair. Returns (score, notes)."""
    user_msg = f"QUESTION: {question}\n\nANSWER:\n{answer}"
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.1,
        max_tokens=150,
        response_format={"type": "json_object"},
    )
    content = (r.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return 3, "(judge returned invalid JSON)"
    score = int(data.get("score", 3))
    notes = (data.get("notes") or "").strip()
    return score, notes


def _interactive_review(
    client,
    model: str,
    pairs: list[dict],
    output_path: Path,
) -> int:
    """Present each pair for interactive review. Returns count of rows appended."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out_fh = output_path.open("a", encoding="utf-8")
    written = 0

    try:
        for i, pair in enumerate(pairs):
            question = pair["input"]
            answer = pair["output"]
            category = pair["category"]
            score = pair["score"]
            notes = pair["notes"]

            print(f"\n{'═' * 70}")
            print(f"[{i + 1}/{len(pairs)}]  score={score}  category={category}")
            print(f"  Q: {question}")
            print(f"  A: {answer}")
            if notes:
                print(f"  Judge notes: {notes}")
            print()
            print("  [enter] accept judge notes & rewrite  |  [5] accept as-is  |  [s] skip")
            print("  Or type your own feedback:")

            try:
                user_input = input("  > ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n  Stopping early.")
                break

            if user_input.lower() == "s":
                print("  → skipped")
                continue

            if user_input == "5":
                # Accept as-is — append directly without rewrite
                entry = {
                    "input": question,
                    "output": answer,
                    "category": category,
                    "mode": "normal",
                }
                out_fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
                out_fh.flush()
                written += 1
                print("  → appended as-is")
                continue

            # Determine feedback: user's input or judge's notes
            feedback = user_input if user_input else notes
            if not feedback:
                feedback = "(improve clarity and directness)"

            # Rewrite
            print("  Rewriting…")
            new_output = rewrite(client, model, question, answer, feedback)

            # Re-tag if needed (input already has tags from generator)
            tagged_input = question
            if not tagged_input.startswith("["):
                tagged_input = add_tags(client, model, question)

            entry = {
                "input": tagged_input,
                "output": new_output,
                "category": category,
                "mode": "normal",
            }
            out_fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
            out_fh.flush()
            written += 1
            print(f"  → rewritten & appended")
            print(f"    {new_output[:150]}{'…' if len(new_output) > 150 else ''}")

    finally:
        out_fh.close()

    return written


# ---------------------------------------------------------------------------
# Topic parsing
# ---------------------------------------------------------------------------

def _parse_topics_file(path: Path) -> list[str]:
    """Parse a simple newline-separated topics file (skips blank lines and comments)."""
    topics = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Strip leading bullet markers
        if line.startswith("- "):
            line = line[2:]
        topics.append(line)
    return topics


def _parse_batch_file(path: Path, batch_id: int) -> tuple[list[str], str]:
    """Parse a batch_prompts.md file and extract topics + category for a given batch ID."""
    text = path.read_text()
    import re
    # Find the batch header
    pattern = rf"###\s*BATCH\s*{batch_id}\s*[—–-]\s*(.+?)(?:\((\w+),|\((\w+)\))"
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        # Try simpler pattern
        pattern2 = rf"###\s*BATCH\s*{batch_id}\s*[—–-]\s*(.+)"
        match2 = re.search(pattern2, text, re.IGNORECASE)
        if not match2:
            raise SystemExit(f"Could not find BATCH {batch_id} in {path}")
        header_line = match2.group(1).strip()
    else:
        header_line = match.group(0)

    # Extract category from parenthetical
    cat_match = re.search(r"\((\w+),?\s*\d*\s*rows?\)", header_line if not match else match.group(0), re.IGNORECASE)
    category = cat_match.group(1) if cat_match else "Theory"

    # Find the code block after this header
    batch_start = text.find(f"BATCH {batch_id}")
    if batch_start == -1:
        raise SystemExit(f"Could not find BATCH {batch_id} in {path}")
    code_start = text.find("```", batch_start)
    if code_start == -1:
        raise SystemExit(f"No code block found for BATCH {batch_id}")
    code_start = text.find("\n", code_start) + 1
    code_end = text.find("```", code_start)
    if code_end == -1:
        code_end = len(text)

    block = text[code_start:code_end]
    topics = []
    for line in block.splitlines():
        line = line.strip()
        if line.startswith("- "):
            line = line[2:]
        elif line.startswith("**"):
            continue
        if not line or line.startswith("**"):
            continue
        topics.append(line)
    return topics, category


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate, grade, and interactively review debate Q/A pairs"
    )
    parser.add_argument("--topics-file", type=Path, help="Newline-separated topics file")
    parser.add_argument("--batch-file", type=Path, help="batch_prompts.md style file")
    parser.add_argument("--batch-id", type=int, help="Batch number to use from --batch-file")
    parser.add_argument("--category", default="Theory", help="Category for generated pairs")
    parser.add_argument("--per-topic", type=int, default=2, help="Q/A pairs to generate per topic")
    parser.add_argument("--output", type=Path, default=Path("ml/review_batch.jsonl"))
    parser.add_argument("--api-url", default="http://localhost:8000",
                        help="Backend URL for /generate endpoint (default: http://localhost:8000)")
    parser.add_argument("--gen-model", default="gpt-4o-mini", help="Model for question generation (cheap)")
    parser.add_argument("--judge-model", default="gpt-4o", help="Model for judging + rewriting (strong)")
    parser.add_argument("--sleep", type=float, default=0.15, help="Seconds between API calls")
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required — source backend/.env first")

    # Resolve topics
    if args.batch_file:
        if not args.batch_id:
            raise SystemExit("--batch-id is required with --batch-file")
        topics, category = _parse_batch_file(args.batch_file, args.batch_id)
        print(f"Parsed BATCH {args.batch_id}: {len(topics)} topics, category={category}")
    elif args.topics_file:
        topics = _parse_topics_file(args.topics_file)
        category = args.category
    elif not sys.stdin.isatty():
        topics = [l.strip() for l in sys.stdin.readlines() if l.strip()]
        category = args.category
    else:
        raise SystemExit(
            "Provide topics via --topics-file, --batch-file, or stdin.\n"
            "Example: echo 'condo\\nprocess CPs' | python ml/generate_and_review.py --category Theory"
        )

    if not topics:
        raise SystemExit("No topics found.")

    from openai import OpenAI
    client = OpenAI()

    # Verify backend is reachable
    import requests
    try:
        requests.get(f"{args.api_url}/docs", timeout=5)
    except Exception:
        raise SystemExit(
            f"Cannot reach backend at {args.api_url}\n"
            f"Start it first: cd backend && uvicorn main:app --reload"
        )

    total_to_generate = len(topics) * args.per_topic
    print(f"Generating {total_to_generate} pairs ({len(topics)} topics × {args.per_topic}/topic)")
    print(f"Backend: {args.api_url}\n")

    # Phase 1: Generate questions + get answers from backend + judge
    pairs: list[dict] = []
    for ti, topic in enumerate(topics):
        for pi in range(args.per_topic):
            idx = ti * args.per_topic + pi + 1
            print(f"  [{idx}/{total_to_generate}] Generating: {topic[:50]}…", end="", flush=True)

            pair = _generate_pair(client, args.gen_model, topic, category, args.api_url)
            if pair is None:
                print(" FAILED")
                continue

            if args.sleep:
                time.sleep(args.sleep)

            # Judge
            score, notes = _judge(client, args.judge_model, pair["input"], pair["output"])
            pair["score"] = score
            pair["notes"] = notes
            pairs.append(pair)
            print(f" score={score}")

            if args.sleep:
                time.sleep(args.sleep)

    print(f"\n{'═' * 70}")
    print(f"Generated {len(pairs)} pairs. Starting interactive review…")
    print(f"Output: {args.output}")
    print(f"{'═' * 70}")

    # Sort: worst scores first so you fix the most impactful ones first
    pairs.sort(key=lambda p: p["score"])

    # Phase 2: Interactive review
    written = _interactive_review(client, args.judge_model, pairs, args.output)

    print(f"\n{'═' * 70}")
    print(f"Done. {written} rows appended to {args.output}")
    print(f"({len(pairs) - written} skipped)")


if __name__ == "__main__":
    main()
