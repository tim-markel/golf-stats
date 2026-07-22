"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Yellowtail } from "next/font/google";
import { useGolfer } from "@/lib/golfer-context";
import NormalViewBadge from "@/components/NormalViewBadge";
import HeaderMenu from "@/components/HeaderMenu";

const logoFont = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });

// Routes reachable without being signed in.
const AUTH_ROUTES = ["/login", "/signup", "/reset-password"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { ready, authGolfer } = useGolfer();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  useEffect(() => {
    if (!ready) return;
    if (!authGolfer && !isAuthRoute) router.replace("/login");
    // Signed-in users skip login/signup, but may still open a reset link.
    if (authGolfer && (pathname === "/login" || pathname === "/signup")) {
      router.replace("/");
    }
  }, [ready, authGolfer, isAuthRoute, pathname, router]);

  if (!ready) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  }

  // Login / signup render bare (no app chrome), centered on a green field; the
  // card stays white.
  if (isAuthRoute) {
    const bg =
      pathname === "/login" || pathname === "/signup"
        ? "bg-gradient-to-br from-fairway-dark to-fairway"
        : "";
    return (
      <main className={`flex flex-1 items-center justify-center p-4 ${bg}`}>{children}</main>
    );
  }

  // Protected route while signed out: a redirect is in flight.
  if (!authGolfer) {
    return <div className="p-8 text-sm text-gray-500">Redirecting to sign in…</div>;
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-gradient-to-r from-fairway-dark to-fairway text-white shadow-md">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex flex-none items-center gap-2">
            <span className="text-xl">⛳</span>
            <span className={`${logoFont.className} whitespace-nowrap text-3xl leading-none`}>
              Bogey Book
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              Home
            </Link>
            <Link href="/rounds/new" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              New Round
            </Link>
            <Link href="/practice" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              Practice
            </Link>
            <Link href="/explore" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              Explore
            </Link>
            <Link href="/leaderboard" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              Leaderboard
            </Link>
            <Link href="/about" className="rounded-lg px-3 py-1.5 hover:bg-white/15">
              About
            </Link>
            <HeaderMenu />
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-8">{children}</main>

      <footer className="border-t border-black/10 bg-[#d3e4d7]">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-5 text-xs">
          <Link href="/" className="text-fairway-dark underline hover:text-fairway">
            Home
          </Link>
          <Link href="/rounds/new" className="text-fairway-dark underline hover:text-fairway">
            New Round
          </Link>
          <Link href="/practice" className="text-fairway-dark underline hover:text-fairway">
            Practice
          </Link>
          <Link href="/explore" className="text-fairway-dark underline hover:text-fairway">
            Explore
          </Link>
          <Link href="/leaderboard" className="text-fairway-dark underline hover:text-fairway">
            Leaderboard
          </Link>
          <Link href="/about" className="text-fairway-dark underline hover:text-fairway">
            About
          </Link>
          <Link href="/settings" className="text-fairway-dark underline hover:text-fairway">
            Settings
          </Link>
        </nav>
      </footer>

      <NormalViewBadge />
    </>
  );
}
