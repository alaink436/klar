// SERVER ONLY. Die UserJot-Boards der Apps: Wuensche, Stimmen und Stand, gelesen
// ueber die UserJot-API (api.userjot.com/v1). Basalt hat sein eigenes Board
// ("what i want next") am 2026-10-22 gegen UserJot getauscht; lib/board bleibt,
// weil "Neu in Basalt" weiter feature_ideas liest.
//
// Der API-Token liegt im Vault: Provider "userjot", Label mit dem App-Namen. Er
// wird nur hier entschluesselt und geht nie an den Browser. Die API haengt am
// UserJot-Plan (Fehler plan_feature_unavailable mit api_access): dann zeigt die
// Seite diesen Grund statt einer leeren Liste.

import { listSecrets, revealSecret } from "./vault";

export interface UserjotApp {
  /** In der Adresse: /admin/feedback/userjot?app=<slug>. */
  slug: string;
  name: string;
  /** Das oeffentliche Board, wie die App es oeffnet (Basalt: BOARD_URL in lib/legal). */
  boardUrl: string;
}

export const USERJOT_APPS: UserjotApp[] = [{ slug: "basalt", name: "Basalt", boardUrl: "https://basalt.userjot.com" }];

export function findUserjotApp(slug: string | null | undefined): UserjotApp | null {
  return USERJOT_APPS.find((a) => a.slug === slug) ?? null;
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
  board: string;
  votes: number;
  comments: number;
  createdAt: string;
}

export class UserjotError extends Error {}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Was die Seite sagt, wenn UserJot ablehnt. Eigene Funktion, damit der Test sie ohne Netz pruefen kann. */
export function errorText(status: number, body: unknown): string {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (error?.code === "plan_feature_unavailable") {
    return "Der UserJot-Plan hat keinen API-Zugang. Nach einem Upgrade füllt sich diese Seite von selbst.";
  }
  if (status === 401) return "UserJot lehnt den Token ab. Im Vault neu eintragen.";
  return typeof error?.message === "string" ? error.message : `UserJot antwortet ${status}.`;
}

/** Die 100 Wuensche mit den meisten Stimmen, wie UserJot sie sortiert. */
export async function fetchRequests(app: UserjotApp): Promise<UserjotRequest[]> {
  const secret = (await listSecrets()).find(
    (s) => !s.revoked_at && s.provider.toLowerCase() === "userjot" && norm(s.label).includes(norm(app.name)),
  );
  const token = secret ? await revealSecret(secret.id) : null;
  if (!token) throw new UserjotError(`Kein UserJot-Token im Vault (Provider "userjot", Label mit "${app.name}").`);

  const res = await fetch("https://api.userjot.com/v1/requests?limit=100&sort=top", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new UserjotError(errorText(res.status, j));

  const rows = Array.isArray(j?.requests) ? (j.requests as Record<string, unknown>[]) : [];
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    status: (REQUEST_STATUSES as readonly string[]).includes(r.status as string) ? (r.status as RequestStatus) : "pending",
    board: String((r.board as { name?: unknown } | null)?.name ?? ""),
    votes: Number(r.vote_count ?? 0),
    comments: Number(r.comment_count ?? 0),
    createdAt: String(r.created_at ?? ""),
  }));
}
