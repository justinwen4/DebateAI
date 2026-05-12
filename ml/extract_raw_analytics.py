#!/usr/bin/env python3
"""
Extract raw analytics from .docx files and append them as {input, output, category, mode}
rows to ml/raw_analytics.jsonl.

Detection is style-based: paragraphs whose style name is "Tag" (configurable) are candidates.
A Tag paragraph is treated as a card *tagline* (and skipped) if the next non-empty paragraph
looks like a citation AND the paragraph after that has card-body formatting (highlight,
underline, or font size <= 9pt). Otherwise it's an analytic.

Consecutive analytic Tag paragraphs separated only by empty paragraphs are grouped into one
LLM call. gpt-4o-mini splits the block into discrete Q/A items with a prefixed question
(`[Aff/Neg/General · lane · speech?] question`) and an inferred category.

Usage:
  export OPENAI_API_KEY=...   # or: set -a && . backend/.env && set +a
  python ml/extract_raw_analytics.py --input-dir /path/to/docx/folder
  python ml/extract_raw_analytics.py --input-dir ./docs --limit 3 --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm_utils import chat_completion

try:
    from docx import Document
    from docx.shared import Pt
except ImportError:
    print(
        "Missing dependency: python-docx. Install with: pip install python-docx",
        file=sys.stderr,
    )
    raise


SYSTEM = """You convert raw debate "analytics" (short argumentative blurbs written by a debater) into tutoring Q/A pairs that a debater would actually ask their coach.

Input: a block of one or more analytic paragraphs extracted from a debate document.

GROUPING RULES — READ CAREFULLY:
- A claim followed by lettered/numbered sub-points (A], B], C], 1), 2), i., ii., etc.) is ONE analytic. Keep them together as a single item with the parent claim as the question and all sub-points in the output. DO NOT split A/B/C into separate items.
- Multiple analytics that share an obvious header (e.g. "Reject 1AR Voting Issues:" then 4 lettered warrants) belong to ONE item.
- Only split into multiple items when there are clearly independent claims with their own warrants.
- SKIP (do not return) any fragment that is just a warrant with no parent claim, or just an example/citation reference with no argumentative point of its own.

QUESTION STYLE — phrase as a debater asking a coach:
- Prefer: "why should we [reject/extend/get/win] X", "how do we respond to X", "what's the answer to [opponent argument]", "why does X [matter/outweigh/turn the case]", "what do we say to X".
- AVOID academic/abstract phrasings like "what are the implications of X", "what is the significance of X", "what does X argue".
- The question must be SPECIFIC to what the output actually says — not a generic question the output only partially answers. If the output says "you should reject 1AR voting issues because of skew/clash/psychology/no-risk", the question is "why should we reject 1AR voting issues?", NOT "what are the implications of structural skew?".

OUTPUT FORMAT — input MUST follow this template EXACTLY:

  [Part1 · Part2 · Part3] <question ending in ?>

The input field is ALWAYS: square brackets containing tags separated by middle-dot · (with spaces around each dot), then ONE space, then a real question ending in "?". NEVER omit the brackets. NEVER omit the question. NEVER put analytic content into the input field.

Examples of CORRECT input formatting:
  "[Neg · 1AR voting issues · 2NR] Why should we reject 1AR independent voting issues?"
  "[Neg · DTA on 1AR IVIs · 2NR] Why should one of our independent voting issues be drop-the-argument?"
  "[Aff · 1AR theory] Why is 1AR theory legitimate?"

Tag rules inside the brackets:
- Part1: Aff, Neg, or General — only if inferable, else General.
- Part2: SPECIFIC debate lane / argument name (e.g. "1AR voting issues", "condo", "T-FX", "process CPs", "reps K", "DTA on paradigm issues"). Prefer the actual argument name from the analytic over a vague category.
- Part3: optional speech/role (e.g. 2NR, 1AR, CX). Omit if unclear; two parts is fine: "[Neg · condo]".

Other fields:
- "output": the analytic text, mostly verbatim. Light cleanup only (strip bullets, fix whitespace, merge obviously-split lines, keep A]/B]/C] markers). DO NOT paraphrase or add new claims.

Return STRICT JSON and NOTHING else:
  {"items": [{"input": "[tags] question?", "output": "..."}, ...]}
