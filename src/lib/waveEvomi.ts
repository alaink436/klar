// SERVER ONLY. The n8n-free Evomi outreach-wave engine.
//
// runEvomiWave(job, {commit}) does, for one app:
//   1) pull Evomi + Apify creds via vault.getForProxy
//   2) resolve niche/hashtags + follower_min/max from the size buckets
//   3) discovery (Apify HTTP): IG hashtags + TikTok keywords -> candidate handles
//   4) dedup vs existing klar_outreach_targets (targeted select) + suppressions
//      (fail-closed: on a suppression-check error, abort THAT platform's handles,
//      never silently include them)
//   5) cap to min(count*platforms, scrapeSettings.max_profiles_per_wave, 5 trial)
//   6) Evomi enrichment (enrichBatch) -> normalize (size + email filter) -> rows
//   7) commit -> insertWaveTargets (bulk upsert, ignore-duplicates); else dry-run
// Returns a report { discovered, deduped, enriched, withEmail, inserted, rows,
// perStageCounts }. Trial markers live on every row (niche="evomi-trial:…",
// notes prefix "evomi-trial; …", mail_status="trial_hold"). No n8n webhook, no
// klar_outreach_runs row. Soft 270s deadline guard.

import "server-only";
import { getForProxy } from "./vault";
import { getScrapeSettings } from "./scrapeSettings";
import {
  checkSuppressions,
  findExistingHandles,
  insertWaveTargets,
  getAppTemplate,
  type WaveTargetRow,
} from "./outreachStore";
import { sizeOf, type SizeBucket } from "./sizeBuckets";
import { enrichBatch, type EvomiCreds } from "./evomiScraper";
import {
  discoverInstagramHandles,
  discoverTiktokHandles,
  type ApifyCreds,
} from "./apifyDiscovery";
import { normalizeToTarget, type WaveJob } from "./outreachNormalize";
import { getEvomiProxy } from "./evomiProxy";

// Vault ids (from the integration map; same secrets the live pipeline uses).
const EVOMI_ID = "ef44b8c6-20f4-476a-8a18-2d8cd5f9b409";
const APIFY_ID = "658f655b-11cd-4119-bea0-e6f4e6fc2c4a";

// Trial single-shot caps (WAVE-EVOMI-ORCHESTRATION §4).
const TRIAL_MAX_PROFILES = 5;
const SOFT_DEADLINE_MS = 270_000;

// n8n Build Job List BUCKET_RANGE -> [follower_min, follower_max]. NOTE: nano
// starts at 1000 here (vs 0 in sizeBuckets.ts) — the wave's follower filter uses
// these n8n ranges, while sizeOf() stays the DB/UI bucket-membership check.
// Exported so the production queue path (waveEvomiQueue.ts) shares one table.
export const BUCKET_RANGE: Record<SizeBucket, [number, number]> = {
  nano: [1_000, 10_000],
  micro: [10_000, 50_000],
  mid: [50_000, 500_000],
  macro: [500_000, 1_000_000_000], // effectively unbounded (largest real account ~600M); matches sizeOf macro = [500k, null) so a >50M account passes both the membership and range checks instead of being enriched then dropped
};

export type WavePlatform = "instagram" | "tiktok";

export interface EvomiWaveInput {
  app: string; // one LIVE slug
  platforms: WavePlatform[];
  size_buckets: SizeBucket[];
  niche: string | null; // null/empty -> derived below
  count: number; // already clamped 1..5 by the route
  language: string; // "de" | "en" | ...
  hashtags?: string[]; // optional explicit override
}

export interface PerStageCounts {
  discovered: number;
  dedupExistingDropped: number;
  suppressedDropped: number;
  cappedTo: number;
  enriched: number;
  withEmail: number;
  inSizeBucket: number; // == final candidate rows
  final: number;
}

export interface EvomiWaveReport {
  ok: boolean;
  commit: boolean;
  app: string;
  niche: string | null;
  followerRange: [number, number];
  maxProfiles: number;
  discovered: number;
  deduped: number; // survivors after dedup + suppression
  enriched: number; // profiles that returned a NormalizedProfile
  withEmail: number; // rows that survived size + email filter
  inserted: number; // net-new rows committed (0 on dry-run)
  rows: WaveTargetRow[];
  perStageCounts: PerStageCounts;
  // Where the emails came from + whether the residential proxy was used.
  emailSources: { direct: number; bio: number; aggregator: number; website: number };
  proxyUsed: boolean;
  durationMs: number;
  partial: boolean;
  error?: string;
}

