"""The extraction agent: feed scraped page text to Gemini, get a CourseData."""
from __future__ import annotations

from google import genai
from google.genai import types

from .models import CourseData

_SYSTEM_PROMPT = """\
You are a meticulous golf data analyst. You are given the name of a golf course
and the text of several web pages about it. Extract a single structured record
for that course.

Rules:
- Use ONLY information supported by the provided sources. Do not invent data.
- If a value is unknown or not present, leave it null / omit it.
- Capture hole-by-hole data: for every hole, its number, par, stroke index
  (handicap rank), and the yardage from each tee you can find.
- Capture each tee set with its total yardage, course rating, and slope rating
  when available.
- Stroke index is the difficulty rank 1-18 (1 = hardest), distinct from par.
- Prefer the course's official scorecard when sources disagree.
"""


def extract_course(
    api_key: str,
    model: str,
    course_query: str,
    documents: list[tuple[str, str]],
) -> CourseData:
    """Run the extraction. `documents` is a list of (url, text) pairs."""
    client = genai.Client(api_key=api_key)

    sources_block = "\n\n".join(
        f"=== SOURCE {i + 1}: {url} ===\n{text}"
        for i, (url, text) in enumerate(documents)
    )
    prompt = (
        f"Course to extract: {course_query}\n\n"
        f"Web sources:\n{sources_block}"
    )

    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=CourseData,
            temperature=0.0,
        ),
    )

    parsed = resp.parsed
    if isinstance(parsed, CourseData):
        return parsed
    # Fallback: validate from raw JSON text if the SDK didn't auto-parse.
    return CourseData.model_validate_json(resp.text)
