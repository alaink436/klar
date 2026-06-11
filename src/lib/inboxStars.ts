// SERVER ONLY. Starred inbox conversations, table `klar_inbox_stars` in
// anime-vault (exiuwektrqxvycclqfdd), migration 0012. conv_id matches the
// MailClient conversation id (outreach uuid / "inq-<uuid>" / affiliate uuid).
// PostgREST + service-role pattern like scrapeSettings.ts.
import "server-only";

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

/** All starred conversation ids. Fail-soft to empty so the inbox always renders. */
export async function listStarredIds(): Promise<Set<string>> {
  if (!KLAR_INBOX_KEY) return new Set();
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_inbox_stars?select=conv_id`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return new Set();
    const rows = (await res.json()) as { conv_id: string }[];
    return new Set(rows.map((r) => r.conv_id));
  } catch {
    return new Set();
  }
}

/** Star (on=true) or unstar (on=false) one conversation. Idempotent. */
export async function setStarred(convId: string, on: boolean): Promise<void> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  if (on) {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_inbox_stars?on_conflict=conv_id`,
      {
        method: "POST",
        headers: { ...hdr(), Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ conv_id: convId }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`star upsert ${res.status}: ${text.slice(0, 200)}`);
    }
  } else {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_inbox_stars?conv_id=eq.${encodeURIComponent(convId)}`,
      { method: "DELETE", headers: hdr() },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`star delete ${res.status}: ${text.slice(0, 200)}`);
    }
  }
}
