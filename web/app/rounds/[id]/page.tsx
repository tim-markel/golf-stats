"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  ApproachAccuracy,
  Beer,
  DrivingAccuracy,
  Hazard,
  hazardLabel,
  HoleStatEdit,
  nicotineLabel,
  PenaltyStroke,
  RoundDetail,
  ScorecardHole,
  Tee,
  weedLabel,
} from "@/lib/api";
import StatTotals, { StatTotalsData } from "@/components/StatTotals";
import {
  BeerEntry,
  CountChoice,
  DirPad,
  GirControl,
  NicotineEntry,
  ScorePicker,
  WeedEntry,
} from "@/components/holeControls";

// --- score markers: birdie=1 circle, eagle=2 circles, bogey=1 square, dbl+=2 ---
function ScoreMark({
  score,
  par,
  lg = false,
}: {
  score: number | null;
  par: number;
  lg?: boolean;
}) {
  if (score == null) return <span className="text-ink/30">–</span>;
  const d = score - par;
  const n = Math.min(2, Math.abs(d));
  const shape = d < 0 ? "rounded-full" : "rounded-[3px]";
  const t = lg ? "text-lg font-semibold" : "text-sm";
  const single = lg ? "h-8 w-8" : "h-6 w-6";
  const outer = lg ? "h-9 w-9" : "h-7 w-7";
  const inner = lg ? "h-7 w-7" : "h-5 w-5";
  const num = <span className={`${t} leading-none`}>{score}</span>;
  if (n === 0)
    return <span className={`inline-flex ${single} items-center justify-center ${t}`}>{score}</span>;
  if (n === 1)
    return (
      <span
        className={`inline-flex ${single} items-center justify-center border-[1.5px] border-current ${shape}`}
      >
        {num}
      </span>
    );
  return (
    <span
      className={`inline-flex ${outer} items-center justify-center border-[1.5px] border-current ${shape}`}
    >
      <span
        className={`inline-flex ${inner} items-center justify-center border-[1.5px] border-current ${shape}`}
      >
        {num}
      </span>
    </span>
  );
}

// --- check / x / directional-arrow marks for the hole cards -------------------
const ARROWS: Record<string, string> = {
  left: "←",
  right: "→",
  short: "↓",
  long: "↑",
  long_left: "↖",
  long_right: "↗",
  short_left: "↙",
  short_right: "↘",
};

function Mark({ symbol, tone }: { symbol: string; tone: "good" | "bad" | "muted" }) {
  const cls =
    tone === "good" ? "text-fairway" : tone === "bad" ? "text-red-500" : "text-gray-300";
  return <span className={`text-lg font-bold ${cls}`}>{symbol}</span>;
}

function fairwayMark(v: string | null) {
  if (v == null) return <Mark symbol="–" tone="muted" />;
  if (v === "fairway") return <Mark symbol="✓" tone="good" />;
  return <Mark symbol={ARROWS[v] ?? "✗"} tone="bad" />;
}
function approachMark(v: string | null) {
  if (v == null) return <Mark symbol="–" tone="muted" />;
  if (v === "on") return <Mark symbol="✓" tone="good" />;
  return <Mark symbol={ARROWS[v] ?? "✗"} tone="bad" />;
}
// Missed GIR shows an X (only "–" when the hole has no score at all).
function girMark(gir: boolean | null, played: boolean) {
  if (!played) return <Mark symbol="–" tone="muted" />;
  return gir ? <Mark symbol="✓" tone="good" /> : <Mark symbol="✗" tone="bad" />;
}

