// SERVER ONLY. Outreach-Tracker für Influencer-Pipeline.
// Tabelle `klar_outreach_targets` liegt in anime-vault (exiuwektrqxvycclqfdd),
// dem Klar-Hub-Supabase (nicht den App-Supabases).
// Migration: `klar_outreach_targets_v1` (2026-05-22).
//
// Lifecycle: queued -> dm_sent -> replied -> {converted, declined, dead}.
// `converted` heißt ein Affiliate-Setup ist durchgelaufen, Cross-Link
// optional via `inquiry_id` zur klar_inquiries-Row + `approved_app` zur App.
//
// RLS: service-role only. Klar's Admin-Route ruft alle CRUD-Functions hier
// mit dem KLAR_INBOX_SERVICE_KEY (anime-vault Service-Role).

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export type OutreachStatus =
  | "queued"
  | "dm_sent"
  | "replied"
  | "declined"
  | "converted"
  | "dead";

export type OutreachPlatform = "tiktok" | "instagram";

export interface OutreachTarget {
  id: string;
  handle: string;
  platform: OutreachPlatform;
  display_name: string | null;
  profile_url: string | null;
  follower_estimate: number | null;
  niche: string | null;
  language: string;
  for_apps: string[];
  priority: number;
  status: OutreachStatus;
  queued_at: string;
  contacted_at: string | null;
  replied_at: string | null;
  declined_at: string | null;
  converted_at: string | null;
  inquiry_id: string | null;
  approved_app: string | null;
  influencer_handle_in_app: string | null;
  notes: string | null;
  last_message: string | null;
  last_message_at: string | null;
  // v2 metrics (Migration klar_outreach_targets_v2_metrics)
  total_views_estimate: number | null;
  avg_views_per_post: number | null;
  engagement_rate_pct: number | null;
  mails_sent: number;
  last_mail_at: string | null;
  created_at: string;
  updated_at: string;
  // v3 n8n-fields (Migration klar_outreach_targets_v3_n8n_fields) — written
  // by the n8n Influencer-Outreach workflows after the Sheet → Supabase cut.
  contact_email: string | null;
  audience_size: string | null;          // "A" | "B" | "C" cohort label
  mail_status: string | null;            // mail1_sent | mail2_sent | replied_auto | mail2_skipped
  mail1_subject: string | null;
  mail1_sent_at: string | null;
  mail2_subject: string | null;
  mail2_sent_at: string | null;
  reply_subject: string | null;
  reply_reason: string | null;           // auto-responder | loop-guard | manual
  onboarding_token: string | null;
  onboarding_link: string | null;
}

export interface OutreachStats {
  total: number;
  queued: number;
  contacted: number;
  replied: number;
  converted: number;
  declined: number;
  dead: number;
  contacted_last_7d: number;
  converted_last_30d: number;
  response_rate_pct: number | null;
  conversion_rate_pct: number | null;
  mails_total: number;
  mails_last_7d: number;
}

export const EMPTY_STATS: OutreachStats = {
  total: 0, queued: 0, contacted: 0, replied: 0, converted: 0,
  declined: 0, dead: 0, contacted_last_7d: 0, converted_last_30d: 0,
  response_rate_pct: null, conversion_rate_pct: null,
  mails_total: 0, mails_last_7d: 0,
};

export interface PerAppStat {
  app: string;
  total: number;
  queued: number;
  contacted: number;
  replied: number;
  converted: number;
  declined: number;
  dead: number;
  mails_total: number;
  contacted_last_7d: number;
}

function hdr(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function isOutreachConfigured(): boolean {
  return Boolean(KLAR_INBOX_KEY);
}

/** Fetch the stats-view. Returns EMPTY_STATS on any failure so the UI never crashes. */
export async function getOutreachStats(): Promise<OutreachStats> {
  if (!KLAR_INBOX_KEY) return EMPTY_STATS;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_stats?select=*&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return EMPTY_STATS;
    const rows = (await res.json()) as Partial<OutreachStats>[];
    const r = rows[0] ?? {};
    return {
      total:               Number(r.total ?? 0),
      queued:              Number(r.queued ?? 0),
      contacted:           Number(r.contacted ?? 0),
      replied:             Number(r.replied ?? 0),
      converted:           Number(r.converted ?? 0),
      declined:            Number(r.declined ?? 0),
      dead:                Number(r.dead ?? 0),
      contacted_last_7d:   Number(r.contacted_last_7d ?? 0),
      converted_last_30d:  Number(r.converted_last_30d ?? 0),
      response_rate_pct:   r.response_rate_pct ?? null,
      conversion_rate_pct: r.conversion_rate_pct ?? null,
      mails_total:         Number(r.mails_total ?? 0),
      mails_last_7d:       Number(r.mails_last_7d ?? 0),
    };
  } catch {
    return EMPTY_STATS;
  }
}

