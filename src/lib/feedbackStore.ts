// SERVER ONLY. App-Feedback: was Nutzer an die Support-Adressen der Apps
// schreiben. Die Gmail-Postfaecher aus den Apps und Store-Eintraegen leiten an
// feedback+<app>@<KLAR_INBOUND_DOMAIN> weiter, /api/inbound/brevo erkennt das
// Alias und legt die Mail hier ab, Klar Studios > Feedback zeigt sie.
//
// Tabelle `klar_app_feedback` (Migration 0040) im Klar-Hub-Supabase.
import "server-only";
import { collabDomains, detectCollabApp } from "@/lib/collabStore";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

function hdr(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export const FEEDBACK_ALIAS = "feedback";

/** Slugs wie im Collab-Postfach, damit dieselbe App ueberall gleich heisst. */
export const FEEDBACK_APPS: { slug: string; name: string; suffixes: string[]; inboxes: string[] }[] = [
  { slug: "yarn-stash", name: "Yarn Stash", suffixes: ["yarnstash"], inboxes: ["myyarnstashsupport@gmail.com", "yarnstash@gmail.com"] },
  { slug: "myloo", name: "Pocketmate", suffixes: ["pocketmate", "myloo"], inboxes: ["myloosupport@gmail.com", "support@myloo.org"] },
  { slug: "kelva", name: "Kelva", suffixes: ["kelva"], inboxes: ["kelvasupport@gmail.com"] },
  { slug: "animevault", name: "Anime Vault", suffixes: ["animevault"], inboxes: ["help.klar@gmail.com"] },
  { slug: "wavelength", name: "Basalt", suffixes: ["basalt"], inboxes: [] },
];

export function feedbackAppName(slug: string | null): string {
  return FEEDBACK_APPS.find((a) => a.slug === slug)?.name ?? "Unbekannt";
}

/**
 * Ist die Mail an das Feedback-Alias gegangen, und fuer welche App? Die App
 * kommt der Reihe nach aus dem Plus-Suffix (feedback+kelva@), aus dem
 * urspruenglichen Empfaenger, den Gmail beim Weiterleiten im To stehen laesst,
 * und zuletzt aus dem Text. `null` heisst: keine Feedback-Mail.
 */
export function feedbackRoute(
  recipients: string[],
  text: string,
): { app: string | null; inbox: string | null } | null {
  const domains = collabDomains();
  const lower = recipients.map((r) => r.trim().toLowerCase());
  let suffix: string | null = null;
  let hit = false;
  for (const addr of lower) {
    const [local = "", domain = ""] = addr.split("@");
    const [base, sfx = ""] = local.split("+");
    if (base === FEEDBACK_ALIAS && domains.includes(domain)) {
      hit = true;
      if (sfx) suffix = sfx;
    }
  }
  if (!hit) return null;
  const inboxApp = FEEDBACK_APPS.find((a) => a.inboxes.some((i) => lower.includes(i)));
  const inbox = inboxApp ? (lower.find((r) => inboxApp.inboxes.includes(r)) ?? null) : null;
  const bySuffix = suffix ? FEEDBACK_APPS.find((a) => a.suffixes.includes(suffix)) : undefined;
  return { app: bySuffix?.slug ?? inboxApp?.slug ?? detectCollabApp(text), inbox };
}

export interface AppFeedback {
  id: string;
  app: string | null;
  inbox: string | null;
  contact_email: string;
  contact_name: string | null;
  subject: string | null;
  body: string;
  spam_score: number | null;
  sent_at: string | null;
  done_at: string | null;
  created_at: string;
}

export async function insertFeedback(
  input: Omit<AppFeedback, "id" | "done_at" | "created_at"> & { external_id: string | null },
): Promise<boolean> {
  if (!KLAR_INBOX_KEY) return false;
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_app_feedback`, {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=minimal" },
      body: JSON.stringify({ ...input, contact_email: input.contact_email.trim().toLowerCase() }),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

export async function listFeedback(opts: { done: boolean; app: string | null }): Promise<AppFeedback[] | null> {
  if (!KLAR_INBOX_KEY) return null;
  const q = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "300" });
  q.set("done_at", opts.done ? "not.is.null" : "is.null");
  if (opts.app) q.set("app", `eq.${opts.app}`);
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_app_feedback?${q}`, { headers: hdr(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AppFeedback[];
  } catch {
    return null;
  }
}

export async function setFeedbackDone(id: string, done: boolean): Promise<boolean> {
  if (!KLAR_INBOX_KEY || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_app_feedback?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...hdr(), Prefer: "return=minimal" },
      body: JSON.stringify({ done_at: done ? new Date().toISOString() : null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
