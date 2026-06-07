// POST /admin/reply-templates/save — upsert one inbox-composer reply template.
// Form-POST: language, template_key, label, subject, body, sort_order.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { upsertReplyTemplate, REPLY_LANGS } from "../../../../lib/replyTemplateStore";
import type { ReplyLang } from "../../../../lib/replyTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_MAX = 120;
const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const KEY_RE = /^[a-z0-9_]+$/i;
const LANGS = new Set<string>(REPLY_LANGS);

function back(req: NextRequest, msg: string, anchor?: string): Response {
  const url = new URL(`/admin/reply-templates?msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url);
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

  const language = String(form.get("language") ?? "").trim().toLowerCase();
  if (!LANGS.has(language)) return back(req, "language ungültig");

  const templateKey = String(form.get("template_key") ?? "").trim().toLowerCase();
  if (!templateKey || !KEY_RE.test(templateKey)) {
    return back(req, "Key ungültig (nur a-z 0-9 _)");
  }

  const label = String(form.get("label") ?? "").trim().slice(0, LABEL_MAX);
  if (!label) return back(req, "Label darf nicht leer sein");

  const subject = String(form.get("subject") ?? "").trim().slice(0, SUBJECT_MAX);
  const body = String(form.get("body") ?? "").trim().slice(0, BODY_MAX);

  const sortRaw = String(form.get("sort_order") ?? "").trim();
  const sortNum = sortRaw ? Number.parseInt(sortRaw, 10) : NaN;
  const sort_order = Number.isFinite(sortNum) ? Math.max(0, Math.min(999, sortNum)) : undefined;

  try {
    await upsertReplyTemplate(language as ReplyLang, templateKey, {
      label,
      subject,
      body,
      sort_order,
    });
    return back(req, `Gespeichert: ${language} / ${templateKey}`, `${language}-${templateKey}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Speichern fehlgeschlagen: ${msg.slice(0, 160)}`);
  }
}
