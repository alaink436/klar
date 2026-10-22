// The estimate behind the commission of creators without a link (spec Projects/
// Klar/specs/creator-plattform, ticket 05). Pure math, no I/O; lib/creatorModelRun
// feeds it and stores what comes out. Method as in the prototype
// Projects/Klar/attribution-prototyp/spikes.py, which found 0.5 sign-ups per
// 1000 views on Basalt's own posts (13.09. to 20.10.2026).
//
//   fresh views per hour  from the view snapshots of every post that advertises
//                         the app (ours, link creators, counted creator posts)
//   sign-ups per hour     = baseline (24 hour-of-day values + linear trend)
//                           + rate x fresh views
//   creator's sign-ups    = rate x his fresh views
//   commission            = 50 % of their revenue; all creators together get at
//                           most 40 % of the month's revenue above the baseline

export const HOUR = 3_600_000;
/** Until the snapshots cover this many days, the rate from the prototype is used. */
export const MIN_FIT_DAYS = 14;
export const PRIOR_RATE_PER_1000 = 0.5;
export const COMMISSION = 0.5;
export const CAP_SHARE = 0.4;
/** Views of a post's first stretch arrive with this decay (hours), as in the prototype. */
const TAU_HOURS = 8;

export interface Snapshot {
  at: number; // ms
  views: number;
}

/**
 * Fresh views per hour of one post over [from, from + hours). Between two
 * snapshots the new views are spread evenly; from posting to the first snapshot
 * they follow an exponential decay, because a post gets most views early.
 */
export function freshViews(postedAt: number, snapshots: Snapshot[], from: number, hours: number): Float64Array {
  const out = new Float64Array(hours);
  const add = (start: number, end: number, views: number, decay: boolean) => {
    if (views <= 0 || end <= start) return;
    const steps = Math.max(1, Math.ceil((end - start) / HOUR));
    const weights = Array.from({ length: steps }, (_, i) => (decay ? Math.exp(-i / TAU_HOURS) : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < steps; i++) {
      const h = Math.floor((start + i * HOUR - from) / HOUR);
      if (h >= 0 && h < hours) out[h] += (views * weights[i]) / sum;
    }
  };
  let prev = { at: postedAt, views: 0 };
  for (const s of [...snapshots].sort((a, b) => a.at - b.at)) {
    if (s.at <= prev.at) continue;
    add(prev.at, s.at, s.views - prev.views, prev.views === 0);
    prev = s;
  }
  return out;
}

/** Solves (XᵀX) β = Xᵀy by Gaussian elimination with partial pivoting. */
function leastSquares(rows: number[][], y: number[]): number[] | null {
  const k = rows[0]?.length ?? 0;
  const a = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < k; i++) {
      a[i][k] += rows[r][i] * y[r];
      for (let j = 0; j < k; j++) a[i][j] += rows[r][i] * rows[r][j];
    }
  }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-9) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j <= k; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row, i) => row[k] / row[i]);
}

export interface Fit {
  ratePer1000: number;
  /** Expected sign-ups per hour without any post. */
  baseline: Float64Array;
}

/**
 * Sign-ups per hour against hour of day, a linear trend and fresh views.
 * `from` is the start of hour 0 (its UTC hour picks the hour-of-day column).
 * With `fixedRate` only the baseline is fitted, for the time before MIN_FIT_DAYS.
 * Under two days of data the baseline is one flat value: 24 hour-of-day values
 * plus a trend cannot be told apart from a few hours.
 */
export function fitRate(signups: ArrayLike<number>, exposure: ArrayLike<number>, from: number, fixedRate?: number): Fit | null {
  const n = signups.length;
  const startHod = new Date(from).getUTCHours();
  const flat = n < 48;
  const base = (h: number) => {
    if (flat) return [1];
    const hod = new Array<number>(25).fill(0);
    hod[(startHod + h) % 24] = 1;
    hod[24] = h / n;
    return hod;
  };
  const rows: number[][] = [];
  const y: number[] = [];
  for (let h = 0; h < n; h++) {
    if (fixedRate === undefined) {
      rows.push([...base(h), exposure[h] / 1000]);
      y.push(signups[h]);
    } else {
      rows.push(base(h));
      y.push(signups[h] - (fixedRate * exposure[h]) / 1000);
    }
  }
  const beta = leastSquares(rows, y);
  if (!beta) return null;
  const k = flat ? 1 : 25;
  const baseline = new Float64Array(n);
  for (let h = 0; h < n; h++) baseline[h] = Math.max(0, base(h).reduce((sum, x, i) => sum + x * beta[i], 0));
  return { ratePer1000: fixedRate ?? beta[k], baseline };
}

export interface CreatorViews {
  creatorId: string;
  views: number; // fresh views of his counted posts in the month
}

export interface Estimate {
  ratePer1000: number;
  creators: Array<{ creatorId: string; views: number; signups: number; revenueCents: number; commissionCents: number; payableCents: number }>;
  baselineSignups: number;
  actualSignups: number;
  extraRevenueCents: number;
  capCents: number;
  /** 1 when the cap does not bite, else the factor every commission is cut by. */
  capFactor: number;
}

/** The month for every creator without a link, cut to the cap if needed. */
export function estimateMonth(args: {
  ratePer1000: number;
  revenuePerSignupCents: number;
  creators: CreatorViews[];
  baselineSignups: number;
  actualSignups: number;
}): Estimate {
  const { ratePer1000, revenuePerSignupCents } = args;
  const extraRevenueCents = Math.max(0, args.actualSignups - args.baselineSignups) * revenuePerSignupCents;
  const capCents = CAP_SHARE * extraRevenueCents;
  const rows = args.creators.map((c) => {
    const signups = (ratePer1000 * c.views) / 1000;
    const revenueCents = signups * revenuePerSignupCents;
    return { creatorId: c.creatorId, views: c.views, signups, revenueCents, commissionCents: COMMISSION * revenueCents };
  });
  const total = rows.reduce((n, r) => n + r.commissionCents, 0);
  const capFactor = total > capCents ? (total > 0 ? capCents / total : 1) : 1;
  return {
    ratePer1000,
    creators: rows.map((r) => ({ ...r, payableCents: Math.floor(r.commissionCents * capFactor + 1e-6) })),
    baselineSignups: args.baselineSignups,
    actualSignups: args.actualSignups,
    extraRevenueCents,
    capCents,
    capFactor,
  };
}

/** A creator with his own link: every sign-up through it counts, at the month's revenue per sign-up, half of it his
    (Alain 2026-10-22: "jede Anmeldung über den Link zählt exakt, mal Basalts Umsatz pro Anmeldung, davon 50 %"). Not
    under the cap, which shares out estimated sign-ups; these are counted. */
export function linkEarning(signups: number, revenuePerSignupCents: number): { revenueCents: number; commissionCents: number; payableCents: number } {
  const revenueCents = signups * revenuePerSignupCents;
  const commissionCents = COMMISSION * revenueCents;
  return { revenueCents, commissionCents, payableCents: Math.floor(commissionCents + 1e-6) };
}

const PAUSE_MS = 30 * 24 * 3_600_000; // as PAUSE_DAYS in lib/postCheck

/** Whether a sign-up through a creator's link at `at` counts: not while his account is paused, not after it closed,
    the same as for posts. */
export function linkSignupCounts(at: number, account: { suspended_until: string | null; closed_at: string | null }): boolean {
  if (account.closed_at && at >= Date.parse(account.closed_at)) return false;
  if (account.suspended_until) {
    const end = Date.parse(account.suspended_until);
    if (at >= end - PAUSE_MS && at < end) return false;
  }
  return true;
}
