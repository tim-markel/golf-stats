import type { Metadata } from "next";

export const metadata: Metadata = { title: "Practice · Bogey Book" };

export default function PracticePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Practice</h1>
      <p className="text-gray-500">Practice tracking is coming soon.</p>
    </div>
  );
}
