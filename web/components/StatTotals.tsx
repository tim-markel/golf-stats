"use client";

// Shared "totals" section — the tile grid + dispersion targets + score/putt
// distributions. Used for a single round (Round totals) and for a golfer's
// whole season (Season totals) so both render with identical style and titles.

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { hazardLabel, nicotineLabel, weedLabel } from "@/lib/api";

export interface StatTotalsData {
  hazardByType: Record<string, number>;
  nicByType: Record<string, number>;
  weedByType: Record<string, number>;
  ballsLost: number;
  penaltyStrokes: number;
  beers: number;
  beerOz: number;
  weed: number;
  hotdogs: number;
  approachCounts: Record<string, number>;
  girCount: number;
  holesCount: number;
  upDownsMade: number;
  upDownsAttempts: number;
  fwCounts: Record<string, number>;
  fairwaysHit: number;
  fairwaysTotal: number;
  scoreCounts: Record<string, number>;
  puttCounts: Record<string, number>;
  parAverages: { par: number; avg: number }[];
  totalPutts: number | null;
  avgPutts: number | null;
  // when set (season totals), the putt side shows Avg/round instead of Total
  puttAvgPerRound?: number | null;
  // when set (season totals), adds a round-score distribution chart
  roundScoreBins?: { name: string; value: number }[];
  roundScoreStats?: { low: number; high: number; avg: number };
  // when set (season totals), adds a putts-vs-score scatter plot
  puttsVsScore?: { putts: number; score: number }[];
  // season-only: GIR/fairways-vs-score scatters + par-or-better conversion %.
  // girVsScore being defined switches StatTotals into the season layout.
  girVsScore?: { x: number; score: number }[];
  fwVsScore?: { x: number; score: number }[];
  girParPct?: number | null;
  fwParPct?: number | null;
}

// Tile with the headline on top and a single big value below (e.g. Beers).
function HeadlineTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="text-2xl font-bold text-fairway">{value}</div>
    </div>
  );
}

