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
// Apify pricing 2026-05 (verified live via /v2/acts/.../pricingInfos):
//   apify/instagram-hashtag-scraper: PRICE_PER_DATASET_ITEM, $0.0023/item
//   apify/instagram-profile-scraper: PRICE_PER_DATASET_ITEM, $0.0023/item
//   clockworks/tiktok-scraper:       FLAT_PRICE_PER_MONTH,   $45/mo rental
//                                    + platform compute on top
// After the S41 cost-cut, n8n-Wave-Consumer caps the scrape inputs:
//   IG-Hashtag.resultsLimit = ceil(count * 1.2), max 30  (smallBucket: 1.8 / 45)
//   IG-Profile.resultsLimit = 1 per username
//   TikTok.resultsPerPage   = min(count + 5, 25)
// The TT $45/mo rental is shown account-wide on the Apify-Account-Card and
// NOT charged per wave; per-wave we estimate only the platform compute.
// n8n consumer writes the real Apify usageTotalUsd back into cost_actual_usd
// — these constants are the up-front estimate only.
const APIFY_PRICE_PER_IG_ITEM_USD = 0.0023;
const APIFY_TT_COMPUTE_PER_RUN_USD = 0.30; // typical compute charge per TT run after S41 cap
// Hard cap above which the form-submit requires a confirm-dialog. Beyond
// this, the admin must actively acknowledge the spend.
const COST_CONFIRM_USD = 2.00;

/** Estimated USD for one IG wave-row (1 app, IG only). Mirrors the n8n
 *  scrape-limit so the UI number matches actual usage to within ~15 %. */
function igCostPerWave(count: number, smallBucket: boolean): number {
  const scrape = smallBucket
    ? Math.min(Math.ceil(count * 1.8), 45)
    : Math.min(Math.ceil(count * 1.2), 30);
  // IG-Hashtag returns up to `scrape` posts. IG-Profile then fans out to
  // ~0.7 × scrape unique usernames (1 item each, resultsLimit=1).
  return scrape * APIFY_PRICE_PER_IG_ITEM_USD
       + Math.ceil(scrape * 0.7) * APIFY_PRICE_PER_IG_ITEM_USD;
}

/** Estimated USD for one TT wave-row. TT rental is monthly-flat (~$45),
 *  shown account-wide elsewhere; per-wave only the platform compute. */
