// SERVER ONLY. Apps und ihre Creators, fuer /admin/creators und die Kurzlinks
// getklar.org/<short_path>/<handle>.
//
// Beides liegt in der Klar-Hub-Supabase (`klar_creator_apps`,
// `klar_creator_links`, migrations/0042). Gezaehlt wird in der App selbst:
// `referrals` traegt je zugeordnetem Nutzer eine Zeile mit `influencer_handle`,
// die App schreibt sie, sobald jemand, der ueber den Link kam, angemeldet ist
// (Basalt: src/services/referral.ts). Gezaehlt wird nur bei Apps mit Detour und
// mit einem Eintrag in KLAR_ADMIN_APPS (`backend_slug`), denn nur dort kommt ein
// Handle ueberhaupt an.
//
// Ohne Detour fuehrt der Kurzlink in den Store und zaehlt nichts. Wer einen
// Detour-Link eintraegt, schaltet die Zaehlung fuer alle Creators der App ein.
//
// Entfernen setzt `removed_at`: der Kurzlink geht nicht mehr, wer ueber ihn kam,
// bleibt ihm zugeordnet, und erneutes Anlegen holt dieselbe Zeile zurueck.
// Basalts alte Tabelle `influencers` wird seit 2026-10-14 nicht mehr geschrieben.

import { getApps, type AdminApp } from "./adminApps";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const SITE = "https://getklar.org";

/** Was die Apps als Handle annehmen (Basalt: src/lib/detour-link.ts). */
const HANDLE_RE = /^[a-z0-9_.-]{1,32}$/;
const SHORT_PATH_RE = /^[a-z0-9-]{2,24}$/;
/** Unterseiten der App-Seiten auf getklar.org, die einen Kurzlink verdecken wuerden. */
const RESERVED_HANDLES = new Set(["privacy", "terms"]);
/** Ordner unter src/app, die keine App sind, und `learnbound`, dessen
    `[...path]` alle Unterpfade als Universal Links faengt. */
const RESERVED_PATHS = new Set([
  "admin", "api", "brain", "components", "data", "delete-account", "i", "log", "os", "success", "support",
  "learnbound",
]);

/** Wie viele Zuordnungen die Nutzerliste zeigt. Gezaehlt wird trotzdem alles. */
export const USER_LIST_LIMIT = 200;

export interface CreatorApp {
  slug: string;
  name: string;
  shortPath: string;
  detourLink: string | null;
  storeUrl: string | null;
  backendSlug: string | null;
  /** Aktive Creators dieser App. */
  creators: number;
}

export interface Creator {
  appSlug: string;
  appName: string;
  handle: string;
  name: string;
  /** Detour-Link mit `?ref=`, oder null, solange die App kein Detour hat. */
  link: string | null;
  shortLink: string;
  /** Zeilen in `referrals`, oder null, wo nicht gezaehlt wird. */
  referrals: number | null;
}

export interface CreatorUser {
  creator: string;
  app: string;
  name: string;
  assignedAt: string;
  pro: boolean;
}

export interface CreatorsResult {
  apps: CreatorApp[];
  creators: Creator[];
  /** Die neuesten Zuordnungen ueber alle Creators, hoechstens USER_LIST_LIMIT. */
  users: CreatorUser[];
  /** Je Quelle, die nicht antwortet, ein Satz. Der Rest erscheint trotzdem. */
  errors: string[];
}

type AppRow = {
  slug: string;
  name: string;
  short_path: string;
  detour_link: string | null;
  store_url: string | null;
  backend_slug: string | null;
};
type LinkRow = { app_slug: string; handle: string; name: string };

