"use client";

import { useEffect, useRef, useState } from "react";

export interface ComboOption {
  value: string;
  label: string;
  sublabel?: string;
}

// A searchable single-select dropdown: shows a search box that filters options.
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No matches",
  onAddNew,
  addNewLabel = (q) => `➕ Add “${q}” via web search`,
  addNewHint,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  // When provided, an "add" action appears for the typed text (e.g. to scrape
  // a course that isn't in the list yet).
  onAddNew?: (query: string) => void;
  addNewLabel?: (query: string) => string;
  addNewHint?: string; // small note under the add action (e.g. "include city & state")
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.sublabel?.toLowerCase().includes(q)
      )
    : options;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className="input flex items-center justify-between text-left"
      >
        <span className={selected ? "" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ml-2 text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-card">
          <div className="border-b p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-fairway"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-fairway-light ${
                    o.value === value ? "bg-fairway-light font-medium" : ""
                  }`}
                >
                  <span>{o.label}</span>
                  {o.sublabel && (
                    <span className="shrink-0 text-xs text-gray-500">
                      {o.sublabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && !onAddNew && (
              <li className="px-3 py-3 text-sm text-gray-400">{emptyText}</li>
            )}
          </ul>

          {onAddNew && query.trim().length >= 2 && (
            <div className="border-t border-black/10 p-1">
              <button
                type="button"
                onClick={() => {
                  onAddNew(query.trim());
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-fairway hover:bg-fairway-light"
              >
                {addNewLabel(query.trim())}
              </button>
              {addNewHint && (
                <p className="px-3 pb-1 text-xs text-gray-400">{addNewHint}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
