"""Round entry: create a round with its hole-by-hole stats in one transaction."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..schemas import RoundCreated, RoundIn

router = APIRouter(prefix="/rounds", tags=["rounds"])


@router.post("", response_model=RoundCreated, status_code=201)
def create_round(body: RoundIn):
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
                        approach_accuracy, up_and_down, penalty_stroke,
                        hazards_hit, balls_lost
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                    """,
                    (
                        round_id, hs.hole_id, hs.score, hs.putts,
                        hs.driving_accuracy, hs.gir, hs.approach_accuracy,
                        hs.up_and_down, hs.penalty_stroke, hs.hazards_hit,
                        hs.balls_lost,
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


@router.get("/{round_id}")
def get_round(round_id: int):
    with pool.connection() as conn:
        rnd = conn.execute(
            """
            SELECT r.round_id, r.played_on, r.time_of_day, r.round_duration,
                   r.golfer_id, r.course_id, r.tee_id, c.name AS course_name
            FROM rounds r JOIN courses c ON c.id = r.course_id
            WHERE r.round_id = %s
            """,
            (round_id,),
        ).fetchone()
        if rnd is None:
            raise HTTPException(404, "Round not found")
        holes = conn.execute(
            """
            SELECT hs.*, h.hole_number, h.par
            FROM hole_stats hs JOIN holes h ON h.id = hs.hole_id
            WHERE hs.round_id = %s ORDER BY h.hole_number
            """,
            (round_id,),
        ).fetchall()
    return {**rnd, "hole_stats": holes}
