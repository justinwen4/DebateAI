from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from services import limits
from services.limits import enforce_rate_limit, validate_history


@pytest.mark.asyncio
async def test_enforce_rate_limit_raises_429_when_quota_exhausted(supabase_client):
    supabase_client.rpc.return_value.execute.return_value = MagicMock(data=False)

    with pytest.raises(HTTPException) as exc:
        await enforce_rate_limit(supabase_client, "user-1", "generate", 50)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_enforce_rate_limit_allows_when_quota_available(supabase_client):
    supabase_client.rpc.return_value.execute.return_value = MagicMock(data=True)

    await enforce_rate_limit(supabase_client, "user-1", "generate", 50)


@pytest.mark.asyncio
async def test_enforce_rate_limit_unwraps_list_payload(supabase_client):
    supabase_client.rpc.return_value.execute.return_value = MagicMock(data=[True])

    await enforce_rate_limit(supabase_client, "user-1", "generate", 50)


@pytest.mark.asyncio
async def test_enforce_rate_limit_fails_open_on_rpc_error(supabase_client):
    supabase_client.rpc.return_value.execute.side_effect = RuntimeError("db down")

    await enforce_rate_limit(supabase_client, "user-1", "generate", 50)


def test_validate_history_filters_invalid_entries():
    history = [
        {"role": "system", "content": "ignored"},
        {"role": "user", "content": "  hello  "},
        {"role": "assistant", "content": ""},
        {"role": "user", "content": 123},
    ]
    assert validate_history(history) == [{"role": "user", "content": "hello"}]


def test_validate_history_rejects_oversized_message(monkeypatch):
    monkeypatch.setattr(limits, "MAX_MESSAGE_CHARS", 10)
    with pytest.raises(HTTPException) as exc:
        validate_history([{"role": "user", "content": "x" * 11}])
    assert exc.value.status_code == 400


def test_validate_history_truncates_to_max_turns(monkeypatch):
    monkeypatch.setattr(limits, "MAX_HISTORY_TURNS", 2)
    history = [
        {"role": "user", "content": "one"},
        {"role": "assistant", "content": "two"},
        {"role": "user", "content": "three"},
    ]
    assert validate_history(history) == [
        {"role": "assistant", "content": "two"},
        {"role": "user", "content": "three"},
    ]
