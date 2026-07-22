"""Beer catalog: list popular/saved beers and add new ones."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..db import pool
from ..deps import current_account
from ..schemas import Beer, BeerCreate

# Shared beer catalog; login required (any golfer may add via "Other").
router = APIRouter(prefix="/beers", tags=["beers"], dependencies=[Depends(current_account)])


@router.get("", response_model=list[Beer])
def list_beers():
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT beer_id, name, abv FROM beer_options ORDER BY name"
        ).fetchall()
    return rows


@router.post("", response_model=Beer, status_code=201)
def create_beer(body: BeerCreate):
    # Upsert by name so the catalog never duplicates an "other" entry.
    with pool.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO beer_options (name, abv) VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE
                SET abv = COALESCE(EXCLUDED.abv, beer_options.abv)
            RETURNING beer_id, name, abv
            """,
            (body.name.strip(), body.abv),
        ).fetchone()
    return row
