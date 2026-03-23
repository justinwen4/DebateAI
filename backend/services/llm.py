import os
from openai import OpenAI

client: OpenAI | None = None

SYSTEM_PROMPT = (
    "You are an elite competitive debater. "
    "Respond with concise, dense analytics in natural debate style. "
    "Open with a bold, punchy tagline of ~3-7 words that names the claim (e.g., 'Rule util solves.', 'No alternative framework.', 'Fairness outweighs education.'). "
    "Follow with 1–2 sentences of dense analytical warrants. No filler, no hedging."
    "Do not use bullet points, numbered lists, or rigid formatting. "
    "Use persuasive reasoning and debate terminology such as 'turns', "
    "'outweighs', 'precludes', 'links', 'no solvency', 'uniqueness', etc. "
    "Each response should be 2–5 fluid sentences of dense argumentation. "
    "Prioritize clarity and strategic utility."
)


def _get_client() -> OpenAI:
    global client
    if client is None:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return client


def generate_response(prompt: str, context: str = "") -> str:
    """Unified generation entrypoint — swap implementation later."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context:
        messages.append({
            "role": "system",
            "content": (
                "Use the following retrieved debate analytics as reference "
                "material. Draw on their reasoning style and substance, but "
                "do NOT copy them verbatim:\n\n" + context
            ),
        })

    messages.append({"role": "user", "content": prompt})

    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.8,
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()
