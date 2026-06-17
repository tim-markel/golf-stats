"""Pydantic request/response models for the API."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

DrivingAccuracy = Literal["fairway", "left", "right", "short", "long"]
ApproachAccuracy = Literal["short", "long", "left", "right", "on"]
PenaltyStroke = Literal["off_tee", "approach"]
Hazard = Literal["water", "bunker", "natural_area"]


# --- golfers ---------------------------------------------------------------
class GolferIn(BaseModel):
    name: str
    handicap: Optional[float] = None
    ghin_id: Optional[str] = None


class Golfer(GolferIn):
    golfer_id: int


# --- courses (read-only here; populated by the scraper) --------------------
class Hole(BaseModel):
    id: int
    hole_number: int
    par: int
    stroke_index: Optional[int] = None


class Course(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    holes_count: int
    par: Optional[int] = None


class Tee(BaseModel):
    id: int
    name: str
    total_yards: Optional[int] = None
    course_rating: Optional[float] = None
    slope_rating: Optional[int] = None


class CourseDetail(Course):
    tees: list[Tee] = []
    holes: list[Hole] = []


# --- round entry -----------------------------------------------------------
class NicotineIn(BaseModel):
    type: str
    quantity: int = 1


class WeedIn(BaseModel):
    type: str
    amount: Optional[float] = None
    unit: Optional[Literal["g", "mg", "hits"]] = None


class BeerCreate(BaseModel):
    name: str
    abv: Optional[float] = None


class Beer(BeerCreate):
    beer_id: int


class BeerIn(BaseModel):
    """A beer consumed on a hole. Either reference an existing beer by id, or
    pass a name (+ optional abv) for an "other" beer — it's added to the catalog
    and reused next time."""

    beer_id: Optional[int] = None
    name: Optional[str] = None
    abv: Optional[float] = None
    size_oz: float


class HoleStatIn(BaseModel):
    hole_id: int
    score: Optional[int] = None
    putts: Optional[int] = None
    driving_accuracy: Optional[DrivingAccuracy] = None
    gir: Optional[bool] = None
    approach_accuracy: Optional[ApproachAccuracy] = None
    up_and_down: Optional[bool] = None
    penalty_stroke: Optional[PenaltyStroke] = None
    hazards_hit: list[Hazard] = Field(default_factory=list)
    balls_lost: int = 0
    nicotine: list[NicotineIn] = Field(default_factory=list)
    weed: list[WeedIn] = Field(default_factory=list)
    beers: list[BeerIn] = Field(default_factory=list)


class RoundIn(BaseModel):
    golfer_id: int
    course_id: int
    tee_id: Optional[int] = None
    played_on: date
    time_of_day: Optional[Literal["morning", "afternoon", "twilight"]] = None
    round_duration: Optional[str] = None  # e.g. "4:15" (Postgres interval text)
    hole_stats: list[HoleStatIn] = Field(default_factory=list)


class RoundCreated(BaseModel):
    round_id: int


# --- stats (golfer visualization page) -------------------------------------
class RoundSummary(BaseModel):
    round_id: int
    played_on: date
    course_name: str
    holes_played: int
    total_score: Optional[int] = None
    total_putts: Optional[int] = None
    greens_in_reg: int = 0
    fairways_hit: int = 0
    driving_holes: int = 0
    up_and_downs: int = 0
    penalty_holes: int = 0
    balls_lost: int = 0
    beers_finished: int = 0
    beer_oz: float = 0


class GolferStats(BaseModel):
    golfer: Golfer
    rounds_played: int
    avg_score: Optional[float] = None
    avg_putts: Optional[float] = None
    gir_pct: Optional[float] = None
    fairway_pct: Optional[float] = None
    rounds: list[RoundSummary] = []
