// SERVER ONLY. The daily TikTok post routines (migrations/0056): their posting times, the posts they scheduled, and
// how those posts did on TikTok.
//
// The cloud routines read their row through GET /api/routines and report every scheduled draft through
// POST /api/routines/posts. Alain changes the times on /admin/routinen. After every read of our own accounts
// (lib/ownViews, through Evomi, every 6 hours) matchRoutinePosts() ties new drafts to the TikTok posts they became (lib/routineMatch).

import "server-only";
import { matchPosts, viewsAt } from "./routineMatch";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const DAY = 86_400_000;

/** The hours Alain can switch on. Full hours, Swiss time; the routines plan at most 48 h ahead. */
export const SLOT_CHOICES = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const SLOT_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const HANDLE_RE = /^[a-z0-9._]{2,24}$/; // TikTok's own rule for usernames

export interface RoutineAccount {
  handle: string;
  blotato_id: string;
}

export interface Routine {
  app_slug: string;
  accounts: RoutineAccount[];
  slots: string[];
  credits: number;
  run_at: string | null;
  active: boolean;
  updated_at: string;
}

export interface RoutinePostIn {
  app_slug: string;
  handle: string;
  name: string;
  format?: string | null;
  caption?: string | null;
  scheduled_for?: string | null;
  blotato_id?: string | null;
}

export interface RoutinePostView {
  id: string;
  app_slug: string;
  handle: string;
  name: string;
  format: string | null;
  scheduledFor: string | null;
  url: string | null;
  postedAt: string | null;
  views24h: number | null;
  views3d: number | null;
  viewsNow: number | null;
}

type Write = { ok: true; msg: string } | { ok: false; msg: string };

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

async function hubGet<T>(path: string): Promise<T[]> {
  if (!HUB_KEY()) return [];
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: headers(), cache: "no-store" });
  return res.ok ? ((await res.json()) as T[]) : [];
}

const inList = (values: string[]) => `in.(${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(",")})`;

export async function listRoutines(): Promise<Routine[]> {
  const rows = await hubGet<Routine>("klar_routines?select=*&order=app_slug");
  return rows.map((r) => ({ ...r, credits: Number(r.credits), slots: [...(r.slots ?? [])].sort() }));
}

