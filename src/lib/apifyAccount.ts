// Apify-Account-Status fetcher for /admin?view=outreach top card.
//
// Reads GET https://api.apify.com/v2/users/me/limits which returns:
//   data.monthlyUsageCycle.{startAt,endAt}
//   data.limits.maxMonthlyUsageUsd   (account cap; 0 / null = no cap configured)
//   data.current.monthlyUsageUsd     (spend this cycle, ALL Apify usage incl. non-Klar)
//
// Token comes from APIFY_API_TOKEN env (the same one already documented
// in the Templates view as "in Vercel"). If absent the card shows
// fallback state and the call is skipped.
//
// Cached for 5 minutes via Next-cache so /admin refreshes don't hit the
// Apify API on every render — fresh enough for an account-level KPI.
import "server-only";

export interface ApifyAccountStatus {
  ok: boolean;
  reason: "live" | "no-token" | "http-error" | "exception";
  monthly_usage_usd: number;
  max_monthly_usage_usd: number | null;
  cycle_start: string | null;
  cycle_end: string | null;
  // extras useful for ops; rendered as small grey line below the bar.
  compute_units_used: number | null;
  compute_units_max: number | null;
  // Plan/billing details from GET /v2/users/me (parallel call). Credits are the
  // platform-usage allowance baked into the plan price; remaining budget is
  // computed in the UI from credits (or cap) minus usage.
  plan_id: string | null;
  plan_description: string | null;
  monthly_base_price_usd: number | null;
  monthly_usage_credits_usd: number | null;
  is_paying: boolean | null;
  fetched_at: string;
}

const APIFY_LIMITS_URL = "https://api.apify.com/v2/users/me/limits";
const APIFY_ME_URL = "https://api.apify.com/v2/users/me";

function fallback(reason: ApifyAccountStatus["reason"]): ApifyAccountStatus {
  return {
    ok: false,
    reason,
    monthly_usage_usd: 0,
    max_monthly_usage_usd: null,
    cycle_start: null,
    cycle_end: null,
    compute_units_used: null,
    compute_units_max: null,
    plan_id: null,
    plan_description: null,
    monthly_base_price_usd: null,
    monthly_usage_credits_usd: null,
    is_paying: null,
    fetched_at: new Date().toISOString(),
  };
}

export async function getApifyAccountStatus(): Promise<ApifyAccountStatus> {
  const token = process.env.APIFY_API_TOKEN ?? "";
  if (!token) return fallback("no-token");
  try {
    const auth = { Authorization: `Bearer ${token}` };
    // 5-min revalidate is plenty for an account-level KPI; avoids hammering
    // Apify on every admin-page render or 15s auto-refresh tick. The plan call
    // (/me) is best-effort — if it fails the usage card still renders.
    const [limitsRes, meRes] = await Promise.all([
      fetch(APIFY_LIMITS_URL, { headers: auth, next: { revalidate: 300 } }),
      fetch(APIFY_ME_URL, { headers: auth, next: { revalidate: 300 } }).catch(() => null),
    ]);
    if (!limitsRes.ok) return fallback("http-error");
    const json = (await limitsRes.json()) as {
      data?: {
        monthlyUsageCycle?: { startAt?: string; endAt?: string };
        limits?: { maxMonthlyUsageUsd?: number; maxMonthlyActorComputeUnits?: number };
        current?: { monthlyUsageUsd?: number; monthlyActorComputeUnits?: number };
      };
    };
    const d = json?.data;
    const usage = Number(d?.current?.monthlyUsageUsd ?? 0);
    const cap = Number(d?.limits?.maxMonthlyUsageUsd ?? 0);
    const cuUsed = Number(d?.current?.monthlyActorComputeUnits ?? 0);
    const cuMax = Number(d?.limits?.maxMonthlyActorComputeUnits ?? 0);

    // Plan/billing (best-effort): GET /v2/users/me → data.plan.*
    let planId: string | null = null;
    let planDesc: string | null = null;
    let basePrice: number | null = null;
    let credits: number | null = null;
    let isPaying: boolean | null = null;
    if (meRes && meRes.ok) {
      try {
        const meJson = (await meRes.json()) as {
          data?: {
            isPaying?: boolean;
            plan?: {
              id?: string;
              description?: string;
              monthlyBasePriceUsd?: number;
              monthlyUsageCreditsUsd?: number;
            };
          };
        };
        const p = meJson?.data?.plan;
        planId = p?.id ?? null;
        planDesc = p?.description ?? null;
        basePrice = typeof p?.monthlyBasePriceUsd === "number" ? p.monthlyBasePriceUsd : null;
        credits = typeof p?.monthlyUsageCreditsUsd === "number" ? p.monthlyUsageCreditsUsd : null;
        isPaying = typeof meJson?.data?.isPaying === "boolean" ? meJson.data.isPaying : null;
      } catch {
        /* plan parse failed — leave nulls, usage card still renders */
      }
    }

    return {
      ok: true,
      reason: "live",
      monthly_usage_usd: Math.round(usage * 100) / 100,
      max_monthly_usage_usd: cap > 0 ? cap : null,
      cycle_start: d?.monthlyUsageCycle?.startAt ?? null,
      cycle_end: d?.monthlyUsageCycle?.endAt ?? null,
      compute_units_used: cuUsed > 0 ? Math.round(cuUsed * 100) / 100 : null,
      compute_units_max: cuMax > 0 ? cuMax : null,
      plan_id: planId,
      plan_description: planDesc,
      monthly_base_price_usd: basePrice,
      monthly_usage_credits_usd: credits,
      is_paying: isPaying,
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return fallback("exception");
  }
}
