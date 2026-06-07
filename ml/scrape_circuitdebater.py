#!/usr/bin/env python3
"""
Scrape ld.circuitdebater.org wiki pages (bypassing Cloudflare via Playwright)
and convert each article into Q&A training data rows in the format of
dataset.tutor.jsonl.

Writes to ml/review_batch.circuitdebater.jsonl (staging file — review before
merging into dataset.tutor.jsonl).

Usage (from repo root):
  source ml/.venv/bin/activate
  set -a && source backend/.env && set +a
  python ml/scrape_circuitdebater.py

Options:
  --pages N        max pages to process (default: all)
  --delay N        seconds between page loads (default: 2)
  --output FILE    output jsonl path (default: ml/review_batch.circuitdebater.jsonl)
  --rows-per-page N  Q&A rows to generate per article (default: 5)
  --start-from TITLE  skip pages alphabetically before this title
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
from llm_utils import anthropic_message

import anthropic
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

BASE_URL = "https://ld.circuitdebater.org"
ALL_PAGES_URL = f"{BASE_URL}/w/index.php/Special:AllPages"

# Pages to skip (navigation/meta pages)
SKIP_TITLES = {
    "Main Page", "CircuitDebater PF", "Help", "Help:Contents",
    "MediaWiki", "Template", "File", "Category", "Talk",
}

GENERATE_SYSTEM = """\
You are building a training dataset for a debate tutoring AI. Given the text of a
Circuit Debater LD wiki article, generate exactly {n} training rows as JSONL.

FORMAT — each row must be a single JSON object on one line:
  {{"input": "...", "output": "...", "category": "...", "mode": "normal"}}

RULES:
- "input": A practical question a student debater would ask their coach about this
  topic. Must start with a bracketed tag like [General · topic], [Neg · topic], or
  [Aff · topic]. Use middle dot · not dash.
- "output": Answer-first tutor-style response. First sentence MUST directly answer
  the question. Use debate shorthand (K, 1AR, 2NR, perm, fiat, condo, etc.) naturally.
  3-5 sentences (50-100 words). No filler phrases. No bullet points. No labels at
  the start of sentences. Do NOT define basic debate terms.
- "category": Exactly one of: "Theory", "Philosophy", "Kritik", or "LARP"
  - Theory: shells, condo, RVIs, topicality, disclosure, theory structure
  - Kritik: K, reps K, framework K, identity, methodology, alt, perm
  - Philosophy: moral frameworks, util, deont, virtue ethics, metaethics
  - LARP: policy/plan debate, DAs, CPs, solvency, fiat, plan focus
- "mode": Always "normal"

Generate EXACTLY {n} rows. Output ONLY valid JSONL — no markdown, no commentary,
no blank lines between rows. If the article is too thin for {n} distinct questions,
generate as many distinct ones as the content supports."""


def get_all_page_links(page) -> list[str]:
    """Navigate Special:AllPages and collect all article hrefs."""
    links: list[str] = []
    url = ALL_PAGES_URL
    while url:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        # Wait for Cloudflare challenge to resolve
        try:
            page.wait_for_selector(".mw-allpages-body, #mw-allpages-body", timeout=20000)
        except PWTimeoutError:
            print(f"  ! Timed out waiting for allpages body at {url}")
            break

        # Collect article links (not Special:/Talk:/etc.)
        anchors = page.query_selector_all(".mw-allpages-body a, #mw-allpages-body a")
        for a in anchors:
            href = a.get_attribute("href") or ""
            title = a.inner_text().strip()
            # Skip meta namespaces
            if any(title.startswith(ns) for ns in SKIP_TITLES):
                continue
            if href.startswith("/w/index.php/") and ":" not in href.split("/w/index.php/")[-1]:
                full = BASE_URL + href
                if full not in links:
                    links.append(full)

        # Check for "next page" link
        next_link = page.query_selector("a:has-text('Next page')")
        url = (BASE_URL + next_link.get_attribute("href")) if next_link else None

    return links


def extract_article_text(page, url: str) -> tuple[str, str]:
    """Load a wiki page, return (title, clean_text)."""
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    try:
        page.wait_for_selector("#mw-content-text, .mw-parser-output", timeout=20000)
    except PWTimeoutError:
        return "", ""

    title = page.title().replace(" - Circuit Debater LD", "").replace(" - My Wiki", "").strip()

    # Extract text from the main content area
    content = page.query_selector("#mw-content-text, .mw-parser-output")
    if not content:
        return title, ""

    # Remove edit-section spans and navboxes
    for sel in ["span.mw-editsection", ".navbox", ".toc", "#toc", ".mw-empty-elt"]:
        for el in content.query_selector_all(sel):
            el.evaluate("el => el.remove()")

    text = content.inner_text()
    # Clean up excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return title, text


def generate_rows(client, title: str, text: str, n: int) -> list[dict]:
    """Call Anthropic to generate n Q&A rows from article text."""
    if len(text) < 100:
        return []

    # Truncate very long articles to ~4000 chars to keep prompts focused
    truncated = text[:4000] if len(text) > 4000 else text

    system = GENERATE_SYSTEM.format(n=n)
    user = f"ARTICLE TITLE: {title}\n\nARTICLE TEXT:\n{truncated}"

    try:
        raw = anthropic_message(
            client,
            model="claude-sonnet-4-5",
            system=system,
            user=user,
            temperature=0.7,
            max_tokens=2048,
        )
    except Exception as e:
        print(f"  ! Anthropic error for '{title}': {e}")
        return []

    rows = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
            if all(k in obj for k in ("input", "output", "category", "mode")):
                rows.append(obj)
        except json.JSONDecodeError:
            pass

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=0, help="Max pages (0=all)")
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--output", default="ml/review_batch.circuitdebater.jsonl")
    parser.add_argument("--rows-per-page", type=int, default=5)
    parser.add_argument("--start-from", default="")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set. Run: set -a && source backend/.env && set +a")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        print("Fetching list of all wiki pages…")
        try:
            links = get_all_page_links(page)
        except Exception as e:
            print(f"ERROR collecting page list: {e}")
            browser.close()
            sys.exit(1)

        print(f"Found {len(links)} pages.")

        if args.start_from:
            # Skip until we hit the start-from title
            start_slug = args.start_from.lower().replace(" ", "_")
            links = [l for l in links if l.split("/")[-1].lower() >= start_slug]
            print(f"Starting from '{args.start_from}' — {len(links)} pages remaining.")

        if args.pages:
            links = links[: args.pages]

        total_rows = 0
        with open(out_path, "a", encoding="utf-8") as f:
            for i, url in enumerate(links, 1):
                slug = url.split("/w/index.php/")[-1]
                print(f"[{i}/{len(links)}] {slug}", end="  ", flush=True)

                try:
                    title, text = extract_article_text(page, url)
                except Exception as e:
                    print(f"ERROR: {e}")
                    continue

                if not text:
                    print("(empty, skipped)")
                    continue

                rows = generate_rows(client, title, text, args.rows_per_page)
                for row in rows:
                    f.write(json.dumps(row) + "\n")
                total_rows += len(rows)
                print(f"→ {len(rows)} rows (total: {total_rows})")

                time.sleep(args.delay)

        browser.close()

    print(f"\nDone. {total_rows} rows written to {out_path}")
    print("Review with: python ml/review_dataset.py --input ml/review_batch.circuitdebater.jsonl")
    print("Then merge approved rows into ml/dataset.tutor.jsonl")


if __name__ == "__main__":
    main()
