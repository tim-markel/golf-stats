"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { api, GolferStats, PracticeSession, SeasonStats } from "@/lib/api";
import StatTotals, { StatTotalsData } from "@/components/StatTotals";
import RoundsCalendar from "@/components/RoundsCalendar";

// Distribution of 18-hole round totals, one bar per score, filling gaps so the
// bar chart runs continuously from the lowest to the highest score.
function binScores(scores: number[]): { name: string; value: number }[] {
  if (scores.length === 0) return [];
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const bins: { name: string; value: number }[] = [];
  for (let score = lo; score <= hi; score += 1) {
    bins.push({
      name: String(score),
      value: scores.filter((x) => x === score).length,
    });
  }
  return bins;
}

// Map the season endpoint payload onto the shared StatTotals data shape.
function seasonToTotals(s: SeasonStats): StatTotalsData {
  return {
    hazardByType: s.hazard_by_type,
    nicByType: s.nicotine_by_type,
    weedByType: s.weed_by_type,
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
    roundScoreBins: binScores(s.round_scores),
    roundScoreStats: s.round_scores.length
      ? {
          low: Math.min(...s.round_scores),
          high: Math.max(...s.round_scores),
          avg: s.round_scores.reduce((a, b) => a + b, 0) / s.round_scores.length,
        }
      : undefined,
    puttsVsScore: s.putts_vs_score.map((p) => ({ putts: p.putts, score: p.score })),
    girVsScore: s.gir_vs_score.map((p) => ({ x: p.count, score: p.score })),
    fwVsScore: s.fw_vs_score.map((p) => ({ x: p.count, score: p.score })),
    girParPct: s.gir_par_pct,
    fwParPct: s.fw_par_pct,
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
        <div className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 hidden w-60 -translate-x-1/2 rounded-lg border border-black/10 bg-white p-2.5 text-left text-xs font-normal normal-case leading-snug text-gray-600 shadow-card group-hover:block">
          {info}
        </div>
      )}
    </div>
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
  const [data, setData] = useState<GolferStats | null>(null);
  const [season, setSeason] = useState<SeasonStats | null>(null);
  const [practice, setPractice] = useState<PracticeSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Scores-by-round chart: show ~10 bars, scroll horizontally for the rest.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(0);

  function startNewRound() {
    router.push("/rounds/new");
  }

  useEffect(() => {
    api
      .golferStats(id)
      .then(setData)
      .catch(() => setError("Could not load stats."));
    api.golferSeason(id).then(setSeason).catch(() => {});
    api.listPractice(id).then(setPractice).catch(() => {});
  }, [id]);

  // measure the visible chart width (10 bars fit across it)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setChartW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // start scrolled to the most recent round (far right)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data, chartW]);

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

  // ~13 bars fill the viewport; more rounds overflow into a horizontal scroll
  const VISIBLE_BARS = 13;
  const perBar = chartW ? chartW / VISIBLE_BARS : 0;
  const needScroll = chartData.length > VISIBLE_BARS && perBar > 0;
  const innerWidth = needScroll ? Math.round(perBar * chartData.length) : undefined;
  // fixed y-domain 0–100 with 25-stroke ticks; shared so the pinned axis lines
  // up with the scrolling bars
  const Y_TICKS = [0, 25, 50, 75, 100];

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
          info="Unofficial WHS-style estimate. Each 18-hole round's score differential = (113 ÷ slope) × (adjusted gross − course rating), where adjusted gross caps every hole at net double bogey (par + 2 + strokes received). The index averages the best 8 of your last 20 differentials (fewer when you have under 20), truncated to a tenth. It does not combine 9-hole rounds or apply GHIN's playing-conditions adjustment, caps, or official ratings, so it can differ from GHIN by a few tenths. Not an official USGA/GHIN handicap."
        />
        <StatCard label="Avg score" value={fmt(data.avg_score)} />
        <StatCard label="Rounds" value={String(data.rounds_played)} />
      </div>

      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Scores by round</h2>
          {needScroll && (
            <span className="text-xs text-gray-400">← scroll for older</span>
          )}
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">No rounds logged yet.</p>
        ) : (
          <div className="flex">
            {/* pinned y-axis: stays put while the bars scroll */}
            <div className="shrink-0" style={{ width: 34, height: 280 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <YAxis
                    width={34}
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    ticks={Y_TICKS}
                  />
                  <Bar dataKey="score" fill="transparent" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-x-auto">
              <div style={{ width: needScroll ? innerWidth : "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={[0, 100]} ticks={Y_TICKS} />
                    <Tooltip
                      content={<ScoreTooltip />}
                      cursor={{ fill: "rgba(21,102,63,0.06)" }}
                    />
                    <Bar
                      dataKey="score"
                      fill="#15663f"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
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
              </div>
            </div>
          </div>
        )}
      </section>

      {season && season.holes_played > 0 && (
        <StatTotals title="Season totals" data={seasonToTotals(season)} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
      <section className="card">
        <h2 className="border-b px-4 py-3 font-semibold">Rounds</h2>
        <ul className="max-h-80 divide-y overflow-y-auto">
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
                    <div className="font-semibold">
                      {r.total_score ?? "—"}{" "}
                      <span className="text-gray-400">({r.holes_played})</span>
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
      <RoundsCalendar rounds={data.rounds} practice={practice} />
      </div>
    </div>
  );
}
