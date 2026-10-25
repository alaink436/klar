// SERVER ONLY. Creator accounts of the creator platform on getklar.org/dashboard
// (migrations/0045, spec Projects/Klar/specs/creator-plattform, ticket 02).
//
// A creator signs up on his own, for Basalt only, without Alain's approval
// (Alain 2026-10-21). He names his TikTok account and proves it is his with a
// bio code. Only a verified account is read (klar_view_accounts, source
// 'creator'), and only then does it belong to him alone: unverified claims never
// block the real owner. With a link in his bio he also gets a short link
// (klar_creator_links) and is paid through it instead of the estimate.
//
// Dashboard first since 2026-10-22 (Alain: "nach dem Mail-Link sofort das eigene
// Dashboard", "so wenig Friktion wie möglich"): the account is created at the
// first login (ensureCreatorAccount) and gets its kit at once; the TikTok account
// is connected inside the dashboard with nothing but the username (connectTiktok).

import "server-only";
import { readTiktokProfile } from "./contentWarmup";
import { addCreator } from "./creators";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const TABLE = `${HUB}/rest/v1/klar_creator_accounts`;

/** The only app creators can sign up for in v1. */
export const CREATOR_APP = "basalt";

// TikTok usernames: letters, digits, underscore, dot; 2 to 24 characters.
const HANDLE_RE = /^[a-z0-9_.]{2,24}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
// No 0/O, 1/I/L: the creator types the code by hand into his bio.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface CreatorAccount {
  id: string;
  user_id: string;
  email: string;
  app_slug: string;
  /** null until the creator connects his TikTok in the dashboard */
  tiktok_handle: string | null;
  country: string | null;
  platforms: string[];
  has_link: boolean;
  bio_code: string;
  verified_at: string | null;
  created_at: string;
  strikes: number;
  suspended_until: string | null;
  closed_at: string | null;
  followers: number | null;
  /** When he accepted the creator terms, with his first Wise details (migrations/0053). */
  terms_accepted_at?: string | null;
  /** The warning after 7 days without a counted post, and why the account was closed (migrations/0055). */
  inactive_warned_at?: string | null;
  closed_reason?: "inactive" | null;
}

/** From here TikTok lets a creator put a link in his bio. */
export const LINK_FOLLOWERS = 1000;

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

