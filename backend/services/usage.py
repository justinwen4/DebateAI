import logging
from datetime import date, datetime, timezone

from supabase import Client

from services.limits import DOWNGRADE_NOTICE, PREMIUM_MODEL, SONNET_MONTHLY_LIMIT, STANDARD_MODEL

logger = logging.getLogger(__name__)


def _month_start() -> str:
    now = datetime.now(timezone.utc)
    return date(now.year, now.month, 1).isoformat()


def get_monthly_count(supabase: Client, user_id: str) -> int:
    result = (
        supabase.table("user_generation_usage")
        .select("generation_count")
        .eq("user_id", user_id)
        .eq("month_start", _month_start())
        .maybe_single()
        .execute()
    )
    if result and result.data:
        return int(result.data["generation_count"])
    return 0


def pick_model_for_generation(current_count: int) -> tuple[str, str | None]:
    """Return (model, optional_notice) for the next generation."""
    next_count = current_count + 1
    if next_count <= SONNET_MONTHLY_LIMIT:
        return PREMIUM_MODEL, None
    notice = (
        DOWNGRADE_NOTICE.format(limit=SONNET_MONTHLY_LIMIT)
        if next_count == SONNET_MONTHLY_LIMIT + 1
        else None
    )
    return STANDARD_MODEL, notice


def record_generation(supabase: Client, user_id: str) -> int:
    """Increment monthly usage after a successful generation."""
    response = supabase.rpc("increment_monthly_generations", {"p_user_id": user_id}).execute()
    count = response.data
    if isinstance(count, list):
        count = count[0] if count else 1
    count = int(count)
    tier = "premium" if count <= SONNET_MONTHLY_LIMIT else "standard"
    logger.info("generation user=%s monthly=%d tier=%s", user_id, count, tier)
    return count
