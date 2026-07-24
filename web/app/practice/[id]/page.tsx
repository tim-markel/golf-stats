"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, PRACTICE_ACTIVITIES, PracticeRating } from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";
import {
  ActivityForm,
  draftToActivities,
  emptyPracticeDraft,
  fmtTime,
  PRACTICE_LABELS,
  PracticeDraft,
  RATING_TEXT,
  sessionToDraft,
} from "@/components/practiceUi";

export default function PracticeSessionPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const router = useRouter();
  const { active } = useGolfer();
  const [date, setDate] = useState("");
  const [draft, setDraft] = useState<PracticeDraft>(emptyPracticeDraft);
  const [notes, setNotes] = useState("");
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    api
      .getPractice(id)
      .then((s) => {
        setDate(s.practiced_on);
        setDraft(sessionToDraft(s));
        setNotes(s.notes ?? "");
        setOwnerId(s.golfer_id);
        setLoaded(true);
      })
      .catch(() => setError("Could not load this session."));
  }, [id]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updatePractice(id, {
        practiced_on: date,
        ...draftToActivities(draft),
        notes: notes.trim() || null,
      });
      router.push("/practice");
    } catch {
      setError("Could not save changes.");
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api.deletePractice(id);
      router.push("/practice");
    } catch {
      setError("Could not delete this session.");
      setConfirmingDelete(false);
    }
  }

  if (error) return <p className="text-red-700">{error}</p>;
  if (!loaded) return <p className="text-gray-500">Loading…</p>;

  // The owner — or an admin — can edit/delete it. (`active` is the effective
  // viewer, so an admin impersonating a normal golfer can't.)
  const canEdit =
    active != null &&
    (active.golfer_id === ownerId || active.is_admin || active.is_super_admin);

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.back()}
        className="text-sm font-medium text-gray-500 hover:text-fairway"
      >
        ← Back
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Practice session</h1>
        <p className="text-sm text-gray-500">{date}</p>
      </div>

      {/* breakdown of the current values */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PRACTICE_ACTIVITIES.map((a) => {
          const d = draft[a];
          return (
            <div key={a} className="card p-4">
              <div className="mb-1 text-sm font-semibold">{PRACTICE_LABELS[a]}</div>
              <div className="text-xs text-gray-600">
                {a === "range" && d.balls.trim() !== "" ? `${d.balls} balls · ` : ""}
                {fmtTime(Number(d.time) || 0)}
              </div>
              <div className="mt-1 text-sm font-bold">
                {d.rating ? (
                  <span className={RATING_TEXT[d.rating as PracticeRating]}>{d.rating}</span>
                ) : (
                  <span className="text-gray-400">— not rated</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* editor — owner only */}
      {canEdit && (
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Edit session</h2>
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="btn-ghost px-4 py-3 text-red-600"
          >
            Delete
          </button>
        </div>

        {confirmingDelete && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <span className="text-sm text-red-700">
              Permanently delete this practice session?
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={remove}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
