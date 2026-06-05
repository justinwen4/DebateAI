import os
import threading
import time
from collections import defaultdict

from fastapi import HTTPException

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
PREMIUM_MODEL = os.environ.get("PREMIUM_MODEL", "claude-sonnet-4-6")
STANDARD_MODEL = os.environ.get("STANDARD_MODEL", "claude-haiku-4-5")
TITLE_MODEL = os.environ.get("TITLE_MODEL", "claude-haiku-4-5")

MAX_TITLE_CHARS = int(os.environ.get("MAX_TITLE_CHARS", "120"))
TITLE_DAILY_LIMIT = int(os.environ.get("TITLE_DAILY_LIMIT", "100"))

DOWNGRADE_NOTICE = (
    "You've used your {limit} premium responses this month. "
    "Continuing on our standard model (Haiku) until your limit resets."
)

_rate_lock = threading.Lock()
_rate_windows: dict[tuple[str, str], list[float]] = defaultdict(list)


def enforce_rate_limit(user_id: str, action: str, max_count: int, window_seconds: int = 86_400) -> None:
    key = (user_id, action)
    now = time.time()
    with _rate_lock:
        recent = [timestamp for timestamp in _rate_windows[key] if timestamp > now - window_seconds]
        if len(recent) >= max_count:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
        recent.append(now)
        _rate_windows[key] = recent


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
