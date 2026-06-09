from unittest.mock import MagicMock

import pytest

from services import usage
from services.usage import refund_generation, reserve_generation


def _mock_rpc_count(supabase_client: MagicMock, count: int) -> None:
    supabase_client.rpc.return_value.execute.return_value = MagicMock(data=count)


def test_reserve_generation_premium_at_cap_boundary(supabase_client, monkeypatch):
    monkeypatch.setattr(usage, "SONNET_MONTHLY_LIMIT", 30)
    _mock_rpc_count(supabase_client, 30)

    monthly, model, notice = reserve_generation(supabase_client, "user-1")

    assert monthly == 30
    assert model == usage.PREMIUM_MODEL
    assert notice is None


def test_reserve_generation_standard_with_notice_at_cap_plus_one(supabase_client, monkeypatch):
    monkeypatch.setattr(usage, "SONNET_MONTHLY_LIMIT", 30)
    _mock_rpc_count(supabase_client, 31)

    monthly, model, notice = reserve_generation(supabase_client, "user-1")

    assert monthly == 31
    assert model == usage.STANDARD_MODEL
    assert notice is not None
    assert "30" in notice


def test_reserve_generation_standard_without_notice_beyond_cap_plus_one(supabase_client, monkeypatch):
    monkeypatch.setattr(usage, "SONNET_MONTHLY_LIMIT", 30)
    _mock_rpc_count(supabase_client, 32)

    monthly, model, notice = reserve_generation(supabase_client, "user-1")

    assert monthly == 32
    assert model == usage.STANDARD_MODEL
    assert notice is None


def test_reserve_generation_unwraps_list_payload(supabase_client, monkeypatch):
    monkeypatch.setattr(usage, "SONNET_MONTHLY_LIMIT", 30)
    supabase_client.rpc.return_value.execute.return_value = MagicMock(data=[5])

    monthly, model, notice = reserve_generation(supabase_client, "user-1")

    assert monthly == 5
    assert model == usage.PREMIUM_MODEL
    assert notice is None


def test_refund_generation_swallows_rpc_errors(supabase_client):
    supabase_client.rpc.return_value.execute.side_effect = RuntimeError("db down")

    refund_generation(supabase_client, "user-1")
