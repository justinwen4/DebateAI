#!/usr/bin/env python3
"""
Prefix each row's `input` with a short situational tag, e.g.:

  [Neg · reps K · framework 2NR] What framework interp should I extend?

Reads JSONL, calls OpenAI once per row, writes a new JSONL (does not overwrite input by default).

Usage:
  export OPENAI_API_KEY=...   # or: set -a && . backend/.env && set +a
  python ml/enrich_input_context.py --input ml/dataset.tutor.jsonl --output ml/dataset.tutor.ctx.jsonl
  python ml/enrich_input_context.py --input ml/dataset.tutor.jsonl --output out.jsonl --limit 3 --dry-run  # print only
"""

from __future__ import annotations

import argparse
import json
import os
import textwrap
import time
from pathlib import Path


SYSTEM = """You label debate tutoring examples with a short situational prefix, then the student's question.

FORMAT (exactly):
  [Part1 · Part2 · Part3] <question>

Rules:
- Use middle dot · (unicode) between bracket parts, with spaces around each · .
- Part1: Aff, Neg, or General — only when you can infer from the answer; otherwise General.
- Part2: debate lane (e.g. reps K, framework vs plan focus, condo, dispositionality, RVIs, PICs). Be specific but not invented file names.
- Part3: optional speech or role when it helps (e.g. framework 2NR, 1AR theory, CX). Omit if unclear; you may use only two parts like [Neg · condo] if the third adds nothing.
- After the closing bracket, one space, then the question. Keep or lightly edit the question for clarity; do not change what is being asked.
- Do not add new argumentative claims. Tags must be consistent with the provided answer.
- Output ONLY the single prefixed question line. No quotes, no markdown, no explanation."""


def _enrich(client, model: str, category: str, question: str, answer: str) -> str:
    answer_excerpt = answer.strip()
    if len(answer_excerpt) > 1200:
        answer_excerpt = answer_excerpt[:1200] + "…"
    user = textwrap.dedent(
        f"""\
        category: {category}
        current_question: {question.strip()}

        answer_for_inference:
        {answer_excerpt}
        """
    )
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=200,
    )
    return (r.choices[0].message.content or "").strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Prefix dataset inputs with [context] tags")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--limit", type=int, default=0, help="Max rows (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print results, do not write file")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required (e.g. export or source backend/.env)")

    from openai import OpenAI

    client = OpenAI()

    lines = args.input.read_text().strip().splitlines()
    rows = [json.loads(l) for l in lines]
    n = len(rows) if args.limit <= 0 else min(args.limit, len(rows))

    out_rows: list[dict] = []
    for i, row in enumerate(rows):
        row = dict(row)
        if i < n:
            q = row.get("input", "")
            enriched = _enrich(
                client,
                args.model,
                str(row.get("category", "")),
                q,
                str(row.get("output", "")),
            )
            row["input"] = enriched
            if args.dry_run:
                print(f"--- {i} ---\n{enriched}\n")
            else:
                print(f"[{i + 1}/{n}] enriched")
                if args.sleep and i < n - 1:
                    time.sleep(args.sleep)
        out_rows.append(row)

    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in out_rows) + "\n"
        )
        print(f"Wrote {len(out_rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
