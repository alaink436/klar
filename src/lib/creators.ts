// SERVER ONLY. Die Creators der Apps mit Detour, fuer /admin/creators und die
// Kurzlinks getklar.org/<app>/<handle>.
//
// Gelesen und geschrieben wird in der Supabase der App (Eintrag in
// KLAR_ADMIN_APPS): `influencers` traegt die Creators, `referrals` je
// zugeordnetem Nutzer eine Zeile mit `influencer_handle`. Die App schreibt sie,
// sobald jemand, der ueber den Link kam, angemeldet ist (Basalt:
// src/services/referral.ts).
//
// Entfernen setzt `status = 'terminated'` statt die Zeile zu loeschen: der
// Kurzlink geht dann nicht mehr, die Nutzer bleiben ihm zugeordnet, und wer ihn
// wieder anlegt, bekommt dieselbe Zeile zurueck.
//
// Nur Apps mit Detour stehen in CREATOR_APPS, denn ohne Detour gibt es keinen
// Link, ueber den ein Creator Nutzer bringt. Kelva kommt mit einer Zeile dazu,
// sobald es Detour hat, dazu ein Ordner src/app/<shortPath>/[handle].

import { getApps, type AdminApp } from "./adminApps";

export interface CreatorApp {
  /** Slug wie in KLAR_ADMIN_APPS. */
  slug: string;
  /** Der Detour-Link der App; der Link eines Creators ist er mit `?ref=<handle>`. */
  detourLink: string;
  /** getklar.org/<shortPath>/<handle> leitet auf den Detour-Link weiter. */
  shortPath: string;
}

export const CREATOR_APPS: CreatorApp[] = [
  { slug: "wavelength", detourLink: "https://klar.godetour.link/Zjm1D8IAwV", shortPath: "basalt" }, // Basalt
];

const SITE = "https://getklar.org";

/** Was die App als Handle annimmt (Basalt: src/lib/detour-link.ts). */
const HANDLE_RE = /^[a-z0-9_.-]{1,32}$/;
/** Echte Unterseiten unter getklar.org/basalt, die einen Kurzlink verdecken wuerden. */
const RESERVED = new Set(["privacy", "terms"]);

/** Wie viele Zuordnungen die Nutzerliste zeigt. Gezaehlt wird trotzdem alles. */
export const USER_LIST_LIMIT = 200;

export interface Creator {
  appSlug: string;
  appName: string;
  handle: string;
  name: string;
  status: string;
  link: string;
  shortLink: string;
  /** Zeilen in `referrals`, also angemeldete Nutzer, die ueber ihn kamen. */
  referrals: number;
}

export interface CreatorUser {
  creator: string;
  name: string;
  assignedAt: string;
  pro: boolean;
}

export interface CreatorsResult {
  creators: Creator[];
  /** Die neuesten Zuordnungen ueber alle Creators, hoechstens USER_LIST_LIMIT. */
  users: CreatorUser[];
  /** Je App, die nicht antwortet, ein Satz. Die anderen Apps erscheinen trotzdem. */
  errors: string[];
}

