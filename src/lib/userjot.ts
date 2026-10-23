// SERVER ONLY. Die UserJot-Boards der Apps: Wuensche, Stimmen und Stand, gelesen
// ueber die UserJot-API (api.userjot.com/v1). Basalt hat sein eigenes Board
// ("what i want next") am 2026-10-22 gegen UserJot getauscht; lib/board bleibt,
// weil "Neu in Basalt" weiter feature_ideas liest.
//
// Ein Workspace fuer alle Apps ("Klar Studios", klarstudios.userjot.com), darin
// ein Board pro App. Darum ein Token fuer alle: im Vault mit Provider "userjot"
// (Vorlage "UserJot" im Vault-Formular). Er wird nur hier entschluesselt und
// geht nie an den Browser. Die API haengt am UserJot-Plan (Fehler
// plan_feature_unavailable mit api_access): dann zeigt die Seite diesen Grund
// statt einer leeren Liste.

import { createHmac } from "node:crypto";
import { listSecrets, revealSecret } from "./vault";

const API = "https://api.userjot.com/v1";
export const WORKSPACE_URL = "https://klarstudios.userjot.com";

export interface UserjotApp {
  /** In der Adresse: /admin/feedback?app=<slug>. */
  slug: string;
  name: string;
  /** Slug des Boards im Workspace; die App oeffnet WORKSPACE_URL/board/<boardSlug> (Basalt: BOARD_URL in lib/legal). */
  boardSlug: string;
  /** Supabase der App und ihr oeffentlicher Schluessel: dort wird das Login eines Nutzers geprueft. */
  supabaseUrl: string;
  publishableKey: string;
}

export const USERJOT_APPS: UserjotApp[] = [
  {
    slug: "basalt",
    name: "Basalt",
    boardSlug: "basalt",
    supabaseUrl: "https://yxhzwzgnbmpjztkvdudr.supabase.co",
    publishableKey: "sb_publishable_gdNInhpEcTL0z4zVEW7WbA_7HTaNtJe",
  },
  {
    slug: "kelva",
    name: "Kelva",
    boardSlug: "kelva",
    supabaseUrl: "https://absnjkjxbxeyekmcmpof.supabase.co",
    publishableKey: "sb_publishable_suu7xL6qBngtD9N7kJt3AA_4fmmRiFc",
  },
  {
    slug: "pocketmate",
    name: "Pocketmate",
    boardSlug: "pocketmate",
    supabaseUrl: "https://jkgymggxshtsljjvketi.supabase.co",
    publishableKey: "sb_publishable_cfG84iuarli5HgWDO7d3uw_m1SiH9pM",
  },
];

export function findUserjotApp(slug: string | null | undefined): UserjotApp | null {
  return USERJOT_APPS.find((a) => a.slug === slug) ?? null;
}

export const boardUrl = (app: UserjotApp) => `${WORKSPACE_URL}/board/${app.boardSlug}`;

// Automatische Anmeldung auf dem Board (2026-10-23, Alain: "das ist ja nervig"):
// Die App schickt ihr Login (den Supabase-Access-Token), Klar prueft es beim
// Supabase der App und gibt einen Board-Link zurueck, der den Nutzer anmeldet.
// Der Link traegt `clientToken`: Base64 aus dem JSON {id: Workspace-ID, user:
// {firstName, id, signature}}, Schluessel sortiert, so wie UserJots eigenes
// Swift-SDK ihn baut. signature = HMAC-SHA256 der Nutzer-ID mit dem "Project
// secret" (UserJot: Settings > Login > Secrets), im Vault unter Provider
// "userjot-login". In UserJot muessen "Automatic login" und "Require signed
// tokens" an sein; ohne Signatur meldet der Link niemanden an.
/** Die Workspace-ID von "Klar Studios", wie das Board sie selbst ausliefert. */
export const WORKSPACE_ID = "cmvjzjf4v02n00krop8vkgdnd";
export const CLIENT_TOKEN_PARAM = "clientToken";

