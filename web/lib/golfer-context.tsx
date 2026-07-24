"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api, auth, AuthResult, Golfer } from "./api";

const TOKEN_KEY = "bb_token";
const NORMAL_VIEW_KEY = "viewAsNormal";
const IMPERSONATE_KEY = "impersonatedGolferId";

interface GolferCtx {
  golfers: Golfer[];
  active: Golfer | null; // effective identity — impersonated golfer while impersonating, else the signed-in account
  viewer: Golfer | null; // effective golfer for role gating (roles stripped in normal view)
  ready: boolean; // true once the initial session check has finished
  authGolfer: Golfer | null; // the real signed-in account (null when logged out)
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>; // sends a verification code
  verifySignup: (email: string, code: string) => Promise<void>; // confirms the code, signs in
  setSession: (result: AuthResult) => Promise<void>;
  logout: () => void;
  viewAsNormal: boolean;
  setViewAsNormal: (v: boolean) => void;
  impersonating: boolean;
  impersonate: (id: number) => void;
  stopImpersonating: () => void;
  refresh: () => Promise<Golfer[]>;
  updateActive: (patch: { name?: string; handicap?: number | null }) => Promise<void>;
}

const Ctx = createContext<GolferCtx | null>(null);

function token(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function GolferProvider({ children }: { children: ReactNode }) {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [authGolfer, setAuthGolfer] = useState<Golfer | null>(null);
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

  // On mount: restore prefs and the session (from the stored token).
  useEffect(() => {
    if (typeof window !== "undefined") {
      setViewAsNormalPref(localStorage.getItem(NORMAL_VIEW_KEY) === "1");
      const imp = localStorage.getItem(IMPERSONATE_KEY);
      if (imp) setImpersonatedId(Number(imp));
    }
    const t = token();
    if (!t) {
      setReady(true);
      return;
    }
    auth
      .me(t)
      .then((g) => {
        setAuthGolfer(g);
        return refresh();
      })
      .catch(() => {
        if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
        setAuthGolfer(null);
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setSession(result: AuthResult) {
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, result.token);
    setAuthGolfer(result.golfer);
    await refresh();
  }

  async function login(email: string, password: string) {
    await setSession(await auth.login({ email, password }));
  }

  async function signup(name: string, email: string, password: string) {
    // Emails a code; the account isn't created until verifySignup succeeds.
    await auth.signup({ name, email, password });
  }

  async function verifySignup(email: string, code: string) {
    await setSession(await auth.verifySignup({ email, code }));
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(IMPERSONATE_KEY);
      localStorage.removeItem(NORMAL_VIEW_KEY);
    }
    setAuthGolfer(null);
    setImpersonatedId(null);
    setViewAsNormalPref(false);
  }

  // The real signed-in account (before any impersonation).
  const realActive = authGolfer;
  const canImpersonate = !!realActive?.is_super_admin;

  // While impersonating, the super admin *becomes* the chosen golfer.
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
    // Refresh the signed-in account too, in case we just edited ourselves.
    const t = token();
    if (t) {
      try {
        setAuthGolfer(await auth.me(t));
      } catch {
        /* keep current */
      }
    }
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

  // Self-heal: drop a stored impersonation that can't apply (not a super admin,
  // or the target no longer exists) so no one is stranded.
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
        authGolfer,
        login,
        signup,
        verifySignup,
        setSession,
        logout,
        viewAsNormal,
        setViewAsNormal,
        impersonating,
        impersonate,
        stopImpersonating,
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
