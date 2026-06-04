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

  # Rewrite ≤4 and append 5-star rows as-is to review batch:
  python ml/rewrite_from_feedback.py --max-score 5 --output ml/review_batch.sonnet.jsonl

  # Only fix the worst responses:
  python ml/rewrite_from_feedback.py --max-score 2

Flags:
  --dry-run       Print rewrites to stdout; do not write to dataset
  --limit N       Process only first N qualifying rows (useful for previews)
  --max-score N   Only process rows with rating <= N  (default: 4)
  --min-score N   Only process rows with rating >= N  (default: 1)
  --rewrite-max-rating N
                  Rewrite rows with rating <= N; higher ratings append as-is (default: 4)
  --include-non-curation-eligible
                  Include rows not marked curation_eligible=true (legacy/backfill mode)
  --no-dedup      Append even if the prompt already exists in the dataset
  --overwrite     Replace the output file instead of appending (for review_batch.jsonl)
  --output PATH   Append to this file instead of ml/dataset.tutor.jsonl
  --provider NAME openai | anthropic (default: openai)
  --model NAME    Model id (default: gpt-4.1 for openai, claude-sonnet-4-6 for anthropic)
  --sleep S       Seconds between API calls (default: 0.2)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prompts import rewrite as _rewrite



def _bare_question(text: str) -> str:
    text = text.strip()
    if text.startswith("[") and "] " in text:
        text = text.split("] ", 1)[1].strip()
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    return " ".join(text.split())



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
    parser.add_argument("--provider", choices=("openai", "anthropic"), default="openai")
    parser.add_argument("--model", default=None)
    parser.add_argument("--max-score", type=int, default=4, help="Only process rows with rating <= N")
    parser.add_argument("--min-score", type=int, default=1, help="Only process rows with rating >= N")
    parser.add_argument(
        "--rewrite-max-rating",
        type=int,
        default=4,
        help="Rewrite rows with rating <= N; higher ratings append bad_output as-is",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max rows to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print rewrites; do not write to dataset")
    parser.add_argument("--no-dedup", action="store_true", help="Append even if prompt already exists in dataset")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace output file instead of appending (dedup still applies unless --no-dedup)",
    )
    parser.add_argument(
        "--include-non-curation-eligible",
        action="store_true",
        help="Include rows where curation_eligible is false/missing (legacy/backfill mode)",
    )
    parser.add_argument(
        "--require-notes",
        action="store_true",
        help="Only process rows with non-empty reviewer notes",
    )
    parser.add_argument(
        "--replace-matching",
        action="store_true",
        help="Replace existing output rows with the same prompt instead of skipping/appending",
    )
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    if args.provider == "openai":
        if not os.environ.get("OPENAI_API_KEY"):
            raise SystemExit("OPENAI_API_KEY is required — source backend/.env first")
    elif not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY is required — add to backend/.env")

    for var in ("SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            raise SystemExit(f"{var} is required — source backend/.env first")

    if args.model is None:
        args.model = "claude-sonnet-4-6" if args.provider == "anthropic" else "gpt-4.1"

    from supabase import create_client

    if args.provider == "openai":
        from openai import OpenAI

        llm = OpenAI()
    else:
        from anthropic import Anthropic

        llm = Anthropic()

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
        if args.require_notes and not (row.get("notes") or "").strip():
            continue
        bare = prompt.lower()
        if not args.no_dedup and bare in existing and not args.replace_matching:
            print(f"  [SKIP duplicate] {prompt[:80]}")
            continue
        qualifying.append(row)

    if args.limit:
        qualifying = qualifying[: args.limit]

    rewrite_rows = [r for r in qualifying if (r.get("rating") or 0) <= args.rewrite_max_rating]
    as_is_rows = [r for r in qualifying if (r.get("rating") or 0) > args.rewrite_max_rating]
    print(
        f"  {len(rewrite_rows)} to rewrite, {len(as_is_rows)} to append as-is "
        f"({args.provider}/{args.model})"
    )
    if not qualifying:
        return

    staged_entries: list[dict] | None = None
    if args.replace_matching and not args.dry_run:
        staged_entries = []
        if args.output.exists():
            for line in args.output.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line:
                    try:
                        staged_entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    if not args.dry_run and not args.replace_matching:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        mode = "w" if args.overwrite else "a"
        out_fh = args.output.open(mode, encoding="utf-8")
    else:
        out_fh = None

    written = 0
    replaced = 0
    rewritten = 0
    appended_as_is = 0
    try:
        for i, row in enumerate(qualifying):
            prompt = (row.get("prompt") or "").strip()
            bad_output = (row.get("bad_output") or "").strip()
            notes = (row.get("notes") or "").strip()
            rating = row.get("rating", "?")
            do_rewrite = isinstance(rating, int) and rating <= args.rewrite_max_rating

            print(f"\n[{i + 1}/{len(qualifying)}] rating={rating}  prompt={prompt[:70]}…")
            if notes:
                print(f"  notes: {notes[:120]}")

            if do_rewrite:
                new_output = _rewrite(
                    llm, args.model, prompt, bad_output, notes, provider=args.provider
                )
            else:
                new_output = bad_output
                if not new_output:
                    print("  [SKIP] empty bad_output")
                    continue

            entry = {
                "input": prompt,
                "output": new_output,
                "mode": "normal",
            }
            line = json.dumps(entry, ensure_ascii=False)

            if args.dry_run:
                label = "rewrite" if do_rewrite else "as-is"
                print(f"  [{label}] input:  {prompt}")
                print(f"  output: {new_output[:200]}{'…' if len(new_output) > 200 else ''}")
            elif staged_entries is not None:
                key = _bare_question(prompt)
                found = False
                for j, existing_row in enumerate(staged_entries):
                    if _bare_question(existing_row.get("input", "")) == key:
                        staged_entries[j] = {**existing_row, **entry}
                        found = True
                        replaced += 1
                        written += 1
                        break
                if not found:
                    staged_entries.append(entry)
                    appended_as_is += 1
                    written += 1
                if do_rewrite:
                    rewritten += 1
                print(f"  → {'replaced' if found else 'appended'}")
            else:
                out_fh.write(line + "\n")
                out_fh.flush()
                written += 1
                if do_rewrite:
                    rewritten += 1
                else:
                    appended_as_is += 1
                print(f"  → {'rewritten' if do_rewrite else 'appended as-is'}")

            if args.sleep and do_rewrite and i < len(qualifying) - 1:
                time.sleep(args.sleep)

    finally:
        if out_fh is not None:
            out_fh.close()
        if staged_entries is not None:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(
                "\n".join(json.dumps(e, ensure_ascii=False) for e in staged_entries) + "\n",
                encoding="utf-8",
            )

    if args.dry_run:
        print(f"\nDry run complete — {len(qualifying)} rows previewed, nothing written.")
    else:
        if args.replace_matching:
            print(
                f"\nDone. {written} rows updated in {args.output} "
                f"({rewritten} rewritten, {replaced} replaced, {appended_as_is} appended)."
            )
        else:
            verb = "written to" if args.overwrite else "appended to"
            print(
                f"\nDone. {written} rows {verb} {args.output} "
                f"({rewritten} rewritten, {appended_as_is} as-is)."
            )


if __name__ == "__main__":
    main()