/** Per-App-Stats. Liefert eine Row pro App-Slug aus dem for_apps[]-Array. */
export async function getOutreachPerAppStats(): Promise<PerAppStat[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_per_app_stats?select=*`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as PerAppStat[];
  } catch {
    return [];
  }
}

export interface ListFilter {
  platform?: OutreachPlatform | "all";
  status?: OutreachStatus | "all";
  app?: string | "all";
  query?: string;            // ILIKE-Suche über handle/display_name/niche
  limit?: number;
}

// PostgREST escape: das `,` und `)` in `or=(...)` braucht keinen Escape
// auf Werten, aber `*` und `%` müssen we url-encoden. ILIKE-Wildcards
// werden serverseitig durch * gespiegelt (PostgREST-syntax).
function pgrestIlikeValue(raw: string): string {
  // remove characters die PostgREST or-clause schon als syntax versteht
  return raw.replace(/[(),*%]/g, " ").trim();
}

/** List targets, newest first, filterable. Returns [] on any failure. */
export async function listOutreachTargets(
  f: ListFilter = {},
): Promise<OutreachTarget[]> {
  if (!KLAR_INBOX_KEY) return [];
  const limit = Math.min(Math.max(f.limit ?? 200, 1), 500);
  const parts: string[] = [`select=*`, `order=updated_at.desc`, `limit=${limit}`];
  if (f.platform && f.platform !== "all") parts.push(`platform=eq.${encodeURIComponent(f.platform)}`);
  if (f.status && f.status !== "all") parts.push(`status=eq.${encodeURIComponent(f.status)}`);
  if (f.app && f.app !== "all") parts.push(`for_apps=cs.{${encodeURIComponent(f.app)}}`);
  if (f.query) {
    const q = pgrestIlikeValue(f.query);
    if (q.length >= 1) {
      // ILIKE über handle/display_name/niche/notes
      const w = encodeURIComponent(`*${q}*`);
      parts.push(`or=(handle.ilike.${w},display_name.ilike.${w},niche.ilike.${w},notes.ilike.${w})`);
    }
  }
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?${parts.join("&")}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as OutreachTarget[];
  } catch {
    return [];
  }
}

export interface CreateTargetInput {
  handle: string;
  platform: OutreachPlatform;
  display_name?: string | null;
  profile_url?: string | null;
  follower_estimate?: number | null;
  niche?: string | null;
  language?: string;
  for_apps?: string[];
  priority?: number;
  notes?: string | null;
}

/**
 * Insert a new target. Returns the created row, or throws with the PostgREST
 * error message so the caller can show real feedback to the admin.
 */
export async function createOutreachTarget(
  input: CreateTargetInput,
): Promise<OutreachTarget> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body = {
    handle: input.handle.trim().replace(/^@/, "").toLowerCase(),
    platform: input.platform,
    display_name: input.display_name ?? null,
    profile_url: input.profile_url ?? null,
    follower_estimate: input.follower_estimate ?? null,
    niche: input.niche ?? null,
    language: input.language ?? "de",
    for_apps: input.for_apps ?? [],
    priority: input.priority ?? 3,
    notes: input.notes ?? null,
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets`,
    {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`outreach insert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as OutreachTarget[];
  if (!rows[0]) throw new Error("outreach insert returned no row");
  return rows[0];
}

/**
 * Transition a target to a new status. Sets the per-status timestamp as a
 * side-effect so reporting works without separate audit-log queries.
 * Returns the updated row.
 */
export async function setOutreachStatus(
  id: string,
  status: OutreachStatus,
  opts?: { notes?: string; last_message?: string },
): Promise<OutreachTarget> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  // Stamp the matching timestamp; the others stay untouched (only filled
  // when the lifecycle actually crossed that bucket).
  if (status === "dm_sent")    patch.contacted_at = now;
  if (status === "replied")    patch.replied_at = now;
  if (status === "declined")   patch.declined_at = now;
  if (status === "converted")  patch.converted_at = now;
  if (opts?.notes !== undefined) patch.notes = opts.notes;
  if (opts?.last_message !== undefined) {
    patch.last_message = opts.last_message;
    patch.last_message_at = now;
  }
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`outreach update ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as OutreachTarget[];
  if (!rows[0]) throw new Error("outreach update returned no row");
  return rows[0];
}

