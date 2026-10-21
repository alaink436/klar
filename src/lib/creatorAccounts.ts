// SERVER ONLY. Creator accounts of the creator platform on getklar.org/dashboard
// (migrations/0045, spec Projects/Klar/specs/creator-plattform, ticket 02).
//
// A creator signs up on his own, for Basalt only, without Alain's approval
// (Alain 2026-10-21). He names his TikTok account and proves it is his with a
// bio code. Only a verified account is read (klar_view_accounts, source
// 'creator'), and only then does it belong to him alone: unverified claims never
// block the real owner. With a link in his bio he also gets a short link
// (klar_creator_links) and is paid through it instead of the estimate.

import "server-only";
import { readTiktokProfile } from "./contentWarmup";
import { addCreator } from "./creators";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const TABLE = `${HUB}/rest/v1/klar_creator_accounts`;

/** The only app creators can sign up for in v1. */
export const CREATOR_APP = "basalt";
export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

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
  tiktok_handle: string;
  country: string;
  platforms: string[];
  has_link: boolean;
  bio_code: string;
  verified_at: string | null;
  created_at: string;
}

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

export interface SignupInput {
  userId: string;
  email: string;
  handle: string;
  country: string;
  platforms: string[];
  hasLink: boolean;
  acceptedEstimate: boolean;
}

export type SignupError = "bad_handle" | "bad_country" | "bad_platforms" | "no_consent" | "handle_taken" | "exists" | "hub";

export async function createCreatorAccount(
  input: SignupInput,
): Promise<{ ok: true; account: CreatorAccount } | { ok: false; error: SignupError }> {
  const handle = normaliseHandle(input.handle);
  if (!handle) return { ok: false, error: "bad_handle" };
  const country = input.country.trim().toUpperCase();
  if (!COUNTRY_RE.test(country)) return { ok: false, error: "bad_country" };
  const platforms = [...new Set(input.platforms)];
  if (!platforms.includes("tiktok") || platforms.some((p) => !(PLATFORMS as readonly string[]).includes(p))) {
    return { ok: false, error: "bad_platforms" };
  }
  if (!input.acceptedEstimate) return { ok: false, error: "no_consent" };
  if (await getCreatorAccount(input.userId)) return { ok: false, error: "exists" };
  if (await handleTaken(handle)) return { ok: false, error: "handle_taken" };

  const res = await fetch(TABLE, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      user_id: input.userId,
      email: input.email,
      app_slug: CREATOR_APP,
      tiktok_handle: handle,
      country,
      platforms,
      has_link: input.hasLink,
      estimate_accepted_at: new Date().toISOString(),
      bio_code: newBioCode(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: "hub" };
  const rows = (await res.json()) as CreatorAccount[];
  return rows[0] ? { ok: true, account: rows[0] } : { ok: false, error: "hub" };
}

/** getklar.org/<short_path>/<handle> of a verified creator with a link. */
export async function creatorShortLink(account: CreatorAccount): Promise<string | null> {
  if (!account.has_link || !account.verified_at) return null;
  const res = await fetch(`${HUB}/rest/v1/klar_creator_apps?slug=eq.${encodeURIComponent(account.app_slug)}&select=short_path&limit=1`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const [app] = (await res.json()) as Array<{ short_path: string }>;
  return app ? `https://getklar.org/${app.short_path}/${account.tiktok_handle}` : null;
}

export type VerifyError ="profile_unreadable" | "code_missing" | "handle_taken" | "hub";

/** Reads the bio; with the code in it the account is the creator's, is read
    from the next run on and, with a link, gets its short link. The steps after
    the bio check are idempotent, so a retry after a hiccup finishes the job. */
export async function verifyCreatorAccount(
  account: CreatorAccount,
): Promise<{ ok: true } | { ok: false; error: VerifyError }> {
  if (!account.verified_at) {
    const profile = await readTiktokProfile(account.tiktok_handle);
    if (!profile.ok) return { ok: false, error: "profile_unreadable" };
    if (!bioHasCode(profile.bio, account.bio_code)) return { ok: false, error: "code_missing" };
    if (await handleTaken(account.tiktok_handle, account.id)) return { ok: false, error: "handle_taken" };

    const res = await fetch(`${TABLE}?id=eq.${account.id}&verified_at=is.null`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ verified_at: new Date().toISOString() }),
      cache: "no-store",
    });
    // 409: someone verified the same handle a moment earlier (unique index).
    if (res.status === 409) return { ok: false, error: "handle_taken" };
    if (!res.ok) return { ok: false, error: "hub" };
  }

  const read = await fetch(`${HUB}/rest/v1/klar_view_accounts?on_conflict=platform,handle`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify({ platform: "tiktok", handle: account.tiktok_handle, app_slug: account.app_slug, source: "creator" }),
    cache: "no-store",
  });
  if (!read.ok) return { ok: false, error: "hub" };
  if (account.has_link) await addCreator(account.app_slug, account.tiktok_handle, account.tiktok_handle);
  return { ok: true };
}
