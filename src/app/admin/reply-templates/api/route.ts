// JSON API for the in-inbox template manager (client-side CRUD, no redirect).
// GET    -> { ok, rows }            list all reply templates
// POST   -> { ok, row } | { ok:false, error }   upsert one (json body)
// DELETE -> { ok } | { ok:false, error }         delete one by id (json body)
//
// The standalone /admin/reply-templates page still uses the form-post
// save/delete routes; this one backs the inbox drawer so edits update the
// composer live without a full navigation.

import { type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import {
  listReplyTemplateRows,
  upsertReplyTemplate,
  deleteReplyTemplate,
  REPLY_LANGS,
} from "../../../../lib/replyTemplateStore";
import type { ReplyLang } from "../../../../lib/replyTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_MAX = 120;
const SUBJECT_MAX = 200;
const BODY_MAX = 10000;
const KEY_RE = /^[a-z0-9_]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGS = new Set<string>(REPLY_LANGS);

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
  const rows = await listReplyTemplateRows();
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

  const language = String(b.language ?? "").trim().toLowerCase();
  if (!LANGS.has(language)) return json({ ok: false, error: "language ungültig" }, 400);

  const templateKey = String(b.template_key ?? "").trim().toLowerCase();
  if (!templateKey || !KEY_RE.test(templateKey)) {
    return json({ ok: false, error: "Key ungültig (nur a-z 0-9 _)" }, 400);
  }

  const label = String(b.label ?? "").trim().slice(0, LABEL_MAX);
  if (!label) return json({ ok: false, error: "Label darf nicht leer sein" }, 400);

  const subject = String(b.subject ?? "").trim().slice(0, SUBJECT_MAX);
  const body = String(b.body ?? "").trim().slice(0, BODY_MAX);
  const sortNum = Number.parseInt(String(b.sort_order ?? ""), 10);
  const sort_order = Number.isFinite(sortNum) ? Math.max(0, Math.min(999, sortNum)) : undefined;

  try {
    const row = await upsertReplyTemplate(language as ReplyLang, templateKey, {
      label,
      subject,
      body,
      sort_order,
    });
    return json({ ok: true, row });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "save failed" }, 502);
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  if (!authed(req)) return json({ ok: false, error: "unauthorized" }, 401);

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }

  const id = String(b.id ?? "").trim();
  if (!UUID_RE.test(id)) return json({ ok: false, error: "id ungültig" }, 400);

  try {
    await deleteReplyTemplate(id);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "delete failed" }, 502);
  }
}
