// SERVER ONLY. NormalizedProfile -> klar_outreach_targets row.
//
// Maps an Evomi NormalizedProfile (after email resolution) into the exact row
// shape the n8n IG/TikTok "Format Targets" nodes produced, plus the trial markers
// so isolated rows are identifiable + deletable. Applies the follower-range filter
// and the no-email drop here, exactly like the format nodes.

import "server-only";
import type { NormalizedProfile } from "./evomiScraper";
import { resolveContactEmail } from "./outreachEmail";

export interface WaveJob {
  app: string;
  niche: string | null; // the niche used for discovery, WITHOUT the trial prefix
  language: string; // 'de' | 'en' | ...
  follower_min: number; // from the resolved bucket range
  follower_max: number;
}

/** Frozen target-row shape (subset of klar_outreach_targets that the wave writes).
 *  Matches IG/TikTok Format Targets output 1:1, plus the trial markers. */
export interface OutreachTargetRow {
  handle: string;
  platform: "instagram" | "tiktok";
  display_name: string | null;
  profile_url: string | null;
  follower_estimate: number | null;
  niche: string; // "evomi-trial:<niche>" marker
  language: string;
  for_apps: string[];
  priority: number; // always 3
  contact_email: string; // never empty (no-email rows are dropped)
  audience_size: string | null; // always null at scrape time
  notes: string; // "evomi-trial; …" marker prefix
  status: "queued";
  mail_status: string; // "trial_hold" — keeps it out of listTargetsForMail1
}

const TRIAL_NICHE_PREFIX = "evomi-trial:";
const TRIAL_NOTES_PREFIX = "evomi-trial; discovery=wave-evomi";

function buildNotes(bio: string): string {
  return `${TRIAL_NOTES_PREFIX}; bio=${(bio || "").slice(0, 120)}`
    .replace(/\n/g, " ")
    .slice(0, 1000);
}

/** Resolve email + apply follower filter + shape the row. Returns null when the
 *  profile fails the follower range OR has no resolvable email (= n8n drop). */
export async function normalizeToTarget(
  p: NormalizedProfile,
  job: WaveJob,
): Promise<OutreachTargetRow | null> {
  // 1) follower filter — identical to format nodes (f < fmin || f > fmax -> skip).
  const f = Number(p.followers || 0);
  if (f < job.follower_min || f > job.follower_max) return null;
  // 2) email resolution (direct -> bio -> aggregator crawl). Drop if none.
  const email = await resolveContactEmail(p);
  if (!email) return null;
  // 3) shape — the n8n IG/TikTok Format Targets row, plus the trial markers.
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
    niche: `${TRIAL_NICHE_PREFIX}${nicheUsed}`,
    language: job.language || "de",
    for_apps: [job.app],
    priority: 3,
    contact_email: email,
    audience_size: null,
    notes: buildNotes(p.biography),
    status: "queued",
    mail_status: "trial_hold",
  };
}
