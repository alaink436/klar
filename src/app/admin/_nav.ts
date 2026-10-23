// The admin menu, as data. One list that both the sidebar and the settings
// page read, so "which entries exist" is never maintained twice.
//
// Order and visibility are the admin's to change: the sidebar can be dragged,
// the settings page has the same list with checkboxes and move buttons. Both
// write the same `klar_nav` cookie (see nav-action.ts), which the layout reads
// before rendering — so a reordered menu comes back reordered on the server,
// no post-hydration jump.
//
// The bottom of the sidebar (language, settings, logout) is deliberately
// NOT part of this: it is the way out of the workspace and stays put.

import type { AdminMessages } from "./_i18n";

// "studios" (Klar Studios) seit 2026-09-22: alles, was die Apps betrifft, in
// einem eigenen grossen Menue (Alains Ansage).
export type NavSection = "studio" | "studios";

export interface NavItemDef {
  /** Stable id — this is what the cookie stores, so never rename one. */
  id: string;
  /** Key into the message dictionary; the label follows the UI language. */
  labelKey: keyof AdminMessages;
  /** Key into NAV_ICON (see ./nav-icons). */
  icon: string;
  href: string;
  section: NavSection;
  /** The sidebar entry this page sits under as a tab. Pages with it don't get their own sidebar row; the page, its
      URL and its place in the palette stay as they are (Alain 2026-10-22: "übersichtlich, aber nichts an der
      Verdrahtung zerstören"). */
  tabOf?: string;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: "overview", labelKey: "navOverview", icon: "overview", href: "/admin/overview", section: "studio" },
  { id: "todos", labelKey: "navTickets", icon: "check", href: "/admin/todos", section: "studio" },
  { id: "inbox", labelKey: "navInbox", icon: "inbox", href: "/admin/inbox", section: "studio" },
  { id: "bookings", labelKey: "navBookings", icon: "calendar", href: "/admin/bookings", section: "studio" },
  { id: "brain", labelKey: "navBrain", icon: "brain", href: "/admin/brain", section: "studio" },
  { id: "chronik", labelKey: "navChronik", icon: "doc", href: "/admin/chronik", section: "studio", tabOf: "brain" },
  { id: "vault", labelKey: "navVault", icon: "key", href: "/admin/vault", section: "studio" },
  // Klar Studios. Feedback oeffnet die UserJot-Boards der Apps (lib/userjot),
  // daneben die Mails an die Support-Adressen (lib/feedbackStore); der Rest ist
  // aus Studio hierher gezogen.
  { id: "feedback", labelKey: "navFeedback", icon: "chat", href: "/admin/feedback", section: "studios" },
  { id: "content", labelKey: "navContent", icon: "content", href: "/admin/content", section: "studios" },
  // Konten (seit 2026-10-01): jedes Social-Konto mit Login und Passwort an einer
  // Stelle. Passwoerter liegen verschluesselt im Vault, siehe lib/socialAccountsStore.
  { id: "accounts", labelKey: "navAccounts", icon: "lock", href: "/admin/accounts", section: "studios", tabOf: "content" },
  { id: "collabs", labelKey: "navCollabs", icon: "reply", href: "/admin/collabs", section: "studios" },
  { id: "analytics", labelKey: "navAnalytics", icon: "analytics", href: "/admin/analytics", section: "studios" },
  // Creators (seit 2026-10-14): Affiliates mit ihrem Detour-Link und wie viele
  // Nutzer ihnen in der App zugeordnet sind. Direkt unter Analytics (Alains Ansage).
  { id: "creators", labelKey: "navCreators", icon: "creators", href: "/admin/creators", section: "studios" },
  // Formate (seit 2026-10-21): die Slideshows im Kit der Creator, hoechstens 5 an.
  { id: "formats", labelKey: "navFormats", icon: "content", href: "/admin/formate", section: "studios", tabOf: "creators" },
  // Pruefliste (seit 2026-10-21): Creator-Posts, die Basalt nennen, aber keine Fassung sind.
  { id: "review", labelKey: "navReview", icon: "check", href: "/admin/pruefliste", section: "studios", tabOf: "creators" },
  // Modell (seit 2026-10-21): das Rechenmodell hinter der Provision der Creator ohne Link.
  { id: "model", labelKey: "navModel", icon: "analytics", href: "/admin/modell", section: "studios", tabOf: "creators" },
  // Auszahlung (seit 2026-10-21): was Creator zugut haben, Alain gibt jede Auszahlung an Wise frei.
  { id: "payouts", labelKey: "navPayouts", icon: "check", href: "/admin/auszahlung", section: "studios", tabOf: "creators" },
  // Bewerbungen (seit 2026-10-15): das Creator-Formular der Startseite. Die
  // Inbox auf "Anfragen" gefiltert, darum ihr Symbol.
  { id: "bewerbungen", labelKey: "navApplications", icon: "inbox", href: "/admin/bewerbungen", section: "studios", tabOf: "creators" },
  // App-Nutzung aus PostHog (seit 2026-09-17): Starts, Screens, Versionen je
  // App. Eigener Punkt neben Analytics, weil Analytics die Landings und den
  // Umsatz zeigt und diese Seite das Verhalten IN den Apps.
  { id: "app-analytics", labelKey: "navAppAnalytics", icon: "activity", href: "/admin/app-analytics", section: "studios", tabOf: "analytics" },
];

