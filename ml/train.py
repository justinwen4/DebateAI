"""
Phase 2 training scaffold — LoRA fine-tuning on debate analytics.

This file is a placeholder for future fine-tuning of a local LLaMA model.
The dataset.jsonl in this directory provides the training data.
Each row should include: input, output, category, and mode ("normal" for tutor-style is primary; "debate_voice" optional/legacy).

Usage (future):
    python train.py --base-model meta-llama/Llama-3-8B \
                    --dataset dataset.jsonl \
                    --epochs 3 \
                    --lora-rank 16
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_dataset(path: str) -> list[dict]:
    rows = []
    for line in Path(path).read_text().strip().splitlines():
        rows.append(json.loads(line))
    print(f"Loaded {len(rows)} training examples")
    return rows


def main():
    parser = argparse.ArgumentParser(description="DebateAI LoRA fine-tuning")
    parser.add_argument("--base-model", default="meta-llama/Llama-3-8B")
    parser.add_argument("--dataset", default="dataset.jsonl")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lora-rank", type=int, default=16)
    parser.add_argument("--output-dir", default="./output")
    args = parser.parse_args()

    data = load_dataset(args.dataset)
    print(f"Config: model={args.base_model}, epochs={args.epochs}, rank={args.lora_rank}")
    print("Fine-tuning not yet implemented — add PEFT/transformers training loop here.")


if __name__ == "__main__":
    main()
