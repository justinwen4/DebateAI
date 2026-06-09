import logging

from supabase import Client

from services.limits import DOWNGRADE_NOTICE, PREMIUM_MODEL, SONNET_MONTHLY_LIMIT, STANDARD_MODEL

logger = logging.getLogger(__name__)


def reserve_generation(supabase: Client, user_id: str) -> tuple[int, str, str | None]:
    """Atomically claim one monthly generation and pick the model for it.

    Increments the user's monthly count BEFORE generating (single RPC), so
    concurrent requests cannot both slip under the premium cap — the model
    tier is decided by the count this request actually reserved.

    Returns (monthly_count_after_reservation, model, optional_downgrade_notice).
    """
    response = supabase.rpc("increment_monthly_generations", {"p_user_id": user_id}).execute()
    count = response.data
    if isinstance(count, list):
        count = count[0] if count else 1
    count = int(count)

    if count <= SONNET_MONTHLY_LIMIT:
        model, notice = PREMIUM_MODEL, None
    else:
        model = STANDARD_MODEL
        notice = (
            DOWNGRADE_NOTICE.format(limit=SONNET_MONTHLY_LIMIT)
            if count == SONNET_MONTHLY_LIMIT + 1
            else None
        )

    tier = "premium" if count <= SONNET_MONTHLY_LIMIT else "standard"
    logger.info("generation user=%s monthly=%d tier=%s", user_id, count, tier)
    return count, model, notice


def refund_generation(supabase: Client, user_id: str) -> None:
    """Return a reserved generation after a server-side failure (best effort).

    Only called when the LLM errored — NOT on client disconnect, since the
    tokens were already spent and refunding disconnects would let users
    bail out at 99% streamed for free premium usage.
    """
    try:
        supabase.rpc("refund_monthly_generation", {"p_user_id": user_id}).execute()
        logger.info("refunded generation user=%s", user_id)
    except Exception:
        logger.exception("refund failed user=%s", user_id)
