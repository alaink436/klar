// SERVER ONLY. TikTok channel logins for /admin/vault/tiktok, table
// `klar_tiktok_accounts` (migration 0041). Username and e-mail are plain
// columns; the password is sealed with the vault master key (lib/vault) and
// only opened by revealTiktokPassword(), which answers to the 2FA-gated admin
// route alone. Never import into a client component.

import { openWithMaster, sealWithMaster, vaultReady } from "./vault";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const TABLE = `${URL_BASE}/rest/v1/klar_tiktok_accounts`;

function sbHeaders(extra?: HeadersInit): HeadersInit {
  return {
    apikey: SB_KEY(),
    Authorization: `Bearer ${SB_KEY()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface TiktokAccount {
  id: string;
  channel: string;
  username: string;
  email: string | null;
  note: string | null;
  hasPassword: boolean;
  updated_at: string;
}

export interface TiktokAccountInput {
  channel: string;
  username: string;
  email: string;
  note: string;
  password: string; // "" = keep (edit) / none (add)
}

type Result = { ok: true } | { ok: false; error: string };

function clean(input: TiktokAccountInput) {
  return {
    channel: input.channel.trim().slice(0, 80),
    username: input.username.trim().replace(/^@/, "").slice(0, 80),
    email: input.email.trim().slice(0, 160) || null,
    note: input.note.trim().slice(0, 500) || null,
  };
}

function sealed(password: string) {
  const enc = sealWithMaster(password);
  return { pw_ciphertext: enc.ciphertext, pw_iv: enc.iv, pw_auth_tag: enc.auth_tag };
}

export async function listTiktokAccounts(): Promise<TiktokAccount[]> {
  if (!SB_KEY()) return [];
  try {
    const res = await fetch(
      `${TABLE}?select=id,channel,username,email,note,pw_ciphertext,updated_at&order=channel.asc`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Omit<TiktokAccount, "hasPassword"> & { pw_ciphertext: string | null }>;
    if (!Array.isArray(rows)) return [];
    // The ciphertext is only read to answer "is there a password?" and is
    // dropped here, so it never reaches the page props.
    return rows.map(({ pw_ciphertext, ...r }) => ({ ...r, hasPassword: Boolean(pw_ciphertext) }));
  } catch {
    return [];
  }
}

export async function addTiktokAccount(input: TiktokAccountInput): Promise<Result> {
  if (!vaultReady()) return { ok: false, error: "vault not configured" };
  const row = clean(input);
  if (!row.channel || !row.username) return { ok: false, error: "tiktok-missing" };
  const body = { ...row, ...(input.password ? sealed(input.password) : {}) };
  try {
    const res = await fetch(TABLE, {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, error: `insert failed (${res.status})` };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function updateTiktokAccount(id: string, input: TiktokAccountInput): Promise<Result> {
  if (!vaultReady()) return { ok: false, error: "vault not configured" };
  const row = clean(input);
  if (!row.channel || !row.username) return { ok: false, error: "tiktok-missing" };
  const patch = {
    ...row,
    ...(input.password ? sealed(input.password) : {}),
    updated_at: new Date().toISOString(),
  };
  try {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, error: `update failed (${res.status})` };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function deleteTiktokAccount(id: string): Promise<boolean> {
  if (!SB_KEY()) return false;
  try {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revealTiktokPassword(id: string): Promise<string | null> {
  if (!vaultReady()) return null;
  try {
    const res = await fetch(
      `${TABLE}?id=eq.${encodeURIComponent(id)}&select=pw_ciphertext,pw_iv,pw_auth_tag&limit=1`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ pw_ciphertext: string | null; pw_iv: string | null; pw_auth_tag: string | null }>;
    const r = Array.isArray(rows) ? rows[0] : undefined;
    if (!r?.pw_ciphertext || !r.pw_iv || !r.pw_auth_tag) return null;
    return openWithMaster(r.pw_ciphertext, r.pw_iv, r.pw_auth_tag);
  } catch {
    return null;
  }
}
