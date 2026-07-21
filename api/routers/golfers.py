"""Golfer CRUD (create + list/read)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..auth import hash_password
from ..db import pool
from ..schemas import CredentialsUpdate, Golfer, GolferIn, GolferUpdate

router = APIRouter(prefix="/golfers", tags=["golfers"])

_GOLFER_COLS = "golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email"


@router.get("", response_model=list[Golfer])
def list_golfers():
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email FROM golfers ORDER BY name"
        ).fetchall()
    return rows


@router.post("", response_model=Golfer, status_code=201)
def create_golfer(body: GolferIn):
    with pool.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO golfers (name, handicap, ghin_id)
            VALUES (%s, %s, %s)
            RETURNING golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email
            """,
            (body.name, body.handicap, body.ghin_id),
        ).fetchone()
    return row


@router.patch("/{golfer_id}", response_model=Golfer)
def update_golfer(golfer_id: int, body: GolferUpdate):
    # Only update the fields the client actually sent.
    fields = body.model_dump(exclude_unset=True)
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
                "RETURNING golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email",
                (*fields.values(), golfer_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email FROM golfers WHERE golfer_id = %s",
                (golfer_id,),
            ).fetchone()
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row


@router.get("/{golfer_id}", response_model=Golfer)
def get_golfer(golfer_id: int):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email FROM golfers WHERE golfer_id = %s",
            (golfer_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row


@router.put("/{golfer_id}/credentials", response_model=Golfer)
def set_credentials(golfer_id: int, body: CredentialsUpdate):
    """Admin-set a golfer's login email and/or password.

    NOTE: server-side admin enforcement lands with the login slice; for now the
    UI only exposes this to admins.
    """
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
                f"RETURNING {_GOLFER_COLS}",
                tuple(values),
            ).fetchone()
        except Exception as exc:  # e.g. duplicate email
            raise HTTPException(409, "That email is already in use") from exc
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row
