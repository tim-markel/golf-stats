"""Stateless signed tokens (session + password-reset) and bearer parsing.

Token format (sent as ``Authorization: Bearer``):
    <b64url payload>.<b64url hmac-sha256(secret, payload)>
payload is JSON ``{"gid": <golfer_id>, "exp": <unix seconds>[, "typ": "reset"]}``.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

# Signing secret. Required in production; a dev-only fallback is used otherwise
# so local runs work without setup, but never silently in production.
_secret = os.environ.get("AUTH_SECRET")
if not _secret:
    if os.environ.get("APP_ENV", "").lower() == "production":
        raise RuntimeError(
            "AUTH_SECRET must be set in production (tokens would be forgeable)."
        )
    _secret = "dev-insecure-secret-change-me"
_SECRET = _secret.encode()
_TOKEN_TTL = 60 * 60 * 24 * 30  # session tokens: 30 days
_RESET_TTL = 60 * 60  # password-reset tokens: 1 hour


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(golfer_id: int, ttl: int, typ: str | None = None) -> str:
    body: dict = {"gid": golfer_id, "exp": int(time.time()) + ttl}
    if typ:
        body["typ"] = typ
    payload = _b64url(json.dumps(body).encode())
    sig = _b64url(hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def _decode(token: str | None) -> dict | None:
    """Return the payload of a valid, unexpired, correctly-signed token."""
    if not token:
        return None
    try:
        payload, sig = token.split(".")
        expected = _b64url(hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_b64url_decode(payload))
        if int(data["exp"]) < int(time.time()):
            return None
        return data
    except (ValueError, TypeError, KeyError):
        return None


def create_token(golfer_id: int) -> str:
    """Long-lived session token (no typ, for backward compatibility)."""
    return _sign(golfer_id, _TOKEN_TTL)


def verify_token(token: str | None) -> int | None:
    """golfer_id for a valid *session* token, else None."""
    data = _decode(token)
    if data and data.get("typ") in (None, "session"):
        return int(data["gid"])
    return None


def create_reset_token(golfer_id: int) -> str:
    """Short-lived, single-purpose password-reset token."""
    return _sign(golfer_id, _RESET_TTL, typ="reset")


def verify_reset_token(token: str | None) -> int | None:
    """golfer_id for a valid *reset* token, else None."""
    data = _decode(token)
    if data and data.get("typ") == "reset":
        return int(data["gid"])
    return None


def bearer_token(authorization: str | None) -> str | None:
    """Extract the token from an ``Authorization: Bearer <token>`` header."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None