function hub(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${HUB}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: HUB_KEY(),
      Authorization: `Bearer ${HUB_KEY()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

function appDb(app: AdminApp, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${app.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: app.serviceKey, Authorization: `Bearer ${app.serviceKey}`, Accept: "application/json", ...init.headers },
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
  const res = await appDb(app, `referrals?select=id&influencer_handle=eq.${encodeURIComponent(handle)}`, {
    method: "HEAD",
    headers: { Prefer: "count=exact" },
  });
  if (!res.ok) return null;
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

function counted(app: AppRow, backends: AdminApp[]): AdminApp | null {
  if (!app.detour_link || !app.backend_slug) return null;
  return backends.find((b) => b.slug === app.backend_slug) ?? null;
}

export async function fetchCreators(): Promise<CreatorsResult> {
  const errors: string[] = [];
  if (!HUB_KEY()) return { apps: [], creators: [], users: [], errors: ["KLAR_INBOX_SERVICE_KEY fehlt."] };

  const [appsRes, linksRes] = await Promise.all([
    hub("klar_creator_apps?select=slug,name,short_path,detour_link,store_url,backend_slug&order=name.asc"),
    hub("klar_creator_links?select=app_slug,handle,name&removed_at=is.null&order=created_at.asc"),
  ]);
  if (!appsRes.ok || !linksRes.ok) {
    return { apps: [], creators: [], users: [], errors: [`Klar-Datenbank antwortet mit ${appsRes.status}/${linksRes.status}.`] };
  }
  const appRows = (await appsRes.json()) as AppRow[];
  const links = (await linksRes.json()) as LinkRow[];
  const backends = getApps();

  const creators: Creator[] = [];
  const users: CreatorUser[] = [];

  await Promise.all(
    appRows.map(async (a) => {
      const mine = links.filter((l) => l.app_slug === a.slug);
      const backend = counted(a, backends);
      const counts = backend ? await Promise.all(mine.map((l) => countReferrals(backend, l.handle))) : [];
      if (backend && counts.includes(null)) errors.push(`${a.name}: referrals liess sich nicht zaehlen.`);
      mine.forEach((l, i) =>
        creators.push({
          appSlug: a.slug,
          appName: a.name,
          handle: l.handle,
          name: l.name,
          link: a.detour_link ? `${a.detour_link}?ref=${encodeURIComponent(l.handle)}` : null,
          shortLink: `${SITE}/${a.short_path}/${l.handle}`,
          referrals: backend ? (counts[i] ?? 0) : null,
        }),
      );
      if (!backend || mine.length === 0) return;

      try {
        const names = new Map(mine.map((l) => [l.handle, l.name]));
        const refRes = await appDb(
          backend,
          `referrals?select=user_id,influencer_handle,created_at&influencer_handle=in.${inList(mine.map((l) => l.handle))}` +
            `&order=created_at.desc&limit=${USER_LIST_LIMIT}`,
        );
        if (!refRes.ok) {
          errors.push(`${a.name}: referrals antwortet mit ${refRes.status}.`);
          return;
        }
        const refs = (await refRes.json()) as { user_id: string; influencer_handle: string; created_at: string }[];
        if (refs.length === 0) return;
        const profRes = await appDb(backend, `profiles?select=id,display_name,is_pro&id=in.${inList(refs.map((r) => r.user_id))}`);
        if (!profRes.ok) errors.push(`${a.name}: profiles antwortet mit ${profRes.status}.`);
        const profiles = new Map(
          profRes.ok
            ? ((await profRes.json()) as { id: string; display_name: string | null; is_pro: boolean | null }[]).map((p) => [p.id, p])
            : [],
        );
        for (const r of refs) {
          const p = profiles.get(r.user_id);
          users.push({
            creator: names.get(r.influencer_handle) ?? r.influencer_handle,
            app: a.name,
            name: p?.display_name || "ohne Namen",
            assignedAt: r.created_at,
            pro: p?.is_pro === true,
          });
        }
      } catch (e) {
        errors.push(`${a.name}: ${e instanceof Error ? e.message : "keine Antwort"}.`);
      }
    }),
  );

  const apps: CreatorApp[] = appRows.map((a) => ({
    slug: a.slug,
    name: a.name,
    shortPath: a.short_path,
    detourLink: a.detour_link,
    storeUrl: a.store_url,
    backendSlug: a.backend_slug,
    creators: links.filter((l) => l.app_slug === a.slug).length,
  }));
  const order = new Map(appRows.map((a, i) => [a.slug, i]));
  creators.sort((x, y) => (order.get(x.appSlug) ?? 0) - (order.get(y.appSlug) ?? 0));
  users.sort((x, y) => y.assignedAt.localeCompare(x.assignedAt));
  return { apps, creators, users: users.slice(0, USER_LIST_LIMIT), errors };
}

// Apps with a page getklar.org/<shortPath> (components/landing/AppLanding).
const LANDING_PAGES = new Set(["basalt", "yarnstash", "kelva", "pocketmate", "animevault"]);

export type LinkDevice = "ios" | "android" | "desktop";

export function linkDevice(userAgent: string): LinkDevice {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return /Android/i.test(userAgent) ? "android" : "desktop";
}

/**
 * Ziel des Kurzlinks getklar.org/<shortPath>/<handle>. `null` heisst: diesen
 * Kurzpfad gibt es nicht (404).
 *
 * Auf dem Handy geht ein bekannter Creator ueber Detour (`?ref=`), sonst in den
 * Store. Am Computer und auf Android ohne Detour geht es auf die Seite der App
 * (`?ref=` fuer einen bekannten Creator), wo es eine gibt: Detour kann eine
 * Installation vom Computer ohnehin nicht zuordnen, und Android bekommt dort den
 * Play-Knopf statt des App-Store-Links (Alain, 2026-10-15). Ohne Seite und ohne
 * Store fuehrt der Link auf die Startseite.
 */
export async function creatorRedirect(
  shortPath: string,
  rawHandle: string,
  device: LinkDevice = "desktop",
): Promise<string | null> {
  if (!HUB_KEY() || !SHORT_PATH_RE.test(shortPath)) return null;
  const handle = rawHandle.trim().toLowerCase();
  try {
    const res = await hub(
      `klar_creator_apps?select=slug,detour_link,store_url&short_path=eq.${encodeURIComponent(shortPath)}&limit=1`,
    );
    if (!res.ok) return null;
    const [app] = (await res.json()) as { slug: string; detour_link: string | null; store_url: string | null }[];
    if (!app) return null;
    const page = LANDING_PAGES.has(shortPath) ? `${SITE}/${shortPath}` : null;
    const toPage = page && device !== "ios";
    const fallback = (toPage ? page : app.store_url) ?? page ?? `${SITE}/`;
    if (!HANDLE_RE.test(handle)) return fallback;
    const linkRes = await hub(
      `klar_creator_links?select=handle&app_slug=eq.${encodeURIComponent(app.slug)}&handle=eq.${encodeURIComponent(handle)}&removed_at=is.null&limit=1`,
    );
    const found = linkRes.ok && ((await linkRes.json()) as unknown[]).length > 0;
    if (!found) return fallback;
    const ref = `?ref=${encodeURIComponent(handle)}`;
    if (app.detour_link && device !== "desktop") return `${app.detour_link}${ref}`;
    return toPage ? `${page}${ref}` : fallback;
  } catch {
    return null;
  }
}

export type CreatorWrite = { ok: true; msg: string } | { ok: false; msg: string };

function cleanUrl(raw: string): string | null | false {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString().replace(/\?$/, "") : false;
  } catch {
    return false;
  }
}

async function appBySlug(slug: string): Promise<AppRow | null> {
  const res = await hub(`klar_creator_apps?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!res.ok) return null;
  const [row] = (await res.json()) as AppRow[];
  return row ?? null;
}

