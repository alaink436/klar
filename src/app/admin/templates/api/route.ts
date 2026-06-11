// JSON API for the in-inbox outreach-mail editor (Mail-1 / Mail-2 per app).
// GET  -> { ok, rows }   all per-app templates (klar_app_mail_templates)
// POST -> { ok, row }    upsert mail1/mail2 subject+body for (app_slug, language)
//
// Hashtags + notes are intentionally NOT writable here — those stay on the
// standalone /admin/templates page. Admin-cookie auth like reply-templates/api.

import { type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { listAppTemplates, upsertAppTemplate } from "../../../../lib/outreachStore";
import { KLAR_APPS } from "../../../../lib/klarApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const ALLOWED_LANGS = new Set(["de", "en", "fr", "es", "it"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authed(req: NextRequest): boolean {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  return Boolean(KEY) && ctEqual(readCookie(req, "klar_admin"), KEY);
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!authed(req)) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await listAppTemplates();
  return json({ ok: true, rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!authed(req)) return json({ ok: false, error: "unauthorized" }, 401);

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }

  const appSlug = String(b.app_slug ?? "").trim().toLowerCase();
  if (!KLAR_APPS.some((a) => a.slug === appSlug)) {
    return json({ ok: false, error: "app_slug ungültig" }, 400);
  }
  const language = String(b.language ?? "").trim().toLowerCase();
  if (!ALLOWED_LANGS.has(language)) return json({ ok: false, error: "language ungültig" }, 400);

  const field = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max) || null;

  try {
    const row = await upsertAppTemplate(appSlug, language, {
      mail1_subject: field("mail1_subject", SUBJECT_MAX),
      mail1_body: field("mail1_body", BODY_MAX),
      mail2_subject: field("mail2_subject", SUBJECT_MAX),
      mail2_body: field("mail2_body", BODY_MAX),
    });
    return json({ ok: true, row });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "save failed" }, 502);
  }
}
