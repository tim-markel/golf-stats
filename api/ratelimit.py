"""Shared rate limiter (per client IP).

Storage is in-memory (per process) — fine for a single instance. For multiple
instances, point slowapi at Redis via a storage URI.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
