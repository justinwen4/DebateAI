import asyncio
import os

from anthropic import Anthropic

from services.limits import PREMIUM_MODEL, TITLE_MODEL, MAX_TITLE_CHARS

client: Anthropic | None = None
MAX_HISTORY_TURNS = 8

SYSTEM_PROMPT = """
You are a sharp Lincoln-Douglas (LD) debate coach / tutor operating on the national/open circuit. The student already knows basic debate terms (1AR, 2AR, 2NR, CX, K, framework, perm, link, alt, etc.) — do NOT define them.
This is LD (one aff vs one neg) — never use policy-team speech labels like 2AC, 2NC, or other team-debate terms.

CIRCUIT CONTEXT:
You coach progressive LD. Default to national/open circuit assumptions unless the student explicitly asks for traditional or novice-circuit framing.
- Framework: progressive LD centers on standards (e.g., util, categorical imperatives, role of the ballot) rather than traditional value/criterion structure.
- Debate styles you coach across: LARP/policy-style (plan texts, DAs, CPs, solvency), kritikal/K debate (K, alt, link, role of the ballot), philosophy debate (dense Kant, contractualism, skepticism, etc.), theory debate (shells, interps, violations, voters), topicality debate (T, extra-T, etc.), tricks debate (skep, a priori, permissibility triggers), and general progressive argument.
- Recognize which style the student is working in from context and answer accordingly. If the style is ambiguous, ask.

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


def _chat_request_kwargs(model: str) -> dict:
    """Build model-specific Messages API kwargs.

    Claude Sonnet 5 rejects non-default sampling params and enables adaptive
    thinking by default; disable thinking so max_tokens covers the short reply.
    """
    kwargs: dict = {"model": model, "max_tokens": 300}
    if model.startswith("claude-sonnet-5"):
        kwargs["thinking"] = {"type": "disabled"}
    else:
        kwargs["temperature"] = 0.2
    return kwargs


def _generate_response_sync(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    model: str = PREMIUM_MODEL,
) -> str:
    """Generate a tutor-style response for the given debate question."""
    system, messages = _build_messages(prompt, context, history)

    msg = _get_client().messages.create(
        system=system,
        messages=messages,
        **_chat_request_kwargs(model),
    )
    parts = [block.text for block in msg.content if block.type == "text"]
    return "".join(parts).strip()


def _build_messages(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
) -> tuple[str, list[dict[str, str]]]:
    system = SYSTEM_PROMPT
    if context:
        system += (
            "\n\nRetrieved examples for this topic — if an example directly answers the question, follow it closely; if it covers a related but different angle, reason from its underlying logic to answer the specific question asked:\n\n"
            + context
        )

    messages = _sanitize_history(history)
    messages.append({"role": "user", "content": prompt})
    return system, messages


def stream_generate_response_sync(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    model: str = PREMIUM_MODEL,
):
    """Yield tutor response text chunks as they are generated."""
    system, messages = _build_messages(prompt, context, history)

    with _get_client().messages.stream(
        system=system,
        messages=messages,
        **_chat_request_kwargs(model),
    ) as stream:
        yield from stream.text_stream


async def generate_response(
    prompt: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    model: str = PREMIUM_MODEL,
) -> str:
    """Generate a tutor-style response (non-blocking)."""
    return await asyncio.to_thread(_generate_response_sync, prompt, context, history, model)


TITLE_SYSTEM_PROMPT = """Generate a concise chat title for a Lincoln-Douglas debate tutoring session.

Rules:
- 3 to 6 words
- Noun-phrase style topic label, not a question
- No trailing punctuation
- No quotes, brackets, or emojis
- Output only the title"""


def _sanitize_generated_title(raw: str, fallback: str) -> str:
    title = raw.strip().strip("\"'")
    title = title.rstrip(".!?")
    title = " ".join(title.split())
    if not title:
        return fallback
    if len(title) > MAX_TITLE_CHARS:
        title = title[:MAX_TITLE_CHARS].rstrip()
    return title


def _generate_title_sync(
    user_message: str,
    assistant_message: str,
    fallback: str,
    model: str = TITLE_MODEL,
) -> str:
    user_content = (
        f'User asked: "{user_message[:500]}"\n'
        f'Assistant replied: "{assistant_message[:500]}"'
    )
    msg = _get_client().messages.create(
        model=model,
        system=TITLE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
        temperature=0.3,
        max_tokens=20,
    )
    parts = [block.text for block in msg.content if block.type == "text"]
    return _sanitize_generated_title("".join(parts), fallback)


async def generate_title(
    user_message: str,
    assistant_message: str,
    fallback: str,
    model: str = TITLE_MODEL,
) -> str:
    """Generate a short conversation title (non-blocking)."""
    return await asyncio.to_thread(
        _generate_title_sync, user_message, assistant_message, fallback, model
    )
