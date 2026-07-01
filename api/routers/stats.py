"""Aggregated stats powering the golfer visualization page."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..schemas import GolferStats, SeasonStats

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


@router.get("/{golfer_id}/season", response_model=SeasonStats)
def golfer_season(golfer_id: int):
    """Season totals aggregated over all the golfer's holes — same buckets the
    round page shows under "Round totals", summed across every round."""
    with pool.connection() as conn:
        if conn.execute(
            "SELECT 1 FROM golfers WHERE golfer_id = %s", (golfer_id,)
        ).fetchone() is None:
            raise HTTPException(404, "Golfer not found")

        holes = conn.execute(
            """
            SELECT h.par, hs.score, hs.putts, hs.driving_accuracy, hs.gir,
                   hs.up_and_down, hs.approach_accuracy, hs.penalty_strokes,
                   hs.balls_lost, hs.hotdogs, hs.hazards_hit
            FROM hole_stats hs
            JOIN holes h ON h.id = hs.hole_id
            JOIN rounds r ON r.round_id = hs.round_id
            WHERE r.golfer_id = %s
            """,
            (golfer_id,),
        ).fetchall()
        rounds_played = conn.execute(
            "SELECT COUNT(*) AS n FROM rounds WHERE golfer_id = %s", (golfer_id,)
        ).fetchone()["n"]
        # putts/round averages over full 18-hole rounds only (9-hole rounds
        # would otherwise drag the per-round number down)
        putt18 = conn.execute(
            "SELECT COALESCE(SUM(rs.total_putts), 0) AS putts, COUNT(*) AS n "
            "FROM round_stats rs JOIN rounds r ON r.round_id = rs.round_id "
            "WHERE r.golfer_id = %s AND rs.holes_played = 18 "
            "AND rs.total_putts IS NOT NULL",
            (golfer_id,),
        ).fetchone()
        # 18-hole total scores for the round-score distribution (9-hole excluded)
        score18 = conn.execute(
            "SELECT rs.total_score FROM round_stats rs "
            "JOIN rounds r ON r.round_id = rs.round_id "
            "WHERE r.golfer_id = %s AND rs.holes_played = 18 "
            "AND rs.total_score IS NOT NULL ORDER BY rs.total_score",
            (golfer_id,),
        ).fetchall()
        beers = conn.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(hb.size_oz), 0) AS oz "
            "FROM hole_beer hb JOIN hole_stats hs ON hs.id = hb.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id WHERE r.golfer_id = %s",
            (golfer_id,),
        ).fetchone()
        nic_rows = conn.execute(
            "SELECT hn.type, COALESCE(SUM(hn.quantity), 0) AS n "
            "FROM hole_nicotine hn JOIN hole_stats hs ON hs.id = hn.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id WHERE r.golfer_id = %s "
            "GROUP BY hn.type",
            (golfer_id,),
        ).fetchall()
        weed = conn.execute(
            "SELECT COUNT(*) AS n FROM hole_weed hw "
            "JOIN hole_stats hs ON hs.id = hw.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id WHERE r.golfer_id = %s",
            (golfer_id,),
        ).fetchone()

    hazard_by_type: dict = defaultdict(int)
    approach_counts: dict = defaultdict(int)
    fw_counts: dict = defaultdict(int)
    score_counts: dict = defaultdict(int)
    putt_counts: dict = defaultdict(int)
    par_groups: dict = defaultdict(list)
    balls_lost = penalty_strokes = hotdogs = gir_count = 0
    fairways_hit = fairways_total = total_putts = putt_holes = 0
    up_downs_made = up_downs_attempts = 0

    for h in holes:
        balls_lost += h["balls_lost"] or 0
        penalty_strokes += h["penalty_strokes"] or 0
        hotdogs += h["hotdogs"] or 0
        for z in (h["hazards_hit"] or []):
            hazard_by_type[z] += 1
        if h["gir"]:
            gir_count += 1
        if h["up_and_down"] is not None:
            up_downs_attempts += 1
            if h["up_and_down"]:
                up_downs_made += 1
        if h["approach_accuracy"]:
            approach_counts[h["approach_accuracy"]] += 1
        if h["par"] is not None and h["par"] >= 4:
            fairways_total += 1
            if h["driving_accuracy"]:
                fw_counts[h["driving_accuracy"]] += 1
                if h["driving_accuracy"] == "fairway":
                    fairways_hit += 1
        if h["putts"] is not None:
            putt_holes += 1
            total_putts += h["putts"]
            k = ("1 putt" if h["putts"] <= 1 else "2 putts" if h["putts"] == 2
                 else "3 putts" if h["putts"] == 3 else "4+ putts")
            putt_counts[k] += 1
        if h["score"] is not None and h["par"] is not None:
            d = h["score"] - h["par"]
            k = ("Eagle+" if d <= -2 else "Birdie" if d == -1 else "Par" if d == 0
                 else "Bogey" if d == 1 else "Double" if d == 2 else "Triple+")
            score_counts[k] += 1
            par_groups[h["par"]].append(h["score"])

    par_averages = [
        {"par": p, "avg": round(sum(v) / len(v), 2)}
        for p, v in sorted(par_groups.items())
    ]

    return {
        "rounds_played": rounds_played,
        "holes_played": len(holes),
        "hazard_by_type": dict(hazard_by_type),
        "nicotine_by_type": {r["type"]: int(r["n"]) for r in nic_rows},
        "balls_lost": balls_lost,
        "penalty_strokes": penalty_strokes,
        "beers": beers["n"],
        "beer_oz": float(beers["oz"]),
        "weed": weed["n"],
        "hotdogs": hotdogs,
        "approach_counts": dict(approach_counts),
        "gir_count": gir_count,
        "up_downs_made": up_downs_made,
        "up_downs_attempts": up_downs_attempts,
        "fw_counts": dict(fw_counts),
        "fairways_hit": fairways_hit,
        "fairways_total": fairways_total,
        "score_counts": dict(score_counts),
        "putt_counts": dict(putt_counts),
        "par_averages": par_averages,
        "total_putts": total_putts,
        "putt_holes": putt_holes,
        "putt_avg_per_round": (putt18["putts"] / putt18["n"]) if putt18["n"] else None,
        "round_scores": [r["total_score"] for r in score18],
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
