"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api, Golfer } from "./api";

const STORAGE_KEY = "activeGolferId";

interface GolferCtx {
  golfers: Golfer[];
  active: Golfer | null;
  ready: boolean; // true once the initial load has finished
  setActive: (id: number | null) => void;
  refresh: () => Promise<Golfer[]>;
  updateActive: (patch: { name?: string; handicap?: number | null }) => Promise<void>;
}

const Ctx = createContext<GolferCtx | null>(null);

export function GolferProvider({ children }: { children: ReactNode }) {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh(): Promise<Golfer[]> {
    try {
      const gs = await api.listGolfers();
      setGolfers(gs);
      return gs;
    } catch {
      return [];
    }
  }

  // On mount: load golfers and restore (or default) the active golfer.
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    refresh().then((gs) => {
      if (saved && gs.some((g) => g.golfer_id === Number(saved))) {
        setActiveId(Number(saved));
      } else if (gs.length > 0) {
        setActive(gs[0].golfer_id); // default to the first golfer
      }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setActive(id: number | null) {
    setActiveId(id);
    if (typeof window === "undefined") return;
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }

  async function updateActive(patch: { name?: string; handicap?: number | null }) {
    if (activeId == null) return;
    await api.updateGolfer(activeId, patch);
    await refresh();
  }

  const active = golfers.find((g) => g.golfer_id === activeId) ?? null;

  return (
    <Ctx.Provider value={{ golfers, active, ready, setActive, refresh, updateActive }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGolfer(): GolferCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGolfer must be used within GolferProvider");
  return ctx;
}
