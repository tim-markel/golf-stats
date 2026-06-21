"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, GolferStats, SeasonStats } from "@/lib/api";
import StatTotals, { StatTotalsData } from "@/components/StatTotals";
import { useGolfer } from "@/lib/golfer-context";

// Map the season endpoint payload onto the shared StatTotals data shape.
function seasonToTotals(s: SeasonStats): StatTotalsData {
  return {
    hazardByType: s.hazard_by_type,
    nicByType: s.nicotine_by_type,
    ballsLost: s.balls_lost,
    penaltyStrokes: s.penalty_strokes,
    beers: s.beers,
    beerOz: s.beer_oz,
    weed: s.weed,
    hotdogs: s.hotdogs,
    approachCounts: s.approach_counts,
    girCount: s.gir_count,
    holesCount: s.holes_played,
    upDownsMade: s.up_downs_made,
    upDownsAttempts: s.up_downs_attempts,
    fwCounts: s.fw_counts,
    fairwaysHit: s.fairways_hit,
    fairwaysTotal: s.fairways_total,
    scoreCounts: s.score_counts,
    puttCounts: s.putt_counts,
    parAverages: s.par_averages,
    totalPutts: s.putt_holes ? s.total_putts : null,
    avgPutts: s.putt_holes ? s.total_putts / s.putt_holes : null,
    puttAvgPerRound: s.putt_avg_per_round,
  };
}

function StatCard({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info?: string;
}) {
  return (
    <div className="group relative card p-4 text-center">
      <div className="text-2xl font-bold text-fairway">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
        {info && <span className="ml-0.5 text-gray-400">ⓘ</span>}
      </div>
      {info && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-60 -translate-x-1/2 rounded-lg border border-black/10 bg-white p-2.5 text-left text-xs font-normal normal-case leading-snug text-gray-600 shadow-card group-hover:block">
          {info}
        </div>
      )}
    </div>
  );
}

// X-axis tick: course name on top, date underneath.
function CourseDateTick(props: any) {
  const { x, y, payload, data } = props;
  const item = data[payload.index];
  if (!item) return null;
  const name =
    item.label.length > 12 ? item.label.slice(0, 11) + "…" : item.label;
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" y={12} fontSize={11} fill="#4b5563">
        {name}
      </text>
      <text textAnchor="middle" y={26} fontSize={10} fill="#9ca3af">
        {item.date}
      </text>
    </g>
  );
}

// Hover popup shown above the bar.
function ScoreTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-card">
      <div className="font-semibold">{p.label}</div>
      <div className="text-xs text-gray-500">{p.date}</div>
      <div className="mt-1 font-bold text-fairway">Score: {p.score ?? "—"}</div>
      <div className="mt-1 text-xs text-gray-400">Click to open scorecard</div>
    </div>
  );
}

export default function GolferStatsPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const router = useRouter();
  const { setActive } = useGolfer();
  const [data, setData] = useState<GolferStats | null>(null);
  const [season, setSeason] = useState<SeasonStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startNewRound() {
    setActive(id); // the round will be for this golfer
    router.push("/rounds/new");
  }

  useEffect(() => {
    api
      .golferStats(id)
      .then(setData)
      .catch(() => setError("Could not load stats."));
    api.golferSeason(id).then(setSeason).catch(() => {});
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  const fmt = (n: number | null, suffix = "") =>
    n == null ? "—" : `${n.toFixed(1)}${suffix}`;

  const chartData = data.rounds.map((r) => ({
    round_id: r.round_id,
    label: r.course_name,
    date: r.played_on,
    score: r.total_score,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{data.golfer.name}</h1>
          <p className="text-sm text-gray-500">
            {data.golfer.handicap != null
              ? `Handicap ${data.golfer.handicap} · `
              : ""}
            {data.rounds_played} round{data.rounds_played === 1 ? "" : "s"}
          </p>
        </div>
        <button onClick={startNewRound} className="btn-primary shrink-0">
          + New round
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Hcp index"
          value={fmt(data.handicap_index)}
          info="Estimated handicap index — the average of your best recent score differentials. Each round's differential = (113 ÷ slope) × (score − course rating), using your tee's slope/rating. Uses the best of your last 20 rated 18-hole rounds (WHS-style). Not an official USGA/GHIN handicap."
        />
        <StatCard label="Avg score" value={fmt(data.avg_score)} />
        <StatCard label="Rounds" value={String(data.rounds_played)} />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Scores by round</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">No rounds logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval={0}
                height={44}
                tickLine={false}
                tick={<CourseDateTick data={chartData} />}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                content={<ScoreTooltip />}
                cursor={{ fill: "rgba(21,102,63,0.06)" }}
              />
              <Bar
                dataKey="score"
                fill="#15663f"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
                cursor="pointer"
                onClick={(d: any) => {
                  const rid = d?.round_id ?? d?.payload?.round_id;
                  if (rid) router.push(`/rounds/${rid}`);
                }}
              >
                <LabelList
                  dataKey="score"
                  position="top"
                  fontSize={12}
                  fontWeight={600}
                  fill="#15663f"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {season && season.holes_played > 0 && (
        <StatTotals title="Season totals" data={seasonToTotals(season)} />
      )}

      <section className="card">
        <h2 className="border-b px-4 py-3 font-semibold">Rounds</h2>
        <ul className="divide-y">
          {data.rounds
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.round_id}>
                <Link
                  href={`/rounds/${r.round_id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-fairway-light"
                >
                  <div>
                    <div className="font-medium">{r.course_name}</div>
                    <div className="text-gray-500">{r.played_on}</div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="font-semibold">
                        {r.total_score ?? "—"}{" "}
                        <span className="text-gray-400">({r.holes_played})</span>
                      </div>
                      <div className="text-gray-500">
                        {r.total_putts ?? "—"} putts
                        {r.beers_finished ? ` · ${r.beers_finished} 🍺` : ""}
                      </div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              </li>
            ))}
          {data.rounds.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No rounds yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
