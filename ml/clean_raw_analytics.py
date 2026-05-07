#!/usr/bin/env python3
"""
Clean ml/raw_analytics.jsonl in place:
- Merge consecutive rows that are clearly continuations (A]/B]/C]/1)/2) sub-points
  of the same parent claim, or semantically continuous follow-ons).
- Rewrite questions to be debate-specific ("why should we...", "how do we respond to...",
  etc.) and tightly scoped to what the output actually says.
- Flag (do NOT delete) rows that are bare warrants with no parent claim by adding
  "flag": "warrant_only".

Backs up the original to ml/raw_analytics.jsonl.bak, then overwrites in place.

Usage:
  export OPENAI_API_KEY=...   # or: set -a && . backend/.env && set +a
  python ml/clean_raw_analytics.py
  python ml/clean_raw_analytics.py --dry-run --limit 20
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path


SYSTEM = """You clean a jsonl of debate tutoring Q/A rows. You receive a CHUNK of consecutive rows (with their original idx). Return a cleaned JSON array of rows.

YOUR JOBS:

1) MERGE continuations AGGRESSIVELY. If consecutive rows are sub-points of the same analytic, merge them into ONE row. Strong merge signals:
   - Output starts with A]/B]/C]/D]/E], 1)/2)/3), i./ii./iii.
   - Output starts with the same lead phrase as a previous row (e.g. multiple rows starting "DTA on 1AR IVI's-" are A]/B] of the same argument).
   - Output starts with "and"/"also"/"additionally"/"second"/"third" or is otherwise a fragment that only makes sense after a parent claim.
   When merging, the question = the PARENT claim's question; output = joined text (preserve A]/B]/C] markers, separate with newlines).

2) REWRITE the [Part1 · Part2 · Part3] prefix using these rules:
   - Part1 = SIDE DELIVERING THE ARGUMENT. Use "General" when either side can run it (combo shells theory, meta-theory, comparative worlds, philosophical claims about determinism/consequences). Use "Aff" or "Neg" only when uniquely one side's (e.g. 1AR theory → Aff; "no RVIs" → Neg).
   - Part2 = ACTUAL ARGUMENT/POSITION BEING DEPLOYED, not a hyper-specific rephrase of the claim. Use the argument NAME a debater would call it (e.g. "PTIV", "framework 2AR", "condo", "1AR voting issues", "IVI debate", "DTA on 1AR IVIs", "reject combo shells", "Yes Act-Omission Distinction", "consequences", "determinism"). NOT "responding to paradigm issues" or "subjectivity and debate" — those are descriptions of warrants.
   - Part3 = optional speech/role (2NR, 1AR, 2AR, CX). Omit if unclear.

3) REWRITE EVERY QUESTION to sound like a debater asking their coach. Make it natural and conversational. Acceptable patterns:
   - "Why should we [reject/extend/get/read/use] X?"
   - "How do we respond to X?" / "What's the answer to X?" / "What do we say to X?"
   - "Why does X [matter/outweigh/turn the case/fail]?"
   - "Why do we get [RVIs/condo] on X?"
   - First-person scenario phrasing: "When I'm going for X, how do I answer Y?" or "I'm going for X in the 2AR against the K. How should I Z?"
   - For philosophy/metaethics, broader conceptual framing: "Why do consequences fail as a basis for ethics?", "Why does determinism deny obligations?"
   FORBIDDEN — REWRITE these:
   - "What are the implications of X?" → "Why does X matter?" or merge into parent
   - "What is the significance/meaning of X?" → scoped claim-question
   - "What does [author] argue?" → scoped claim-question
   - "What is the main argument for X?" → "Why should we [verb] X?"
   - "What is X?" when output argues FOR X → "Why should we [verb] X?"
   - Avoid hyper-specific rephrases that just restate the output. Match the LEVEL of the claim.

4) CATEGORY: assign one of Theory, T, DA, CP, Case, Framework, Kritik, Philosophy. Use Philosophy for determinism, consequences, induction, metaethics, free will, act-omission philosophical foundations. Theory for procedural debate norms (RVIs, condo, combo shells, voting issues). Framework for evaluation/role-of-the-ballot/weighing.

5) FLAG warrant-only rows. If a row's output is a bare warrant/example with no standalone claim AND cannot be merged into a neighbor in this chunk, add "flag": "warrant_only". Do NOT delete it.

