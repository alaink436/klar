// SERVER ONLY. The change log of each app (migration 0057, table klar_app_changes in the Klar-Hub):
// what was changed in onboarding, paywall, price or store page, and when. Listed above the conversion
// graphs on /admin/conversion and marked in them. Written there by hand (POST /admin/conversion/aenderung)
// or by an agent with a plain insert (via = 'agent').
import "server-only";
import { parseChange } from "./conversion";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AppChange {
  id: string;
  day: string;
  text: string;
  via: "dashboard" | "agent";
}

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

/** One app's changes from `since` on, newest first; empty when the hub cannot be read. */
export async function listAppChanges(slug: string, since: string): Promise<AppChange[]> {
  if (!HUB_KEY()) return [];
  const q = new URLSearchParams({
    select: "id,happened_on,text,via",
    app_slug: `eq.${slug}`,
    happened_on: `gte.${since}`,
    order: "happened_on.desc,created_at.desc",
  });
  const res = await fetch(`${HUB}/rest/v1/klar_app_changes?${q}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return [];
  const rows = (await res.json()) as { id: string; happened_on: string; text: string; via: AppChange["via"] }[];
  return rows.map((r) => ({ id: r.id, day: r.happened_on, text: r.text, via: r.via }));
}

/** Adds a line; `slugs` are the apps the page offers, so no other value reaches the table. */
export async function addAppChange(slug: string, slugs: string[], day: string, text: string, today: string): Promise<{ ok: true } | { ok: false; msg: string }> {
  if (!slugs.includes(slug)) return { ok: false, msg: "Unbekannte App." };
  const change = parseChange(day, text, today);
  if ("error" in change) return { ok: false, msg: change.error };
  const res = await fetch(`${HUB}/rest/v1/klar_app_changes`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ app_slug: slug, happened_on: change.day, text: change.text, via: "dashboard" }),
  });
  return res.ok ? { ok: true } : { ok: false, msg: `Nicht gespeichert (${res.status}).` };
}

export async function removeAppChange(id: string): Promise<{ ok: true } | { ok: false; msg: string }> {
  if (!UUID.test(id)) return { ok: false, msg: "Diesen Eintrag gibt es nicht." };
  const res = await fetch(`${HUB}/rest/v1/klar_app_changes?id=eq.${id}`, { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) });
  return res.ok ? { ok: true } : { ok: false, msg: `Nicht gelöscht (${res.status}).` };
}
