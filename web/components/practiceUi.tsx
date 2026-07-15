"use client";

// Shared UI + helpers for the practice pages (dashboard + per-session editor).

import {
  PracticeActivity,
  PracticeActivityKey,
  PracticeRating,
  PracticeSession,
} from "@/lib/api";

export const PRACTICE_LABELS: Record<PracticeActivityKey, string> = {
  range: "Range",
  putting: "Putting",
  chipping: "Chipping",
};

const RATINGS: { key: PracticeRating; label: string; on: string }[] = [
  { key: "good", label: "Good", on: "border-green-600 bg-green-600 text-white" },
  { key: "medium", label: "Medium", on: "border-yellow-500 bg-yellow-500 text-white" },
  { key: "bad", label: "Bad", on: "border-red-700 bg-red-700 text-white" },
];
export const RATING_TEXT: Record<PracticeRating, string> = {
  good: "text-fairway",
  medium: "text-yellow-700",
  bad: "text-red-600",
};

export type ActDraft = { balls: string; time: string; rating: PracticeRating | null };
export type PracticeDraft = Record<PracticeActivityKey, ActDraft>;

export const emptyPracticeDraft = (): PracticeDraft => ({
  range: { balls: "", time: "", rating: null },
  putting: { balls: "", time: "", rating: null },
  chipping: { balls: "", time: "", rating: null },
});

const numStr = (n: number | null) => (n == null ? "" : String(n));

export function sessionToDraft(s: PracticeSession): PracticeDraft {
  const act = (a: PracticeActivity): ActDraft => ({
    balls: numStr(a.balls),
    time: numStr(a.time),
    rating: a.rating,
  });
  return { range: act(s.range), putting: act(s.putting), chipping: act(s.chipping) };
}

const num = (s: string): number | null =>
  s.trim() === "" ? null : Math.max(0, Math.floor(Number(s) || 0));

// Build the API activity payloads from a draft (range keeps balls; others null).
export function draftToActivities(draft: PracticeDraft) {
  return {
    range: { balls: num(draft.range.balls), time: num(draft.range.time), rating: draft.range.rating },
    putting: { balls: null, time: num(draft.putting.time), rating: draft.putting.rating },
    chipping: { balls: null, time: num(draft.chipping.time), rating: draft.chipping.rating },
  };
}

export const draftHasAny = (draft: PracticeDraft) =>
  (Object.keys(draft) as PracticeActivityKey[]).some(
    (a) => draft[a].balls.trim() !== "" || draft[a].time.trim() !== "" || draft[a].rating
  );

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const fmtTime = (m: number) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
};

export function RatingButtons({
  value,
  onChange,
}: {
  value: PracticeRating | null;
  onChange: (v: PracticeRating | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {RATINGS.map((r) => {
        // full color when nothing is picked yet or this one is picked;
        // the others fall back to the plain white box.
        const colored = value === null || value === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(value === r.key ? null : r.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              colored ? r.on : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActivityForm({
  label,
  withBalls,
  value,
  onChange,
}: {
  label: string;
  withBalls: boolean;
  value: ActDraft;
  onChange: (v: ActDraft) => void;
}) {
  const numInput = (k: "balls" | "time", ph: string) => (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      placeholder={ph}
      value={value[k]}
      onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-fairway"
    />
  );
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className={`mb-2 grid gap-2 ${withBalls ? "grid-cols-2" : "grid-cols-1"}`}>
        {withBalls && (
          <div>
            <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-gray-500">
              # Balls
            </label>
            {numInput("balls", "0")}
          </div>
        )}
        <div>
          <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-gray-500">
            Time (min)
          </label>
          {numInput("time", "0")}
        </div>
      </div>
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
        How&apos;d it go?
      </label>
      <RatingButtons value={value.rating} onChange={(r) => onChange({ ...value, rating: r })} />
    </div>
  );
}
