// SERVER ONLY. The daily run of the estimate (lib/creatorModel, migrations/0048,
// spec Projects/Klar/specs/creator-plattform, ticket 05). Hit by the cron
// /api/cron/creator-model after app-metrics, so RevenueCat's numbers are fresh.
//
//   window      the current month, at least the last 28 days, never before the
//               first view snapshot (21.10.2026)
//   exposure    fresh views of every post that advertises Basalt: our own
//               accounts, link creators, creator posts that mention Basalt
//   paid        only counted posts (counts, approved): they were checked while
//               the creator had no link; after switching to a link his new
//               posts are `link` and paid through it
//   rate        fitted once the snapshots cover MIN_FIT_DAYS, else the prior
//   revenue     RevenueCat revenue of 28 days / new users of 30 days
//
// On the 1st the previous month is computed once more, so its last hours count.

import "server-only";
import { getApps } from "./adminApps";
import { CREATOR_APP } from "./creatorAccounts";
import { HOUR, MIN_FIT_DAYS, PRIOR_RATE_PER_1000, estimateMonth, fitRate, freshViews, type Snapshot } from "./creatorModel";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
/** Basalt's key in KLAR_ADMIN_APPS and klar_app_metrics_daily. */
const APP_BACKEND = "wavelength";
const PAGE = 1000;
const DAY = 24 * HOUR;
const PAID = new Set(["counts", "approved"]);

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

/** All rows, page by page (PostgREST stops at 1000). */
async function hubAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${HUB}/rest/v1/${path}&limit=${PAGE}&offset=${offset}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`hub ${res.status} ${path.split("?")[0]}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function hubFirst<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${HUB}/rest/v1/${path}&limit=1`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`hub ${res.status} ${path.split("?")[0]}`);
  return ((await res.json()) as T[])[0];
}

async function upsert(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${HUB}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`hub ${res.status} ${table}: ${await res.text()}`);
}

const monthStart = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Sums an hourly series into days, starting at `from`. */
function byDay(series: ArrayLike<number>, from: number, start = 0, end = series.length): Map<string, number> {
  const out = new Map<string, number>();
  for (let h = start; h < end; h++) {
    const d = isoDay(from + h * HOUR);
    out.set(d, (out.get(d) ?? 0) + series[h]);
  }
  return out;
}

export interface ModelRunResult {
  ok: boolean;
  error?: string;
  ratePer1000?: number;
  rateSource?: "prior" | "fit";
  creators?: number;
}

