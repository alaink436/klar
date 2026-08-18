// SERVER ONLY. Collab-Postfach: öffentliche per-App Mail-Adressen (stehen z.B.
// in den TikTok-Bios der App-Kanäle, "animevault@reply.getklar.org"). Eingehende
// Mails routet /api/inbound/brevo per RECIPIENT-Alias hierher; die Inbox zeigt
// sie als eigene Konversationen (kind 'collab'), geantwortet wird über
// /admin/collab/reply mit replyTo auf dieselbe Alias-Adresse.
//
// Tabelle `klar_collab_messages` (Migration 0013) im Klar-Hub-Supabase
// (anime-vault, exiuwektrqxvycclqfdd). Ein Thread = (app, contact_email);
// gruppiert wird beim Lesen, wie beim Outreach-Mail-Client.
//
// Neue Adresse anlegen = eine Zeile in COLLAB_ALIASES. DNS/Brevo brauchen
// nichts Neues: der Inbound-Parse auf KLAR_INBOUND_DOMAIN fängt bereits alle
// local parts der Domain; zusätzliche Domains via KLAR_COLLAB_DOMAINS (CSV).
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

// ── Alias map ───────────────────────────────────────────────────────────────
// local part → app. Mehrere Aliasse dürfen auf dieselbe App zeigen; `name`
// deckt Apps ab, die nicht in KLAR_APPS stehen (AnimeVault hat kein
// Affiliate-Schema, braucht aber trotzdem ein Postfach).

export interface CollabAliasMeta {
  app: string;
  name: string;
}

export const COLLAB_ALIASES: Record<string, CollabAliasMeta> = {
  animevault: { app: "animevault", name: "AnimeVault" },
  trubel: { app: "trubel", name: "Trubel" },
  myloo: { app: "myloo", name: "MyLoo" },
  // slug stays "wavelength" (it is the affiliate key); "wavelength" and "thinq"
  // stay as aliases so older mails still route to the right app.
  basalt: { app: "wavelength", name: "Basalt" },
  wavelength: { app: "wavelength", name: "Basalt" },
  thinq: { app: "wavelength", name: "Basalt" },
  yarnstash: { app: "yarn-stash", name: "Yarn-Stash" },
  kelva: { app: "kelva", name: "Kelva" },
  throttleup: { app: "moto", name: "ThrottleUp" },
  moto: { app: "moto", name: "ThrottleUp" },
  promillo: { app: "promillio", name: "Promillo" },
  promillio: { app: "promillio", name: "Promillo" },
  collab: { app: "studio", name: "Klar" },
};

/** Domains, deren Aliasse als Collab-Adressen gelten: die Outreach-Inbound-
 *  Domain plus optionale weitere (KLAR_COLLAB_DOMAINS, kommasepariert). */
