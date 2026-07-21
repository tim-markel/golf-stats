"use client";

import Link from "next/link";
import { useState } from "react";
import { Yellowtail } from "next/font/google";
import { auth } from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";

const logoFont = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });

function Wordmark({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-5 text-center">
      <div className="flex items-center justify-center gap-2 text-2xl">
        <span>⛳</span>
        <span className={`${logoFont.className} text-4xl leading-none`}>Bogey Book</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useGolfer();
  const [mode, setMode] = useState<"login" | "forgot">("login");

  return (
    <div className="card w-full max-w-sm p-6">
      {mode === "login" ? (
        <LoginForm login={login} onForgot={() => setMode("forgot")} />
      ) : (
        <ForgotForm onBack={() => setMode("login")} />
      )}
    </div>
  );
}

function LoginForm({
  login,
  onForgot,
}: {
  login: (email: string, password: string) => Promise<void>;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await login(email.trim(), password);
      // Shell redirects Home once signed in.
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <>
      <Wordmark subtitle="Sign in to your account" />
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onForgot}
          className="text-sm font-medium text-fairway underline"
        >
          Forgot password?
        </button>
      </div>

      <p className="mt-4 text-center text-sm text-gray-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-fairway underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await auth.requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      // 404 when no account has that email
      setErr(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Wordmark subtitle="Reset your password" />
      {sent ? (
        <div className="space-y-3">
          <p className="text-sm text-fairway">
            A password reset link has been sent to {email.trim()}.
          </p>
          <button type="button" onClick={onBack} className="btn-primary w-full">
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send email"}
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm font-medium text-fairway underline"
            >
              Back to sign in
            </button>
          </div>
        </form>
      )}
    </>
  );
}