export async function runCreatorModel(now = Date.now()): Promise<ModelRunResult> {
  const basalt = getApps().find((a) => a.slug === APP_BACKEND);
  if (!basalt) return { ok: false, error: "Basalt fehlt in KLAR_ADMIN_APPS" };

  const nowHour = Math.floor(now / HOUR) * HOUR;
  const first = await hubFirst<{ fetched_at: string }>("klar_post_views?select=fetched_at&order=fetched_at.asc");
  if (!first) return { ok: false, error: "noch keine View-Stände" };
  const firstHour = Math.floor(Date.parse(first.fetched_at) / HOUR) * HOUR;
  const months = [monthStart(now)];
  if (new Date(now).getUTCDate() === 1) months.unshift(monthStart(now - 2 * DAY));
  const from = Math.max(firstHour, Math.min(months[0], nowHour - 28 * DAY));
  const hours = Math.max(1, (nowHour - from) / HOUR);
  const daysOfData = Math.floor((nowHour - firstHour) / DAY);

  const [accounts, checks, m] = await Promise.all([
    hubAll<{ handle: string; source: "own" | "creator" }>(`klar_view_accounts?app_slug=eq.${CREATOR_APP}&platform=eq.tiktok&select=handle,source`),
    hubAll<{ post_id: string; creator_id: string; status: string }>("klar_post_checks?select=post_id,creator_id,status"),
    hubFirst<{ revenue_28d_cents: number | null; users_new_30d: number | null }>(
      `klar_app_metrics_daily?app_slug=eq.${APP_BACKEND}&select=revenue_28d_cents,users_new_30d&order=day.desc`,
    ),
  ]);
  const own = new Set(accounts.filter((a) => a.source === "own").map((a) => a.handle));
  const handles = accounts.map((a) => `"${a.handle}"`).join(",");
  const [posts, views] = await Promise.all([
    handles ? hubAll<{ post_id: string; handle: string; posted_at: string }>(`klar_posts?platform=eq.tiktok&handle=in.(${handles})&select=post_id,handle,posted_at`) : [],
    // A day before the window, so every post read back then has its anchor.
    hubAll<{ post_id: string; fetched_at: string; views: number }>(
      `klar_post_views?fetched_at=gte.${new Date(from - DAY).toISOString()}&select=post_id,fetched_at,views&order=fetched_at.asc`,
    ),
  ]);

  const snaps = new Map<string, Snapshot[]>();
  for (const v of views) {
    const list = snaps.get(v.post_id) ?? [];
    list.push({ at: Date.parse(v.fetched_at), views: Number(v.views) });
    snaps.set(v.post_id, list);
  }
  const checkOf = new Map(checks.map((c) => [c.post_id, c]));

  const exposure = new Float64Array(hours);
  const paidViews = new Map<string, Float64Array>(); // creator id -> fresh views per hour
  for (const p of posts) {
    const s = snaps.get(p.post_id);
    if (!s) continue;
    const check = checkOf.get(p.post_id);
    if (!own.has(p.handle) && (!check || check.status === "no_mention")) continue;
    const f = freshViews(Date.parse(p.posted_at), s, from, hours);
    for (let h = 0; h < hours; h++) exposure[h] += f[h];
    if (check && PAID.has(check.status)) {
      const acc = paidViews.get(check.creator_id) ?? new Float64Array(hours);
      for (let h = 0; h < hours; h++) acc[h] += f[h];
      paidViews.set(check.creator_id, acc);
    }
  }

  const res = await fetch(`${basalt.supabaseUrl}/rest/v1/rpc/klar_app_signups_hourly`, {
    method: "POST",
    headers: { apikey: basalt.serviceKey, Authorization: `Bearer ${basalt.serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_since: new Date(from).toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `signups ${res.status}` };
  const signups = new Float64Array(hours);
  for (const r of (await res.json()) as Array<{ hour: string; signups: number }>) {
    const h = (Date.parse(r.hour) - from) / HOUR;
    if (h >= 0 && h < hours) signups[h] = r.signups;
  }

  const free = fitRate(signups, exposure, from);
  const useFit = daysOfData >= MIN_FIT_DAYS && !!free && Number.isFinite(free.ratePer1000) && free.ratePer1000 > 0;
  const fit = useFit ? free : fitRate(signups, exposure, from, PRIOR_RATE_PER_1000);
  if (!fit) return { ok: false, error: "Grundlinie nicht lösbar" };

  const revenuePerSignupCents = m && m.users_new_30d ? Number(m.revenue_28d_cents ?? 0) / m.users_new_30d : 0;

  const signupDays = byDay(signups, from);
  const baselineDays = byDay(fit.baseline, from);
  const days = [...signupDays.keys()].map((d) => ({ d, signups: signupDays.get(d) ?? 0, baseline: +(baselineDays.get(d) ?? 0).toFixed(2) }));

  let paidCreators = 0;
  for (const mStart of months) {
    const i0 = Math.max(0, (mStart - from) / HOUR);
    const i1 = Math.min(hours, Math.max(0, (monthStart(mStart + 32 * DAY) - from) / HOUR));
    const sum = (a: ArrayLike<number>) => {
      let s = 0;
      for (let h = i0; h < i1; h++) s += a[h];
      return s;
    };
    const est = estimateMonth({
      ratePer1000: fit.ratePer1000,
      revenuePerSignupCents,
      creators: [...paidViews].map(([creatorId, v]) => ({ creatorId, views: sum(v) })),
      baselineSignups: sum(fit.baseline),
      actualSignups: sum(signups),
    });
    const month = isoDay(mStart);
    if (mStart === monthStart(now)) {
      await upsert("klar_model_runs", [
        {
          app_slug: CREATOR_APP,
          run_date: isoDay(now),
          run_at: new Date(now).toISOString(),
          rate_per_1000: fit.ratePer1000,
          rate_source: useFit ? "fit" : "prior",
          fitted_rate_per_1000: free && Number.isFinite(free.ratePer1000) ? free.ratePer1000 : null,
          days_of_data: daysOfData,
          month,
          baseline_signups: est.baselineSignups,
          actual_signups: Math.round(est.actualSignups),
          revenue_per_signup_cents: revenuePerSignupCents,
          extra_revenue_cents: est.extraRevenueCents,
          cap_cents: est.capCents,
          commission_cents: est.creators.reduce((n, c) => n + c.commissionCents, 0),
          cap_factor: est.capFactor,
          days,
        },
      ]);
      paidCreators = est.creators.length;
    }
    await upsert(
      "klar_creator_earnings",
      est.creators.map((c) => {
        const perDay = byDay(paidViews.get(c.creatorId)!, from, i0, i1);
        return {
          creator_id: c.creatorId,
          month,
          views: Math.round(c.views),
          est_signups: c.signups,
          est_revenue_cents: c.revenueCents,
          commission_cents: c.commissionCents,
          payable_cents: c.payableCents,
          days: [...perDay].map(([d, v]) => ({ d, views: Math.round(v) })),
          updated_at: new Date(now).toISOString(),
        };
      }),
    );
  }
  return { ok: true, ratePer1000: fit.ratePer1000, rateSource: useFit ? "fit" : "prior", creators: paidCreators };
}
