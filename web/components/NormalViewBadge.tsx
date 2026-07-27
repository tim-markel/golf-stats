"use client";

import { useState } from "react";
import { useGolfer } from "@/lib/golfer-context";

// Floating indicator shown on every page while the super admin is either
// impersonating another golfer or viewing the UI as a normal golfer. Click it
// to reveal a control that returns to the true account/role.
export default function NormalViewBadge() {
  const { viewAsNormal, setViewAsNormal, impersonating, active, stopImpersonating } = useGolfer();
  const [open, setOpen] = useState(false);

  if (!impersonating && !viewAsNormal) return null;

  const label = impersonating
    ? `Impersonating ${active?.name ?? "golfer"}`
    : "Normal View on";

  function turnOff() {
    if (impersonating) stopImpersonating();
    else setViewAsNormal(false);
    setOpen(false);
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {open && (
        <div className="mb-2 w-60 rounded-xl border border-black/10 bg-white p-3 text-gray-900 shadow-lg">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {impersonating ? "Impersonating golfer" : "Viewing as normal golfer"}
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm">{impersonating ? "Impersonation" : "Normal view"}</span>
            <button
              role="switch"
              aria-checked={true}
              aria-label={impersonating ? "Stop impersonating" : "Turn off normal view"}
              onClick={turnOff}
              className="relative h-6 w-11 rounded-full bg-fairway transition"
            >
              <span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" />
            </button>
          </label>
          <p className="mt-2 text-xs text-gray-500">
            {impersonating
              ? "Turn off to return to your own account."
              : "Turn off to return to your admin view."}
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        {label}
      </button>
    </div>
  );
}
