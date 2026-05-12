#!/usr/bin/env python3
"""
Benchmark the fine-tuned LoRA model against the GPT-4o baseline on the held-out eval set.

Runs both models on every eval question, scores each answer with the GPT-4o judge,
and prints a side-by-side comparison with score distributions and win rates.

Usage (from repo root):
    set -a && source backend/.env && set +a
    python ml/eval_finetune.py --adapter ml/output/debate-lora

    # Skip GPT-4o baseline if you've already scored it:
    python ml/eval_finetune.py --adapter ml/output/debate-lora --no-baseline

    # Save detailed results:
    python ml/eval_finetune.py --adapter ml/output/debate-lora --results-out ml/eval_results.jsonl

Requirements:
    pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
    pip install --no-deps "xformers<0.0.27" peft accelerate bitsandbytes openai
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


# ---------------------------------------------------------------------------
# Judge (same rubric as generate_and_review.py)
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
- 5 = all checks pass
- 4 = minor voice/length issue, substance is correct
- 3 = mostly correct but vague or missing a key warrant
- 2 = has a factual error or significant structural problem
- 1 = fundamentally wrong or unusable

Return STRICT JSON: {"score": <int 1-5>, "notes": "<feedback string>"}\
"""


def _judge(client, model: str, question: str, answer: str) -> tuple[int, str]:
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": f"QUESTION: {question}\n\nANSWER:\n{answer}"},
        ],
        temperature=0.1,
        max_tokens=150,
        response_format={"type": "json_object"},
    )
    content = (r.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
        return int(data.get("score", 3)), (data.get("notes") or "").strip()
    except (json.JSONDecodeError, ValueError):
        return 3, "(judge error)"


# ---------------------------------------------------------------------------
# Fine-tuned model inference
# ---------------------------------------------------------------------------

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


def _load_lora_model(adapter_dir: str):
    try:
        from unsloth import FastLanguageModel
        from unsloth.chat_templates import get_chat_template
    except ImportError:
        raise SystemExit(
            "unsloth not installed. Run:\n"
            '  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"'
        )

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=adapter_dir,
        max_seq_length=512,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)
    tokenizer = get_chat_template(tokenizer, chat_template="llama-3.1")
    return model, tokenizer


def _infer_lora(model, tokenizer, question: str, max_new_tokens: int = 300) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    inputs = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
    ).to(model.device)

    outputs = model.generate(
        input_ids=inputs,
        max_new_tokens=max_new_tokens,
        temperature=0.5,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )
    # Decode only the newly generated tokens
    generated = outputs[0][inputs.shape[-1]:]
    return tokenizer.decode(generated, skip_special_tokens=True).strip()


def _infer_gpt4o(client, question: str) -> str:
    """Call the GPT-4o backend directly (no RAG) for a fair apples-to-apples comparison."""
    r = chat_completion(
        client,
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        temperature=0.5,
        max_tokens=300,
    )
    return (r.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def _print_summary(results: list[dict]) -> None:
    from collections import Counter

    lora_scores = [r["lora_score"] for r in results]
    base_scores = [r.get("baseline_score") for r in results if r.get("baseline_score")]

    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    print(f"\n{'═' * 70}")
    print(f"EVAL RESULTS  ({len(results)} examples)")
    print(f"{'═' * 70}")
    print(f"  LoRA avg score   : {avg(lora_scores):.2f}")
    if base_scores:
        print(f"  GPT-4o avg score : {avg(base_scores):.2f}")

    print(f"\n  LoRA score distribution  : {dict(sorted(Counter(lora_scores).items()))}")
    if base_scores:
        print(f"  GPT-4o score distribution: {dict(sorted(Counter(base_scores).items()))}")

    if base_scores:
        wins = sum(1 for r in results if r["lora_score"] > r.get("baseline_score", 0))
        ties = sum(1 for r in results if r["lora_score"] == r.get("baseline_score", 0))
        losses = sum(1 for r in results if r["lora_score"] < r.get("baseline_score", 0))
        n = len(results)
        print(f"\n  LoRA vs GPT-4o:")
        print(f"    Win  (LoRA better) : {wins}/{n} ({100*wins/n:.0f}%)")
        print(f"    Tie                : {ties}/{n} ({100*ties/n:.0f}%)")
        print(f"    Loss (GPT-4o better): {losses}/{n} ({100*losses/n:.0f}%)")

    # Show a few worst LoRA answers for inspection
    worst = sorted(results, key=lambda r: r["lora_score"])[:3]
    print(f"\n  3 worst LoRA answers (for manual review):")
    for r in worst:
        print(f"\n    score={r['lora_score']}  Q: {r['question'][:80]}")
        print(f"    A: {r['lora_output'][:120]}{'…' if len(r['lora_output']) > 120 else ''}")
        if r.get("lora_notes"):
            print(f"    Notes: {r['lora_notes']}")

    print(f"\n{'═' * 70}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Eval fine-tuned model vs GPT-4o baseline")
    parser.add_argument("--adapter", required=True, help="Path to saved LoRA adapter directory")
    parser.add_argument("--eval-data", default="ml/data/eval_raw.jsonl")
    parser.add_argument("--judge-model", default="gpt-4o")
    parser.add_argument("--no-baseline", action="store_true",
                        help="Skip GPT-4o baseline scoring (faster, LoRA only)")
    parser.add_argument("--results-out", type=Path, default=None,
                        help="Optional path to save detailed JSONL results")
    parser.add_argument("--limit", type=int, default=None,
                        help="Evaluate only the first N examples (for quick sanity checks)")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY required — source backend/.env first")

    if not Path(args.eval_data).exists():
        raise SystemExit(
            f"Eval data not found at {args.eval_data}.\n"
            "Run: python ml/prepare_finetune.py"
        )

    from openai import OpenAI
    openai_client = OpenAI()

    eval_rows = [json.loads(l) for l in Path(args.eval_data).read_text().strip().splitlines()]
    if args.limit:
        eval_rows = eval_rows[: args.limit]

    print(f"Loading LoRA adapter from {args.adapter}…")
    model, tokenizer = _load_lora_model(args.adapter)
    print(f"Evaluating {len(eval_rows)} examples…\n")

    results: list[dict] = []

    for i, row in enumerate(eval_rows):
        question = row["input"]
        print(f"  [{i+1}/{len(eval_rows)}] {question[:70]}…", end="", flush=True)

        # LoRA inference
        lora_output = _infer_lora(model, tokenizer, question)
        time.sleep(args.sleep)
        lora_score, lora_notes = _judge(openai_client, args.judge_model, question, lora_output)
        print(f" lora={lora_score}", end="")

        result = {
            "question": question,
            "category": row.get("category", ""),
            "reference_output": row["output"],
            "lora_output": lora_output,
            "lora_score": lora_score,
            "lora_notes": lora_notes,
        }

        if not args.no_baseline:
            time.sleep(args.sleep)
            baseline_output = _infer_gpt4o(openai_client, question)
            time.sleep(args.sleep)
            baseline_score, baseline_notes = _judge(
                openai_client, args.judge_model, question, baseline_output
            )
            result["baseline_output"] = baseline_output
            result["baseline_score"] = baseline_score
            result["baseline_notes"] = baseline_notes
            print(f"  gpt4o={baseline_score}", end="")

        print()
        results.append(result)
        time.sleep(args.sleep)

    _print_summary(results)

    if args.results_out:
        args.results_out.parent.mkdir(parents=True, exist_ok=True)
        args.results_out.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in results) + "\n"
        )
        print(f"\nDetailed results saved to {args.results_out}")


if __name__ == "__main__":
    main()