// Resolve the combined [min,max] follower range from the selected buckets, using
// the n8n BUCKET_RANGE table. Default [10000, 500000] (micro+mid) when none.
// Exported for the production queue path.
export function resolveFollowerRange(buckets: SizeBucket[]): [number, number] {
  if (buckets.length === 0) return [10_000, 500_000];
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const b of buckets) {
    const [lo, hi] = BUCKET_RANGE[b];
    if (lo < min) min = lo;
    if (hi > max) max = hi;
  }
  return [Number.isFinite(min) ? min : 10_000, max || 500_000];
}

// The curated hashtag pool (klar_app_mail_templates.hashtags) is INSTAGRAM-centric
// (e.g. "knittersofinstagram"). Fed verbatim to the TikTok keyword search those
// return garbage (random accounts containing the word), so TT keywords strip the
// IG-platform suffix down to a plain topical term ("knittersofinstagram" ->
// "knitters"). Exported + reused by waveEvomiQueue's resolveTerms.
export function toTiktokKeyword(hashtag: string): string {
  const base = hashtag.replace(/^#/, "").trim().toLowerCase();
  const stripped = base.replace(/(of|on)?instagram$|insta$|onig$|ongram$/i, "");
  return stripped.length >= 3 ? stripped : base;
}

// Niche -> discovery terms. Hashtags strip spaces/# (IG hashtag actor); keywords
// keep words (TikTok keyword actor). Priority: explicit hashtags > typed niche >
// curated template pool (klar_app_mail_templates.hashtags, n8n parity — the bare
// app slug surfaces random profiles with ~0% email yield) > app slug.
function resolveTerms(
  input: EvomiWaveInput,
  templateHashtags?: string[] | null,
): {
  hashtags: string[];
  keywords: string[];
  nicheUsed: string;
} {
  const clean = (arr: string[]) =>
    arr.map((h) => h.replace(/^#/, "").replace(/\s+/g, "").toLowerCase()).filter(Boolean);
  const ttKeywords = (arr: string[]) => [...new Set(arr.map(toTiktokKeyword).filter(Boolean))];
  const niche = (input.niche ?? "").trim();
  const nicheUsed = niche || input.app;
  if (input.hashtags && input.hashtags.length > 0) {
    return { hashtags: clean(input.hashtags), keywords: ttKeywords(input.hashtags), nicheUsed };
  }
  if (niche) {
    return { hashtags: [niche.replace(/\s+/g, "").toLowerCase()], keywords: [niche], nicheUsed };
  }
  if (templateHashtags && templateHashtags.length > 0) {
    return { hashtags: clean(templateHashtags), keywords: ttKeywords(templateHashtags), nicheUsed };
  }
  return { hashtags: [input.app.replace(/\s+/g, "").toLowerCase()], keywords: [input.app], nicheUsed };
}

/** Run the Evomi wave for one app. Never throws — failures resolve into the
 *  report's `error` field with `ok:false`. */
export async function runEvomiWave(
  input: EvomiWaveInput,
  opts: { commit?: boolean } = {},
): Promise<EvomiWaveReport> {
  const started = Date.now();
  const commit = Boolean(opts.commit);
  const [follower_min, follower_max] = resolveFollowerRange(input.size_buckets);
  const selectedBuckets = new Set<SizeBucket>(input.size_buckets);
  const stages: PerStageCounts = {
    discovered: 0,
    dedupExistingDropped: 0,
    suppressedDropped: 0,
    cappedTo: 0,
    enriched: 0,
    withEmail: 0,
    inSizeBucket: 0,
    final: 0,
  };

  const emailSources = { direct: 0, bio: 0, aggregator: 0, website: 0 };
  const empty = (error?: string, maxProfiles = 0): EvomiWaveReport => ({
    ok: !error,
    commit,
    app: input.app,
    niche: input.niche,
    followerRange: [follower_min, follower_max],
    maxProfiles,
    discovered: stages.discovered,
    deduped: 0,
    enriched: stages.enriched,
    withEmail: stages.withEmail,
    inserted: 0,
    rows: [],
    perStageCounts: stages,
    emailSources,
    proxyUsed: false,
    durationMs: Date.now() - started,
    partial: false,
    error,
  });

  // 1) creds.
  const [evomiRouting, apifyRouting] = await Promise.all([
    getForProxy(EVOMI_ID),
    getForProxy(APIFY_ID),
  ]);
  if (!evomiRouting) return empty("evomi key unavailable");
  if (!apifyRouting) return empty("apify key unavailable");
  const evomiCreds: EvomiCreds = {
    baseUrl: evomiRouting.baseUrl,
    authHeader: evomiRouting.authHeader,
    authIn: evomiRouting.authIn,
    key: evomiRouting.key,
  };
  const apifyCreds: ApifyCreds = { key: apifyRouting.key, baseUrl: apifyRouting.baseUrl };

  // 2) scrape settings -> max profiles per wave (clamped against the trial cap).
  const settings = await getScrapeSettings();
  const maxProfiles = Math.min(
    Math.max(input.count, 1) * Math.max(input.platforms.length, 1),
    settings.max_profiles_per_wave,
    TRIAL_MAX_PROFILES,
  );

  // 3) resolve terms + over-fetch ratio (n8n Build Job List). Curated template
  // pool as default (language-specific, German fallback).
  const tpl =
    (await getAppTemplate(input.app, input.language)) ??
    (input.language !== "de" ? await getAppTemplate(input.app, "de") : null);
  const { hashtags, keywords, nicheUsed } = resolveTerms(input, tpl?.hashtags ?? null);
  const smallBucketOnly =
    input.size_buckets.length > 0 &&
    input.size_buckets.every((b) => b === "nano" || b === "micro");
  const scrapeLimit = smallBucketOnly
    ? Math.min(Math.ceil(input.count * 1.8), 45)
    : Math.min(Math.ceil(input.count * 1.2), 30);

  // 4) discovery per platform (parallel). TT carries follower hints we ignore for
  // the filter (the real follower count comes from Evomi enrichment).
  const wantIg = input.platforms.includes("instagram");
  const wantTt = input.platforms.includes("tiktok");
  const [igRes, ttRes] = await Promise.all([
    wantIg
      ? discoverInstagramHandles(hashtags, scrapeLimit, apifyCreds)
      : Promise.resolve({ handles: [] as string[], runId: null }),
    wantTt
      ? discoverTiktokHandles(keywords, scrapeLimit, apifyCreds)
      : Promise.resolve({ candidates: [] as { handle: string; followers: number | null }[], runId: null }),
  ]);

  const igHandles = [...new Set(igRes.handles.map((h) => h.toLowerCase().trim()).filter(Boolean))];
  const ttHandles = [
    ...new Set(ttRes.candidates.map((c) => c.handle.toLowerCase().trim()).filter(Boolean)),
  ];
  stages.discovered = igHandles.length + ttHandles.length;

  // 5) dedup vs existing targets + suppressions (fail-closed per platform).
  async function survivors(
    platform: WavePlatform,
    handles: string[],
  ): Promise<string[]> {
    if (handles.length === 0) return [];
    const existing = await findExistingHandles(platform, handles);
    const afterExisting = handles.filter((h) => !existing.has(h));
    stages.dedupExistingDropped += handles.length - afterExisting.length;
    if (afterExisting.length === 0) return [];
    // Fail-closed: a suppression-check error aborts THIS platform's handles
    // entirely (return []), never silently includes a do-not-contact handle.
    let suppressed: Set<string>;
    try {
      const rows = await checkSuppressions({ handles: afterExisting, platform });
      suppressed = new Set(rows.map((r) => r.handle.toLowerCase()));
    } catch {
      stages.suppressedDropped += afterExisting.length;
      return [];
    }
    const clean = afterExisting.filter((h) => !suppressed.has(h));
    stages.suppressedDropped += afterExisting.length - clean.length;
    return clean;
  }

  const [igClean, ttClean] = await Promise.all([
    survivors("instagram", igHandles),
    survivors("tiktok", ttHandles),
  ]);

  // 6) cap to maxProfiles (split the budget across the active platforms so one
  // platform can't starve the other; remainder goes to whichever has more).
  // Split the budget across the REQUESTED platforms (not by discovery yield) so
  // the per-platform cap is predictable; the fill step below hands any leftover
  // (e.g. one platform returned nothing) to the other platform.
  const activePlatforms = ((wantIg ? 1 : 0) + (wantTt ? 1 : 0)) || 1;
  const perPlatformCap = Math.max(1, Math.floor(maxProfiles / activePlatforms));
  let igCapped = igClean.slice(0, perPlatformCap);
  let ttCapped = ttClean.slice(0, perPlatformCap);
  // Fill any remaining headroom (rounding / one empty platform) up to maxProfiles.
  let remaining = maxProfiles - igCapped.length - ttCapped.length;
  if (remaining > 0 && igClean.length > igCapped.length) {
    const extra = igClean.slice(igCapped.length, igCapped.length + remaining);
    igCapped = igCapped.concat(extra);
    remaining -= extra.length;
  }
  if (remaining > 0 && ttClean.length > ttCapped.length) {
    ttCapped = ttCapped.concat(ttClean.slice(ttCapped.length, ttCapped.length + remaining));
  }
  stages.cappedTo = igCapped.length + ttCapped.length;

  // 7) enrichment (Evomi). Sequential per platform (TT mode:auto is the long pole),
  // each platform internally bounded-concurrent. Soft deadline guard.
  const job: WaveJob = {
    app: input.app,
    niche: nicheUsed,
    language: input.language,
    follower_min,
    follower_max,
  };

  const rows: WaveTargetRow[] = [];
  let partial = false;

  // Residential proxy for the email crawls (fail-soft: null = direct fetch).
  const proxy = await getEvomiProxy();

  async function enrichAndShape(
    platform: WavePlatform,
    handles: string[],
  ): Promise<void> {
    if (handles.length === 0) return;
    const deadlineMs = started + SOFT_DEADLINE_MS;
    if (Date.now() > deadlineMs) {
      partial = true;
      return;
    }
    // The deadline is also passed INTO enrichBatch so it stops mid-batch rather
    // than only being checked once before the (potentially long) batch starts.
    const results = await enrichBatch(handles, platform, evomiCreds, { concurrency: 2, deadlineMs });
    for (const r of results) {
      if (r.reason === "deadline") partial = true;
      if (!r.profile) continue;
      stages.enriched += 1;
      // size-bucket membership: keep only if the enriched follower count falls in
      // a selected bucket (sizeOf is the DB/UI equivalent of the n8n filter).
      const bucket = sizeOf(r.profile.followers);
      if (!bucket || (selectedBuckets.size > 0 && !selectedBuckets.has(bucket))) continue;
      stages.inSizeBucket += 1; // passed the size-bucket filter
      const row = await normalizeToTarget(r.profile, job, { dispatcher: proxy.dispatcher });
      if (!row) continue; // dropped: no contact email (range now aligned with the bucket check)
      stages.withEmail += 1;
      if (row.email_source) emailSources[row.email_source] += 1;
      rows.push(row);
    }
  }

  await enrichAndShape("instagram", igCapped);
  await enrichAndShape("tiktok", ttCapped);
  stages.final = rows.length;

  // 8) commit OR dry-run.
  let inserted = 0;
  let insertError: string | undefined;
  if (commit && rows.length > 0) {
    try {
      const res = await insertWaveTargets(rows);
      inserted = res.inserted;
    } catch (e) {
      insertError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    ok: !insertError,
    commit,
    app: input.app,
    niche: input.niche,
    followerRange: [follower_min, follower_max],
    maxProfiles,
    discovered: stages.discovered,
    deduped: stages.cappedTo,
    enriched: stages.enriched,
    withEmail: stages.withEmail,
    inserted,
    rows,
    perStageCounts: stages,
    emailSources,
    proxyUsed: Boolean(proxy.dispatcher),
    durationMs: Date.now() - started,
    partial,
    error: insertError,
  };
}
