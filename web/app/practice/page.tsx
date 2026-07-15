"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  PracticeActivityKey,
  PracticeRating,
  PracticeSession,
  PRACTICE_ACTIVITIES,
} from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";

const LABELS: Record<PracticeActivityKey, string> = {
  range: "Range",
  putting: "Putting",
  chipping: "Chipping",
};

const RATINGS: { key: PracticeRating; label: string; on: string }[] = [
  { key: "good", label: "Good", on: "border-fairway bg-fairway text-white" },
  { key: "medium", label: "Medium", on: "border-yellow-400 bg-yellow-400 text-white" },
  { key: "bad", label: "Bad", on: "border-red-500 bg-red-500 text-white" },
];
const RATING_TEXT: Record<PracticeRating, string> = {
  good: "text-fairway",
  medium: "text-yellow-700",
  bad: "text-red-600",
};

type ActDraft = { balls: string; time: string; rating: PracticeRating | null };
type Draft = Record<PracticeActivityKey, ActDraft>;

const emptyDraft = (): Draft => ({
  range: { balls: "", time: "", rating: null },
  putting: { balls: "", time: "", rating: null },
  chipping: { balls: "", time: "", rating: null },
});

const num = (s: string): number | null =>
  s.trim() === "" ? null : Math.max(0, Math.floor(Number(s) || 0));

const today = () => new Date().toISOString().slice(0, 10);

const fmtTime = (m: number) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
};

