"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, GolferStats } from "@/lib/api";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <div className="text-2xl font-bold text-fairway">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default function GolferStatsPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [data, setData] = useState<GolferStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .golferStats(id)
      .then(setData)
      .catch(() => setError("Could not load stats."));
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;

  const fmt = (n: number | null, suffix = "") =>
    n == null ? "—" : `${n.toFixed(1)}${suffix}`;

  const chartData = data.rounds.map((r) => ({
    date: r.played_on,
    score: r.total_score,
    putts: r.total_putts,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{data.golfer.name}</h1>
        <p className="text-sm text-gray-500">
          {data.golfer.handicap != null
            ? `Handicap ${data.golfer.handicap} · `
            : ""}
          {data.rounds_played} round{data.rounds_played === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Avg score" value={fmt(data.avg_score)} />
        <StatCard label="Avg putts" value={fmt(data.avg_putts)} />
        <StatCard label="GIR" value={fmt(data.gir_pct, "%")} />
        <StatCard label="Fairways" value={fmt(data.fairway_pct, "%")} />
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Scoring trend</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">No rounds logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1f7a3d"
                strokeWidth={2}
                name="Score"
              />
              <Line
                type="monotone"
                dataKey="putts"
                stroke="#9ca3af"
                strokeWidth={2}
                name="Putts"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-lg border bg-white">
        <h2 className="border-b px-4 py-3 font-semibold">Rounds</h2>
        <ul className="divide-y">
          {data.rounds
            .slice()
            .reverse()
            .map((r) => (
              <li
                key={r.round_id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{r.course_name}</div>
                  <div className="text-gray-500">{r.played_on}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {r.total_score ?? "—"} ({r.holes_played} holes)
                  </div>
                  <div className="text-gray-500">
                    {r.total_putts ?? "—"} putts · {r.beers_finished} 🍺
                  </div>
                </div>
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
