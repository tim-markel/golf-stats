"""Authentication: signup, login, and current-user lookup."""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException

from ..auth import (
    create_reset_token,
    create_token,
    hash_password,
    verify_password,
    verify_reset_token,
    verify_token,
)
from ..db import pool
from ..email import send_password_reset_email, send_welcome_email
from ..schemas import (
    AuthResult,
    Golfer,
    LoginIn,
    PasswordReset,
    PasswordResetRequest,
    SignupIn,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

_COLS = "golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email"


def _bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


@router.post("/signup", response_model=AuthResult, status_code=201)
def signup(body: SignupIn):
    name = body.name.strip()
    email = body.email.strip().lower()
    if not name or not email or not body.password:
        raise HTTPException(400, "Name, email, and password are required")

    password_hash = hash_password(body.password)
    with pool.connection() as conn:
        exists = conn.execute(
            "SELECT 1 FROM golfers WHERE lower(email) = %s", (email,)
        ).fetchone()
        if exists:
            raise HTTPException(409, "That email is already registered")
        row = conn.execute(
            f"INSERT INTO golfers (name, email, password_hash) "
            f"VALUES (%s, %s, %s) RETURNING {_COLS}",
            (name, email, password_hash),
        ).fetchone()

    # Welcome email (dev-mode logs it; real provider sends it — see api/email.py).
    send_welcome_email(email, name)
    return {"token": create_token(row["golfer_id"]), "golfer": row}


@router.post("/login", response_model=AuthResult)
def login(body: LoginIn):
    email = body.email.strip().lower()
    with pool.connection() as conn:
        row = conn.execute(
            f"SELECT {_COLS}, password_hash FROM golfers WHERE lower(email) = %s",
            (email,),
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    golfer = {k: v for k, v in row.items() if k != "password_hash"}
    return {"token": create_token(row["golfer_id"]), "golfer": golfer}


@router.post("/request-password-reset")
def request_password_reset(body: PasswordResetRequest):
    """Email a reset link. Always returns ok (doesn't reveal if the email exists)."""
    email = body.email.strip().lower()
    if email:
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT golfer_id, name FROM golfers WHERE lower(email) = %s", (email,)
            ).fetchone()
        if row:
            token = create_reset_token(row["golfer_id"])
            url = f"{_FRONTEND_URL}/reset-password?token={token}"
            send_password_reset_email(email, row["name"], url)
    return {"ok": True}


@router.post("/reset-password", response_model=AuthResult)
def reset_password(body: PasswordReset):
    gid = verify_reset_token(body.token)
    if gid is None:
        raise HTTPException(400, "This reset link is invalid or has expired")
    if not body.password:
        raise HTTPException(400, "Password cannot be empty")
    with pool.connection() as conn:
        row = conn.execute(
            f"UPDATE golfers SET password_hash = %s WHERE golfer_id = %s RETURNING {_COLS}",
            (hash_password(body.password), gid),
        ).fetchone()
    if row is None:
        raise HTTPException(400, "This reset link is invalid or has expired")
    # Sign them in with a fresh session token.
    return {"token": create_token(gid), "golfer": row}


@router.get("/me", response_model=Golfer)
def me(authorization: str | None = Header(default=None)):
    gid = verify_token(_bearer(authorization))
    if gid is None:
        raise HTTPException(401, "Not authenticated")
    with pool.connection() as conn:
        row = conn.execute(
            f"SELECT {_COLS} FROM golfers WHERE golfer_id = %s", (gid,)
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Not authenticated")
    return row
