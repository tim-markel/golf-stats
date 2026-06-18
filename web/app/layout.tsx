import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { GolferProvider } from "@/lib/golfer-context";
import SettingsMenu from "@/components/SettingsMenu";

export const metadata: Metadata = {
  title: "People's Golf",
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
        <GolferProvider>
          <header className="sticky top-0 z-30 border-b border-black/10 bg-gradient-to-r from-fairway-dark to-fairway text-white shadow-md">
            <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <span className="text-xl">⛳</span> People&apos;s Golf
              </Link>
              <div className="flex items-center gap-2 text-sm">
                <SettingsMenu />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </GolferProvider>
      </body>
    </html>
  );
}
