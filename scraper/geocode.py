"""Geocode a golf course to latitude/longitude via OpenStreetMap Nominatim.

Nominatim is free and needs no API key, but asks for a descriptive User-Agent
and no more than ~1 request/second. Callers doing bulk work should sleep
between calls (see geocode_backfill.py).
"""
from __future__ import annotations

from typing import Optional

import httpx

_NOMINATIM = "https://nominatim.openstreetmap.org/search"
_HEADERS = {"User-Agent": "bogey-book/1.0 (personal golf stats app)"}


def geocode_course(
    name: str,
    city: Optional[str] = None,
    country: Optional[str] = None,
    timeout: float = 15.0,
) -> Optional[tuple[float, float]]:
    """Return (latitude, longitude) for a course, or None if not found."""
    query = ", ".join(p for p in (name, city, country) if p)
    params = {"q": query, "format": "json", "limit": 1}
    try:
        resp = httpx.get(_NOMINATIM, params=params, headers=_HEADERS, timeout=timeout)
        resp.raise_for_status()
        results = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    if not results:
        return None
    try:
        return float(results[0]["lat"]), float(results[0]["lon"])
    except (KeyError, TypeError, ValueError):
        return None
