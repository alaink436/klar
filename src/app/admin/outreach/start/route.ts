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
// Apify pricing 2026-04 (verified docs): IG-Hashtag-Scraper $1.90/1k results +
// IG-Profile-Scraper $1.60/1k profiles → with the wave-consumer's 3x scrape /
// 2x profile oversampling that's ~$0.009 per requested target. TikTok-Scraper
// (clockworks) $5.00/1k results → ~$0.010 per target with 2x oversampling.
// smallBucket-only (nano/micro) raises the hashtag-scrape 10x → ~$0.020/IG-target.
// n8n consumer writes the real Apify usageTotalUsd back into cost_actual_usd,
// these constants are the up-front estimate only.
const APIFY_USD_PER_TARGET_IG = 0.009;
const APIFY_USD_PER_TARGET_IG_SMALL = 0.020;
const APIFY_USD_PER_TARGET_TIKTOK = 0.010;

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

  // size_buckets: multi-select chips (nano/micro/mid/macro). Each maps to
  // a follower-range in the n8n format-nodes.
  const ALLOWED_BUCKETS = new Set(["nano", "micro", "mid", "macro"]);
  const rawBuckets = form.getAll("size_buckets").map((v) => String(v).trim().toLowerCase());
  const sizeBuckets = Array.from(new Set(rawBuckets.filter((b) => ALLOWED_BUCKETS.has(b))));
  if (sizeBuckets.length === 0) return back(req, "Mindestens eine Größe auswählen (Nano/Micro/Mid/Macro)");

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
  // Cost is per-app because we split multi-app submits into N separate runs
  // (one row per app) so the wave-consumer pipeline never has to mix
  // app-specific hashtags or PDFs in a single Apify batch.
  const profileLookupsPerApp = platforms.length * count;
  const smallBucketOnly =
    sizeBuckets.length > 0 && sizeBuckets.every((b) => b === "nano" || b === "micro");
  const igPerTarget = smallBucketOnly ? APIFY_USD_PER_TARGET_IG_SMALL : APIFY_USD_PER_TARGET_IG;
  const igCost = platforms.includes("instagram") ? count * igPerTarget : 0;
  const ttCost = platforms.includes("tiktok") ? count * APIFY_USD_PER_TARGET_TIKTOK : 0;
  const costEstimatePerApp = Math.round((igCost + ttCost) * 10000) / 10000;

  // S32-eve: when multiple apps are selected, split into N separate single-app
  // runs that show up as N rows in the "Letzte Wellen" table. Each row gets
  // its own n8n execution so per-app hashtags, PDFs and follower filters
  // never collide. We dispatch the N webhooks in parallel — n8n + Apify
  // handle the concurrency internally, and each run's backstop fires
  // independently.
  const hookUrl =
    process.env.KLAR_OUTREACH_WEBHOOK_URL ??
    "https://alaink365.app.n8n.cloud/webhook/klar-outreach-wave";
  const webhookSecret = process.env.KLAR_N8N_WEBHOOK_SECRET ?? "";

  function fireWebhook(runId: string): void {
    void fetch(hookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Klar-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify({ run_id: runId }),
    })
      .then((r) => {
        if (!r.ok) console.warn(`wave webhook ${r.status}: run ${runId} not picked up`);
      })
      .catch((e) => console.warn("wave webhook fire error:", e));
  }

  // Single-app path: keep behaviour identical (one row, one webhook).
  if (apps.length === 1) {
    let row: Awaited<ReturnType<typeof createOutreachRun>>;
    try {
      row = await createOutreachRun({
        apps,
        platforms,
        size_buckets: sizeBuckets,
        count_per_app: count,
        niche,
        mail_subject: mailSubject,
        mail_body: mailBody,
        cost_estimate_usd: costEstimatePerApp,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return back(req, `Start fehlgeschlagen: ${msg.slice(0, 160)}`);
    }
    fireWebhook(row.id);
    return back(
      req,
      `Welle ${row.id.slice(0, 8)} gestartet: ${apps[0]} × ${platforms.length} Plattformen × ${count} = ~${profileLookupsPerApp} Profile, est $${costEstimatePerApp.toFixed(2)}.`,
    );
  }

  // Multi-app path: create one row per app, dispatch a webhook each. The
  // override-detection in n8n's Build Job List runs per-row so a user-edited
  // mail_subject/body becomes a wave_override for every spawned run.
  const created: Array<{ id: string; app: string }> = [];
  const failed: Array<{ app: string; error: string }> = [];
  for (const app of apps) {
    try {
      const row = await createOutreachRun({
        apps: [app],
        platforms,
        size_buckets: sizeBuckets,
        count_per_app: count,
        niche,
        mail_subject: mailSubject,
        mail_body: mailBody,
        cost_estimate_usd: costEstimatePerApp,
      });
      created.push({ id: row.id, app });
      fireWebhook(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ app, error: msg.slice(0, 80) });
    }
  }
  if (created.length === 0) {
    return back(req, `Start fehlgeschlagen für alle ${apps.length} Apps: ${failed.map((f) => f.app + "=" + f.error).join("; ").slice(0, 200)}`);
  }
  const total = created.length;
  const totalCost = (costEstimatePerApp * total).toFixed(2);
  const tail = failed.length > 0 ? ` (${failed.length} fehlgeschlagen: ${failed.map((f) => f.app).join(", ")})` : "";
  return back(
    req,
    `${total} Wellen gestartet (je 1 App, parallel): ${created.map((c) => c.app + " #" + c.id.slice(0, 6)).join(", ")} • je ${platforms.length}×${count} = ${profileLookupsPerApp} Profile • est total $${totalCost}${tail}`,
  );
}
