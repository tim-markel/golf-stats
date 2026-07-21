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
const NORMAL_VIEW_KEY = "viewAsNormal";

interface GolferCtx {
  golfers: Golfer[];
  active: Golfer | null; // the real signed-in golfer (true role)
  viewer: Golfer | null; // effective golfer for role gating (roles stripped in normal view)
  ready: boolean; // true once the initial load has finished
  viewAsNormal: boolean; // super admin is currently impersonating a normal golfer
  setViewAsNormal: (v: boolean) => void;
  setActive: (id: number | null) => void;
  refresh: () => Promise<Golfer[]>;
  updateActive: (patch: { name?: string; handicap?: number | null }) => Promise<void>;
}

const Ctx = createContext<GolferCtx | null>(null);

export function GolferProvider({ children }: { children: ReactNode }) {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [viewAsNormalPref, setViewAsNormalPref] = useState(false);

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
    if (typeof window !== "undefined") {
      setViewAsNormalPref(localStorage.getItem(NORMAL_VIEW_KEY) === "1");
    }
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

  function setViewAsNormal(v: boolean) {
    setViewAsNormalPref(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(NORMAL_VIEW_KEY, v ? "1" : "0");
    }
  }

  // Impersonation only applies to the super admin; ignored for everyone else.
  const viewAsNormal = viewAsNormalPref && !!active?.is_super_admin;
  const viewer: Golfer | null = active
    ? viewAsNormal
      ? { ...active, is_admin: false, is_super_admin: false }
      : active
    : null;

  return (
    <Ctx.Provider
      value={{
        golfers,
        active,
        viewer,
        ready,
        viewAsNormal,
        setViewAsNormal,
        setActive,
        refresh,
        updateActive,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGolfer(): GolferCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGolfer must be used within GolferProvider");
  return ctx;
}
