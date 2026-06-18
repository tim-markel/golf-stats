"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGolfer } from "@/lib/golfer-context";

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function SettingsMenu() {
  const { golfers, active, setActive, updateActive } = useGolfer();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<null | "name" | "handicap">(null);
  const [nameVal, setNameVal] = useState("");
  const [hcpVal, setHcpVal] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset the inline editors whenever the menu closes or the golfer changes.
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  function startEditName() {
    setNameVal(active?.name ?? "");
    setEditing("name");
  }
  function startEditHcp() {
    setHcpVal(active?.handicap != null ? String(active.handicap) : "");
    setEditing("handicap");
  }

  async function save() {
    setSaving(true);
    try {
      if (editing === "name") {
        if (!nameVal.trim()) return;
        await updateActive({ name: nameVal.trim() });
      } else if (editing === "handicap") {
        await updateActive({ handicap: hcpVal === "" ? null : Number(hcpVal) });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25"
        aria-label="Settings"
      >
        <GearIcon />
        <span className="text-sm">{active ? active.name : "Settings"}</span>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-white text-gray-900 shadow-lg">
            {active ? (
              <>
                <div className="border-b px-4 py-2">
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    Active golfer
                  </div>
                  <div className="font-semibold">{active.name}</div>
                  <div className="text-sm text-gray-500">
                    {active.handicap != null ? `Handicap ${active.handicap}` : "No handicap set"}
                  </div>
                </div>

                {editing === null && (
                  <div className="py-1">
                    <button
                      onClick={startEditName}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-fairway-light"
                    >
                      ✏️ Change name
                    </button>
                    <button
                      onClick={startEditHcp}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-fairway-light"
                    >
                      ⛳ Edit handicap
                    </button>
                    <Link
                      href={`/golfers/${active.golfer_id}`}
                      onClick={() => setOpen(false)}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-fairway-light"
                    >
                      📊 View stats
                    </Link>
                  </div>
                )}

                {editing === "name" && (
                  <div className="space-y-2 px-4 py-3">
                    <label className="text-xs font-medium text-gray-500">Name</label>
                    <input
                      autoFocus
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && save()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="rounded bg-fairway px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded border px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {editing === "handicap" && (
                  <div className="space-y-2 px-4 py-3">
                    <label className="text-xs font-medium text-gray-500">
                      Handicap (blank to clear)
                    </label>
                    <input
                      autoFocus
                      inputMode="decimal"
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={hcpVal}
                      onChange={(e) => setHcpVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && save()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="rounded bg-fairway px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="rounded border px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">
                No golfer selected. Pick one below or add one on the home page.
              </div>
            )}

            {/* golfer switcher */}
            {golfers.length > 0 && (
              <div className="border-t py-1">
                <div className="px-4 py-1 text-xs uppercase tracking-wide text-gray-400">
                  Switch golfer
                </div>
                {golfers.map((g) => (
                  <button
                    key={g.golfer_id}
                    onClick={() => {
                      setActive(g.golfer_id);
                      setEditing(null);
                    }}
                    className={`block w-full px-4 py-1.5 text-left text-sm hover:bg-fairway-light ${
                      g.golfer_id === active?.golfer_id ? "font-semibold text-fairway" : ""
                    }`}
                  >
                    {g.golfer_id === active?.golfer_id ? "✓ " : ""}
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
