"use client";

// Shared per-hole stat controls, used by the new-round entry flow and the
// round-page hole editor so both screens share identical UI.

import { useState } from "react";
import Combobox from "@/components/Combobox";
import {
  Beer,
  Hazard,
  HoleStatIn,
  nicotineLabel,
  weedLabel,
} from "@/lib/api";

export const HAZARDS: Hazard[] = [
  "water",
  "greenside_bunker",
  "fairway_bunker",
  "natural_area",
  "ob",
];
const BEER_SIZES = [12, 16, 19.2, 7, 22, 25];
const NIC_TYPES = ["cigarette", "cigar", "vape", "dip", "pouch", "gum"];
const WEED_TYPES = ["joint", "blunt", "bowl", "one_hitter", "vape", "dab", "edible"];
const WEED_UNITS = ["g", "mg", "hits"];

// circle (under par) / square (over par) marker around a score, 1-2 rings.
export function scoreMark(score: number, par: number, big = false) {
  const d = score - par;
  const n = Math.min(2, Math.abs(d));
  const shape = d < 0 ? "rounded-full" : "rounded-[3px]";
  const t = big ? "text-lg font-semibold" : "";
  const single = big ? "h-10 w-10" : "h-7 w-7";
  const outer = big ? "h-11 w-11" : "h-8 w-8";
  const inner = big ? "h-9 w-9" : "h-6 w-6";
  if (n === 0)
    return <span className={`inline-flex ${single} items-center justify-center ${t}`}>{score}</span>;
  if (n === 1)
    return (
      <span className={`inline-flex ${single} items-center justify-center border-2 border-current ${shape} ${t}`}>
        {score}
      </span>
    );
  return (
    <span className={`inline-flex ${outer} items-center justify-center border-2 border-current ${shape}`}>
      <span className={`inline-flex ${inner} items-center justify-center border-2 border-current ${shape} ${t}`}>
        {score}
      </span>
    </span>
  );
}

// smaller circle button for the numeric count selectors
const numBtn = (active: boolean) =>
  `flex h-10 w-10 items-center justify-center rounded-full border text-sm ${
    active
      ? "border-fairway bg-fairway text-white"
      : "border-gray-300 bg-white text-gray-700"
  }`;

// shared button styles
const padBtn = (active: boolean, tone: "on" | "off" | "bad" = "on") =>
  `flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
    active
      ? tone === "bad"
        ? "border-red-500 bg-red-500 text-white"
        : "border-fairway bg-fairway text-white"
      : "border-gray-300 bg-white text-gray-700"
  }`;

