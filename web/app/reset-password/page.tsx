"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { setSession } = useGolfer();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="card w-full max-w-sm p-6">
        <Wordmark subtitle="Reset password" />
        <p className="text-sm text-red-600">This reset link is missing or invalid.</p>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-fairway underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await auth.resetPassword({ token, password });
      await setSession(result); // signs in; Shell redirects Home
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reset your password");
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <Wordmark subtitle="Choose a new password" />
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}
