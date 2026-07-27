"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/nav";

// Hamburger menu shown only on small screens (the desktop header renders the
// links inline instead). Opens a dropdown with every primary destination.
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu whenever the route changes (a link was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
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
          aria-hidden
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border bg-white py-1 text-gray-900 shadow-lg">
            {NAV_LINKS.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`block px-4 py-2.5 text-left text-sm hover:bg-fairway-light ${
                    active ? "font-semibold text-fairway-dark" : ""
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
