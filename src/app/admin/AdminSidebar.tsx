// Admin sidebar as a React component using next/link, so menu switches are
// client-side (SPA) — no full-document reload, no black flash between pages.
// Logout + external Cal stay plain <a> (auth action / new tab). Server-safe
// markup; "use client" only because it reads no server deps and sits inside the
// client AdminShell.
//
// Grouped by workflow, not by tool (2026-08-02, see AI-Brain
// `Projects/Klar/DASHBOARD-REVIEW.md`): the old flat "Studio" block put daily
// work (Inbox, Content) next to infrastructure (Vault, AI-Brain) and carried
// three separate calendar entries. Now:
//   AKQUISE  what brings creators + users in
//   GELD     what comes out
//   APPS     per-app affiliate detail
//   SYSTEM   tools you touch every few weeks
//
// Outreach keeps its entry but sits last in AKQUISE with a pause marker: cold
// outreach has been dormant since the inbound pivot (2026-06-25) and should not
// look like live work.

"use client";

import Link from "next/link";
import { ICON } from "./icons";

function navItem(
  active: string,
  v: string,
  label: string,
  icon: string,
  href: string,
  suffix?: string,
) {
  return (
    <Link key={v} className={`nav ${active === v ? "on" : ""}`} href={href}>
      <span className="d" dangerouslySetInnerHTML={{ __html: icon }} />
      {label}
      {suffix ? (
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.55 }} title="pausiert">
          {suffix}
        </span>
      ) : null}
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

      {navItem(active, "overview", "Übersicht", ICON.overview, "/admin/overview")}

      <div className="navsec">Akquise</div>
      {navItem(active, "inbox", "Inbox", ICON.inbox, "/admin/inbox")}
      {navItem(active, "content", "Content", ICON.content, "/admin/content")}
      {navItem(active, "creators", "Creators", ICON.creators, "/admin/creators")}
      {/* Dormant since the inbound pivot — kept reachable, marked as paused. */}
      {navItem(active, "outreach", "Outreach", ICON.outreach, "/admin/outreach", "⏸")}

      <div className="navsec">Geld</div>
      {navItem(active, "revenue", "Einnahmen", ICON.revenue, "/admin/revenue")}
      {navItem(active, "payouts", "Auszahlungen", ICON.payouts, "/admin/payouts")}
      {navItem(active, "analytics", "Analytics", ICON.analytics, "/admin/analytics")}

      <div className="navsec">Apps</div>
      {apps.length > 0 ? (
        apps.map((a) => navItem(active, a.slug, a.name, ICON.app, `/admin/${a.slug}`))
      ) : (
        <span className="nav muted">
          <span className="d" dangerouslySetInnerHTML={{ __html: ICON.app }} />
          keine Apps
        </span>
      )}

      <div className="navsec">System</div>
      {/* Bookings + Cal Admin were two entries plus an external link for one
          thing; now one entry, the other view is a tab on the page. Both routes
          light the same item, so /admin/cal does not leave the nav unhighlighted. */}
      {navItem(
        active === "cal" ? "bookings" : active,
        "bookings",
        "Termine",
        ICON.calendar,
        "/admin/bookings",
      )}
      {navItem(active, "brain", "AI-Brain", ICON.brain, "/admin/brain")}
      {navItem(active, "vault", "Vault", ICON.key, "/admin/vault")}
      {navItem(active, "settings", "Einstellungen", ICON.lock, "/admin/settings")}

      <div className="spacer" />
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
