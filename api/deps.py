"""Request auth dependencies.

- current_account : the golfer the session token belongs to (401 if missing/bad).
- acting_golfer   : the effective golfer. A super admin may act as another golfer
                    by sending an ``X-Impersonate-Golfer-Id`` header (mirrors the
                    client-side impersonation); otherwise it's the account itself.
                    All role/ownership checks use the *acting* golfer, so an
                    impersonated normal golfer has no admin powers.
- require_admin    : 403 unless the acting golfer is an admin or super admin.

Shared social pool: any logged-in golfer may *read*; these are used to scope
*writes* to the acting golfer (admins may act on anyone).
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException

from .auth import verify_token
from .db import pool

_COLS = "golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email"


def _load_golfer(golfer_id: int) -> dict[str, Any] | None:
    with pool.connection() as conn:
        return conn.execute(
            f"SELECT {_COLS} FROM golfers WHERE golfer_id = %s", (golfer_id,)
        ).fetchone()


def current_account(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    gid = verify_token(token)
    if gid is None:
        raise HTTPException(401, "Not authenticated")
    golfer = _load_golfer(gid)
    if golfer is None:
        raise HTTPException(401, "Not authenticated")
    return golfer


def acting_golfer(
    account: dict[str, Any] = Depends(current_account),
    x_impersonate: str | None = Header(default=None, alias="X-Impersonate-Golfer-Id"),
) -> dict[str, Any]:
    # Only a super admin may act as someone else.
    if x_impersonate and account.get("is_super_admin"):
        try:
            target_id = int(x_impersonate)
        except (TypeError, ValueError):
            return account
        target = _load_golfer(target_id)
        if target is not None:
            return target
    return account


def require_admin(actor: dict[str, Any] = Depends(acting_golfer)) -> dict[str, Any]:
    if not (actor.get("is_admin") or actor.get("is_super_admin")):
        raise HTTPException(403, "Admin only")
    return actor


def is_manager(golfer: dict[str, Any]) -> bool:
    return bool(golfer.get("is_admin") or golfer.get("is_super_admin"))
