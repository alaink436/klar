// SERVER ONLY. NormalizedProfile -> klar_outreach_targets row.
//
// Maps an Evomi NormalizedProfile (after email resolution) into the exact row
// shape the n8n IG/TikTok "Format Targets" nodes produced, plus the trial markers
// so isolated rows are identifiable + deletable. Applies the follower-range filter
// and the no-email drop here, exactly like the format nodes.

import "server-only";
import type { Dispatcher } from "undici";
import type { NormalizedProfile } from "./evomiScraper";
import { resolveContactEmailDetailed, type EmailSource } from "./outreachEmail";

export interface WaveJob {
  app: string;
  niche: string | null; // the niche used for discovery, WITHOUT the trial prefix
  language: string; // 'de' | 'en' | ...
  follower_min: number; // from the resolved bucket range
  follower_max: number;
  // false => LIVE row (real niche, no trial_hold, mail_status=null so the in-app
  // mailer picks it up). Undefined/true => isolated TRIAL row (evomi-trial markers,
  // trial_hold, hidden in the UI). Default true keeps the legacy preview card safe.
  trial?: boolean;
}

/** Frozen target-row shape (subset of klar_outreach_targets that the wave writes).
 *  Matches IG/TikTok Format Targets output 1:1. In TRIAL mode it carries the
 *  evomi-trial markers; in LIVE mode it is an ordinary mailable target. */
export interface OutreachTargetRow {
  handle: string;
  platform: "instagram" | "tiktok";
  display_name: string | null;
  profile_url: string | null;
  follower_estimate: number | null;
  niche: string | null; // real niche (live, null if empty) OR "evomi-trial:<niche>" (trial)
  language: string;
  for_apps: string[];
  priority: number; // always 3
  contact_email: string; // never empty (no-email rows are dropped)
  audience_size: string | null; // always null at scrape time
  notes: string; // "discovery=wave-evomi; email=<source>; …" (+ trial prefix)
  status: "queued";
  mail_status: string | null; // "trial_hold" (trial) | null (live → mailable)
  // Transient (NOT a DB column — insertWaveTargets ignores it): where the email
  // came from, for the run/trial report breakdown.
  email_source: EmailSource;
}

const TRIAL_NICHE_PREFIX = "evomi-trial:";

function buildNotes(bio: string, trial: boolean, source: EmailSource): string {
  const prefix = trial ? "evomi-trial; discovery=wave-evomi" : "discovery=wave-evomi";
  return `${prefix}; email=${source}; bio=${(bio || "").slice(0, 120)}`
    .replace(/\n/g, " ")
    .slice(0, 1000);
}

/** Resolve email + apply follower filter + shape the row. Returns null when the
 *  profile fails the follower range OR has no resolvable email (= n8n drop).
 *  `opts.dispatcher` routes the email crawls through the residential proxy. */
export async function normalizeToTarget(
  p: NormalizedProfile,
  job: WaveJob,
  opts: { dispatcher?: Dispatcher | null } = {},
): Promise<OutreachTargetRow | null> {
  // 1) follower filter — identical to format nodes (f < fmin || f > fmax -> skip).
  const f = Number(p.followers || 0);
  if (f < job.follower_min || f > job.follower_max) return null;
  // 2) email resolution (direct -> bio -> aggregator/website crawl). Drop if none.
  const resolved = await resolveContactEmailDetailed(p, { dispatcher: opts.dispatcher });
  if (!resolved.email || !resolved.source) return null;
  // 3) shape — the n8n IG/TikTok Format Targets row. Trial markers only in trial mode.
  const trial = job.trial !== false; // default true (legacy preview safety)
  const nicheUsed = job.niche ?? "";
  return {
    handle: p.handle.toLowerCase(),
    platform: p.platform,
    // TT display_name falls back to handle; IG stays null when full_name absent.
    display_name: p.displayName ?? (p.platform === "tiktok" ? p.handle : null),
    profile_url:
      p.profileUrl ||
      (p.platform === "instagram"
        ? `https://www.instagram.com/${p.handle}/`
        : `https://www.tiktok.com/@${p.handle}`),
    follower_estimate: f || null,
    niche: trial ? `${TRIAL_NICHE_PREFIX}${nicheUsed}` : (nicheUsed || null),
    language: job.language || "de",
    for_apps: [job.app],
    priority: 3,
    contact_email: resolved.email,
    audience_size: null,
    notes: buildNotes(p.biography, trial, resolved.source),
    status: "queued",
    mail_status: trial ? "trial_hold" : null,
    email_source: resolved.source,
  };
}