function ttCostPerWave(_count: number): number {
  return APIFY_TT_COMPUTE_PER_RUN_USD;
}

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

  // languages: multi-select chips. One wave-row gets created per (app, language)
  // pair, so picking 3 apps × 2 langs = 6 rows. Each row carries its own
  // language so the n8n wave-consumer picks the correct mail-template (DB row
  // in klar_app_mail_templates keyed by app_slug + language) and the correct
  // hashtag-bucket (region-specific tags vary per language). Default 'de' if
  // nothing selected so the form stays compatible with the old single-app flow.
  const ALLOWED_LANGS = new Set(["de", "en", "es", "it", "fr"]);
  const rawLangs = form.getAll("languages").map((v) => String(v).trim().toLowerCase());
  const languages = Array.from(new Set(rawLangs.filter((l) => ALLOWED_LANGS.has(l))));
  if (languages.length === 0) languages.push("de");

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

  // Server-side cost-estimate. Mirrors the n8n scrape-limits (S41 cost-cut)
  // and matches the client-side JS calc() in admin/route.ts. Cost is per
  // (app, language) wave-row because each pair fans out to one separate
  // n8n execution.
  const profileLookupsPerApp = platforms.length * count;
  const smallBucketOnly =
    sizeBuckets.length > 0 && sizeBuckets.every((b) => b === "nano" || b === "micro");
  const igCost = platforms.includes("instagram") ? igCostPerWave(count, smallBucketOnly) : 0;
  const ttCost = platforms.includes("tiktok") ? ttCostPerWave(count) : 0;
  const costEstimatePerApp = Math.round((igCost + ttCost) * 10000) / 10000;
  // Total across all (app, language) combinations the form submitted.
  const totalCombos = apps.length * languages.length;
  const totalEstimateUsd = Math.round(costEstimatePerApp * totalCombos * 100) / 100;
  // Hard guard: require ?confirm=1 once the wave is expensive. The UI
  // surfaces a confirm-dialog at the same threshold so this fires only if
  // someone bypasses the dialog (curl, replayed form). Skipping the dialog
  // costs real Apify-USD so we explicitly fail-closed here.
  if (totalEstimateUsd >= COST_CONFIRM_USD) {
    const confirmFlag = String(form.get("cost_confirmed") ?? "").trim();
    if (confirmFlag !== "1") {
      return back(req, `Estimate $${totalEstimateUsd.toFixed(2)} liegt über dem Cost-Confirm-Limit ($${COST_CONFIRM_USD.toFixed(2)}). Bitte im Formular bestätigen.`);
    }
  }

  // S32-eve + S40: cross-product apps × languages. Each (app, lang) pair gets
  // its own wave-row so per-app hashtags + per-lang mail-templates never
  // collide. We dispatch all webhooks in parallel — n8n + Apify handle
  // concurrency internally. If the admin edits mail_subject/body in the form,
  // the override applies to every spawned run regardless of language.
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

  type Combo = { app: string; lang: "de" | "en" | "es" | "it" | "fr" };
  const combos: Combo[] = [];
  for (const app of apps) {
    for (const lang of languages) {
      combos.push({ app, lang: lang as Combo["lang"] });
    }
  }

  // Single-combo path: keep behaviour identical (one row, one webhook).
  if (combos.length === 1) {
    const c = combos[0];
    let row: Awaited<ReturnType<typeof createOutreachRun>>;
    try {
      row = await createOutreachRun({
        apps: [c.app],
        platforms,
        size_buckets: sizeBuckets,
        language: c.lang,
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
      `Welle ${row.id.slice(0, 8)} gestartet: ${c.app} (${c.lang}) × ${platforms.length} Plattformen × ${count} = ~${profileLookupsPerApp} Profile, est $${costEstimatePerApp.toFixed(2)}.`,
    );
  }

  // Multi-combo path: one row per (app, lang). N rows = N parallel n8n
  // executions. Each row's Build-Job-List in n8n keys off run.language to
  // pull the matching mail-template + hashtag-bucket from the DB.
  const created: Array<{ id: string; app: string; lang: string }> = [];
  const failed: Array<{ app: string; lang: string; error: string }> = [];
  for (const c of combos) {
    try {
      const row = await createOutreachRun({
        apps: [c.app],
        platforms,
        size_buckets: sizeBuckets,
        language: c.lang,
        count_per_app: count,
        niche,
        mail_subject: mailSubject,
        mail_body: mailBody,
        cost_estimate_usd: costEstimatePerApp,
      });
      created.push({ id: row.id, app: c.app, lang: c.lang });
      fireWebhook(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ app: c.app, lang: c.lang, error: msg.slice(0, 80) });
    }
  }
  if (created.length === 0) {
    return back(req, `Start fehlgeschlagen für alle ${combos.length} Kombinationen: ${failed.map((f) => f.app + "/" + f.lang + "=" + f.error).join("; ").slice(0, 200)}`);
  }
  const total = created.length;
  const totalCost = (costEstimatePerApp * total).toFixed(2);
  const tail = failed.length > 0 ? ` (${failed.length} fehlgeschlagen: ${failed.map((f) => f.app + "/" + f.lang).join(", ")})` : "";
  return back(
    req,
    `${total} Wellen gestartet (${apps.length} App × ${languages.length} Region, parallel): ${created.map((c) => c.app + "·" + c.lang + " #" + c.id.slice(0, 6)).join(", ")} • je ${platforms.length}×${count} = ${profileLookupsPerApp} Profile • est total $${totalCost}${tail}`,
  );
}
