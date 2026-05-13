#!/usr/bin/env python3
"""
LoRA fine-tuning for the debate tutor model using unsloth.

SETUP (run once in Colab or a GPU environment):
    pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
    pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes

PREPARE DATA (run from repo root first):
    python ml/prepare_finetune.py

TRAIN (from repo root, needs GPU):
    python ml/train.py
    python ml/train.py --epochs 3 --lora-rank 16 --output-dir ml/output/debate-lora

PUSH TO HUB (optional, requires huggingface-cli login):
    python ml/train.py --push-to-hub your-hf-username/debate-lora-llama3

Colab quickstart:
    1. Open a new Colab notebook, select T4 GPU runtime
    2. Clone repo: !git clone https://github.com/YOUR_USERNAME/debate-chatbot && cd debate-chatbot
    3. Install deps (cell above)
    4. Run: !python ml/prepare_finetune.py && python ml/train.py
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


# ---------------------------------------------------------------------------
# Config defaults
# ---------------------------------------------------------------------------

BASE_MODEL = "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"  # 4-bit quantized, fits on T4
TRAIN_DATA = "ml/data/train.jsonl"
EVAL_DATA = "ml/data/eval.jsonl"
DEFAULT_OUTPUT = "ml/output/debate-lora"

LORA_RANK = 16          # 16 is a good middle ground; try 32 if quality is lacking
LORA_ALPHA = 16         # typically equal to rank
LORA_DROPOUT = 0.05
TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]

MAX_SEQ_LEN = 512       # covers 99%+ of our examples (avg ~120 words)
BATCH_SIZE = 2          # safe for T4 16GB with 4-bit
GRAD_ACCUM = 4          # effective batch = 8
EPOCHS = 3
LEARNING_RATE = 2e-4
WARMUP_RATIO = 0.05
WEIGHT_DECAY = 0.01


def load_jsonl(path: str) -> list[dict]:
    rows = [json.loads(line) for line in Path(path).read_text().strip().splitlines()]
    print(f"Loaded {len(rows)} rows from {path}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Debate tutor LoRA fine-tuning")
    parser.add_argument("--base-model", default=BASE_MODEL)
    parser.add_argument("--train-data", default=TRAIN_DATA)
    parser.add_argument("--eval-data", default=EVAL_DATA)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT)
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--lora-rank", type=int, default=LORA_RANK)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=LEARNING_RATE)
    parser.add_argument("--push-to-hub", default=None,
                        help="HuggingFace repo name to push adapter (e.g. username/debate-lora)")
    args = parser.parse_args()

    # Lazy imports so the file is importable without GPU deps installed
    try:
        from unsloth import FastLanguageModel
        from unsloth.chat_templates import get_chat_template
        from datasets import Dataset
        from trl import SFTConfig, SFTTrainer
    except ImportError:
        raise SystemExit(
            "Missing dependencies. Install with:\n"
            '  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"\n'
            '  pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes'
        )

    # Validate data exists
    for p in [args.train_data, args.eval_data]:
        if not Path(p).exists():
            raise SystemExit(
                f"Missing {p}. Run first:\n  python ml/prepare_finetune.py"
            )

    # ---------------------------------------------------------------------------
    # 1. Load base model + tokenizer
    # ---------------------------------------------------------------------------
    print(f"\nLoading {args.base_model}…")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=MAX_SEQ_LEN,
        dtype=None,         # auto-detect (float16 on T4)
        load_in_4bit=True,
    )

    tokenizer = get_chat_template(tokenizer, chat_template="llama-3.1")

    # ---------------------------------------------------------------------------
    # 2. Attach LoRA adapter
    # ---------------------------------------------------------------------------
    print(f"Attaching LoRA adapter (rank={args.lora_rank})…")
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_rank,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules=TARGET_MODULES,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # ---------------------------------------------------------------------------
    # 3. Load + format datasets
    # ---------------------------------------------------------------------------
    def format_conversations(batch: dict) -> dict:
        texts = []
        for convos in batch["conversations"]:
            text = tokenizer.apply_chat_template(
                convos,
                tokenize=False,
                add_generation_prompt=False,
            )
            texts.append(text)
        return {"text": texts}

    train_raw = load_jsonl(args.train_data)
    eval_raw = load_jsonl(args.eval_data)

    train_ds = Dataset.from_list(train_raw).map(
        format_conversations, batched=True, remove_columns=["conversations"]
    )
    eval_ds = Dataset.from_list(eval_raw).map(
        format_conversations, batched=True, remove_columns=["conversations"]
    )

    # ---------------------------------------------------------------------------
    # 4. Training
    # ---------------------------------------------------------------------------
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)

    training_args = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=GRAD_ACCUM,
        warmup_steps=WARMUP_RATIO,
        learning_rate=args.lr,
        weight_decay=WEIGHT_DECAY,
        fp16=True,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        report_to="none",
        seed=42,
        max_seq_length=MAX_SEQ_LEN,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=training_args,
    )

    print(f"\nTraining on {len(train_ds)} examples for {args.epochs} epochs…")
    print(f"Effective batch size: {args.batch_size * GRAD_ACCUM}")
    trainer.train()

    # ---------------------------------------------------------------------------
    # 5. Save adapter
    # ---------------------------------------------------------------------------
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"\nAdapter saved to {output_dir}/")

    if args.push_to_hub:
        print(f"Pushing to HuggingFace Hub: {args.push_to_hub}…")
        model.push_to_hub(args.push_to_hub, token=os.environ.get("HF_TOKEN"))
        tokenizer.push_to_hub(args.push_to_hub, token=os.environ.get("HF_TOKEN"))
        print(f"Done. https://huggingface.co/{args.push_to_hub}")

    print("\nNext step: run eval_finetune.py to benchmark vs GPT-4o baseline.")
    print(f"  python ml/eval_finetune.py --adapter {output_dir}")


if __name__ == "__main__":
    main()
