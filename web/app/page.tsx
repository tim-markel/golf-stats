"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Golfer } from "@/lib/api";

export default function HomePage() {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function addGolfer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createGolfer({
      name: name.trim(),
      handicap: handicap ? Number(handicap) : null,
    });
    setName("");
    setHandicap("");
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Golfers</h1>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <form onSubmit={addGolfer} className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Golfer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-28 rounded border px-3 py-2"
          placeholder="Handicap"
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
        />
        <button className="rounded bg-fairway px-4 py-2 font-medium text-white">
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <ul className="divide-y rounded border bg-white">
          {golfers.map((g) => (
            <li key={g.golfer_id}>
              <Link
                href={`/golfers/${g.golfer_id}`}
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
