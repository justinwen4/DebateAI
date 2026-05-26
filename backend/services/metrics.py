import secrets

import os

from supabase import Client


def fetch_product_metrics(supabase: Client, days: int = 30) -> dict:
    summary_response = supabase.rpc("admin_product_metrics", {"p_days": days}).execute()
    daily_response = supabase.rpc("admin_product_metrics_daily", {"p_days": days}).execute()

    summary = summary_response.data
    if isinstance(summary, list):
        summary = summary[0] if summary else {}

    return {
        "summary": summary or {},
        "daily": daily_response.data or [],
    }


def is_admin_configured() -> bool:
    return bool(os.environ.get("ADMIN_API_KEY", "").strip())


def verify_admin_key(provided: str | None) -> bool:
    expected = os.environ.get("ADMIN_API_KEY", "").strip()
    if not expected or not provided:
        return False
    return secrets.compare_digest(provided, expected)