function RatingButtons({
  value,
  onChange,
}: {
  value: PracticeRating | null;
  onChange: (v: PracticeRating | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {RATINGS.map((r) => {
        // full color when nothing is picked yet or this one is picked;
        // the others fall back to the plain white box.
        const colored = value === null || value === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(value === r.key ? null : r.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              colored ? r.on : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityForm({
  label,
  withBalls,
  value,
  onChange,
}: {
  label: string;
  withBalls: boolean;
  value: ActDraft;
  onChange: (v: ActDraft) => void;
}) {
  const numInput = (k: "balls" | "time", ph: string) => (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      placeholder={ph}
      value={value[k]}
      onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-fairway"
    />
  );
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className={`mb-2 grid gap-2 ${withBalls ? "grid-cols-2" : "grid-cols-1"}`}>
        {withBalls && (
          <div>
            <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-gray-500">
              # Balls
            </label>
            {numInput("balls", "0")}
          </div>
        )}
        <div>
          <label className="mb-0.5 block text-[11px] uppercase tracking-wide text-gray-500">
            Time (min)
          </label>
          {numInput("time", "0")}
        </div>
      </div>
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
        How&apos;d it go?
      </label>
      <RatingButtons value={value.rating} onChange={(r) => onChange({ ...value, rating: r })} />
    </div>
  );
}

function RatingBar({ good, medium, bad }: { good: number; medium: number; bad: number }) {
  const total = good + medium + bad || 1;
  const seg = (n: number, cls: string) =>
    n > 0 ? <div className={cls} style={{ width: `${(n / total) * 100}%` }} /> : null;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
      {seg(good, "bg-fairway")}
      {seg(medium, "bg-yellow-400")}
      {seg(bad, "bg-red-400")}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold text-fairway">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default function PracticePage() {
  const { active } = useGolfer();
  const golferId = active?.golfer_id ?? null;
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (golferId == null) return;
    api.listPractice(golferId).then(setSessions).catch(() => {});
  }, [golferId]);

  const summary = useMemo(() => {
    const acc: Record<
      PracticeActivityKey,
      { time: number; good: number; medium: number; bad: number; balls: number }
    > = {
      range: { time: 0, good: 0, medium: 0, bad: 0, balls: 0 },
      putting: { time: 0, good: 0, medium: 0, bad: 0, balls: 0 },
      chipping: { time: 0, good: 0, medium: 0, bad: 0, balls: 0 },
    };
    for (const s of sessions) {
      for (const a of PRACTICE_ACTIVITIES) {
        acc[a].time += s[a].time ?? 0;
        acc[a].balls += s[a].balls ?? 0;
        if (s[a].rating) acc[a][s[a].rating as PracticeRating] += 1;
      }
    }
    const totalTime = PRACTICE_ACTIVITIES.reduce((n, a) => n + acc[a].time, 0);
    return { acc, totalTime, rangeBalls: acc.range.balls };
  }, [sessions]);

  const hasAny = PRACTICE_ACTIVITIES.some(
    (a) => draft[a].balls.trim() !== "" || draft[a].time.trim() !== "" || draft[a].rating
  );

  async function save() {
    if (golferId == null || !hasAny) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createPractice({
        golfer_id: golferId,
        practiced_on: date,
        range: { balls: num(draft.range.balls), time: num(draft.range.time), rating: draft.range.rating },
        putting: { balls: null, time: num(draft.putting.time), rating: draft.putting.rating },
        chipping: { balls: null, time: num(draft.chipping.time), rating: draft.chipping.rating },
        notes: notes.trim() || null,
      });
      setSessions((prev) => [created, ...prev]);
      setDraft(emptyDraft());
      setNotes("");
    } catch {
      setError("Could not save the session.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.deletePractice(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* ignore */
    }
  }

  if (golferId == null) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Practice</h1>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          No golfer selected — open a golfer&apos;s page or use Settings to pick one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Practice{active ? ` · ${active.name}` : ""}
        </h1>
        <p className="text-sm text-gray-500">
          Log range, putting, and chipping sessions. They show up on your calendar.
        </p>
      </div>

      {/* summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Sessions" value={String(sessions.length)} />
        <StatTile label="Num Range Balls" value={String(summary.rangeBalls)} />
        <StatTile label="Total Time" value={fmtTime(summary.totalTime)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PRACTICE_ACTIVITIES.map((a) => {
          const s = summary.acc[a];
          const rated = s.good + s.medium + s.bad;
          return (
            <div key={a} className="card p-4">
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{LABELS[a]}</h3>
                <span className="text-xs text-gray-400">
                  {fmtTime(s.time)}
                  {a === "range" && s.balls ? ` · ${s.balls} balls` : ""}
                </span>
              </div>
              <RatingBar good={s.good} medium={s.medium} bad={s.bad} />
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-fairway">{s.good} good</span>
                <span className="text-yellow-700">{s.medium} med</span>
                <span className="text-red-600">{s.bad} bad</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-400">
                {rated ? `${Math.round((100 * s.good) / rated)}% good` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* log form */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Log a session</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActivityForm
            label="Range"
            withBalls
            value={draft.range}
            onChange={(v) => setDraft({ ...draft, range: v })}
          />
          <ActivityForm
            label="Putting"
            withBalls={false}
            value={draft.putting}
            onChange={(v) => setDraft({ ...draft, putting: v })}
          />
          <ActivityForm
            label="Chipping"
            withBalls={false}
            value={draft.chipping}
            onChange={(v) => setDraft({ ...draft, chipping: v })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="input min-h-[60px]"
            placeholder="Optional — what you worked on…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          onClick={save}
          disabled={saving || !hasAny}
          className="btn-primary w-full py-3"
        >
          {saving ? "Saving…" : "Save session"}
        </button>
      </section>

      {/* history */}
      <section className="card">
        <h2 className="border-b px-4 py-3 font-semibold">History</h2>
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{s.practiced_on}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {PRACTICE_ACTIVITIES.filter(
                      (a) => s[a].time != null || s[a].rating || (s[a].balls ?? 0) > 0
                    ).map((a) => (
                      <span key={a}>
                        <span className="font-semibold text-ink">{LABELS[a]}:</span>{" "}
                        {a === "range" && (s[a].balls ?? 0) > 0 ? `${s[a].balls} balls · ` : ""}
                        {fmtTime(s[a].time ?? 0)}
                        {s[a].rating ? (
                          <>
                            {" · "}
                            <span className={RATING_TEXT[s[a].rating as PracticeRating]}>
                              {s[a].rating}
                            </span>
                          </>
                        ) : (
                          ""
                        )}
                      </span>
                    ))}
                  </div>
                  {s.notes && <div className="mt-1 text-xs text-gray-500">{s.notes}</div>}
                </div>
                <button
                  onClick={() => remove(s.id)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No practice logged yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