function rest(app: AdminApp, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${app.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: app.serviceKey,
      Authorization: `Bearer ${app.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

/** PostgREST-Liste fuer `in.(...)`, jeder Wert in Anfuehrungszeichen (Punkte im Handle). */
function inList(values: string[]): string {
  return encodeURIComponent(`(${values.map((v) => `"${v}"`).join(",")})`);
}

// Gezaehlt wird per `count=exact` statt die Zeilen zu holen: PostgREST liefert
// hoechstens 1000 Zeilen, eine Zaehlung im Code wuerde danach still kappen.
async function countReferrals(app: AdminApp, handle: string): Promise<number | null> {
  const res = await rest(app, `referrals?select=id&influencer_handle=eq.${encodeURIComponent(handle)}`, {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  });
  if (!res.ok) return null;
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

function appFor(slug: string): { cfg: CreatorApp; app: AdminApp } | null {
  const cfg = CREATOR_APPS.find((c) => c.slug === slug);
  const app = getApps().find((a) => a.slug === slug);
  return cfg && app ? { cfg, app } : null;
}

export async function fetchCreators(): Promise<CreatorsResult> {
  const apps = getApps();
  const creators: Creator[] = [];
  const users: CreatorUser[] = [];
  const errors: string[] = [];

  await Promise.all(
    CREATOR_APPS.map(async (cfg) => {
      const app = apps.find((a) => a.slug === cfg.slug);
      if (!app) {
        errors.push(`${cfg.slug}: nicht in KLAR_ADMIN_APPS verbunden.`);
        return;
      }
      try {
        const res = await rest(
          app,
          "influencers?select=handle,display_name,status&status=neq.terminated&order=created_at.asc",
        );
        if (!res.ok) {
          errors.push(`${app.name}: influencers antwortet mit ${res.status}.`);
          return;
        }
        const rows = (await res.json()) as { handle: string; display_name: string | null; status: string }[];
        const counts = await Promise.all(rows.map((r) => countReferrals(app, r.handle)));
        if (counts.includes(null)) errors.push(`${app.name}: referrals liess sich nicht zaehlen.`);
        const names = new Map(rows.map((r) => [r.handle, r.display_name || r.handle]));
        rows.forEach((r, i) =>
          creators.push({
            appSlug: cfg.slug,
            appName: app.name,
            handle: r.handle,
            name: names.get(r.handle)!,
            status: r.status,
            link: `${cfg.detourLink}?ref=${encodeURIComponent(r.handle)}`,
            shortLink: `${SITE}/${cfg.shortPath}/${r.handle}`,
            referrals: counts[i] ?? 0,
          }),
        );
        if (rows.length === 0) return;

        const refRes = await rest(
          app,
          `referrals?select=user_id,influencer_handle,created_at&influencer_handle=in.${inList(rows.map((r) => r.handle))}` +
            `&order=created_at.desc&limit=${USER_LIST_LIMIT}`,
        );
        if (!refRes.ok) {
          errors.push(`${app.name}: referrals antwortet mit ${refRes.status}.`);
          return;
        }
        const refs = (await refRes.json()) as { user_id: string; influencer_handle: string; created_at: string }[];
        if (refs.length === 0) return;
        const profRes = await rest(app, `profiles?select=id,display_name,is_pro&id=in.${inList(refs.map((r) => r.user_id))}`);
        if (!profRes.ok) errors.push(`${app.name}: profiles antwortet mit ${profRes.status}.`);
        const profiles = profRes.ok
          ? new Map(
              ((await profRes.json()) as { id: string; display_name: string | null; is_pro: boolean | null }[]).map(
                (p) => [p.id, p],
              ),
            )
          : new Map();
        for (const r of refs) {
          const p = profiles.get(r.user_id);
          users.push({
            creator: names.get(r.influencer_handle) ?? r.influencer_handle,
            name: p?.display_name || "ohne Namen",
            assignedAt: r.created_at,
            pro: p?.is_pro === true,
          });
        }
      } catch (e) {
        errors.push(`${app.name}: ${e instanceof Error ? e.message : "keine Antwort"}.`);
      }
    }),
  );

  users.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  return { creators, users: users.slice(0, USER_LIST_LIMIT), errors };
}

/** Ziel des Kurzlinks getklar.org/<shortPath>/<handle>, oder null, wenn es den Creator nicht (mehr) gibt. */
export async function creatorRedirect(shortPath: string, rawHandle: string): Promise<string | null> {
  const cfg = CREATOR_APPS.find((c) => c.shortPath === shortPath);
  const handle = rawHandle.trim().toLowerCase();
  if (!cfg || !HANDLE_RE.test(handle)) return null;
  const found = appFor(cfg.slug);
  if (!found) return null;
  try {
    const res = await rest(
      found.app,
      `influencers?select=handle&handle=eq.${encodeURIComponent(handle)}&status=neq.terminated&limit=1`,
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as unknown[];
    return rows.length ? `${cfg.detourLink}?ref=${encodeURIComponent(handle)}` : null;
  } catch {
    return null;
  }
}

export type CreatorWrite = { ok: true; msg: string } | { ok: false; msg: string };

export async function addCreator(slug: string, rawName: string, rawHandle: string): Promise<CreatorWrite> {
  const found = appFor(slug);
  if (!found) return { ok: false, msg: `${slug} ist nicht verbunden.` };
  const handle = rawHandle.trim().toLowerCase().replace(/^@/, "");
  const name = rawName.trim().slice(0, 80);
  if (!HANDLE_RE.test(handle)) return { ok: false, msg: "Handle: nur a-z, 0-9, Punkt, Strich, Unterstrich, höchstens 32 Zeichen." };
  if (RESERVED.has(handle)) return { ok: false, msg: `"${handle}" ist eine Seite auf getklar.org und geht nicht als Handle.` };
  // Gibt es den Handle schon (auch entfernt), wird er wieder aktiv; Anteil und
  // Laufzeit bleiben, wie sie waren, weil sie hier nicht mitgeschickt werden.
  const res = await rest(found.app, "influencers?on_conflict=handle", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      handle,
      display_name: name || handle,
      status: "active",
      app: slug,
      activated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) return { ok: false, msg: `Nicht angelegt (${res.status}).` };
  return { ok: true, msg: `${name || handle} angelegt: ${SITE}/${found.cfg.shortPath}/${handle}` };
}

export async function removeCreator(slug: string, handle: string): Promise<CreatorWrite> {
  const found = appFor(slug);
  if (!found) return { ok: false, msg: `${slug} ist nicht verbunden.` };
  const res = await rest(found.app, `influencers?handle=eq.${encodeURIComponent(handle)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "terminated" }),
  });
  if (!res.ok) return { ok: false, msg: `Nicht entfernt (${res.status}).` };
  const rows = (await res.json()) as unknown[];
  if (rows.length === 0) return { ok: false, msg: `${handle} gibt es nicht.` };
  return { ok: true, msg: `${handle} entfernt. Der Kurzlink geht nicht mehr.` };
}