// Tile with the headline on top and a per-type breakdown laid out like the
// putt-distribution totals / score averages (small label over a bold value).
function BreakdownTile({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              {it.label}
            </div>
            <div className="text-lg font-bold text-fairway">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Colorblind-friendly palette (Okabe-Ito).
const CB = {
  blue: "#0072B2",
  green: "#009E73",
  gray: "#999999",
  orange: "#E69F00",
  vermillion: "#D55E00",
  purple: "#CC79A7",
  sky: "#56B4E9",
};

const PUTT_DEFS = [
  { name: "1 putt", color: CB.green },
  { name: "2 putts", color: CB.sky },
  { name: "3 putts", color: CB.orange },
  { name: "4+ putts", color: CB.vermillion },
];
const SCORE_DEFS = [
  { name: "Eagle+", color: CB.blue },
  { name: "Birdie", color: CB.green },
  { name: "Par", color: CB.gray },
  { name: "Bogey", color: CB.orange },
  { name: "Double", color: CB.vermillion },
  { name: "Triple+", color: CB.purple },
];
function buildPie(
  defs: { name: string; color: string }[],
  counts: Record<string, number>
) {
  return defs
    .map((d) => ({ name: d.name, value: counts[d.name] || 0, color: d.color }))
    .filter((d) => d.value > 0);
}

function StatBar({
  title,
  data,
  side,
}: {
  title: string;
  data: { name: string; value: number }[];
  side?: React.ReactNode;
}) {
  if (data.length === 0) return null;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
      <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-card">
        <div className="font-semibold">{label}</div>
        <div className="font-bold text-fairway">{Math.round((v / total) * 100)}%</div>
        <div className="text-xs text-gray-500">
          {v} of {total}
        </div>
      </div>
    );
  };
  const chart = (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: -22, right: 8, top: 18 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip content={<Tip />} cursor={{ fill: "rgba(21,102,63,0.06)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} fill="#1a7a4a">
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: any) => (v ? v : "")}
            style={{ fontSize: 12, fontWeight: 600, fill: "#16201b" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  return (
    <div className="card p-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {side ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">{chart}</div>
          {side}
        </div>
      ) : (
        chart
      )}
    </div>
  );
}

// A spatial "target": a 3x3 grid where each cell is a landing zone (center =
// on target). Cell shade scales with how often shots landed there. A summary
// (GIR / FW count) sits beside it.
const APPROACH_LAYOUT = [
  "long_left", "long", "long_right",
  "left", "on", "right",
  "short_left", "short", "short_right",
];
const DRIVING_LAYOUT = [
  null, "long", null,
  "left", "fairway", "right",
  null, "short", null,
];

function DispersionTarget({
  title,
  layout,
  centerKey,
  centerLabel,
  counts,
  summaryLabel,
  summaryValue,
}: {
  title: string;
  layout: (string | null)[];
  centerKey: string;
  centerLabel: string;
  counts: Record<string, number>;
  summaryLabel: string;
  summaryValue: string;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const maxPct = Math.max(...layout.filter(Boolean).map((k) => counts[k!] || 0)) / total || 1;

  return (
    <div className="card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex items-center justify-between gap-4">
        <div className="grid w-40 shrink-0 grid-cols-3 gap-1">
          {layout.map((key, i) => {
            if (key == null) return <div key={i} className="aspect-square" />;
            const count = counts[key] || 0;
            const frac = count / total;
            const pct = Math.round(frac * 100);
            const center = key === centerKey;
            const alpha = pct === 0 ? 0 : 0.18 + 0.5 * (frac / maxPct);
            return (
              <div
                key={i}
                className={`group relative flex aspect-square items-center justify-center rounded text-xs font-semibold ${
                  center ? "ring-2 ring-fairway" : ""
                } ${pct === 0 ? "bg-gray-50 text-gray-400" : "text-ink"}`}
                style={pct === 0 ? undefined : { background: `rgba(26,122,74,${alpha})` }}
              >
                {pct}%
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
                  {count} {count === 1 ? "shot" : "shots"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 px-2 text-center">
          <div className="text-xs uppercase tracking-wide text-gray-500">{summaryLabel}</div>
          <div className="text-2xl font-bold text-fairway">{summaryValue}</div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-400">
        center = {centerLabel} · ▲ long ▼ short ◀ left ▶ right
      </p>
    </div>
  );
}

// A metric (x) vs total score (y) for 18-hole rounds — one green dot per round.
function ScatterCard({
  title,
  data,
  xName,
  side,
}: {
  title: string;
  data: { x: number; score: number }[];
  xName: string;
  side?: React.ReactNode;
}) {
  if (data.length === 0) return null;
  const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-card">
        <div className="font-bold text-fairway">Score {p.score}</div>
        <div className="text-xs text-gray-500">
          {p.x} {xName.toLowerCase()}
        </div>
      </div>
    );
  };
  const chart = (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ left: -18, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name={xName}
          domain={["auto", "auto"]}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="score"
          name="Score"
          domain={["auto", "auto"]}
          allowDecimals={false}
          tick={{ fontSize: 12 }}
        />
        <ZAxis range={[55, 55]} />
        <Tooltip content={<Tip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill="#15663f" fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
  return (
    <div className="card p-4">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {side ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">{chart}</div>
          {side}
        </div>
      ) : (
        chart
      )}
    </div>
  );
}

// Side stat used inside the scatter cards (matches the bar-chart side stats).
function PctSide({ top, label, pct }: { top: string; label: string; pct: number }) {
  return (
    <div className="shrink-0 space-y-1.5 px-1 text-center">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{top}</div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-lg font-bold text-fairway">{Math.round(pct)}%</div>
      </div>
    </div>
  );
}

export default function StatTotals({
  title,
  data,
}: {
  title: string;
  data: StatTotalsData;
}) {
  const hazardsTotal = Object.values(data.hazardByType).reduce((a, b) => a + b, 0);
  const nicotineTotal = Object.values(data.nicByType).reduce((a, b) => a + b, 0);
  const hazardItems = Object.entries(data.hazardByType)
    .sort((a, b) => b[1] - a[1])
    .map(([z, n]) => ({ label: hazardLabel(z, true), value: String(n) }));
  const nicItems = Object.entries(data.nicByType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => ({ label: nicotineLabel(t), value: String(n) }));
  const weedTotal = Object.values(data.weedByType).reduce((a, b) => a + b, 0);
  const weedItems = Object.entries(data.weedByType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => ({ label: weedLabel(t), value: String(n) }));
  const scorePie = buildPie(SCORE_DEFS, data.scoreCounts);
  const puttPie = buildPie(PUTT_DEFS, data.puttCounts);

  // balls lost + penalty strokes share one tile
  const troubleItems = [
    ...(data.ballsLost > 0 ? [{ label: "Balls lost", value: String(data.ballsLost) }] : []),
    ...(data.penaltyStrokes > 0
      ? [{ label: "Penalty strokes", value: String(data.penaltyStrokes) }]
      : []),
  ];

  const approachTile = (
    <DispersionTarget
      title="Approach"
      layout={APPROACH_LAYOUT}
      centerKey="on"
      centerLabel="green hit"
      counts={data.approachCounts}
      summaryLabel="GIR"
      summaryValue={`${data.girCount}/${data.holesCount}`}
    />
  );
  const fairwaysTile = (
    <DispersionTarget
      title="Fairways"
      layout={DRIVING_LAYOUT}
      centerKey="fairway"
      centerLabel="FW hit"
      counts={data.fwCounts}
      summaryLabel="FW"
      summaryValue={`${data.fairwaysHit}/${data.fairwaysTotal}`}
    />
  );
  const scoreDistTile =
    data.roundScoreBins && data.roundScoreBins.length > 0 ? (
      <StatBar
        title="Score Distribution"
        data={data.roundScoreBins}
        side={
          data.roundScoreStats ? (
            <div className="shrink-0 space-y-1.5 px-1 text-center">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Low</div>
                <div className="text-lg font-bold text-fairway">{data.roundScoreStats.low}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Avg</div>
                <div className="text-lg font-bold text-fairway">
                  {data.roundScoreStats.avg.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">High</div>
                <div className="text-lg font-bold text-fairway">{data.roundScoreStats.high}</div>
              </div>
            </div>
          ) : undefined
        }
      />
    ) : null;
  const holeScoreTile = (
    <StatBar
      title="Hole Score Distribution"
      data={scorePie}
      side={
        data.parAverages.length ? (
          <div className="shrink-0 space-y-1.5 px-1 text-center">
            {data.parAverages.map((p) => (
              <div key={p.par}>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Par {p.par}
                </div>
                <div className="text-lg font-bold text-fairway">{p.avg.toFixed(1)}</div>
              </div>
            ))}
          </div>
        ) : undefined
      }
    />
  );
  const puttDistTile = (
    <StatBar
      title="Putt distribution"
      data={puttPie}
      side={
        data.totalPutts != null ? (
          <div className="shrink-0 space-y-1.5 px-1 text-center">
            {data.puttAvgPerRound != null ? (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Avg/round</div>
                <div className="text-lg font-bold text-fairway">
                  {data.puttAvgPerRound.toFixed(1)}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
                <div className="text-lg font-bold text-fairway">{data.totalPutts}</div>
              </div>
            )}
            {data.avgPutts != null && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Avg/hole</div>
                <div className="text-lg font-bold text-fairway">{data.avgPutts.toFixed(1)}</div>
              </div>
            )}
          </div>
        ) : undefined
      }
    />
  );
  const puttsScatter =
    data.puttsVsScore && data.puttsVsScore.length > 0 ? (
      <ScatterCard
        title="Putts vs Score"
        xName="Putts"
        data={data.puttsVsScore.map((p) => ({ x: p.putts, score: p.score }))}
      />
    ) : null;

  const isSeason = data.girVsScore !== undefined;

  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>

      {isSeason ? (
        <div className="space-y-3">
          {/* score distributions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scoreDistTile}
            {holeScoreTile}
          </div>
          {/* greens: dispersion + GIR-vs-score (with par-or-better conversion) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {approachTile}
            {data.girVsScore && data.girVsScore.length > 0 && (
              <ScatterCard
                title="GIR vs Score"
                xName="GIR"
                data={data.girVsScore}
                side={
                  data.girParPct != null ? (
                    <PctSide top="Green Hit" label="Par or better" pct={data.girParPct} />
                  ) : undefined
                }
              />
            )}
          </div>
          {/* fairways: dispersion + FW-vs-score (with par-or-better conversion) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fairwaysTile}
            {data.fwVsScore && data.fwVsScore.length > 0 && (
              <ScatterCard
                title="Fairways vs Score"
                xName="Fairways"
                data={data.fwVsScore}
                side={
                  data.fwParPct != null ? (
                    <PctSide top="Fairway hit" label="Par or better" pct={data.fwParPct} />
                  ) : undefined
                }
              />
            )}
          </div>
          {/* putts */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {puttDistTile}
            {puttsScatter}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {approachTile}
          {fairwaysTile}
          {scoreDistTile}
          {holeScoreTile}
          {puttDistTile}
          {puttsScatter}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {hazardsTotal > 0 && <BreakdownTile title="Hazards hit" items={hazardItems} />}
        {troubleItems.length > 0 && (
          <BreakdownTile title="Penalties" items={troubleItems} />
        )}
        {data.beers > 0 && (
          <HeadlineTile
            title="Beers"
            value={`${data.beers}${data.beerOz ? ` · ${data.beerOz} oz` : ""}`}
          />
        )}
        {nicotineTotal > 0 && <BreakdownTile title="Nicotine" items={nicItems} />}
        {data.upDownsAttempts > 0 && (
          <HeadlineTile
            title="Up & downs"
            value={`${data.upDownsMade}/${data.upDownsAttempts} · ${Math.round(
              (data.upDownsMade / data.upDownsAttempts) * 100
            )}%`}
          />
        )}
        {weedTotal > 0 && <BreakdownTile title="Weed" items={weedItems} />}
        {data.hotdogs > 0 && <HeadlineTile title="Hotdogs" value={String(data.hotdogs)} />}
      </div>
    </section>
  );
}
