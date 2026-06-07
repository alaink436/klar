// Program-wide commission ladder. Single source of truth for the onboarding
// copy + welcome mail (and later the dashboard goal tracker), so the numbers
// never drift between surfaces. Per-app base commission % and base attribution
// months still live on each Brand (brands.ts); these are the revenue milestones
// layered on top.
//
// Metric = gross attributed revenue through the creator's link (the dashboard
// funnel number), cumulative, refunds excluded.

export const PROGRAM_LADDER = {
  /** Tier 1 "warmed up": lifts the base attribution window to `months`. */
  tier1: { revenueEur: 2000, months: 36 },
  /** Tier 2 "lifetime": commission no longer expires. */
  tier2: { revenueEur: 10000 },
} as const;

/** Free perk every affiliate gets immediately, independent of the ladder. */
export const FREE_LIFETIME_PREMIUM = true;
