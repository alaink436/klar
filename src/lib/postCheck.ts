// SERVER ONLY. Does a creator's post count (migrations/0047, spec Projects/Klar/
// specs/creator-plattform, ticket 04).
//
// Runs on every read of the creators' Apify task (lib/postViews), once per post:
//   no "Basalt" in the caption        -> no_mention
//   creator has a link                -> link (paid through it; any Basalt post is exposure)
//   images match one of his versions  -> counts (lib/imageMatch, majority of the first 4)
//   otherwise                         -> not_ours, or review above REVIEW_VIEWS
// A post made during a 30-day pause is `suspended`. A not_ours post that later
// passes REVIEW_VIEWS moves onto the review list.
//
// Alain decides the review list in Klar Control (reviewPost). Only a post he
// rejects is a strike: 1 warning, 2 a 30-day pause, 3 the account is closed and
// no longer read. Every step mails the creator.

import "server-only";
import { Resend } from "resend";
import { signPaths } from "./creatorKit";
import { MATCH_INLIERS, bestMatch, features, type Features } from "./imageMatch";
import { getForProxy } from "./vault";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c"; // as lib/notifFlusher
const PAUSE_DAYS = 30;
const MAX_IMAGES = 4;

export const REVIEW_VIEWS = 1000;

export type CheckStatus = "counts" | "link" | "no_mention" | "not_ours" | "review" | "approved" | "rejected" | "suspended";
export type RejectReason = "own_content" | "false_claims";

interface Creator {
  id: string;
  email: string;
  tiktok_handle: string;
  has_link: boolean;
  strikes: number;
  suspended_until: string | null;
  closed_at: string | null;
}

export interface CheckRow {
  post_id: string;
  creator_id: string;
  caption: string;
  mentions_basalt: boolean;
  variant_id: string | null;
  checked_slides: number;
  matched_slides: number;
  images: string[];
  status: CheckStatus;
}

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

async function hubGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: headers(), cache: "no-store" });
  return res.ok ? ((await res.json()) as T[]) : [];
}

const inList = (values: string[]) => `in.(${values.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})`;

/** Was the creator paused or closed when he posted? */
export function postedWhilePaused(creator: Pick<Creator, "suspended_until" | "closed_at">, postedAt: Date): boolean {
  if (creator.closed_at && postedAt >= new Date(creator.closed_at)) return true;
  if (!creator.suspended_until) return false;
  const until = new Date(creator.suspended_until);
  const from = new Date(until.getTime() - PAUSE_DAYS * 86_400_000);
  return postedAt >= from && postedAt < until;
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Feature points of every slide the creator was handed, keyed by version. */
async function creatorRefs(creatorId: string): Promise<Array<{ key: string; f: Features }>> {
  const variants = await hubGet<{ id: string; images: string[] }>(`klar_format_variants?creator_id=eq.${creatorId}&select=id,images`);
  const refs: Array<{ key: string; f: Features }> = [];
  for (const v of variants) {
    for (const path of v.images) {
      const res = await fetch(`${HUB}/storage/v1/object/creator-kit/${path}`, { headers: headers(), cache: "no-store" });
      if (res.ok) refs.push({ key: v.id, f: await features(Buffer.from(await res.arrayBuffer())) });
    }
  }
  return refs;
}

/** The decision for one post, given what the scraper returned. */
export async function decide(
  item: Record<string, unknown>,
  creator: Creator,
  refs: () => Promise<Array<{ key: string; f: Features }>>,
): Promise<CheckRow> {
  const postId = String(item.id);
  const caption = typeof item.text === "string" ? item.text : "";
  const views = typeof item.playCount === "number" ? item.playCount : 0;
  const postedAt = new Date((typeof item.createTime === "number" ? item.createTime : 0) * 1000);
  const mentions = /basalt/i.test(caption);
  const row: CheckRow = {
    post_id: postId,
    creator_id: creator.id,
    caption: caption.slice(0, 500),
    mentions_basalt: mentions,
    variant_id: null,
    checked_slides: 0,
    matched_slides: 0,
    images: [],
    status: "not_ours",
  };
  if (postedWhilePaused(creator, postedAt)) return { ...row, status: "suspended" };
  if (!mentions) return { ...row, status: "no_mention" };
  if (creator.has_link) return { ...row, status: "link" };

  const links = (Array.isArray(item.slideshowImageLinks) ? item.slideshowImageLinks : [])
    .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>).tiktokLink : l))
    .filter((l): l is string => typeof l === "string")
    .slice(0, MAX_IMAGES);
  const votes = new Map<string, number>();
  for (const [i, link] of links.entries()) {
    const img = await download(link);
    if (!img) continue;
    // A copy for the review list: TikTok's links expire after about two days.
    const path = `${postId}/${i + 1}.jpg`;
    const up = await fetch(`${HUB}/storage/v1/object/creator-posts/${path}`, {
      method: "POST",
      headers: { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: new Uint8Array(img),
      cache: "no-store",
    });
    if (up.ok) row.images.push(path);
    const f = await features(img);
    const best = await bestMatch(f, await refs());
    f.free();
    row.checked_slides += 1;
    if (best.key) votes.set(best.key, (votes.get(best.key) ?? 0) + best.points);
    if (best.points >= MATCH_INLIERS) row.matched_slides += 1;
  }
  row.variant_id = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (row.checked_slides > 0 && row.matched_slides * 2 > row.checked_slides) return { ...row, status: "counts" };
  return { ...row, status: views > REVIEW_VIEWS ? "review" : "not_ours" };
}