/**
 * Increment the mails_sent counter and stamp last_mail_at. Called when the
 * admin sends an outreach mail (DM follow-up, Wise-setup-mail, etc).
 * Atomic via PostgREST RPC `klar_outreach_mark_mail` — see migration.
 */
export async function markMailSent(id: string): Promise<OutreachTarget> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  // PostgREST has no atomic counter via PATCH, so we fetch+inc+patch.
  // The race-window is small (admin clicks one button at a time), and
  // mails_sent is observational, not payout-critical.
  const cur = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}&select=mails_sent`,
    { headers: hdr(), cache: "no-store" },
  );
  if (!cur.ok) throw new Error(`mark_mail lookup ${cur.status}`);
  const rows = (await cur.json()) as Array<{ mails_sent: number }>;
  const next = (rows[0]?.mails_sent ?? 0) + 1;
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify({ mails_sent: next, last_mail_at: new Date().toISOString() }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`mark_mail patch ${res.status}: ${text.slice(0, 200)}`);
  }
  const updated = (await res.json()) as OutreachTarget[];
  if (!updated[0]) throw new Error("mark_mail returned no row");
  return updated[0];
}

/**
 * Markiert ein Target als `converted` (= aus dem Reply ist jetzt explizit ein
 * Affiliate geworden) und stempelt die App + Onboarding-Artefakte mit. Wird
 * NUR von der expliziten "Als Affiliate annehmen"-Aktion aufgerufen, nie
 * automatisch bei einer Antwort. Setzt converted_at + approved_app +
 * influencer_handle_in_app, optional onboarding_token/link.
 */
export async function markConverted(
  id: string,
  opts: {
    appSlug: string;
    handle: string;
    onboardingToken?: string | null;
    onboardingLink?: string | null;
    notes?: string;
  },
): Promise<OutreachTarget> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "converted",
    converted_at: now,
    approved_app: opts.appSlug,
    influencer_handle_in_app: opts.handle,
  };
  if (opts.onboardingToken !== undefined) patch.onboarding_token = opts.onboardingToken;
  if (opts.onboardingLink !== undefined) patch.onboarding_link = opts.onboardingLink;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`markConverted ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as OutreachTarget[];
  if (!rows[0]) throw new Error("markConverted returned no row");
  return rows[0];
}

export interface MetricsPatch {
  total_views_estimate?: number | null;
  avg_views_per_post?: number | null;
  engagement_rate_pct?: number | null;
  follower_estimate?: number | null;
}

/** Update the analytics-metric fields. Pass null to clear a value. */
export async function updateMetrics(id: string, patch: MetricsPatch): Promise<OutreachTarget> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`metrics patch ${res.status}: ${text.slice(0, 200)}`);
  }
  const updated = (await res.json()) as OutreachTarget[];
  if (!updated[0]) throw new Error("metrics patch returned no row");
  return updated[0];
}

/** Hard delete. There's no "trash"-bucket — mark `dead` instead if you want
 * to keep the row around for stats. */
