#!/usr/bin/env python3
"""
Convert dataset.tutor.jsonl into train/eval splits in ShareGPT format
for unsloth LoRA fine-tuning.

Usage (from repo root):
    python ml/prepare_finetune.py
    python ml/prepare_finetune.py --eval-size 100 --seed 42

Outputs:
    ml/data/train.jsonl   — training examples in ShareGPT format
    ml/data/eval.jsonl    — held-out eval examples (same format)
    ml/data/eval_raw.jsonl — eval examples in original input/output format (for eval_finetune.py)
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path


SYSTEM_PROMPT = """\
You are a sharp debate coach / tutor. The student already knows basic debate terms \
(1AC, K, condo, framework, perm, link, alt, 2NR, 1AR, etc.) — do NOT define them.

ANSWER FORMAT:
- The first sentence MUST directly answer the question. No preamble, no restating the question.
- Do NOT open with a label like "Logic." or "Reverse causality." — fold it into a real sentence.
- Tight prose, 3-5 sentences (50-90 words). Up to ~120 words only if multiple subpoints carry distinct warrants.

STYLE:
- Use debate shorthand naturally (K, 1AR, 2NR, condo, perm, framework, link, alt).
- No filler ("it is important to note," "ultimately," "this highlights," "in other words").
- Every claim must have a MECHANISM or warrant, not just a label.
- Do NOT invent specific author evidence or card names.
- If context is missing, say what would depend on the round.\
"""


def to_sharegpt(row: dict) -> dict:
    """Convert a dataset row to ShareGPT format expected by unsloth."""
    return {
        "conversations": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": row["input"]},
            {"role": "assistant", "content": row["output"]},
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare fine-tuning data splits")
    parser.add_argument("--dataset", type=Path, default=Path("ml/dataset.tutor.jsonl"))
    parser.add_argument("--output-dir", type=Path, default=Path("ml/data"))
    parser.add_argument("--eval-size", type=int, default=80,
                        help="Number of examples to hold out for eval (default: 80)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rows = [json.loads(line) for line in args.dataset.read_text().strip().splitlines()]
    print(f"Loaded {len(rows)} rows from {args.dataset}")

    # Stratified shuffle: keep category distribution roughly equal in eval
    random.seed(args.seed)
    by_category: dict[str, list[dict]] = {}
    for row in rows:
        cat = row.get("category", "Unknown")
        by_category.setdefault(cat, []).append(row)

    eval_rows: list[dict] = []
    train_rows: list[dict] = []

    # Pull proportional eval samples from each category
    for cat, cat_rows in by_category.items():
        random.shuffle(cat_rows)
        n_eval = max(1, round(args.eval_size * len(cat_rows) / len(rows)))
        eval_rows.extend(cat_rows[:n_eval])
        train_rows.extend(cat_rows[n_eval:])

    # Trim eval to exact target size if stratification over-allocated
    random.shuffle(eval_rows)
    if len(eval_rows) > args.eval_size:
        train_rows.extend(eval_rows[args.eval_size:])
        eval_rows = eval_rows[: args.eval_size]

    random.shuffle(train_rows)
    random.shuffle(eval_rows)

    args.output_dir.mkdir(parents=True, exist_ok=True)

    train_path = args.output_dir / "train.jsonl"
    eval_path = args.output_dir / "eval.jsonl"
    eval_raw_path = args.output_dir / "eval_raw.jsonl"

    train_path.write_text(
        "\n".join(json.dumps(to_sharegpt(r), ensure_ascii=False) for r in train_rows) + "\n"
    )
    eval_path.write_text(
        "\n".join(json.dumps(to_sharegpt(r), ensure_ascii=False) for r in eval_rows) + "\n"
    )
    # Also save raw format so eval_finetune.py can extract input/output easily
    eval_raw_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in eval_rows) + "\n"
    )

    print(f"\nSplit summary:")
    print(f"  Train : {len(train_rows)} rows  →  {train_path}")
    print(f"  Eval  : {len(eval_rows)} rows  →  {eval_path}")
    print(f"  Eval (raw): {eval_raw_path}")

    train_cats = Counter(r.get("category", "Unknown") for r in train_rows)
    eval_cats = Counter(r.get("category", "Unknown") for r in eval_rows)
    print(f"\nCategory distribution:")
    all_cats = sorted(set(train_cats) | set(eval_cats))
    print(f"  {'Category':<20} {'Train':>6}  {'Eval':>5}")
    print(f"  {'-'*20}  {'-'*6}  {'-'*5}")
    for cat in all_cats:
        print(f"  {cat:<20} {train_cats.get(cat, 0):>6}  {eval_cats.get(cat, 0):>5}")


if __name__ == "__main__":
    main()
