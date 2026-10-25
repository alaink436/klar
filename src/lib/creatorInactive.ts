// SERVER ONLY. Creators who sign up and don't post (Alain 2026-10-24: "eine Warnemail, und danach kicken wir sie
// automatisch raus"). Of the first three sign-ups none posted a slideshow: one never came back after signing up, one
// posts his own anime edits every day. Nobody had reminded them either.
//
// Once a day from the creator-model cron (migrations/0055):
//   7 days without a counted post        -> warning mail, stamped in inactive_warned_at
//   3 days after the warning, still none -> closed like after three strikes (lib/postCheck): closed_at with
//                                           closed_reason 'inactive', no longer read, a mail saying so
// Days run from sign-up, the last counted post or the end of a pause, whichever is latest, so a creator who posts
// after the warning simply starts over. Counted means our post check recognised it: counts, approved, or a Basalt
// post of a link creator. Days are calendar days in UTC, so the cron at 04:30 hits the same day every time.
// Back in by hand (Alain, after a reply): closed_at, closed_reason and inactive_warned_at to null, the view account
// active again; he then gets a fresh warning the next morning and three days to post.

import "server-only";
import { inactiveClosedMail, inactiveWarnMail, sendCreatorMail } from "./creatorMail";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const DAY = 86_400_000;

export const WARN_DAYS = 7;
export const CLOSE_DAYS = 3;

export interface InactiveAccount {
  id: string;
  email: string;
  tiktok_handle: string;
  created_at: string;
  suspended_until: string | null;
  inactive_warned_at: string | null;
}

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

async function hubGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: headers(), cache: "no-store" });
  return res.ok ? ((await res.json()) as T[]) : [];
}

const utcDay = (t: number) => Math.floor(t / DAY);

/** What today's run does with one account; lastPost is his latest counted post, if any. */
export function inactiveStep(a: InactiveAccount, lastPost: string | null, now: number): "warn" | "close" | null {
  if (a.suspended_until && Date.parse(a.suspended_until) > now) return null; // paused: he can't post anything that counts
  const start = Math.max(Date.parse(a.created_at), lastPost ? Date.parse(lastPost) : 0, a.suspended_until ? Date.parse(a.suspended_until) : 0);
  const warned = a.inactive_warned_at ? Date.parse(a.inactive_warned_at) : null;
  if (warned !== null && warned > start) return utcDay(now) - utcDay(warned) >= CLOSE_DAYS ? "close" : null;
  return utcDay(now) - utcDay(start) >= WARN_DAYS ? "warn" : null;
}

export async function runInactiveCreators(now = Date.now()): Promise<{ warned: string[]; closed: string[] }> {
  const [accounts, checks] = await Promise.all([
    hubGet<InactiveAccount>(
      "klar_creator_accounts?closed_at=is.null&tiktok_handle=not.is.null&email=not.like.klar_test*&select=id,email,tiktok_handle,created_at,suspended_until,inactive_warned_at",
    ),
    hubGet<{ creator_id: string; checked_at: string }>("klar_post_checks?status=in.(counts,approved,link)&select=creator_id,checked_at"),
  ]);
  const last = new Map<string, string>();
  for (const c of checks) if (!last.has(c.creator_id) || c.checked_at > last.get(c.creator_id)!) last.set(c.creator_id, c.checked_at);

  const stamp = new Date(now).toISOString();
  const warned: string[] = [];
  const closed: string[] = [];
  for (const a of accounts) {
    const step = inactiveStep(a, last.get(a.id) ?? null, now);
    if (step === "warn") {
      const res = await fetch(`${HUB}/rest/v1/klar_creator_accounts?id=eq.${a.id}&closed_at=is.null`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ inactive_warned_at: stamp }),
      });
      if (!res.ok) continue; // no stamp, no mail: otherwise he'd get one every morning
      // the last day to post is the one before the closing run; the 6-hour check reads it at midnight, before 04:30
      await sendCreatorMail(a.email, inactiveWarnMail(a.tiktok_handle, new Date(now + (CLOSE_DAYS - 1) * DAY), last.has(a.id)));
      warned.push(a.tiktok_handle);
    }
    if (step === "close") {
      const res = await fetch(`${HUB}/rest/v1/klar_creator_accounts?id=eq.${a.id}&closed_at=is.null`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ closed_at: stamp, closed_reason: "inactive" }),
      });
      if (!res.ok) continue;
      await fetch(`${HUB}/rest/v1/klar_view_accounts?platform=eq.tiktok&handle=eq.${encodeURIComponent(a.tiktok_handle)}&source=eq.creator`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ active: false }),
      });
      await sendCreatorMail(a.email, inactiveClosedMail(a.tiktok_handle));
      closed.push(a.tiktok_handle);
    }
  }
  return { warned, closed };
}
