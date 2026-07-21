"use client";

import Link from "next/link";
import { useState } from "react";
import { api, Golfer } from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";

type Tab = "profile" | "users";

function isManager(g: Golfer): boolean {
  return g.is_admin || g.is_super_admin;
}

function roleLabel(g: Golfer): string {
  return g.is_super_admin ? "Super Admin" : g.is_admin ? "Admin" : "Normal";
}

function RoleBadge({ g }: { g: Golfer }) {
  const cls = g.is_super_admin
    ? "border-amber-500 bg-amber-500 text-white"
    : g.is_admin
      ? "border-fairway bg-fairway text-white"
      : "border-gray-300 bg-white text-gray-600";
  return <span className={`chip ${cls}`}>{roleLabel(g)}</span>;
}

function KeyIcon() {
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
      className="rotate-45"
      aria-hidden
    >
      <circle cx="12" cy="6.5" r="3.5" />
      <path d="M12 10v10" />
      <path d="M12 14.5h3" />
      <path d="M12 17.5h2.5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function SettingsPage() {
  const { active, viewer, golfers, ready, updateActive, refresh, setViewAsNormal } = useGolfer();
  const [tab, setTab] = useState<Tab>("profile");

  if (!ready) return <p className="text-sm text-gray-500">Loading…</p>;

  if (!active || !viewer) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">
          No golfer selected.{" "}
          <Link href="/golfers" className="text-fairway underline">
            Choose or create one
          </Link>
          .
        </p>
      </div>
    );
  }

  // The Users tab is admin/super-admin only (uses the effective viewer, so
  // "normal view" impersonation hides it too).
  const canManage = isManager(viewer);
  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    ...(canManage ? [{ id: "users" as Tab, label: "Users" }] : []),
  ];
  const activeTab: Tab = tab === "users" && !canManage ? "profile" : tab;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-black/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === t.id
                  ? "border-fairway text-fairway"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "profile" && (
        <ProfileTab active={active} roleGolfer={viewer} onSave={updateActive} refresh={refresh} />
      )}
      {activeTab === "users" && canManage && (
        <UsersTab
          golfers={golfers}
          viewer={viewer}
          onChange={refresh}
          onViewAsNormal={() => setViewAsNormal(true)}
        />
      )}
    </div>
  );
}

// --- Profile tab: name + handicap + login (email/password) ------------------
function ProfileTab({
  active,
  roleGolfer,
  onSave,
  refresh,
}: {
  active: Golfer;
  roleGolfer: Golfer; // drives the role badge (reflects normal-view impersonation)
  onSave: (patch: { name?: string; handicap?: number | null }) => Promise<void>;
  refresh: () => Promise<Golfer[]>;
}) {
  const [name, setName] = useState(active.name);
  const [hcp, setHcp] = useState(active.handicap != null ? String(active.handicap) : "");
  const [email, setEmail] = useState(active.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailChanged = (email.trim() || null) !== (active.email || null);
  const dirty =
    name.trim() !== active.name ||
    (hcp === "" ? active.handicap != null : Number(hcp) !== active.handicap) ||
    emailChanged ||
    password.length > 0;

  function touched() {
    setSaved(false);
    setErr(null);
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      // name + handicap go through the golfer update
      if (
        name.trim() !== active.name ||
        (hcp === "" ? active.handicap != null : Number(hcp) !== active.handicap)
      ) {
        await onSave({ name: name.trim(), handicap: hcp === "" ? null : Number(hcp) });
      }
      // email + password go through the credentials endpoint
      const creds: { email?: string | null; password?: string } = {};
      if (emailChanged) creds.email = email.trim() ? email.trim() : null;
      if (password) creds.password = password;
      if (Object.keys(creds).length) {
        await api.setCredentials(active.golfer_id, creds);
        await refresh();
      }
      setPassword("");
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Profile</h2>
        <RoleBadge g={roleGolfer} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              touched();
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Handicap (blank to clear)</span>
          <input
            className="input"
            inputMode="decimal"
            value={hcp}
            onChange={(e) => {
              setHcp(e.target.value);
              touched();
            }}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Email</span>
          <input
            className="input"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              touched();
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Password{" "}
            <span className="font-normal text-gray-400">(blank to keep current)</span>
          </span>
          <div className="relative">
            <input
              className="input pr-10"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                touched();
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && !dirty && <span className="text-sm text-fairway">Saved ✓</span>}
      </div>
    </div>
  );
}

