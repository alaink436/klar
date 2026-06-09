"use client";

// URL-driven sub-navigation for /admin/outreach. A `?tab=` query param drives
// which panel page.tsx shows, so tab state is shareable, survives the 15s
// auto-refresh <meta>, and POST handlers can deep-link back (e.g.
// ?view=outreach&tab=scrape). next/link keeps the admin shell mounted (SPA-nav),
// matching the sidebar. Visual parity with the shadcn Tabs trigger classes.

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OutreachFilterState } from "./OutreachFilters";

export type OutreachTab = "pipeline" | "abrechnung" | "sperrliste" | "scrape";

const TABS: { id: OutreachTab; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "abrechnung", label: "Abrechnung" },
  { id: "sperrliste", label: "Sperrliste" },
  { id: "scrape", label: "Scrape-Einstellungen" },
];

export default function OutreachTabs({
  active,
  filterParams,
}: {
  active: OutreachTab;
  filterParams: OutreachFilterState;
}) {
  // Carry the Pipeline filter params across tab switches so a filtered view
  // survives a round-trip to Abrechnung/Scrape and back.
  const href = (id: OutreachTab) => {
    const p = new URLSearchParams();
    p.set("tab", id);
    if (filterParams.platform !== "all") p.set("p", filterParams.platform);
    if (filterParams.status !== "all") p.set("s", filterParams.status);
    if (filterParams.app !== "all") p.set("a", filterParams.app);
    if (filterParams.size !== "all") p.set("sz", filterParams.size);
    if (filterParams.q) p.set("q", filterParams.q);
    if (filterParams.autoRefresh) p.set("ar", "1");
    if (filterParams.showTests) p.set("show_tests", "1");
    return `/admin/outreach?${p.toString()}`;
  };
  return (
    <nav className="inline-flex items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-surface-2 border border-line mb-6 flex-wrap">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          scroll={false}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-[calc(var(--radius-sm)-2px)] transition-colors [font-family:var(--font-mono)] text-[11px] font-semibold tracking-[0.08em] uppercase",
            active === t.id ? "bg-fg text-accent-fg" : "text-fg-3 hover:text-fg-2 hover:bg-surface",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
