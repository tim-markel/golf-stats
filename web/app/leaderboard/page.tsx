"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Leaderboard, ViceRow } from "@/lib/api";

const fmt = (n: number | null, suffix = "") =>
  n == null ? "—" : `${n.toFixed(1)}${suffix}`;
const MEDAL = ["🥇", "🥈", "🥉"];

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
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li
              key={r.golfer_id}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-center">{MEDAL[i] ?? i + 1}</span>
                <Link href={`/golfers/${r.golfer_id}`} className="hover:text-fairway">
                  {r.name}
                </Link>
              </span>
              <span>
                <span className="font-bold text-fairway">{r.total}</span>{" "}
                <span className="text-xs text-gray-400">
                  {unit}
                  {r.detail ? ` · ${r.detail}` : ""}
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

  useEffect(() => {
    api
      .leaderboard()
      .then(setData)
      .catch(() => setError("Could not load the leaderboard."));
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      {/* golfer rankings */}
      <section>
        <h2 className="mb-2 font-semibold">Golfers</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Golfer</th>
                <th className="px-3 py-2 text-right">Hcp idx</th>
                <th className="px-3 py-2 text-right">Avg score</th>
                <th className="px-3 py-2 text-right">Avg putts</th>
                <th className="px-3 py-2 text-right">GIR</th>
                <th className="px-3 py-2 text-right">FW</th>
                <th className="px-3 py-2 text-right">Rounds</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.golfers.map((g, i) => (
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
              {data.golfers.length === 0 && (
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
        <h2 className="mb-2 font-semibold">Top scores by course</h2>
        {data.courses.length === 0 ? (
          <p className="text-sm text-gray-500">No completed rounds yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((c) => (
              <div key={c.course_id} className="card p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-semibold">{c.course_name}</h3>
                  <span className="text-xs text-gray-400">{c.holes_count} holes</span>
                </div>
                <ol className="space-y-1">
                  {c.top.map((t, i) => (
                    <li
                      key={`${t.golfer_id}-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-center">{MEDAL[i] ?? i + 1}</span>
                        <Link
                          href={`/golfers/${t.golfer_id}`}
                          className="hover:text-fairway"
                        >
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
    </div>
  );
}
