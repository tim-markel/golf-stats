"""Fetch web pages and reduce them to clean text for the LLM."""
from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# Cap per-page text so a few pages comfortably fit the model context window.
_MAX_CHARS_PER_PAGE = 12_000


def fetch_text(url: str, timeout: float = 15.0) -> str | None:
    """Fetch a URL and return cleaned, whitespace-collapsed page text."""
    try:
        resp = httpx.get(url, headers=_HEADERS, timeout=timeout, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        tag.decompose()

    text = soup.get_text(separator=" ")
    text = " ".join(text.split())
    return text[:_MAX_CHARS_PER_PAGE] if text else None
