// Creator-Funnel as thin monochrome bars, tapering to success green on the
// last stage — same visual language as the outreach funnel on the overview,
// so the two read as the same kind of object.
//
// Presentational only; the numbers come from getCreatorOverview() on the
// server. Reused by /admin/creators and by the overview page.

import type { CreatorFunnel } from "@/lib/creatorTypes";

const G = {
  signup: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  send: `<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>`,
};

function glyph(inner: string, size = 15) {
  return (
    <span
      style={{ display: "inline-flex", color: "var(--fg-3)" }}
      dangerouslySetInnerHTML={{
        __html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${inner}</svg>`,
      }}
    />
  );
}

function Row({ icon, label, n, max, color }: {
  icon: string; label: string; n: number; max: number; color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "9px 0" }}>
      {glyph(icon)}
      <span style={{ minWidth: 104, fontSize: 12.5, color: "var(--fg-2)" }}>{label}</span>
      <div style={{ flex: 1, background: "var(--surface-2)", height: 10, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (n / max) * 100).toFixed(1)}%`, height: "100%", background: color }} />
      </div>
      <span
        style={{
          minWidth: 32, textAlign: "right", fontFamily: "var(--font-mono)",
          fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
      </span>
    </div>
  );
}

export default function CreatorFunnelCard({
  funnel,
  href,
}: {
  funnel: CreatorFunnel;
  /** When set, the card title links through (used on the overview). */
  href?: string;
}) {
  const max = Math.max(1, funnel.applied, funnel.active, funnel.posting);
  const title = "Creator-Funnel · alle Apps";
  return (
    <div className="card" style={{ padding: "20px 22px", display: "block" }}>
      <div className="k" style={{ marginBottom: 14 }}>
        {href ? <a href={href} style={{ textDecoration: "none" }}>{title}</a> : title}
      </div>
      <Row icon={G.signup} label="Beworben" n={funnel.applied} max={max} color="var(--fg)" />
      <Row
        icon={G.check}
        label="Aktiv"
        n={funnel.active}
        max={max}
        color="color-mix(in oklab,var(--fg) 50%,var(--surface-2))"
      />
      <Row icon={G.send} label="Postet" n={funnel.posting} max={max} color="var(--success)" />
      <div className="muted" style={{ fontSize: 11.5, marginTop: 12, fontFamily: "var(--font-mono)" }}>
        {funnel.posts7d} Posts / 7d
        {funnel.views7d > 0 ? ` · ${funnel.views7d.toLocaleString("de-CH")} Views` : ""}
        {funnel.activationRatePct != null ? ` · ${funnel.activationRatePct}% der Aktiven posten` : ""}
      </div>
    </div>
  );
}
