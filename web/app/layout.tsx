import type { Metadata } from "next";
import Link from "next/link";
import { Yellowtail } from "next/font/google";
import "./globals.css";

// Connected script for the wordmark.
const logoFont = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });
import { GolferProvider } from "@/lib/golfer-context";
import NormalViewBadge from "@/components/NormalViewBadge";

export const metadata: Metadata = {
  title: "Bogey Book",
  description: "Track and visualize your golf game, hole by hole.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <GolferProvider>
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
                <Link
                  href="/settings"
                  aria-label="Settings"
                  className="flex items-center rounded-full bg-white/15 p-2 hover:bg-white/25"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </Link>
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
        </GolferProvider>
      </body>
    </html>
  );
}