export async function addCreator(appSlug: string, rawName: string, rawHandle: string): Promise<CreatorWrite> {
  const app = await appBySlug(appSlug);
  if (!app) return { ok: false, msg: "Diese App gibt es nicht." };
  const handle = rawHandle.trim().toLowerCase().replace(/^@/, "");
  const name = rawName.trim().slice(0, 80) || handle;
  if (!HANDLE_RE.test(handle)) return { ok: false, msg: "Handle: nur a-z, 0-9, Punkt, Strich, Unterstrich, höchstens 32 Zeichen." };
  if (RESERVED_HANDLES.has(handle)) return { ok: false, msg: `"${handle}" ist eine Seite auf getklar.org und geht nicht als Handle.` };
  const res = await hub("klar_creator_links?on_conflict=app_slug,handle", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ app_slug: app.slug, handle, name, removed_at: null }),
  });
  if (!res.ok) return { ok: false, msg: `Nicht angelegt (${res.status}).` };
  const hinweis = app.detour_link ? "" : " Zählt erst, wenn die App Detour hat.";
  return { ok: true, msg: `${name} angelegt: ${SITE}/${app.short_path}/${handle}.${hinweis}` };
}

export async function removeCreator(appSlug: string, handle: string): Promise<CreatorWrite> {
  const res = await hub(
    `klar_creator_links?app_slug=eq.${encodeURIComponent(appSlug)}&handle=eq.${encodeURIComponent(handle)}&removed_at=is.null`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ removed_at: new Date().toISOString() }) },
  );
  if (!res.ok) return { ok: false, msg: `Nicht entfernt (${res.status}).` };
  if (((await res.json()) as unknown[]).length === 0) return { ok: false, msg: `${handle} gibt es nicht.` };
  return { ok: true, msg: `${handle} entfernt. Der Kurzlink geht nicht mehr.` };
}

