"""Reusable scrape pipeline: a course name -> a saved course id.

Shared by the CLI and the API so "add a course" works from the web app.
"""
from __future__ import annotations

from .agent import extract_course
from .config import Config
from .db import save_course
from .fetch import fetch_text
from .search import search_course


class ScrapeError(Exception):
    """A course couldn't be found or its details couldn't be extracted."""


def scrape_and_save(course_name: str, max_results: int = 6) -> int:
    """Search the web for ``course_name``, extract its data, and save it.

    Returns the new course's id. Raises ScrapeError with a user-friendly
    message when the course can't be found or read.
    """
    name = course_name.strip()
    if not name:
        raise ScrapeError("Please enter a course name.")

    cfg = Config.load()

    results = search_course(cfg.tavily_api_key, name, max_results)
    if not results:
        raise ScrapeError("No web results found for that course.")

    documents: list[tuple[str, str]] = []
    for r in results:
        text = fetch_text(r.url) or r.content
        if text:
            documents.append((r.url, text))
    if not documents:
        raise ScrapeError("Couldn't read any pages for that course.")

    course = extract_course(cfg.gemini_api_key, cfg.gemini_model, name, documents)
    if not course or not course.name:
        raise ScrapeError("Couldn't extract course details from the web.")

    return save_course(cfg.database_url, course, [url for url, _ in documents])
