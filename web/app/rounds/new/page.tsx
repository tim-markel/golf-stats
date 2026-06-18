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
const WEED_TYPES = ["joint", "blunt", "bowl", "one_hitter", "vape", "dab", "edible"];
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
    penalty_locations: [],
    penalty_strokes: 0,
    hazards_hit: [],
    balls_lost: 0,
    nicotine: [],
    weed: [],
    beers: [],
  };
}

// circle (under par) / square (over par) marker around a score, 1-2 rings.
function scoreMark(score: number, par: number, big = false) {
  const d = score - par;
  const n = Math.min(2, Math.abs(d));
  const shape = d < 0 ? "rounded-full" : "rounded-[3px]";
  const t = big ? "text-lg font-semibold" : "";
  const single = big ? "h-10 w-10" : "h-7 w-7";
  const outer = big ? "h-11 w-11" : "h-8 w-8";
  const inner = big ? "h-9 w-9" : "h-6 w-6";
  if (n === 0)
    return <span className={`inline-flex ${single} items-center justify-center ${t}`}>{score}</span>;
  if (n === 1)
    return (
      <span className={`inline-flex ${single} items-center justify-center border-2 border-current ${shape} ${t}`}>
        {score}
      </span>
    );
  return (
    <span className={`inline-flex ${outer} items-center justify-center border-2 border-current ${shape}`}>
      <span className={`inline-flex ${inner} items-center justify-center border-2 border-current ${shape} ${t}`}>
        {score}
      </span>
    </span>
  );
}

// smaller circle button for the numeric count selectors
const numBtn = (active: boolean) =>
  `flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
    active
      ? "border-fairway bg-fairway text-white"
      : "border-gray-300 bg-white text-gray-700"
  }`;

// shared button styles
const padBtn = (active: boolean, tone: "on" | "off" | "bad" = "on") =>
  `flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
    active
      ? tone === "bad"
        ? "border-red-500 bg-red-500 text-white"
        : "border-fairway bg-fairway text-white"
      : "border-gray-300 bg-white text-gray-700"
  }`;

// Score picker: eagle..triple-bogey buttons (with markers) + custom input.
function ScorePicker({
  par,
  value,
  onChange,
}: {
  par: number;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const lo = Math.max(1, par - 2);
  const hi = par + 3;
  const opts: number[] = [];
  for (let i = lo; i <= hi; i++) opts.push(i);
  const isPreset = value != null && value >= lo && value <= hi;
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Score</div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((n) => {
          const active = !custom && value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(n);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                active ? "bg-fairway-light ring-2 ring-fairway" : "hover:bg-gray-100"
              }`}
            >
              {scoreMark(n, par, true)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`h-10 rounded-lg border px-3 text-sm ${
            custom || (value != null && !isPreset)
              ? "border-fairway bg-fairway text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          Other
        </button>
      </div>
      {(custom || (value != null && !isPreset)) && (
        <input
          type="number"
          min={1}
          autoFocus
          placeholder="Score"
          className="input mt-2 w-24"
          value={value ?? ""}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        />
      )}
    </div>
  );
}

// Directional pad. layout="cross" (driving) or "grid" (approach, with diagonals).
function DirPad({
  label,
  value,
  onChange,
  layout,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  layout: "cross" | "grid";
}) {
  const cell = (v: string, sym: string) => {
    const active = value === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => onChange(active ? null : v)}
        className={padBtn(active)}
      >
        {sym}
      </button>
    );
  };
  const blank = <div className="h-10 w-10" />;
  const center = layout === "cross" ? "fairway" : "on";
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <div className="inline-grid grid-cols-3 gap-1.5">
        {layout === "grid" ? cell("long_left", "↖") : blank}
        {cell("long", "↑")}
        {layout === "grid" ? cell("long_right", "↗") : blank}
        {cell("left", "←")}
        {cell(center, "✓")}
        {cell("right", "→")}
        {layout === "grid" ? cell("short_left", "↙") : blank}
        {cell("short", "↓")}
        {layout === "grid" ? cell("short_right", "↘") : blank}
      </div>
    </div>
  );
}

