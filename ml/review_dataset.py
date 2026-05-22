#!/usr/bin/env python3
"""
Walk through existing dataset.tutor.jsonl entries, view each input-output pair,
type reviewer notes, and auto-rewrite + append to review_batch.sonnet.jsonl.

Enter appends the row as-is; typed notes trigger rewrite and save immediately.

Usage (from repo root):
  set -a && source backend/.env && set +a

  # Start reviewing from row 0:
  python ml/review_dataset.py

  # Resume at row 50:
  python ml/review_dataset.py --start 50

  # Preview rewrites without writing:
  python ml/review_dataset.py --dry-run --limit 3

Flags:
  --input PATH    Source JSONL (default: ml/dataset.tutor.jsonl)
  --output PATH   Append rewrites here (default: ml/review_batch.sonnet.jsonl)
  --start N       Begin at 0-based row index (default: 0)
  --limit N       Process at most N rows (0 = all remaining)
  --dry-run       Print rewrites; do not append to output file
  --provider NAME openai | anthropic (default: anthropic)
  --model NAME    Model id (default: claude-sonnet-4-6 for anthropic, gpt-4.1 for openai)
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
from prompts import rewrite as _rewrite


def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            raise SystemExit(f"Invalid JSON in {path}: {e}") from e
    return rows


def _build_entry(row: dict, new_output: str) -> dict:
    entry: dict = {
        "input": (row.get("input") or "").strip(),
        "output": new_output.strip(),
        "mode": row.get("mode") or "normal",
    }
    if row.get("category"):
        entry["category"] = row["category"]
    return entry


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Review dataset.tutor.jsonl rows and rewrite with notes"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("ml/dataset.tutor.jsonl"),
        help="Source JSONL to review",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("ml/review_batch.sonnet.jsonl"),
        help="Append rewritten rows here",
    )
    parser.add_argument("--start", type=int, default=0, help="0-based row index to start")
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max rows to visit (0 = all from --start)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print rewrites; do not write")
    parser.add_argument("--provider", choices=("openai", "anthropic"), default="anthropic")
    parser.add_argument("--model", default=None)
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input file not found: {args.input}")

    if args.model is None:
        args.model = (
            "claude-sonnet-4-6" if args.provider == "anthropic" else "gpt-4.1"
        )

    llm = None

    def _get_llm():
        nonlocal llm
        if llm is not None:
            return llm
        if args.provider == "openai":
            if not os.environ.get("OPENAI_API_KEY"):
                raise SystemExit("OPENAI_API_KEY is required — source backend/.env first")
            from openai import OpenAI

            llm = OpenAI()
        else:
            if not os.environ.get("ANTHROPIC_API_KEY"):
                raise SystemExit(
                    "ANTHROPIC_API_KEY is required — source backend/.env first"
                )
            from anthropic import Anthropic

            llm = Anthropic()
        return llm

    all_rows = _load_jsonl(args.input)
    total = len(all_rows)

    if args.start < 0 or args.start >= total:
        raise SystemExit(f"--start must be between 0 and {total - 1}")

    end = total if args.limit <= 0 else min(total, args.start + args.limit)
    slice_rows = all_rows[args.start : end]

    print(f"Loaded {total} rows from {args.input}")
    print(f"Reviewing rows {args.start}–{end - 1} ({len(slice_rows)} entries)")
    print(f"Output: {args.output} {'(dry-run)' if args.dry_run else '(append)'}")
    print(f"Model: {args.provider}/{args.model}")
    print("Notes: Enter=append as-is, q=quit, or type notes to rewrite")
    print("═" * 70)

    out_fh = None
    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        out_fh = args.output.open("a", encoding="utf-8")

    written = 0
    appended_as_is = 0
    rewritten = 0

    def _save_entry(entry: dict, *, label: str) -> None:
        nonlocal written, appended_as_is, rewritten
        if args.dry_run:
            out = entry["output"]
            print(f"→ {label}:\n{out}")
        else:
            assert out_fh is not None
            out_fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
            out_fh.flush()
            print(f"→ {label} → {args.output}")
        written += 1
        if label == "appended as-is":
            appended_as_is += 1
        else:
            rewritten += 1

    try:
        for offset, row in enumerate(slice_rows):
            idx = args.start + offset
            question = (row.get("input") or "").strip()
            answer = (row.get("output") or "").strip()
            category = row.get("category") or ""

            print(f"\n[{idx + 1}/{total}]", end="")
            if category:
                print(f"  {category}")
            else:
                print()
            print(f"INPUT:\n{question}")
            print(f"OUTPUT:\n{answer}")
            print()
            print("Notes (Enter=append as-is, q=quit):")

            try:
                notes = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nStopping.")
                break

            if notes.lower() == "q":
                print("Quit.")
                break

            if not notes:
                _save_entry(_build_entry(row, answer), label="appended as-is")
            else:
                print("→ Rewriting…")
                new_output = _rewrite(
                    _get_llm(),
                    args.model,
                    question,
                    answer,
                    notes,
                    provider=args.provider,
                )
                _save_entry(_build_entry(row, new_output), label="rewritten")

            if notes and args.sleep and offset < len(slice_rows) - 1:
                time.sleep(args.sleep)

    finally:
        if out_fh is not None:
            out_fh.close()

    print(f"\n{'═' * 70}")
    if args.dry_run:
        print(
            f"Dry run: {written} rows previewed "
            f"({appended_as_is} as-is, {rewritten} rewritten)."
        )
    else:
        print(
            f"Done: {written} rows appended "
            f"({appended_as_is} as-is, {rewritten} rewritten)."
        )


if __name__ == "__main__":
    main()
