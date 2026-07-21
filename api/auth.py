"""Auth helpers: password hashing + stateless session tokens (stdlib only).

Password hash stored in golfers.password_hash:
    pbkdf2_sha256$<iterations>$<b64 salt>$<b64 hash>

Session token (returned on login/signup, sent as ``Authorization: Bearer``):
    <b64url payload>.<b64url hmac-sha256(secret, payload)>
where payload is JSON ``{"gid": <golfer_id>, "exp": <unix seconds>}``.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 200_000

# Signing secret for session tokens. Override in production via env.
_SECRET = os.environ.get("AUTH_SECRET", "dev-insecure-secret-change-me").encode()
_TOKEN_TTL = 60 * 60 * 24 * 30  # 30 days


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return "${}${}${}${}".format(
        _ALGO,
        _ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(dk).decode(),
    ).lstrip("$")


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, iterations, salt_b64, hash_b64 = stored.split("$")
        if algo != _ALGO:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt, int(iterations)
        )
        return hmac.compare_digest(dk, expected)
    except (ValueError, TypeError):
        return False


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


_RESET_TTL = 60 * 60  # password-reset links last 1 hour


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
