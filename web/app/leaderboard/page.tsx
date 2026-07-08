"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, Leaderboard, ViceRow } from "@/lib/api";

const fmt = (n: number | null, suffix = "") =>
  n == null ? "—" : `${n.toFixed(1)}${suffix}`;
const MEDAL = ["🥇", "🥈", "🥉"];

// Sortable numeric columns of the golfers table.
type GolferSortKey =
  | "handicap_index"
  | "avg_score"
  | "avg_putts"
  | "gir_pct"
  | "fairway_pct"
  | "rounds_played";
const GOLFER_COLUMNS: { key: GolferSortKey; label: string; suffix?: string }[] = [
  { key: "handicap_index", label: "Hcp idx" },
  { key: "avg_score", label: "Avg score" },
  { key: "avg_putts", label: "Avg putts" },
  { key: "gir_pct", label: "GIR", suffix: "%" },
  { key: "fairway_pct", label: "FW", suffix: "%" },
  { key: "rounds_played", label: "Rounds" },
];

function ViceCard({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: ViceRow[];
  unit: string;
}) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">None logged.</p>
      ) : (
        <ol className="max-h-[7.75rem] space-y-1 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <li
              key={r.golfer_id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-center">{MEDAL[i] ?? i + 1}</span>
                <Link href={`/golfers/${r.golfer_id}`} className="hover:text-fairway">
                  {r.name}
                </Link>
              </span>
              <span className="text-right">
                <span className="font-bold text-fairway">{r.total}</span>{" "}
                <span className="text-xs text-gray-400">
                  {[unit, r.detail].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courseSel, setCourseSel] = useState<number | "top">("top");
  // null sort = backend order (ranked by handicap index, lowest first)
  const [sort, setSort] = useState<{ key: GolferSortKey; dir: "asc" | "desc" } | null>(
    null
  );

  useEffect(() => {
    api
      .leaderboard()
      .then(setData)
      .catch(() => setError("Could not load the leaderboard."));
  }, []);

  const sortedGolfers = useMemo(() => {
    const rows = data?.golfers ?? [];
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key] as number | null;
      const bv = b[sort.key] as number | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [data, sort]);

  function toggleSort(key: GolferSortKey) {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      {/* golfer rankings */}
      <section>
        <h2 className="mb-2 font-semibold">Golfers</h2>
        <div className="card max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Golfer</th>
                {GOLFER_COLUMNS.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} className="px-3 py-2 text-right">
                      <button
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-fairway ${
                          active ? "text-fairway" : ""
                        }`}
                      >
                        {c.label}
                        <span className="text-[9px]">
                          {active ? (sort!.dir === "desc" ? "▼" : "▲") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedGolfers.map((g, i) => (
                <tr key={g.golfer_id} className="hover:bg-fairway-light">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/golfers/${g.golfer_id}`} className="hover:text-fairway">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-fairway">
                    {fmt(g.handicap_index)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(g.avg_score)}</td>
                  <td className="px-3 py-2 text-right">{fmt(g.avg_putts)}</td>
                  <td className="px-3 py-2 text-right">{fmt(g.gir_pct, "%")}</td>
                  <td className="px-3 py-2 text-right">{fmt(g.fairway_pct, "%")}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{g.rounds_played}</td>
                </tr>
              ))}
              {sortedGolfers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-gray-500">
                    No golfers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Ranked by handicap index (lowest first). Score/putts/index use full
          18-hole rounds.
        </p>
      </section>

      {/* top scores by course */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Top scores by course</h2>
          {data.courses.length > 0 && (
            <select
              className="input w-auto text-sm"
              value={courseSel}
              onChange={(e) =>
                setCourseSel(e.target.value === "top" ? "top" : Number(e.target.value))
              }
            >
              <option value="top">Top courses</option>
              {data.courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_name}
                </option>
              ))}
            </select>
          )}
        </div>
        {data.courses.length === 0 ? (
          <p className="text-sm text-gray-500">No completed rounds yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(courseSel === "top"
              ? data.courses.slice(0, 4)
              : data.courses.filter((c) => c.course_id === courseSel)
            ).map((c) => (
              <div key={c.course_id} className="card p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-semibold">{c.course_name}</h3>
                  <span className="text-xs text-gray-400">
                    {c.holes_count}h · {c.rounds} rds
                  </span>
                </div>
                <ol className="max-h-[7.75rem] space-y-1 overflow-y-auto pr-1">
                  {c.top.map((t, i) => (
                    <li
                      key={`${t.golfer_id}-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-center">{MEDAL[i] ?? i + 1}</span>
                        <Link href={`/golfers/${t.golfer_id}`} className="hover:text-fairway">
                          {t.name}
                        </Link>
                      </span>
                      <span>
                        <span className="font-bold text-fairway">{t.score}</span>
                        <span className="ml-2 text-xs text-gray-400">{t.played_on}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* consumption */}
      <section>
        <h2 className="mb-2 font-semibold">Consumption</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ViceCard title="🍺 Beers" rows={data.beers} unit="beers" />
          <ViceCard title="🌭 Hotdogs" rows={data.hotdogs} unit="" />
          <ViceCard title="🚬 Nicotine" rows={data.nicotine} unit="" />
          <ViceCard title="🍃 Weed" rows={data.weed} unit="" />
        </div>
      </section>

      {/* total ass index */}
      <section>
        <h2 className="mb-2 font-semibold">🍑 Total Ass Index</h2>
        <div className="card max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Golfer</th>
                <th className="px-3 py-2 text-right">Ass index</th>
                <th className="px-3 py-2 text-right">Penalties</th>
                <th className="px-3 py-2 text-right">Balls lost</th>
                <th className="px-3 py-2 text-right">Hazards</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.ass_index.map((a, i) => (
                <tr key={a.golfer_id} className="hover:bg-fairway-light">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/golfers/${a.golfer_id}`} className="hover:text-fairway">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-fairway">
                    {a.ass_index.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right">{a.penalties}</td>
                  <td className="px-3 py-2 text-right">{a.balls_lost}</td>
                  <td className="px-3 py-2 text-right">{a.hazards}</td>
                </tr>
              ))}
              {data.ass_index.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-gray-500">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Handicap + per-round ass weight: penalty strokes 1, lost balls 0.5,
          bunkers 0.25, natural area 0.25 (1 if a ball&apos;s lost), water/OB 0.5,
          and 3+ putts escalate. Higher = more ass.
        </p>
      </section>
    </div>
  );
}