/** Checks the posts of one creators' run that have no check yet. */
export async function checkCreatorPosts(items: unknown[]): Promise<{ checked: number; promoted: number }> {
  const posts = items.filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string");
  const handles = [...new Set(posts.map((p) => String((p.authorMeta as Record<string, unknown> | undefined)?.name ?? "").toLowerCase()).filter(Boolean))];
  if (handles.length === 0) return { checked: 0, promoted: 0 };
  const creators = await hubGet<Creator>(
    `klar_creator_accounts?tiktok_handle=${inList(handles)}&verified_at=not.is.null&select=id,email,tiktok_handle,has_link,strikes,suspended_until,closed_at`,
  );
  const byHandle = new Map(creators.map((c) => [c.tiktok_handle, c]));
  const done = new Map(
    (await hubGet<{ post_id: string; status: CheckStatus }>(`klar_post_checks?post_id=${inList(posts.map((p) => String(p.id)))}&select=post_id,status`)).map(
      (c) => [c.post_id, c.status],
    ),
  );
  const refCache = new Map<string, Promise<Array<{ key: string; f: Features }>>>();
  let checked = 0;
  let promoted = 0;
  try {
    for (const item of posts) {
      const creator = byHandle.get(String((item.authorMeta as Record<string, unknown>).name).toLowerCase());
      if (!creator) continue;
      const before = done.get(String(item.id));
      if (before) {
        if (before === "not_ours" && typeof item.playCount === "number" && item.playCount > REVIEW_VIEWS) {
          await fetch(`${HUB}/rest/v1/klar_post_checks?post_id=eq.${item.id}&status=eq.not_ours`, {
            method: "PATCH",
            headers: headers({ Prefer: "return=minimal" }),
            body: JSON.stringify({ status: "review" }),
          });
          promoted += 1;
        }
        continue;
      }
      const refs = () => {
        if (!refCache.has(creator.id)) refCache.set(creator.id, creatorRefs(creator.id));
        return refCache.get(creator.id)!;
      };
      const row = await decide(item, creator, refs);
      await fetch(`${HUB}/rest/v1/klar_post_checks`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
        body: JSON.stringify(row),
      });
      checked += 1;
    }
  } finally {
    for (const refs of refCache.values()) (await refs).forEach((r) => r.f.free());
  }
  return { checked, promoted };
}

export interface ReviewItem {
  postId: string;
  handle: string;
  url: string | null;
  postedAt: string;
  views: number;
  caption: string;
  matched: string; // "1 von 4"
  postImages: string[];
  ourSlides: string[];
}

/** The review list: posts that mention Basalt, are not ours and passed REVIEW_VIEWS. */
export async function listReviewQueue(): Promise<ReviewItem[]> {
  const checks = await hubGet<CheckRow & { checked_at: string }>("klar_post_checks?status=eq.review&select=*&order=checked_at");
  if (checks.length === 0) return [];
  const ids = checks.map((c) => c.post_id);
  const [posts, views, creators, variants] = await Promise.all([
    hubGet<{ post_id: string; handle: string; url: string | null; posted_at: string }>(`klar_posts?post_id=${inList(ids)}&select=post_id,handle,url,posted_at`),
    hubGet<{ post_id: string; views: number }>(`klar_post_views?post_id=${inList(ids)}&select=post_id,views&order=fetched_at.desc`),
    hubGet<{ id: string; tiktok_handle: string }>(`klar_creator_accounts?id=${inList([...new Set(checks.map((c) => c.creator_id))])}&select=id,tiktok_handle`),
    hubGet<{ id: string; images: string[] }>(`klar_format_variants?id=${inList(checks.map((c) => c.variant_id).filter((v): v is string => !!v))}&select=id,images`),
  ]);
  return Promise.all(
    checks.map(async (c) => {
      const post = posts.find((p) => p.post_id === c.post_id);
      const variant = variants.find((v) => v.id === c.variant_id);
      return {
        postId: c.post_id,
        handle: creators.find((x) => x.id === c.creator_id)?.tiktok_handle ?? "?",
        url: post?.url ?? null,
        postedAt: post?.posted_at ?? c.checked_at,
        views: views.find((v) => v.post_id === c.post_id)?.views ?? 0,
        caption: c.caption,
        matched: `${c.matched_slides} von ${c.checked_slides}`,
        postImages: (await signPaths(c.images, undefined, "creator-posts")).map((s) => s.view),
        ourSlides: variant ? (await signPaths(variant.images.slice(0, 4))).map((s) => s.view) : [],
      };
    }),
  );
}

