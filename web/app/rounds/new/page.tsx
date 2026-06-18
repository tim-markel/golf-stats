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
  Hazard,
  hazardLabel,
  Hole,
  HoleStatIn,
  nicotineLabel,
  PenaltyStroke,
  weedLabel,
} from "@/lib/api";
import Combobox from "@/components/Combobox";
import { useGolfer } from "@/lib/golfer-context";

const HAZARDS: Hazard[] = [
  "water",
  "greenside_bunker",
  "fairway_bunker",
  "natural_area",
  "ob",
];
const BEER_SIZES = [12, 16, 19.2, 7, 22, 25];
const NIC_TYPES = ["cigarette", "cigar", "vape", "dip", "pouch", "gum"];
const WEED_TYPES = ["joint", "blunt", "bowl", "vape", "dab", "edible"];
const WEED_UNITS = ["g", "mg", "hits"];

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
            className={active ? "chip-on" : "chip-off"}
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
        <div className="min-w-[200px] flex-1">
          <Combobox
            value={pick || null}
            onChange={setPick}
            placeholder="Choose a beer…"
            options={[
              ...options.map((o) => ({
                value: String(o.beer_id),
                label: o.name,
                sublabel: o.abv != null ? `${o.abv}%` : undefined,
              })),
              { value: "other", label: "Other…" },
            ]}
          />
        </div>

        <select
          className="input w-auto flex-none"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {BEER_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} oz
            </option>
          ))}
        </select>

        <button type="button" onClick={add} className="btn-primary">
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

