"""Practice sessions: range / putting / chipping logging for the dashboard."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..db import pool
from ..deps import acting_golfer, is_manager
from ..schemas import PracticeSession, PracticeSessionIn, PracticeSessionUpdate

# Login required on all practice routes (read-shared, write-scoped).
router = APIRouter(prefix="/practice", tags=["practice"], dependencies=[Depends(acting_golfer)])


def _assert_can_edit_session(conn, session_id: int, actor: dict[str, Any]) -> None:
    row = conn.execute(
        "SELECT golfer_id FROM practice_sessions WHERE id = %s", (session_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Practice session not found")
    if row["golfer_id"] != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only edit your own practice sessions")


def _row_to_session(row) -> dict:
    """Turn a flat practice_sessions row into the nested API shape."""
    return {
        "id": row["id"],
        "golfer_id": row["golfer_id"],
        "practiced_on": row["practiced_on"],
        "notes": row["notes"],
        "range": {
            "balls": row["range_balls"],
            "time": row["range_time"],
            "rating": row["range_rating"],
        },
        "putting": {
            "balls": None,
            "time": row["putting_time"],
            "rating": row["putting_rating"],
        },
        "chipping": {
            "balls": None,
            "time": row["chipping_time"],
            "rating": row["chipping_rating"],
        },
    }


@router.post("", response_model=PracticeSession, status_code=201)
def create_practice(body: PracticeSessionIn, actor: dict[str, Any] = Depends(acting_golfer)):
    if body.golfer_id != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only log practice for yourself")
    with pool.connection() as conn:
        if conn.execute(
            "SELECT 1 FROM golfers WHERE golfer_id = %s", (body.golfer_id,)
        ).fetchone() is None:
            raise HTTPException(404, "Golfer not found")
        row = conn.execute(
            """
            INSERT INTO practice_sessions (
                golfer_id, practiced_on,
                range_balls, range_time, range_rating,
                putting_time, putting_rating,
                chipping_time, chipping_rating,
                notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                body.golfer_id, body.practiced_on,
                body.range.balls, body.range.time, body.range.rating,
                body.putting.time, body.putting.rating,
                body.chipping.time, body.chipping.rating,
                body.notes,
            ),
        ).fetchone()
    return _row_to_session(row)


@router.get("", response_model=list[PracticeSession])
def list_practice(golfer_id: int):
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT * FROM practice_sessions WHERE golfer_id = %s "
            "ORDER BY practiced_on DESC, id DESC",
            (golfer_id,),
        ).fetchall()
    return [_row_to_session(r) for r in rows]


@router.get("/{session_id}", response_model=PracticeSession)
def get_practice(session_id: int):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT * FROM practice_sessions WHERE id = %s", (session_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Practice session not found")
    return _row_to_session(row)


@router.patch("/{session_id}", response_model=PracticeSession)
def update_practice(
    session_id: int, body: PracticeSessionUpdate, actor: dict[str, Any] = Depends(acting_golfer)
):
    with pool.connection() as conn:
        _assert_can_edit_session(conn, session_id, actor)
        with conn.transaction():
            row = conn.execute(
                """
                UPDATE practice_sessions SET
                    practiced_on = %s,
                    range_balls = %s, range_time = %s, range_rating = %s,
                    putting_time = %s, putting_rating = %s,
                    chipping_time = %s, chipping_rating = %s,
                    notes = %s
                WHERE id = %s
                RETURNING *
                """,
                (
                    body.practiced_on,
                    body.range.balls, body.range.time, body.range.rating,
                    body.putting.time, body.putting.rating,
                    body.chipping.time, body.chipping.rating,
                    body.notes,
                    session_id,
                ),
            ).fetchone()
    if row is None:
        raise HTTPException(404, "Practice session not found")
    return _row_to_session(row)


@router.delete("/{session_id}", status_code=204)
def delete_practice(session_id: int, actor: dict[str, Any] = Depends(acting_golfer)):
    with pool.connection() as conn:
        _assert_can_edit_session(conn, session_id, actor)
        with conn.transaction():
            conn.execute("DELETE FROM practice_sessions WHERE id = %s", (session_id,))
