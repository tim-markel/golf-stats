"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGolfer } from "@/lib/golfer-context";

// Home redirects to the active golfer's page (or to create/select one).
export default function HomePage() {
  const router = useRouter();
  const { active, ready } = useGolfer();

  useEffect(() => {
    if (!ready) return;
    if (active) router.replace(`/golfers/${active.golfer_id}`);
    else router.replace("/golfers");
  }, [ready, active, router]);

  return <p className="text-gray-500">Loading…</p>;
}
