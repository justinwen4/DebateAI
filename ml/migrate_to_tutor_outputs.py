#!/usr/bin/env python3
"""
Rewrite debate-round style `output` text into clear domain explanations for the same JSONL rows.

- Preserves argumentative substance; does not add new evidence, authors, or claims.
- Sets mode to "normal" on every row (tutor register for training + RAG).
- Backs up the dataset before writing (use --backup) unless --dry-run / --preview.

Usage (from repo root, with backend venv if you use one):
  export OPENAI_API_KEY=...
  python ml/migrate_to_tutor_outputs.py --preview --use-llm --limit 2   # stdout only
  python ml/migrate_to_tutor_outputs.py --backup --use-llm             # full rewrite → dataset path
  python ml/migrate_to_tutor_outputs.py --use-llm --output out.jsonl   # full rewrite → other file
  python ml/migrate_to_tutor_outputs.py --mode-only --backup           # only set mode=normal

After a successful write, restart the API so Chroma reseeds from the updated file.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm_utils import chat_completion


REWRITE_SYSTEM = """You are a debate tutor assistant rewriting an answer to a student's debate question. \
The student already knows basic debate vocabulary (1AC, 1AR, K, condo, perm, framework, RVI, NIB, PIC, \
2NR, etc.) — never define those terms.

Your job: turn the original answer into a direct, assistant-style reply to the question.

ANSWER-FIRST (most important):
- The first sentence MUST directly answer the student's question, naming the actual subject of the \
question. Examples:
    Q: "Why can't the AFF weigh case against the K?"
    → "The aff can't weigh case against the K because theory and procedural questions resolve before \
substantive impacts — the same reason 'extinction outweighs' doesn't beat condo or disclosure."
    Q: "Why should the affirmative get RVIs?"
    → "The aff should get RVIs for two reasons. First, …"
    Q: "What should the K's framework interpretation be?"
    → "The K's framework interp should be that the judge evaluates the 1AC as a research project, …"
- Do NOT open with abstract restatement like "The argument centers on…", "This claim suggests…", \
"The negative emphasizes…". The reader is asking you a question; answer it.
- Do NOT open with a one-word headline like "Reverse causality." or "Logic." Fold that label into a \
real sentence ("This is reverse causality: ethical consequences don't translate to ethical reps because…").

VOICE:
- Neutral assistant tone, but talk like a debater, not an essayist. Use shorthand naturally (K, 1NC, \
2NR, condo, perm, T, NIB, PIC, RVI, link, alt, framework, FW). Refer to sides as "the aff" / "the neg" \
/ "they". Contractions are fine.
- Cut filler: no "it is important to note," "this highlights that," "this argument suggests," \
"ultimately," "thus." Be punchy.
- If the original numbers reasons ("First… Second…" or "1.… 2.…"), preserve that enumeration. \
Otherwise prefer flowing prose, not bullets/markdown.

LENGTH:
- Target 3–5 sentences (≈50–90 words). Go up to ~120 words ONLY if the original has multiple \
numbered subpoints that all carry distinct warrants. Never pad. Never add a sentence that just \
restates a previous sentence in different words.

SUBSTANCE:
- Preserve every substantive claim, warrant, and mechanism from the original. Do not add new facts, \
studies, authors, or impacts. Do not invent which side is speaking if unclear.

