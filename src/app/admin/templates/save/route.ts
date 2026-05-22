// POST /admin/templates/save — upsert a per-app outreach template.
// Form-POST: app_slug, language, hashtags (comma-sep), mail1_subject,
// mail1_body, mail2_subject, mail2_body, notes.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { upsertAppTemplate } from "../../../../lib/outreachStore";
import { KLAR_APPS } from "../../../../lib/klarApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const NOTES_MAX = 500;
const HASHTAG_MAX = 8;
const HASHTAG_CHAR_RE = /^[a-z0-9_]+$/i;
const ALLOWED_LANGS = new Set(["de", "en", "fr", "es", "it"]);

function back(req: NextRequest, msg: string, anchor?: string): Response {
  const url = new URL(`/admin?view=templates&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url);
  if (anchor) url.hash = anchor;
  return NextResponse.redirect(url, 303);
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

  const appSlug = String(form.get("app_slug") ?? "").trim().toLowerCase();
  const validSlugs = new Set(KLAR_APPS.map((a) => a.slug));
  if (!validSlugs.has(appSlug)) return back(req, "app_slug ungültig");

  const language = String(form.get("language") ?? "de").trim().toLowerCase();
  if (!ALLOWED_LANGS.has(language)) return back(req, "language ungültig");

  const hashtagsRaw = String(form.get("hashtags") ?? "").trim();
  const hashtags = hashtagsRaw
    ? hashtagsRaw
        .split(/[,\s]+/)
        .map((s) => s.replace(/^#/, "").toLowerCase().trim())
        .filter(Boolean)
    : [];
  if (hashtags.length > HASHTAG_MAX) return back(req, `Max ${HASHTAG_MAX} Hashtags (Apify-Kosten-Cap)`);
  for (const tag of hashtags) {
    if (!HASHTAG_CHAR_RE.test(tag)) return back(req, `Hashtag '${tag}' enthält ungültige Zeichen (nur a-z 0-9 _)`);
  }

  const mail1Subject = String(form.get("mail1_subject") ?? "").trim().slice(0, SUBJECT_MAX) || null;
  const mail1Body = String(form.get("mail1_body") ?? "").trim().slice(0, BODY_MAX) || null;
  const mail2Subject = String(form.get("mail2_subject") ?? "").trim().slice(0, SUBJECT_MAX) || null;
  const mail2Body = String(form.get("mail2_body") ?? "").trim().slice(0, BODY_MAX) || null;
  const notes = String(form.get("notes") ?? "").trim().slice(0, NOTES_MAX) || null;

  try {
    await upsertAppTemplate(appSlug, language, {
      hashtags,
      mail1_subject: mail1Subject,
      mail1_body: mail1Body,
      mail2_subject: mail2Subject,
      mail2_body: mail2Body,
      notes,
    });
    return back(req, `Gespeichert: ${appSlug} / ${language}`, `${appSlug}-${language}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Speichern fehlgeschlagen: ${msg.slice(0, 160)}`);
  }
}