const MAILS: Record<number, (handle: string, reason: string) => { subject: string; text: string }> = {
  1: (h, r) => ({
    subject: "A post of yours was not counted",
    text: `Hi @${h}, one of your Basalt posts was rejected: ${r}. Without a link in your bio, only the slideshows from your kit count. A second rejection pauses your account for 30 days.`,
  }),
  2: (h, r) => ({
    subject: "Your account is paused for 30 days",
    text: `Hi @${h}, a second post was rejected: ${r}. For the next 30 days your posts don't count and you get no new slideshows. Everything you earned before stays yours. A third rejection closes the account.`,
  }),
  3: (h, r) => ({
    subject: "Your account is closed",
    text: `Hi @${h}, a third post was rejected: ${r}. Your account is closed and we no longer read your posts. What you earned with posts that counted is still paid out.`,
  }),
};
const REASONS: Record<RejectReason, string> = {
  own_content: "it was your own content, which only counts with a link",
  false_claims: "it made promises about Basalt that aren't true",
};

async function mailCreator(to: string, subject: string, text: string): Promise<void> {
  const resend = await getForProxy(RESEND_SECRET_ID);
  if (!resend) return;
  try {
    await new Resend(resend.key).emails.send({ from: "Klar Studios <postfach@getklar.org>", to, subject, text });
  } catch (e) {
    console.warn("[postCheck] mail", e);
  }
}

export type ReviewWrite = { ok: true; msg: string } | { ok: false; msg: string };

/** Alain's decision on a review item. A rejection is a strike with its consequence. */
export async function reviewPost(postId: string, decision: "approve" | "reject", reason?: RejectReason): Promise<ReviewWrite> {
  const [check] = await hubGet<{ post_id: string; creator_id: string; status: CheckStatus }>(`klar_post_checks?post_id=eq.${encodeURIComponent(postId)}&select=post_id,creator_id,status`);
  if (!check || check.status !== "review") return { ok: false, msg: "Dieser Post steht nicht auf der Prüfliste." };
  if (decision === "reject" && !reason) return { ok: false, msg: "Grund fehlt." };
  const now = new Date().toISOString();
  const res = await fetch(`${HUB}/rest/v1/klar_post_checks?post_id=eq.${encodeURIComponent(postId)}&status=eq.review`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(decision === "approve" ? { status: "approved", reviewed_at: now } : { status: "rejected", reject_reason: reason, reviewed_at: now }),
  });
  if (!res.ok) return { ok: false, msg: `Nicht gespeichert (${res.status}).` };
  if (decision === "approve") return { ok: true, msg: "Zählt." };

  const [creator] = await hubGet<Creator>(`klar_creator_accounts?id=eq.${check.creator_id}&select=id,email,tiktok_handle,has_link,strikes,suspended_until,closed_at`);
  if (!creator) return { ok: true, msg: "Abgelehnt." };
  const strikes = creator.strikes + 1;
  const patch: Record<string, unknown> = { strikes };
  if (strikes === 2) patch.suspended_until = new Date(Date.now() + PAUSE_DAYS * 86_400_000).toISOString();
  if (strikes >= 3) patch.closed_at = now;
  await fetch(`${HUB}/rest/v1/klar_creator_accounts?id=eq.${creator.id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (strikes >= 3) {
    await fetch(`${HUB}/rest/v1/klar_view_accounts?platform=eq.tiktok&handle=eq.${encodeURIComponent(creator.tiktok_handle)}&source=eq.creator`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ active: false }),
    });
  }
  const mail = MAILS[Math.min(strikes, 3)](creator.tiktok_handle, REASONS[reason!]);
  await mailCreator(creator.email, mail.subject, mail.text);
  const step = strikes === 1 ? "Verwarnung" : strikes === 2 ? "30 Tage Sperre" : "Konto geschlossen";
  return { ok: true, msg: `Abgelehnt. @${creator.tiktok_handle}: ${strikes}. Verstoss, ${step}.` };
}

export interface CreatorPost {
  postId: string;
  url: string | null;
  postedAt: string;
  views: number;
  status: CheckStatus;
  reason: RejectReason | null;
}

/** The creator's own posts with their status, newest first, for the dashboard. */
export async function listCreatorPosts(creatorId: string): Promise<CreatorPost[]> {
  const checks = await hubGet<{ post_id: string; status: CheckStatus; reject_reason: RejectReason | null }>(
    `klar_post_checks?creator_id=eq.${creatorId}&select=post_id,status,reject_reason`,
  );
  if (checks.length === 0) return [];
  const ids = checks.map((c) => c.post_id);
  const [posts, views] = await Promise.all([
    hubGet<{ post_id: string; url: string | null; posted_at: string }>(`klar_posts?post_id=${inList(ids)}&select=post_id,url,posted_at`),
    hubGet<{ post_id: string; views: number }>(`klar_post_views?post_id=${inList(ids)}&select=post_id,views&order=fetched_at.desc`),
  ]);
  return checks
    .map((c) => {
      const p = posts.find((x) => x.post_id === c.post_id);
      return {
        postId: c.post_id,
        url: p?.url ?? null,
        postedAt: p?.posted_at ?? "",
        views: views.find((v) => v.post_id === c.post_id)?.views ?? 0,
        status: c.status,
        reason: c.reject_reason,
      };
    })
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
