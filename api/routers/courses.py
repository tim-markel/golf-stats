"""Course read endpoints (courses are written by the scraper, not here)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..schemas import Course, CourseDetail

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[Course])
def list_courses():
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT id, name, city, country, holes_count, par
            FROM courses ORDER BY name
            """
        ).fetchall()
    return rows


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: int):
    with pool.connection() as conn:
        course = conn.execute(
            """
            SELECT id, name, city, country, holes_count, par
            FROM courses WHERE id = %s
            """,
            (course_id,),
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
