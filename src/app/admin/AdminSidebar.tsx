// Admin sidebar as a React component using next/link, so menu switches are
// client-side (SPA) — no full-document reload, no black flash between pages.
// Logout + external Cal stay plain <a> (auth action / new tab).
//
// What the shape encodes:
//   - Collabs sits in Studio right under Inbox with a count of unanswered
//     requests. Incoming mail from the bios is the channel that actually
//     brings people in; it used to be a tab two clicks deep inside Outreach.
//   - Creator (affiliate revenue, payouts, the per-app pages) is collapsed
//     into a <details>. That whole branch is dormant, so it should not cost
//     six permanent rows — but it stays one click away, not deleted.
//   - Entries can be dragged into any order and switched off in the settings.
//     Both write the same cookie (see _nav.ts), which the layout reads before
//     rendering, so a reordered menu is already correct on first paint.
//
// The bottom block (language, Cal, settings, logout) is fixed on purpose: it
// is how you leave the workspace and should not be reorderable or hideable.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ICON } from "./icons";
import LangSwitch from "./LangSwitch";
import { setNavPrefs } from "./nav-action";
import { orderedAll, orderedSection, type NavItemDef, type NavPrefs } from "./_nav";
import { tAdmin, type AdminLang } from "./_i18n";
import { LISTED_APPS, resolveBackendKey } from "@/lib/klarApps";

export default function AdminSidebar({
  active,
  apps,
  lang,
  prefs,
  collabOpen = 0,
}: {
  active: string;
  apps: { slug: string; name: string }[];
  lang: AdminLang;
  prefs: NavPrefs;
  /** Unanswered collab requests — the badge next to the Collabs entry. */
  collabOpen?: number;
}) {
  const t = tAdmin(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // The per-app pages are driven by KLAR_ADMIN_APPS, but their NAME and ICON
  // come from the app roster: the env entry only carries the backend key, and
  // for a recycled backend (Anime Vault runs on promillio's project) that key
  // is not the brand. Walking the roster instead of the env also means each
  // app can appear only once, whatever the env happens to contain.
  const wired = new Set(apps.map((a) => a.slug));
  const appNav = LISTED_APPS.map((meta) => ({ meta, slug: resolveBackendKey(meta, wired) })).filter((a) =>
    wired.has(a.slug),
  );

  const studio = orderedSection("studio", prefs);
  const creator = orderedSection("creator", prefs);
  const creatorActive = creator.some((i) => i.id === active) || appNav.some((a) => active === a.slug);

  /** Move `dragged` to where `target` sits, keeping every other id in place. */
  function reorder(dragged: string, target: string) {
    if (dragged === target) return;
    const ids = orderedAll(prefs).map((i) => i.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(target);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    startTransition(async () => {
      await setNavPrefs({ order: ids, hidden: prefs.hidden });
      router.refresh();
    });
  }

  function navRow(item: NavItemDef, trailing?: ReactNode) {
    const isOver = overId === item.id && dragId !== null && dragId !== item.id;
    return (
      <Link
        key={item.id}
        className={`nav ${active === item.id ? "on" : ""}${isOver ? " nav-drop" : ""}`}
        href={item.href}
        title={t.navDragHint}
        draggable
        onDragStart={(e) => {
          setDragId(item.id);
          e.dataTransfer.effectAllowed = "move";
          // Anchors default to dragging their URL; claim the payload so the
          // drop handler sees the item id and no link lands in another window.
          e.dataTransfer.setData("text/plain", item.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOverId(item.id);
        }}
        onDragLeave={() => setOverId((c) => (c === item.id ? null : c))}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.getData("text/plain") || dragId;
          setDragId(null);
          setOverId(null);
          if (dropped) reorder(dropped, item.id);
        }}
      >
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON[item.icon as keyof typeof ICON] ?? ICON.app }} />
        {t[item.labelKey] as string}
        {trailing}
      </Link>
    );
  }

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
      {studio.map((item) =>
        navRow(
          item,
          item.id === "collabs" && collabOpen > 0 ? (
            <span className="nav-badge" aria-label={t.collabOpenAria(collabOpen)}>
              {collabOpen}
            </span>
          ) : undefined,
        ),
      )}

      {/* Dormant branch: closed unless you are standing in it. `key` forces the
          open state to follow navigation instead of sticking from before. */}
      {creator.length > 0 || appNav.length > 0 ? (
        <details key={String(creatorActive)} open={creatorActive} className="navgroup">
          <summary className="navsec navsec-toggle">
            {t.sectionCreator}
            <span className="navsec-note">{t.sectionCreatorNote}</span>
          </summary>
          {creator.map((item) => navRow(item))}
          {appNav.map(({ meta, slug }) => (
            <Link key={slug} className={`nav ${active === slug ? "on" : ""}`} href={`/admin/${slug}`}>
              <span className="d">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="nav-appicon" src={meta.icon} alt="" width={16} height={16} loading="lazy" />
              </span>
              {meta.name}
            </Link>
          ))}
        </details>
      ) : null}

      <div className="spacer" />
      <LangSwitch lang={lang} />
      <a className="nav" href="https://cal.getklar.org" target="_blank" rel="noopener">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.calendar }} />
        {t.navCalNewTab} <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>↗</span>
      </a>
      <Link className={`nav ${active === "settings" ? "on" : ""}`} href="/admin/settings">
        <span className="d" dangerouslySetInnerHTML={{ __html: ICON.lock }} />
        {t.navSettings}
      </Link>
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
