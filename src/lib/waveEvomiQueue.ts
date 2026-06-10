// SERVER ONLY. The PRODUCTION (n8n-free) Evomi wave: queue + drain.
//
// Two halves:
//   startEvomiWave(input) — runs at "Welle starten" time (when scrape_settings
//     .wave_backend === 'evomi'). Fast Apify discovery + dedup + suppression
//     inline, creates a klar_outreach_runs audit row, and enqueues one
//     klar_wave_candidates row per surviving handle. Returns immediately; NO
//     enrichment here (that would blow the Vercel function limit at real volume).
//
//   drainEvomiQueue(budget) — runs every cron tick. Claims N pending candidates
//     (TikTok + Instagram budgeted separately), enriches them HYBRID — TikTok via
//     Evomi (evomiScraper, mode=auto), Instagram via the Apify profile scraper
//     (apifyEnrich, gets business_email) — shapes LIVE mailable target rows
//     (outreachNormalize, trial:false → mail_status=null), bulk-inserts them, and
//     marks each candidate terminal. When a run's queue is fully drained it is
//     finalized (status=done + finished_at + targets_added).
//
// LIVE rows are ordinary targets: they flow into listTargetsForMail1 and the
// in-app Mail-1 mailer exactly like n8n-scraped targets. No trial markers.

import "server-only";
import { getForProxy } from "./vault";
import { getScrapeSettings } from "./scrapeSettings";
import {
  checkSuppressions,
  findExistingHandles,
  insertWaveTargets,
  createOutreachRun,
  updateOutreachRun,
  getAppTemplate,
  enqueueCandidates,
  claimCandidates,
  finishCandidate,
  releaseCandidate,
  countOpenCandidates,
  incrementRunTargets,
  type WaveCandidate,
  type CandidateInput,
  type WaveTargetRow,
  type OutreachPlatform,
  type OutreachLang,
} from "./outreachStore";
import { sizeOf, type SizeBucket } from "./sizeBuckets";
import { enrichBatch, type EvomiCreds, type EnrichResult } from "./evomiScraper";
import { enrichInstagramApify } from "./apifyEnrich";
import {
  discoverInstagramHandles,
  discoverTiktokHandles,
  type ApifyCreds,
} from "./apifyDiscovery";
import { normalizeToTarget, type WaveJob } from "./outreachNormalize";
import { resolveFollowerRange } from "./waveEvomi";

const EVOMI_ID = "ef44b8c6-20f4-476a-8a18-2d8cd5f9b409";
const APIFY_ID = "658f655b-11cd-4119-bea0-e6f4e6fc2c4a";

// Per-tick claim budget. TikTok mode=auto renders are the long pole; IG is one
// Apify batch call. Tuned small so a tick fits the 60s Hobby function ceiling
// even with retries (external scheduler runs this every ~5 min, so throughput is
// batch×ticks/hour). Override via env. A killed tick loses nothing — claimed
// candidates are reclaimed by the stale-reaper.
const TT_PER_TICK = Number(process.env.EVOMI_TT_PER_TICK ?? 4);
const IG_PER_TICK = Number(process.env.EVOMI_IG_PER_TICK ?? 8);
// Soft wall-clock deadline: stop STARTING new TikTok enrichments past this so an
// in-flight Evomi render can still finish under the 60s cap. Handles not reached
// are released back to pending for the next tick.
const DRAIN_DEADLINE_MS = Number(process.env.EVOMI_DRAIN_DEADLINE_MS ?? 38_000);

export type WavePlatform = OutreachPlatform; // "tiktok" | "instagram"

export interface EvomiStartInput {
  app: string; // one LIVE slug (validated by the caller)
  platforms: WavePlatform[];
  size_buckets: SizeBucket[];
  niche: string | null;
  count: number; // profiles per platform the operator wants (>=1)
  language: string;
  mail_subject?: string | null;
  mail_body?: string | null;
  hashtags?: string[];
}

export interface EvomiStartReport {
  ok: boolean;
  runId: string | null;
  discovered: number;
  queued: number;
  perPlatform: { instagram: number; tiktok: number };
  followerRange: [number, number];
  error?: string;
}

