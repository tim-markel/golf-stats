"use client";

import Link from "next/link";
import { useState } from "react";
import { Yellowtail } from "next/font/google";
import { useGolfer } from "@/lib/golfer-context";

const logoFont = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });

export default function LoginPage() {
  const { login } = useGolfer();
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
      // Shell redirects to Home once signed in.
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <div className="mb-5 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl">
          <span>⛳</span>
          <span className={`${logoFont.className} text-4xl leading-none`}>Bogey Book</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
      </div>

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

      <p className="mt-4 text-center text-sm text-gray-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-fairway underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
