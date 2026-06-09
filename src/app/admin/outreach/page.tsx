// Klar Control · Outreach — influencer outreach tracker + wave starter.
//
// Server component. Reads klar_outreach_targets / runs / suppressions + live
// Apify + Brevo quota, renders the wave-starter, run history, per-app buckets,
// target table and suppression list. Same chrome + 2FA gate as the rest of
// /admin, plus confirm-modal infra (data-klar-confirm). Inner content is an
// HTML string injected into .content; the add-form + wave-form <script>s plus
// the auto-refresh <meta> are rendered as top-level elements since innerHTML
// scripts/meta don't run/hoist. Reply handling lives in /admin/replies.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (+ APIFY_API_TOKEN, BREVO_API_KEY for the live quota cards).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ICON,
  readCookieFromString,
  esc,
  fmtRelative,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  getOutreachStats,
  listOutreachTargets,
  listOutreachRuns,
  getOutreachCostSummary,
  listSuppressions,
  isOutreachConfigured,
  SIZE_BUCKETS,
  type SizeBucket,
  type OutreachPlatform,
  type OutreachStatus,
  type OutreachTarget,
  type OutreachRun,
  type SuppressionRow,
} from "../../../lib/outreachStore";
import { getApifyAccountStatus } from "../../../lib/apifyAccount";
import { getBrevoQuota } from "../../../lib/brevoQuota";
import { KLAR_APPS } from "../../../lib/klarApps";
import OutreachKpis, { type OutreachStatsLite } from "./OutreachKpis";
import OutreachBilling, { type OutreachBillingData } from "./OutreachBilling";
import OutreachTabs, { type OutreachTab } from "./OutreachTabs";
import OutreachEvomiTrial from "./OutreachEvomiTrial";
import OutreachFilters, { type OutreachFilterState } from "./OutreachFilters";
import OutreachRuns, { type RunRowData, type RunBadgeTone } from "./OutreachRuns";
import OutreachTargetsByApp, { type AppBuckets, type TargetMini } from "./OutreachTargetsByApp";
import OutreachWaveForm, { type WaveFormApp, type WaveRegion, type WaveSize } from "./OutreachWaveForm";
import OutreachAddForm, { type AddFormApp } from "./OutreachAddForm";
import OutreachSuppressions, { type SuppressionRowData } from "./OutreachSuppressions";
import OutreachTargets from "./OutreachTargets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const STATUS_LABEL: Record<OutreachStatus, string> = {
  queued: "Queued",
  dm_sent: "DM gesendet",
  replied: "Geantwortet",
  declined: "Abgelehnt",
  converted: "Converted",
  dead: "Dead",
};
const TARGET_STATUS_ORDER: OutreachStatus[] = [
  "queued", "dm_sent", "replied", "converted", "declined", "dead",
];
// Heuristik: Outreach-Target stammt aus internem Self-Test.
const isTestTarget = (t: OutreachTarget): boolean => {
  const h = (t.handle ?? "").toLowerCase();
  const e = (t.contact_email ?? "").toLowerCase();
  if (e === "alainkessler04@gmail.com") return true;
  if (h.includes("selftest") || h === "klar_test" || h.startsWith("klar_s")) return true;
  if ((t.niche ?? "").toLowerCase().startsWith("evomi-trial")) return true; // Evomi-Trial-Rows default ausblenden
  return false;
};


type OutreachMainResult =
  | { configured: false; html: string }
  | {
      configured: true;
      topHtml: string;
      midTopHtml: string;
      runs: RunRowData[];
      hasRunningWave: boolean;
      midBotHtml: string;
      bottomHeadHtml: string;
      addFormApps: AddFormApp[];
      suppressionRows: SuppressionRowData[];
      rows: OutreachTarget[];
      filterActive: boolean;
      stats: OutreachStatsLite;
      filter: OutreachFilterState;
      billing: OutreachBillingData;
      targetsByApp: AppBuckets[];
      wave: { apps: WaveFormApp[]; regions: WaveRegion[]; sizes: WaveSize[]; defaultSubject: string; defaultBody: string };
    };

