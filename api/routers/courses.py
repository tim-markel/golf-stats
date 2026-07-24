"""Course endpoints: read the catalog, and add a course via the web scraper."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..auth import acting_golfer, current_account, is_manager
from ..db import pool
from ..ratelimit import within_limit
from ..schemas import Course, CourseDetail, CourseScrapeIn

# Read-shared reference data; login required.
router = APIRouter(prefix="/courses", tags=["courses"], dependencies=[Depends(current_account)])

# Cost guard for the (paid) scrape endpoint: per-user hourly + a global daily
# ceiling across all non-admins so the LLM/search bill can't be run up.
_SCRAPE_DAILY_CAP = os.environ.get("SCRAPE_DAILY_CAP", "50")

_COURSE_COLS = (
    "id, name, city, state, country, latitude, longitude, "
    "holes_count, par, website, booking_url, phone"
)


@router.get("", response_model=list[Course])
def list_courses():
    with pool.connection() as conn:
        rows = conn.execute(
            f"SELECT {_COURSE_COLS} FROM courses ORDER BY name"
        ).fetchall()
    return rows


@router.post("/scrape", response_model=Course, status_code=201)
def scrape_course(body: CourseScrapeIn, actor: dict[str, Any] = Depends(acting_golfer)):
    """Web-search for a course and add it to the database via the scraper.

    Expensive (web search + LLM). Non-admins get 5/hour each and share a global
    daily cap; admins are unlimited. Returns the newly added course.
    """
    if not is_manager(actor):
        if not within_limit(f"course-scrape:{actor['golfer_id']}", "5/hour"):
            raise HTTPException(
                429, "You can add up to 5 courses per hour. Please try again later."
            )
        if not within_limit("course-scrape:global", f"{_SCRAPE_DAILY_CAP}/day"):
            raise HTTPException(
                429, "The daily course-adding limit was reached. Please try again tomorrow."
            )

    # Lazy import so the API doesn't hard-depend on scraper packages at startup.
    from scraper.pipeline import ScrapeError, scrape_and_save

    try:
        course_id = scrape_and_save(body.name)
    except ScrapeError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:  # missing keys, LLM/network failure, etc.
        # Don't leak internals to the client; log for debugging.
        print(f"scrape_course failed for {body.name!r}: {exc}", flush=True)
        raise HTTPException(502, "Course lookup failed. Please try again.") from exc

    with pool.connection() as conn:
        row = conn.execute(
            f"SELECT {_COURSE_COLS} FROM courses WHERE id = %s", (course_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(500, "Course was added but could not be loaded.")
    return row


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: int):
    with pool.connection() as conn:
        course = conn.execute(
            f"SELECT {_COURSE_COLS} FROM courses WHERE id = %s", (course_id,)
        ).fetchone()
        if course is None:
            raise HTTPException(404, "Course not found")
        tees = conn.execute(
            """
            SELECT id, name, total_yards, course_rating, slope_rating
            FROM tees WHERE course_id = %s ORDER BY total_yards DESC NULLS LAST
            """,
            (course_id,),
        ).fetchall()
        holes = conn.execute(
            """
            SELECT id, hole_number, par, stroke_index
            FROM holes WHERE course_id = %s ORDER BY hole_number
            """,
            (course_id,),
        ).fetchall()
    return {**course, "tees": tees, "holes": holes}
