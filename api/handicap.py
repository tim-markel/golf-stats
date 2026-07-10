"""WHS-style Handicap Index estimate.

This follows the World Handicap System formula closely, but is still an
UNOFFICIAL estimate (the UI labels it as such). It implements:

  * Adjusted Gross Score via the net-double-bogey cap per hole
    (par + 2 + strokes the player receives on that hole), computed
    iteratively because the stroke allocation depends on the index itself;
  * Score Differential = (113 / Slope) x (Adjusted Gross - Course Rating),
    each rounded to the nearest 0.1;
  * averaging the best N of the most recent 20 differentials per the WHS
    table, then truncating the result to one decimal.

9-hole rounds are folded in with an APPROXIMATION: a 9-hole differential is
computed against half the tee's 18-hole rating, then an estimated
"expected differential" for the missing nine (≈ index / 2) is added to make an
18-hole-equivalent differential. This isn't the exact WHS 9-hole method (which
uses true 9-hole ratings we don't store).

It does NOT model: Playing Conditions Calculation, soft/hard caps, or
exceptional-score reductions. Official course/slope ratings and the exact score
set also matter, so this can differ from GHIN by a few tenths.
"""
from __future__ import annotations

import math
from decimal import ROUND_DOWN, Decimal
from typing import Optional, TypedDict


class HoleScore(TypedDict):
    par: int
    stroke_index: int
    gross: int


class HcpRound(TypedDict, total=False):
    holes_played: int           # 9 or 18
    score: Optional[int]        # raw gross for the holes played
    slope: Optional[int]        # the tee's (18-hole) slope
    rating: Optional[float]     # the tee's (18-hole) course rating
    par: Optional[int]          # par of the holes played; None if unknown
    holes: Optional[list[HoleScore]]  # complete holes, else None


# WHS table: differentials available -> (count averaged, adjustment).
def _whs_params(n: int) -> tuple[int, float]:
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


def _course_handicap(index: float, slope: int, rating: float, par: int) -> int:
    """Course Handicap = Index x (Slope/113) + (Course Rating - Par), rounded."""
    return math.floor(index * (slope / 113.0) + (rating - par) + 0.5)


def _strokes_on_hole(stroke_index: int, course_handicap: int) -> int:
    """How many handicap strokes the player gets on a hole (handles plus handicaps)."""
    base = course_handicap // 18            # floor division (works for negatives)
    remainder = course_handicap - 18 * base  # 0..17
    return base + (1 if stroke_index <= remainder else 0)


def _adjusted_total(holes: list[HoleScore], course_handicap: int) -> int:
    """Sum of hole scores capped at net double bogey."""
    total = 0
    for h in holes:
        net_double = h["par"] + 2 + _strokes_on_hole(h["stroke_index"], course_handicap)
        total += min(h["gross"], net_double)
    return total


def _differentials(rounds: list[HcpRound], index: Optional[float]) -> list[float]:
    """Score differentials (rounded to 0.1), in the given (chronological) order.

    18-hole rounds use the net-double-bogey adjusted gross when `index` and
    complete hole data are available (otherwise raw gross). 9-hole rounds are
    converted to an 18-hole-equivalent differential and are only included once
    `index` is known (they need it for the expected-differential term)."""
    out: list[float] = []
    for r in rounds:
        slope = r["slope"]
        rating = r.get("rating")
        if slope is None or rating is None or r.get("score") is None:
            continue
        holes = r.get("holes")
        par = r.get("par")
        holes_played = r.get("holes_played", 18)

        if holes_played == 18:
            if index is not None and holes and par is not None:
                ch = _course_handicap(index, slope, float(rating), par)
                adjusted = _adjusted_total(holes, ch)
            else:
                adjusted = r["score"]
            out.append(round((113.0 / slope) * (adjusted - float(rating)), 1))

        elif holes_played == 9:
            if index is None:
                continue  # need the index for the expected-differential term
            rating9 = float(rating) / 2.0
            if holes and par is not None:
                ch9 = _course_handicap(index / 2.0, slope, rating9, par)
                adjusted = _adjusted_total(holes, ch9)
            else:
                adjusted = r["score"]
            sd9 = (113.0 / slope) * (adjusted - rating9)
            # add the expected differential for the nine not played (≈ index/2)
            out.append(round(sd9 + index / 2.0, 1))
    return out


def _index_from_diffs(diffs: list[float]) -> Optional[float]:
    pool = diffs[-20:]  # most recent 20 eligible
    if len(pool) < 3:
        return None
    count, adj = _whs_params(len(pool))
    lowest = sorted(pool)[:count]
    raw = sum(lowest) / len(lowest) + adj
    # WHS truncates (toward zero) to one decimal, not rounds.
    return float(Decimal(str(raw)).quantize(Decimal("0.1"), rounding=ROUND_DOWN))


def build_rounds(summaries, holes_by_round: dict) -> list[HcpRound]:
    """Turn round summaries + a {round_id: [hole rows]} map into the input for
    handicap_index(). A round's holes are only used for the net-double-bogey cap
    when every hole played has par, stroke index, and gross score.

    Each summary must expose round_id, holes_played, total_score, slope_rating,
    course_rating. Each hole row must expose par, stroke_index, gross.
    """
    out: list[HcpRound] = []
    for r in summaries:
        hp = r["holes_played"]
        holes = holes_by_round.get(r["round_id"]) or []
        complete = hp in (9, 18) and len(holes) == hp and all(
            h["par"] is not None and h["stroke_index"] is not None and h["gross"] is not None
            for h in holes
        )
        out.append(
            {
                "holes_played": hp,
                "score": r["total_score"],
                "slope": r["slope_rating"],
                "rating": float(r["course_rating"]) if r["course_rating"] is not None else None,
                "holes": holes if complete else None,
                "par": sum(h["par"] for h in holes) if complete else None,
            }
        )
    return out


def handicap_index(rounds: list[HcpRound]) -> Optional[float]:
    """Estimate a Handicap Index from chronological rated rounds (9 or 18 hole).

    Needs >= 3 eligible rounds. Returns None otherwise.
    """
    eligible = [
        r for r in rounds
        if r.get("score") is not None and r.get("slope") and r.get("rating") is not None
    ]
    if len(eligible) < 3:
        return None
    # Provisional index from 18-hole rounds only (uncapped); if there aren't
    # enough of those, seed at 0 so the iteration can pull in 9-hole rounds.
    index = _index_from_diffs(_differentials(eligible, None))
    if index is None:
        index = 0.0
    # Iterate: the net-double-bogey stroke allocation and the 9-hole expected
    # term both depend on the index, so recompute until it converges.
    for _ in range(8):
        nxt = _index_from_diffs(_differentials(eligible, index))
        if nxt is None or nxt == index:
            break
        index = nxt
    return index
