// SERVER ONLY. Reads what the daily run of the estimate stored (migrations/0048,
// lib/creatorModelRun) for the creator dashboard, Klar Control and the weekly
// report.

import "server-only";
import { CREATOR_APP } from "./creatorAccounts";
import { COMMISSION } from "./creatorModel";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export interface ModelRun {
  run_date: string;
  run_at: string;
  rate_per_1000: number;
  rate_source: "prior" | "fit";
  fitted_rate_per_1000: number | null;
  days_of_data: number;
  month: string;
  baseline_signups: number;
  actual_signups: number;
  revenue_per_signup_cents: number;
  extra_revenue_cents: number;
  cap_cents: number;
  commission_cents: number;
  cap_factor: number;
  days: Array<{ d: string; signups: number; baseline: number }>;
}

export interface Earning {
  creator_id: string;
  month: string;
  views: number;
  est_signups: number;
  est_revenue_cents: number;
  commission_cents: number;
  /** Estimate and link together, what lib/payouts pays. */
  payable_cents: number;
  /** Sign-ups through his link this month and his half of their revenue (migrations/0054). */
  link_signups: number;
  link_commission_cents: number;
  days: Array<{ d: string; views: number }>;
}

async function hubGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}` }, cache: "no-store" });
  return res.ok ? ((await res.json()) as T[]) : [];
}

export async function latestModelRun(): Promise<ModelRun | null> {
  const [run] = await hubGet<ModelRun>(`klar_model_runs?app_slug=eq.${CREATOR_APP}&select=*&order=run_date.desc&limit=1`);
  return run ?? null;
}

export async function creatorEarning(creatorId: string, month: string): Promise<Earning | null> {
  const [row] = await hubGet<Earning>(`klar_creator_earnings?creator_id=eq.${creatorId}&month=eq.${month}&select=*`);
  return row ?? null;
}

/** Every creator's row of the month, largest commission first, with his handle. */
export async function monthEarnings(month: string): Promise<Array<Earning & { handle: string }>> {
  const rows = await hubGet<Earning & { klar_creator_accounts: { tiktok_handle: string } | null }>(
    `klar_creator_earnings?month=eq.${month}&select=*,klar_creator_accounts(tiktok_handle)&order=commission_cents.desc`,
  );
  return rows.map(({ klar_creator_accounts, ...r }) => ({ ...r, handle: klar_creator_accounts?.tiktok_handle ?? "?" }));
}

/** A post's estimate from the latest run: sign-ups for its views and the commission after the cap. */
export function postEstimate(run: ModelRun, views: number): { signups: number; commissionCents: number } {
  const signups = (run.rate_per_1000 * views) / 1000;
  return { signups, commissionCents: signups * run.revenue_per_signup_cents * COMMISSION * run.cap_factor };
}

/** "$1.23", or "<$0.01" for a commission above zero that rounds away. */
export function usd(cents: number): string {
  if (cents > 0 && cents < 1) return "<$0.01";
  return `$${(cents / 100).toFixed(2)}`;
}