/** The menu entry a path belongs to: the one whose href is the path or its longest prefix. */
export function navItemForPath(path: string): NavItemDef | undefined {
  return NAV_ITEMS.filter((i) => path === i.href || path.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
}

/** The tabs of the group a path belongs to (the sidebar entry first), or null when its page stands alone. */
export function navTabs(path: string): NavItemDef[] | null {
  const item = navItemForPath(path);
  if (!item) return null;
  const leader = item.tabOf ?? item.id;
  const members = NAV_ITEMS.filter((i) => i.id === leader || i.tabOf === leader);
  return members.length > 1 ? members : null;
}

/** What the `klar_nav` cookie carries. Both fields are optional on the wire. */
export interface NavPrefs {
  /** Item ids in the admin's order. Unknown ids are ignored on read. */
  order: string[];
  /** Item ids the admin switched off. The pages stay reachable by URL. */
  hidden: string[];
}

export const NAV_COOKIE = "klar_nav";
export const NAV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_NAV_PREFS: NavPrefs = { order: [], hidden: [] };

/**
 * Parse the cookie defensively. It is a client-writable cookie, so treat every
 * field as hostile: anything that is not a known item id is dropped, and a
 * broken value falls back to the default rather than blanking the menu.
 */
export function parseNavPrefs(raw: string | null | undefined): NavPrefs {
  if (!raw) return DEFAULT_NAV_PREFS;
  try {
    const known = new Set(NAV_ITEMS.map((i) => i.id));
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<NavPrefs>;
    const clean = (arr: unknown): string[] =>
      Array.isArray(arr) ? [...new Set(arr.filter((x): x is string => typeof x === "string" && known.has(x)))] : [];
    return { order: clean(v?.order), hidden: clean(v?.hidden) };
  } catch {
    return DEFAULT_NAV_PREFS;
  }
}

/**
 * The items of one section in the admin's order. An item the admin never moved
 * sits right behind its built-in predecessor in the same section, wherever the
 * admin put that one; without such a predecessor it goes to the end. So a new
 * menu entry added in code shows up where it was placed, instead of silently
 * disappearing behind a stale cookie or landing at the bottom.
 */
export function orderedSection(section: NavSection, prefs: NavPrefs, includeHidden = false): NavItemDef[] {
  const items = NAV_ITEMS.filter((i) => i.section === section && (includeHidden || !prefs.hidden.includes(i.id)));
  const inSection = NAV_ITEMS.filter((i) => i.section === section);
  const rank = (id: string): number => {
    const i = prefs.order.indexOf(id);
    if (i !== -1) return i;
    for (let k = inSection.findIndex((x) => x.id === id) - 1; k >= 0; k--) {
      const j = prefs.order.indexOf(inSection[k].id);
      if (j !== -1) return j + 0.5;
    }
    return Number.MAX_SAFE_INTEGER;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id) || NAV_ITEMS.indexOf(a) - NAV_ITEMS.indexOf(b));
}

/** Full menu in the admin's order, hidden ones included — for the settings list. */
export function orderedAll(prefs: NavPrefs): NavItemDef[] {
  return [
    ...orderedSection("studio", prefs, true),
    ...orderedSection("studios", prefs, true),
  ];
}
