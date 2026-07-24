"use client";

import Link from "next/link";
import { useState } from "react";
import { Yellowtail } from "next/font/google";
import { auth } from "@/lib/api";
import { useGolfer } from "@/lib/golfer-context";

const logoFont = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <div className="relative">
        <input
          className="input pr-10"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

export default function SignupPage() {
  const { signup } = useGolfer();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false); // second step: enter the emailed code

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      await signup(name, email.trim(), password); // emails a 6-digit code
      setCodeSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start signup");
    } finally {
      setBusy(false);
    }
  }

  if (codeSent) {
    return <VerifyCode email={email.trim()} onBack={() => setCodeSent(false)} />;
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <div className="mb-5 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl">
          <span>⛳</span>
          <span className={`${logoFont.className} text-4xl leading-none`}>Bogey Book</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">Create your account</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">First name</span>
            <input
              className="input"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Last name</span>
            <input
              className="input"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </label>
        </div>
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
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          show={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
        />
        <PasswordField
          label="Re-enter password"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          onToggle={() => setShowConfirm((s) => !s)}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          className="btn-primary w-full"
          disabled={busy || !password || password !== confirm}
        >
          {busy ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-3 text-center text-xs text-gray-400">
        We&apos;ll send a quick welcome email — you will never receive spam emails from us.
      </p>

      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-fairway underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// Step 2: enter the 6-digit code emailed to `email`.
function VerifyCode({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifySignup } = useGolfer();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    setErr(null);
    try {
      await verifySignup(email, code.trim());
      // Shell redirects Home once the account is created + signed in.
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not verify the code");
      setBusy(false);
    }
  }

  async function resend() {
    setErr(null);
    setResent(false);
    try {
      await auth.resendCode(email);
      setResent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not resend the code");
    }
  }

  return (
    <div className="card w-full max-w-sm p-6">
      <div className="mb-5 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl">
          <span>⛳</span>
          <span className={`${logoFont.className} text-4xl leading-none`}>Bogey Book</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">Verify your email</p>
      </div>

      <p className="mb-3 text-sm text-gray-600">
        We emailed a 6-digit code to <span className="font-medium">{email}</span>. Enter
        it below to finish creating your account.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {resent && <p className="text-sm text-fairway">A new code was sent.</p>}
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify & create account"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-gray-500 underline">
          ← Back
        </button>
        <button type="button" onClick={resend} className="font-medium text-fairway underline">
          Resend code
        </button>
      </div>
    </div>
  );
}
