// Admin sidebar as a React component using next/link, so menu switches are
// client-side (SPA) — no full-document reload, no black flash between pages.
// Mirrors the old adminSidebar() HTML string 1:1 (same .side/.nav/.brand markup
// and icons); only the internal nav links became <Link>. Logout + external Cal
// stay plain <a> (auth action / new tab). Server component — <Link> needs no
// 'use client'. Replaces the per-page `<aside dangerouslySetInnerHTML={sidebar}>`.

import Link from "next/link";
import { ICON } from "./_shared";

function navItem(active: string, v: string, label: string, icon: string, href: string) {
  return (
    <Link key={v} className={`nav ${active === v ? "on" : ""}`} href={href}>
      <span className="d" dangerouslySetInnerHTML={{ __html: icon }} />
      {label}
    </Link>
  );
}

export default function AdminSidebar({
  active,
  apps,
}: {
  active: string;
  apps: { slug: string; name: string }[];
}) {
  return (
    <aside className="side">
      <Link className="brand" href="/admin/overview" aria-label="Klar Control Home">
        <span className="brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/klar-symbol.png" alt="" width={40} height={40} />
        </span>
        <span className="brand-text">
          <span className="brand-name">Klar</span>
          <span className="brand-sub">Control</span>
        </span>
      </Link>

      <div className="navsec">Studio</div>
      {navItem(active, "overview", "Übersicht", ICON.overview, "/admin/overview")}
      {navItem(active, "inbox", "Inbox", ICON.inbox, "/admin/inbox")}
      {navItem(active, "outreach", "Outreach", ICON.outreach, "/admin/outreach")}
      {navItem(active, "bookings", "Bookings", ICON.calendar, "/admin/bookings")}
      {navItem(active, "cal", "Cal Admin", ICON.calendar, "/admin/cal")}
      {navItem(active, "analytics", "Analytics", ICON.analytics, "/admin/analytics")}
      {navItem(active, "brain", "AI-Brain", ICON.brain, "/admin/brain")}
      {navItem(active, "vault", "Vault", ICON.key, "/admin/vault")}

      <div className="navsec">Affiliate</div>
      {navItem(active, "revenue", "Einnahmen", ICON.revenue, "/admin/revenue")}
      {navItem(active, "payouts", "Auszahlungen", ICON.payouts, "/admin/payouts")}
      {apps.length > 0 ? (
        apps.map((a) => navItem(active, a.slug, a.name, ICON.app, `/admin/${a.slug}`))
      ) : (
        <span className="nav muted">
          <span className="d" dangerouslySetInnerHTML={{ __html: ICON.app }} />
          keine Apps
        </span>
      )}

      <div className="spacer" />
      <a className="nav" href="https://cal.getklar.org" target="_blank" rel="noopener">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.calendar }} />
        Cal in neuem Tab <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>↗</span>
      </a>
      {navItem(active, "settings", "Einstellungen", ICON.lock, "/admin/settings")}
      {/* /admin/logout is a route handler (clears cookies + redirects), not a
          page — it must do a full navigation, so a plain <a> is intentional. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="nav logout" href="/admin/logout">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.logout }} />
        Logout
      </a>
    </aside>
  );
}
