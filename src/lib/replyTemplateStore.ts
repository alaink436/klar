// SERVER ONLY. Editable inbox-composer reply templates, stored in
// `klar_reply_templates` on anime-vault (exiuwektrqxvycclqfdd). Falls back to
// the hardcoded REPLY_TEMPLATES (lib/replyTemplates) when the DB is
// unconfigured or empty, so the composer dropdown is never blank.
//
// RLS: service-role only. Read/write goes through KLAR_INBOX_SERVICE_KEY, the
// same anime-vault service-role key the outreach store uses.
// Migration: `klar_reply_templates_v1` (2026-06-07).

import {
  REPLY_TEMPLATES,
  replyLang,
  type ReplyLang,
  type ReplyTemplate,
} from "./replyTemplates";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export const REPLY_LANGS: ReplyLang[] = ["de", "en", "es", "it", "fr"];

export interface ReplyTemplateRow {
  id: string;
  language: ReplyLang;
  template_key: string;
  label: string;
  subject: string;
  body: string;
  sort_order: number;
  updated_at: string;
}

function hdr(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function isReplyTemplateStoreConfigured(): boolean {
  return Boolean(KLAR_INBOX_KEY);
}

/** All rows, ordered language+sort. Returns [] on any failure so the UI never crashes. */
export async function listReplyTemplateRows(): Promise<ReplyTemplateRow[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_reply_templates?select=*&order=language.asc,sort_order.asc`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as ReplyTemplateRow[];
  } catch {
    return [];
  }
}

/**
 * Grouped set for the inbox composer. Reads the DB when available; any language
 * with no DB rows falls back to the hardcoded REPLY_TEMPLATES so the composer
 * always has options in every supported language. A fully unconfigured/empty
 * store returns the hardcoded set unchanged.
 */
export async function getReplyTemplates(): Promise<Record<ReplyLang, ReplyTemplate[]>> {
  const rows = await listReplyTemplateRows();
  if (rows.length === 0) return REPLY_TEMPLATES;
  const out: Record<ReplyLang, ReplyTemplate[]> = { de: [], en: [], es: [], it: [], fr: [] };
  for (const r of rows) {
    out[replyLang(r.language)].push({
      id: r.template_key,
      label: r.label,
      subject: r.subject,
      body: r.body,
    });
  }
  for (const lang of REPLY_LANGS) {
    if (out[lang].length === 0) out[lang] = REPLY_TEMPLATES[lang];
  }
  return out;
}

export interface ReplyTemplatePatch {
  label: string;
  subject: string;
  body: string;
  sort_order?: number;
}

/** Upsert one template by (language, template_key). Returns the stored row. */
export async function upsertReplyTemplate(
  language: ReplyLang,
  templateKey: string,
  patch: ReplyTemplatePatch,
): Promise<ReplyTemplateRow> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body = {
    language,
    template_key: templateKey,
    label: patch.label,
    subject: patch.subject,
    body: patch.body,
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_reply_templates?on_conflict=language,template_key`,
    {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`reply-template upsert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as ReplyTemplateRow[];
  if (!rows[0]) throw new Error("reply-template upsert returned no row");
  return rows[0];
}

/** Delete one template by id. */
export async function deleteReplyTemplate(id: string): Promise<void> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_reply_templates?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: hdr() },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`reply-template delete ${res.status}: ${text.slice(0, 200)}`);
  }
}
