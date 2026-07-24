"""Pydantic request/response models for the API."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

DrivingAccuracy = Literal["fairway", "left", "right", "short", "long"]
ApproachAccuracy = Literal[
    "on", "short", "long", "left", "right",
    "long_left", "short_left", "long_right", "short_right",
]
PenaltyStroke = Literal["off_tee", "approach"]
Hazard = Literal["water", "greenside_bunker", "fairway_bunker", "natural_area", "ob"]


# --- golfers ---------------------------------------------------------------
class GolferIn(BaseModel):
    name: str
    handicap: Optional[float] = None
    ghin_id: Optional[str] = None


class Golfer(GolferIn):
    golfer_id: int
    is_admin: bool = False
    is_super_admin: bool = False
    email: Optional[str] = None


class GolferUpdate(BaseModel):
    name: Optional[str] = None
    handicap: Optional[float] = None
    is_admin: Optional[bool] = None


class CredentialsUpdate(BaseModel):
    """Admin-set login credentials for a golfer. Send either or both."""

    email: Optional[str] = None
    password: Optional[str] = None


class SignupIn(BaseModel):
    name: str
    email: str
    password: str


class VerifySignupIn(BaseModel):
    email: str
    code: str


class ResendCodeIn(BaseModel):
    email: str


class LoginIn(BaseModel):
    email: str
    password: str


class AuthResult(BaseModel):
    token: str
    golfer: Golfer


class PasswordResetRequest(BaseModel):
    email: str


class PasswordReset(BaseModel):
    token: str
    password: str


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
    state: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    holes_count: int
    par: Optional[int] = None
    website: Optional[str] = None
    booking_url: Optional[str] = None
    phone: Optional[str] = None


class CourseScrapeIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)


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
    score: Optional[int] = Field(None, ge=1, le=30)
    putts: Optional[int] = Field(None, ge=0, le=20)
    driving_accuracy: Optional[DrivingAccuracy] = None
    gir: Optional[bool] = None
    approach_accuracy: Optional[ApproachAccuracy] = None
    up_and_down: Optional[bool] = None
    penalty_locations: list[PenaltyStroke] = Field(default_factory=list)
    penalty_strokes: int = Field(0, ge=0, le=20)
    hazards_hit: list[Hazard] = Field(default_factory=list)
    balls_lost: int = Field(0, ge=0, le=20)
    hotdogs: int = Field(0, ge=0, le=50)
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
    handicap_index: Optional[float] = None
    rounds: list[RoundSummary] = []


# --- season totals (mirrors a round's totals, aggregated over all rounds) ---
class ParAverage(BaseModel):
    par: int
    avg: float


class PuttScorePoint(BaseModel):
    score: int
    putts: int


class CountScorePoint(BaseModel):
    score: int
    count: int  # greens or fairways hit that round


class SeasonStats(BaseModel):
    rounds_played: int = 0
    holes_played: int = 0
    hazard_by_type: dict[str, int] = Field(default_factory=dict)
    nicotine_by_type: dict[str, int] = Field(default_factory=dict)
    balls_lost: int = 0
    penalty_strokes: int = 0
    beers: int = 0
    beer_oz: float = 0
    weed: int = 0
    weed_by_type: dict[str, int] = Field(default_factory=dict)
    hotdogs: int = 0
    approach_counts: dict[str, int] = Field(default_factory=dict)
    gir_count: int = 0
    up_downs_made: int = 0
    up_downs_attempts: int = 0
    fw_counts: dict[str, int] = Field(default_factory=dict)
    fairways_hit: int = 0
    fairways_total: int = 0
    score_counts: dict[str, int] = Field(default_factory=dict)
    putt_counts: dict[str, int] = Field(default_factory=dict)
    par_averages: list[ParAverage] = Field(default_factory=list)
    total_putts: int = 0
    putt_holes: int = 0
    putt_avg_per_round: Optional[float] = None  # over 18-hole rounds only
    round_scores: list[int] = Field(default_factory=list)  # 18-hole totals
    putts_vs_score: list[PuttScorePoint] = Field(default_factory=list)
    gir_vs_score: list[CountScorePoint] = Field(default_factory=list)
    fw_vs_score: list[CountScorePoint] = Field(default_factory=list)
    gir_par_pct: Optional[float] = None  # % of GIR holes scored par or better
    fw_par_pct: Optional[float] = None   # % of fairway-hit holes scored par or better


# --- leaderboard -----------------------------------------------------------
class LeaderboardGolfer(BaseModel):
    golfer_id: int
    name: str
    rounds_played: int
    handicap_index: Optional[float] = None
    avg_score: Optional[float] = None
    avg_putts: Optional[float] = None
    gir_pct: Optional[float] = None
    fairway_pct: Optional[float] = None


class CourseTopScore(BaseModel):
    golfer_id: int
    name: str
    score: int
    played_on: date
    holes_played: int


class CourseLeaderboard(BaseModel):
    course_id: int
    course_name: str
    holes_count: int
    rounds: int = 0
    top: list[CourseTopScore] = []


class ViceRow(BaseModel):
    golfer_id: int
    name: str
    total: float
    detail: Optional[str] = None


class AssIndexRow(BaseModel):
    golfer_id: int
    name: str
    ass_index: float
    penalties: int
    balls_lost: int
    hazards: int
    three_putts: int
    rounds_played: int


class Leaderboard(BaseModel):
    golfers: list[LeaderboardGolfer] = []
    courses: list[CourseLeaderboard] = []
    beers: list[ViceRow] = []
    nicotine: list[ViceRow] = []
    weed: list[ViceRow] = []
    hotdogs: list[ViceRow] = []
    ass_index: list[AssIndexRow] = []


# --- round detail / scorecard ----------------------------------------------
class HoleNicotine(BaseModel):
    type: str
    quantity: int


class HoleWeed(BaseModel):
    type: str
    count: int       # number of entries of this type
    hits: float = 0  # total when logged in "hits" (e.g. vape hits)


# Raw per-hole consumption entries (used to re-populate the hole editor).
class HoleBeerEntry(BaseModel):
    beer_id: Optional[int] = None
    name: Optional[str] = None
    size_oz: float


class HoleWeedEntry(BaseModel):
    type: str
    amount: Optional[float] = None
    unit: Optional[str] = None


class ScorecardHole(BaseModel):
    hole_id: int
    hole_number: int
    par: int
    stroke_index: Optional[int] = None
    yards: Optional[int] = None
    score: Optional[int] = None
    putts: Optional[int] = None
    driving_accuracy: Optional[str] = None
    gir: Optional[bool] = None
    approach_accuracy: Optional[str] = None
    up_and_down: Optional[bool] = None
    penalty_locations: list[str] = Field(default_factory=list)
    penalty_strokes: int = 0
    hazards_hit: list[str] = Field(default_factory=list)
    balls_lost: int = 0
    # per-hole consumption (aggregated for display)
    beers: int = 0
    hotdogs: int = 0
    nicotine: list[HoleNicotine] = Field(default_factory=list)
    weed: list[HoleWeed] = Field(default_factory=list)
    # raw entries for the editor (round-trips back to the PATCH body)
    beer_entries: list[HoleBeerEntry] = Field(default_factory=list)
    weed_entries: list[HoleWeedEntry] = Field(default_factory=list)


class HoleScoreUpdate(BaseModel):
    hole_id: int
    score: Optional[int] = Field(None, ge=1, le=30)
    putts: Optional[int] = Field(None, ge=0, le=20)


class RoundScoresUpdate(BaseModel):
    holes: list[HoleScoreUpdate]


class RoundMetaUpdate(BaseModel):
    played_on: Optional[date] = None
    tee_id: Optional[int] = None
    time_of_day: Optional[Literal["morning", "afternoon", "twilight"]] = None


class HoleStatEdit(BaseModel):
    """Edit a single hole's stats, including its consumption. The consumption
    lists fully replace the hole's existing beer/nicotine/weed rows."""

    score: Optional[int] = Field(None, ge=1, le=30)
    putts: Optional[int] = Field(None, ge=0, le=20)
    driving_accuracy: Optional[DrivingAccuracy] = None
    gir: Optional[bool] = None
    approach_accuracy: Optional[ApproachAccuracy] = None
    up_and_down: Optional[bool] = None
    penalty_locations: list[PenaltyStroke] = Field(default_factory=list)
    penalty_strokes: int = Field(0, ge=0, le=20)
    hazards_hit: list[Hazard] = Field(default_factory=list)
    balls_lost: int = Field(0, ge=0, le=20)
    hotdogs: int = Field(0, ge=0, le=50)
    nicotine: list[NicotineIn] = Field(default_factory=list)
    weed: list[WeedIn] = Field(default_factory=list)
    beers: list[BeerIn] = Field(default_factory=list)


