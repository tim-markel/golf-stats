"""Request auth dependencies.

- current_account : the golfer the session token belongs to (401 if missing/bad).
- acting_golfer   : the effective golfer. A super admin may act as another golfer
                    via an ``X-Impersonate-Golfer-Id`` header (mirrors client-side
                    impersonation); otherwise it's the account itself. All role /
                    ownership checks use the *acting* golfer, so an impersonated
                    normal golfer has no admin powers.
- require_admin   : 403 unless the acting golfer is an admin or super admin.

Shared social pool: any logged-in golfer may *read*; these scope *writes* to the
acting golfer (admins may act on anyone).
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException

from ..db import pool
from ..golfers_repo import load_golfer
from .tokens import bearer_token, verify_token


def current_account(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    gid = verify_token(bearer_token(authorization))
    if gid is None:
        raise HTTPException(401, "Not authenticated")
    with pool.connection() as conn:
        golfer = load_golfer(conn, gid)
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
        with pool.connection() as conn:
            target = load_golfer(conn, target_id)
        if target is not None:
            return target
    return account


def require_admin(actor: dict[str, Any] = Depends(acting_golfer)) -> dict[str, Any]:
    if not is_manager(actor):
        raise HTTPException(403, "Admin only")
    return actor


def is_manager(golfer: dict[str, Any]) -> bool:
    return bool(golfer.get("is_admin") or golfer.get("is_super_admin"))
