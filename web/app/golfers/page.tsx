"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Golfer } from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";

export default function GolfersPage() {
  const { active, viewer, ready, setActive, refresh: refreshActive } = useGolfer();
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Only admins / the super admin may create or switch golfers.
  // Uses the effective viewer so "normal view" impersonation is also blocked.
  const canManage = !!viewer && (viewer.is_admin || viewer.is_super_admin);

  async function refresh() {
    try {
      setGolfers(await api.listGolfers());
    } catch (e) {
      setError("Could not reach the API. Is the backend running on :8000?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (ready && !canManage) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Golfers</h1>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Only admins can create or change golfers. You’re signed in as{" "}
          <span className="font-semibold">{active?.name ?? "a normal user"}</span>.
        </p>
        <Link href="/settings" className="btn-ghost">
          ← Back to settings
        </Link>
      </div>
    );
  }

  async function addGolfer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await api.createGolfer({
      name: name.trim(),
      handicap: handicap ? Number(handicap) : null,
    });
    setName("");
    setHandicap("");
    refresh();
    refreshActive();
    setActive(created.golfer_id); // make the new golfer active
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Change or create golfer</h1>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <form onSubmit={addGolfer} className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          placeholder="Golfer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-28 flex-none"
          placeholder="Handicap"
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
        />
        <button className="btn-primary">Add golfer</button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <ul className="card divide-y overflow-hidden">
          {golfers.map((g) => (
            <li key={g.golfer_id}>
              <Link
                href={`/golfers/${g.golfer_id}`}
                onClick={() => setActive(g.golfer_id)}
                className="flex items-center justify-between px-4 py-3 hover:bg-fairway-light"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-sm text-gray-500">
                  {g.handicap != null ? `HCP ${g.handicap}` : "—"}
                </span>
              </Link>
            </li>
          ))}
          {golfers.length === 0 && (
            <li className="px-4 py-3 text-gray-500">No golfers yet. Add one above.</li>
          )}
        </ul>
      )}
    </div>
  );
}
