"use client";

// A month calendar for a golfer's rounds. Toggle month/year; days with a
// round played show a green circle you can hover (to see the round) and click
// (to open it).

import Link from "next/link";
import { useMemo, useState } from "react";
import { RoundSummary } from "@/lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function RoundsCalendar({ rounds }: { rounds: RoundSummary[] }) {
  // rounds keyed by their played_on date string (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const m = new Map<string, RoundSummary[]>();
    for (const r of rounds) {
      const list = m.get(r.played_on);
      if (list) list.push(r);
      else m.set(r.played_on, [r]);
    }
    return m;
  }, [rounds]);

  // start on the most recent round's month (rounds are chronological)
  const [ym, setYm] = useState(() => {
    const latest = rounds.length ? rounds[rounds.length - 1].played_on : null;
    if (latest) {
      const [y, mo] = latest.split("-").map(Number);
      return { y, m: mo - 1 };
    }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const stepMonth = (delta: number) =>
    setYm(({ y, m }) => {
      const total = y * 12 + m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });
  const stepYear = (delta: number) => setYm(({ y, m }) => ({ y: y + delta, m }));

  const firstWeekday = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const arrow =
    "flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100";

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Calendar</h2>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-0.5">
            <button className={arrow} onClick={() => stepMonth(-1)} title="Previous month">
              ‹
            </button>
            <span className="w-16 text-center font-medium">{MONTHS[ym.m]}</span>
            <button className={arrow} onClick={() => stepMonth(1)} title="Next month">
              ›
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button className={arrow} onClick={() => stepYear(-1)} title="Previous year">
              ‹
            </button>
            <span className="w-10 text-center font-medium">{ym.y}</span>
            <button className={arrow} onClick={() => stepYear(1)} title="Next year">
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
      <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wide text-gray-400">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px border-t border-gray-200 bg-gray-200 text-center">
        {cells.map((day, i) => {
          if (day == null) return <div key={i} className="aspect-square bg-white" />;
          const key = `${ym.y}-${pad(ym.m + 1)}-${pad(day)}`;
          const dayRounds = byDate.get(key);
          return (
            <div key={i} className="flex aspect-square items-center justify-center bg-white">
              {dayRounds ? (
                <div className="group relative">
                  <Link
                    href={`/rounds/${dayRounds[0].round_id}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-fairway text-[11px] font-semibold text-white hover:brightness-110"
                  >
                    {day}
                  </Link>
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-44 -translate-x-1/2 rounded-lg border border-black/10 bg-white p-2 text-left shadow-card group-hover:block">
                    {dayRounds.map((r) => (
                      <div key={r.round_id} className="text-xs">
                        <div className="font-semibold text-ink">{r.course_name}</div>
                        <div className="text-gray-500">
                          {r.total_score ?? "—"} · {r.holes_played} holes
                          {r.total_putts != null ? ` · ${r.total_putts} putts` : ""}
                        </div>
                      </div>
                    ))}
                    <div className="mt-1 text-[10px] text-gray-400">Click to open</div>
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-gray-500">{day}</span>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