export async function saveApp(f: {
  slug?: string;
  name: string;
  shortPath?: string;
  detourLink: string;
  storeUrl: string;
}): Promise<CreatorWrite> {
  const name = f.name.trim().slice(0, 60);
  if (!name) return { ok: false, msg: "Name fehlt." };
  const detour = cleanUrl(f.detourLink);
  const store = cleanUrl(f.storeUrl);
  if (detour === false || store === false) return { ok: false, msg: "Links müssen mit https:// beginnen." };

  if (f.slug) {
    const res = await hub(`klar_creator_apps?slug=eq.${encodeURIComponent(f.slug)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, detour_link: detour, store_url: store }),
    });
    if (!res.ok || ((await res.json()) as unknown[]).length === 0) return { ok: false, msg: `Nicht gespeichert (${res.status}).` };
    return { ok: true, msg: `${name} gespeichert.${detour ? "" : " Ohne Detour zählen ihre Creators nichts."}` };
  }

  const shortPath = (f.shortPath ?? "").trim().toLowerCase();
  if (!SHORT_PATH_RE.test(shortPath)) return { ok: false, msg: "Kürzel: 2 bis 24 Zeichen, nur a-z, 0-9 und Strich." };
  if (RESERVED_PATHS.has(shortPath)) return { ok: false, msg: `"${shortPath}" ist schon eine Seite auf getklar.org.` };
  const res = await hub("klar_creator_apps", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ slug: shortPath, name, short_path: shortPath, detour_link: detour, store_url: store }),
  });
  if (res.status === 409) return { ok: false, msg: `Das Kürzel "${shortPath}" ist schon vergeben.` };
  if (!res.ok) return { ok: false, msg: `Nicht angelegt (${res.status}).` };
  return { ok: true, msg: `${name} angelegt. Kurzlinks: ${SITE}/${shortPath}/<handle>` };
}

/** Nur ohne aktive Creators. Entfernte Creators der App gehen mit. */
export async function removeApp(slug: string): Promise<CreatorWrite> {
  const active = await hub(`klar_creator_links?select=handle&app_slug=eq.${encodeURIComponent(slug)}&removed_at=is.null&limit=1`);
  if (!active.ok) return { ok: false, msg: `Nicht entfernt (${active.status}).` };
  if (((await active.json()) as unknown[]).length > 0) return { ok: false, msg: "Die App hat noch Creators. Erst diese entfernen." };
  const del = await hub(`klar_creator_links?app_slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (!del.ok) return { ok: false, msg: `Nicht entfernt (${del.status}).` };
  const res = await hub(`klar_creator_apps?slug=eq.${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  if (!res.ok || ((await res.json()) as unknown[]).length === 0) return { ok: false, msg: `Nicht entfernt (${res.status}).` };
  return { ok: true, msg: "App entfernt." };
}
