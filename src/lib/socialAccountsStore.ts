// SERVER ONLY. The editable account register behind /admin/accounts.
//
// Alain, 2026-10-01: one menu where every social account stands with its login
// and password, because the accounts were spread over SOCIAL-ACCOUNTS.md, the
// map in /admin/content and the mailbox. Rows live in `social_accounts` (Klar
// Inbox Supabase, migration klar_social_accounts). A password is never a column
// here: it is a store-only vault secret (lib/vault, AES-256-GCM) and the row
// keeps only its id, so revealing it goes through the vault's own reveal route.

import { deleteSecret, rotateSecret, storeSecretReturningId } from "./vault";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export const ACCOUNT_PLATFORMS = ["tiktok", "instagram", "youtube", "x"] as const;
export const ACCOUNT_ROLES = ["brand", "private", "legacy", "founder"] as const;
export const ACCOUNT_STATUSES = ["warmup", "active", "paused"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface StoredAccount {
  id: string;
  app: string;
  platform: string;
  handle: string;
  display_name: string | null;
  role: string;
  status: AccountStatus;
  login_email: string | null;
  password_secret_id: string | null;
  notes: string | null;
  updated_at: string;
}

export interface AccountFields {
  app: string;
  platform: string;
  handle: string;
  display_name: string;
  role: string;
  status: string;
  login_email: string;
  notes: string;
}

function headers(extra?: HeadersInit): HeadersInit {
  return {
    apikey: SB_KEY(),
    Authorization: `Bearer ${SB_KEY()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

const pick = <T extends readonly string[]>(list: T, v: string, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

/** Form input -> a row the check constraints accept. Unknown values fall back, never fail. */
function clean(f: AccountFields) {
  const opt = (v: string, max: number) => v.trim().slice(0, max) || null;
  return {
    app: f.app.trim().toLowerCase().slice(0, 40) || "studio",
    platform: pick(ACCOUNT_PLATFORMS, f.platform, "tiktok"),
    handle: f.handle.trim().replace(/^@/, "").slice(0, 80),
    display_name: opt(f.display_name, 80),
    role: pick(ACCOUNT_ROLES, f.role, "brand"),
    status: pick(ACCOUNT_STATUSES, f.status, "warmup"),
    login_email: opt(f.login_email, 160),
    notes: opt(f.notes, 1000),
  };
}

export async function listAccounts(): Promise<StoredAccount[]> {
  if (!SB_KEY()) return [];
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/social_accounts?select=*&order=app.asc,platform.asc,handle.asc`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

async function getAccount(id: string): Promise<StoredAccount | null> {
  const res = await fetch(
    `${URL_BASE}/rest/v1/social_accounts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as StoredAccount[];
  return rows[0] ?? null;
}

export async function addAccount(f: AccountFields): Promise<string | null> {
  if (!SB_KEY()) return null;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/social_accounts?select=id`, {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(clean(f)),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateAccount(id: string, f: AccountFields): Promise<boolean> {
  if (!SB_KEY()) return false;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/social_accounts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ ...clean(f), updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Set or replace an account's password. The first one creates a vault secret
 * and links it; later ones re-encrypt that same secret in place.
 */
export async function setAccountPassword(id: string, password: string): Promise<boolean> {
  if (!SB_KEY() || !password) return false;
  try {
    const acc = await getAccount(id);
    if (!acc) return false;
    if (acc.password_secret_id) {
      const r = await rotateSecret(acc.password_secret_id, password);
      if (r.ok) return true;
    }
    const secretId = await storeSecretReturningId({
      label: `${acc.platform} @${acc.handle || acc.app}`,
      provider: acc.platform,
      category: "Social-Login",
      secret: password,
    });
    if (!secretId) return false;
    const res = await fetch(`${URL_BASE}/rest/v1/social_accounts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ password_secret_id: secretId, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Removes the account and the vault secret holding its password. */
export async function deleteAccount(id: string): Promise<boolean> {
  if (!SB_KEY()) return false;
  try {
    const acc = await getAccount(id);
    const res = await fetch(`${URL_BASE}/rest/v1/social_accounts?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers({ Prefer: "return=minimal" }),
      cache: "no-store",
    });
    if (!res.ok) return false;
    if (acc?.password_secret_id) await deleteSecret(acc.password_secret_id);
    return true;
  } catch {
    return false;
  }
}
