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
                   COALESCE(rs.beers_finished, 0) AS beers_finished,
                   COALESCE(rs.beer_oz, 0)        AS beer_oz,
                   t.course_rating, t.slope_rating
            FROM rounds r
            JOIN courses c ON c.id = r.course_id
            LEFT JOIN round_stats rs ON rs.round_id = r.round_id
            LEFT JOIN tees t ON t.id = r.tee_id
            WHERE r.golfer_id = %s
            ORDER BY r.played_on
            """,
            (golfer_id,),
        ).fetchall()

    n = len(rounds)
    # Score/putts totals only compare across full 18-hole rounds, so exclude
    # 9-hole (or otherwise partial) rounds from those averages.
    full18 = [r for r in rounds if r["holes_played"] == 18]
    scored = [r for r in full18 if r["total_score"] is not None]
    avg_score = (
        sum(r["total_score"] for r in scored) / len(scored) if scored else None
    )
    putted = [r for r in full18 if r["total_putts"] is not None]
    avg_putts = (
        sum(r["total_putts"] for r in putted) / len(putted) if putted else None
    )
    total_holes = sum(r["holes_played"] for r in rounds)
    total_gir = sum(r["greens_in_reg"] for r in rounds)
    total_fw = sum(r["fairways_hit"] for r in rounds)
    total_drv = sum(r["driving_holes"] for r in rounds)
    gir_pct = (100.0 * total_gir / total_holes) if total_holes else None
    fairway_pct = (100.0 * total_fw / total_drv) if total_drv else None
    handicap_index = compute_handicap_index(full18)

    return {
        "golfer": golfer,
        "rounds_played": n,
        "avg_score": avg_score,
        "avg_putts": avg_putts,
        "gir_pct": gir_pct,
        "fairway_pct": fairway_pct,
        "handicap_index": handicap_index,
        "rounds": rounds,
    }


# WHS table: differentials available -> (count averaged, adjustment).
def _whs_params(n: int):
    if n >= 20: return 8, 0.0
    if n == 19: return 7, 0.0
    if n >= 17: return 6, 0.0
    if n >= 15: return 5, 0.0
    if n >= 12: return 4, 0.0
    if n >= 9: return 3, 0.0
    if n >= 7: return 2, 0.0
    if n == 6: return 2, -1.0
    if n == 5: return 1, 0.0
    if n == 4: return 1, -1.0
    return 1, -2.0  # n == 3


def compute_handicap_index(full18_rounds):
    """Score differential = (113 / slope) * (score - rating); index = best of
    the most recent 20 (per the WHS table). Needs >= 3 rated 18-hole rounds."""
    diffs = []
    for r in full18_rounds:  # already chronological
        if r["total_score"] is None or not r["slope_rating"] or r["course_rating"] is None:
            continue
        diffs.append((113.0 / r["slope_rating"]) * (r["total_score"] - float(r["course_rating"])))
    pool = diffs[-20:]  # most recent 20 eligible rounds
    if len(pool) < 3:
        return None
    count, adj = _whs_params(len(pool))
    lowest = sorted(pool)[:count]
    return round(sum(lowest) / len(lowest) + adj, 1)