class RoundTotals(BaseModel):
    hazards: int = 0
    balls_lost: int = 0
    penalty_strokes: int = 0
    beers: int = 0
    beer_oz: float = 0
    nicotine: int = 0
    weed: int = 0
    hotdogs: int = 0


# --- practice ---------------------------------------------------------------
class PracticeActivity(BaseModel):
    """One practice activity: time (minutes) and an overall rating. Only the
    range uses `balls`; putting/chipping leave it null."""

    balls: Optional[int] = None
    time: Optional[int] = None
    rating: Optional[Literal["good", "medium", "bad"]] = None


class PracticeSessionIn(BaseModel):
    golfer_id: int
    practiced_on: date
    range: PracticeActivity = Field(default_factory=PracticeActivity)
    putting: PracticeActivity = Field(default_factory=PracticeActivity)
    chipping: PracticeActivity = Field(default_factory=PracticeActivity)
    notes: Optional[str] = None


class PracticeSessionUpdate(BaseModel):
    practiced_on: date
    range: PracticeActivity = Field(default_factory=PracticeActivity)
    putting: PracticeActivity = Field(default_factory=PracticeActivity)
    chipping: PracticeActivity = Field(default_factory=PracticeActivity)
    notes: Optional[str] = None


class PracticeSession(BaseModel):
    id: int
    golfer_id: int
    practiced_on: date
    range: PracticeActivity
    putting: PracticeActivity
    chipping: PracticeActivity
    notes: Optional[str] = None


class RoundDetail(BaseModel):
    round_id: int
    golfer_id: int
    played_on: date
    time_of_day: Optional[str] = None
    round_duration: Optional[str] = None
    course_id: int
    course_name: str
    tee_id: Optional[int] = None
    tee_name: Optional[str] = None
    course_rating: Optional[float] = None
    slope_rating: Optional[int] = None
    out_score: Optional[int] = None
    in_score: Optional[int] = None
    total_score: Optional[int] = None
    total_putts: Optional[int] = None
    holes: list[ScorecardHole] = Field(default_factory=list)
    totals: RoundTotals
