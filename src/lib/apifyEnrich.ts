// SERVER ONLY. Instagram per-handle enrichment via the Apify profile scraper.
//
// The hybrid integration runs IG enrichment on Apify (NOT Evomi): IG
// business_email/public_email are login-gated, so logged-out Evomi yields almost
// no IG emails, whereas apify~instagram-profile-scraper surfaces businessEmail /
// publicEmail for professional accounts (the exact fields the live n8n "IG Format
// Targets" node read). TikTok stays on Evomi (evomiScraper.ts); this module is the
// IG half so the cron can enrich both behind one NormalizedProfile shape.
//
// Returns EnrichResult[] in input-handle order (same contract as
// evomiScraper.enrichBatch) so the drain loop treats IG and TT identically.

import "server-only";
import type { ApifyCreds } from "./apifyDiscovery";
import type { EnrichResult, NormalizedProfile } from "./evomiScraper";

const APIFY_BASE = "https://api.apify.com/v2";
// IG profile scraper is a fast dataset actor; 180s matches the n8n parity used
// for discovery and is plenty for a bounded per-tick batch.
const APIFY_TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS ?? 180_000);
const IG_PROFILE_ACTOR = "apify~instagram-profile-scraper";

// Raw shape of one apify~instagram-profile-scraper dataset item (loose: every
// field optional, mirroring the defensive reads in the n8n format node).
interface IgProfileItem {
  username?: string;
  url?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number | string;
  businessEmail?: string | null;
  publicEmail?: string | null;
  externalUrl?: string | null;
  externalUrls?: Array<string | { url?: string; title?: string }> | null;
  error?: string; // the actor emits an item with `error` for a private/missing handle
}

function toProfile(it: IgProfileItem): NormalizedProfile | null {
  const username = (it.username ?? "").trim().toLowerCase();
  if (!username || it.error) return null;
  const bioLinks = Array.isArray(it.externalUrls)
    ? it.externalUrls
        .map((u) => (typeof u === "string" ? { url: u } : u && typeof u.url === "string" ? { url: u.url, title: u.title ?? null } : null))
        .filter((x): x is { url: string; title?: string | null } => Boolean(x))
    : [];
  return {
    platform: "instagram",
    handle: username,
    displayName: it.fullName ?? null,
    biography: it.biography ?? "",
    followers: Number(it.followersCount ?? 0) || 0,
    profileUrl: it.url || `https://www.instagram.com/${username}/`,
    businessEmail: it.businessEmail ?? null,
    publicEmail: it.publicEmail ?? null,
    externalUrl: it.externalUrl ?? null,
    bioLinks,
  };
}

/** Enrich a batch of IG handles in one Apify run. Returns one EnrichResult per
 *  input handle, in order. A handle the actor didn't return (private / banned /
 *  not found) resolves to { profile:null, reason:"login-wall" }. Never throws —
 *  a failed run resolves every handle to a null EnrichResult so the drain keeps
 *  going and each candidate gets a terminal status. */
export async function enrichInstagramApify(
  handles: string[],
  creds: ApifyCreds,
): Promise<EnrichResult[]> {
  const usernames = [...new Set(handles.map((h) => h.replace(/^@/, "").trim().toLowerCase()).filter(Boolean))];
  if (usernames.length === 0) return handles.map(() => ({ profile: null, status: 0, reason: "error" as const }));

  const base = (creds.baseUrl ?? APIFY_BASE).replace(/\/$/, "");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), APIFY_TIMEOUT_MS);
  let items: IgProfileItem[] = [];
  let status = 0;
  let timedOut = false;
  try {
    const res = await fetch(`${base}/acts/${IG_PROFILE_ACTOR}/run-sync-get-dataset-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.key}` },
      // resultsLimit:1 = one profile per username (no posts fan-out), matching the
      // S41 cost-cut on the n8n IG-Profile node.
      body: JSON.stringify({ usernames, resultsLimit: 1 }),
      signal: ac.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    status = res.status;
    if (res.ok) {
      const parsed = (await res.json()) as unknown;
      if (Array.isArray(parsed)) items = parsed as IgProfileItem[];
    }
  } catch (e) {
    clearTimeout(t);
    timedOut = (e as Error)?.name === "AbortError";
  }

  // Index returned profiles by handle so we can align to the input order.
  const byHandle = new Map<string, NormalizedProfile>();
  for (const it of items) {
    const prof = toProfile(it);
    if (prof) byHandle.set(prof.handle, prof);
  }

  return handles.map((h) => {
    const norm = h.replace(/^@/, "").trim().toLowerCase();
    const profile = byHandle.get(norm) ?? null;
    if (profile) return { profile, status: 200, reason: "ok" as const };
    if (status === 0) return { profile: null, status: 0, reason: timedOut ? ("timeout" as const) : ("error" as const) };
    if (!status || status >= 300) return { profile: null, status, reason: "non-200" as const };
    // Run succeeded but this handle wasn't in the dataset (private / not found).
    return { profile: null, status: 200, reason: "login-wall" as const };
  });
}
