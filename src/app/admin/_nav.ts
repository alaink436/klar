// The admin menu, as data. One list that both the sidebar and the settings
// page read, so "which entries exist" is never maintained twice.
//
// Order and visibility are the admin's to change: the sidebar can be dragged,
// the settings page has the same list with checkboxes and move buttons. Both
// write the same `klar_nav` cookie (see nav-action.ts), which the layout reads
// before rendering — so a reordered menu comes back reordered on the server,
// no post-hydration jump.
//
// The bottom of the sidebar (language, Cal, settings, logout) is deliberately
// NOT part of this: it is the way out of the workspace and stays put.

import type { AdminMessages } from "./_i18n";

export type NavSection = "studio" | "creator";

export interface NavItemDef {
  /** Stable id — this is what the cookie stores, so never rename one. */
  id: string;
  /** Key into the message dictionary; the label follows the UI language. */
  labelKey: keyof AdminMessages;
  /** Key into ICON (see ./icons). */
  icon: string;
  href: string;
  section: NavSection;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: "overview", labelKey: "navOverview", icon: "overview", href: "/admin/overview", section: "studio" },
  { id: "todos", labelKey: "navTodos", icon: "check", href: "/admin/todos", section: "studio" },
  { id: "inbox", labelKey: "navInbox", icon: "inbox", href: "/admin/inbox", section: "studio" },
  { id: "collabs", labelKey: "navCollabs", icon: "reply", href: "/admin/collabs", section: "studio" },
  { id: "outreach", labelKey: "navOutreach", icon: "outreach", href: "/admin/outreach", section: "studio" },
  { id: "content", labelKey: "navContent", icon: "content", href: "/admin/content", section: "studio" },
  { id: "bookings", labelKey: "navBookings", icon: "calendar", href: "/admin/bookings", section: "studio" },
  { id: "cal", labelKey: "navCal", icon: "calendar", href: "/admin/cal", section: "studio" },
  { id: "analytics", labelKey: "navAnalytics", icon: "analytics", href: "/admin/analytics", section: "studio" },
  { id: "brain", labelKey: "navBrain", icon: "brain", href: "/admin/brain", section: "studio" },
  { id: "vault", labelKey: "navVault", icon: "key", href: "/admin/vault", section: "studio" },
  { id: "revenue", labelKey: "navRevenue", icon: "revenue", href: "/admin/revenue", section: "creator" },
  { id: "payouts", labelKey: "navPayouts", icon: "payouts", href: "/admin/payouts", section: "creator" },
];

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
 * The items of one section in the admin's order. Items the admin never moved
 * keep their built-in position relative to each other, appended after the ones
 * that were explicitly ordered — so adding a new menu entry in code shows up
 * instead of silently disappearing behind a stale cookie.
 */
export function orderedSection(section: NavSection, prefs: NavPrefs, includeHidden = false): NavItemDef[] {
  const items = NAV_ITEMS.filter((i) => i.section === section && (includeHidden || !prefs.hidden.includes(i.id)));
  const rank = (id: string) => {
    const i = prefs.order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id) || NAV_ITEMS.indexOf(a) - NAV_ITEMS.indexOf(b));
}

/** Full menu in the admin's order, hidden ones included — for the settings list. */
export function orderedAll(prefs: NavPrefs): NavItemDef[] {
  return [...orderedSection("studio", prefs, true), ...orderedSection("creator", prefs, true)];
}
