"""Persist an extracted CourseData into the Postgres schema (db/schema.sql)."""
from __future__ import annotations

import psycopg

from .geocode import geocode_course
from .models import CourseData


def save_course(database_url: str, course: CourseData, source_urls: list[str]) -> int:
    """Insert a course and its tees/holes/yardages. Returns the new course id."""
    data_source = "gemini+tavily"
    source_url = source_urls[0] if source_urls else None

    # Best-effort geocode for the explore map (never blocks the save).
    coords = geocode_course(course.name, course.city, course.country)
    latitude, longitude = coords if coords else (None, None)

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO courses (
                    name, city, country, latitude, longitude,
                    holes_count, par, architect, year_built,
                    website, phone, booking_url,
                    data_source, source_url, scraped_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, now()
                )
                RETURNING id
                """,
                (
                    course.name, course.city, course.country, latitude, longitude,
                    course.holes_count, course.par, course.architect, course.year_built,
                    course.website, course.phone, course.booking_url,
                    data_source, source_url,
                ),
            )
            course_id = cur.fetchone()[0]

            # Tees: map name -> id so hole yardages can reference them.
            tee_ids: dict[str, int] = {}
            for tee in course.tees:
                cur.execute(
                    """
                    INSERT INTO tees (
                        course_id, name, par, total_yards,
                        course_rating, slope_rating
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        course_id, tee.name, tee.par,
                        tee.total_yards, tee.course_rating, tee.slope_rating,
                    ),
                )
                tee_ids[tee.name] = cur.fetchone()[0]

            # Holes + per-tee yardages.
            for hole in course.holes:
                cur.execute(
                    """
                    INSERT INTO holes (course_id, hole_number, par, stroke_index)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (course_id, hole.hole_number, hole.par, hole.stroke_index),
                )
                hole_id = cur.fetchone()[0]

                for y in hole.yardages:
                    tee_id = tee_ids.get(y.tee_name)
                    if tee_id is None:
                        # Yardage references a tee not in the tee list — create it.
                        cur.execute(
                            "INSERT INTO tees (course_id, name) VALUES (%s, %s) RETURNING id",
                            (course_id, y.tee_name),
                        )
                        tee_id = cur.fetchone()[0]
                        tee_ids[y.tee_name] = tee_id
                    cur.execute(
                        """
                        INSERT INTO hole_tees (hole_id, tee_id, yards)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (hole_id, tee_id) DO UPDATE SET yards = EXCLUDED.yards
                        """,
                        (hole_id, tee_id, y.yards),
                    )
        conn.commit()
    return course_id