Output ONLY the rewritten answer text. No preamble, no meta commentary, no quotes around it."""


def _rewrite_openai(
    client,
    model: str,
    question: str,
    raw_output: str,
) -> str:
    user_msg = (
        f"STUDENT QUESTION: {question.strip()}\n\n"
        f"ORIGINAL ANSWER (rewrite this into an answer-first reply to the question above):\n"
        f"{raw_output.strip()}"
    )
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=240,
    )
    return (r.choices[0].message.content or "").strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate dataset outputs to tutor-style normal mode")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(__file__).resolve().parent / "dataset.tutor.jsonl",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write rewritten JSONL here instead of overwriting --dataset",
    )
    parser.add_argument("--backup", action="store_true", help="Copy input dataset to .jsonl.bak.<timestamp> before write")
    parser.add_argument("--dry-run", action="store_true", help="Print row count and keys only")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="With --use-llm: rewrite first --limit rows and print to stdout; no file write",
    )
    parser.add_argument("--use-llm", action="store_true", help="Call OpenAI to rewrite outputs")
    parser.add_argument("--mode-only", action="store_true", help="Only set mode=normal on all rows (no API)")
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument(
        "--source-outputs",
        type=Path,
        default=None,
        help="Optional JSONL whose `output` fields override --dataset rows (matched by index). "
        "Use to rewrite dense originals (dataset.jsonl) while keeping enriched inputs (dataset.tutor.jsonl).",
    )
    parser.add_argument("--limit", type=int, default=2, help="For --preview: number of rows to show")
    parser.add_argument("--offset", type=int, default=0, help="For --preview: starting row index")
    parser.add_argument("--sleep", type=float, default=0.2, help="Seconds between API calls (full run)")
    args = parser.parse_args()

    if args.use_llm and args.mode_only:
        raise SystemExit("Choose either --use-llm or --mode-only, not both.")

    path: Path = args.dataset
    lines = path.read_text().strip().splitlines()
    rows = [json.loads(line) for line in lines]

    if args.source_outputs is not None:
        src_lines = args.source_outputs.read_text().strip().splitlines()
        src_rows = [json.loads(line) for line in src_lines]
        if len(src_rows) != len(rows):
            raise SystemExit(
                f"--source-outputs row count ({len(src_rows)}) != --dataset row count ({len(rows)})."
            )
        for i, sr in enumerate(src_rows):
            rows[i] = {**rows[i], "output": sr.get("output", rows[i].get("output", ""))}

    if args.dry_run:
        print(f"Rows: {len(rows)}")
        if rows:
            print("Sample keys:", sorted(rows[0].keys()))
        return

    if args.preview:
        if not args.use_llm:
            raise SystemExit("--preview requires --use-llm")
        if not os.environ.get("OPENAI_API_KEY"):
            raise SystemExit("OPENAI_API_KEY is required for --preview --use-llm")
        from openai import OpenAI

        client = OpenAI()
        start = max(0, args.offset)
        end = min(start + args.limit, len(rows))
        for i in range(start, end):
            old = rows[i].get("output", "")
            q = rows[i].get("input", "")
            new = _rewrite_openai(client, args.model, q, old)
            print(f"======== Row {i} ========")
            print(f"--- question ---\n{q}\n")
            print("--- original ---\n", old[:800], "..." if len(old) > 800 else "", "\n", sep="")
            print("--- rewritten ---\n", new, "\n", sep="")
        print(f"(Preview only: rows {start}\u2013{end - 1}; run with --backup --use-llm to rewrite all and save.)")
        return

    if args.mode_only:
        if args.backup:
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            bak = path.with_suffix(f".jsonl.bak.{ts}")
            shutil.copy(path, bak)
            print(f"Backup: {bak}")
        out = [json.dumps({**dict(r), "mode": "normal"}, ensure_ascii=False) for r in rows]
        path.write_text("\n".join(out) + "\n")
        print(f"Set mode=normal on {len(out)} rows (outputs unchanged). Wrote {path}")
        return

    if not args.use_llm:
        raise SystemExit("Specify --use-llm (full rewrite), --mode-only, --preview, or --dry-run.")

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required for --use-llm")

    out_path = args.output if args.output is not None else path

    if args.backup:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        bak = path.with_suffix(f".jsonl.bak.{ts}")
        shutil.copy(path, bak)
        print(f"Backup (input): {bak}")

    from openai import OpenAI

    client = OpenAI()
    out_lines: list[str] = []
    for i, row in enumerate(rows):
        row = dict(row)
        row["output"] = _rewrite_openai(
            client,
            args.model,
            row.get("input", ""),
            row.get("output", ""),
        )
        row["mode"] = "normal"
        out_lines.append(json.dumps(row, ensure_ascii=False))
        print(f"[{i + 1}/{len(rows)}] rewritten")
        if args.sleep and i < len(rows) - 1:
            time.sleep(args.sleep)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(out_lines) + "\n")
    print(f"Wrote {len(out_lines)} rows to {out_path}")


if __name__ == "__main__":
    main()