// Score picker: eagle..triple-bogey buttons (with markers) + custom input.
export function ScorePicker({
  par,
  value,
  onChange,
}: {
  par: number;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const lo = Math.max(1, par - 2);
  const hi = par + 3;
  const opts: number[] = [];
  for (let i = lo; i <= hi; i++) opts.push(i);
  const isPreset = value != null && value >= lo && value <= hi;
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Score</div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((n) => {
          const active = !custom && value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(n);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                active ? "bg-fairway-light ring-2 ring-fairway" : "hover:bg-gray-100"
              }`}
            >
              {scoreMark(n, par, true)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`h-10 rounded-lg border px-3 text-sm ${
            custom || (value != null && !isPreset)
              ? "border-fairway bg-fairway text-white"
              : "border-gray-300 bg-white"
          }`}
        >
          Other
        </button>
      </div>
      {(custom || (value != null && !isPreset)) && (
        <input
          type="number"
          min={1}
          autoFocus
          placeholder="Score"
          className="input mt-2 w-24"
          value={value ?? ""}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        />
      )}
    </div>
  );
}

// Directional pad. layout="cross" (driving) or "grid" (approach, with diagonals).
export function DirPad({
  label,
  value,
  onChange,
  layout,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  layout: "cross" | "grid";
}) {
  const cell = (v: string, sym: string) => {
    const active = value === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => onChange(active ? null : v)}
        className={padBtn(active)}
      >
        {sym}
      </button>
    );
  };
  const blank = <div className="h-10 w-10" />;
  const center = layout === "cross" ? "fairway" : "on";
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <div className="inline-grid grid-cols-3 gap-1.5">
        {layout === "grid" ? cell("long_left", "↖") : blank}
        {cell("long", "↑")}
        {layout === "grid" ? cell("long_right", "↗") : blank}
        {cell("left", "←")}
        {cell(center, "✓")}
        {cell("right", "→")}
        {layout === "grid" ? cell("short_left", "↙") : blank}
        {cell("short", "↓")}
        {layout === "grid" ? cell("short_right", "↘") : blank}
      </div>
    </div>
  );
}

// GIR check/X; when missed, reveal Up & Down check/X.
export function GirControl({
  gir,
  upDown,
  onGir,
  onUpDown,
}: {
  gir: boolean | null;
  upDown: boolean | null;
  onGir: (v: boolean | null) => void;
  onUpDown: (v: boolean | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">GIR</div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onGir(gir === true ? null : true)} className={padBtn(gir === true)}>✓</button>
        <button type="button" onClick={() => onGir(gir === false ? null : false)} className={padBtn(gir === false, "bad")}>✗</button>
      </div>
      {gir === false && (
        <div className="mt-2">
          <div className="mb-1 text-xs font-medium text-gray-500">Up &amp; down</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onUpDown(true)} className={padBtn(upDown === true)}>✓</button>
            <button type="button" onClick={() => onUpDown(false)} className={padBtn(upDown === false, "bad")}>✗</button>
            {/* N/A → null: not counted toward up-and-down % (default) */}
            <button
              type="button"
              onClick={() => onUpDown(null)}
              className={`flex h-10 items-center justify-center rounded-full border px-3 text-sm font-medium ${
                upDown === null
                  ? "border-gray-400 bg-gray-200 text-gray-700"
                  : "border-gray-300 bg-white text-gray-500"
              }`}
            >
              N/A
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Count selector: 0/1/2/3/4+ (or 1.. when min=1); 4+ reveals a number input.
export function CountChoice({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  const [custom, setCustom] = useState(false);
  const base = min === 0 ? [0, 1, 2, 3] : [1, 2, 3];
  const isPlus = value >= 4;
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {base.map((n) => {
          const active = !custom && !isPlus && value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustom(false);
                onChange(active && min > 0 ? 0 : n);
              }}
              className={numBtn(active)}
            >
              {n}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustom(true);
            if (!isPlus) onChange(4);
          }}
          className={numBtn(custom || isPlus)}
        >
          4+
        </button>
      </div>
      {(custom || isPlus) && (
        <input
          type="number"
          min={4}
          autoFocus
          className="input mt-2 w-24"
          value={value || 4}
          onChange={(e) => onChange(Math.max(4, Number(e.target.value) || 4))}
        />
      )}
    </div>
  );
}

// Beer logging for a single hole: pick a saved beer (or "Other" → name + abv),
// choose a size, and add it. Added beers are listed with a remove button.
export function BeerEntry({
  options,
  beers,
  onChange,
}: {
  options: Beer[];
  beers: HoleStatIn["beers"];
  onChange: (b: HoleStatIn["beers"]) => void;
}) {
  const [pick, setPick] = useState<string>(""); // beer_id as string, or "other"
  const [size, setSize] = useState<number>(12);
  const [name, setName] = useState("");
  const [abv, setAbv] = useState("");

  function add() {
    if (pick === "") return;
    if (pick === "other") {
      if (!name.trim()) return;
      onChange([
        ...beers,
        { beer_id: null, name: name.trim(), abv: abv ? Number(abv) : null, size_oz: size },
      ]);
      setName("");
      setAbv("");
    } else {
      onChange([
        ...beers,
        { beer_id: Number(pick), name: null, abv: null, size_oz: size },
      ]);
    }
  }

  function label(b: HoleStatIn["beers"][number]) {
    const nm =
      b.beer_id != null
        ? options.find((o) => o.beer_id === b.beer_id)?.name ?? "Beer"
        : b.name ?? "Beer";
    return `${nm} · ${b.size_oz} oz`;
  }

  return (
    <div>
      <div className="mb-1 text-sm font-medium">Beers 🍺</div>

      {beers.length > 0 && (
        <ul className="mb-2 space-y-1">
          {beers.map((b, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>{label(b)}</span>
              <button
                type="button"
                onClick={() => onChange(beers.filter((_, idx) => idx !== i))}
                className="text-gray-500 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Combobox
            value={pick || null}
            onChange={setPick}
            placeholder="Choose a beer…"
            options={[
              ...options.map((o) => ({
                value: String(o.beer_id),
                label: o.name,
                sublabel: o.abv != null ? `${o.abv}%` : undefined,
              })),
              { value: "other", label: "Other…" },
            ]}
          />
        </div>

        <select
          className="input w-auto flex-none"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {BEER_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} oz
            </option>
          ))}
        </select>

        <button type="button" onClick={add} className="btn-primary">
          Add
        </button>
      </div>

      {pick === "other" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="flex-1 rounded border px-2 py-1.5 text-sm"
            placeholder="Beer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-24 rounded border px-2 py-1.5 text-sm"
            placeholder="ABV %"
            value={abv}
            onChange={(e) => setAbv(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// Nicotine logging for a hole: pick a type + quantity; added items listed.
export function NicotineEntry({
  items,
  onChange,
}: {
  items: HoleStatIn["nicotine"];
  onChange: (n: HoleStatIn["nicotine"]) => void;
}) {
  const [type, setType] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Nicotine</div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((n, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>
                {nicotineLabel(n.type)}: {n.quantity}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-gray-500 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <Combobox
            value={type}
            onChange={setType}
            placeholder="Choose a method…"
            options={NIC_TYPES.map((t) => ({ value: t, label: nicotineLabel(t) }))}
          />
        </div>
        <input
          type="number"
          min={1}
          className="input w-16 flex-none"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        />
        <button
          type="button"
          onClick={() => {
            if (type) onChange([...items, { type, quantity: qty }]);
          }}
          className="btn-primary"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Weed logging for a hole: pick a type + amount + unit (g / mg / hits).
export function WeedEntry({
  items,
  onChange,
}: {
  items: HoleStatIn["weed"];
  onChange: (w: HoleStatIn["weed"]) => void;
}) {
  const [type, setType] = useState<string | null>(null);
  const [unit, setUnit] = useState("g");
  const [amount, setAmount] = useState<number>(0.5);
  function add() {
    if (type) onChange([...items, { type, amount, unit }]);
  }
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Weed</div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((w, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded bg-fairway-light px-3 py-1 text-sm"
            >
              <span>
                {weedLabel(w.type)}
                {w.amount != null ? ` · ${w.amount} ${w.unit ?? ""}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-gray-500 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[160px] flex-1">
            <Combobox
              value={type}
              onChange={setType}
              placeholder="Choose a method…"
              options={WEED_TYPES.map((t) => ({ value: t, label: weedLabel(t) }))}
            />
          </div>
          <select
            className="input w-auto flex-none"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setAmount(e.target.value === "hits" ? 1 : 0.5);
            }}
          >
            {WEED_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button type="button" onClick={add} className="btn-primary">
            Add
          </button>
        </div>
        {unit === "g" ? (
          <div className="flex flex-wrap gap-1.5">
            {[0.25, 0.5, 0.75, 1].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={amount === a ? "chip-on" : "chip-off"}
              >
                {a}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="number"
            min={1}
            className="input w-24"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          />
        )}
      </div>
    </div>
  );
}

// A small segmented control for enum-ish fields.
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            className={active ? "chip-on" : "chip-off"}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
