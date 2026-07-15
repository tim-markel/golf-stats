// Typed client for the golf-stats FastAPI backend.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- types (mirror api/schemas.py) -----------------------------------------
export interface Golfer {
  golfer_id: number;
  name: string;
  handicap: number | null;
  ghin_id: string | null;
}

export interface Course {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  holes_count: number;
  par: number | null;
  website: string | null;
  booking_url: string | null;
  phone: string | null;
}

export interface Hole {
  id: number;
  hole_number: number;
  par: number;
  stroke_index: number | null;
}

export interface Tee {
  id: number;
  name: string;
  total_yards: number | null;
  course_rating: number | null;
  slope_rating: number | null;
}

export interface CourseDetail extends Course {
  tees: Tee[];
  holes: Hole[];
}

export type DrivingAccuracy = "fairway" | "left" | "right" | "short" | "long";
export type ApproachAccuracy =
  | "on"
  | "short"
  | "long"
  | "left"
  | "right"
  | "long_left"
  | "short_left"
  | "long_right"
  | "short_right";
export type PenaltyStroke = "off_tee" | "approach";
export type Hazard =
  | "water"
  | "greenside_bunker"
  | "fairway_bunker"
  | "natural_area"
  | "ob";

// Display label for a hazard value, e.g. "natural_area" -> "Natural Area", "ob" -> "OB".
// Pass short=true for compact card labels ("GS Bunker", "FW Bunker").
export function hazardLabel(z: string, short = false): string {
  if (z === "ob") return "OB";
  if (short && z === "greenside_bunker") return "GS Bunker";
  if (short && z === "fairway_bunker") return "FW Bunker";
  return z
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface Beer {
  beer_id: number;
  name: string;
  abv: number | null;
}

export interface BeerIn {
  beer_id: number | null; // null => "other"; send name (+ abv) instead
  name: string | null;
  abv: number | null;
  size_oz: number;
}

export interface HoleStatIn {
  hole_id: number;
  score: number | null;
  putts: number | null;
  driving_accuracy: DrivingAccuracy | null;
  gir: boolean | null;
  approach_accuracy: ApproachAccuracy | null;
  up_and_down: boolean | null;
  penalty_locations: PenaltyStroke[];
  penalty_strokes: number;
  hazards_hit: Hazard[];
  balls_lost: number;
  hotdogs: number;
  nicotine: { type: string; quantity: number }[];
  weed: { type: string; amount: number | null; unit: string | null }[];
  beers: BeerIn[];
}

export interface RoundIn {
  golfer_id: number;
  course_id: number;
  tee_id: number | null;
  played_on: string;
  time_of_day: "morning" | "afternoon" | "twilight" | null;
  round_duration: string | null;
  hole_stats: HoleStatIn[];
}

export interface RoundSummary {
  round_id: number;
  played_on: string;
  course_name: string;
  holes_played: number;
  total_score: number | null;
  total_putts: number | null;
  greens_in_reg: number;
  fairways_hit: number;
  driving_holes: number;
  up_and_downs: number;
  penalty_holes: number;
  balls_lost: number;
  beers_finished: number;
  beer_oz: number;
}

export interface GolferStats {
  golfer: Golfer;
  rounds_played: number;
  avg_score: number | null;
  avg_putts: number | null;
  gir_pct: number | null;
  fairway_pct: number | null;
  handicap_index: number | null;
  rounds: RoundSummary[];
}

export interface SeasonStats {
  rounds_played: number;
  holes_played: number;
  hazard_by_type: Record<string, number>;
  nicotine_by_type: Record<string, number>;
  balls_lost: number;
  penalty_strokes: number;
  beers: number;
  beer_oz: number;
  weed: number;
  weed_by_type: Record<string, number>;
  hotdogs: number;
  approach_counts: Record<string, number>;
  gir_count: number;
  up_downs_made: number;
  up_downs_attempts: number;
  fw_counts: Record<string, number>;
  fairways_hit: number;
  fairways_total: number;
  score_counts: Record<string, number>;
  putt_counts: Record<string, number>;
  par_averages: { par: number; avg: number }[];
  total_putts: number;
  putt_holes: number;
  putt_avg_per_round: number | null;
  round_scores: number[];
  putts_vs_score: { score: number; putts: number }[];
  gir_vs_score: { score: number; count: number }[];
  fw_vs_score: { score: number; count: number }[];
  gir_par_pct: number | null;
  fw_par_pct: number | null;
}

export interface LeaderboardGolfer {
  golfer_id: number;
  name: string;
  rounds_played: number;
  handicap_index: number | null;
  avg_score: number | null;
  avg_putts: number | null;
  gir_pct: number | null;
  fairway_pct: number | null;
}

export interface CourseTopScore {
  golfer_id: number;
  name: string;
  score: number;
  played_on: string;
  holes_played: number;
}

export interface CourseLeaderboard {
  course_id: number;
  course_name: string;
  holes_count: number;
  rounds: number;
  top: CourseTopScore[];
}

export interface ViceRow {
  golfer_id: number;
  name: string;
  total: number;
  detail: string | null;
}

export interface AssIndexRow {
  golfer_id: number;
  name: string;
  ass_index: number;
  penalties: number;
  balls_lost: number;
  hazards: number;
  three_putts: number;
  rounds_played: number;
}

export interface Leaderboard {
  golfers: LeaderboardGolfer[];
  courses: CourseLeaderboard[];
  beers: ViceRow[];
  nicotine: ViceRow[];
  weed: ViceRow[];
  hotdogs: ViceRow[];
  ass_index: AssIndexRow[];
}

export interface ScorecardHole {
  hole_id: number;
  hole_number: number;
  par: number;
  stroke_index: number | null;
  yards: number | null;
  score: number | null;
  putts: number | null;
  driving_accuracy: string | null;
  gir: boolean | null;
  approach_accuracy: string | null;
  up_and_down: boolean | null;
  penalty_locations: string[];
  penalty_strokes: number;
  hazards_hit: string[];
  balls_lost: number;
  beers: number;
  hotdogs: number;
  nicotine: { type: string; quantity: number }[];
  weed: { type: string; count: number; hits: number }[];
  // raw entries for the per-hole editor
  beer_entries: { beer_id: number | null; name: string | null; size_oz: number }[];
  weed_entries: { type: string; amount: number | null; unit: string | null }[];
}

// Friendly labels for the per-hole consumption breakdowns.
export function nicotineLabel(type: string): string {
  return (
    { cigarette: "Cigs", cigar: "Cigars", vape: "Vape", dip: "Dip", pouch: "Zyns", gum: "Gum" }[
      type
    ] ?? type.charAt(0).toUpperCase() + type.slice(1)
  );
}
export function weedLabel(type: string): string {
  return (
    {
      joint: "Joint",
      blunt: "Blunt",
      bowl: "Bowl",
      one_hitter: "One Hitter",
      vape: "Vape",
      dab: "Dab",
      edible: "Edible",
    }[
      type
    ] ?? type.charAt(0).toUpperCase() + type.slice(1)
  );
}

export interface HoleScoreUpdate {
  hole_id: number;
  score: number | null;
  putts: number | null;
}

// Per-hole golf-stat edit (consumption is left untouched by this endpoint).
export interface HoleStatEdit {
  score: number | null;
  putts: number | null;
  driving_accuracy: DrivingAccuracy | null;
  gir: boolean | null;
  approach_accuracy: ApproachAccuracy | null;
  up_and_down: boolean | null;
  penalty_locations: PenaltyStroke[];
  penalty_strokes: number;
  hazards_hit: Hazard[];
  balls_lost: number;
  hotdogs: number;
  nicotine: { type: string; quantity: number }[];
  weed: { type: string; amount: number | null; unit: string | null }[];
  beers: BeerIn[];
}

export interface RoundTotals {
  hazards: number;
  balls_lost: number;
  penalty_strokes: number;
  beers: number;
  beer_oz: number;
  nicotine: number;
  weed: number;
  hotdogs: number;
}

export interface RoundDetail {
  round_id: number;
  played_on: string;
  time_of_day: string | null;
  round_duration: string | null;
  course_id: number;
  course_name: string;
  tee_id: number | null;
  tee_name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  out_score: number | null;
  in_score: number | null;
  total_score: number | null;
  total_putts: number | null;
  holes: ScorecardHole[];
  totals: RoundTotals;
}

// --- practice ---------------------------------------------------------------
export type PracticeRating = "good" | "medium" | "bad";
export interface PracticeActivity {
  balls: number | null; // range only
  time: number | null; // minutes
  rating: PracticeRating | null;
}

export interface PracticeSessionIn {
  golfer_id: number;
  practiced_on: string;
  range: PracticeActivity;
  putting: PracticeActivity;
  chipping: PracticeActivity;
  notes: string | null;
}

export interface PracticeSession {
  id: number;
  golfer_id: number;
  practiced_on: string;
  range: PracticeActivity;
  putting: PracticeActivity;
  chipping: PracticeActivity;
  notes: string | null;
}

export interface PracticeSessionUpdate {
  practiced_on: string;
  range: PracticeActivity;
  putting: PracticeActivity;
  chipping: PracticeActivity;
  notes: string | null;
}

export const PRACTICE_ACTIVITIES = ["range", "putting", "chipping"] as const;
export type PracticeActivityKey = (typeof PRACTICE_ACTIVITIES)[number];

// --- fetch helpers ---------------------------------------------------------
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export const api = {
  listGolfers: () => get<Golfer[]>("/golfers"),
  getGolfer: (id: number) => get<Golfer>(`/golfers/${id}`),
  createGolfer: (b: { name: string; handicap?: number | null; ghin_id?: string | null }) =>
    post<Golfer>("/golfers", b),
  updateGolfer: (id: number, b: { name?: string; handicap?: number | null }) =>
    patch<Golfer>(`/golfers/${id}`, b),
  golferStats: (id: number) => get<GolferStats>(`/golfers/${id}/stats`),
  golferSeason: (id: number) => get<SeasonStats>(`/golfers/${id}/season`),
  leaderboard: () => get<Leaderboard>("/leaderboard"),
  listCourses: () => get<Course[]>("/courses"),
  getCourse: (id: number) => get<CourseDetail>(`/courses/${id}`),
  listBeers: () => get<Beer[]>("/beers"),
  createRound: (b: RoundIn) => post<{ round_id: number }>("/rounds", b),
  getRound: (id: number) => get<RoundDetail>(`/rounds/${id}`),
  updateRound: (
    id: number,
    b: {
      played_on?: string;
      tee_id?: number | null;
      time_of_day?: "morning" | "afternoon" | "twilight" | null;
    }
  ) => patch<RoundDetail>(`/rounds/${id}`, b),
  updateRoundHoleStats: (id: number, holes: HoleScoreUpdate[]) =>
    patch<RoundDetail>(`/rounds/${id}/hole-stats`, { holes }),
  updateHoleStat: (roundId: number, holeId: number, b: HoleStatEdit) =>
    patch<RoundDetail>(`/rounds/${roundId}/holes/${holeId}`, b),
  listPractice: (golferId: number) =>
    get<PracticeSession[]>(`/practice?golfer_id=${golferId}`),
  getPractice: (id: number) => get<PracticeSession>(`/practice/${id}`),
  createPractice: (b: PracticeSessionIn) =>
    post<PracticeSession>("/practice", b),
  updatePractice: (id: number, b: PracticeSessionUpdate) =>
    patch<PracticeSession>(`/practice/${id}`, b),
  deletePractice: (id: number) => del(`/practice/${id}`),
};