export interface BoardUser {
  id: string;
  firstName?: string | null;
}

export function signUserId(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

export function clientToken(user: BoardUser, signature: string): string {
  // In sortierter Reihenfolge eingefuegt: firstName, id, signature.
  const u: Record<string, string> = {};
  const name = user.firstName?.trim();
  if (name) u.firstName = name;
  u.id = user.id;
  u.signature = signature;
  return Buffer.from(JSON.stringify({ id: WORKSPACE_ID, user: u }), "utf8").toString("base64");
}

export function signedBoardUrl(app: UserjotApp, user: BoardUser, secret: string): string {
  const token = clientToken(user, signUserId(secret, user.id));
  return `${boardUrl(app)}?${CLIENT_TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

/** Das Login-Geheimnis aus dem Vault, oder null, solange es nicht eingetragen ist. */
export async function loginSecret(): Promise<string | null> {
  const meta = (await listSecrets()).find((s) => s.provider === "userjot-login" && !s.revoked_at);
  return meta ? revealSecret(meta.id) : null;
}

/** Wer hinter einem Access-Token steckt, gefragt beim Supabase der App; null ohne gueltiges Login. */
export async function appUser(app: UserjotApp, accessToken: string): Promise<{ id: string } | null> {
  const res = await fetch(`${app.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: app.publishableKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json().catch(() => null)) as { id?: unknown } | null;
  return typeof j?.id === "string" ? { id: j.id } : null;
}

export const REQUEST_STATUSES = ["pending", "review", "planned", "in_progress", "completed", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Wie Klar Control den Stand nennt. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "neu",
  review: "in Prüfung",
  planned: "geplant",
  in_progress: "im Bau",
  completed: "fertig",
  closed: "geschlossen",
};

export interface UserjotRequest {
  id: string;
  title: string;
  body: string;
  status: RequestStatus;
  votes: number;
  comments: number;
  createdAt: string;
}

export class UserjotError extends Error {}

/** Was die Seite sagt, wenn UserJot ablehnt. Eigene Funktion, damit der Test sie ohne Netz pruefen kann. */
export function errorText(status: number, body: unknown): string {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (error?.code === "plan_feature_unavailable") {
    return "Der UserJot-Plan hat keinen API-Zugang. Nach einem Upgrade füllt sich diese Seite von selbst.";
  }
  if (status === 401) return "UserJot lehnt den Token ab. Im Vault neu eintragen.";
  return typeof error?.message === "string" ? error.message : `UserJot antwortet ${status}.`;
}

async function get(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new UserjotError(errorText(res.status, j));
  return (j ?? {}) as Record<string, unknown>;
}

/** Die 100 Wuensche mit den meisten Stimmen auf dem Board dieser App. */
export async function fetchRequests(app: UserjotApp): Promise<UserjotRequest[]> {
  const secret = (await listSecrets()).find((s) => !s.revoked_at && s.provider.toLowerCase() === "userjot");
  const token = secret ? await revealSecret(secret.id) : null;
  if (!token) throw new UserjotError('Kein UserJot-Token im Vault (Vorlage "UserJot", Provider "userjot").');

  // Die API filtert nach Board-ID, die App kennt den Slug aus der Adresse.
  const boards = (await get(token, "/boards")).boards;
  const board = (Array.isArray(boards) ? (boards as { id: string; slug: string }[]) : []).find(
    (b) => b.slug === app.boardSlug,
  );
  if (!board) throw new UserjotError(`Im Workspace gibt es kein Board "${app.boardSlug}".`);

  const q = new URLSearchParams({ limit: "100", sort: "top", board_ids: board.id });
  const rows = (await get(token, `/requests?${q}`)).requests;
  return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    status: (REQUEST_STATUSES as readonly string[]).includes(r.status as string) ? (r.status as RequestStatus) : "pending",
    votes: Number(r.vote_count ?? 0),
    comments: Number(r.comment_count ?? 0),
    createdAt: String(r.created_at ?? ""),
  }));
}
