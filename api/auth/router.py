"""Authentication endpoints: signup (email-code verified), login, reset."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from ..db import pool
from ..email import (
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)
from ..golfers_repo import GOLFER_COLS, load_golfer
from ..ratelimit import limiter
from ..schemas import (
    AuthResult,
    Golfer,
    LoginIn,
    PasswordReset,
    PasswordResetRequest,
    ResendCodeIn,
    SignupIn,
    VerifySignupIn,
)
from .passwords import MIN_PASSWORD_LENGTH, hash_password, verify_password
from .tokens import bearer_token, create_reset_token, create_token, verify_reset_token, verify_token

router = APIRouter(prefix="/auth", tags=["auth"])

_FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_CODE_TTL = timedelta(minutes=10)
_MAX_CODE_ATTEMPTS = 5


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _code_expiry() -> datetime:
    return datetime.now(timezone.utc) + _CODE_TTL


@router.post("/signup", status_code=202)
@limiter.limit("5/minute")
def signup(request: Request, body: SignupIn):
    """Start signup: email a 6-digit code. The account isn't created until the
    code is verified (see /verify-signup)."""
    name = body.name.strip()
    email = body.email.strip().lower()
    if not name or not email or not body.password:
        raise HTTPException(400, "Name, email, and password are required")
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

    code = _generate_code()
    with pool.connection() as conn:
        if conn.execute(
            "SELECT 1 FROM golfers WHERE lower(email) = %s", (email,)
        ).fetchone():
            raise HTTPException(409, "That email is already registered")
        conn.execute(
            """
            INSERT INTO email_verifications
                (email, name, password_hash, code_hash, attempts, expires_at)
            VALUES (%s, %s, %s, %s, 0, %s)
            ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash,
                code_hash = EXCLUDED.code_hash,
                attempts = 0,
                expires_at = EXCLUDED.expires_at,
                created_at = now()
            """,
            (email, name, hash_password(body.password), hash_password(code), _code_expiry()),
        )
    send_verification_email(email, name, code)
    return {"ok": True, "email": email}


@router.post("/verify-signup", response_model=AuthResult)
@limiter.limit("10/minute")
def verify_signup(request: Request, body: VerifySignupIn):
    """Confirm the emailed code and create the account (logs them in)."""
    email = body.email.strip().lower()
    code = body.code.strip()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT name, password_hash, code_hash, attempts, expires_at "
            "FROM email_verifications WHERE email = %s",
            (email,),
        ).fetchone()
    if row is None:
        raise HTTPException(400, "No pending signup for that email. Please sign up again.")
    if row["expires_at"] < datetime.now(timezone.utc) or row["attempts"] >= _MAX_CODE_ATTEMPTS:
        with pool.connection() as conn:
            conn.execute("DELETE FROM email_verifications WHERE email = %s", (email,))
        raise HTTPException(400, "That code expired or had too many tries. Please sign up again.")
    if not verify_password(code, row["code_hash"]):
        with pool.connection() as conn:
            conn.execute(
                "UPDATE email_verifications SET attempts = attempts + 1 WHERE email = %s",
                (email,),
            )
        raise HTTPException(400, "Incorrect code.")

    with pool.connection() as conn:
        if conn.execute(
            "SELECT 1 FROM golfers WHERE lower(email) = %s", (email,)
        ).fetchone():
            raise HTTPException(409, "That email is already registered")
        golfer = conn.execute(
            f"INSERT INTO golfers (name, email, password_hash) "
            f"VALUES (%s, %s, %s) RETURNING {GOLFER_COLS}",
            (row["name"], email, row["password_hash"]),
        ).fetchone()
        conn.execute("DELETE FROM email_verifications WHERE email = %s", (email,))

    send_welcome_email(email, golfer["name"])
    return {"token": create_token(golfer["golfer_id"]), "golfer": golfer}


@router.post("/resend-code")
@limiter.limit("3/minute")
def resend_code(request: Request, body: ResendCodeIn):
    """Re-send a fresh verification code for a pending signup."""
    email = body.email.strip().lower()
    code = _generate_code()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT name FROM email_verifications WHERE email = %s", (email,)
        ).fetchone()
        if row is None:
            raise HTTPException(400, "No pending signup for that email. Please sign up again.")
        conn.execute(
            "UPDATE email_verifications SET code_hash = %s, attempts = 0, expires_at = %s "
            "WHERE email = %s",
            (hash_password(code), _code_expiry(), email),
        )
    send_verification_email(email, row["name"], code)
    return {"ok": True}


@router.post("/login", response_model=AuthResult)
@limiter.limit("10/minute")
def login(request: Request, body: LoginIn):
    email = body.email.strip().lower()
    with pool.connection() as conn:
        row = conn.execute(
            f"SELECT {GOLFER_COLS}, password_hash FROM golfers WHERE lower(email) = %s",
            (email,),
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    golfer = {k: v for k, v in row.items() if k != "password_hash"}
    return {"token": create_token(row["golfer_id"]), "golfer": golfer}


@router.post("/request-password-reset")
@limiter.limit("5/minute")
def request_password_reset(request: Request, body: PasswordResetRequest):
    """Email a reset link. 404s if no account has that email."""
    email = body.email.strip().lower()
    row = None
    if email:
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT golfer_id, name FROM golfers WHERE lower(email) = %s", (email,)
            ).fetchone()
    if row is None:
        raise HTTPException(404, "No account found with that email")
    token = create_reset_token(row["golfer_id"])
    url = f"{_FRONTEND_URL}/reset-password?token={token}"
    send_password_reset_email(email, row["name"], url)
    return {"ok": True}


@router.post("/reset-password", response_model=AuthResult)
@limiter.limit("10/minute")
def reset_password(request: Request, body: PasswordReset):
    gid = verify_reset_token(body.token)
    if gid is None:
        raise HTTPException(400, "This reset link is invalid or has expired")
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(400, f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    with pool.connection() as conn:
        row = conn.execute(
            f"UPDATE golfers SET password_hash = %s WHERE golfer_id = %s RETURNING {GOLFER_COLS}",
            (hash_password(body.password), gid),
        ).fetchone()
    if row is None:
        raise HTTPException(400, "This reset link is invalid or has expired")
    # Sign them in with a fresh session token.
    return {"token": create_token(gid), "golfer": row}


@router.get("/me", response_model=Golfer)
def me(authorization: str | None = Header(default=None)):
    gid = verify_token(bearer_token(authorization))
    if gid is None:
        raise HTTPException(401, "Not authenticated")
    with pool.connection() as conn:
        row = load_golfer(conn, gid)
    if row is None:
        raise HTTPException(401, "Not authenticated")
    return row
