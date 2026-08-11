// Admin sidebar as a React component using next/link, so menu switches are
// client-side (SPA) — no full-document reload, no black flash between pages.
// Logout + external Cal stay plain <a> (auth action / new tab).
//
// Two things the shape encodes, both from 2026-08-11:
//   - Collabs sits in Studio right under Inbox with a count of unanswered
//     requests. Incoming mail from the bios is the channel that actually
//     brings people in; it used to be a tab two clicks deep inside Outreach.
//   - Creator (affiliate revenue, payouts, the per-app pages) is collapsed
//     into a <details>. That whole branch is dormant, so it should not cost
//     six permanent rows — but it stays one click away, not deleted.

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ICON } from "./icons";
import LangSwitch from "./LangSwitch";
import { tAdmin, type AdminLang } from "./_i18n";
import { LISTED_APPS, resolveBackendKey } from "@/lib/klarApps";

function navItem(
  active: string,
  v: string,
  label: string,
  icon: string,
  href: string,
  trailing?: ReactNode,
) {
  return (
    <Link key={v} className={`nav ${active === v ? "on" : ""}`} href={href}>
      <span className="d" dangerouslySetInnerHTML={{ __html: icon }} />
      {label}
      {trailing}
    </Link>
  );
}

export default function AdminSidebar({
  active,
  apps,
  lang,
  collabOpen = 0,
}: {
  active: string;
  apps: { slug: string; name: string }[];
  lang: AdminLang;
  /** Unanswered collab requests — the badge next to the Collabs entry. */
  collabOpen?: number;
}) {
  const t = tAdmin(lang);

  // The per-app pages are driven by KLAR_ADMIN_APPS, but their NAME and ICON
  // come from the app roster: the env entry only carries the backend key, and
  // for a recycled backend (Anime Vault runs on promillio's project) that key
  // is not the brand. Walking the roster instead of the env also means each
  // app can appear only once, whatever the env happens to contain.
  const wired = new Set(apps.map((a) => a.slug));
  const appNav = LISTED_APPS.map((meta) => ({ meta, slug: resolveBackendKey(meta, wired) })).filter((a) =>
    wired.has(a.slug),
  );
  const creatorActive =
    active === "revenue" || active === "payouts" || appNav.some((a) => active === a.slug);

  return (
    <aside className="side">
      <Link className="brand" href="/admin/overview" aria-label={t.brandHome}>
        <span className="brand-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/klar-symbol.png" alt="" width={40} height={40} />
        </span>
        <span className="brand-text">
          <span className="brand-name">Klar</span>
          <span className="brand-sub">Control</span>
        </span>
      </Link>

      <div className="navsec">{t.sectionStudio}</div>
      {navItem(active, "overview", t.navOverview, ICON.overview, "/admin/overview")}
      {navItem(active, "inbox", t.navInbox, ICON.inbox, "/admin/inbox")}
      {navItem(
        active,
        "collabs",
        t.navCollabs,
        ICON.reply,
        "/admin/collabs",
        collabOpen > 0 ? (
          <span className="nav-badge" aria-label={t.collabOpenAria(collabOpen)}>
            {collabOpen}
          </span>
        ) : undefined,
      )}
      {navItem(active, "outreach", t.navOutreach, ICON.outreach, "/admin/outreach")}
      {navItem(active, "content", t.navContent, ICON.content, "/admin/content")}
      {navItem(active, "bookings", t.navBookings, ICON.calendar, "/admin/bookings")}
      {navItem(active, "cal", t.navCal, ICON.calendar, "/admin/cal")}
      {navItem(active, "analytics", t.navAnalytics, ICON.analytics, "/admin/analytics")}
      {navItem(active, "brain", t.navBrain, ICON.brain, "/admin/brain")}
      {navItem(active, "vault", t.navVault, ICON.key, "/admin/vault")}

      {/* Dormant branch: closed unless you are standing in it. `key` forces the
          open state to follow navigation instead of sticking from before. */}
      <details key={String(creatorActive)} open={creatorActive} className="navgroup">
        <summary className="navsec navsec-toggle">
          {t.sectionCreator}
          <span className="navsec-note">{t.sectionCreatorNote}</span>
        </summary>
        {navItem(active, "revenue", t.navRevenue, ICON.revenue, "/admin/revenue")}
        {navItem(active, "payouts", t.navPayouts, ICON.payouts, "/admin/payouts")}
        {appNav.length > 0 ? (
          appNav.map(({ meta, slug }) => (
            <Link key={slug} className={`nav ${active === slug ? "on" : ""}`} href={`/admin/${slug}`}>
              <span className="d">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="nav-appicon" src={meta.icon} alt="" width={16} height={16} loading="lazy" />
              </span>
              {meta.name}
            </Link>
          ))
        ) : (
          <span className="nav muted">
            <span className="d" dangerouslySetInnerHTML={{ __html: ICON.app }} />
            {t.navNoApps}
          </span>
        )}
      </details>

      <div className="spacer" />
      <LangSwitch lang={lang} />
      <a className="nav" href="https://cal.getklar.org" target="_blank" rel="noopener">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.calendar }} />
        {t.navCalNewTab} <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>↗</span>
      </a>
      {navItem(active, "settings", t.navSettings, ICON.lock, "/admin/settings")}
      {/* /admin/logout is a route handler (clears cookies + redirects), not a
          page — it must do a full navigation, so a plain <a> is intentional. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="nav logout" href="/admin/logout">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.logout }} />
        {t.navLogout}
      </a>
    </aside>
  );
}
