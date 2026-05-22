// POST /admin/outreach/start — Self-Service Wave-Starter.
// Inserts a klar_outreach_runs row (status='queued') with the wave-config.
// An n8n-Workflow (built next session) polls queued rows and processes
// them: Apify discovery (TikTok + IG) → klar_outreach_targets insert →
// Brevo Mail-1 send → run status updates.
//
// Until n8n is wired, this endpoint persists the config so the user can
// see the wave appear in /admin?view=outreach > Letzte Wellen, but no
// scraping/sending happens.
//
// Admin-Auth via klar_admin Cookie (mirror of /admin/outreach/add).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { createOutreachRun } from "../../../../lib/outreachStore";
import { KLAR_APPS } from "../../../../lib/klarApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNT_MIN = 1;
const COUNT_MAX = 500;
const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const NICHE_MAX = 80;
// Apify rough pricing: profile-scraper ~$0.50 per 1000 lookups. We use
// $0.001 per profile as conservative estimate; will be refined when the
// n8n consumer reports apify_run cost back into cost_actual_usd.
const APIFY_USD_PER_PROFILE = 0.001;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured: KLAR_ADMIN_KEY missing");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  // apps: multi-select checkbox-name="apps". formData.getAll returns all
  // checked values. Filter against KLAR_APPS-Whitelist + only LIVE apps,
  // dedupe, ≥1 required.
  const liveSlugs = new Set(KLAR_APPS.filter((a) => a.status === "LIVE").map((a) => a.slug));
  const rawApps = form.getAll("apps").map((v) => String(v).trim().toLowerCase());
  const apps = Array.from(new Set(rawApps.filter((s) => liveSlugs.has(s))));
  if (apps.length === 0) return back(req, "Mindestens eine App auswählen");

  // platforms: multi-select. Only tiktok + instagram allowed.
  const rawPlatforms = form.getAll("platforms").map((v) => String(v).trim().toLowerCase());
  const platforms = Array.from(
    new Set(rawPlatforms.filter((p) => p === "tiktok" || p === "instagram")),
  );
  if (platforms.length === 0) return back(req, "Mindestens eine Plattform auswählen");

  const countRaw = String(form.get("count_per_app") ?? "").trim();
  const count = Number(countRaw);
  if (!isFinite(count) || count < COUNT_MIN || count > COUNT_MAX || !Number.isInteger(count)) {
    return back(req, `Count muss ganzzahlig ${COUNT_MIN}-${COUNT_MAX} sein`);
  }

  const niche = String(form.get("niche") ?? "").trim().slice(0, NICHE_MAX) || null;

  const mailSubject = String(form.get("mail_subject") ?? "").trim().slice(0, SUBJECT_MAX);
  if (mailSubject.length < 3) return back(req, "Mail-Subject zu kurz");

  const mailBody = String(form.get("mail_body") ?? "").trim().slice(0, BODY_MAX);
  if (mailBody.length < 20) return back(req, "Mail-Body zu kurz");

  // Server-side cost-estimate mirror of the client-side JS calc.
  const profileLookups = apps.length * platforms.length * count;
  const costEstimateUsd = Math.round(profileLookups * APIFY_USD_PER_PROFILE * 10000) / 10000;

  try {
    const row = await createOutreachRun({
      apps,
      platforms,
      count_per_app: count,
      niche,
      mail_subject: mailSubject,
      mail_body: mailBody,
      cost_estimate_usd: costEstimateUsd,
    });
    return back(
      req,
      `Welle ${row.id.slice(0, 8)} angelegt: ${apps.length} Apps × ${platforms.length} Plattformen × ${count} = ~${profileLookups} Profile, est $${costEstimateUsd.toFixed(2)}. Status queued (n8n-Consumer kommt nächste Session).`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Start fehlgeschlagen: ${msg.slice(0, 160)}`);
  }
}
