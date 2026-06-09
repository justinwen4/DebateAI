import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services.auth import (
    AuthUser,
    _extract_bearer_token,
    ensure_auth_configured,
    require_user,
)


def test_ensure_auth_configured_raises_without_anon_key(monkeypatch):
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    with pytest.raises(RuntimeError, match="SUPABASE_ANON_KEY"):
        ensure_auth_configured()


def test_ensure_auth_configured_ok_when_anon_key_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    ensure_auth_configured()


@pytest.mark.parametrize(
    "authorization",
    [None, "", "Token abc", "Bearer ", "Bearer   "],
)
def test_extract_bearer_token_rejects_invalid(authorization):
    with pytest.raises(HTTPException) as exc:
        _extract_bearer_token(authorization)
    assert exc.value.status_code == 401


def test_extract_bearer_token_accepts_valid_header():
    assert _extract_bearer_token("Bearer jwt-token") == "jwt-token"


def test_require_user_raises_when_get_user_fails():
    mock_client = MagicMock()
    mock_client.auth.get_user.side_effect = RuntimeError("invalid jwt")

    with patch("services.auth._get_auth_client", return_value=mock_client):
        with pytest.raises(HTTPException) as exc:
            require_user(authorization="Bearer bad-token")
    assert exc.value.status_code == 401


def test_require_user_raises_when_user_is_none():
    mock_client = MagicMock()
    mock_client.auth.get_user.return_value = MagicMock(user=None)

    with patch("services.auth._get_auth_client", return_value=mock_client):
        with pytest.raises(HTTPException) as exc:
            require_user(authorization="Bearer token")
    assert exc.value.status_code == 401


def test_require_user_returns_auth_user_on_success():
    mock_user = MagicMock()
    mock_user.id = "user-123"
    mock_user.email = "test@example.com"
    mock_client = MagicMock()
    mock_client.auth.get_user.return_value = MagicMock(user=mock_user)

    with patch("services.auth._get_auth_client", return_value=mock_client):
        result = require_user(authorization="Bearer valid-token")

    assert result == AuthUser(id="user-123", email="test@example.com")
    mock_client.auth.get_user.assert_called_once_with("valid-token")
