"""CLI entry point.

Usage:
    python -m scraper.cli "Pebble Beach Golf Links, Pebble Beach, CA"
    python -m scraper.cli "Augusta National" --dry-run
"""
from __future__ import annotations

import argparse
import sys

from .agent import extract_course
from .config import Config
from .fetch import fetch_text
from .search import search_course


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scrape the web for a golf course and fill the database."
    )
    parser.add_argument("course", help="Course name (optionally with city/state).")
    parser.add_argument(
        "--max-results", type=int, default=6, help="Max search results to fetch."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print extracted JSON instead of writing to the database.",
    )
    args = parser.parse_args(argv)

    cfg = Config.load()

    print(f"[1/4] Searching the web for: {args.course}", file=sys.stderr)
    results = search_course(cfg.tavily_api_key, args.course, args.max_results)
    if not results:
        print("No search results found.", file=sys.stderr)
        return 1
    print(f"      found {len(results)} result(s)", file=sys.stderr)

    print("[2/4] Fetching pages", file=sys.stderr)
    documents: list[tuple[str, str]] = []
    for r in results:
        text = fetch_text(r.url)
        if not text:
            # Fall back to the search snippet if the page couldn't be fetched.
            text = r.content
        if text:
            documents.append((r.url, text))
            print(f"      ok  {r.url}", file=sys.stderr)
        else:
            print(f"      skip {r.url}", file=sys.stderr)
    if not documents:
        print("Could not fetch any page content.", file=sys.stderr)
        return 1

    print("[3/4] Extracting structured data with Gemini", file=sys.stderr)
    course = extract_course(
        cfg.gemini_api_key, cfg.gemini_model, args.course, documents
    )
    print(
        f"      {course.name}: {len(course.tees)} tee(s), {len(course.holes)} hole(s)",
        file=sys.stderr,
    )

    if args.dry_run:
        print(course.model_dump_json(indent=2))
        return 0

    print("[4/4] Saving to database", file=sys.stderr)
    from .db import save_course  # imported late so --dry-run needs no DB driver/conn

    course_id = save_course(
        cfg.database_url, course, [url for url, _ in documents]
    )
    print(f"      saved course id={course_id}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