export async function deleteOutreachTarget(id: string): Promise<void> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: hdr() },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`outreach delete ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ---------- klar_outreach_runs (Self-Service Wave audit) -------------------

export type OutreachRunStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export type OutreachLang = "de" | "en" | "es" | "it" | "fr";

export interface OutreachRun {
  id: string;
  created_at: string;
  created_by: string | null;
  status: OutreachRunStatus;
  apps: string[];
  platforms: string[];          // "tiktok" | "instagram"
  size_buckets: string[];       // "nano" | "micro" | "mid" | "macro"
  language: OutreachLang;       // drives mail-template + hashtag-bucket selection in n8n
  count_per_app: number;
  niche: string | null;
  mail_subject: string | null;
  mail_body: string | null;
  cost_estimate_usd: number | null;
  cost_actual_usd: number | null;
  apify_run_ids: Record<string, string> | null;
  targets_added: number;
  mails_sent: number;
  errors: unknown | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface CreateRunInput {
  apps: string[];
  platforms: string[];
  size_buckets?: string[];
  language?: OutreachLang;      // optional, defaults to 'de' for backwards compat
  count_per_app: number;
  niche?: string | null;
  mail_subject?: string | null;
  mail_body?: string | null;
  cost_estimate_usd?: number | null;
}

/** Insert a new outreach-wave run row. n8n consumer (next session) polls
 * status='queued' and transitions through running → done/failed. */
export async function createOutreachRun(input: CreateRunInput): Promise<OutreachRun> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body = {
    apps: input.apps,
    platforms: input.platforms,
    size_buckets: input.size_buckets ?? ["micro", "mid"],
    language: input.language ?? "de",
    count_per_app: input.count_per_app,
    niche: input.niche ?? null,
    mail_subject: input.mail_subject ?? null,
    mail_body: input.mail_body ?? null,
    cost_estimate_usd: input.cost_estimate_usd ?? null,
    created_by: "admin",
    status: "queued" as OutreachRunStatus,
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_runs`,
    {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`run insert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as OutreachRun[];
  if (!rows[0]) throw new Error("run insert returned no row");
  return rows[0];
}

// ---------- klar_app_mail_templates (per-app outreach config) --------------

export interface AppMailTemplate {
  app_slug: string;
  language: string;
  hashtags: string[];
  mail1_subject: string | null;
  mail1_body: string | null;
  mail2_subject: string | null;
  mail2_body: string | null;
  notes: string | null;
  updated_at: string;
}

export interface TemplatePatch {
  hashtags?: string[];
  mail1_subject?: string | null;
  mail1_body?: string | null;
  mail2_subject?: string | null;
  mail2_body?: string | null;
  notes?: string | null;
}

/** All per-app outreach templates, ordered by app+language. */
export async function listAppTemplates(): Promise<AppMailTemplate[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_app_mail_templates?select=*&order=app_slug.asc,language.asc`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as AppMailTemplate[];
  } catch {
    return [];
  }
}

