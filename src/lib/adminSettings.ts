// SERVER ONLY. Singleton row + invite-token + notification-log helpers for
// the Klar Inbox Supabase (project `exiuwektrqxvycclqfdd`).
//
// Backed by the migration `klar_admin_settings_invites_notif_log`:
//   - admin_settings (single row, id=1)
//   - admin_invites  (one-time-use invite tokens)
//   - admin_notif_log (pending notification events, batched into mails)
//
// Reads via service-role key — these tables have RLS enabled with no
// policies, so anon/authenticated cannot touch them. The service key
// bypasses RLS for the admin server only. Never import into a client
// component.

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export interface AdminSettings {
  shader_enabled: boolean;
  auto_accept_affiliates: boolean;
  notification_trigger_inquiry: boolean;
  notification_trigger_complete: boolean;
  notification_batch_size: number;
  notification_recipient_email: string;
  updated_at: string;
  updated_by: string | null;
}

// Defaults match the migration's column defaults. Returned on any read
// failure so the marketing page never crashes if the inbox project is down.
const DEFAULTS: AdminSettings = {
  shader_enabled: true,
  auto_accept_affiliates: false,
  notification_trigger_inquiry: true,
  notification_trigger_complete: true,
  notification_batch_size: 1,
  notification_recipient_email: "alain@getklar.org",
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

function sbHeaders(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    "Content-Type": "application/json",
  };
}

// Read the singleton settings row. Falls back to DEFAULTS so callers never
// have to null-check. Pass `revalidate` to opt into Next's data cache for
// the marketing page (shader read is hot path — should not hit Supabase on
// every render).
export async function getAdminSettings(opts?: {
  revalidate?: number;
}): Promise<AdminSettings> {
  if (!KLAR_INBOX_KEY) return DEFAULTS;
  try {
    const url = `${KLAR_INBOX_URL}/rest/v1/admin_settings?id=eq.1&select=*`;
    const fetchInit: RequestInit & { next?: { revalidate: number } } = {
      headers: sbHeaders(),
    };
    if (opts?.revalidate != null) {
      fetchInit.next = { revalidate: opts.revalidate };
    } else {
      fetchInit.cache = "no-store";
    }
    const res = await fetch(url, fetchInit);
    if (!res.ok) return DEFAULTS;
    const rows = (await res.json()) as Partial<AdminSettings>[];
    if (!Array.isArray(rows) || rows.length === 0) return DEFAULTS;
    return { ...DEFAULTS, ...rows[0] } as AdminSettings;
  } catch {
    return DEFAULTS;
  }
}

// Update the singleton row. Throws on any non-2xx so the settings POST
// route can surface the error to the admin form.
export async function updateAdminSettings(
  patch: Partial<Omit<AdminSettings, "updated_at" | "updated_by">>,
  updatedBy: string | null,
): Promise<void> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY not set");
  const body = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/admin_settings?id=eq.1`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`admin_settings PATCH ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Invites ──────────────────────────────────────────────────────────────

export interface AdminInvite {
  token: string;
  invited_name: string | null;
  invited_email: string | null;
  created_at: string;
  created_by_device: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_device: string | null;
}

function generateToken(): string {
  // 24 chars of url-safe base64 from 18 random bytes. Crypto API is in
  // both node and edge runtimes.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createInvite(args: {
  invitedName?: string;
  invitedEmail?: string;
  createdByDevice?: string | null;
  ttlDays?: number;
}): Promise<{ token: string; expires_at: string }> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY not set");
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (args.ttlDays ?? 7) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/admin_invites`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      token,
      invited_name: args.invitedName ?? null,
      invited_email: args.invitedEmail ?? null,
      created_by_device: args.createdByDevice ?? null,
      expires_at: expiresAt,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`admin_invites POST ${res.status}: ${text.slice(0, 200)}`);
  }
  return { token, expires_at: expiresAt };
}

export async function listInvites(): Promise<AdminInvite[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/admin_invites?select=*&order=created_at.desc&limit=20`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as AdminInvite[];
  } catch {
    return [];
  }
}

// Consume an invite. Returns the invite row if the token was valid (not
// used yet, not expired). Caller is expected to set used_at + used_by_device
// AFTER it has actually issued the device cookie (so a 500 mid-flow
// doesn't burn a token).
export async function fetchInvite(token: string): Promise<AdminInvite | null> {
  if (!KLAR_INBOX_KEY || !token) return null;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/admin_invites?token=eq.${encodeURIComponent(token)}&select=*&limit=1`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as AdminInvite[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const inv = rows[0];
    if (inv.used_at) return null;
    if (new Date(inv.expires_at).getTime() < Date.now()) return null;
    return inv;
  } catch {
    return null;
  }
}

export async function markInviteUsed(
  token: string,
  usedByDevice: string,
): Promise<void> {
  if (!KLAR_INBOX_KEY) return;
  await fetch(
    `${KLAR_INBOX_URL}/rest/v1/admin_invites?token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        used_at: new Date().toISOString(),
        used_by_device: usedByDevice,
      }),
    },
  ).catch(() => {});
}

// ─── Notification log ─────────────────────────────────────────────────────

export interface NotifEvent {
  event_type: "inquiry_new" | "setup_completed";
  app_slug?: string | null;
  handle?: string | null;
  inquiry_id?: string | null;
  payload?: Record<string, unknown>;
}

// Append a pending notification event. The /api/inquiry route fires
// inquiry_new and /api/affiliate/complete fires setup_completed. The
// notification flusher (separate worker) reads pending events and emails
// a digest when count >= notification_batch_size.
export async function logNotifEvent(ev: NotifEvent): Promise<void> {
  if (!KLAR_INBOX_KEY) return;
  await fetch(`${KLAR_INBOX_URL}/rest/v1/admin_notif_log`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      event_type: ev.event_type,
      app_slug: ev.app_slug ?? null,
      handle: ev.handle ?? null,
      inquiry_id: ev.inquiry_id ?? null,
      payload: ev.payload ?? {},
    }),
  }).catch(() => {});
}

export interface PendingNotif {
  id: number;
  event_type: "inquiry_new" | "setup_completed";
  app_slug: string | null;
  handle: string | null;
  inquiry_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function listPendingNotifs(): Promise<PendingNotif[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/admin_notif_log?emailed_at=is.null&select=*&order=created_at.asc&limit=200`,
      { headers: sbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as PendingNotif[];
  } catch {
    return [];
  }
}

export async function markNotifsEmailed(ids: number[]): Promise<void> {
  if (!KLAR_INBOX_KEY || ids.length === 0) return;
  const inList = ids.join(",");
  await fetch(
    `${KLAR_INBOX_URL}/rest/v1/admin_notif_log?id=in.(${inList})`,
    {
      method: "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ emailed_at: new Date().toISOString() }),
    },
  ).catch(() => {});
}
