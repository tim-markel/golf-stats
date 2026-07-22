"""Golfer CRUD (create + list/read + profile/credentials updates)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..auth import acting_golfer, hash_password, is_manager, require_admin
from ..db import pool
from ..golfers_repo import GOLFER_COLS, load_golfer
from ..schemas import CredentialsUpdate, Golfer, GolferIn, GolferUpdate

# Login required on all golfer routes; writes are admin/self-gated per endpoint.
router = APIRouter(prefix="/golfers", tags=["golfers"], dependencies=[Depends(acting_golfer)])


@router.get("", response_model=list[Golfer])
def list_golfers():
    with pool.connection() as conn:
        rows = conn.execute(
            f"SELECT {GOLFER_COLS} FROM golfers ORDER BY name"
        ).fetchall()
    return rows


@router.post("", response_model=Golfer, status_code=201)
def create_golfer(body: GolferIn, _admin: dict[str, Any] = Depends(require_admin)):
    with pool.connection() as conn:
        row = conn.execute(
            f"INSERT INTO golfers (name, handicap, ghin_id) "
            f"VALUES (%s, %s, %s) RETURNING {GOLFER_COLS}",
            (body.name, body.handicap, body.ghin_id),
        ).fetchone()
    return row


@router.patch("/{golfer_id}", response_model=Golfer)
def update_golfer(
    golfer_id: int, body: GolferUpdate, actor: dict[str, Any] = Depends(acting_golfer)
):
    # You may edit your own profile; only admins may edit others.
    if golfer_id != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only edit your own profile")
    # Only update the fields the client actually sent.
    fields = body.model_dump(exclude_unset=True)
    # Only admins may change the admin flag (prevents self-escalation).
    if fields.get("is_admin") is not None and not is_manager(actor):
        raise HTTPException(403, "Only admins can change roles")
    with pool.connection() as conn:
        # The super admin can never be demoted to a non-admin.
        if fields.get("is_admin") is False:
            is_super = conn.execute(
                "SELECT is_super_admin FROM golfers WHERE golfer_id = %s", (golfer_id,)
            ).fetchone()
            if is_super and is_super["is_super_admin"]:
                raise HTTPException(403, "The super admin cannot be demoted")
        if fields:
            # Field names come from GolferUpdate, so this is safe to interpolate.
            set_clause = ", ".join(f"{k} = %s" for k in fields)
            row = conn.execute(
                f"UPDATE golfers SET {set_clause} WHERE golfer_id = %s "
                f"RETURNING {GOLFER_COLS}",
                (*fields.values(), golfer_id),
            ).fetchone()
        else:
            row = load_golfer(conn, golfer_id)
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row


@router.get("/{golfer_id}", response_model=Golfer)
def get_golfer(golfer_id: int):
    with pool.connection() as conn:
        row = load_golfer(conn, golfer_id)
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row


@router.put("/{golfer_id}/credentials", response_model=Golfer)
def set_credentials(
    golfer_id: int, body: CredentialsUpdate, actor: dict[str, Any] = Depends(acting_golfer)
):
    """Set a golfer's login email and/or password. Self or admin only."""
    if golfer_id != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only change your own login")
    fields = body.model_dump(exclude_unset=True)
    sets: list[str] = []
    values: list[object] = []
    if "email" in fields:
        email = fields["email"]
        sets.append("email = %s")
        values.append(email.strip() if isinstance(email, str) and email.strip() else None)
    if "password" in fields:
        password = fields["password"]
        if not password:
            raise HTTPException(400, "Password cannot be empty")
        sets.append("password_hash = %s")
        values.append(hash_password(password))

    if not sets:
        raise HTTPException(400, "Nothing to update")

    values.append(golfer_id)
    with pool.connection() as conn:
        try:
            row = conn.execute(
                f"UPDATE golfers SET {', '.join(sets)} WHERE golfer_id = %s "
                f"RETURNING {GOLFER_COLS}",
                tuple(values),
            ).fetchone()
        except Exception as exc:  # e.g. duplicate email
            raise HTTPException(409, "That email is already in use") from exc
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row
