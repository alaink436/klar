// SERVER ONLY. brain_members registry helpers for the Klar Inbox Supabase
// (project `exiuwektrqxvycclqfdd`). Backed by migration 0003_brain_members.
//
// A brain_member is an external person invited to read the AI-Brain at /brain.
// Two clearance tiers:
//   - 'brain' → scoped to the `folders` top-level allow-list
//   - 'full'  → every non-secret folder (scope === null)
// Secrets/Credentials are excluded server-side in brainVault regardless of
// clearance, so 'full' never means "everything" in the literal sense.
//
// Reads/writes via the service-role key only (RLS-locked table, no policies).
// Never import into a client component.

const URL = process.env.KLAR_INBOX_SUPABASE_URL
  ?? process.env.NEXT_PUBLIC_KLAR_INBOX_SUPABASE_URL
  ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export type BrainClearance = "brain" | "full";

export interface BrainMember {
  email: string;
  clearance: BrainClearance;
  folders: string[];
  invited_by: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

function sbHeaders(): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  };
}

// Active scope for a member: null === full (all non-secret folders), else the
// explicit top-level folder allow-list. Revoked members get an empty scope so
// even a stale session sees nothing.
export function scopeForMember(m: BrainMember | null): string[] | null {
  if (!m || m.revoked_at) return [];
  if (m.clearance === "full") return null;
  return m.folders ?? [];
}

export async function getBrainMember(email: string): Promise<BrainMember | null> {
  if (!KEY || !email) return null;
  try {
    const res = await fetch(
      `${URL}/rest/v1/brain_members?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*&limit=1`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as BrainMember[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function listBrainMembers(): Promise<BrainMember[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `${URL}/rest/v1/brain_members?select=*&order=created_at.desc&limit=200`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as BrainMember[];
  } catch {
    return [];
  }
}

// Insert or update a member (email is the primary key). Clears revoked_at so
// re-inviting a previously-revoked email restores access.
export async function upsertBrainMember(args: {
  email: string;
  clearance: BrainClearance;
  folders: string[];
  invitedBy?: string | null;
}): Promise<void> {
  if (!KEY) throw new Error("KLAR_INBOX_SERVICE_KEY not set");
  const body = {
    email: args.email.toLowerCase(),
    clearance: args.clearance,
    folders: args.clearance === "full" ? [] : args.folders,
    invited_by: args.invitedBy ?? null,
    revoked_at: null,
  };
  const res = await fetch(`${URL}/rest/v1/brain_members`, {
    method: "POST",
    headers: {
      ...sbHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`brain_members upsert ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function revokeBrainMember(email: string): Promise<void> {
  if (!KEY) throw new Error("KLAR_INBOX_SERVICE_KEY not set");
  const res = await fetch(
    `${URL}/rest/v1/brain_members?email=eq.${encodeURIComponent(email.toLowerCase())}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`brain_members revoke ${res.status}: ${text.slice(0, 200)}`);
  }
}

// Best-effort last-seen stamp. Never throws — a failed stamp must not block
// reading a note.
export async function touchBrainMemberSeen(email: string): Promise<void> {
  if (!KEY || !email) return;
  await fetch(
    `${URL}/rest/v1/brain_members?email=eq.${encodeURIComponent(email.toLowerCase())}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
    },
  ).catch(() => {});
}