// --- Users tab: everyone; managers (admin/super admin) get the key menu -----
function UsersTab({
  golfers,
  viewer,
  onChange,
  onViewAsNormal,
}: {
  golfers: Golfer[];
  viewer: Golfer;
  onChange: () => Promise<Golfer[]>;
  onViewAsNormal: () => void;
}) {
  const canManage = isManager(viewer);

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Users</h2>
        {/* Only admins/super admins may create or switch golfers. */}
        {canManage && (
          <Link href="/golfers" className="btn-ghost">
            🔁 Change or create golfer
          </Link>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        {canManage
          ? "Use the key to manage a golfer's feature flags and login."
          : "Only admins can manage accounts."}
      </p>
      <ul className="divide-y divide-black/5">
        {golfers.map((g) => (
          <UserRow
            key={g.golfer_id}
            g={g}
            viewer={viewer}
            isYou={g.golfer_id === viewer.golfer_id}
            onChange={onChange}
            onViewAsNormal={onViewAsNormal}
          />
        ))}
      </ul>
    </div>
  );
}

function UserRow({
  g,
  viewer,
  isYou,
  onChange,
  onViewAsNormal,
}: {
  g: Golfer;
  viewer: Golfer;
  isYou: boolean;
  onChange: () => Promise<Golfer[]>;
  onViewAsNormal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "admin-change">("menu");
  const [busy, setBusy] = useState(false);

  const canManage = isManager(viewer);
  // The super admin is untouchable except by the super admin themselves.
  const locked = g.is_super_admin && !viewer.is_super_admin;
  // The super admin may impersonate a normal golfer from their own row.
  const showViewAsNormal = viewer.is_super_admin && g.golfer_id === viewer.golfer_id;

  async function toggleAdmin() {
    if (g.is_super_admin) return; // super admin can never be demoted
    setBusy(true);
    try {
      await api.updateGolfer(g.golfer_id, { is_admin: !g.is_admin });
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="font-medium">{g.name}</span>
          {isYou && <span className="ml-2 text-xs text-gray-400">(you)</span>}
          {canManage && (
            <div className="truncate text-xs text-gray-500">
              {g.email || "no login email"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showViewAsNormal && (
            <button onClick={onViewAsNormal} className="btn-ghost px-2.5 py-1 text-xs">
              View as Normal
            </button>
          )}
          <RoleBadge g={g} />
          {canManage && !locked && (
            <button
              onClick={() => {
                setOpen((o) => !o);
                setMode("menu");
              }}
              aria-label={`Manage ${g.name}`}
              aria-expanded={open}
              className={`p-1 transition ${
                open ? "text-fairway" : "text-gray-500 hover:text-fairway"
              }`}
            >
              <KeyIcon />
            </button>
          )}
        </div>
      </div>

      {canManage && !locked && open && (
        <div className="mt-2 rounded-lg border border-black/10 bg-gray-50 p-3">
          {mode === "menu" ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Feature flags
                </div>
                <label className="flex items-center justify-between">
                  <span className="text-sm">
                    Admin
                    {g.is_super_admin && (
                      <span className="ml-2 text-xs text-gray-400">(super admin — locked)</span>
                    )}
                  </span>
                  <button
                    role="switch"
                    aria-checked={g.is_admin}
                    disabled={busy || g.is_super_admin}
                    onClick={toggleAdmin}
                    className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                      g.is_admin ? "bg-fairway" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        g.is_admin ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Reset password
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-ghost"
                    disabled
                    title="Email reset is not built yet"
                  >
                    Send email
                  </button>
                  <button className="btn-ghost" onClick={() => setMode("admin-change")}>
                    Admin change
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <AdminChangeForm
              g={g}
              onDone={async () => {
                await onChange();
                setMode("menu");
              }}
              onCancel={() => setMode("menu")}
            />
          )}
        </div>
      )}
    </li>
  );
}

// --- admin single-handedly sets a user's login email + password -------------
function AdminChangeForm({
  g,
  onDone,
  onCancel,
}: {
  g: Golfer;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(g.email ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body: { email?: string | null; password?: string } = {
        email: email.trim() ? email.trim() : null,
      };
      if (password) body.password = password;
      await api.setCredentials(g.golfer_id, body);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Admin change · {g.name}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">Login email</span>
        <input
          className="input"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500">
          New password (blank to keep current)
        </span>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save login"}
        </button>
        <button className="btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