If the entire block is warrant-only fragments with no parent claim, return {"items": []}.
"""


CITE_PAREN_RE = re.compile(r"\([A-Z][A-Za-z\-.\s]+,?\s+'?\d{2,4}\)")
CITE_BARE_RE = re.compile(r"\b[A-Z][A-Za-z\-]{1,20}(?:\s+(?:et\s+al\.?|and\s+[A-Z][A-Za-z\-]+))?\s+'?\d{2,4}\b")
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)
PUBLISHER_HINTS = (".com", ".org", ".net", ".edu", ".gov", "press", "journal", "review", "times", "post")
QUAL_HINTS = (
    " md,", " md ", " phd,", " phd ", " professor", " prof.",
    " writes", " notes", " argues", " explains", " contends", " furthers",
    " reports", " continues", " concludes", " finds", " observes",
    " associate ", " director ", " fellow ", " researcher ", " analyst ",
    " department of ", " university", " institute",
)
TAGLINE_TRAILING_PUNCT = ("–", "—", "-", ":", ",")


def _para_text(p) -> str:
    return (p.text or "").strip()


def _style_name(p) -> str:
    try:
        return (p.style.name or "").strip()
    except Exception:
        return ""


def _looks_like_citation(p) -> bool:
    text = _para_text(p)
    if not text:
        return False
    style = _style_name(p).lower()
    if "cite" in style or "card" in style:
        return True
    if CITE_PAREN_RE.search(text):
        return True
    if CITE_BARE_RE.search(text):
        return True
    if URL_RE.search(text):
        return True
    lower = " " + text.lower() + " "
    if any(h in lower for h in PUBLISHER_HINTS):
        return True
    if any(h in lower for h in QUAL_HINTS):
        return True
    return False


_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _has_card_body_formatting(p) -> bool:
    """Return True if paragraph has card-body signals: any run with highlight, underline,
    font size <= 9pt, or raw XML <w:highlight>/<w:shd>/<w:u>."""
    nine_pt = Pt(9)
    for run in p.runs:
        try:
            if run.font.highlight_color is not None:
                return True
            if run.font.underline:
                return True
            size = run.font.size
            if size is not None and size <= nine_pt:
                return True
        except Exception:
            pass
    try:
        xml = p._p.xml
        if f"{_W_NS}highlight" in xml:
            return True
        if f"{_W_NS}shd" in xml and 'w:fill="' in xml and 'w:fill="auto"' not in xml:
            return True
    except Exception:
        pass
    return False


def _next_nonempty(paragraphs, start: int) -> int:
    """Return index of next paragraph with non-empty text, or -1."""
    for j in range(start, len(paragraphs)):
        if _para_text(paragraphs[j]):
            return j
    return -1


def _is_card_tagline(paragraphs, idx: int) -> bool:
    """A Tag at idx is a card tagline if:
    - It ends in sentence-fragment punctuation (–, —, :, ,) AND the next non-empty para
      is a citation OR has card-body formatting, OR
    - Next non-empty is a citation AND the one after that has card-body formatting."""
    text = _para_text(paragraphs[idx])
    ends_fragment = text.endswith(TAGLINE_TRAILING_PUNCT)

    cite_idx = _next_nonempty(paragraphs, idx + 1)
    if cite_idx == -1:
        return False

    cite_p = paragraphs[cite_idx]
    cite_looks = _looks_like_citation(cite_p)
    cite_has_card_fmt = _has_card_body_formatting(cite_p)

    if ends_fragment and (cite_looks or cite_has_card_fmt):
        return True

    if not cite_looks:
        return False
    body_idx = _next_nonempty(paragraphs, cite_idx + 1)
    if body_idx == -1:
        return False
    return _has_card_body_formatting(paragraphs[body_idx])


def _group_analytics(paragraphs, tag_style: str):
    """Yield (group_text, paragraph_indices) for each group of consecutive analytic Tag
    paragraphs separated only by empty paragraphs.

    Also yields per-file counters via a final yield of a dict? No — keep simple and return
    groups; caller tallies separately via iter_tags.
    """
    i = 0
    n = len(paragraphs)
    while i < n:
        p = paragraphs[i]
        if _style_name(p) == tag_style and _para_text(p):
            if _is_card_tagline(paragraphs, i):
                yield ("tagline_skip", i, None)
                i += 1
                continue
            group_texts: list[str] = [_para_text(p)]
            group_indices: list[int] = [i]
            j = i + 1
            while j < n:
                pj = paragraphs[j]
                tj = _para_text(pj)
                if not tj:
                    j += 1
                    continue
                if _style_name(pj) == tag_style and not _is_card_tagline(paragraphs, j):
                    group_texts.append(tj)
                    group_indices.append(j)
                    j += 1
                    continue
                break
            yield ("analytic_group", group_indices, "\n\n".join(group_texts))
            i = j
        else:
            i += 1


def _call_llm(client, model: str, block: str) -> list[dict]:
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Analytic block:\n\n{block}"},
        ],
        temperature=0.2,
        max_tokens=1500,
        response_format={"type": "json_object"},
    )
    content = (r.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        print(f"  ! Non-JSON response, skipping: {content[:160]}", file=sys.stderr)
        return []
    items = data.get("items") or []
    cleaned: list[dict] = []
    for it in items:
        inp = (it.get("input") or "").strip()
        out = (it.get("output") or "").strip()
        if inp and out:
            cleaned.append({"input": inp, "output": out, "mode": "normal"})
    return cleaned


def _iter_docx(root: Path) -> Iterable[Path]:
    for p in sorted(root.rglob("*.docx")):
        if p.name.startswith("~$"):
            continue
        yield p


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract raw analytics from .docx files")
    parser.add_argument("--input-dir", type=Path, required=True, help="Directory to recursively scan for .docx")
    parser.add_argument("--output", type=Path, default=Path("ml/raw_analytics.jsonl"))
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--tag-style", default="Tag", help="Paragraph style name used for analytics/taglines")
    parser.add_argument("--limit", type=int, default=0, help="Max analytic groups to process (0 = all)")
    parser.add_argument("--max-files", type=int, default=0, help="Stop after this many .docx files (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print items; do not write output file")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    if not args.input_dir.exists() or not args.input_dir.is_dir():
        raise SystemExit(f"--input-dir not found or not a directory: {args.input_dir}")

    if not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is required (e.g. export or source backend/.env)")

    from openai import OpenAI

    client = OpenAI()

    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        out_fh = args.output.open("a", encoding="utf-8")
    else:
        out_fh = None

    total_groups = 0
    total_rows = 0
    files_processed = 0

    try:
        for docx_path in _iter_docx(args.input_dir):
            if args.max_files and files_processed >= args.max_files:
                print(f"Reached --max-files {args.max_files}, stopping.")
                break
            files_processed += 1
            try:
                doc = Document(str(docx_path))
            except Exception as e:
                print(f"! Failed to open {docx_path}: {e}", file=sys.stderr)
                continue

            paragraphs = list(doc.paragraphs)
            tags_found = 0
            taglines_skipped = 0
            analytic_groups = 0
            rows_written = 0

            for p in paragraphs:
                if _style_name(p) == args.tag_style and _para_text(p):
                    tags_found += 1

            for kind, indices, block in _group_analytics(paragraphs, args.tag_style):
                if kind == "tagline_skip":
                    taglines_skipped += 1
                    continue
                analytic_groups += 1
                if args.limit and total_groups >= args.limit:
                    break
                total_groups += 1

                items = _call_llm(client, args.model, block)
                for it in items:
                    line = json.dumps(it, ensure_ascii=False)
                    if args.dry_run:
                        print(line)
                    else:
                        out_fh.write(line + "\n")
                        out_fh.flush()
                    rows_written += 1
                    total_rows += 1

                if args.sleep:
                    time.sleep(args.sleep)

            print(
                f"[{docx_path}] tags={tags_found} taglines_skipped={taglines_skipped} "
                f"analytic_groups={analytic_groups} rows_written={rows_written}"
            )

            if args.limit and total_groups >= args.limit:
                print(f"Reached --limit {args.limit}, stopping.")
                break
    finally:
        if out_fh is not None:
            out_fh.close()

    print(f"Done. Total groups processed: {total_groups}. Total rows: {total_rows}.")
    if not args.dry_run:
        print(f"Appended to {args.output}")


if __name__ == "__main__":
    main()