async function outreachMain(
  filterPlatform: string,
  filterStatus: string,
  filterApp: string,
  filterSize: string,
  query: string,
  autoRefresh: boolean,
  showTests: boolean,
): Promise<OutreachMainResult> {
  if (!isOutreachConfigured()) {
    return { configured: false, html: `<h1>Outreach</h1><p class="sub muted">Outreach-Tracker braucht <span class="warn">KLAR_INBOX_SERVICE_KEY</span> in Vercel (anime-vault Service-Role). Tabelle <code>klar_outreach_targets</code> ist via Migration <code>klar_outreach_targets_v1</code> + <code>v2_metrics</code> angelegt.</p>` };
  }

  const platform = (["tiktok", "instagram"].includes(filterPlatform) ? filterPlatform : "all") as
    | OutreachPlatform | "all";
  const status = (TARGET_STATUS_ORDER as string[]).includes(filterStatus)
    ? (filterStatus as OutreachStatus)
    : "all";
  const app = filterApp && filterApp !== "all" ? filterApp : "all";
  const size = (["nano", "micro", "mid", "macro"].includes(filterSize) ? filterSize : "all") as SizeBucket | "all";
  const q = query.trim().slice(0, 80);

  const [stats, rowsRaw, runs, costSummary, allTargets, apifyAccount, brevoQuota, suppressions] = await Promise.all([
    getOutreachStats(),
    listOutreachTargets({ platform, status, app, size, query: q, limit: 200 }),
    listOutreachRuns(10),
    getOutreachCostSummary(),
    listOutreachTargets({ platform: "all", status: "all", app: "all", limit: 500 }),
    getApifyAccountStatus(),
    getBrevoQuota(),
    listSuppressions(20),
  ]);
  // Test-Targets standardmäßig ausblenden, mit Toggle. Counter zählt aus
  // dem aktuell geladenen Subset (rowsRaw), nicht aus allTargets — sonst
  // verwirrt die Zahl wenn ein anderer Filter aktiv ist.
  const nTests = rowsRaw.filter(isTestTarget).length;
  const rows = showTests ? rowsRaw : rowsRaw.filter((t) => !isTestTarget(t));

  // KPI cards + filter strip now render as shadcn React components
  // (OutreachKpis / OutreachFilters) in the page; only the data is computed here.
  const statusOptions = TARGET_STATUS_ORDER.map((s) => ({ value: s as string, label: STATUS_LABEL[s] }));
  const sizeOptions = SIZE_BUCKETS.map((b) => ({ value: b.value as string, label: b.label, range: b.range }));
  const testsToggleHref = (() => {
    const parts: string[] = ["view=outreach"];
    if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
    if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
    if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
    if (size !== "all") parts.push(`sz=${encodeURIComponent(size)}`);
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (autoRefresh) parts.push("ar=1");
    if (!showTests) parts.push("show_tests=1");
    return `/admin?${parts.join("&")}`;
  })();
  const testsToggle = nTests > 0
    ? `<div style="margin:0 0 14px;padding:10px 14px;background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showTests ? "⚙" : "•"} ${nTests} Test-Target${nTests === 1 ? "" : "s"}${showTests ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${testsToggleHref}" style="font-size:12px">${showTests ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";
  const appOptions = ["all", ...KLAR_APPS.map((a) => a.slug)];

  const addFormApps = KLAR_APPS.map((a) => ({ slug: a.slug, name: a.name }));

  // Wave-starter data for the <OutreachWaveForm> shadcn component (replaces the
  // old waveForm HTML string + the wave half of OutreachClientScripts).
  const liveApps = KLAR_APPS.filter((a) => a.status === "LIVE").map((a) => ({ slug: a.slug, name: a.name }));
  const waveRegions = [
    { value: "de", label: "DE", flag: "🇩🇪", market: "DACH" },
    { value: "en", label: "EN", flag: "🌐", market: "Global EN" },
    { value: "es", label: "ES", flag: "🇪🇸", market: "Espana + LatAm" },
    { value: "it", label: "IT", flag: "🇮🇹", market: "Italia" },
    { value: "fr", label: "FR", flag: "🇫🇷", market: "France + BE" },
  ];
  const waveSizes = SIZE_BUCKETS.map((b) => ({ value: b.value as string, label: b.label, range: b.range }));
  const defaultMailSubject = "Quick collab idea: {{app_name}} x @{{handle}}";
  const defaultMailBody = `Hi {{name}},

[1 spezifischer Satz zu ihrem Content der zeigt dass du wirklich folgst].

Quick intro: I'm Alain, solo-dev behind {{app_name}}, [1-sentence USP].

Why I'm writing: your audience overlaps strongly with our users. What I can offer:
- Free Lifetime Premium for you, no strings
- Your personal creator link: 50% revenue-share on every Premium sub it brings in, for 24 months, auto-tracked, paid out monthly (Wise/PayPal/SEPA)
- Optional flat fee per post on top if you'd rather de-risk it
- Full creative freedom, no scripts, no approval cycles

If interested I'll send a 5-min Loom of the app plus 2-3 hook ideas in your content style. If not, no worries.

Cheers,
Alain
getklar.org`;

  // Run-History compact-Tabelle (letzte 10 Runs).
  const STALE_MS = 10 * 60 * 1000;  // running > 10min → "may be stuck"
  const now = Date.now();
  const isStale = (r: OutreachRun) =>
    r.status === "running" && r.started_at &&
    now - new Date(r.started_at).getTime() > STALE_MS;

  const getPhaseLabel = (r: OutreachRun): { label: string; tone: "wait" | "active" | "done" | "warn" } | null => {
    if (r.status === "queued") return { label: "queued", tone: "wait" };
    if (r.status === "done") {
      const wasBackstop = r.errors && typeof r.errors === "object" && (r.errors as Record<string, unknown>).phase === "backstop";
      if (wasBackstop) return { label: "0 targets (backstopped)", tone: "warn" };
      return null; // status pill suffices
    }
    if (r.status === "failed" || r.status === "cancelled") return null;
    if (r.status !== "running" || !r.started_at) return null;
    const ageSec = (now - new Date(r.started_at).getTime()) / 1000;
    const added = r.targets_added ?? 0;
    const sent = r.mails_sent ?? 0;
    if (added === 0 && sent === 0) {
      if (ageSec < 90) return { label: "Apify scraping", tone: "active" };
      if (ageSec < 60 + STALE_MS / 1000) return { label: "Backstop ETA <60s", tone: "wait" };
      return { label: "stale", tone: "warn" };
    }
    if (added > 0 && sent < added) return { label: `sending mails (${sent}/${added})`, tone: "active" };
    if (added > 0 && sent === added) return { label: "finalizing", tone: "active" };
    return null;
  };

  const phaseToneMap: Record<"wait" | "active" | "done" | "warn", RunBadgeTone> = {
    wait: "warn",
    active: "info",
    done: "ok",
    warn: "danger",
  };
  const runStatusTone = (r: OutreachRun): RunBadgeTone => {
    if (isStale(r)) return "danger";
    return r.status === "done" ? "ok"
      : r.status === "running" ? "info"
      : r.status === "failed" ? "danger"
      : r.status === "queued" ? "warn"
      : "neutral";
  };

  const hasRunningWave = runs.some((r) => r.status === "running" || r.status === "queued");

  // Per-run display data for the shadcn <OutreachRuns> component — plain strings
  // + badge tones, reusing the phase/stale logic above. No HTML, no mail logic.
  const runsData: RunRowData[] = runs.map((r) => {
    const hasDetail = Boolean(
      r.errors || r.status === "failed" || isStale(r) || r.niche || (r.mail_subject && r.mail_subject.length > 0),
    );
    const running = r.status === "running" && !!r.started_at;
    const duration = r.finished_at && r.started_at
      ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
      : running && r.started_at
        ? `${Math.round((now - new Date(r.started_at).getTime()) / 1000)}s`
        : "—";
    const phase = getPhaseLabel(r);
    return {
      id: r.id,
      whenRel: fmtRelative(r.created_at),
      apps: r.apps ?? [],
      language: r.language ?? "de",
      platforms: r.platforms ?? [],
      count: r.count_per_app,
      costEstimate: r.cost_estimate_usd != null ? Number(r.cost_estimate_usd) : null,
      costActual: r.cost_actual_usd != null ? Number(r.cost_actual_usd) : null,
      targetsAdded: r.targets_added,
      mailsSent: r.mails_sent,
      duration,
      running,
      statusLabel: isStale(r) ? "stale running" : r.status,
      statusTone: runStatusTone(r),
      phaseLabel: phase?.label ?? null,
      phaseTone: phase ? phaseToneMap[phase.tone] : null,
      detail: hasDetail
        ? {
            buckets: r.size_buckets && r.size_buckets.length > 0 ? r.size_buckets.join(", ") : "—",
            niche: r.niche ?? "—",
            duration,
            runIdShort: r.id.slice(0, 8),
            mailSubject: r.mail_subject || null,
            errorsJson: r.errors ? JSON.stringify(r.errors, null, 2) : null,
          }
        : null,
    };
  });

  // ===== Targets nach App + Status (Angefragt / Reply / Angenommen) =====
  type Bucket = "angefragt" | "reply" | "angenommen";
  const targetBucket = (t: OutreachTarget): Bucket | null => {
    if (t.status === "converted") return "angenommen";
    if (t.status === "replied") return "reply";
    if (t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent" || t.status === "dm_sent") return "angefragt";
    return null; // queued / declined / dead → hier nicht zeigen
  };
  const byAppBucket = new Map<string, Record<Bucket, OutreachTarget[]>>();
  for (const meta of KLAR_APPS) {
    byAppBucket.set(meta.slug, { angefragt: [], reply: [], angenommen: [] });
  }
  for (const t of allTargets) {
    const b = targetBucket(t);
    if (!b) continue;
    for (const slug of (t.for_apps ?? [])) {
      const bucket = byAppBucket.get(slug);
      if (bucket) bucket[b].push(t);
    }
  }
  const newestFirst = (a: OutreachTarget, b: OutreachTarget) => {
    const ax = new Date(a.last_message_at || a.mail1_sent_at || a.updated_at).getTime();
    const bx = new Date(b.last_message_at || b.mail1_sent_at || b.updated_at).getTime();
    return bx - ax;
  };
  for (const bucket of byAppBucket.values()) {
    bucket.angefragt.sort(newestFirst);
    bucket.reply.sort(newestFirst);
    bucket.angenommen.sort(newestFirst);
  }

  // ===== Targets nach App: plain data for the <OutreachTargetsByApp> shadcn comp =====
  const followerLabel = (n: number | null): string =>
    n
      ? n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)
      : "";
  const toMini = (t: OutreachTarget): TargetMini => ({
    handle: t.handle,
    profileUrl: t.profile_url,
    platform: t.platform,
    followerLabel: followerLabel(t.follower_estimate),
    niche: t.niche,
    contactEmail: t.contact_email,
    lastMessage: t.last_message ? t.last_message.slice(0, 90) : null,
    sentRel: t.mail1_sent_at ? fmtRelative(t.mail1_sent_at) : "",
  });
  const targetsByApp: AppBuckets[] = KLAR_APPS.map((meta) => {
    const bucket = byAppBucket.get(meta.slug)!;
    return {
      slug: meta.slug,
      name: meta.name,
      angefragt: bucket.angefragt.map(toMini),
      reply: bucket.reply.map(toMini),
      angenommen: bucket.angenommen.map(toMini),
    };
  });

  // ===== Billing/budget for the <OutreachBilling> shadcn card =====
  // Replaces the old apifyAccCard / brevoQuotaCard / costCard HTML blocks.
  const fmtCycle = (iso: string | null): string => {
    if (!iso) return "?";
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
  };
  // Prefer the plan cap as the budget ceiling (that's where Apify actually blocks
  // further spend); the included usage-credits are only the free allowance inside
  // the plan price and can be exceeded up to the cap.
  const apifyBudget = apifyAccount.max_monthly_usage_usd ?? apifyAccount.monthly_usage_credits_usd;
  const apifyBudgetKind: "credits" | "cap" | "none" =
    apifyAccount.max_monthly_usage_usd != null
      ? "cap"
      : apifyAccount.monthly_usage_credits_usd != null
        ? "credits"
        : "none";
  const apifyPct = apifyBudget && apifyBudget > 0
    ? Math.min(100, Math.round((apifyAccount.monthly_usage_usd / apifyBudget) * 100))
    : null;
  const klarApifyUsed = costSummary.month_apify_actual_usd || costSummary.month_apify_estimate_usd;
  const klarSharePct = apifyAccount.monthly_usage_usd > 0
    ? Math.round((klarApifyUsed / apifyAccount.monthly_usage_usd) * 100)
    : null;
  const apifyPlanLabel = apifyAccount.plan_id
    ? (apifyAccount.monthly_base_price_usd != null && apifyAccount.monthly_base_price_usd > 0
        ? `${apifyAccount.plan_id} · $${apifyAccount.monthly_base_price_usd.toFixed(0)}/mo`
        : apifyAccount.plan_id)
    : null;
  const brevoResetUtc = new Date();
  brevoResetUtc.setUTCHours(24, 0, 0, 0);
  const brevoResetHours = Math.max(0, Math.round((brevoResetUtc.getTime() - Date.now()) / 3600000 * 10) / 10);
  const brevoOk = brevoQuota.state === "ok";
  const brevoNote = brevoQuota.state === "no-key"
    ? "BREVO_API_KEY fehlt in den Vercel-Env-Vars (Free-Plan = 300 Mails/Tag)."
    : brevoQuota.state === "http-error"
      ? `HTTP ${brevoQuota.status}: ${brevoQuota.bodySnippet}`
      : brevoQuota.state === "exception"
        ? brevoQuota.message
        : null;
  const brevoUsed = brevoQuota.state === "ok" ? brevoQuota.usedToday : 0;
  const brevoCap = brevoQuota.state === "ok" ? brevoQuota.capDaily : 300;
  const brevoPctVal = brevoCap > 0 ? Math.min(100, Math.round((brevoUsed / brevoCap) * 100)) : 0;
  const waveActualPct = costSummary.month_apify_estimate_usd > 0
    ? Math.round((costSummary.month_apify_actual_usd / costSummary.month_apify_estimate_usd) * 100)
    : null;
  const billing: OutreachBillingData = {
    apify: {
      ok: apifyAccount.ok,
      reason: apifyAccount.reason,
      planLabel: apifyPlanLabel,
      usageUsd: apifyAccount.monthly_usage_usd,
      budgetUsd: apifyBudget ?? null,
      budgetKind: apifyBudgetKind,
      remainingUsd: apifyBudget != null
        ? Math.max(0, Math.round((apifyBudget - apifyAccount.monthly_usage_usd) * 100) / 100)
        : null,
      pct: apifyPct,
      cycleResetLabel: apifyAccount.cycle_end ? fmtCycle(apifyAccount.cycle_end) : null,
      cuUsed: apifyAccount.compute_units_used,
      cuMax: apifyAccount.compute_units_max,
      klarShareUsd: klarSharePct !== null ? Math.round(klarApifyUsed * 100) / 100 : null,
      klarSharePct,
    },
    brevo: {
      ok: brevoOk,
      note: brevoNote,
      planName: brevoQuota.state === "ok" ? brevoQuota.planName ?? null : null,
      usedToday: brevoUsed,
      capDaily: brevoCap,
      pct: brevoPctVal,
      resetHours: brevoResetHours,
    },
    waves: {
      runs: costSummary.month_runs_count,
      targets: costSummary.month_targets_added,
      mails: costSummary.month_mails_sent,
      apifyEstimateUsd: costSummary.month_apify_estimate_usd,
      apifyActualUsd: costSummary.month_apify_actual_usd,
      actualPct: waveActualPct,
    },
  };

  // Suppression rows for the <OutreachSuppressions> shadcn component.
  const suppressionRows = suppressions.map((sr: SuppressionRow) => ({
    whenRel: fmtRelative(sr.created_at),
    handle: sr.handle,
    platform: sr.platform,
    reason: sr.reason,
    source: sr.source,
    email: sr.email ?? "",
    notes: sr.notes ?? "",
  }));
  // Reply-Inbox lebt jetzt zentral im Postfach (/admin/replies); Outreach ist
  // reiner Scraper/Wave-Tool. "Eingegangene Antworten" + "Offene Anfragen" sind
  // dorthin gewandert.
  // Split into fragments so the KPI cards + filter strip can render as shadcn
  // React components between them. The wave form, run history, targets-by-app,
  // add form, target table and suppression list stay as HTML strings (their
  // inline scripts query the document, so splitting the markup is harmless).
  const topHtml = `<h1>Outreach</h1>
    <p class="sub">Influencer-Outreach-Tracker. <em>Queued → DM gesendet → Antwort → Converted</em>. Auto-Refresh ${autoRefresh ? "alle 15s" : "aus"}, Daten aus Supabase anime-vault.</p>`;

  const midTopHtml = `<div style="margin:24px 0 16px;border-top:1px solid var(--line)"></div>`;

  const midBotHtml = `<div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>`;

  // Targets table is now the <OutreachTargets/> shadcn component (rendered in the
  // page between these two HTML fragments). Heading + tests toggle stay HTML;
  // the suppression list stays HTML below the component.
  const bottomHeadHtml = `<h2>Targets <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${rows.length} angezeigt${q ? ` · Suche: <em>${esc(q)}</em>` : ""}</span></h2>
    ${testsToggle}`;
  const filterActive = platform !== "all" || status !== "all" || app !== "all" || size !== "all" || Boolean(q);

  return {
    configured: true,
    topHtml,
    midTopHtml,
    runs: runsData,
    hasRunningWave,
    midBotHtml,
    bottomHeadHtml,
    addFormApps,
    suppressionRows,
    rows,
    filterActive,
    stats,
    billing,
    targetsByApp,
    wave: { apps: liveApps, regions: waveRegions, sizes: waveSizes, defaultSubject: defaultMailSubject, defaultBody: defaultMailBody },
    filter: { platform, status, app, size, q, autoRefresh, showTests, statusOptions, appOptions, sizeOptions },
  };
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; s?: string; a?: string; sz?: string; q?: string; ar?: string; show_tests?: string; msg?: string; tab?: string }>;
}) {
  // Auth — identical gate to brain/cal/bookings/revenue (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const filterPlatform = sp.p ?? "all";
  const filterStatus = sp.s ?? "all";
  const filterApp = sp.a ?? "all";
  const filterSize = sp.sz ?? "all";
  const query = sp.q ?? "";
  const autoRefresh = sp.ar === "1";
  const showTests = sp.show_tests === "1";

  const result = await outreachMain(filterPlatform, filterStatus, filterApp, filterSize, query, autoRefresh, showTests);

  // Sub-menu: ?tab= drives which panel renders. Unknown/missing -> pipeline.
  const OUTREACH_TABS = ["pipeline", "abrechnung", "sperrliste", "scrape"] as const;
  const tab: OutreachTab = (OUTREACH_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as OutreachTab)
    : "pipeline";

  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const topbar = `
    <span class="crumb"><b>Outreach</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Outreach · Klar Control</title>
      {autoRefresh ? <meta httpEquiv="refresh" content="15" /> : null}
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        {result.configured ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: flash + result.topHtml }} />
            <OutreachTabs active={tab} filterParams={result.filter} />

            {/* PIPELINE */}
            <div hidden={tab !== "pipeline"}>
              <OutreachKpis stats={result.stats} />
              <OutreachWaveForm
                apps={result.wave.apps}
                regions={result.wave.regions}
                sizes={result.wave.sizes}
                defaultSubject={result.wave.defaultSubject}
                defaultBody={result.wave.defaultBody}
              />
              <div dangerouslySetInnerHTML={{ __html: result.midTopHtml }} />
              <OutreachRuns runs={result.runs} hasRunningWave={result.hasRunningWave} />
              <OutreachTargetsByApp data={result.targetsByApp} />
              <div dangerouslySetInnerHTML={{ __html: result.midBotHtml }} />
              <OutreachAddForm apps={result.addFormApps} />
              <OutreachFilters {...result.filter} />
              <div dangerouslySetInnerHTML={{ __html: result.bottomHeadHtml }} />
              <OutreachTargets targets={result.rows} filterActive={result.filterActive} />
            </div>

            {/* ABRECHNUNG */}
            <div hidden={tab !== "abrechnung"}>
              <OutreachBilling data={result.billing} />
            </div>

            {/* SPERRLISTE */}
            <div hidden={tab !== "sperrliste"}>
              <OutreachSuppressions rows={result.suppressionRows} />
            </div>

            {/* EVOMI (n8n-frei) */}
            <div hidden={tab !== "scrape"}>
              <p className="text-[12.5px] text-fg-3 max-w-[80ch] mt-2 mb-1">
                n8n-frei: Kandidaten kommen aus Apify, die Anreicherung (Bio, Follower, E-Mail) läuft
                über die Evomi-Scraper-API, direkt in-app. Die laufende n8n-Pipeline ist im
                Pipeline-Tab.
              </p>
              <OutreachEvomiTrial
                appsLive={KLAR_APPS.filter((a) => a.status === "LIVE").map((a) => ({ slug: a.slug, name: a.name }))}
              />
            </div>
          </>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: flash + result.html }} />
        )}
      </div>
    </>
  );
}
