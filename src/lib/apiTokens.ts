// SERVER ONLY. API-token store for the Klar admin (Brain-API V2 + future
// Vault), backed by the `api_tokens` table in the Klar Inbox Supabase
// (project exiuwektrqxvycclqfdd, migration `klar_api_tokens`).
//
// Tokens are shown to the user exactly once at creation; only a SHA-256 hash
// is stored. Verification hashes the presented bearer and looks it up. Table
// has RLS enabled with no policies, so only the service-role key reaches it.
// Never import into a client component.

import { createHash, randomBytes } from "crypto";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";

// "todos:ical" ist absichtlich eng: der Kalender-Feed liegt als URL im
// iPhone und wird von Apple regelmässig ohne Nachfrage abgerufen — dieser
// Token darf deshalb nichts ausser den geplanten To-dos lesen.
// "vault:exec" gibt den KLARTEXT eines Secrets heraus. Das ist der einzige Weg
// fuer CLIs, die ihren Key als Env-Var erwarten (eas, vercel, gh) und den der
// HTTP-Proxy darum nicht bedienen kann. Weil damit das "use but don't see" faellt,
// traegt jeder exec-Token eine eigene Allow-List (`vault_secret_ids`): ohne
// Eintrag loest er nichts auf, auch nicht mit dem "*"-Scope.
export type Scope = "brain:read" | "vault:use" | "vault:exec" | "todos:ical";

export interface ApiTokenRow {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  vault_secret_ids: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function headers(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY(),
    Authorization: `Bearer ${KEY()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function sha256hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// Raw token: klr_<32 base64url chars>. The prefix (first 12 chars) is stored
// in clear for display ("klr_Ab12Cd34…") so the user can tell tokens apart.
function newRawToken(): string {
  return "klr_" + randomBytes(24).toString("base64url");
}

export function hasStore(): boolean {
  return Boolean(KEY());
}

// Create a token. Returns the RAW token ONCE — it is never retrievable again.
export async function createToken(
  label: string,
  scopes: Scope[],
  // Nur fuer "vault:exec": welche vault_secrets dieser Token im Klartext holen
  // darf. Ohne Eintrag kann er keines, das ist Absicht.
  vaultSecretIds: string[] = [],
): Promise<{ ok: true; raw: string; prefix: string } | { ok: false; error: string }> {
  if (!KEY()) return { ok: false, error: "store not configured" };
  const raw = newRawToken();
  const prefix = raw.slice(0, 12);
  const row = {
    label: label.slice(0, 80) || "Unbenannt",
    token_hash: sha256hex(raw),
    prefix,
    scopes,
    vault_secret_ids: scopes.includes("vault:exec") ? vaultSecretIds : [],
  };
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/api_tokens`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `insert failed (${res.status})` };
    return { ok: true, raw, prefix };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function listTokens(): Promise<ApiTokenRow[]> {
  if (!KEY()) return [];
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/api_tokens?select=id,label,prefix,scopes,vault_secret_ids,created_at,last_used_at,revoked_at&order=created_at.desc`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as ApiTokenRow[]) : [];
  } catch {
    return [];
  }
}

export async function revokeToken(id: string): Promise<boolean> {
  if (!KEY()) return false;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/api_tokens?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        cache: "no-store",
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Permanently remove a token row. Offered for any token (active or revoked) so a
// credential can be cleaned up in a single step; the UI adds an extra warning
// when the token is still active (a live agent would lose access).
export async function deleteToken(id: string): Promise<boolean> {
  if (!KEY()) return false;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/api_tokens?id=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: headers({ Prefer: "return=minimal" }),
        cache: "no-store",
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Best-effort, fire-and-forget "last used" stamp for a token. Never awaited so
// it can't add latency to the request path. Split out so the vault proxy can
// run the token + secret lookups in parallel and only stamp AFTER both checks
// pass (a failed call must not mark the token as used).
export function touchTokenUsed(id: string): void {
  if (!KEY()) return;
  void fetch(`${URL_BASE}/rest/v1/api_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    cache: "no-store",
  }).catch(() => {});
}

// Verify a presented bearer token for a required scope. Returns the token id on
// success, null otherwise. A token with the "*" scope passes any check. By
// default it best-effort touches last_used_at; pass { touch: false } to skip
// that (the caller stamps later, e.g. after a parallel secret lookup).
export async function verifyToken(
  raw: string,
  required: Scope,
  opts: { touch?: boolean } = {},
): Promise<{ id: string; scopes: string[]; vaultSecretIds: string[] } | null> {
  if (!KEY() || !raw) return null;
  const hash = sha256hex(raw.trim());
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/api_tokens?token_hash=eq.${hash}&select=id,scopes,vault_secret_ids,revoked_at&limit=1`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      id: string;
      scopes: string[];
      vault_secret_ids: string[] | null;
      revoked_at: string | null;
    }[];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row || row.revoked_at) return null;
    const scopes = row.scopes ?? [];
    if (!scopes.includes(required) && !scopes.includes("*")) return null;
    if (opts.touch !== false) touchTokenUsed(row.id);
    return { id: row.id, scopes, vaultSecretIds: row.vault_secret_ids ?? [] };
  } catch {
    return null;
  }
}
