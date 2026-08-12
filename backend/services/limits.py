import asyncio
import logging
import os

from fastapi import HTTPException
from supabase import Client

logger = logging.getLogger(__name__)

MAX_PROMPT_CHARS = int(os.environ.get("MAX_PROMPT_CHARS", "8000"))
MAX_MESSAGE_CHARS = int(os.environ.get("MAX_MESSAGE_CHARS", "4000"))
MAX_HISTORY_TURNS = int(os.environ.get("MAX_HISTORY_TURNS", "8"))
MAX_FEEDBACK_TEXT_CHARS = int(os.environ.get("MAX_FEEDBACK_TEXT_CHARS", "8000"))
MAX_FEEDBACK_NOTES_CHARS = int(os.environ.get("MAX_FEEDBACK_NOTES_CHARS", "2000"))
MAX_TRAINING_AREA_CHARS = int(os.environ.get("MAX_TRAINING_AREA_CHARS", "2000"))
MAX_TRAINING_FILE_BYTES = int(os.environ.get("MAX_TRAINING_FILE_BYTES", "512000"))

GENERATE_DAILY_LIMIT = int(os.environ.get("GENERATE_DAILY_LIMIT", "50"))
FEEDBACK_DAILY_LIMIT = int(os.environ.get("FEEDBACK_DAILY_LIMIT", "20"))
TRAINING_DAILY_LIMIT = int(os.environ.get("TRAINING_DAILY_LIMIT", "5"))

SONNET_MONTHLY_LIMIT = int(os.environ.get("SONNET_MONTHLY_LIMIT", "30"))
PREMIUM_MODEL = os.environ.get("PREMIUM_MODEL", "claude-sonnet-5")
STANDARD_MODEL = os.environ.get("STANDARD_MODEL", "claude-haiku-4-5")
TITLE_MODEL = os.environ.get("TITLE_MODEL", "claude-haiku-4-5")

MAX_TITLE_CHARS = int(os.environ.get("MAX_TITLE_CHARS", "120"))
TITLE_DAILY_LIMIT = int(os.environ.get("TITLE_DAILY_LIMIT", "100"))

DOWNGRADE_NOTICE = (
    "You've used your {limit} premium responses this month. "
    "Continuing on our standard model (Haiku) until your limit resets."
)

async def enforce_rate_limit(supabase: Client, user_id: str, action: str, max_count: int) -> None:
    """Atomically consume one unit of the user's daily quota for `action`.

    Backed by the `consume_daily_quota` RPC (UTC day buckets in
    `user_daily_usage`), so limits survive restarts and are shared across
    workers/replicas. Fails open on infrastructure errors — the slowapi
    per-IP hourly limits remain as a backstop.
    """

    def _consume() -> bool:
        response = supabase.rpc(
            "consume_daily_quota",
            {"p_user_id": user_id, "p_action": action, "p_max_count": max_count},
        ).execute()
        allowed = response.data
        if isinstance(allowed, list):
            allowed = allowed[0] if allowed else False
        return bool(allowed)

    try:
        allowed = await asyncio.to_thread(_consume)
    except Exception:
        logger.exception("rate limit check failed user=%s action=%s — allowing request", user_id, action)
        return

    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")


def validate_history(history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not history:
        return []

    valid: list[dict[str, str]] = []
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
        if len(content) > MAX_MESSAGE_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Each message must be at most {MAX_MESSAGE_CHARS} characters.",
            )
        valid.append({"role": role, "content": content})

    if len(valid) > MAX_HISTORY_TURNS:
        valid = valid[-MAX_HISTORY_TURNS:]
    return valid
