"""Golfer CRUD (create + list/read)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..schemas import Golfer, GolferIn, GolferUpdate

router = APIRouter(prefix="/golfers", tags=["golfers"])


@router.get("", response_model=list[Golfer])
def list_golfers():
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT golfer_id, name, handicap, ghin_id FROM golfers ORDER BY name"
        ).fetchall()
    return rows


@router.post("", response_model=Golfer, status_code=201)
def create_golfer(body: GolferIn):
    with pool.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO golfers (name, handicap, ghin_id)
            VALUES (%s, %s, %s)
            RETURNING golfer_id, name, handicap, ghin_id
            """,
            (body.name, body.handicap, body.ghin_id),
        ).fetchone()
    return row


@router.patch("/{golfer_id}", response_model=Golfer)
def update_golfer(golfer_id: int, body: GolferUpdate):
    # Only update the fields the client actually sent.
    fields = body.model_dump(exclude_unset=True)
    with pool.connection() as conn:
        if fields:
            # Field names come from GolferUpdate, so this is safe to interpolate.
            set_clause = ", ".join(f"{k} = %s" for k in fields)
            row = conn.execute(
                f"UPDATE golfers SET {set_clause} WHERE golfer_id = %s "
                "RETURNING golfer_id, name, handicap, ghin_id",
                (*fields.values(), golfer_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT golfer_id, name, handicap, ghin_id FROM golfers WHERE golfer_id = %s",
                (golfer_id,),
            ).fetchone()
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row


@router.get("/{golfer_id}", response_model=Golfer)
def get_golfer(golfer_id: int):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT golfer_id, name, handicap, ghin_id FROM golfers WHERE golfer_id = %s",
            (golfer_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Golfer not found")
    return row