// niche -> discovery terms (hashtags for IG actor, keywords for TT actor).
// Priority: explicit hashtags > typed niche > curated template hashtag pool >
// app slug. The template pool (klar_app_mail_templates.hashtags, per app+lang)
// is what the n8n Build-Job-List used — searching the bare app slug surfaces
// random profiles with ~0% email yield, the curated pool surfaces creators.
function resolveTerms(
  niche: string | null,
  app: string,
  hashtags?: string[],
  templateHashtags?: string[] | null,
): { hashtags: string[]; keywords: string[] } {
  const clean = (arr: string[]) =>
    arr.map((h) => h.replace(/^#/, "").replace(/\s+/g, "").toLowerCase()).filter(Boolean);
  if (hashtags && hashtags.length > 0) {
    return { hashtags: clean(hashtags), keywords: hashtags.slice() };
  }
  const typed = (niche ?? "").trim();
  if (typed) {
    return { hashtags: [typed.replace(/\s+/g, "").toLowerCase()], keywords: [typed] };
  }
  if (templateHashtags && templateHashtags.length > 0) {
    return { hashtags: clean(templateHashtags), keywords: templateHashtags.slice() };
  }
  return { hashtags: [app.replace(/\s+/g, "").toLowerCase()], keywords: [app] };
}

/** Dedup a platform's discovered handles against existing targets + suppressions.
 *  Fail-CLOSED on a suppression error (drop the whole platform rather than risk
 *  contacting a do-not-contact handle), mirroring waveEvomi.survivors. */
async function survivors(platform: WavePlatform, handles: string[]): Promise<string[]> {
  if (handles.length === 0) return [];
  const existing = await findExistingHandles(platform, handles);
  const afterExisting = handles.filter((h) => !existing.has(h));
  if (afterExisting.length === 0) return [];
  let suppressed: Set<string>;
  try {
    const rows = await checkSuppressions({ handles: afterExisting, platform });
    suppressed = new Set(rows.map((r) => r.handle.toLowerCase()));
  } catch {
    return []; // fail-closed
  }
  return afterExisting.filter((h) => !suppressed.has(h));
}

/** Phase A: discovery + enqueue. Never throws — failures resolve into the report. */
export async function startEvomiWave(input: EvomiStartInput): Promise<EvomiStartReport> {
  const [follower_min, follower_max] = resolveFollowerRange(input.size_buckets);
  const fail = (error: string): EvomiStartReport => ({
    ok: false,
    runId: null,
    discovered: 0,
    queued: 0,
    perPlatform: { instagram: 0, tiktok: 0 },
    followerRange: [follower_min, follower_max],
    error,
  });

  const apifyRouting = await getForProxy(APIFY_ID);
  if (!apifyRouting) return fail("apify key unavailable");
  const apifyCreds: ApifyCreds = { key: apifyRouting.key, baseUrl: apifyRouting.baseUrl };

  const settings = await getScrapeSettings();
  const wantIg = input.platforms.includes("instagram");
  const wantTt = input.platforms.includes("tiktok");
  const activePlatforms = (wantIg ? 1 : 0) + (wantTt ? 1 : 0) || 1;
  // Per-platform enrichment budget = the smaller of what the operator asked for
  // and the global cap split across platforms. This bounds Evomi/Apify spend.
  const perPlatformBudget = Math.max(
    1,
    Math.min(Math.max(input.count, 1), Math.floor(settings.max_profiles_per_wave / activePlatforms) || settings.max_profiles_per_wave),
  );

  // Curated discovery pool from the app's mail template (n8n parity). Language-
  // specific first, German fallback (all six apps are seeded in de).
  const tpl =
    (await getAppTemplate(input.app, input.language)) ??
    (input.language !== "de" ? await getAppTemplate(input.app, "de") : null);
  const { hashtags, keywords } = resolveTerms(
    input.niche,
    input.app,
    input.hashtags,
    tpl?.hashtags ?? null,
  );
  // Over-fetch at discovery: IG hashtag posts dedupe heavily to owners, TT keyword
  // results are more unique. We slice to the budget after dedup/suppression.
  const igDiscoverLimit = Math.min(Math.ceil(perPlatformBudget * 3), 90);
  const ttDiscoverLimit = Math.min(Math.ceil(perPlatformBudget * 1.5), 60);

  const [igRes, ttRes] = await Promise.all([
    wantIg ? discoverInstagramHandles(hashtags, igDiscoverLimit, apifyCreds) : Promise.resolve({ handles: [] as string[], runId: null }),
    wantTt ? discoverTiktokHandles(keywords, ttDiscoverLimit, apifyCreds) : Promise.resolve({ candidates: [] as { handle: string; followers: number | null }[], runId: null }),
  ]);

  const igHandles = [...new Set(igRes.handles.map((h) => h.toLowerCase().trim()).filter(Boolean))];
  const ttHandles = [...new Set(ttRes.candidates.map((c) => c.handle.toLowerCase().trim()).filter(Boolean))];
  const discovered = igHandles.length + ttHandles.length;

  const [igClean, ttClean] = await Promise.all([
    survivors("instagram", igHandles),
    survivors("tiktok", ttHandles),
  ]);
  const igQueue = igClean.slice(0, perPlatformBudget);
  const ttQueue = ttClean.slice(0, perPlatformBudget);

  if (igQueue.length + ttQueue.length === 0) {
    return {
      ok: true,
      runId: null,
      discovered,
      queued: 0,
      perPlatform: { instagram: 0, tiktok: 0 },
      followerRange: [follower_min, follower_max],
      error: "nichts zu enqueuen (Discovery leer oder alles dedupliziert/gesperrt)",
    };
  }

  // Rough cost estimate for the audit card: Apify IG items @ $0.0023 + TT compute.
  const costEstimate =
    Math.round((igQueue.length * 0.0023 + (ttQueue.length > 0 ? 0.3 : 0)) * 10000) / 10000;

  let runId: string;
  try {
    const run = await createOutreachRun({
      apps: [input.app],
      platforms: input.platforms,
      size_buckets: input.size_buckets,
      language: input.language as OutreachLang,
      count_per_app: input.count,
      niche: input.niche,
      mail_subject: input.mail_subject ?? null,
      mail_body: input.mail_body ?? null,
      cost_estimate_usd: costEstimate,
    });
    runId = run.id;
  } catch (e) {
    return fail(`run anlegen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
  }
  // Mark running + start time (createOutreachRun seeds status='queued').
  await updateOutreachRun(runId, { status: "running", started_at: new Date().toISOString() });

  const candidates: CandidateInput[] = [];
  for (const h of igQueue) {
    candidates.push({ run_id: runId, platform: "instagram", handle: h, app: input.app, niche: input.niche, language: input.language, size_buckets: input.size_buckets, follower_min, follower_max });
  }
  for (const h of ttQueue) {
    candidates.push({ run_id: runId, platform: "tiktok", handle: h, app: input.app, niche: input.niche, language: input.language, size_buckets: input.size_buckets, follower_min, follower_max });
  }

  let queued = 0;
  try {
    const r = await enqueueCandidates(candidates);
    queued = r.queued;
  } catch (e) {
    // Run row exists but enqueue failed: mark it failed so it's not a zombie.
    await updateOutreachRun(runId, { status: "failed", finished_at: new Date().toISOString(), errors: { phase: "enqueue", message: e instanceof Error ? e.message : String(e) } });
    return { ...fail(`enqueue fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`), runId };
  }

  return {
    ok: true,
    runId,
    discovered,
    queued,
    perPlatform: { instagram: igQueue.length, tiktok: ttQueue.length },
    followerRange: [follower_min, follower_max],
  };
}

// --------------------------- drain (cron) ----------------------------------

export interface DrainReport {
  ok: boolean;
  claimed: number;
  inserted: number;
  done: number;
  dropped: number;
  errored: number;
  deferred: number; // hit the soft deadline, released back to pending
  runsFinalized: string[];
  error?: string;
}

// Map an enrichment failure reason to a terminal candidate status.
function reasonToStatus(reason: EnrichResult["reason"]): "dropped" | "error" {
  // login-wall / parse-miss = the profile genuinely wasn't available (expected,
  // like n8n's silent skip) → dropped. Transport failures → error (logged).
  return reason === "login-wall" || reason === "parse-miss" ? "dropped" : "error";
}

/** Drain up to TT_PER_TICK TikTok + IG_PER_TICK Instagram pending candidates,
 *  enrich hybrid, insert LIVE targets, finalize drained runs. Never throws. */
export async function drainEvomiQueue(): Promise<DrainReport> {
  const started = Date.now();
  const report: DrainReport = { ok: true, claimed: 0, inserted: 0, done: 0, dropped: 0, errored: 0, deferred: 0, runsFinalized: [] };

  // Claim per platform so the slow TikTok render budget can't starve fast IG.
  const [ttClaimed, igClaimed] = await Promise.all([
    claimCandidates({ platform: "tiktok", limit: TT_PER_TICK }),
    claimCandidates({ platform: "instagram", limit: IG_PER_TICK }),
  ]);
  report.claimed = ttClaimed.length + igClaimed.length;
  if (report.claimed === 0) return report;

  // Creds: Evomi only if there are TT candidates; Apify only if IG candidates.
  const [evomiRouting, apifyRouting] = await Promise.all([
    ttClaimed.length > 0 ? getForProxy(EVOMI_ID) : Promise.resolve(null),
    igClaimed.length > 0 ? getForProxy(APIFY_ID) : Promise.resolve(null),
  ]);
  const evomiCreds: EvomiCreds | null = evomiRouting
    ? { baseUrl: evomiRouting.baseUrl, authHeader: evomiRouting.authHeader, authIn: evomiRouting.authIn, key: evomiRouting.key }
    : null;
  const apifyCreds: ApifyCreds | null = apifyRouting ? { key: apifyRouting.key, baseUrl: apifyRouting.baseUrl } : null;

  // Enrich BOTH platforms in parallel so wall-clock = max(TT, IG), not the sum —
  // critical under the 60s Hobby cap. TT carries a soft deadline (stops starting
  // new Evomi renders past DRAIN_DEADLINE_MS); IG is a single Apify batch call.
  const ttDeadline = started + DRAIN_DEADLINE_MS;
  const [ttResults, igResults] = await Promise.all([
    ttClaimed.length > 0 && evomiCreds
      ? enrichBatch(ttClaimed.map((c) => c.handle), "tiktok", evomiCreds, { concurrency: 2, deadlineMs: ttDeadline })
      : Promise.resolve(ttClaimed.map(() => ({ profile: null, status: 0, reason: "error" as const }))),
    igClaimed.length > 0 && apifyCreds
      ? enrichInstagramApify(igClaimed.map((c) => c.handle), apifyCreds)
      : Promise.resolve(igClaimed.map(() => ({ profile: null, status: 0, reason: "error" as const }))),
  ]);

  // Process a (candidate, enrichResult) pair: bucket a LIVE row by run, or finish
  // the candidate terminal. Returns the row to insert (with its candidate id) or null.
  const rowsByRun = new Map<string, { candidateId: string; row: WaveTargetRow }[]>();
  async function handle(cand: WaveCandidate, r: EnrichResult): Promise<void> {
    // Deadline: this handle was never enriched (the tick ran out of time). Put it
    // back to pending so the next tick retries it — NOT terminal, no data loss.
    if (r.reason === "deadline") {
      await releaseCandidate(cand.id);
      report.deferred++;
      return;
    }
    if (!r.profile) {
      const status = reasonToStatus(r.reason);
      await finishCandidate(cand.id, status, r.reason);
      if (status === "dropped") report.dropped++; else report.errored++;
      return;
    }
    // size-bucket membership (honours non-contiguous selections, e.g. nano+macro).
    const bucket = sizeOf(r.profile.followers);
    const selected = new Set<SizeBucket>(cand.size_buckets as SizeBucket[]);
    if (!bucket || (selected.size > 0 && !selected.has(bucket))) {
      await finishCandidate(cand.id, "dropped", "size");
      report.dropped++;
      return;
    }
    const job: WaveJob = {
      app: cand.app,
      niche: cand.niche,
      language: cand.language,
      follower_min: cand.follower_min,
      follower_max: cand.follower_max,
      trial: false, // LIVE row
    };
    const row = await normalizeToTarget(r.profile, job);
    if (!row) {
      await finishCandidate(cand.id, "dropped", "no-email-or-range");
      report.dropped++;
      return;
    }
    const arr = rowsByRun.get(cand.run_id) ?? [];
    arr.push({ candidateId: cand.id, row });
    rowsByRun.set(cand.run_id, arr);
  }

  // Run all pair handlers (each does its own awaits; sequential is fine and keeps
  // PostgREST load modest). IG first (cheap), then TT.
  for (let i = 0; i < igClaimed.length; i++) await handle(igClaimed[i], igResults[i]);
  for (let i = 0; i < ttClaimed.length; i++) await handle(ttClaimed[i], ttResults[i]);

  // Per run: bulk-insert the LIVE rows, mark their candidates done, bump the run.
  const touchedRuns = new Set<string>([...rowsByRun.keys(), ...ttClaimed.map((c) => c.run_id), ...igClaimed.map((c) => c.run_id)]);
  for (const [runId, entries] of rowsByRun) {
    if (entries.length === 0) continue;
    try {
      const { inserted } = await insertWaveTargets(entries.map((e) => e.row));
      report.inserted += inserted;
      await incrementRunTargets(runId, inserted);
    } catch (e) {
      console.warn(`[wave-drain] insert for run ${runId.slice(0, 8)} failed`, e instanceof Error ? e.message : e);
    }
    for (const e of entries) {
      await finishCandidate(e.candidateId, "done");
      report.done++;
    }
  }

  // Finalize any touched run whose queue is now fully drained.
  for (const runId of touchedRuns) {
    const open = await countOpenCandidates(runId);
    if (open === 0) {
      await updateOutreachRun(runId, { status: "done", finished_at: new Date().toISOString() });
      report.runsFinalized.push(runId);
    }
  }

  return report;
}
