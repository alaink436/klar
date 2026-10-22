// Every creator in one list for Klar Control > Creators (Alain 2026-10-22: "zusammen mit den Leuten, welche manuell
// akquiriert worden sind"): the platform's accounts (lib/creatorAccounts) and the creators Alain added by hand with a
// short link (lib/creators). A platform creator who switched to a link is in both tables and shows once, as platform.
// Sign-ups without a TikTok yet stay under Bewerbungen; test accounts are left out like everywhere else.

import type { AccountStatus, CreatorAccount } from "./creatorAccounts";
import type { Creator } from "./creators";

export type Origin = "platform" | "manual";

export interface AnyCreator {
  key: string;
  handle: string;
  appName: string;
  origin: Origin;
  status: AccountStatus | "manual";
  followers: number | null;
  hasLink: boolean;
  shortLink: string | null;
  /** Sign-ups in the app through the link, null where the app doesn't count. */
  referrals: number | null;
  /** Payable this month (estimate and link), platform only. */
  monthCents: number | null;
  /** Owed from closed months, platform only. */
  owedCents: number | null;
}

const isTest = (a: Pick<CreatorAccount, "email" | "tiktok_handle">) =>
  a.email.startsWith("klar_test") || a.email.endsWith("@resend.dev") || (a.tiktok_handle ?? "").startsWith("klar_test");

export function mergeCreators(args: {
  accounts: Array<CreatorAccount & { status: AccountStatus }>;
  manual: Creator[];
  appNames: Record<string, string>;
  monthCents: Map<string, number>;
  owedCents: Map<string, number>;
}): AnyCreator[] {
  const manualByKey = new Map(args.manual.map((c) => [`${c.appSlug}/${c.handle.toLowerCase()}`, c]));
  const platform: AnyCreator[] = [];
  for (const a of args.accounts) {
    if (!a.tiktok_handle || isTest(a)) continue;
    const key = `${a.app_slug}/${a.tiktok_handle.toLowerCase()}`;
    const linked = manualByKey.get(key);
    manualByKey.delete(key);
    platform.push({
      key,
      handle: a.tiktok_handle,
      appName: args.appNames[a.app_slug] ?? a.app_slug,
      origin: "platform",
      status: a.status,
      followers: a.followers,
      hasLink: a.has_link,
      shortLink: linked?.shortLink ?? null,
      referrals: linked?.referrals ?? null,
      monthCents: args.monthCents.get(a.id) ?? 0,
      owedCents: args.owedCents.get(a.id) ?? 0,
    });
  }
  const manual: AnyCreator[] = [...manualByKey.entries()].map(([key, c]) => ({
    key,
    handle: c.handle,
    appName: c.appName,
    origin: "manual",
    status: "manual",
    followers: null,
    hasLink: true,
    shortLink: c.shortLink,
    referrals: c.referrals,
    monthCents: null,
    owedCents: null,
  }));
  // Platform first, the ones earning most on top, then confirmed before paused, waiting and closed; then the
  // hand-added ones by name.
  const rank: Record<string, number> = { verified: 0, paused: 1, waiting: 2, closed: 3 };
  platform.sort(
    (x, y) =>
      (y.monthCents ?? 0) + (y.owedCents ?? 0) - ((x.monthCents ?? 0) + (x.owedCents ?? 0)) ||
      (rank[x.status] ?? 9) - (rank[y.status] ?? 9) ||
      x.handle.localeCompare(y.handle),
  );
  manual.sort((x, y) => x.handle.localeCompare(y.handle));
  return [...platform, ...manual];
}
