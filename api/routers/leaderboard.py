"""Leaderboard: ranked golfer stats + top scores per course."""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter

from ..db import pool
from ..schemas import Leaderboard
from ..handicap import build_rounds, handicap_index

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard():
    with pool.connection() as conn:
        rounds = conn.execute(
            """
            SELECT r.golfer_id, r.round_id, g.name AS golfer_name, r.played_on,
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
            "SELECT r.golfer_id, hn.type, COALESCE(SUM(hn.quantity), 0) AS n "
            "FROM hole_nicotine hn JOIN hole_stats hs ON hs.id = hn.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id GROUP BY r.golfer_id, hn.type"
        ).fetchall()
        weed_rows = conn.execute(
            "SELECT r.golfer_id, hw.type, COUNT(*) AS n "
            "FROM hole_weed hw JOIN hole_stats hs ON hs.id = hw.hole_stat_id "
            "JOIN rounds r ON r.round_id = hs.round_id GROUP BY r.golfer_id, hw.type"
        ).fetchall()
        hotdog_rows = conn.execute(
            "SELECT r.golfer_id, COALESCE(SUM(hs.hotdogs), 0) AS n "
            "FROM hole_stats hs JOIN rounds r ON r.round_id = hs.round_id "
            "GROUP BY r.golfer_id"
        ).fetchall()
        hole_bad_rows = conn.execute(
            "SELECT r.golfer_id, hs.hazards_hit, hs.balls_lost, hs.penalty_strokes, hs.putts "
            "FROM hole_stats hs JOIN rounds r ON r.round_id = hs.round_id"
        ).fetchall()
        # hole-by-hole scores for the net-double-bogey handicap adjustment
        hcp_hole_rows = conn.execute(
            "SELECT hs.round_id, h.par, h.stroke_index, hs.score AS gross "
            "FROM hole_stats hs JOIN holes h ON h.id = hs.hole_id"
        ).fetchall()

    holes_by_round: dict = defaultdict(list)
    for hr in hcp_hole_rows:
        holes_by_round[hr["round_id"]].append(hr)

    names = {r["golfer_id"]: r["golfer_name"] for r in rounds}

    NIC_LABELS = {"cigarette": "cigs", "cigar": "cigars", "vape": "vape",
                  "dip": "dip", "pouch": "zyns", "gum": "gum"}
    WEED_LABELS = {"joint": "joints", "blunt": "blunts", "bowl": "bowls",
                   "one_hitter": "one-hitters", "vape": "vape", "dab": "dabs",
                   "edible": "edibles"}

    def simple_list(rows, detail=None):
        out = [
            {"golfer_id": row["golfer_id"], "name": names.get(row["golfer_id"], "?"),
             "total": float(row["n"]), "detail": detail(row) if detail else None}
            for row in rows if row["n"] and row["n"] > 0
        ]
        out.sort(key=lambda x: -x["total"])
        return out

    def typed_list(rows, labels):
        agg = defaultdict(lambda: [0.0, []])
        for row in rows:
            if not row["n"]:
                continue
            agg[row["golfer_id"]][0] += row["n"]
            agg[row["golfer_id"]][1].append((labels.get(row["type"], row["type"]), row["n"]))
        out = []
        for gid, (total, parts) in agg.items():
            if total <= 0:
                continue
            parts.sort(key=lambda p: -p[1])
            out.append({
                "golfer_id": gid, "name": names.get(gid, "?"), "total": float(total),
                "detail": ", ".join(f"{int(n)} {lab}" for lab, n in parts),
            })
        out.sort(key=lambda x: -x["total"])
        return out

    beers = simple_list(beer_rows, lambda r: f"{float(r['oz']):g} oz" if r["oz"] else None)
    hotdogs = simple_list(hotdog_rows)
    nicotine = typed_list(nic_rows, NIC_LABELS)
    weed = typed_list(weed_rows, WEED_LABELS)

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
                "handicap_index": handicap_index(
                    build_rounds(
                        [r for r in rs if r["holes_played"] in (9, 18)], holes_by_round
                    )
                ),
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

    # --- Total Ass Index ---------------------------------------------------
    # Handicap + a per-round "ass" weight from each hole: penalty strokes count
    # 1.0 each, lost balls 0.5 each; bunkers 0.25; natural area 0.25 (0.5 if a
    # ball was lost there); water/OB 0.5; and 3+ putts add an escalating
    # 0.3*(putts-2)^2.
    acc = defaultdict(lambda: {"pen": 0, "balls": 0, "haz": 0, "tp": 0, "raw": 0.0})
    for row in hole_bad_rows:
        a = acc[row["golfer_id"]]
        hz = row["hazards_hit"] or []
        balls = row["balls_lost"] or 0
        pen = row["penalty_strokes"] or 0
        putts = row["putts"]
        a["pen"] += pen
        a["balls"] += balls
        a["haz"] += len(hz)
        weight = 0.0
        for h in hz:
            if h in ("greenside_bunker", "fairway_bunker"):
                weight += 0.25
            elif h == "natural_area":
                weight += 0.5 if balls > 0 else 0.25
            else:  # water, ob
                weight += 0.5
        if putts and putts >= 3:
            a["tp"] += 1
            weight += 0.3 * (putts - 2) ** 2
        a["raw"] += pen + 0.5 * balls + weight

    ass_index = []
    for g in golfers:
        gid = g["golfer_id"]
        n = g["rounds_played"] or 1
        a = acc.get(gid, {"pen": 0, "balls": 0, "haz": 0, "tp": 0, "raw": 0.0})
        golf = (
            g["handicap_index"]
            if g["handicap_index"] is not None
            else (g["avg_score"] - 72 if g["avg_score"] is not None else 0.0)
        )
        ass = golf + a["raw"] / n
        ass_index.append({
            "golfer_id": gid, "name": g["name"], "ass_index": round(ass, 1),
            "penalties": a["pen"], "balls_lost": a["balls"], "hazards": a["haz"],
            "three_putts": a["tp"], "rounds_played": g["rounds_played"],
        })
    ass_index.sort(key=lambda x: -x["ass_index"])

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
                "rounds": len(rs),  # for ordering busiest courses first
                "top": [
                    {
                        "golfer_id": r["golfer_id"],
                        "name": r["golfer_name"],
                        "score": r["total_score"],
                        "played_on": r["played_on"],
                        "holes_played": r["holes_played"],
                    }
                    for r in rs[:50]
                ],
            }
        )
    courses.sort(key=lambda c: (-c["rounds"], c["course_name"]))

    return {
        "golfers": golfers,
        "courses": courses,
        "beers": beers,
        "nicotine": nicotine,
        "weed": weed,
        "hotdogs": hotdogs,
        "ass_index": ass_index,
    }
