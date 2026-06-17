"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApproachAccuracy,
  Beer,
  Course,
  CourseDetail,
  DrivingAccuracy,
  Golfer,
  Hazard,
  HoleStatIn,
  PenaltyStroke,
} from "@/lib/api";

const HAZARDS: Hazard[] = ["water", "bunker", "natural_area"];
const BEER_SIZES = [12, 16, 19.2, 7, 22, 25];

function emptyHoleStat(hole_id: number): HoleStatIn {
  return {
    hole_id,
    score: null,
    putts: null,
    driving_accuracy: null,
    gir: null,
    approach_accuracy: null,
    up_and_down: null,
    penalty_stroke: null,
    hazards_hit: [],
    balls_lost: 0,
    nicotine: [],
    weed: [],
    beers: [],
  };
}

// A small segmented control for enum-ish fields.
function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              active
                ? "border-fairway bg-fairway text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-8 w-8 rounded-full border text-lg"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="w-6 text-center font-medium">{value}</span>
        <button
          type="button"
          className="h-8 w-8 rounded-full border text-lg"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

// Beer logging for a single hole: pick a saved beer (or "Other" → name + abv),
// choose a size, and add it. Added beers are listed with a remove button.
function BeerEntry({
  options,
  beers,
  onChange,
}: {
  options: Beer[];
  beers: HoleStatIn["beers"];
  onChange: (b: HoleStatIn["beers"]) => void;
}) {
  const [pick, setPick] = useState<string>(""); // beer_id as string, or "other"
  const [size, setSize] = useState<number>(12);
  const [name, setName] = useState("");
  const [abv, setAbv] = useState("");

  function add() {
    if (pick === "") return;
    if (pick === "other") {
      if (!name.trim()) return;
      onChange([
        ...beers,
        { beer_id: null, name: name.trim(), abv: abv ? Number(abv) : null, size_oz: size },
      ]);
      setName("");
      setAbv("");
    } else {
      onChange([
        ...beers,
        { beer_id: Number(pick), name: null, abv: null, size_oz: size },
      ]);
    }
  }

  function label(b: HoleStatIn["beers"][number]) {
    const nm =
      b.beer_id != null
        ? options.find((o) => o.beer_id === b.beer_id)?.name ?? "Beer"
        : b.name ?? "Beer";
    return `${nm} · ${b.size_oz} oz`;
  }

  return (
    <div>
      <div className="mb-1 text-sm font-medium">Beers 🍺</div>

      {beers.length > 0 && (
        <ul className="mb-2 space-y-1">
          {beers.map((b, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>{label(b)}</span>
              <button
                type="button"
                onClick={() => onChange(beers.filter((_, idx) => idx !== i))}
                className="text-gray-500 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border px-2 py-1.5 text-sm"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">Choose a beer…</option>
          {options.map((o) => (
            <option key={o.beer_id} value={o.beer_id}>
              {o.name}
              {o.abv != null ? ` (${o.abv}%)` : ""}
            </option>
          ))}
          <option value="other">Other…</option>
        </select>

        <select
          className="rounded border px-2 py-1.5 text-sm"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {BEER_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} oz
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={add}
          className="rounded bg-fairway px-3 py-1.5 text-sm font-medium text-white"
        >
          Add
        </button>
      </div>

      {pick === "other" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="flex-1 rounded border px-2 py-1.5 text-sm"
            placeholder="Beer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-24 rounded border px-2 py-1.5 text-sm"
            placeholder="ABV %"
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function NewRoundPage() {
  const router = useRouter();
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [beerOptions, setBeerOptions] = useState<Beer[]>([]);

  const [golferId, setGolferId] = useState<number | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [teeId, setTeeId] = useState<number | null>(null);
  const [playedOn, setPlayedOn] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [timeOfDay, setTimeOfDay] = useState<
    "morning" | "afternoon" | "twilight" | null
  >(null);

  const [stats, setStats] = useState<HoleStatIn[]>([]);
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listGolfers().then(setGolfers).catch(() => {});
    api.listCourses().then(setCourses).catch(() => {});
    api.listBeers().then(setBeerOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (courseId == null) return;
    api.getCourse(courseId).then((c) => {
      setCourse(c);
      setStats(c.holes.map((h) => emptyHoleStat(h.id)));
      setTeeId(c.tees[0]?.id ?? null);
    });
  }, [courseId]);

  function patch(i: number, p: Partial<HoleStatIn>) {
    setStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  function toggleHazard(i: number, h: Hazard) {
    setStats((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const has = s.hazards_hit.includes(h);
        return {
          ...s,
          hazards_hit: has
            ? s.hazards_hit.filter((x) => x !== h)
            : [...s.hazards_hit, h],
        };
      })
    );
  }

  async function submit() {
    if (golferId == null || courseId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createRound({
        golfer_id: golferId,
        course_id: courseId,
        tee_id: teeId,
        played_on: playedOn,
        time_of_day: timeOfDay,
        round_duration: null,
        hole_stats: stats,
      });
      router.push(`/golfers/${golferId}`);
    } catch (e) {
      setError("Failed to save the round.");
      setSubmitting(false);
    }
  }

  // --- setup screen --------------------------------------------------------
  if (!started) {
    const canStart = golferId != null && course != null;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">New round</h1>

        <label className="block text-sm font-medium">Golfer</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={golferId ?? ""}
          onChange={(e) => setGolferId(Number(e.target.value) || null)}
        >
          <option value="">Select a golfer…</option>
          {golfers.map((g) => (
            <option key={g.golfer_id} value={g.golfer_id}>
              {g.name}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium">Course</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={courseId ?? ""}
          onChange={(e) => setCourseId(Number(e.target.value) || null)}
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {course && (
          <>
            <label className="block text-sm font-medium">Tees</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={teeId ?? ""}
              onChange={(e) => setTeeId(Number(e.target.value) || null)}
            >
              {course.tees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.total_yards ? ` · ${t.total_yards} yds` : ""}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="block text-sm font-medium">Date</label>
        <input
          type="date"
          className="w-full rounded border px-3 py-2"
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
        />

        <label className="block text-sm font-medium">Time of day</label>
        <Seg
          value={timeOfDay}
          onChange={setTimeOfDay}
          options={[
            { label: "Morning", value: "morning" },
            { label: "Afternoon", value: "afternoon" },
            { label: "Twilight", value: "twilight" },
          ]}
        />

        <button
          disabled={!canStart}
          onClick={() => setStarted(true)}
          className="w-full rounded bg-fairway px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          Start round
        </button>
        {courses.length === 0 && (
          <p className="text-sm text-gray-500">
            No courses yet — add one with the scraper (`python -m scraper.cli`).
          </p>
        )}
      </div>
    );
  }

  // --- hole-by-hole entry --------------------------------------------------
  const hole = course!.holes[current];
  const s = stats[current];
  const isLast = current === course!.holes.length - 1;
  const showDriving = hole.par >= 4;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Hole {hole.hole_number}{" "}
          <span className="text-gray-400">· Par {hole.par}</span>
        </h1>
        <span className="text-sm text-gray-500">
          {current + 1}/{course!.holes.length}
        </span>
      </div>

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <Stepper
          label="Score"
          value={s.score ?? hole.par}
          min={1}
          onChange={(v) => patch(current, { score: v })}
        />
        <Stepper
          label="Putts"
          value={s.putts ?? 0}
          onChange={(v) => patch(current, { putts: v })}
        />

        {showDriving && (
          <div>
            <div className="mb-1 text-sm font-medium">Driving accuracy</div>
            <Seg<DrivingAccuracy>
              value={s.driving_accuracy}
              onChange={(v) => patch(current, { driving_accuracy: v })}
              options={[
                { label: "Fairway", value: "fairway" },
                { label: "Left", value: "left" },
                { label: "Right", value: "right" },
                { label: "Short", value: "short" },
                { label: "Long", value: "long" },
              ]}
            />
          </div>
        )}

        <div>
          <div className="mb-1 text-sm font-medium">Approach</div>
          <Seg<ApproachAccuracy>
            value={s.approach_accuracy}
            onChange={(v) => patch(current, { approach_accuracy: v })}
            options={[
              { label: "On", value: "on" },
              { label: "Short", value: "short" },
              { label: "Long", value: "long" },
              { label: "Left", value: "left" },
              { label: "Right", value: "right" },
            ]}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => patch(current, { gir: s.gir ? null : true })}
            className={`flex-1 rounded border px-3 py-2 text-sm ${
              s.gir ? "border-fairway bg-fairway text-white" : "bg-white"
            }`}
          >
            GIR
          </button>
          <button
            type="button"
            onClick={() =>
              patch(current, { up_and_down: s.up_and_down ? null : true })
            }
            className={`flex-1 rounded border px-3 py-2 text-sm ${
              s.up_and_down ? "border-fairway bg-fairway text-white" : "bg-white"
            }`}
          >
            Up &amp; down
          </button>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Penalty</div>
          <Seg<PenaltyStroke>
            value={s.penalty_stroke}
            onChange={(v) => patch(current, { penalty_stroke: v })}
            options={[
              { label: "Off tee", value: "off_tee" },
              { label: "Approach", value: "approach" },
            ]}
          />
        </div>

        <div>
          <div className="mb-1 text-sm font-medium">Hazards hit</div>
          <div className="flex flex-wrap gap-1.5">
            {HAZARDS.map((h) => {
              const active = s.hazards_hit.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHazard(current, h)}
                  className={`rounded-full border px-3 py-1 text-sm capitalize ${
                    active
                      ? "border-fairway bg-fairway text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {h.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>

        <Stepper
          label="Balls lost"
          value={s.balls_lost}
          onChange={(v) => patch(current, { balls_lost: v })}
        />
        <BeerEntry
          options={beerOptions}
          beers={s.beers}
          onChange={(b) => patch(current, { beers: b })}
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
          className="rounded border px-4 py-3 disabled:opacity-40"
        >
          ← Prev
        </button>
        {isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex-1 rounded bg-fairway px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Finish & save round"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrent((c) => c + 1)}
            className="flex-1 rounded bg-fairway px-4 py-3 font-medium text-white"
          >
            Next hole →
          </button>
        )}
      </div>
    </div>
  );
}
