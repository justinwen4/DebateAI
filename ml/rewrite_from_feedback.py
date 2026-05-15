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
  --include-non-curation-eligible
                  Include rows not marked curation_eligible=true (legacy/backfill mode)
  --no-dedup      Append even if the prompt already exists in the dataset
  --output PATH   Append to this file instead of ml/dataset.tutor.jsonl
  --model NAME    OpenAI model (default: gpt-4o)
  --sleep S       Seconds between API calls (default: 0.2)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prompts import rewrite as _rewrite, add_tags as _add_tags



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
    parser.add_argument(
        "--include-non-curation-eligible",
        action="store_true",
        help="Include rows where curation_eligible is false/missing (legacy/backfill mode)",
    )
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
    query = (
        sb.table("feedback")
        .select("*")
        .gte("rating", args.min_score)
        .lte("rating", args.max_score)
        .order("rating", desc=False)   # worst first so the most impactful rewrites run first
    )
    if not args.include_non_curation_eligible:
        query = query.eq("curation_eligible", True)
    try:
        resp = query.execute()
    except Exception as e:
        if not args.include_non_curation_eligible and "curation_eligible" in str(e).lower():
            raise SystemExit(
                "Supabase feedback table is missing 'curation_eligible'. "
                "Run the migration first (see backend/supabase/migrations), or "
                "use --include-non-curation-eligible for temporary legacy backfill."
            )
        raise
    rows = resp.data or []
    scope = "and curation_eligible=true" if not args.include_non_curation_eligible else "(including non-curation-eligible)"
    print(f"  {len(rows)} rows match rating {args.min_score}–{args.max_score} {scope}")

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
        if not args.include_non_curation_eligible and not row.get("curation_eligible", False):
            continue
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

            entry = {
                "input": tagged_input,
                "output": new_output,
                "mode": "normal",
            }
            line = json.dumps(entry, ensure_ascii=False)

            if args.dry_run:
                print(f"  input:    {tagged_input}")
                print(f"  output:   {new_output[:200]}{'…' if len(new_output) > 200 else ''}")
            else:
                out_fh.write(line + "\n")
                out_fh.flush()
                written += 1
                print(f"  → appended")

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