/** Single template by (app_slug, language). Returns null if not seeded. */
export async function getAppTemplate(
  appSlug: string,
  language = "de",
): Promise<AppMailTemplate | null> {
  if (!KLAR_INBOX_KEY) return null;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_app_mail_templates?app_slug=eq.${encodeURIComponent(appSlug)}&language=eq.${encodeURIComponent(language)}&select=*&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as AppMailTemplate[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Upsert a template patch. Used by the templates editor. */
export async function upsertAppTemplate(
  appSlug: string,
  language: string,
  patch: TemplatePatch,
): Promise<AppMailTemplate> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body = {
    app_slug: appSlug,
    language,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_app_mail_templates?on_conflict=app_slug,language`,
    {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`template upsert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as AppMailTemplate[];
  if (!rows[0]) throw new Error("template upsert returned no row");
  return rows[0];
}

export interface OutreachCostSummary {
  month_runs_count: number;
  month_targets_added: number;
  month_mails_sent: number;
  month_apify_estimate_usd: number;     // sum of cost_estimate_usd
  month_apify_actual_usd: number;        // sum of cost_actual_usd (often null for now)
  apify_free_tier_usd: number;           // hardcoded $5
  brevo_free_daily_cap: number;          // hardcoded 300
  brevo_today_count: number;
}

/** Aggregate this calendar month's run-costs + Brevo daily count. Used
 * for the KPI cards in /admin?view=outreach so the admin can see how
 * close they are to the Apify free-tier cap before they start a wave. */
export async function getOutreachCostSummary(): Promise<OutreachCostSummary> {
  const empty: OutreachCostSummary = {
    month_runs_count: 0, month_targets_added: 0, month_mails_sent: 0,
    month_apify_estimate_usd: 0, month_apify_actual_usd: 0,
    apify_free_tier_usd: 5, brevo_free_daily_cap: 300, brevo_today_count: 0,
  };
  if (!KLAR_INBOX_KEY) return empty;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_runs?select=cost_estimate_usd,cost_actual_usd,targets_added,mails_sent,finished_at,created_at&created_at=gte.${encodeURIComponent(monthStart)}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return empty;
    const rows = (await res.json()) as Array<{
      cost_estimate_usd: number | null;
      cost_actual_usd: number | null;
      targets_added: number;
      mails_sent: number;
      finished_at: string | null;
    }>;
    let estimate = 0, actual = 0, targets = 0, mails = 0, todayMails = 0;
    const dayMs = new Date(dayStart).getTime();
    for (const r of rows) {
      estimate += Number(r.cost_estimate_usd ?? 0);
      actual += Number(r.cost_actual_usd ?? 0);
      targets += Number(r.targets_added ?? 0);
      mails += Number(r.mails_sent ?? 0);
      if (r.finished_at && new Date(r.finished_at).getTime() >= dayMs) {
        todayMails += Number(r.mails_sent ?? 0);
      }
    }
    return {
      ...empty,
      month_runs_count: rows.length,
      month_targets_added: targets,
      month_mails_sent: mails,
      month_apify_estimate_usd: Math.round(estimate * 1000) / 1000,
      month_apify_actual_usd: Math.round(actual * 1000) / 1000,
      brevo_today_count: todayMails,
    };
  } catch {
    return empty;
  }
}

/** Last N runs, newest first. UI uses this for the History-Table. */
export async function listOutreachRuns(limit = 25): Promise<OutreachRun[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_runs?select=*&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as OutreachRun[];
  } catch {
    return [];
  }
}

// ---------- klar_outreach_suppressions (do-not-contact list) ---------------

export type SuppressionReason =
  | "stop_request"
  | "bounce"
  | "spam_complaint"
  | "manual"
  | "opted_out"
  | "invalid"
  | "double_ask";

export interface SuppressionRow {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "*";
  email: string | null;
  reason: SuppressionReason;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface AddSuppressionInput {
  handle: string;
  platform: "tiktok" | "instagram" | "*";
  reason: SuppressionReason;
  source: string;
  email?: string | null;
  notes?: string | null;
}

/** Upsert one suppression row. Idempotent on (lower(handle), platform). */
export async function addSuppression(input: AddSuppressionInput): Promise<SuppressionRow> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body = {
    handle: input.handle.trim().toLowerCase().replace(/^@+/, ""),
    platform: input.platform,
    reason: input.reason,
    source: input.source,
    email: input.email?.trim().toLowerCase() ?? null,
    notes: input.notes ?? null,
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_outreach_suppressions?on_conflict=handle,platform`,
    {
      method: "POST",
      headers: { ...hdr(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`suppression insert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as SuppressionRow[];
  if (!rows[0]) throw new Error("suppression insert returned no row");
  return rows[0];
}

/** Check if any of the given handles/emails are on the suppression list.
 *  Use platform = "tiktok"|"instagram" to also match "*" wildcard rows,
 *  or omit to only match exact-handle rows regardless of platform. */
export async function checkSuppressions(opts: {
  handles?: string[];
  platform?: "tiktok" | "instagram";
  emails?: string[];
}): Promise<SuppressionRow[]> {
  if (!KLAR_INBOX_KEY) return [];
  const handles = (opts.handles ?? [])
    .map((h) => h.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean);
  const emails = (opts.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (handles.length === 0 && emails.length === 0) return [];

  const out: SuppressionRow[] = [];
  const seen = new Set<string>();

  if (handles.length > 0) {
    const handleList = handles.map((h) => `"${h.replace(/"/g, "")}"`).join(",");
    const platformFilter = opts.platform
      ? `&platform=in.("${opts.platform}","*")`
      : "";
    const url = `${KLAR_INBOX_URL}/rest/v1/klar_outreach_suppressions?handle=in.(${handleList})${platformFilter}&select=*`;
    try {
      const res = await fetch(url, { headers: hdr(), cache: "no-store" });
      if (res.ok) {
        const rows = (await res.json()) as SuppressionRow[];
        for (const r of rows) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
        }
      }
    } catch { /* swallow, partial results ok */ }
  }

  if (emails.length > 0) {
    const emailList = emails.map((e) => `"${e.replace(/"/g, "")}"`).join(",");
    const url = `${KLAR_INBOX_URL}/rest/v1/klar_outreach_suppressions?email=in.(${emailList})&select=*`;
    try {
      const res = await fetch(url, { headers: hdr(), cache: "no-store" });
      if (res.ok) {
        const rows = (await res.json()) as SuppressionRow[];
        for (const r of rows) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
        }
      }
    } catch { /* swallow */ }
  }