async function patchRoutine(app: string, body: Partial<Routine>): Promise<boolean> {
  const res = await fetch(`${HUB}/rest/v1/klar_routines?app_slug=eq.${encodeURIComponent(app)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  return res.ok;
}

/** Switches one posting time of a routine on or off. */
export async function toggleSlot(app: string, slot: string): Promise<Write> {
  if (!SLOT_RE.test(slot)) return { ok: false, msg: "Keine gültige Uhrzeit." };
  const routine = (await listRoutines()).find((r) => r.app_slug === app);
  if (!routine) return { ok: false, msg: "Diese Routine gibt es nicht." };
  const on = routine.slots.includes(slot);
  const slots = on ? routine.slots.filter((s) => s !== slot) : [...routine.slots, slot].sort();
  if (!(await patchRoutine(app, { slots }))) return { ok: false, msg: "Nicht gespeichert." };
  return { ok: true, msg: `${app}: ${slot} ${on ? "aus" : "an"}, ${slots.length} Posts am Tag.` };
}

export async function setRoutineActive(app: string, active: boolean): Promise<Write> {
  if (!(await patchRoutine(app, { active }))) return { ok: false, msg: "Nicht gespeichert." };
  return { ok: true, msg: `${app} ist ${active ? "an" : "aus"}.` };
}

/** Raises or lowers the daily Higgsfield budget by one credit, never below zero. */
export async function stepCredits(app: string, step: 1 | -1): Promise<Write> {
  const routine = (await listRoutines()).find((r) => r.app_slug === app);
  if (!routine) return { ok: false, msg: "Diese Routine gibt es nicht." };
  const credits = Math.max(0, routine.credits + step);
  if (!(await patchRoutine(app, { credits }))) return { ok: false, msg: "Nicht gespeichert." };
  return { ok: true, msg: `${app}: höchstens ${credits} Credits am Tag.` };
}

/** Stores what a routine scheduled. A post sent again under the same name (a resend) updates its row. */
export async function recordRoutinePosts(posts: RoutinePostIn[]): Promise<Write> {
  // The handle must be one of the routine's own accounts: the conflict key is (handle, name), so a foreign pair
  // could otherwise overwrite another routine's row (Codeguard 2026-11-09).
  const accountsOf = new Map((await listRoutines()).map((r) => [r.app_slug, new Set(r.accounts.map((a) => a.handle.toLowerCase()))]));
  // Every text field a string or absent: an array or object would pass slice() and land in full length.
  const text = (v: unknown, max: number): string | null | undefined =>
    v === undefined || v === null ? null : typeof v === "string" ? v.slice(0, max) : undefined;
  const rows = [];
  for (const p of posts) {
    const handle = typeof p.handle === "string" ? p.handle.replace(/^@/, "").toLowerCase() : "";
    const [name, format, caption, scheduledFor, blotatoId] = [
      text(p.name, 80),
      text(p.format, 40),
      text(p.caption, 2200),
      text(p.scheduled_for, 40),
      text(p.blotato_id, 80),
    ];
    if (!accountsOf.get(p.app_slug)?.has(handle) || !HANDLE_RE.test(handle) || !name) {
      return { ok: false, msg: `Unbekannte Routine, Konto oder Post: ${String(p.app_slug)}/${handle}/${String(name)}` };
    }
    if ([format, caption, scheduledFor, blotatoId].includes(undefined)) return { ok: false, msg: `Feld ist kein Text: ${name}` };
    if (scheduledFor && Number.isNaN(Date.parse(scheduledFor))) return { ok: false, msg: `Termin unlesbar: ${name}` };
    rows.push({ app_slug: p.app_slug, handle, name, format, caption, scheduled_for: scheduledFor, blotato_id: blotatoId });
  }
  if (rows.length === 0) return { ok: true, msg: "Nichts zu speichern." };
  const res = await fetch(`${HUB}/rest/v1/klar_routine_posts?on_conflict=handle,name`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, msg: `Nicht gespeichert (${res.status}).` };
  return { ok: true, msg: `${rows.length} Posts gespeichert.` };
}

/** Ties drafts of the last two weeks to the TikTok posts read by Evomi (or Apify). Returns how many new links were made. */
export async function matchRoutinePosts(now = Date.now()): Promise<number> {
  const since = new Date(now - 14 * DAY).toISOString();
  const routine = await hubGet<{ id: string; handle: string; caption: string | null; scheduled_for: string | null; post_id: string | null }>(
    `klar_routine_posts?scheduled_for=gte.${since}&select=id,handle,caption,scheduled_for,post_id`,
  );
  const handles = [...new Set(routine.filter((r) => !r.post_id).map((r) => r.handle))];
  if (handles.length === 0) return 0;
  const tiktok = await hubGet<{ post_id: string; handle: string; caption: string | null; posted_at: string }>(
    `klar_posts?handle=${inList(handles)}&posted_at=gte.${since}&select=post_id,handle,caption,posted_at`,
  );
  const links = matchPosts(
    routine.map((r) => ({ id: r.id, handle: r.handle, caption: r.caption, scheduledFor: r.scheduled_for, postId: r.post_id })),
    tiktok.map((t) => ({ postId: t.post_id, handle: t.handle, caption: t.caption, postedAt: t.posted_at })),
  );
  let made = 0;
  for (const l of links) {
    const res = await fetch(`${HUB}/rest/v1/klar_routine_posts?id=eq.${encodeURIComponent(l.id)}&post_id=is.null`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ post_id: l.postId }),
      cache: "no-store",
    });
    if (res.ok) made++;
  }
  return made;
}

/** The routines' posts of the last `days` days with their views, newest first. */
export async function routinePosts(days = 14, now = Date.now()): Promise<RoutinePostView[]> {
  const since = new Date(now - days * DAY).toISOString();
  const rows = await hubGet<{
    id: string;
    app_slug: string;
    handle: string;
    name: string;
    format: string | null;
    scheduled_for: string | null;
    post_id: string | null;
  }>(`klar_routine_posts?scheduled_for=gte.${since}&select=id,app_slug,handle,name,format,scheduled_for,post_id&order=scheduled_for.desc`);
  const ids = rows.map((r) => r.post_id).filter((p): p is string => Boolean(p));
  const [posts, snaps] = ids.length
    ? await Promise.all([
        hubGet<{ post_id: string; url: string | null; posted_at: string }>(`klar_posts?post_id=${inList(ids)}&select=post_id,url,posted_at`),
        hubGet<{ post_id: string; fetched_at: string; views: number }>(
          `klar_post_views?post_id=${inList(ids)}&select=post_id,fetched_at,views&order=fetched_at.asc`,
        ),
      ])
    : [[], []];
  const postOf = new Map(posts.map((p) => [p.post_id, p]));
  const snapsOf = new Map<string, Array<{ fetchedAt: string; views: number }>>();
  for (const s of snaps) snapsOf.set(s.post_id, [...(snapsOf.get(s.post_id) ?? []), { fetchedAt: s.fetched_at, views: Number(s.views) }]);
  return rows.map((r) => {
    const p = r.post_id ? postOf.get(r.post_id) : undefined;
    const s = (r.post_id && snapsOf.get(r.post_id)) || [];
    return {
      id: r.id,
      app_slug: r.app_slug,
      handle: r.handle,
      name: r.name,
      format: r.format,
      scheduledFor: r.scheduled_for,
      url: p?.url ?? null,
      postedAt: p?.posted_at ?? null,
      views24h: p ? viewsAt(s, p.posted_at, DAY, now) : null,
      views3d: p ? viewsAt(s, p.posted_at, 3 * DAY, now) : null,
      viewsNow: s.length ? s[s.length - 1].views : null,
    };
  });
}

/** Which of the given accounts got a view count in the last two days (read by Evomi, lib/ownViews). */
export async function recentlyRead(handles: string[], now = Date.now()): Promise<Set<string>> {
  if (handles.length === 0) return new Set();
  const posts = await hubGet<{ post_id: string; handle: string }>(
    `klar_posts?handle=${inList(handles.map((h) => h.toLowerCase()))}&posted_at=gte.${new Date(now - 30 * DAY).toISOString()}&select=post_id,handle`,
  );
  if (posts.length === 0) return new Set();
  const read = await hubGet<{ post_id: string }>(
    `klar_post_views?post_id=${inList(posts.map((p) => p.post_id))}&fetched_at=gte.${new Date(now - 2 * DAY).toISOString()}&select=post_id`,
  );
  const handleOf = new Map(posts.map((p) => [p.post_id, p.handle]));
  return new Set(read.map((r) => handleOf.get(r.post_id)!).filter(Boolean));
}
