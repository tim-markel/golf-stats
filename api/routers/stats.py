"""Aggregated stats powering the golfer visualization page."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..schemas import GolferStats

router = APIRouter(prefix="/golfers", tags=["stats"])


@router.get("/{golfer_id}/stats", response_model=GolferStats)
def golfer_stats(golfer_id: int):
    with pool.connection() as conn:
        golfer = conn.execute(
            "SELECT golfer_id, name, handicap, ghin_id FROM golfers WHERE golfer_id = %s",
            (golfer_id,),
        ).fetchone()
        if golfer is None:
            raise HTTPException(404, "Golfer not found")

        # Per-round summaries (round_stats view joined with round/course meta).
        rounds = conn.execute(
            """
            SELECT r.round_id, r.played_on, c.name AS course_name,
                   COALESCE(rs.holes_played, 0)   AS holes_played,
                   rs.total_score, rs.total_putts,
                   COALESCE(rs.greens_in_reg, 0)  AS greens_in_reg,
                   COALESCE(rs.fairways_hit, 0)   AS fairways_hit,
                   COALESCE(rs.driving_holes, 0)  AS driving_holes,
                   COALESCE(rs.up_and_downs, 0)   AS up_and_downs,
                   COALESCE(rs.penalty_holes, 0)  AS penalty_holes,
                   COALESCE(rs.balls_lost, 0)     AS balls_lost,
                   COALESCE(rs.beers_finished, 0) AS beers_finished
            FROM rounds r
            JOIN courses c ON c.id = r.course_id
            LEFT JOIN round_stats rs ON rs.round_id = r.round_id
            WHERE r.golfer_id = %s
            ORDER BY r.played_on
            """,
            (golfer_id,),
        ).fetchall()

    n = len(rounds)
    scored = [r for r in rounds if r["total_score"] is not None]
    avg_score = (
        sum(r["total_score"] for r in scored) / len(scored) if scored else None
    )
    putted = [r for r in rounds if r["total_putts"] is not None]
    avg_putts = (
        sum(r["total_putts"] for r in putted) / len(putted) if putted else None
    )
    total_holes = sum(r["holes_played"] for r in rounds)
    total_gir = sum(r["greens_in_reg"] for r in rounds)
    total_fw = sum(r["fairways_hit"] for r in rounds)
    total_drv = sum(r["driving_holes"] for r in rounds)
    gir_pct = (100.0 * total_gir / total_holes) if total_holes else None
    fairway_pct = (100.0 * total_fw / total_drv) if total_drv else None

    return {
        "golfer": golfer,
        "rounds_played": n,
        "avg_score": avg_score,
        "avg_putts": avg_putts,
        "gir_pct": gir_pct,
        "fairway_pct": fairway_pct,
        "rounds": rounds,
    }