// Nicotine logging for a hole: pick a type + quantity; added items listed.
function NicotineEntry({
  items,
  onChange,
}: {
  items: HoleStatIn["nicotine"];
  onChange: (n: HoleStatIn["nicotine"]) => void;
}) {
  const [type, setType] = useState("pouch");
  const [qty, setQty] = useState(1);
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Nicotine</div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((n, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>
                {nicotineLabel(n.type)}: {n.quantity}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
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
          className="input w-auto flex-none"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {NIC_TYPES.map((t) => (
            <option key={t} value={t}>
              {nicotineLabel(t)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          className="input w-20 flex-none"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        />
        <button
          type="button"
          onClick={() => onChange([...items, { type, quantity: qty }])}
          className="btn-primary"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Weed logging for a hole: pick a type + amount + unit (g / mg / hits).
function WeedEntry({
  items,
  onChange,
}: {
  items: HoleStatIn["weed"];
  onChange: (w: HoleStatIn["weed"]) => void;
}) {
  const [type, setType] = useState("joint");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("g");
  function add() {
    onChange([
      ...items,
      { type, amount: amount === "" ? null : Number(amount), unit },
    ]);
    setAmount("");
  }
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Weed</div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((w, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>
                {weedLabel(w.type)}
                {w.amount != null ? ` · ${w.amount} ${w.unit ?? ""}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
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
          className="input w-auto flex-none"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {WEED_TYPES.map((t) => (
            <option key={t} value={t}>
              {weedLabel(t)}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          min={0}
          placeholder="amt"
          className="input w-20 flex-none"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="input w-auto flex-none"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {WEED_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="btn-primary">
          Add
        </button>
      </div>
    </div>
  );
}

export default function NewRoundPage() {
  const router = useRouter();
  const { active } = useGolfer(); // round is for the golfer whose page you came from
  const golferId = active?.golfer_id ?? null;
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [beerOptions, setBeerOptions] = useState<Beer[]>([]);

  const [courseId, setCourseId] = useState<number | null>(null);
  const [teeId, setTeeId] = useState<number | null>(null);
  const [playedOn, setPlayedOn] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [nine, setNine] = useState<"front" | "back">("front");
  const [timeOfDay, setTimeOfDay] = useState<
    "morning" | "afternoon" | "twilight" | null
  >(null);

  const [roundHoles, setRoundHoles] = useState<Hole[]>([]);
  const [stats, setStats] = useState<HoleStatIn[]>([]);
  const [current, setCurrent] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCourses().then(setCourses).catch(() => {});
    api.listBeers().then(setBeerOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (courseId == null) return;
    api.getCourse(courseId).then((c) => {
      setCourse(c);
      setTeeId(c.tees[0]?.id ?? null);
      setHolesPlayed(c.holes_count <= 9 ? 9 : 18); // 9-hole courses are always 9
    });
  }, [courseId]);

  // The subset of holes actually being played, based on 9/18 + front/back.
  function selectedHoles(c: CourseDetail): Hole[] {
    const all = [...c.holes].sort((a, b) => a.hole_number - b.hole_number);
    if (holesPlayed === 18) return all;
    if (nine === "back") {
      const back = all.filter((h) => h.hole_number > 9);
      return back.length ? back : all;
    }
    return all.filter((h) => h.hole_number <= 9);
  }

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

  function startRound() {
    if (!course) return;
    const holes = selectedHoles(course);
    setRoundHoles(holes);
    setStats(holes.map((h) => emptyHoleStat(h.id)));
    setCurrent(0);
    setStarted(true);
  }

  // When advancing a hole, default its score to par if it wasn't touched.
  function defaultScore(i: number) {
    setStats((prev) =>
      prev.map((s, idx) =>
        idx === i && s.score == null ? { ...s, score: roundHoles[idx].par } : s
      )
    );
  }
  function goNext() {
    defaultScore(current);
    setCurrent((c) => c + 1);
  }

  async function submit() {
    if (golferId == null || courseId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      // default the final hole's score to par too if it wasn't set
      const finalStats = stats.map((s, idx) =>
        idx === current && s.score == null
          ? { ...s, score: roundHoles[idx].par }
          : s
      );
      await api.createRound({
        golfer_id: golferId,
        course_id: courseId,
        tee_id: teeId,
        played_on: playedOn,
        time_of_day: timeOfDay,
        round_duration: null,
        hole_stats: finalStats,
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
    const is18 = course != null && course.holes_count > 9;
    return (
      <div className="card space-y-4 p-5">
        <h1 className="text-2xl font-bold tracking-tight">
          New round{active ? ` · ${active.name}` : ""}
        </h1>

        {golferId == null && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            No golfer selected — open a golfer&apos;s page and tap “New round”.
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Course</label>
          <Combobox
            value={courseId != null ? String(courseId) : null}
            onChange={(v) => setCourseId(Number(v))}
            placeholder="Select a course…"
            options={courses.map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
          />
        </div>

        {course && (
          <div>
            <label className="mb-1 block text-sm font-medium">Tees</label>
            <Combobox
              value={teeId != null ? String(teeId) : null}
              onChange={(v) => setTeeId(Number(v))}
              placeholder="Select tees…"
              options={course.tees.map((t) => ({
                value: String(t.id),
                label: t.name,
                sublabel: t.total_yards ? `${t.total_yards} yds` : undefined,
              }))}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            className="input"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
          />
        </div>

        {is18 && (
          <div>
            <label className="mb-1 block text-sm font-medium">Holes played</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setHolesPlayed(18)}
                className={holesPlayed === 18 ? "chip-on" : "chip-off"}
              >
                18
              </button>
              <button
                type="button"
                onClick={() => setHolesPlayed(9)}
                className={holesPlayed === 9 ? "chip-on" : "chip-off"}
              >
                9
              </button>
            </div>
            {holesPlayed === 9 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setNine("front")}
                  className={nine === "front" ? "chip-on" : "chip-off"}
                >
                  Front 9
                </button>
                <button
                  type="button"
                  onClick={() => setNine("back")}
                  className={nine === "back" ? "chip-on" : "chip-off"}
                >
                  Back 9
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Time of day</label>
          <Seg
            value={timeOfDay}
            onChange={setTimeOfDay}
            options={[
              { label: "Morning", value: "morning" },
              { label: "Afternoon", value: "afternoon" },
              { label: "Twilight", value: "twilight" },
            ]}
          />
        </div>

        <button
          disabled={!canStart}
          onClick={startRound}
          className="btn-primary w-full py-3"
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
  const hole = roundHoles[current];
  const s = stats[current];
  const isLast = current === roundHoles.length - 1;
  const showDriving = hole.par >= 4;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          Hole {hole.hole_number}{" "}
          <span className="text-gray-400">· Par {hole.par}</span>
        </h1>
        <span className="text-sm text-gray-500">
          {current + 1}/{roundHoles.length}
        </span>
      </div>

      <div className="card space-y-4 p-4">
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
              { label: "Long", value: "long" },
              { label: "Short", value: "short" },
              { label: "Left", value: "left" },
              { label: "Right", value: "right" },
              { label: "Long Left", value: "long_left" },
              { label: "Long Right", value: "long_right" },
              { label: "Short Left", value: "short_left" },
              { label: "Short Right", value: "short_right" },
            ]}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => patch(current, { gir: s.gir ? null : true })}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              s.gir ? "border-fairway bg-fairway text-white" : "border-gray-300 bg-white"
            }`}
          >
            GIR
          </button>
          <button
            type="button"
            onClick={() =>
              patch(current, { up_and_down: s.up_and_down ? null : true })
            }
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              s.up_and_down ? "border-fairway bg-fairway text-white" : "border-gray-300 bg-white"
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
                  className={active ? "chip-on" : "chip-off"}
                >
                  {hazardLabel(h)}
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
        <NicotineEntry
          items={s.nicotine}
          onChange={(n) => patch(current, { nicotine: n })}
        />
        <WeedEntry items={s.weed} onChange={(w) => patch(current, { weed: w })} />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent((c) => c - 1)}
          className="btn-ghost px-4 py-3"
        >
          ← Prev
        </button>
        {isLast ? (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="btn-primary flex-1 py-3"
          >
            {submitting ? "Saving…" : "Finish & save round"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary flex-1 py-3"
          >
            Next hole →
          </button>
        )}
      </div>
    </div>
  );
}
