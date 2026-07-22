"""The extraction agent: feed scraped page text to Gemini, get a CourseData."""
from __future__ import annotations

from google import genai
from google.genai import types

from .models import CourseData

_SYSTEM_PROMPT = """\
You are a meticulous golf data analyst. You are given the name of a golf course
and the text of several web pages about it. Extract a single structured record
for the ONE specific course requested.

MULTIPLE COURSES AT ONE FACILITY — READ CAREFULLY:
- Many facilities operate more than one distinct course under one name. For
  example, Mountain Dell has a "Canyon" course and a "Lake" course; Bethpage
  has Black, Red, Blue, Green, and Yellow; Torrey Pines has North and South.
- You must extract EXACTLY ONE course — the single course that best matches the
  requested name — and never blend two courses together.
- NEVER merge holes, pars, stroke indexes, tees, or yardages from different
  courses. The result must be one coherent course: holes numbered 1–18 (or 1–9
  for a nine-hole course) with NO duplicate hole numbers and NO extra holes. If
  you find yourself with more than 18 holes, you are combining courses — stop
  and keep only the one requested.
- If the requested name specifies which course (e.g. "Mountain Dell Canyon" or
  "Bethpage Black"), extract that course only.
- If the requested name gives only the facility and it clearly has multiple
  courses, pick the single most prominent/championship course and extract only
  that one — do not combine the others.
- Set `name` to the SPECIFIC course, including its course label when the
  facility has multiple (e.g. "Mountain Dell Golf Course – Canyon", not just
  "Mountain Dell").

Rules:
- Use ONLY information supported by the provided sources. Do not invent data.
- If a value is unknown or not present, leave it null / omit it.
- Capture the city and the state/region (a 2-letter code in the US/Canada, e.g.
  "MI" or "UT").
- Capture hole-by-hole data: for every hole, its number, par, stroke index
  (handicap rank), and the yardage from each tee you can find.
- Capture each tee set with its total yardage, course rating, and slope rating
  when available.
- Stroke index is the difficulty rank 1-18 (1 = hardest), distinct from par.
- Prefer the course's official scorecard when sources disagree.
- Capture the official website URL and, if present, a tee-time booking URL
  (the course's online booking page or a GolfNow/Chronogolf/TeeSnap/foreUP
  link). Only use links actually found in the sources.
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
