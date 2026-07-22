"""Shared golfer data access — the canonical column list + a loader.

Import ``GOLFER_COLS`` wherever a golfer row is selected/returned so adding a
column is a one-line change instead of a repo-wide sweep.
"""
from __future__ import annotations

from typing import Any

GOLFER_COLS = "golfer_id, name, handicap, ghin_id, is_admin, is_super_admin, email"


def load_golfer(conn, golfer_id: int) -> dict[str, Any] | None:
    """Load one golfer (public columns) using an existing connection."""
    return conn.execute(
        f"SELECT {GOLFER_COLS} FROM golfers WHERE golfer_id = %s", (golfer_id,)
    ).fetchone()