// GIR check/X; when missed, reveal Up & Down check/X.
function GirControl({
  gir,
  upDown,
  onGir,
  onUpDown,
}: {
  gir: boolean | null;
  upDown: boolean | null;
  onGir: (v: boolean | null) => void;
  onUpDown: (v: boolean | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">GIR</div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onGir(gir === true ? null : true)} className={padBtn(gir === true)}>✓</button>
        <button type="button" onClick={() => onGir(gir === false ? null : false)} className={padBtn(gir === false, "bad")}>✗</button>
      </div>
      {gir === false && (
        <div className="mt-2">
          <div className="mb-1 text-xs font-medium text-gray-500">Up &amp; down</div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onUpDown(upDown === true ? null : true)} className={padBtn(upDown === true)}>✓</button>
            <button type="button" onClick={() => onUpDown(upDown === false ? null : false)} className={padBtn(upDown === false, "bad")}>✗</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Count selector: 0/1/2/3/4+ (or 1.. when min=1); 4+ reveals a number input.
function CountChoice({
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
  const [custom, setCustom] = useState(false);
  const base = min === 0 ? [0, 1, 2, 3] : [1, 2, 3];
  const isPlus = value >= 4;
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {base.map((n) => {
          const active = !custom && !isPlus && value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(active && min > 0 ? 0 : n);
              }}
              className={numBtn(active)}
            >
              {n}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            if (!isPlus) onChange(4);
          }}
          className={numBtn(custom || isPlus)}
        >
          4+
        </button>
      </div>
      {(custom || isPlus) && (
        <input
          type="number"
          min={4}
          autoFocus
          className="input mt-2 w-24"
          value={value || 4}
          onChange={(e) => onChange(Math.max(4, Number(e.target.value) || 4))}
        />
      )}
    </div>
  );
}

// Running scorecard for the holes being played, above the entry card.
function MiniScorecard({
  holes,
  stats,
  current,
}: {
  holes: { id: number; hole_number: number; par: number }[];
  stats: HoleStatIn[];
  current: number;
}) {
  const div = "border-l border-paper-line";
  const tot = "border-l-2 border-paper-line";
  const row = "border-b border-paper-line";
  const totScore = stats.reduce((a, s) => a + (s?.score ?? 0), 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-paper-line bg-paper p-2">
      <table className="w-full min-w-[480px] text-center text-xs text-ink">
        <tbody>
          <tr className={`${row} font-semibold uppercase tracking-wide text-ink/70`}>
            <td className="px-1 py-1 text-left">Hole</td>
            {holes.map((h, i) => (
              <td key={h.id} className={`px-1 py-1 ${div} ${i === current ? "text-fairway" : ""}`}>
                {h.hole_number}
              </td>
            ))}
            <td className={`px-1 py-1 ${tot}`}>Tot</td>
          </tr>
          <tr className={`${row} text-ink/70`}>
            <td className="px-1 py-1 text-left">Par</td>
            {holes.map((h) => (
              <td key={h.id} className={`px-1 py-1 ${div}`}>{h.par}</td>
            ))}
            <td className={`px-1 py-1 font-semibold ${tot}`}>
              {holes.reduce((a, h) => a + h.par, 0)}
            </td>
          </tr>
          <tr>
            <td className="px-1 py-1 text-left">Score</td>
            {holes.map((h, i) => (
              <td
                key={h.id}
                className={`px-1 py-1 ${div} ${i === current ? "bg-fairway/10" : ""}`}
              >
                {stats[i]?.score != null ? scoreMark(stats[i].score as number, h.par) : "·"}
              </td>
            ))}
            <td className={`px-1 py-1 font-bold ${tot}`}>{totScore || ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
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
  const [type, setType] = useState<string | null>(null);
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
        <div className="min-w-[160px] flex-1">
          <Combobox
            value={type}
            onChange={setType}
            placeholder="Choose a method…"
            options={NIC_TYPES.map((t) => ({ value: t, label: nicotineLabel(t) }))}
          />
        </div>
        <input
          type="number"
          min={1}
          className="input w-16 flex-none"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        />
        <button
          type="button"
          onClick={() => {
            if (type) onChange([...items, { type, quantity: qty }]);
          }}
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
  const [type, setType] = useState<string | null>(null);
  const [unit, setUnit] = useState("g");
  const [amount, setAmount] = useState<number>(0.5);
  function add() {
    if (type) onChange([...items, { type, amount, unit }]);
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[160px] flex-1">
            <Combobox
              value={type}
              onChange={setType}
              placeholder="Choose a method…"
              options={WEED_TYPES.map((t) => ({ value: t, label: weedLabel(t) }))}
            />
          </div>
          <select
            className="input w-auto flex-none"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setAmount(e.target.value === "hits" ? 1 : 0.5);
            }}
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
        {unit === "g" ? (
          <div className="flex flex-wrap gap-1.5">
            {[0.25, 0.5, 0.75, 1].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={amount === a ? "chip-on" : "chip-off"}
              >
                {a}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            min={1}
            className="input w-24"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          />
        )}
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

  function goNext() {
    setCurrent((c) => c + 1);
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
      <MiniScorecard holes={roundHoles} stats={stats} current={current} />

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
        <ScorePicker
          par={hole.par}
          value={s.score}
          onChange={(v) => patch(current, { score: v })}
        />

        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          {showDriving && (
            <DirPad
              label="Driving"
              layout="cross"
              value={s.driving_accuracy}
              onChange={(v) =>
                patch(current, { driving_accuracy: v as DrivingAccuracy | null })
              }
            />
          )}
          <DirPad
            label="Approach"
            layout="grid"
            value={s.approach_accuracy}
            onChange={(v) =>
              patch(current, { approach_accuracy: v as ApproachAccuracy | null })
            }
          />
          <GirControl
            gir={s.gir}
            upDown={s.up_and_down}
            onGir={(v) => patch(current, { gir: v })}
            onUpDown={(v) => patch(current, { up_and_down: v })}
          />
        </div>

        <CountChoice
          label="Putts"
          value={s.putts ?? 0}
          onChange={(v) => patch(current, { putts: v })}
        />

        <div>
          <div className="mb-1 text-sm font-medium">Penalty</div>
          <div className="flex flex-wrap gap-1.5">
            {([["off_tee", "Off tee"], ["approach", "Approach"]] as const).map(
              ([val, label]) => {
                const active = s.penalty_locations.includes(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      patch(current, {
                        penalty_locations: active
                          ? s.penalty_locations.filter((x) => x !== val)
                          : [...s.penalty_locations, val],
                      })
                    }
                    className={active ? "chip-on" : "chip-off"}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
          <div className="mt-2">
            <CountChoice
              label="Penalty strokes"
              value={s.penalty_strokes}
              onChange={(v) => patch(current, { penalty_strokes: v })}
              min={1}
            />
          </div>
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

        <CountChoice
          label="Balls lost"
          value={s.balls_lost}
          onChange={(v) => patch(current, { balls_lost: v })}
          min={1}
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
            disabled={submitting || s.score == null}
            onClick={submit}
            className="btn-primary flex-1 py-3"
          >
            {submitting ? "Saving…" : "Finish & save round"}
          </button>
        ) : (
          <button
            type="button"
            disabled={s.score == null}
            onClick={goNext}
            className="btn-primary flex-1 py-3"
          >
            Next hole →
          </button>
        )}
      </div>
      {s.score == null && (
        <p className="text-center text-xs text-gray-500">Select a score to continue.</p>
      )}
    </div>
  );
}