function relToPar(total: number | null, par: number) {
  if (total == null) return "";
  const d = total - par;
  return d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`;
}

function scoreTerm(score: number | null, par: number): { text: string; tone: string } {
  if (score == null) return { text: "", tone: "" };
  if (score === 1) return { text: "Ace", tone: "text-fairway" };
  const d = score - par;
  const under = "text-fairway";
  const over = "text-red-600";
  if (d <= -3) return { text: "Albatross", tone: under };
  if (d === -2) return { text: "Eagle", tone: under };
  if (d === -1) return { text: "Birdie", tone: under };
  if (d === 0) return { text: "Par", tone: "text-gray-500" };
  if (d === 1) return { text: "Bogey", tone: over };
  if (d === 2) return { text: "Double Bogey", tone: over };
  if (d === 3) return { text: "Triple Bogey", tone: over };
  return { text: `+${d}`, tone: over };
}

type Draft = Record<number, { score: string; putts: string }>;

// --- one nine on the (paper) scorecard --------------------------------------
function Nine({
  holes,
  label,
  editing,
  draft,
  setDraft,
}: {
  holes: ScorecardHole[];
  label: string;
  editing: boolean;
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  const parSum = holes.reduce((a, h) => a + h.par, 0);
  const yardSum = holes.reduce((a, h) => a + (h.yards ?? 0), 0);
  const scoreSum = holes.every((h) => h.score == null)
    ? null
    : holes.reduce((a, h) => a + (h.score ?? 0), 0);

  const div = "border-l border-paper-line";
  const tot = "border-l-2 border-paper-line font-semibold";
  const row = "border-b border-paper-line";

  function update(holeId: number, field: "score" | "putts", value: string) {
    setDraft({ ...draft, [holeId]: { ...draft[holeId], [field]: value } });
  }
  const inputCls =
    "w-9 rounded border border-paper-line bg-white px-1 py-0.5 text-center text-ink outline-none focus:border-fairway";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-center text-sm text-ink">
        <tbody>
          <tr className={`${row} text-xs font-semibold uppercase tracking-wide text-ink/70`}>
            <td className="px-2 py-1 text-left">Hole</td>
            {holes.map((h) => (
              <td key={h.hole_id} className={`px-2 py-1 ${div}`}>
                {h.hole_number}
              </td>
            ))}
            <td className={`px-2 py-1 ${tot}`}>{label}</td>
          </tr>

          <tr className={`${row} text-ink/55`}>
            <td className="px-2 py-1 text-left text-xs">Yards</td>
            {holes.map((h) => (
              <td key={h.hole_id} className={`px-2 py-1 text-xs ${div}`}>
                {h.yards ?? "–"}
              </td>
            ))}
            <td className={`px-2 py-1 text-xs ${tot}`}>{yardSum || "–"}</td>
          </tr>

          <tr className={`${row} text-ink/80`}>
            <td className="px-2 py-1 text-left text-xs">Par</td>
            {holes.map((h) => (
              <td key={h.hole_id} className={`px-2 py-1 ${div}`}>
                {h.par}
              </td>
            ))}
            <td className={`px-2 py-1 ${tot}`}>{parSum}</td>
          </tr>

          <tr className={`${row} text-ink/45`}>
            <td className="px-2 py-1 text-left text-xs">Hdcp</td>
            {holes.map((h) => (
              <td key={h.hole_id} className={`px-2 py-1 text-xs ${div}`}>
                {h.stroke_index ?? "–"}
              </td>
            ))}
            <td className={`px-2 py-1 ${tot}`} />
          </tr>

          <tr>
            <td className="px-2 py-1 text-left text-xs font-medium">Score</td>
            {holes.map((h) => (
              <td key={h.hole_id} className={`px-1 py-1 ${div}`}>
                {editing ? (
                  <input
                    value={draft[h.hole_id]?.score ?? ""}
                    onChange={(e) => update(h.hole_id, "score", e.target.value)}
                    inputMode="numeric"
                    className={inputCls}
                  />
                ) : (
                  <ScoreMark score={h.score} par={h.par} />
                )}
              </td>
            ))}
            <td className={`px-2 py-1 ${tot} text-base`}>{scoreSum ?? "–"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- one card per hole (4 per row) ------------------------------------------
function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1.5 text-center">
      <div className="text-xs font-medium uppercase tracking-wide text-ink">{label}</div>
      <div className="leading-none">{children}</div>
    </div>
  );
}

function HoleCard({ h, onEdit }: { h: ScorecardHole; onEdit?: () => void }) {
  const term = scoreTerm(h.score, h.par);
  const played = h.score != null;

  const hb: string[] = [];
  if (h.hazards_hit.length)
    hb.push(`Hazard: ${h.hazards_hit.map((z) => hazardLabel(z, true)).join(", ")}`);
  if (h.balls_lost) hb.push(`Balls lost: ${h.balls_lost}`);

  // each metric on its own line; nicotine/weed broken down by type
  const sub: string[] = [];
  if (h.beers) sub.push(`Beers: ${h.beers}`);
  if (h.hotdogs) sub.push(`Hotdogs: ${h.hotdogs}`);
  if (h.nicotine.length)
    sub.push(h.nicotine.map((n) => `${nicotineLabel(n.type)}: ${n.quantity}`).join(" | "));
  if (h.weed.length)
    sub.push(
      h.weed
        .map((w) =>
          w.hits > 0 ? `${weedLabel(w.type)} hits: ${w.hits}` : `${weedLabel(w.type)}s: ${w.count}`
        )
        .join(" | ")
    );

  return (
    <div className="card overflow-hidden text-ink">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-sm">
        <span className="font-bold">Hole {h.hole_number}</span>
        <span className="flex items-center gap-2">
          <span className="text-gray-400">Par {h.par}</span>
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit hole stats"
              className="text-gray-400 hover:text-fairway"
            >
              ✏️
            </button>
          )}
        </span>
      </div>

      {/* number on the left, term on the right */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <ScoreMark score={h.score} par={h.par} lg />
        <span className="text-base font-semibold">{term.text}</span>
      </div>

      {/* fw (par 4/5 only) · gir · approach · putts on one row */}
      <div
        className={`grid ${
          h.par >= 4 ? "grid-cols-4" : "grid-cols-3"
        } divide-x divide-gray-100 border-b border-gray-100`}
      >
        {h.par >= 4 && <Mini label="FW">{fairwayMark(h.driving_accuracy)}</Mini>}
        <Mini label="GIR">{girMark(h.gir, played)}</Mini>
        <Mini label="App">{approachMark(h.approach_accuracy)}</Mini>
        <Mini label="Putts">
          <span className="text-base font-semibold">{h.putts ?? "–"}</span>
        </Mini>
      </div>

      {/* hazards + balls lost on a row, divided by a vertical line */}
      {hb.length > 0 && (
        <div
          className={`grid ${
            hb.length === 2 ? "grid-cols-2" : "grid-cols-1"
          } divide-x divide-gray-100 border-b border-gray-100`}
        >
          {hb.map((tx) => (
            <div key={tx} className="px-2 py-1.5 text-center text-xs">
              {tx}
            </div>
          ))}
        </div>
      )}

      {/* beers / nicotine / weed, each on its own line */}
      {sub.length > 0 && (
        <div className="space-y-0.5 px-3 py-1.5 text-center text-xs">
          {sub.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const HAZARDS: Hazard[] = [
  "water",
  "greenside_bunker",
  "fairway_bunker",
  "natural_area",
  "ob",
];

// Full per-hole stat editor (golf stats only; consumption is left as-is).
function HoleEditCard({
  hole,
  roundId,
  beerOptions,
  onSaved,
  onCancel,
}: {
  hole: ScorecardHole;
  roundId: number;
  beerOptions: Beer[];
  onSaved: (r: RoundDetail) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<HoleStatEdit>({
    score: hole.score,
    putts: hole.putts,
    driving_accuracy: (hole.driving_accuracy as DrivingAccuracy | null) ?? null,
    gir: hole.gir,
    approach_accuracy: (hole.approach_accuracy as ApproachAccuracy | null) ?? null,
    up_and_down: hole.up_and_down,
    penalty_locations: (hole.penalty_locations as PenaltyStroke[]) ?? [],
    penalty_strokes: hole.penalty_strokes ?? 0,
    hazards_hit: (hole.hazards_hit as Hazard[]) ?? [],
    balls_lost: hole.balls_lost ?? 0,
    hotdogs: hole.hotdogs ?? 0,
    nicotine: hole.nicotine.map((n) => ({ type: n.type, quantity: n.quantity })),
    weed: hole.weed_entries.map((w) => ({
      type: w.type,
      amount: w.amount,
      unit: w.unit,
    })),
    beers: hole.beer_entries.map((b) => ({
      beer_id: b.beer_id,
      name: b.name,
      abv: null,
      size_oz: b.size_oz,
    })),
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<HoleStatEdit>) => setD((prev) => ({ ...prev, ...p }));
  const showDriving = hole.par >= 4;

  async function save() {
    setSaving(true);
    try {
      onSaved(await api.updateHoleStat(roundId, hole.hole_id, d));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-4 border-2 border-fairway p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          Hole {hole.hole_number} <span className="text-gray-400">· Par {hole.par}</span>
        </h3>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary px-3 py-1">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel} className="btn-ghost px-3 py-1">
            Cancel
          </button>
        </div>
      </div>

      <ScorePicker par={hole.par} value={d.score} onChange={(v) => set({ score: v })} />

      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        {showDriving && (
          <DirPad
            label="Driving"
            layout="cross"
            value={d.driving_accuracy}
            onChange={(v) => set({ driving_accuracy: v as DrivingAccuracy | null })}
          />
        )}
        <DirPad
          label="Approach"
          layout="grid"
          value={d.approach_accuracy}
          onChange={(v) => set({ approach_accuracy: v as ApproachAccuracy | null })}
        />
        <GirControl
          gir={d.gir}
          upDown={d.up_and_down}
          onGir={(v) => set({ gir: v })}
          onUpDown={(v) => set({ up_and_down: v })}
        />
      </div>

      <CountChoice label="Putts" value={d.putts ?? 0} onChange={(v) => set({ putts: v })} />

      <div>
        <div className="mb-1 text-sm font-medium">Penalty</div>
        <div className="flex flex-wrap gap-1.5">
          {([["off_tee", "Off tee"], ["approach", "Approach"]] as const).map(([val, label]) => {
            const active = d.penalty_locations.includes(val);
            return (
              <button
                key={val}
                type="button"
                onClick={() =>
                  set({
                    penalty_locations: active
                      ? d.penalty_locations.filter((x) => x !== val)
                      : [...d.penalty_locations, val],
                  })
                }
                className={active ? "chip-on" : "chip-off"}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-2">
          <CountChoice
            label="Penalty strokes"
            value={d.penalty_strokes}
            onChange={(v) => set({ penalty_strokes: v })}
            min={1}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">Hazards hit</div>
        <div className="flex flex-wrap gap-1.5">
          {HAZARDS.map((h) => {
            const active = d.hazards_hit.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() =>
                  set({
                    hazards_hit: active
                      ? d.hazards_hit.filter((x) => x !== h)
                      : [...d.hazards_hit, h],
                  })
                }
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
        value={d.balls_lost}
        onChange={(v) => set({ balls_lost: v })}
        min={1}
      />
      <CountChoice
        label="Hotdogs"
        value={d.hotdogs}
        onChange={(v) => set({ hotdogs: v })}
        min={1}
      />
      <BeerEntry
        options={beerOptions}
        beers={d.beers}
        onChange={(b) => set({ beers: b })}
      />
      <NicotineEntry items={d.nicotine} onChange={(n) => set({ nicotine: n })} />
      <WeedEntry items={d.weed} onChange={(w) => set({ weed: w })} />
    </div>
  );
}

export default function RoundScorecardPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const router = useRouter();
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  // round metadata (date / tees / time of day) editing
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [tees, setTees] = useState<Tee[]>([]);
  const [meta, setMeta] = useState({ played_on: "", tee_id: "", time_of_day: "" });
  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [beerOptions, setBeerOptions] = useState<Beer[]>([]);

  useEffect(() => {
    api
      .getRound(id)
      .then(setRound)
      .catch(() => setError("Could not load this round."));
    api.listBeers().then(setBeerOptions).catch(() => {});
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!round) return <p className="text-gray-500">Loading…</p>;

  const front = round.holes.filter((h) => h.hole_number <= 9);
  const back = round.holes.filter((h) => h.hole_number > 9);
  const coursePar = round.holes.reduce((a, h) => a + h.par, 0);
  const t = round.totals;

  // WHS-style score differential: (113 / slope) × (score − rating). Only valid
  // for a full 18-hole round on a rated tee.
  const differential =
    round.holes.length === 18 &&
    round.total_score != null &&
    round.course_rating != null &&
    round.slope_rating != null
      ? (113 / round.slope_rating) * (round.total_score - round.course_rating)
      : null;

  const fairwaysTotal = round.holes.filter((h) => h.par >= 4).length;
  const fairwaysHit = round.holes.filter((h) => h.driving_accuracy === "fairway").length;
  const holesCount = round.holes.length;
  const girCount = round.holes.filter((h) => h.gir).length;
  const upDownsAttempts = round.holes.filter((h) => h.up_and_down != null).length;
  const upDownsMade = round.holes.filter((h) => h.up_and_down === true).length;

  // count buckets for the totals section (same shapes StatTotals expects)
  const approachCounts: Record<string, number> = {};
  const fwCounts: Record<string, number> = {};
  const puttCounts: Record<string, number> = {};
  const scoreCounts: Record<string, number> = {};
  const hazardByType: Record<string, number> = {};
  const nicByType: Record<string, number> = {};
  const weedByType: Record<string, number> = {};
  const parGroups: Record<number, number[]> = {};
  round.holes.forEach((h) => {
    if (h.approach_accuracy)
      approachCounts[h.approach_accuracy] = (approachCounts[h.approach_accuracy] || 0) + 1;
    if (h.par >= 4 && h.driving_accuracy)
      fwCounts[h.driving_accuracy] = (fwCounts[h.driving_accuracy] || 0) + 1;
    if (h.putts != null) {
      const k =
        h.putts <= 1 ? "1 putt" : h.putts === 2 ? "2 putts" : h.putts === 3 ? "3 putts" : "4+ putts";
      puttCounts[k] = (puttCounts[k] || 0) + 1;
    }
    if (h.score != null) {
      const d = h.score - h.par;
      const k =
        d <= -2 ? "Eagle+" : d === -1 ? "Birdie" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double" : "Triple+";
      scoreCounts[k] = (scoreCounts[k] || 0) + 1;
      (parGroups[h.par] = parGroups[h.par] || []).push(h.score);
    }
    h.hazards_hit.forEach((z) => {
      hazardByType[z] = (hazardByType[z] || 0) + 1;
    });
    h.nicotine.forEach((n) => {
      nicByType[n.type] = (nicByType[n.type] || 0) + n.quantity;
    });
    h.weed.forEach((w) => {
      weedByType[w.type] = (weedByType[w.type] || 0) + w.count;
    });
  });
  const parAverages = Object.keys(parGroups)
    .map(Number)
    .sort((a, b) => a - b)
    .map((par) => ({
      par,
      avg: parGroups[par].reduce((a, b) => a + b, 0) / parGroups[par].length,
    }));
  const puttsHoles = round.holes.filter((h) => h.putts != null).length;
  const avgPutts = puttsHoles && round.total_putts != null ? round.total_putts / puttsHoles : null;

  const totalsData: StatTotalsData = {
    hazardByType,
    nicByType,
    weedByType,
    ballsLost: t.balls_lost,
    penaltyStrokes: t.penalty_strokes,
    beers: t.beers,
    beerOz: t.beer_oz,
    weed: t.weed,
    hotdogs: t.hotdogs,
    approachCounts,
    girCount,
    holesCount,
    upDownsMade,
    upDownsAttempts,
    fwCounts,
    fairwaysHit,
    fairwaysTotal,
    scoreCounts,
    puttCounts,
    parAverages,
    totalPutts: round.total_putts,
    avgPutts,
  };

  function startEdit() {
    const d: Draft = {};
    round!.holes.forEach((h) => {
      d[h.hole_id] = { score: h.score?.toString() ?? "", putts: h.putts?.toString() ?? "" };
    });
    setDraft(d);
    setEditing(true);
  }

  async function startMetaEdit() {
    setMeta({
      played_on: round!.played_on,
      tee_id: round!.tee_id != null ? String(round!.tee_id) : "",
      time_of_day: round!.time_of_day ?? "",
    });
    setMetaEditing(true);
    if (tees.length === 0) {
      try {
        const course = await api.getCourse(round!.course_id);
        setTees(course.tees);
      } catch {
        /* leave the tee dropdown empty if the course fails to load */
      }
    }
  }

  async function saveMeta() {
    setMetaSaving(true);
    try {
      const fresh = await api.updateRound(id, {
        played_on: meta.played_on || undefined,
        tee_id: meta.tee_id === "" ? null : Number(meta.tee_id),
        time_of_day: meta.time_of_day === "" ? null : (meta.time_of_day as any),
      });
      setRound(fresh);
      setMetaEditing(false);
    } finally {
      setMetaSaving(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const updates = round!.holes.map((h) => ({
        hole_id: h.hole_id,
        score: draft[h.hole_id]?.score === "" ? null : Number(draft[h.hole_id].score),
        putts: draft[h.hole_id]?.putts === "" ? null : Number(draft[h.hole_id].putts),
      }));
      const fresh = await api.updateRoundHoleStats(id, updates);
      setRound(fresh);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="text-sm font-medium text-gray-500 hover:text-fairway"
      >
        ← Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{round.course_name}</h1>
          {metaEditing ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-gray-500">
                <span className="mb-0.5 block uppercase tracking-wide">Date</span>
                <input
                  type="date"
                  value={meta.played_on}
                  onChange={(e) => setMeta({ ...meta, played_on: e.target.value })}
                  className="input w-auto py-1 text-sm text-ink"
                />
              </label>
              <label className="text-xs text-gray-500">
                <span className="mb-0.5 block uppercase tracking-wide">Tees</span>
                <select
                  value={meta.tee_id}
                  onChange={(e) => setMeta({ ...meta, tee_id: e.target.value })}
                  className="input w-auto py-1 text-sm text-ink"
                >
                  <option value="">No tee</option>
                  {tees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-500">
                <span className="mb-0.5 block uppercase tracking-wide">Time</span>
                <select
                  value={meta.time_of_day}
                  onChange={(e) => setMeta({ ...meta, time_of_day: e.target.value })}
                  className="input w-auto py-1 text-sm text-ink"
                >
                  <option value="">—</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="twilight">Twilight</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button onClick={saveMeta} disabled={metaSaving} className="btn-primary px-3 py-1">
                  {metaSaving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setMetaEditing(false)} className="btn-ghost px-3 py-1">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="text-sm text-gray-500">
                {round.played_on}
                {round.tee_name ? ` · ${round.tee_name} tees` : ""}
                {round.time_of_day ? ` · ${round.time_of_day}` : ""}
              </p>
              <button onClick={startMetaEdit} className="btn-ghost px-2 py-0.5 text-xs">
                ✏️ Edit round
              </button>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-fairway">{round.total_score ?? "–"}</div>
          <div className="text-sm text-gray-500">
            {relToPar(round.total_score, coursePar)} · par {coursePar}
          </div>
          {differential != null && (
            <div className="text-xs text-gray-500">
              Differential{" "}
              <span className="font-semibold text-ink">{differential.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* paper scorecard */}
      <section className="overflow-hidden rounded-xl border border-paper-line bg-paper shadow-card">
        <div className="flex items-center justify-between border-b border-paper-line px-4 py-2">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-ink/70">
              Scorecard
            </span>
            {(round.course_rating != null || round.slope_rating != null) && (
              <span className="text-xs text-ink/50">
                {round.tee_name ? `${round.tee_name} · ` : ""}
                {round.course_rating != null ? `Rating ${round.course_rating}` : ""}
                {round.course_rating != null && round.slope_rating != null ? " · " : ""}
                {round.slope_rating != null ? `Slope ${round.slope_rating}` : ""}
              </span>
            )}
          </span>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving} className="btn-primary px-3 py-1">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-1">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={startEdit} className="btn-ghost px-3 py-1">
              ✏️ Edit stats
            </button>
          )}
        </div>
        <div className="space-y-2 p-2">
          {front.length > 0 && (
            <Nine holes={front} label="Out" editing={editing} draft={draft} setDraft={setDraft} />
          )}
          {back.length > 0 && (
            <Nine holes={back} label="In" editing={editing} draft={draft} setDraft={setDraft} />
          )}
        </div>
      </section>

      {/* hole-by-hole cards: 3 per row, vertical/stacked */}
      <section>
        <h2 className="mb-1 font-semibold">Hole by hole</h2>
        <p className="mb-2 text-xs text-gray-400">Tap ✏️ on a hole to edit its stats.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {round.holes.map((h) =>
            editingHole === h.hole_id ? (
              <div key={h.hole_id} className="col-span-full">
                <HoleEditCard
                  hole={h}
                  roundId={id}
                  beerOptions={beerOptions}
                  onSaved={(fresh) => {
                    setRound(fresh);
                    setEditingHole(null);
                  }}
                  onCancel={() => setEditingHole(null)}
                />
              </div>
            ) : (
              <HoleCard
                key={h.hole_id}
                h={h}
                onEdit={() => setEditingHole(h.hole_id)}
              />
            )
          )}
        </div>
      </section>

      <StatTotals title="Round totals" data={totalsData} />
    </div>
  );
}
