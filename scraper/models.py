"""Pydantic models mirroring the DB schema (see db/schema.sql).

These double as the structured-output schema handed to Gemini, so field
names and docstrings are written to guide the model's extraction.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class HoleTeeYardage(BaseModel):
    """Yardage for a single hole from a single tee."""

    tee_name: str = Field(description="Tee set name, e.g. 'Blue' or 'Championship'.")
    yards: Optional[int] = Field(default=None, description="Yardage of the hole from this tee.")


class HoleData(BaseModel):
    """One hole on the course. Par and stroke index are tee-independent."""

    hole_number: int = Field(description="Hole number, 1-18 (or up to 27).")
    par: int = Field(description="Par for the hole (3-6).")
    stroke_index: Optional[int] = Field(
        default=None,
        description="Handicap/stroke index, 1-18 (1 = hardest). Null if unknown.",
    )
    yardages: list[HoleTeeYardage] = Field(
        default_factory=list,
        description="Per-tee yardages for this hole.",
    )


class TeeData(BaseModel):
    """A tee set at the course (Black/Blue/White/Red, etc.)."""

    name: str = Field(description="Tee name, e.g. 'Blue'.")
    gender: str = Field(default="M", description="'M', 'F', or 'U' (unisex).")
    par: Optional[int] = Field(default=None, description="Total par played from this tee.")
    total_yards: Optional[int] = Field(default=None, description="Total yardage from this tee.")
    course_rating: Optional[float] = Field(default=None, description="USGA course rating, e.g. 74.7.")
    slope_rating: Optional[int] = Field(default=None, description="Slope rating, 55-155.")


class CourseData(BaseModel):
    """A full golf course record extracted from the web."""

    name: str = Field(description="Official course name.")
    city: Optional[str] = None
    region: Optional[str] = Field(default=None, description="State or province.")
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    holes_count: int = Field(default=18, description="Number of holes (9, 18, 27).")
    par: Optional[int] = Field(default=None, description="Total par for the course.")
    architect: Optional[str] = None
    year_built: Optional[int] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    tees: list[TeeData] = Field(default_factory=list)
    holes: list[HoleData] = Field(default_factory=list)
