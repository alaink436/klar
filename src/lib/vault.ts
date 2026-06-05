// SERVER ONLY. API-key vault. Keys are AES-256-GCM encrypted at rest in the
// `vault_secrets` table (Klar Inbox Supabase, migration klar_vault_secrets).
//
// The decryption key is derived (SHA-256) from VAULT_MASTER_KEY, which lives
// ONLY in the server env (Vercel) — never in the repo or a local file. Plaintext
// keys exist only transiently inside getForProxy() while forwarding a request,
// and are never returned to any client. Never import into a client component.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const MASTER = () => process.env.VAULT_MASTER_KEY ?? "";

export function vaultReady(): boolean {
  return Boolean(SB_KEY() && MASTER());
}

// 32-byte AES key derived from the env master secret (so any sufficiently long
// random string works as VAULT_MASTER_KEY).
function aesKey(): Buffer {
  return createHash("sha256").update(MASTER(), "utf8").digest();
}

function sbHeaders(extra?: HeadersInit): HeadersInit {
  return {
    apikey: SB_KEY(),
    Authorization: `Bearer ${SB_KEY()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function encrypt(plain: string): { ciphertext: string; iv: string; auth_tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), auth_tag: tag.toString("base64") };
}

function decrypt(ciphertext: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export interface VaultSecretMeta {
  id: string;
  label: string;
  provider: string;
  base_url: string;
  auth_header: string;
  auth_scheme: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface AddSecretInput {
  label: string;
  provider: string;
  base_url: string;
  auth_header?: string;
  auth_scheme?: string;
  secret: string; // the raw API key — encrypted here, never stored in clear
}

export async function addSecret(
  input: AddSecretInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!vaultReady()) return { ok: false, error: "vault not configured" };
  if (!input.secret) return { ok: false, error: "kein Key angegeben" };
  let base: string;
  try {
    base = new URL(input.base_url).origin + new URL(input.base_url).pathname.replace(/\/$/, "");
  } catch {
    return { ok: false, error: "base_url ungültig" };
  }
  const enc = encrypt(input.secret);
  const row = {
    label: input.label.slice(0, 80) || "Unbenannt",
    provider: input.provider.slice(0, 40) || "custom",
    base_url: base,
    auth_header: (input.auth_header || "authorization").toLowerCase().slice(0, 60),
    auth_scheme: input.auth_scheme ?? "Bearer ",
    ...enc,
  };
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/vault_secrets`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `insert failed (${res.status})` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function listSecrets(): Promise<VaultSecretMeta[]> {
  if (!SB_KEY()) return [];
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/vault_secrets?select=id,label,provider,base_url,auth_header,auth_scheme,created_at,last_used_at,revoked_at&order=created_at.desc`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as VaultSecretMeta[]) : [];
  } catch {
    return [];
  }
}

// Rotate: replace the stored key with a new one (re-encrypt in place, same id
// → the proxy URL stays valid). The old key becomes unrecoverable.
export async function rotateSecret(
  id: string,
  newSecret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!vaultReady()) return { ok: false, error: "vault not configured" };
  if (!newSecret) return { ok: false, error: "kein Key angegeben" };
  const enc = encrypt(newSecret);
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/vault_secrets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ ...enc, last_used_at: null }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `update failed (${res.status})` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function deleteSecret(id: string): Promise<boolean> {
  if (!SB_KEY()) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/vault_secrets?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Server-only: decrypt + return a secret's plaintext for the admin to read
// back ("reveal"). Only ever called from an admin-session-gated route; the key
// is sent server -> the admin's browser and never logged. Distinct from the
// proxy path (does not touch last_used_at — revealing is not "using").
export async function revealSecret(id: string): Promise<string | null> {
  if (!vaultReady()) return null;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/vault_secrets?id=eq.${encodeURIComponent(id)}&select=ciphertext,iv,auth_tag&limit=1`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ ciphertext: string; iv: string; auth_tag: string }>;
    const r = Array.isArray(rows) ? rows[0] : undefined;
    if (!r) return null;
    try {
      return decrypt(r.ciphertext, r.iv, r.auth_tag);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// Server-only: fetch + decrypt a secret for the proxy to inject. Returns the
// plaintext key alongside its routing config, or null. Plaintext must never
// leave the proxy handler.
export async function getForProxy(
  id: string,
): Promise<{ baseUrl: string; authHeader: string; authScheme: string; key: string } | null> {
  if (!vaultReady()) return null;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/vault_secrets?id=eq.${encodeURIComponent(id)}&select=base_url,auth_header,auth_scheme,ciphertext,iv,auth_tag,revoked_at&limit=1`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      base_url: string;
      auth_header: string;
      auth_scheme: string;
      ciphertext: string;
      iv: string;
      auth_tag: string;
      revoked_at: string | null;
    }>;
    const r = Array.isArray(rows) ? rows[0] : undefined;
    if (!r || r.revoked_at) return null;
    let key: string;
    try {
      key = decrypt(r.ciphertext, r.iv, r.auth_tag);
    } catch {
      return null; // wrong master key / tampered ciphertext
    }
    void fetch(`${URL_BASE}/rest/v1/vault_secrets?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      cache: "no-store",
    }).catch(() => {});
    return { baseUrl: r.base_url, authHeader: r.auth_header, authScheme: r.auth_scheme, key };
  } catch {
    return null;
  }
}
