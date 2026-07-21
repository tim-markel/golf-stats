"""Outbound email.

Delivery is pluggable via EMAIL_PROVIDER:
  - unset (default): dev mode — logs to the console and ``dev_emails.log``.
  - "resend": sends through Resend's HTTP API. Needs RESEND_API_KEY; the
    From address is EMAIL_FROM (default ``onboarding@resend.dev``).

Any provider failure falls back to the dev log so a reset link is never lost.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

_DEV_LOG = Path(__file__).resolve().parent.parent / "dev_emails.log"


def send_email(to: str, subject: str, body: str) -> None:
    provider = os.environ.get("EMAIL_PROVIDER")
    if provider:
        _send_via_provider(provider, to, subject, body)
    else:
        _send_dev(to, subject, body)


def send_welcome_email(to: str, name: str) -> None:
    """Welcome email sent when someone signs up with an email address."""
    subject = "Welcome to Bogey Book"
    body = (
        f"Hi {name},\n\n"
        "Welcome to Bogey Book! Your account is all set — you can now log your "
        "rounds hole by hole and watch your stats come to life.\n\n"
        "See you on the course,\n"
        "The Bogey Book team\n\n"
        "— You will never receive spam emails from us."
    )
    send_email(to, subject, body)


def send_password_reset_email(to: str, name: str, reset_url: str) -> None:
    """Password-reset email with a link back to the app."""
    subject = "Reset your Bogey Book password"
    body = (
        f"Hi {name},\n\n"
        "We got a request to reset your Bogey Book password. Use the link below "
        "to choose a new one (it expires in 1 hour):\n\n"
        f"{reset_url}\n\n"
        "If you didn't request this, you can ignore this email — your password "
        "won't change.\n\n"
        "The Bogey Book team\n\n"
        "— You will never receive spam emails from us."
    )
    send_email(to, subject, body)


def _send_dev(to: str, subject: str, body: str) -> None:
    stamp = datetime.now(timezone.utc).isoformat()
    rendered = (
        f"\n===== DEV EMAIL ({stamp}) =====\n"
        f"To: {to}\nSubject: {subject}\n\n{body}\n"
        f"===== END EMAIL =====\n"
    )
    print(rendered, flush=True)
    try:
        with _DEV_LOG.open("a", encoding="utf-8") as fh:
            fh.write(rendered)
    except OSError:
        pass  # logging to console already happened; file is best-effort


def _send_via_provider(provider: str, to: str, subject: str, body: str) -> None:
    if provider == "resend":
        _send_resend(to, subject, body)
    else:
        # Unknown provider — don't lose the message.
        print(f"Unknown EMAIL_PROVIDER={provider!r}; falling back to dev log", flush=True)
        _send_dev(to, subject, body)


def _send_resend(to: str, subject: str, body: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("EMAIL_FROM", "onboarding@resend.dev")
    if not api_key:
        print(
            "EMAIL_PROVIDER=resend but RESEND_API_KEY is not set; using dev log",
            flush=True,
        )
        _send_dev(to, subject, body)
        return

    payload = json.dumps(
        {"from": sender, "to": [to], "subject": subject, "text": body}
    ).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # A real User-Agent — Cloudflare (in front of Resend) blocks the
            # default urllib UA with a 403 (error 1010).
            "User-Agent": "BogeyBook/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        print(f"Resend send failed ({exc.code}): {detail}", flush=True)
        _send_dev(to, subject, body)  # fallback so the link isn't lost
    except Exception as exc:  # network error, timeout, ...
        print(f"Resend send error: {exc}", flush=True)
        _send_dev(to, subject, body)
