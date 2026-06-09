import os
from dataclasses import dataclass

from fastapi import Header, HTTPException
from supabase import Client, create_client

_auth_client: Client | None = None


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None


def ensure_auth_configured() -> None:
    """Fail fast at startup when the anon key is missing.

    Token verification must never fall back to SUPABASE_KEY (service role).
    """
    if not os.environ.get("SUPABASE_ANON_KEY"):
        raise RuntimeError(
            "SUPABASE_ANON_KEY is not set. Add it to the backend environment "
            "(Supabase dashboard → Settings → API Keys)."
        )


def _get_auth_client() -> Client:
    global _auth_client
    if _auth_client is None:
        ensure_auth_configured()
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_ANON_KEY"]
        _auth_client = create_client(url, key)
    return _auth_client


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return token


def require_user(authorization: str | None = Header(default=None)) -> AuthUser:
    token = _extract_bearer_token(authorization)
    try:
        response = _get_auth_client().auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None

    user = response.user
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return AuthUser(id=user.id, email=user.email)
