"""Web search via Tavily — turn a course query into candidate source URLs."""
from __future__ import annotations

from dataclasses import dataclass

from tavily import TavilyClient


@dataclass
class SearchResult:
    url: str
    title: str
    content: str  # snippet/summary returned by the search API


def search_course(api_key: str, course: str, max_results: int = 6) -> list[SearchResult]:
    """Search for pages describing a golf course (scorecard, yardages, ratings)."""
    client = TavilyClient(api_key=api_key)
    query = f"{course} golf course scorecard yardage par slope rating hole by hole"
    resp = client.search(
        query=query,
        max_results=max_results,
        search_depth="advanced",
    )
    results: list[SearchResult] = []
    for item in resp.get("results", []):
        url = item.get("url")
        if not url:
            continue
        results.append(
            SearchResult(
                url=url,
                title=item.get("title", ""),
                content=item.get("content", ""),
            )
        )
    return results
