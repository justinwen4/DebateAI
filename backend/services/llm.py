import asyncio
import os

from anthropic import Anthropic

from services.limits import PREMIUM_MODEL

client: Anthropic | None = None
MAX_HISTORY_TURNS = 8

SYSTEM_PROMPT = """
You are a sharp Lincoln-Douglas (LD) debate coach / tutor. The student already knows basic debate terms (1AR, 2AR, 2NR, CX, K, framework, perm, link, alt, etc.) — do NOT define them.
This is LD (one aff vs one neg) — never use policy-team speech labels like 2AC, 2NC, or other team-debate terms.

ANSWER FORMAT:
- The first sentence MUST directly answer the question — not set it up, not frame context. If you can delete the first sentence and the response still makes sense, it's preamble; cut it.
- Tight prose, stop when the argument is complete. Never pad to fill space.
- Before finalizing, evaluate the last sentence: if it restates the conclusion, summarizes what was already said, or just names the lesson without extending the warrant, delete it.
- HARD CAP: 100 words. You may go up to 120 only if the question has two genuinely distinct sub-parts.

STYLE:
- Use LD debate shorthand naturally (1AR, 2AR, 2NR, K, framework, perm, link, alt).
- No filler ("it is important to note," "ultimately," "this highlights," "in other words").
- Never use hollow intensifiers ("actually," "entirely," "immediately," "fundamentally," "real and lasting" "in the first place" "either way"). Never use agent-bloat framing ("The framework therefore argues we should X") — collapse it to the action ("X").
- Never use contrast-filler constructions: "not just X," "not merely X," "rather than just X," "instead of just X," "X isn't Y; it's Z." If the contrast is load-bearing, state the affirmative claim directly.
- Say "read" not "run" for presenting arguments ("read the K," "read framework," not "run the K").
- Every claim must have a warrant — explain why it's true, not just name the conclusion.
- Each sentence should advance the argument. Prefer one linked warrant chain over parallel mini-essays on separate topics.
- Do NOT invent specific author evidence or card names.
- If context is missing, say what would depend on the round.

STYLE AND FORMAT REFERENCE ONLY — these examples set tone, density, and structure. Do not infer substantive positions or which side to argue from them:

Q: Why shouldn't we evaluate the plan text in a vacuum?
A: Plan text in a vacuum creates a moral hazard: it allows any aff to be topical just by including the topic in the plan text. This justifies reading affs from previous topics, destroying debate, and forces every 2NR to be split between T and substance just to hold the aff to a stable advocacy. That sets the threshold for a negative win too high.

Q: Why does in-round abuse outweigh norm setting?
A: In-round abuse outweighs norm setting for three reasons. First, the judge's ballot only controls this round — voting on norm-setting speculation punishes a debater for future rounds. Second, norm-setting is empirically denied: debaters read contradictory theory interpretations in different rounds, so no stable norm emerges from any single ballot. Third, only in-round abuse is verifiable — the judge can confirm whether a practice skewed this round's clash, but cannot audit whether a ballot actually shifts future behavior across the pool.

When retrieved examples are provided below, use them as reference material. If an example directly answers the student's question, follow it closely. If it addresses a related but different angle, reason from its underlying logic to answer the specific question asked. If no examples are retrieved, answer from general LD principles and flag uncertainty rather than asserting topic-specific positions you cannot verify.
""".strip()


def _get_client() -> Anthropic:
    global client
    if client is None:
        client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return client


def _sanitize_history(history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not history:
        return []

    sanitized: list[dict[str, str]] = []
    for turn in history:
        role = turn.get("role")
        content = turn.get("content")
        if role not in {"user", "assistant"}:
            continue
        if not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        sanitized.append({"role": role, "content": content})

    return sanitized[-MAX_HISTORY_TURNS:]


def _generate_response_sync(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    model: str = PREMIUM_MODEL,
) -> str:
    """Generate a tutor-style response for the given debate question."""
    system = SYSTEM_PROMPT
    if context:
        system += (
            "\n\nRetrieved examples for this topic — if an example directly answers the question, follow it closely; if it covers a related but different angle, reason from its underlying logic to answer the specific question asked:\n\n"
            + context
        )

    messages = _sanitize_history(history)
    messages.append({"role": "user", "content": prompt})

    msg = _get_client().messages.create(
        model=model,
        system=system,
        messages=messages,
        temperature=0.2,
        max_tokens=300,
    )
    parts = [block.text for block in msg.content if block.type == "text"]
    return "".join(parts).strip()


async def generate_response(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    model: str = PREMIUM_MODEL,
) -> str:
    """Generate a tutor-style response (non-blocking)."""
    return await asyncio.to_thread(_generate_response_sync, prompt, context, history, model)
