"""Outbound email.

Delivery is pluggable. With no provider configured (the default), emails are
"sent" in dev mode: logged to the server console and appended to
``dev_emails.log`` so you can read exactly what a user would receive. To send
real email later, set EMAIL_PROVIDER and implement ``_send_via_provider``
(e.g. Resend or SMTP) — nothing else has to change.
"""
from __future__ import annotations

import os
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
    # Wire a real transactional provider here (Resend, SMTP, SES, ...).
    raise NotImplementedError(
        f"EMAIL_PROVIDER={provider!r} is set but no provider is implemented yet."
    )
