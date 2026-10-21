// SERVER ONLY. The creator kit: formats Alain rotates in Klar Control and the
// versions creators get (migrations/0046, spec Projects/Klar/specs/
// creator-plattform, ticket 03).
//
// At most MAX_ACTIVE formats per app are on. The versions are rendered by the
// routine Projects/Klar/creator-kit/refill.mjs in the vault and sit in the
// private bucket creator-kit; a creator is handed one per active format by
// klar_assign_variants the first time his dashboard asks, and keeps it. A
// format that is switched off disappears from every kit at once.

import "server-only";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const BUCKET = "creator-kit";
const URL_TTL = 3600;

export const MAX_ACTIVE = 5;

export interface FormatConfig {
  slides: number;
  hooks?: string[];
  tones?: string[];
  shuffle?: [number, number];
  query?: Record<string, string[]>;
}

export interface FormatOverview {
  id: string;
  appSlug: string;
  name: string;
  caption: string;
  active: boolean;
  pool: number;
  assigned: number;
  /** How many versions can look different at all; the pool can never grow past it. */
  looks: number;
  preview: string[]; // signed URLs of one version, slide order
}

export interface KitSlide {
  view: string;
  download: string;
}

export interface KitEntry {
  formatId: string;
  name: string;
  caption: string;
  slides: KitSlide[];
}

function headers(extra?: HeadersInit): HeadersInit {
  return { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}`, "Content-Type": "application/json", ...extra };
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/** Distinct looks a config allows: hooks x tones x orders x query values. */
export function possibleLooks(c: FormatConfig): number {
  const orders = c.shuffle ? factorial(c.shuffle[1] - c.shuffle[0] + 1) : 1;
  const query = Object.values(c.query ?? {}).reduce((n, vals) => n * vals.length, 1);
  return (c.hooks?.length ?? 1) * (c.tones?.length ?? 1) * orders * query;
}

/** Signed URLs for paths in the bucket, in the same order; the download variant
    makes the browser save the file instead of opening it. */
async function signPaths(paths: string[], downloadName?: (path: string, i: number) => string): Promise<KitSlide[]> {
  if (paths.length === 0) return [];
  const res = await fetch(`${HUB}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ expiresIn: URL_TTL, paths }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ path: string; signedURL: string | null }>;
  const byPath = new Map(rows.map((r) => [r.path, r.signedURL]));
  return paths.flatMap((p, i) => {
    const signed = byPath.get(p);
    if (!signed) return [];
    const view = `${HUB}/storage/v1${signed}`;
    const name = downloadName ? downloadName(p, i) : p.split("/").pop()!;
    return [{ view, download: `${view}&download=${encodeURIComponent(name)}` }];
  });
}

interface FormatRow {
  id: string;
  app_slug: string;
  name: string;
  caption: string;
  active: boolean;
  config: FormatConfig;
  created_at: string;
}

interface VariantRow {
  id: string;
  format_id: string;
  images: string[];
  creator_id: string | null;
}

export async function listFormats(): Promise<FormatOverview[]> {
  const [fRes, vRes] = await Promise.all([
    fetch(`${HUB}/rest/v1/klar_formats?select=*&order=active.desc,created_at,id`, { headers: headers(), cache: "no-store" }),
    fetch(`${HUB}/rest/v1/klar_format_variants?select=id,format_id,images,creator_id&order=created_at.desc`, {
      headers: headers(),
      cache: "no-store",
    }),
  ]);
  if (!fRes.ok || !vRes.ok) return [];
  const formats = (await fRes.json()) as FormatRow[];
  const variants = (await vRes.json()) as VariantRow[];
  return Promise.all(
    formats.map(async (f) => {
      const own = variants.filter((v) => v.format_id === f.id);
      const sample = own.find((v) => !v.creator_id) ?? own[0];
      return {
        id: f.id,
        appSlug: f.app_slug,
        name: f.name,
        caption: f.caption,
        active: f.active,
        pool: own.filter((v) => !v.creator_id).length,
        assigned: own.filter((v) => v.creator_id).length,
        looks: possibleLooks(f.config),
        preview: sample ? (await signPaths(sample.images)).map((s) => s.view) : [],
      };
    }),
  );
}

export type FormatWrite = { ok: true; msg: string } | { ok: false; msg: string };

export async function setFormatActive(id: string, active: boolean): Promise<FormatWrite> {
  const res = await fetch(`${HUB}/rest/v1/klar_formats?select=id,app_slug,active,name`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return { ok: false, msg: `Formate nicht lesbar (${res.status}).` };
  const all = (await res.json()) as Array<{ id: string; app_slug: string; active: boolean; name: string }>;
  const format = all.find((f) => f.id === id);
  if (!format) return { ok: false, msg: "Dieses Format gibt es nicht." };
  if (active && !format.active && all.filter((f) => f.app_slug === format.app_slug && f.active).length >= MAX_ACTIVE) {
    return { ok: false, msg: `Schon ${MAX_ACTIVE} Formate an. Erst eines ausschalten.` };
  }
  const upd = await fetch(`${HUB}/rest/v1/klar_formats?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ active }),
    cache: "no-store",
  });
  if (!upd.ok) return { ok: false, msg: `Nicht gespeichert (${upd.status}).` };
  return { ok: true, msg: `${format.name} ist ${active ? "an" : "aus"}.` };
}

/** The creator's versions of all active formats, handing out missing ones from the pool. */
export async function getCreatorKit(creatorId: string): Promise<{ kit: KitEntry[]; waiting: string[] }> {
  const [vRes, fRes] = await Promise.all([
    fetch(`${HUB}/rest/v1/rpc/klar_assign_variants`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_creator: creatorId }),
      cache: "no-store",
    }),
    fetch(`${HUB}/rest/v1/klar_formats?active=eq.true&select=*&order=created_at,id`, { headers: headers(), cache: "no-store" }),
  ]);
  if (!vRes.ok || !fRes.ok) return { kit: [], waiting: [] };
  const variants = (await vRes.json()) as VariantRow[];
  const formats = (await fRes.json()) as FormatRow[];
  const kit: KitEntry[] = [];
  const waiting: string[] = [];
  for (const f of formats) {
    const v = variants.find((x) => x.format_id === f.id);
    if (!v) {
      waiting.push(f.name); // the pool ran dry; the routine refills it
      continue;
    }
    kit.push({
      formatId: f.id,
      name: f.name,
      caption: f.caption,
      slides: await signPaths(v.images, (_, i) => `basalt-${f.id}-${i + 1}.jpg`),
    });
  }
  return { kit, waiting };
}
