"""Auth package: passwords, tokens, request dependencies, and the /auth router.

Import the public surface from here, e.g. ``from ..auth import acting_golfer``.
"""
from __future__ import annotations

from .deps import acting_golfer, current_account, is_manager, require_admin
from .passwords import hash_password, verify_password
from .router import router
from .tokens import (
    bearer_token,
    create_reset_token,
    create_token,
    verify_reset_token,
    verify_token,
)

__all__ = [
    "acting_golfer",
    "current_account",
    "is_manager",
    "require_admin",
    "hash_password",
    "verify_password",
    "bearer_token",
    "create_reset_token",
    "create_token",
    "verify_reset_token",
    "verify_token",
    "router",
]
