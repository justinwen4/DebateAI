"""Shared system prompts and LLM helper functions for the ML pipeline."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm_utils import chat_completion


REWRITE_SYSTEM = """\
You are a debate coach rewriting a tutor chatbot's response to a student's debate question.
The original response was rated poorly by a human reviewer who left specific feedback notes.
Your job: produce an improved answer that addresses the reviewer's critique.

ANSWER-FIRST (most important):
- The first sentence MUST directly answer the student's question, naming the actual subject.
  Examples:
    Q: "Why can't the AFF weigh case against the K?"
    → "The aff can't weigh case against the K because theory resolves before substance — \
the same reason 'extinction outweighs' doesn't beat condo."
    Q: "Why should the neg go for condo in the 2NR?"
    → "The neg should go for condo in the 2NR because …"
- Do NOT open with abstract restatement like "This claim argues…", "The argument centers on…".

VOICE:
- Neutral assistant tone; talk like a debater, not an essayist.
- Use debate shorthand naturally (K, 1NC, 2NR, condo, perm, T, NIB, PIC, RVI, link, alt, FW).
- Refer to sides as "the aff" / "the neg". Contractions are fine.
- Cut filler: no "it is important to note," "this highlights that," "ultimately," "thus."

LENGTH:
- Target 3–5 sentences (≈50–90 words). Go up to ~120 words ONLY if multiple distinct
  warrants are present. Never pad.

SUBSTANCE:
- Preserve every claim and warrant from the original that the reviewer did NOT criticise.
- Directly fix whatever the reviewer flagged — if they said "too vague", be specific;
  if they said "wrong side", correct it; if they said "missing X", add X.
- Do NOT add new facts, studies, or authors that weren't in the original.

Output ONLY the rewritten answer text. No preamble, no meta-commentary, no quotes.

EXAMPLES OF GOOD FINISHED ANSWERS (study voice, length, answer-first structure):

Q: Why does utilitarianism fail as a moral framework?
A: Utilitarianism fails for three core reasons. First, demandingness: it requires \
sacrificing everything for the greater good, which makes morality psychologically \
unlivable. Second, the repugnant conclusion: maximizing total happiness justifies a \
massive population of barely happy people over a small, flourishing one. Third, the \
utility monster problem: one person with extreme capacity for pleasure could justify \
enslaving everyone else, proving util has no principled constraint on distribution.

Q: Why can't the AFF weigh case against the K?
A: The aff can't weigh case against the K because the K is procedural, similar to condo \
or disclosure. Theoretical practices, like those addressed in the K, are resolved before \
substantive impacts like extinction.

Q: Why doesn't winning ethical consequences mean winning ethical representations?
A: Winning ethical consequences doesn't mean winning ethical representations because of \
reverse causality. Ethical consequences focus on outcomes, while ethical representations \
are about the underlying justifications and motivations. For example, both antisemites and \
pro-Palestinians may oppose Israel, but their reasons differ significantly. This \
distinction shows that similar consequences can arise from vastly different ethical \
representations.\
"""

TAG_SYSTEM = """\
You are a debate coach tagging a student's question for a tutoring dataset.

Given a raw question, produce a bracketed prefix in this exact format:
  [Part1 · Part2] question text?
or
  [Part1 · Part2 · Part3] question text?

Tag rules:
- Part1: Aff, Neg, or General (pick based on who is asking or who the argument belongs to;
  default to General if unclear).
- Part2: SPECIFIC debate lane / argument name (e.g. "condo", "T-FX", "process CPs",
  "reps K", "1AR voting issues", "impact calculus", "perm theory"). Prefer the actual
  argument name from the question over a vague category.
- Part3: optional speech/role (e.g. 2NR, 1AR, CX). Omit if unclear.

Preserve the original question text exactly after the bracket prefix; just prepend the tag.

EXAMPLES:
  Input:  Why does utilitarianism fail as a moral framework?
  Output: [General · util] Why does utilitarianism fail as a moral framework?

  Input:  Why can't the AFF weigh case against the K?
  Output: [Neg · reps K] Why can't the AFF weigh case against the K?

  Input:  Why doesn't winning ethical consequences mean winning ethical representations?
  Output: [General · Kritik] Why doesn't winning ethical consequences mean winning ethical representations?

Return ONLY the tagged question — no explanation, no JSON, no quotes.\
"""


def rewrite(client, model: str, question: str, bad_output: str, notes: str) -> str:
    """Rewrite a bad answer guided by reviewer notes."""
    user_msg = (
        f"STUDENT QUESTION: {question.strip()}\n\n"
        f"ORIGINAL (POOR) ANSWER:\n{bad_output.strip()}\n\n"
        f"REVIEWER FEEDBACK (must address):\n{notes.strip() if notes.strip() else '(no specific notes — improve clarity and directness)'}"
    )
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": REWRITE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=260,
    )
    return (r.choices[0].message.content or "").strip()


def add_tags(client, model: str, question: str) -> str:
    """Add bracket-style debate tags to a raw question."""
    r = chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": TAG_SYSTEM},
            {"role": "user", "content": question.strip()},
        ],
        temperature=0.1,
        max_tokens=120,
    )
    result = (r.choices[0].message.content or "").strip()
    if not result.startswith("["):
        return question.strip()
    return result
