import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "golf-stats",
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
      <body>
        <header className="bg-fairway text-white">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              ⛳ golf-stats
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Golfers
              </Link>
              <Link href="/rounds/new" className="hover:underline">
                + New round
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