  return out;
}

/** Last N suppressions, newest first. UI uses this for the admin-table. */
export async function listSuppressions(limit = 50): Promise<SuppressionRow[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_suppressions?select=*&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 200)}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as SuppressionRow[];
  } catch {
    return [];
  }
}

// ---------- klar_outreach_messages (conversation thread) -------------------
// Append-only message log per target. Powers the /admin/replies mail-client
// (full thread + inbound reply count). See migration 0004_outreach_messages.sql.
// Inbound rows are written by the Brevo inbound webhook, outbound rows by the
// admin reply route.

// Local UUID guard for the messages helpers (kept separate from route-layer
// validators so this module stays self-contained).
const UUID_RE_STORE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OutreachDirection = "in" | "out";

export interface OutreachMessage {
  id: string;
  target_id: string;
  direction: OutreachDirection;
  subject: string | null;
  body: string;
  from_email: string | null;
  to_email: string | null;
  provider: string | null;
  external_id: string | null;
  spam_score: number | null;
  sent_at: string | null;
  created_at: string;
}

export interface InsertMessageInput {
  target_id: string;
  direction: OutreachDirection;
  subject?: string | null;
  body: string;
  from_email?: string | null;
  to_email?: string | null;
  provider?: string | null;
  external_id?: string | null;
  spam_score?: number | null;
  sent_at?: string | null;
}

/** All thread messages for the given target ids, oldest first. One query,
 *  grouped by the caller. Returns [] on any failure so the UI never crashes. */
