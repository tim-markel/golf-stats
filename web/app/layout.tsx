import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GolferProvider } from "@/lib/golfer-context";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Bogey Book",
  description: "Track and visualize your golf game, hole by hole.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d2e",
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
          <Shell>{children}</Shell>
        </GolferProvider>
      </body>
    </html>
  );
}
