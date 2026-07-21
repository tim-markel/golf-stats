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
const IMPERSONATE_KEY = "impersonatedGolferId";

interface GolferCtx {
  golfers: Golfer[];
  active: Golfer | null; // effective identity — the impersonated golfer while impersonating, else the real account
  viewer: Golfer | null; // effective golfer for role gating (roles stripped in normal view)
  ready: boolean; // true once the initial load has finished
  viewAsNormal: boolean; // super admin is viewing the UI as a normal golfer
  setViewAsNormal: (v: boolean) => void;
  impersonating: boolean; // super admin is acting as another golfer
  impersonate: (id: number) => void;
  stopImpersonating: () => void;
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
  const [impersonatedId, setImpersonatedId] = useState<number | null>(null);

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
      const imp = localStorage.getItem(IMPERSONATE_KEY);
      if (imp) setImpersonatedId(Number(imp));
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
    // While impersonating, never let navigation reassign the *real* account —
    // that would strand the super admin as the impersonated (normal) golfer.
    if (impersonatedId != null) return;
    setActiveId(id);
    if (typeof window === "undefined") return;
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  }

  // The real signed-in account (before any impersonation).
  const realActive = golfers.find((g) => g.golfer_id === activeId) ?? null;
  const canImpersonate = !!realActive?.is_super_admin;

  // While impersonating, the super admin *becomes* the chosen golfer: their
  // identity, role, and data. Only the super admin may impersonate.
  const impersonated =
    canImpersonate && impersonatedId != null
      ? golfers.find((g) => g.golfer_id === impersonatedId) ?? null
      : null;
  const impersonating = impersonated != null;
  const active = impersonated ?? realActive; // effective identity

  async function updateActive(patch: { name?: string; handicap?: number | null }) {
    const id = active?.golfer_id;
    if (id == null) return;
    await api.updateGolfer(id, patch);
    await refresh();
  }

  function setViewAsNormal(v: boolean) {
    setViewAsNormalPref(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(NORMAL_VIEW_KEY, v ? "1" : "0");
    }
  }

  function impersonate(id: number) {
    setImpersonatedId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(IMPERSONATE_KEY, String(id));
    }
  }

  function stopImpersonating() {
    setImpersonatedId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(IMPERSONATE_KEY);
    }
  }

  // Self-heal: if an impersonation is stored but the real account can't
  // impersonate (not a super admin) or the target no longer exists, drop it so
  // no one is left stranded in an unexitable state.
  useEffect(() => {
    if (!ready || impersonatedId == null) return;
    const canStill = !!realActive?.is_super_admin;
    const targetExists = golfers.some((g) => g.golfer_id === impersonatedId);
    if (!canStill || !targetExists) stopImpersonating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, impersonatedId, realActive, golfers]);

  // "View as normal" applies only to the super admin's own identity, and is
  // superseded by impersonation.
  const viewAsNormal =
    viewAsNormalPref && !!realActive?.is_super_admin && !impersonating;
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
        impersonating,
        impersonate,
        stopImpersonating,
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
