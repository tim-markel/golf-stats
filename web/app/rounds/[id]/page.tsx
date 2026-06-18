"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { api, hazardLabel, RoundDetail, ScorecardHole } from "@/lib/api";

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
const ARROWS: Record<string, string> = { left: "←", right: "→", short: "↓", long: "↑" };

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

function HoleCard({ h }: { h: ScorecardHole }) {
  const term = scoreTerm(h.score, h.par);
  const played = h.score != null;

  const hb: string[] = [];
  if (h.hazards_hit.length)
    hb.push(`Hazard: ${h.hazards_hit.map((z) => hazardLabel(z, true)).join(", ")}`);
  if (h.balls_lost) hb.push(`Balls lost: ${h.balls_lost}`);

  const sub: string[] = [];
  if (h.beers) sub.push(`Beers: ${h.beers}`);
  if (h.nicotine) sub.push(`Nicotine: ${h.nicotine}`);
  if (h.weed) sub.push(`Weed: ${h.weed}`);

  return (
    <div className="card overflow-hidden text-ink">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-sm">
        <span className="font-bold">Hole {h.hole_number}</span>
        <span className="text-gray-400">Par {h.par}</span>
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

      {/* substances on the next row */}
      {sub.length > 0 && (
        <div className="px-3 py-1.5 text-center text-xs">{sub.join(" · ")}</div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold text-fairway">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

// Ordered buckets + colors (good → bad) for the distribution pies.
const PUTT_DEFS = [
  { name: "1 putt", color: "#1a7a4a" },
  { name: "2 putts", color: "#86b049" },
  { name: "3 putts", color: "#e0a93b" },
  { name: "4+ putts", color: "#d1495b" },
];
const SCORE_DEFS = [
  { name: "Eagle+", color: "#0b3d2e" },
  { name: "Birdie", color: "#1a7a4a" },
  { name: "Par", color: "#9ca3af" },
  { name: "Bogey", color: "#e0a93b" },
  { name: "Double", color: "#d97706" },
  { name: "Triple+", color: "#d1495b" },
];

function buildPie(
  defs: { name: string; color: string }[],
  counts: Record<string, number>
) {
  return defs
    .map((d) => ({ name: d.name, value: counts[d.name] || 0, color: d.color }))
    .filter((d) => d.value > 0);
}

function StatPie({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RoundScorecardPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getRound(id)
      .then(setRound)
      .catch(() => setError("Could not load this round."));
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!round) return <p className="text-gray-500">Loading…</p>;

  const front = round.holes.filter((h) => h.hole_number <= 9);
  const back = round.holes.filter((h) => h.hole_number > 9);
  const coursePar = round.holes.reduce((a, h) => a + h.par, 0);
  const t = round.totals;

  const holesCount = round.holes.length;
  const girCount = round.holes.filter((h) => h.gir).length;
  const fairwaysTotal = round.holes.filter((h) => h.par >= 4).length;
  const fairwaysHit = round.holes.filter((h) => h.driving_accuracy === "fairway").length;

  // distributions for the pies
  const puttCounts: Record<string, number> = {};
  const scoreCounts: Record<string, number> = {};
  round.holes.forEach((h) => {
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
    }
  });
  const scorePie = buildPie(SCORE_DEFS, scoreCounts);
  const puttPie = buildPie(PUTT_DEFS, puttCounts);

  function startEdit() {
    const d: Draft = {};
    round!.holes.forEach((h) => {
      d[h.hole_id] = { score: h.score?.toString() ?? "", putts: h.putts?.toString() ?? "" };
    });
    setDraft(d);
    setEditing(true);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{round.course_name}</h1>
          <p className="text-sm text-gray-500">
            {round.played_on}
            {round.tee_name ? ` · ${round.tee_name} tees` : ""}
            {round.time_of_day ? ` · ${round.time_of_day}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-fairway">{round.total_score ?? "–"}</div>
          <div className="text-sm text-gray-500">
            {relToPar(round.total_score, coursePar)} · par {coursePar}
          </div>
        </div>
      </div>

      {/* paper scorecard */}
      <section className="overflow-hidden rounded-xl border border-paper-line bg-paper shadow-card">
        <div className="flex items-center justify-between border-b border-paper-line px-4 py-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-ink/70">
            Scorecard
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
              ✏️ Edit scorecard
            </button>
          )}
        </div>
        <div className="space-y-2 p-2">
          <Nine holes={front} label="Out" editing={editing} draft={draft} setDraft={setDraft} />
          {back.length > 0 && (
            <Nine holes={back} label="In" editing={editing} draft={draft} setDraft={setDraft} />
          )}
        </div>
      </section>

      {/* hole-by-hole cards: 3 per row, vertical/stacked */}
      <section>
        <h2 className="mb-2 font-semibold">Hole by hole</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {round.holes.map((h) => (
            <HoleCard key={h.hole_id} h={h} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Round totals</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Summary label="GIR" value={`${girCount}/${holesCount}`} />
          <Summary
            label="Putts"
            value={round.total_putts != null ? String(round.total_putts) : "–"}
          />
          <Summary label="Fairways hit" value={`${fairwaysHit}/${fairwaysTotal}`} />
          {t.hazards > 0 && <Summary label="Hazards hit" value={String(t.hazards)} />}
          {t.balls_lost > 0 && <Summary label="Balls lost" value={String(t.balls_lost)} />}
          {t.beers > 0 && (
            <Summary
              label="Beers"
              value={`${t.beers}${t.beer_oz ? ` · ${t.beer_oz} oz` : ""}`}
            />
          )}
          {t.nicotine > 0 && <Summary label="Nicotine" value={String(t.nicotine)} />}
          {t.weed > 0 && <Summary label="Weed" value={String(t.weed)} />}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatPie title="Score distribution" data={scorePie} />
          <StatPie title="Putt distribution" data={puttPie} />
        </div>
      </section>
    </div>
  );
}
