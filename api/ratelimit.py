"""Shared rate limiter (per client IP).

Storage is in-memory (per process) — fine for a single instance. For multiple
instances, point slowapi at Redis via a storage URI.
"""
from __future__ import annotations

from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-IP limiter used by slowapi decorators on the auth endpoints.
limiter = Limiter(key_func=get_remote_address)

# Manual limiter for keying by something other than IP (e.g. golfer id), so we
# can also exempt admins. Same in-memory backing as slowapi.
_manual = MovingWindowRateLimiter(MemoryStorage())


def within_limit(key: str, rate: str) -> bool:
    """Count a hit for `key`; return True if within `rate` (e.g. "5/hour")."""
    return _manual.hit(parse(rate), key)