/** "@Name", "name" or a profile URL to the bare lowercase handle; null if it is not one. */
export function normaliseHandle(raw: string): string | null {
  let h = raw.trim().toLowerCase();
  const fromUrl = h.match(/tiktok\.com\/@([^/?#\s]+)/);
  if (fromUrl) h = fromUrl[1];
  h = h.replace(/^@/, "");
  return HANDLE_RE.test(h) ? h : null;
}

export function newBioCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `klar-${code}`;
}

/** Case-insensitive: TikTok keeps the bio as typed, people type as they like. */
export function bioHasCode(bio: string, code: string): boolean {
  return bio.toLowerCase().includes(code.toLowerCase());
}

export async function getCreatorAccount(userId: string): Promise<CreatorAccount | null> {
  const res = await fetch(`${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as CreatorAccount[];
  return rows[0] ?? null;
}

/** The signed-in user's account, created on his first visit to the dashboard. */
export async function ensureCreatorAccount(userId: string, email: string): Promise<{ account: CreatorAccount; created: boolean } | null> {
  const existing = await getCreatorAccount(userId);
  if (existing) return { account: existing, created: false };
  // Two tabs opening at once: the unique user_id lets one insert win, the other reads it back.
  const res = await fetch(`${TABLE}?on_conflict=user_id`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=representation" }),
    body: JSON.stringify({ user_id: userId, email, app_slug: CREATOR_APP, bio_code: newBioCode() }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const [row] = (await res.json()) as CreatorAccount[];
  if (row) return { account: row, created: true };
  const raced = await getCreatorAccount(userId);
  return raced ? { account: raced, created: false } : null;
}

export type AccountStatus = "unconnected" | "waiting" | "verified" | "paused" | "closed";

export function accountStatus(
  a: Pick<CreatorAccount, "tiktok_handle" | "verified_at" | "suspended_until" | "closed_at">,
  now: number,
): AccountStatus {
  if (a.closed_at) return "closed";
  if (a.suspended_until && Date.parse(a.suspended_until) > now) return "paused";
  if (a.verified_at) return "verified";
  return a.tiktok_handle ? "waiting" : "unconnected";
}

/** Every sign-up, newest first, with its status: Klar Control > Bewerbungen. */
export async function listCreatorAccounts(): Promise<Array<CreatorAccount & { status: AccountStatus }>> {
  const res = await fetch(`${TABLE}?select=*&order=created_at.desc&limit=200`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return [];
  const now = Date.now();
  return ((await res.json()) as CreatorAccount[]).map((a) => ({ ...a, status: accountStatus(a, now) }));
}

/** How long the 6-hour run keeps reading the bio of someone who connected a TikTok but isn't confirmed yet. */
export const AUTO_CHECK_DAYS = 7;
/** At most this many per run: each is one Evomi read, and the webhook has 60 s. */
export const AUTO_CHECK_MAX = 10;

/** Accounts waiting for their bio code, connected at most AUTO_CHECK_DAYS ago, longest waiting first; no test accounts. */
export async function listWaitingAccounts(now = Date.now()): Promise<CreatorAccount[]> {
  const since = new Date(now - AUTO_CHECK_DAYS * 86_400_000).toISOString();
  const res = await fetch(
    `${TABLE}?verified_at=is.null&tiktok_handle=not.is.null&closed_at=is.null&email=not.like.klar_test*&estimate_accepted_at=gte.${since}&select=*&order=estimate_accepted_at.asc&limit=${AUTO_CHECK_MAX}`,
    { headers: headers(), cache: "no-store" },
  );
  return res.ok ? ((await res.json()) as CreatorAccount[]) : [];
}

// The dashboard opened on this day (ticket 02). Earlier logins in the hub's Auth
// are the affiliate era's and say nothing about the sign-up form.
const DASHBOARD_SINCE = Date.parse("2026-10-21T00:00:00Z");

interface AuthUser {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
}

export interface UnfinishedSignup {
  userId: string;
  email: string;
  signedInAt: string;
}

/** Signed in to the dashboard but never sent the sign-up form: who got stuck there. */
export function unfinishedSignups(users: AuthUser[], withAccount: Set<string>): UnfinishedSignup[] {
  return users
    .filter((u) => u.email && u.last_sign_in_at && Date.parse(u.last_sign_in_at) >= DASHBOARD_SINCE && !withAccount.has(u.id))
    .map((u) => ({ userId: u.id, email: u.email as string, signedInAt: u.last_sign_in_at as string }))
    .sort((a, b) => b.signedInAt.localeCompare(a.signedInAt));
}

export async function listUnfinishedSignups(): Promise<UnfinishedSignup[]> {
  // One page holds 1000 users; the hub's Auth had 93 on 2026-10-22.
  const [usersRes, accountsRes] = await Promise.all([
    fetch(`${HUB}/auth/v1/admin/users?per_page=1000`, { headers: headers(), cache: "no-store" }),
    fetch(`${TABLE}?select=user_id`, { headers: headers(), cache: "no-store" }),
  ]);
  if (!usersRes.ok || !accountsRes.ok) return [];
  const { users } = (await usersRes.json()) as { users: AuthUser[] };
  const accounts = (await accountsRes.json()) as Array<{ user_id: string }>;
  return unfinishedSignups(users, new Set(accounts.map((a) => a.user_id)));
}

/** Is the handle already someone else's: a verified creator or one of our own accounts? */
async function handleTaken(handle: string, exceptId?: string): Promise<boolean> {
  const h = encodeURIComponent(handle);
  const [creators, accounts] = await Promise.all([
    fetch(`${TABLE}?tiktok_handle=eq.${h}&verified_at=not.is.null&select=id`, { headers: headers(), cache: "no-store" }),
    fetch(`${HUB}/rest/v1/klar_view_accounts?platform=eq.tiktok&handle=eq.${h}&source=eq.own&select=id`, {
      headers: headers(),
      cache: "no-store",
    }),
  ]);
  if (!creators.ok || !accounts.ok) return true; // fail closed, the creator can retry
  const verified = (await creators.json()) as Array<{ id: string }>;
  const own = (await accounts.json()) as Array<{ id: string }>;
  return own.length > 0 || verified.some((r) => r.id !== exceptId);
}

export type ConnectError = "bad_handle" | "handle_taken" | "exists" | "hub";

/** "Connect your TikTok": only the username. Pressing the button is the consent to the estimate (the sentence sits
    next to it); the country comes from the request's IP when there is one; TikTok only, no link until the creator
    asks for one (offered from LINK_FOLLOWERS). Until verified the creator may connect a different account. */
export async function connectTiktok(
  account: CreatorAccount,
  input: { handle: string; country?: string | null },
): Promise<{ ok: true } | { ok: false; error: ConnectError }> {
  const handle = normaliseHandle(input.handle);
  if (!handle) return { ok: false, error: "bad_handle" };
  if (account.verified_at) return { ok: false, error: "exists" };
  if (await handleTaken(handle)) return { ok: false, error: "handle_taken" };
  const country = (input.country ?? "").trim().toUpperCase();
  const res = await fetch(`${TABLE}?id=eq.${account.id}&verified_at=is.null`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      tiktok_handle: handle,
      country: COUNTRY_RE.test(country) ? country : account.country,
      estimate_accepted_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  return res.ok ? { ok: true } : { ok: false, error: "hub" };
}

/** "Use a different account" on the bio code step, for a typo in the username. */
export async function disconnectTiktok(account: CreatorAccount): Promise<boolean> {
  if (account.verified_at) return false;
  const res = await fetch(`${TABLE}?id=eq.${account.id}&verified_at=is.null`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ tiktok_handle: null }),
    cache: "no-store",
  });
  return res.ok;
}

/** getklar.org/<short_path>/<handle> of a verified creator with a link. */
export async function creatorShortLink(account: CreatorAccount): Promise<string | null> {
  if (!account.has_link || !account.verified_at || !account.tiktok_handle) return null;
  const res = await fetch(`${HUB}/rest/v1/klar_creator_apps?slug=eq.${encodeURIComponent(account.app_slug)}&select=short_path&limit=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const [app] = (await res.json()) as Array<{ short_path: string }>;
  return app ? `https://getklar.org/${app.short_path}/${account.tiktok_handle}` : null;
}

export type VerifyError = "no_handle" | "profile_unreadable" | "code_missing" | "handle_taken" | "hub";

/** Reads the bio; with the code in it the account is the creator's, is read
    from the next run on and, with a link, gets its short link. The steps after
    the bio check are idempotent, so a retry after a hiccup finishes the job. */
export async function verifyCreatorAccount(
  account: CreatorAccount,
): Promise<{ ok: true } | { ok: false; error: VerifyError }> {
  const handle = account.tiktok_handle;
  if (!handle) return { ok: false, error: "no_handle" };
  if (!account.verified_at) {
    const profile = await readTiktokProfile(handle);
    if (!profile.ok) return { ok: false, error: "profile_unreadable" };
    if (!bioHasCode(profile.bio, account.bio_code)) return { ok: false, error: "code_missing" };
    if (await handleTaken(handle, account.id)) return { ok: false, error: "handle_taken" };

    // The followers from the same read, so the link offer from LINK_FOLLOWERS shows at once, not only once the
    // creators' run has found a post (Alain 2026-10-22: "so, dass man das direkt sieht").
    const res = await fetch(`${TABLE}?id=eq.${account.id}&verified_at=is.null`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ verified_at: new Date().toISOString(), ...(profile.followers !== null && { followers: profile.followers }) }),
      cache: "no-store",
    });
    // 409: someone verified the same handle a moment earlier (unique index).
    if (res.status === 409) return { ok: false, error: "handle_taken" };
    if (!res.ok) return { ok: false, error: "hub" };
  }

  const read = await fetch(`${HUB}/rest/v1/klar_view_accounts?on_conflict=platform,handle`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ platform: "tiktok", handle, app_slug: account.app_slug, source: "creator" }),
    cache: "no-store",
  });
  if (!read.ok) return { ok: false, error: "hub" };
  if (account.has_link) await addCreator(account.app_slug, handle, handle);
  return { ok: true };
}

/** The creator switches to a bio link (offered from LINK_FOLLOWERS). His posts
    from now on are `link` and paid through it; posts counted before stay with
    the estimate. */
export async function switchToLink(account: CreatorAccount): Promise<boolean> {
  if (!account.verified_at || account.closed_at || !account.tiktok_handle) return false;
  if (!account.has_link) {
    const res = await fetch(`${TABLE}?id=eq.${account.id}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ has_link: true }),
      cache: "no-store",
    });
    if (!res.ok) return false;
  }
  return (await addCreator(account.app_slug, account.tiktok_handle, account.tiktok_handle)).ok;
}
