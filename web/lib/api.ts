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
  holes_count: number;
  par: number | null;
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
  penalty_stroke: PenaltyStroke | null;
  hazards_hit: Hazard[];
  balls_lost: number;
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
  rounds: RoundSummary[];
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
  penalty_stroke: string | null;
  hazards_hit: string[];
  balls_lost: number;
  beers: number;
  nicotine: { type: string; quantity: number }[];
  weed: { type: string; count: number; hits: number }[];
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
    { joint: "Joint", blunt: "Blunt", bowl: "Bowl", vape: "Vape", dab: "Dab", edible: "Edible" }[
      type
    ] ?? type.charAt(0).toUpperCase() + type.slice(1)
  );
}

export interface HoleScoreUpdate {
  hole_id: number;
  score: number | null;
  putts: number | null;
}

export interface RoundTotals {
  hazards: number;
  balls_lost: number;
  beers: number;
  beer_oz: number;
  nicotine: number;
  weed: number;
}

export interface RoundDetail {
  round_id: number;
  played_on: string;
  time_of_day: string | null;
  round_duration: string | null;
  course_name: string;
  tee_name: string | null;
  out_score: number | null;
  in_score: number | null;
  total_score: number | null;
  total_putts: number | null;
  holes: ScorecardHole[];
  totals: RoundTotals;
}

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

export const api = {
  listGolfers: () => get<Golfer[]>("/golfers"),
  getGolfer: (id: number) => get<Golfer>(`/golfers/${id}`),
  createGolfer: (b: { name: string; handicap?: number | null; ghin_id?: string | null }) =>
    post<Golfer>("/golfers", b),
  updateGolfer: (id: number, b: { name?: string; handicap?: number | null }) =>
    patch<Golfer>(`/golfers/${id}`, b),
  golferStats: (id: number) => get<GolferStats>(`/golfers/${id}/stats`),
  listCourses: () => get<Course[]>("/courses"),
  getCourse: (id: number) => get<CourseDetail>(`/courses/${id}`),
  listBeers: () => get<Beer[]>("/beers"),
  createRound: (b: RoundIn) => post<{ round_id: number }>("/rounds", b),
  getRound: (id: number) => get<RoundDetail>(`/rounds/${id}`),
  updateRoundHoleStats: (id: number, holes: HoleScoreUpdate[]) =>
    patch<RoundDetail>(`/rounds/${id}/hole-stats`, { holes }),
};
