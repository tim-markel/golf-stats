"use client";

import { useState } from "react";
import { useGolfer } from "@/lib/golfer-context";

// Floating indicator shown on every page while the super admin is impersonating
// a normal golfer. Click it to reveal a toggle that returns to the true role.
export default function NormalViewBadge() {
  const { viewAsNormal, setViewAsNormal } = useGolfer();
  const [open, setOpen] = useState(false);

  if (!viewAsNormal) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-56 rounded-xl border border-black/10 bg-white p-3 text-gray-900 shadow-lg">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Viewing as normal golfer
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm">Normal view</span>
            <button
              role="switch"
              aria-checked={true}
              aria-label="Turn off normal view"
              onClick={() => {
                setViewAsNormal(false);
                setOpen(false);
              }}
              className="relative h-6 w-11 rounded-full bg-fairway transition"
            >
              <span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
            </button>
          </label>
          <p className="mt-2 text-xs text-gray-500">
            Turn off to return to your admin view.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Normal View on
      </button>
    </div>
  );
}
