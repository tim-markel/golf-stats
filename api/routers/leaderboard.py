"""Leaderboard: ranked golfer stats + top scores per course."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter

from ..db import pool
from ..schemas import Leaderboard
from .stats import compute_handicap_index

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard():
    with pool.connection() as conn:
        rounds = conn.execute(
            """
            SELECT r.golfer_id, g.name AS golfer_name, r.played_on,
                   r.course_id, c.name AS course_name, c.holes_count,
                   COALESCE(rs.holes_played, 0)  AS holes_played,
                   rs.total_score, rs.total_putts,
                   COALESCE(rs.greens_in_reg, 0) AS greens_in_reg,
                   COALESCE(rs.fairways_hit, 0)  AS fairways_hit,
                   COALESCE(rs.driving_holes, 0) AS driving_holes,
                   t.course_rating, t.slope_rating
            FROM rounds r
            JOIN golfers g ON g.golfer_id = r.golfer_id
            JOIN courses c ON c.id = r.course_id
            LEFT JOIN round_stats rs ON rs.round_id = r.round_id
            LEFT JOIN tees t ON t.id = r.tee_id
            ORDER BY r.golfer_id, r.played_on
            """
        ).fetchall()

        beer_rows = conn.execute(
            "SELECT r.golfer_id, COUNT(*) AS n, COALESCE(SUM(hb.size_oz), 0) AS oz "
            "FROM hole_beer hb JOIN hole_stats hs ON hs.id = hb.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id GROUP BY r.golfer_id"
        ).fetchall()
        nic_rows = conn.execute(
            "SELECT r.golfer_id, COALESCE(SUM(hn.quantity), 0) AS n "
            "FROM hole_nicotine hn JOIN hole_stats hs ON hs.id = hn.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id GROUP BY r.golfer_id"
        ).fetchall()
        weed_rows = conn.execute(
            "SELECT r.golfer_id, COUNT(*) AS n "
            "FROM hole_weed hw JOIN hole_stats hs ON hs.id = hw.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id GROUP BY r.golfer_id"
        ).fetchall()
        hotdog_rows = conn.execute(
            "SELECT r.golfer_id, COALESCE(SUM(hs.hotdogs), 0) AS n "
            "FROM hole_stats hs JOIN rounds r ON r.round_id = hs.round_id "
            "GROUP BY r.golfer_id"
        ).fetchall()

    names = {r["golfer_id"]: r["golfer_name"] for r in rounds}

    def vice_list(rows, detail=None):
        out = [
            {
                "golfer_id": row["golfer_id"],
                "name": names.get(row["golfer_id"], "?"),
                "total": float(row["n"]),
                "detail": detail(row) if detail else None,
            }
            for row in rows
            if row["n"] and row["n"] > 0
        ]
        out.sort(key=lambda x: -x["total"])
        return out

    beers = vice_list(beer_rows, lambda r: f"{float(r['oz']):g} oz" if r["oz"] else None)
    nicotine = vice_list(nic_rows)
    weed = vice_list(weed_rows)
    hotdogs = vice_list(hotdog_rows)

    # --- per-golfer stats (18-hole rounds for score/putts/handicap) ---
    by_golfer = defaultdict(list)
    for r in rounds:
        by_golfer[r["golfer_id"]].append(r)

    golfers = []
    for gid, rs in by_golfer.items():
        full18 = [r for r in rs if r["holes_played"] == 18]
        scored = [r for r in full18 if r["total_score"] is not None]
        putted = [r for r in full18 if r["total_putts"] is not None]
        th = sum(r["holes_played"] for r in rs)
        tg = sum(r["greens_in_reg"] for r in rs)
        tf = sum(r["fairways_hit"] for r in rs)
        td = sum(r["driving_holes"] for r in rs)
        golfers.append(
            {
                "golfer_id": gid,
                "name": rs[0]["golfer_name"],
                "rounds_played": len(rs),
                "handicap_index": compute_handicap_index(full18),
                "avg_score": (sum(r["total_score"] for r in scored) / len(scored)) if scored else None,
                "avg_putts": (sum(r["total_putts"] for r in putted) / len(putted)) if putted else None,
                "gir_pct": (100.0 * tg / th) if th else None,
                "fairway_pct": (100.0 * tf / td) if td else None,
            }
        )
    # rank: lowest handicap index first (nulls last), then lowest avg score
    golfers.sort(
        key=lambda x: (
            x["handicap_index"] is None,
            x["handicap_index"] if x["handicap_index"] is not None else 0.0,
            x["avg_score"] if x["avg_score"] is not None else 9999.0,
        )
    )

    # --- top scores per course (only full rounds of that course) ---
    by_course = defaultdict(list)
    for r in rounds:
        if r["total_score"] is None or r["holes_played"] != r["holes_count"]:
            continue
        by_course[r["course_id"]].append(r)

    courses = []
    for cid, rs in by_course.items():
        rs.sort(key=lambda r: r["total_score"])
        courses.append(
            {
                "course_id": cid,
                "course_name": rs[0]["course_name"],
                "holes_count": rs[0]["holes_count"],
                "top": [
                    {
                        "golfer_id": r["golfer_id"],
                        "name": r["golfer_name"],
                        "score": r["total_score"],
                        "played_on": r["played_on"],
                        "holes_played": r["holes_played"],
                    }
                    for r in rs[:5]
                ],
            }
        )
    courses.sort(key=lambda c: c["course_name"])

    return {
        "golfers": golfers,
        "courses": courses,
        "beers": beers,
        "nicotine": nicotine,
        "weed": weed,
        "hotdogs": hotdogs,
    }
