"""Backfill latitude/longitude for existing courses that lack coordinates.

Usage:
    python -m scraper.geocode_backfill

Reads DATABASE_URL from scraper config. Respects Nominatim's ~1 req/sec limit.
"""
from __future__ import annotations

import os
import time

import psycopg
from dotenv import load_dotenv

from .geocode import geocode_course

load_dotenv()


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql://localhost:5432/golf_stats"
    )
    with psycopg.connect(database_url) as conn:
        rows = conn.execute(
            "SELECT id, name, city, country FROM courses "
            "WHERE latitude IS NULL OR longitude IS NULL ORDER BY name"
        ).fetchall()
        print(f"{len(rows)} course(s) need coordinates.")
        for cid, name, city, country in rows:
            coords = geocode_course(name, city, country)
            if coords:
                lat, lon = coords
                conn.execute(
                    "UPDATE courses SET latitude = %s, longitude = %s WHERE id = %s",
                    (lat, lon, cid),
                )
                conn.commit()
                print(f"  ✓ {name}: {lat:.5f}, {lon:.5f}")
            else:
                print(f"  ✗ {name}: not found")
            time.sleep(1.1)  # be polite to Nominatim


if __name__ == "__main__":
    main()
