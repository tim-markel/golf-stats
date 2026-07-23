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
} from "@/lib/api";
import Combobox from "@/components/Combobox";
import {
  BeerEntry,
  CountChoice,
  DirPad,
  GirControl,
  HAZARDS,
  NicotineEntry,
  ScorePicker,
  scoreMark,
  Seg,
  WeedEntry,
} from "@/components/holeControls";
import { useGolfer } from "@/lib/golfer-context";

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
    hotdogs: 0,
    nicotine: [],
    weed: [],
    beers: [],
  };
}

// Running scorecard for the holes being played, above the entry card. For an
// 18-hole round it shows Out / In subtotals like a paper scorecard.
type MiniCol =
  | { kind: "hole"; h: { id: number; hole_number: number; par: number }; i: number }
  | { kind: "out" }
  | { kind: "in" }
  | { kind: "tot" };

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

  const hasBoth =
    holes.some((h) => h.hole_number <= 9) && holes.some((h) => h.hole_number > 9);
  const parFront = holes.reduce((a, h) => a + (h.hole_number <= 9 ? h.par : 0), 0);
  const parBack = holes.reduce((a, h) => a + (h.hole_number > 9 ? h.par : 0), 0);
  const scFront = holes.reduce((a, h, i) => a + (h.hole_number <= 9 ? stats[i]?.score ?? 0 : 0), 0);
  const scBack = holes.reduce((a, h, i) => a + (h.hole_number > 9 ? stats[i]?.score ?? 0 : 0), 0);

  // build the column order: holes, with Out after #9 and In at the end
  const cols: MiniCol[] = [];
  holes.forEach((h, i) => {
    cols.push({ kind: "hole", h, i });
    if (hasBoth && h.hole_number === 9) cols.push({ kind: "out" });
  });
  if (hasBoth) cols.push({ kind: "in" });
  cols.push({ kind: "tot" });

  const subLabel = { out: "Out", in: "In", tot: "Tot" } as const;
  const parOf = (k: "out" | "in" | "tot") =>
    k === "out" ? parFront : k === "in" ? parBack : parFront + parBack;
  const scOf = (k: "out" | "in" | "tot") =>
    k === "out" ? scFront : k === "in" ? scBack : scFront + scBack;

  return (
    <div className="overflow-x-auto rounded-xl border border-paper-line bg-paper p-2">
      <table className="w-full min-w-[480px] text-center text-xs text-ink">
        <tbody>
          <tr className={`${row} font-semibold uppercase tracking-wide text-ink/70`}>
            <td className="px-1 py-1 text-left">Hole</td>
            {cols.map((c, k) =>
              c.kind === "hole" ? (
                <td
                  key={k}
                  className={`px-1 py-1 ${div} ${c.i === current ? "text-fairway" : ""}`}
                >
                  {c.h.hole_number}
                </td>
              ) : (
                <td key={k} className={`px-1 py-1 ${tot}`}>
                  {subLabel[c.kind]}
                </td>
              )
            )}
          </tr>
          <tr className={`${row} text-ink/70`}>
            <td className="px-1 py-1 text-left">Par</td>
            {cols.map((c, k) =>
              c.kind === "hole" ? (
                <td key={k} className={`px-1 py-1 ${div}`}>
                  {c.h.par}
                </td>
              ) : (
                <td key={k} className={`px-1 py-1 font-semibold ${tot}`}>
                  {parOf(c.kind)}
                </td>
              )
            )}
          </tr>
          <tr>
            <td className="px-1 py-1 text-left">Score</td>
            {cols.map((c, k) =>
              c.kind === "hole" ? (
                <td
                  key={k}
                  className={`px-1 py-1 ${div} ${c.i === current ? "bg-fairway/10" : ""}`}
                >
                  {stats[c.i]?.score != null ? scoreMark(stats[c.i].score as number, c.h.par) : "·"}
                </td>
              ) : (
                <td key={k} className={`px-1 py-1 font-bold ${tot}`}>
                  {scOf(c.kind) || ""}
                </td>
              )
            )}
          </tr>
        </tbody>
      </table>
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

  // Adding a missing course via the web scraper.
  const [scraping, setScraping] = useState(false);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);

  useEffect(() => {
    api.listCourses().then(setCourses).catch(() => {});
    api.listBeers().then(setBeerOptions).catch(() => {});
    // Pre-select a course when arriving from Explore (/rounds/new?course=<id>).
    const fromUrl = new URLSearchParams(window.location.search).get("course");
    if (fromUrl) setCourseId(Number(fromUrl));
  }, []);

  async function addCourse(name: string) {
    if (scraping) return;
    setScraping(true);
    setScrapeErr(null);
    try {
      const created = await api.scrapeCourse(name);
      setCourses(await api.listCourses());
      setCourseId(created.id); // select the newly added course
    } catch (e) {
      setScrapeErr(e instanceof Error ? e.message : "Could not add that course.");
    } finally {
      setScraping(false);
    }
  }

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
            placeholder="Search courses…"
            options={courses.map((c) => ({
              value: String(c.id),
              label: c.name,
              sublabel: [
                [c.city, c.state].filter(Boolean).join(", "),
                `${c.holes_count} holes`,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
            onAddNew={addCourse}
            addNewHint="Include the city and state (e.g. “Lansing, MI”), and the specific course if the facility has more than one."
          />
          <p className="mt-1 text-xs text-gray-400">
            Not listed? Type it — include the city and state — and choose “Add
            via web search”. For a facility with multiple courses, name the
            specific one (e.g. “Mountain Dell Canyon, Salt Lake City, UT”).
          </p>
          {scraping && (
            <p className="mt-2 text-sm text-gray-500">
              🔎 Searching the web and adding the course… this can take up to a
              minute.
            </p>
          )}
          {scrapeErr && <p className="mt-2 text-sm text-red-600">{scrapeErr}</p>}
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ScorePicker
              par={hole.par}
              value={s.score}
              onChange={(v) => patch(current, { score: v })}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40"
            >
              Prev Hole
            </button>
            <button
              type="button"
              disabled={s.score == null || submitting}
              onClick={isLast ? submit : goNext}
              className="rounded-md border border-fairway bg-fairway px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {isLast ? (submitting ? "Saving…" : "Save & Finish") : "Next Hole"}
            </button>
          </div>
        </div>

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
        <CountChoice
          label="Hotdogs"
          value={s.hotdogs}
          onChange={(v) => patch(current, { hotdogs: v })}
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
