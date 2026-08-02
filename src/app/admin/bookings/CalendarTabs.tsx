"use client";

// Sub-navigation shared by /admin/bookings and /admin/cal. The sidebar used to
// carry three separate calendar entries (Bookings, Cal Admin, "Cal in neuem
// Tab") for one thing; they are one nav item now, and this strip switches
// between the two views. The external link keeps its place as a small ↗ at the
// end rather than as its own menu row.
//
// Visual parity with OutreachTabs.

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CalendarTab = "bookings" | "cal";

const TABS: { id: CalendarTab; label: string; href: string }[] = [
  { id: "bookings", label: "Buchungen", href: "/admin/bookings" },
  { id: "cal", label: "Cal Admin", href: "/admin/cal" },
];

export default function CalendarTabs({ active }: { active: CalendarTab }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-6">
      <nav className="inline-flex items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-surface-2 border border-line flex-wrap">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            scroll={false}
            aria-current={active === t.id ? "page" : undefined}
            // Inline style on the active tab: a global `a { color }` rule in the
            // admin CSS otherwise overrides text-accent-fg, making the label dark
            // and invisible on the black active pill. Inline wins.
            style={active === t.id ? { backgroundColor: "var(--fg)", color: "var(--accent-fg)" } : undefined}
            className={cn(
              "inline-flex items-center px-4 py-1.5 rounded-[calc(var(--radius-sm)-2px)] transition-colors [font-family:var(--font-mono)] text-[11px] font-semibold tracking-[0.08em] uppercase",
              active === t.id ? "bg-fg text-accent-fg" : "text-fg-3 hover:text-fg-2 hover:bg-surface",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <a
        href="https://cal.getklar.org"
        target="_blank"
        rel="noopener"
        className="text-[11.5px] text-fg-3 hover:text-fg-2 transition-colors"
      >
        cal.getklar.org ↗
      </a>
    </div>
  );
}
