"""Round entry: create a round with its hole-by-hole stats in one transaction."""
from __future__ import annotations

from collections import defaultdict

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..db import pool
from ..deps import acting_golfer, is_manager
from ..schemas import (
    HoleStatEdit,
    RoundCreated,
    RoundDetail,
    RoundIn,
    RoundMetaUpdate,
    RoundScoresUpdate,
)

# All round routes require a login (read-shared, write-scoped).
router = APIRouter(prefix="/rounds", tags=["rounds"], dependencies=[Depends(acting_golfer)])


def _assert_can_edit(conn, round_id: int, actor: dict[str, Any]) -> None:
    """404 if the round is missing, 403 unless the actor owns it or is an admin."""
    row = conn.execute(
        "SELECT golfer_id FROM rounds WHERE round_id = %s", (round_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Round not found")
    if row["golfer_id"] != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only edit your own rounds")


@router.post("", response_model=RoundCreated, status_code=201)
def create_round(body: RoundIn, actor: dict[str, Any] = Depends(acting_golfer)):
    # You may only log rounds for yourself; admins may log for anyone.
    if body.golfer_id != actor["golfer_id"] and not is_manager(actor):
        raise HTTPException(403, "You can only log rounds for yourself")
    with pool.connection() as conn:
        with conn.transaction():
            round_row = conn.execute(
                """
                INSERT INTO rounds (
                    golfer_id, course_id, tee_id, played_on,
                    time_of_day, round_duration
                ) VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING round_id
                """,
                (
                    body.golfer_id, body.course_id, body.tee_id, body.played_on,
                    body.time_of_day, body.round_duration,
                ),
            ).fetchone()
            round_id = round_row["round_id"]

            for hs in body.hole_stats:
                stat_row = conn.execute(
                    """
                    INSERT INTO hole_stats (
                        round_id, hole_id, score, putts, driving_accuracy, gir,
                        approach_accuracy, up_and_down, penalty_locations,
                        penalty_strokes, hazards_hit, balls_lost, hotdogs
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                    """,
                    (
                        round_id, hs.hole_id, hs.score, hs.putts,
                        hs.driving_accuracy, hs.gir, hs.approach_accuracy,
                        hs.up_and_down, hs.penalty_locations, hs.penalty_strokes,
                        hs.hazards_hit, hs.balls_lost, hs.hotdogs,
                    ),
                ).fetchone()
                hole_stat_id = stat_row["id"]

                for n in hs.nicotine:
                    conn.execute(
                        "INSERT INTO hole_nicotine (hole_stat_id, type, quantity) VALUES (%s, %s, %s)",
                        (hole_stat_id, n.type, n.quantity),
                    )
                for w in hs.weed:
                    conn.execute(
                        "INSERT INTO hole_weed (hole_stat_id, type, amount, unit) VALUES (%s, %s, %s, %s)",
                        (hole_stat_id, w.type, w.amount, w.unit),
                    )
                for b in hs.beers:
                    beer_id = _resolve_beer_id(conn, b)
                    conn.execute(
                        "INSERT INTO hole_beer (hole_stat_id, beer_id, size_oz) VALUES (%s, %s, %s)",
                        (hole_stat_id, beer_id, b.size_oz),
                    )
    return {"round_id": round_id}


def _resolve_beer_id(conn, beer) -> int:
    """Return a beer_options id. If the beer is an "other" entry (a name, no
    id), upsert it into the catalog so it's reusable next time."""
    if beer.beer_id is not None:
        return beer.beer_id
    if not beer.name:
        raise HTTPException(422, "A beer needs either beer_id or a name.")
    row = conn.execute(
        """
        INSERT INTO beer_options (name, abv) VALUES (%s, %s)
        ON CONFLICT (name) DO UPDATE
            SET abv = COALESCE(EXCLUDED.abv, beer_options.abv)
        RETURNING beer_id
        """,
        (beer.name.strip(), beer.abv),
    ).fetchone()
    return row["beer_id"]


@router.get("/{round_id}", response_model=RoundDetail)
def get_round(round_id: int):
    with pool.connection() as conn:
        rnd = conn.execute(
            """
            SELECT r.round_id, r.played_on, r.time_of_day,
                   r.round_duration::text AS round_duration,
                   r.course_id, c.name AS course_name,
                   r.tee_id, t.name AS tee_name,
                   t.course_rating, t.slope_rating
            FROM rounds r
            JOIN courses c ON c.id = r.course_id
            LEFT JOIN tees t ON t.id = r.tee_id
            WHERE r.round_id = %s
            """,
            (round_id,),
        ).fetchone()
        if rnd is None:
            raise HTTPException(404, "Round not found")

        # Per-hole scorecard rows, with yardage from the tee that was played and
        # per-hole consumption counts (beer/nicotine/weed).
        holes = conn.execute(
            """
            SELECT h.id AS hole_id, h.hole_number, h.par, h.stroke_index, ht.yards,
                   hs.score, hs.putts, hs.driving_accuracy, hs.gir,
                   hs.approach_accuracy, hs.up_and_down, hs.penalty_locations,
                   hs.penalty_strokes, hs.hazards_hit, hs.balls_lost, hs.hotdogs,
                   hs.id AS hole_stat_id,
                   (SELECT COUNT(*) FROM hole_beer hb WHERE hb.hole_stat_id = hs.id) AS beers
            FROM hole_stats hs
            JOIN holes h ON h.id = hs.hole_id
            LEFT JOIN hole_tees ht ON ht.hole_id = h.id AND ht.tee_id = %s
            WHERE hs.round_id = %s
            ORDER BY h.hole_number
            """,
            (rnd["tee_id"], round_id),
        ).fetchall()

        # Per-hole nicotine/weed broken down by type.
        nic_rows = conn.execute(
            "SELECT hs.hole_id, hn.type, hn.quantity FROM hole_nicotine hn "
            "JOIN hole_stats hs ON hs.id = hn.hole_stat_id WHERE hs.round_id = %s",
            (round_id,),
        ).fetchall()
        weed_rows = conn.execute(
            "SELECT hs.hole_id, hw.type, hw.amount, hw.unit FROM hole_weed hw "
            "JOIN hole_stats hs ON hs.id = hw.hole_stat_id WHERE hs.round_id = %s "
            "ORDER BY hw.id",
            (round_id,),
        ).fetchall()
        beer_rows = conn.execute(
            "SELECT hs.hole_id, hb.beer_id, bo.name, hb.size_oz FROM hole_beer hb "
            "JOIN hole_stats hs ON hs.id = hb.hole_stat_id "
            "LEFT JOIN beer_options bo ON bo.beer_id = hb.beer_id "
            "WHERE hs.round_id = %s ORDER BY hb.id",
            (round_id,),
        ).fetchall()

        # Round-level totals for the consumption summary.
        agg = conn.execute(
            """
            SELECT
                COALESCE(SUM(COALESCE(array_length(hazards_hit, 1), 0)), 0) AS hazards,
                COALESCE(SUM(balls_lost), 0) AS balls_lost,
                COALESCE(SUM(penalty_strokes), 0) AS penalty_strokes,
                COALESCE(SUM(hotdogs), 0) AS hotdogs
            FROM hole_stats WHERE round_id = %s
            """,
            (round_id,),
        ).fetchone()
        beers = conn.execute(
            """
            SELECT COUNT(*) AS beers, COALESCE(SUM(hb.size_oz), 0) AS beer_oz
            FROM hole_beer hb JOIN hole_stats hs ON hs.id = hb.hole_stat_id
            WHERE hs.round_id = %s
            """,
            (round_id,),
        ).fetchone()
        nic = conn.execute(
            """
            SELECT COALESCE(SUM(hn.quantity), 0) AS nicotine
            FROM hole_nicotine hn JOIN hole_stats hs ON hs.id = hn.hole_stat_id
            WHERE hs.round_id = %s
            """,
            (round_id,),
        ).fetchone()
        weed = conn.execute(
            """
            SELECT COUNT(*) AS weed
            FROM hole_weed hw JOIN hole_stats hs ON hs.id = hw.hole_stat_id
            WHERE hs.round_id = %s
            """,
            (round_id,),
        ).fetchone()

    # group per-hole nicotine/weed by type
    nic_by_hole: dict = defaultdict(lambda: defaultdict(int))
    for r in nic_rows:
        nic_by_hole[r["hole_id"]][r["type"]] += r["quantity"]
    weed_by_hole: dict = defaultdict(lambda: defaultdict(lambda: {"count": 0, "hits": 0.0}))
    weed_entries_by_hole: dict = defaultdict(list)
    for r in weed_rows:
        e = weed_by_hole[r["hole_id"]][r["type"]]
        e["count"] += 1
        if r["unit"] == "hits" and r["amount"]:
            e["hits"] += float(r["amount"])
        weed_entries_by_hole[r["hole_id"]].append(
            {"type": r["type"],
             "amount": float(r["amount"]) if r["amount"] is not None else None,
             "unit": r["unit"]}
        )
    beer_entries_by_hole: dict = defaultdict(list)
    for r in beer_rows:
        beer_entries_by_hole[r["hole_id"]].append(
            {"beer_id": r["beer_id"], "name": r["name"], "size_oz": float(r["size_oz"])}
        )
    for h in holes:
        h["nicotine"] = [
            {"type": t, "quantity": q}
            for t, q in nic_by_hole.get(h["hole_id"], {}).items()
        ]
        h["weed"] = [
            {"type": t, "count": v["count"], "hits": v["hits"]}
            for t, v in weed_by_hole.get(h["hole_id"], {}).items()
        ]
        h["beer_entries"] = beer_entries_by_hole.get(h["hole_id"], [])
        h["weed_entries"] = weed_entries_by_hole.get(h["hole_id"], [])

    def total(rows, lo, hi):
        vals = [r["score"] for r in rows if r["score"] is not None and lo <= r["hole_number"] <= hi]
        return sum(vals) if vals else None

    putts = [h["putts"] for h in holes if h["putts"] is not None]

    return {
        **rnd,
        "out_score": total(holes, 1, 9),
        "in_score": total(holes, 10, 18),
        "total_score": total(holes, 1, 99),
        "total_putts": sum(putts) if putts else None,
        "holes": holes,
        "totals": {
            "hazards": agg["hazards"],
            "balls_lost": agg["balls_lost"],
            "penalty_strokes": agg["penalty_strokes"],
            "beers": beers["beers"],
            "beer_oz": float(beers["beer_oz"]),
            "nicotine": nic["nicotine"],
            "weed": weed["weed"],
            "hotdogs": agg["hotdogs"],
        },
    }


@router.patch("/{round_id}", response_model=RoundDetail)
def update_round_meta(
    round_id: int, body: RoundMetaUpdate, actor: dict[str, Any] = Depends(acting_golfer)
):
    """Edit round details: date played, tee set, and time of day."""
    with pool.connection() as conn:
        _assert_can_edit(conn, round_id, actor)
        rnd = conn.execute(
            "SELECT course_id FROM rounds WHERE round_id = %s", (round_id,)
        ).fetchone()
        if rnd is None:
            raise HTTPException(404, "Round not found")
        if body.tee_id is not None:
            tee = conn.execute(
                "SELECT 1 FROM tees WHERE id = %s AND course_id = %s",
                (body.tee_id, rnd["course_id"]),
            ).fetchone()
            if tee is None:
                raise HTTPException(422, "That tee doesn't belong to this course.")
        with conn.transaction():
            conn.execute(
                """
                UPDATE rounds SET
                    played_on   = COALESCE(%s, played_on),
                    tee_id      = COALESCE(%s, tee_id),
                    time_of_day = COALESCE(%s, time_of_day)
                WHERE round_id = %s
                """,
                (body.played_on, body.tee_id, body.time_of_day, round_id),
            )
    return get_round(round_id)


@router.patch("/{round_id}/hole-stats", response_model=RoundDetail)
def update_hole_stats(
    round_id: int, body: RoundScoresUpdate, actor: dict[str, Any] = Depends(acting_golfer)
):
    """Edit the scorecard: update score/putts for holes in an existing round."""
    with pool.connection() as conn:
        _assert_can_edit(conn, round_id, actor)
        with conn.transaction():
            for h in body.holes:
                conn.execute(
                    "UPDATE hole_stats SET score = %s, putts = %s "
                    "WHERE round_id = %s AND hole_id = %s",
                    (h.score, h.putts, round_id, h.hole_id),
                )
    return get_round(round_id)


@router.patch("/{round_id}/holes/{hole_id}", response_model=RoundDetail)
def update_hole_stat(
    round_id: int,
    hole_id: int,
    body: HoleStatEdit,
    actor: dict[str, Any] = Depends(acting_golfer),
):
    """Edit one hole's full stats. The consumption lists fully replace the
    hole's existing beer/nicotine/weed rows."""
    with pool.connection() as conn:
        _assert_can_edit(conn, round_id, actor)
        row = conn.execute(
            "SELECT id FROM hole_stats WHERE round_id = %s AND hole_id = %s",
            (round_id, hole_id),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Hole not found in this round")
        hole_stat_id = row["id"]
        with conn.transaction():
            conn.execute(
                """
                UPDATE hole_stats SET
                    score = %s, putts = %s, driving_accuracy = %s, gir = %s,
                    approach_accuracy = %s, up_and_down = %s,
                    penalty_locations = %s, penalty_strokes = %s,
                    hazards_hit = %s, balls_lost = %s, hotdogs = %s
                WHERE id = %s
                """,
                (
                    body.score, body.putts, body.driving_accuracy, body.gir,
                    body.approach_accuracy, body.up_and_down,
                    body.penalty_locations, body.penalty_strokes,
                    body.hazards_hit, body.balls_lost, body.hotdogs,
                    hole_stat_id,
                ),
            )
            # replace consumption child rows for this hole
            conn.execute("DELETE FROM hole_nicotine WHERE hole_stat_id = %s", (hole_stat_id,))
            conn.execute("DELETE FROM hole_weed WHERE hole_stat_id = %s", (hole_stat_id,))
            conn.execute("DELETE FROM hole_beer WHERE hole_stat_id = %s", (hole_stat_id,))
            for n in body.nicotine:
                conn.execute(
                    "INSERT INTO hole_nicotine (hole_stat_id, type, quantity) VALUES (%s, %s, %s)",
                    (hole_stat_id, n.type, n.quantity),
                )
            for w in body.weed:
                conn.execute(
                    "INSERT INTO hole_weed (hole_stat_id, type, amount, unit) VALUES (%s, %s, %s, %s)",
                    (hole_stat_id, w.type, w.amount, w.unit),
                )
            for b in body.beers:
                beer_id = _resolve_beer_id(conn, b)
                conn.execute(
                    "INSERT INTO hole_beer (hole_stat_id, beer_id, size_oz) VALUES (%s, %s, %s)",
                    (hole_stat_id, beer_id, b.size_oz),
                )
    return get_round(round_id)