export async function listMessagesForTargets(
  ids: string[],
): Promise<OutreachMessage[]> {
  if (!KLAR_INBOX_KEY) return [];
  const clean = ids.filter((x) => UUID_RE_STORE.test(x));
  if (clean.length === 0) return [];
  try {
    const inList = clean.map((x) => encodeURIComponent(x)).join(",");
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_messages?select=*&target_id=in.(${inList})&order=created_at.asc&limit=2000`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as OutreachMessage[];
  } catch {
    return [];
  }
}

/** Append one message to the thread. Best-effort: a 409 (duplicate
 *  external_id from a webhook retry) resolves to null instead of throwing. */
export async function insertMessage(
  input: InsertMessageInput,
): Promise<OutreachMessage | null> {
  if (!KLAR_INBOX_KEY) return null;
  const body = {
    target_id: input.target_id,
    direction: input.direction,
    subject: input.subject ?? null,
    body: input.body ?? "",
    from_email: input.from_email ?? null,
    to_email: input.to_email ?? null,
    provider: input.provider ?? null,
    external_id: input.external_id ?? null,
    spam_score: input.spam_score ?? null,
    sent_at: input.sent_at ?? null,
  };
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_outreach_messages`, {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) return null; // dedupe on external_id, already stored
    if (!res.ok) return null;
    const rows = (await res.json()) as OutreachMessage[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Find a target by its contact_email (newest first). Used by the inbound
 *  webhook to match a reply whose sender address we already know. */
export async function findTargetByEmail(
  email: string,
): Promise<OutreachTarget | null> {
  if (!KLAR_INBOX_KEY) return null;
  const e = email.trim().toLowerCase();
  if (!e) return null;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?contact_email=eq.${encodeURIComponent(e)}&select=*&order=updated_at.desc&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as OutreachTarget[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Stamp a target after an inbound reply landed. Promotes queued/dm_sent to
 *  'replied' (never downgrades converted/declined/dead), always refreshes
 *  last_message + last_message_at, and fills replied_at on the first reply.
 *  Best-effort: swallows errors (the message row is already stored). */
export async function recordInboundReply(
  id: string,
  opts: { body: string; subject?: string | null; at?: string | null },
): Promise<void> {
  if (!KLAR_INBOX_KEY) return;
  try {
    const cur = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}&select=status,replied_at`,
      { headers: hdr(), cache: "no-store" },
    );
    const rows = cur.ok ? ((await cur.json()) as Array<{ status: OutreachStatus; replied_at: string | null }>) : [];
    const row = rows[0];
    const when = opts.at ?? new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_message: opts.body.slice(0, 8000),
      last_message_at: when,
    };
    if (opts.subject) patch.reply_subject = opts.subject.slice(0, 300);
    if (row && (row.status === "queued" || row.status === "dm_sent")) patch.status = "replied";
    if (row && !row.replied_at) patch.replied_at = when;
    await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch {
    /* message already persisted; target stamp is best-effort */
  }
}

// ---------- in-app outreach mailer (Mail-1 cold contact, replaces n8n send) --
// Selector + stamp used by lib/outreachMailer.ts. Scraping stays in n8n; only
// the Mail-1 SEND step moves in-app here. Mail-2 is no longer a blast stage —
// the interested-reply detail mail is sent on-demand from the reply/accept flow.

/** Targets awaiting first contact: queued, never mailed, with an email. */
export async function listTargetsForMail1(limit = 50): Promise<OutreachTarget[]> {
  if (!KLAR_INBOX_KEY) return [];
  const lim = Math.min(Math.max(limit, 1), 500);
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?status=eq.queued&mail_status=is.null&contact_email=not.is.null&order=priority.asc,queued_at.asc&limit=${lim}&select=*`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as OutreachTarget[];
  } catch {
    return [];
  }
}

/** Stamp a target after the Mail-1 cold-contact send (status + timestamp +
 *  counter). Mail-2 is no longer a mailer stage — the interested-reply detail
 *  mail goes out on-demand from the reply/accept flow. */
export async function markMail1Sent(id: string): Promise<void> {
  if (!KLAR_INBOX_KEY) return;
  const now = new Date().toISOString();
  let mails = 0;
  try {
    const cur = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}&select=mails_sent`,
      { headers: hdr(), cache: "no-store" },
    );
    if (cur.ok) {
      const rows = (await cur.json()) as Array<{ mails_sent: number }>;
      mails = rows[0]?.mails_sent ?? 0;
    }
  } catch {
    /* counter read best-effort */
  }
  const patch: Record<string, unknown> = {
    mail_status: "mail1_sent",
    mail1_sent_at: now,
    status: "dm_sent",
    mails_sent: mails + 1,
    last_mail_at: now,
  };
  try {
    await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch {
    /* stamp best-effort */
  }
}

/** Atomically claim a target for the Mail-1 send so two concurrent or retried
 *  mailer runs never double-send the same person. The conditional PATCH only
 *  flips a still-eligible target (queued + never mailed) to 'mail1_sending';
 *  PostgREST returns the updated rows, so we win the claim iff exactly one row
 *  came back. A second run sees 0 rows (already claimed/sent) and skips. */
export async function claimTargetForMail1(id: string): Promise<boolean> {
  if (!KLAR_INBOX_KEY) return false;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}&status=eq.queued&mail_status=is.null`,
      {
        method: "PATCH",
        headers: { ...hdr(), Prefer: "return=representation" },
        body: JSON.stringify({ mail_status: "mail1_sending" }),
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length === 1;
  } catch {
    return false;
  }
}

/** Revert a Mail-1 claim back to eligible when the send failed, so the target is
 *  picked up again next run instead of being stranded in 'mail1_sending'. */
export async function releaseMail1Claim(id: string): Promise<void> {
  if (!KLAR_INBOX_KEY) return;
  try {
    await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?id=eq.${encodeURIComponent(id)}&mail_status=eq.mail1_sending`,
      {
        method: "PATCH",
        headers: { ...hdr(), Prefer: "return=minimal" },
        body: JSON.stringify({ mail_status: null }),
      },
    );
  } catch {
    /* best-effort: a stranded 'mail1_sending' is rare and visible in the DB */
  }
}
