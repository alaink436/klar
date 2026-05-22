// Shared data-loading + types for every (app) dashboard page. Lives outside
// the route group so we don't accidentally make it a route, but inside
// _shared/ so Next.js leaves it alone.

import { serviceSupabase } from "@/lib/supabaseAuth";
import { getApp, sbGet } from "@/lib/adminApps";

export const APP_NAME: Record<string, string> = {
  wavelength: "Wavelength",
  kelva: "Kelva",
  trubel: "Trubel",
  myloo: "MyLoo",
  "yarn-stash": "Yarn-Stash",
  moto: "ThrottleUp",
};

export const APP_ICON: Record<string, string> = {
  wavelength: "/icons/wavelength.webp",
  kelva: "/icons/kelva.webp",
  trubel: "/icons/trubel.webp",
  myloo: "/icons/myloo.webp",
  "yarn-stash": "/icons/yarnstash.webp",
  moto: "/icons/moto.webp",
};

export interface AffiliateRow {
  user_id: string;
  email: string;
  display_name: string | null;
  apps: string[];
  handles: Record<string, string>;
  status: "active" | "cancelled";
  cancelled_at: string | null;
}

export interface ConversionRow {
  influencer_share_cents: number;
  first_subscribe_at: string;
  product_id: string | null;
}

export interface AppStats {
  slug: string;
  appName: string;
  iconUrl: string;
  handle: string;
  matured_cents: number;
  paid_cents: number;
  claimable_cents: number;
  clicks: number;
  installs: number;
  conversions: number;
  // Time-series source — every conversion event for chart aggregation.
  conversion_rows: ConversionRow[];
}

export async function loadAffiliate(userId: string): Promise<AffiliateRow | null> {
  const svc = serviceSupabase();
  const { data } = await svc
    .from("klar_affiliates")
    .select("user_id, email, display_name, apps, handles, status, cancelled_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AffiliateRow) ?? null;
}

export async function loadStatsForApp(slug: string, handle: string): Promise<AppStats | null> {
  const app = getApp(slug);
  if (!app) return null;
  const appName = APP_NAME[slug] ?? slug;
  const iconUrl = APP_ICON[slug] ?? "/icons/yarnstash.webp";

  const h = encodeURIComponent(handle);

  const [convRows, paidRows, clickRows, refRows] = await Promise.all([
    sbGet(
      app,
      `referral_conversions?influencer_handle=eq.${h}&select=influencer_share_cents,first_subscribe_at,product_id&order=first_subscribe_at.asc`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `influencer_payout_items?influencer_handle=eq.${h}&status=eq.paid&select=amount_cents`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `referral_clicks?influencer_handle=eq.${h}&select=id`,
      { revalidate: 60 },
    ),
    sbGet(
      app,
      `referrals?influencer_handle=eq.${h}&select=id,confirmed_at`,
      { revalidate: 60 },
    ),
  ]);

  const conversion_rows = (convRows as Array<{
    influencer_share_cents?: number;
    first_subscribe_at?: string;
    product_id?: string | null;
  }>).map((r) => ({
    influencer_share_cents: Number(r.influencer_share_cents ?? 0),
    first_subscribe_at: String(r.first_subscribe_at ?? ""),
    product_id: r.product_id ?? null,
  }));

  const earnedCents = conversion_rows.reduce((s, r) => s + r.influencer_share_cents, 0);
  const paidCents = (paidRows as Array<{ amount_cents?: number }>).reduce(
    (s, r) => s + Number(r.amount_cents ?? 0),
    0,
  );
  const claimableCents = Math.max(0, earnedCents - paidCents);

  return {
    slug,
    appName,
    iconUrl,
    handle,
    matured_cents: earnedCents,
    paid_cents: paidCents,
    claimable_cents: claimableCents,
    clicks: clickRows.length,
    installs: refRows.length,
    conversions: conversion_rows.length,
    conversion_rows,
  };
}

export function eur(cents: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Bucket conversions into the last 6 months (incl. current). Returns an
// array of { month: "Jan", year: 2026, earnings_cents: N } sorted oldest
// first, ready for the line chart.
export interface MonthlyEarning {
  label: string;       // "Jan", "Feb", etc.
  yearMonth: string;   // "2026-01"
  earnings_cents: number;
}

export function aggregateMonthlyEarnings(stats: AppStats[], months = 6): MonthlyEarning[] {
  const now = new Date();
  const buckets: MonthlyEarning[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleString("en-IE", { month: "short" }),
      yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      earnings_cents: 0,
    });
  }
  for (const s of stats) {
    for (const c of s.conversion_rows) {
      if (!c.first_subscribe_at) continue;
      const d = new Date(c.first_subscribe_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.find((b) => b.yearMonth === ym);
      if (bucket) bucket.earnings_cents += c.influencer_share_cents;
    }
  }
  return buckets;
}