export function collabDomains(): string[] {
  const out: string[] = [];
  const inbound = (process.env.KLAR_INBOUND_DOMAIN ?? "").trim().toLowerCase();
  if (inbound) out.push(inbound);
  for (const d of (process.env.KLAR_COLLAB_DOMAINS ?? "").split(",")) {
    const clean = d.trim().toLowerCase();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

export interface CollabRoute {
  alias: string;
  app: string;
  name: string;
  /** Kanonische Adresse des Postfachs, z.B. animevault@reply.getklar.org. */
  address: string;
}

/** Ordnet eine Empfänger-Adresse einem Collab-Postfach zu. Fail-closed: ohne
 *  konfigurierte Domain oder ohne Alias-Treffer → null (Outreach-Matching
 *  bleibt dann zuständig). */
export function collabRouteForRecipient(address: string): CollabRoute | null {
  const [localRaw, domainRaw] = address.trim().toLowerCase().split("@");
  if (!localRaw || !domainRaw) return null;
  const domains = collabDomains();
  if (!domains.includes(domainRaw)) return null;
  // reply+<uuid> u.ä. gehören dem Outreach-Matching; ein Plus-Suffix auf einem
  // Alias (animevault+tiktok@) zählt trotzdem zum Alias.
  const [local = "", suffix = ""] = localRaw.split("+");
  const meta = COLLAB_ALIASES[local];
  if (!meta) return null;
  // Auf der ALLGEMEINEN Adresse ordnet ein App-Suffix deterministisch zu:
  // collab+myloo@… landet als MyLoo-Thread (alias myloo → Reply kommt von
  // myloo@…). Unbekannte Suffixe (collab+tiktok@) bleiben beim Studio-Postfach.
  if (meta.app === "studio" && suffix && COLLAB_ALIASES[suffix]) {
    const sub = COLLAB_ALIASES[suffix];
    return { alias: suffix, app: sub.app, name: sub.name, address: `${suffix}@${domainRaw}` };
  }
  return { alias: local, app: meta.app, name: meta.name, address: `${local}@${domainRaw}` };
}

// ── App-Erkennung für die allgemeine Adresse ────────────────────────────────
// Wer an collab@… schreibt, nennt die App meist im Text ("wegen MyLoo", "your
// app Trubel"). Ein Wort-Treffer pro App reicht; bei Treffern für MEHRERE Apps
// bleibt die Mail beim Studio-Postfach (ambig → nicht raten). Gleiche Idee wie
// detectApp im Content-Dashboard, hier persistiert der Webhook das Ergebnis.

const APP_TEXT_PATTERNS: { app: string; re: RegExp }[] = [
  { app: "animevault", re: /anime[\s-]?vault/i },
  { app: "trubel", re: /\btrubel\b/i },
  { app: "myloo", re: /my[\s-]?loo\b/i },
  { app: "wavelength", re: /\bwavelength\b|\bthinq\b/i },
  { app: "yarn-stash", re: /yarn[\s-]?stash/i },
  { app: "kelva", re: /\bkelva\b/i },
  { app: "moto", re: /throttle[\s-]?up\b/i },
  { app: "promillio", re: /\bpromill?i?o\b/i },
];

/** App aus Mail-Text (Betreff + Body) erkennen. Genau 1 App erwähnt → deren
 *  Slug, sonst null (bleibt Studio/„Klar"). */
export function detectCollabApp(text: string): string | null {
  const hits = new Set<string>();
  for (const p of APP_TEXT_PATTERNS) {
    if (p.re.test(text)) hits.add(p.app);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

/** Kanonische Absende-/Reply-Adresse für ein Alias (erste Collab-Domain). */
export function collabAddressFor(alias: string): string | null {
  const domain = collabDomains()[0];
  if (!domain || !COLLAB_ALIASES[alias]) return null;
  return `${alias}@${domain}`;
}

/** Ein Eintrag pro App für Auswahl-Listen (Alias-Map hat mehrere Aliasse je
 *  App). Anders als collabAliasRows ohne Adress-Zwang: das manuelle Erfassen
 *  eines Instagram-DMs braucht keine konfigurierte Inbound-Domain. */
export function collabAppOptions(): { alias: string; app: string; name: string }[] {
  const seen = new Set<string>();
  const out: { alias: string; app: string; name: string }[] = [];
  for (const [alias, meta] of Object.entries(COLLAB_ALIASES)) {
    if (seen.has(meta.app)) continue;
    seen.add(meta.app);
    out.push({ alias, app: meta.app, name: meta.name });
  }
  out.sort((a, b) => (a.app === "studio" ? -1 : b.app === "studio" ? 1 : a.name.localeCompare(b.name)));
  return out;
}

// ── Kanäle ──────────────────────────────────────────────────────────────────
// Bis 2026-08-18 war jede Zeile hier eine Mail an eine Bio-Adresse. Manuell
// erfasste Gespräche laufen oft über DMs; `channel` hält fest, worüber geredet
// wurde, `contact_handle` mit wem (bei Mail bleibt contact_email die Identität).

export const COLLAB_CHANNELS = ["email", "instagram", "tiktok", "youtube", "x", "other"] as const;
export type CollabChannel = (typeof COLLAB_CHANNELS)[number];

export const COLLAB_CHANNEL_LABELS: Record<CollabChannel, string> = {
  email: "E-Mail",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  other: "Sonstiges",
};

export function isCollabChannel(v: string): v is CollabChannel {
  return (COLLAB_CHANNELS as readonly string[]).includes(v);
}

/** Thread-Schlüssel (= Spalte contact_email). Mail-Threads tragen die Adresse,
 *  DM-Threads den synthetischen Schlüssel '<channel>:<handle>' — bewusst keine
 *  gültige Mailadresse, damit die Reply-Route sie ablehnt statt ins Leere zu
 *  senden. Handle ohne führendes @ und klein, sonst wird aus @Marie und marie
 *  zweimal derselbe Mensch. */
export function collabContactKey(channel: CollabChannel, handleOrEmail: string): string {
  const clean = handleOrEmail.trim().replace(/^@/, "").toLowerCase();
  return channel === "email" ? clean : `${channel}:${clean}`;
}

/** true, wenn der Thread-Key eine echte Mailadresse ist (nur dann kann aus der
 *  Inbox heraus geantwortet werden). */
export function isEmailContactKey(key: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
}

// ── Store ───────────────────────────────────────────────────────────────────

export interface CollabMessage {
  id: string;
  app: string;
  alias: string;
  contact_email: string;
  contact_name: string | null;
  direction: "in" | "out";
  subject: string | null;
  body: string;
  provider: string | null;
  external_id: string | null;
  spam_score: number | null;
  sent_at: string | null;
  created_at: string;
  channel: CollabChannel;
  contact_handle: string | null;
  manual: boolean;
}

export interface InsertCollabMessageInput {
  app: string;
  alias: string;
  contact_email: string;
  contact_name?: string | null;
  direction: "in" | "out";
  subject?: string | null;
  body?: string;
  provider?: string | null;
  external_id?: string | null;
  spam_score?: number | null;
  sent_at?: string | null;
  channel?: CollabChannel;
  contact_handle?: string | null;
  manual?: boolean;
  /** Nur für manuelle Nachträge: das Gespräch fand früher statt als der
   *  Eintrag. Ohne Wert setzt Postgres now(). */
  created_at?: string | null;
}

/** Append one message. Best-effort: a 409 (duplicate external_id from a
 *  webhook retry) resolves to null instead of throwing. */
export async function insertCollabMessage(
  input: InsertCollabMessageInput,
): Promise<CollabMessage | null> {
  if (!KLAR_INBOX_KEY) return null;
  const body: Record<string, unknown> = {
    app: input.app,
    alias: input.alias,
    contact_email: input.contact_email.trim().toLowerCase(),
    contact_name: input.contact_name ?? null,
    direction: input.direction,
    subject: input.subject ?? null,
    body: input.body ?? "",
    provider: input.provider ?? null,
    external_id: input.external_id ?? null,
    spam_score: input.spam_score ?? null,
    sent_at: input.sent_at ?? null,
    channel: input.channel ?? "email",
    contact_handle: input.contact_handle ?? null,
    manual: input.manual ?? false,
  };
  // created_at nur mitschicken, wenn es gesetzt ist — sonst gewinnt der
  // Default now() (ein explizites null würde die NOT-NULL-Spalte sprengen).
  if (input.created_at) body.created_at = input.created_at;
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_collab_messages`, {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) return null; // dedupe on external_id, already stored
    if (!res.ok) return null;
    const rows = (await res.json()) as CollabMessage[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export interface CollabThread {
  app: string;
  alias: string;
  address: string | null;
  /** Thread-Key: Mailadresse oder '<channel>:<handle>' (siehe collabContactKey). */
  contactEmail: string;
  contactName: string | null;
  /** Kanal des Threads (aus der ersten Nachricht; ein Thread = ein Kanal). */
  channel: CollabChannel;
  contactHandle: string | null;
  /** true, wenn keine einzige Nachricht des Threads über Mail lief. */
  manualOnly: boolean;
  messages: CollabMessage[]; // oldest first
  lastActivityAt: string | null;
}

/** Alle Collab-Threads, jüngste Aktivität zuerst. Gruppiert die letzten
 *  `limit` Nachrichten nach (app, contact_email). Fail-soft zu [].
 *
 *  `revalidateSeconds` opts into Next's data cache — only for read-only
 *  consumers like the sidebar badge that run on every page render. The page
 *  itself stays no-store so a fresh reply is visible immediately. */
export async function listCollabThreads(
  limit = 800,
  opts?: { revalidateSeconds?: number },
): Promise<CollabThread[]> {
  if (!KLAR_INBOX_KEY) return [];
  try {
    const cacheOpts =
      typeof opts?.revalidateSeconds === "number"
        ? { next: { revalidate: opts.revalidateSeconds } }
        : { cache: "no-store" as const };
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_collab_messages?select=*&order=created_at.desc&limit=${limit}`,
      { headers: hdr(), ...cacheOpts },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as CollabMessage[];
    const byThread = new Map<string, CollabMessage[]>();
    for (const m of rows) {
      const key = `${m.app}\u0000${m.contact_email}`;
      const arr = byThread.get(key);
      if (arr) arr.push(m);
      else byThread.set(key, [m]);
    }
    const threads: CollabThread[] = [];
    for (const msgs of byThread.values()) {
      msgs.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const first = msgs[0];
      const named = [...msgs].reverse().find((m) => m.contact_name);
      const handled = [...msgs].reverse().find((m) => m.contact_handle);
      threads.push({
        app: first.app,
        alias: first.alias,
        address: collabAddressFor(first.alias),
        contactEmail: first.contact_email,
        contactName: named?.contact_name ?? null,
        // Zeilen von vor Migration 0025 haben kein channel → 'email'.
        channel: first.channel ?? "email",
        contactHandle: handled?.contact_handle ?? null,
        manualOnly: msgs.every((m) => m.manual),
        messages: msgs,
        lastActivityAt: msgs[msgs.length - 1]?.created_at ?? null,
      });
    }
    threads.sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""));
    return threads;
  } catch {
    return [];
  }
}