REFERENCE EXAMPLES — these show the target style:
  {"input": "[Neg · 1AR voting issues · 2NR] Why should we reject 1AR independent voting issues?", "output": "A] Time skew... B] Clash... C] Psychology... D] No Risk... E] Structural skew..."}
  {"input": "[General · reject combo shells · 2NR] Why should we reject combo shells?", "output": "A] It's way too specific... B] Encourages tacking... C] Reading separate shells..."}
  {"input": "[Aff · 1AR theory] Why should the aff get 1AR theory?", "output": "1AR theory is legit – anything else means infinite abuse..."}
  {"input": "[Neg · PTIV] When I'm going for plan text in a vacuum, how do I answer the argument that I no linked out of their stuff?", "output": "Yes we no linked out of your stuff..."}
  {"input": "[Aff · framework 2AR] I'm going for middle ground framework in the 2AR against the K. How should I summarize the benefits of my interpretation?", "output": "Our interpretation is the only one that is additive..."}
  {"input": "[General · consequences] Why do consequences fail as a basis for ethics?", "output": "There's no cutoff for when a consequence ends..."}
  {"input": "[General · determinism] Why does determinism deny the existence of obligations?", "output": "Determinism denies the existence of obligations because..."}

OUTPUT RULES: input MUST be "[Part1 · Part2 · Part3] question?" with brackets, middle dot ·, and a real question ending in ?. Keep "mode": "normal" on every row. Output text is mostly verbatim — do not paraphrase or invent.

Return STRICT JSON and NOTHING else:
  {"rows": [{"input": "...", "output": "...", "category": "...", "mode": "normal"}, ...]}

The returned rows may be FEWER than the input (due to merges); never more.
"""


def _load(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]


def _format_chunk(rows: list[dict], start_idx: int) -> str:
    return json.dumps(
        [
            {
                "idx": start_idx + i,
                "input": r.get("input", ""),
                "output": r.get("output", ""),
                "category": r.get("category", ""),
            }
            for i, r in enumerate(rows)
        ],
        ensure_ascii=False,
        indent=2,
    )


def _call_llm(client, model: str, chunk_json: str) -> list[dict]:
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Clean this chunk of rows:\n\n{chunk_json}"},
        ],
        temperature=0.2,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )
    content = (r.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        print(f"  ! Non-JSON response, skipping chunk: {content[:160]}", file=sys.stderr)
        return []
    rows = data.get("rows") or []
    cleaned: list[dict] = []
    for it in rows:
        inp = (it.get("input") or "").strip()
        out = (it.get("output") or "").strip()
        cat = (it.get("category") or "").strip() or "Unknown"
        if not (inp and out):
            continue
        row = {"input": inp, "output": out, "category": cat, "mode": "normal"}
        flag = (it.get("flag") or "").strip()
        if flag:
            row["flag"] = flag
        cleaned.append(row)
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean ml/raw_analytics.jsonl")
    parser.add_argument("--input", type=Path, default=Path("ml/raw_analytics.jsonl"))
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--chunk-size", type=int, default=12)
    parser.add_argument("--overlap", type=int, default=3, help="Rows from end of prev chunk to re-show as context")
    parser.add_argument("--limit", type=int, default=0, help="Max input rows to process (0 = all)")
    parser.add_argument("--start-row", type=int, default=0, help="0-based row index to start cleaning at; rows before are passed through unchanged")
    parser.add_argument("--dry-run", action="store_true", help="Print cleaned JSONL to stdout; don't overwrite input")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input not found: {args.input}")
    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required")

    from openai import OpenAI

    client = OpenAI()

    all_rows = _load(args.input)
    preserved = all_rows[: args.start_row] if args.start_row > 0 else []
    rows = all_rows[args.start_row :]
    if args.limit:
        rows = rows[: args.limit]
    print(
        f"Loaded {len(all_rows)} rows from {args.input}; preserving first {len(preserved)}, cleaning {len(rows)}",
        file=sys.stderr,
    )

    cleaned: list[dict] = list(preserved)
    n = len(rows)
    i = 0
    chunk_num = 0
    overlap = max(0, args.overlap)
    while i < n:
        end = min(n, i + args.chunk_size)
        chunk = rows[i:end]
        chunk_num += 1
        chunk_json = _format_chunk(chunk, i)
        out_rows = _call_llm(client, args.model, chunk_json)
        if not out_rows:
            i = end
            continue
        if overlap and cleaned and i > 0:
            drop = min(overlap, len(cleaned), len(out_rows))
            del cleaned[-drop:]
        cleaned.extend(out_rows)
        print(
            f"  chunk {chunk_num} (rows {i}-{end - 1}): {len(chunk)} in -> {len(out_rows)} out, total cleaned={len(cleaned)}",
            file=sys.stderr,
        )
        i = end - overlap if end < n else end
        if args.sleep and i < n:
            time.sleep(args.sleep)

    out_text = "\n".join(json.dumps(r, ensure_ascii=False) for r in cleaned) + "\n"

    if args.dry_run:
        sys.stdout.write(out_text)
        print(f"\nWould write {len(cleaned)} rows (was {n}).", file=sys.stderr)
        return

    backup = args.input.with_suffix(args.input.suffix + ".bak")
    shutil.copy2(args.input, backup)
    args.input.write_text(out_text, encoding="utf-8")
    print(f"Wrote {len(cleaned)} rows (was {n}) to {args.input}. Backup at {backup}.", file=sys.stderr)


if __name__ == "__main__":
    main()
