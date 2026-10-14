// SERVER ONLY. Die Creators der Apps mit ihrem Detour-Link und wie viele
// Nutzer ihnen zugeordnet sind, fuer /admin/creators.
//
// Gelesen wird aus der Supabase der App (Eintrag in KLAR_ADMIN_APPS):
// `influencers` traegt die Creators, `referrals` je zugeordnetem Nutzer eine
// Zeile mit `influencer_handle`. Die App schreibt sie, sobald jemand, der ueber
// den Link kam, angemeldet ist (Basalt: src/services/referral.ts).
//
// Nur Apps mit Detour stehen in CREATOR_APPS, denn ohne Detour gibt es keinen
// Link, ueber den ein Creator Nutzer bringt. Kelva kommt mit einer Zeile dazu,
// sobald es Detour hat; seine `influencers` braucht dann auch `short_link`.

import { getApps, type AdminApp } from "./adminApps";

/** Slug wie in KLAR_ADMIN_APPS und der Detour-Link der App. Der Link eines
    Creators ist dieser mit `?ref=<handle>` (Basalt liest `ref`, siehe
    src/lib/detour-link.ts dort). */
export const CREATOR_APPS: { slug: string; detourLink: string }[] = [
  { slug: "wavelength", detourLink: "https://klar.godetour.link/Zjm1D8IAwV" }, // Basalt
];

export interface Creator {
  handle: string;
  name: string;
  app: string;
  status: string;
  link: string;
  shortLink: string | null;
  /** Zeilen in `referrals`, also angemeldete Nutzer, die ueber ihn kamen. */
  referrals: number;
}

export interface CreatorsResult {
  creators: Creator[];
  /** Je App, die nicht antwortet, ein Satz. Die anderen Apps erscheinen trotzdem. */
  errors: string[];
}

function headersFor(app: AdminApp): HeadersInit {
  return { apikey: app.serviceKey, Authorization: `Bearer ${app.serviceKey}`, Accept: "application/json" };
}

// Gezaehlt wird per `count=exact` statt die Zeilen zu holen: PostgREST liefert
// hoechstens 1000 Zeilen, eine Zaehlung im Code wuerde danach still kappen.
async function countReferrals(app: AdminApp, handle: string): Promise<number | null> {
  const res = await fetch(
    `${app.supabaseUrl}/rest/v1/referrals?select=id&influencer_handle=eq.${encodeURIComponent(handle)}`,
    { method: "HEAD", headers: { ...headersFor(app), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

export async function fetchCreators(): Promise<CreatorsResult> {
  const apps = getApps();
  const creators: Creator[] = [];
  const errors: string[] = [];

  await Promise.all(
    CREATOR_APPS.map(async ({ slug, detourLink }) => {
      const app = apps.find((a) => a.slug === slug);
      if (!app) {
        errors.push(`${slug}: nicht in KLAR_ADMIN_APPS verbunden.`);
        return;
      }
      try {
        const res = await fetch(
          `${app.supabaseUrl}/rest/v1/influencers?select=handle,display_name,status,short_link&order=created_at.asc`,
          { headers: headersFor(app), cache: "no-store" },
        );
        if (!res.ok) {
          errors.push(`${app.name}: influencers antwortet mit ${res.status}.`);
          return;
        }
        const rows = (await res.json()) as {
          handle: string;
          display_name: string | null;
          status: string;
          short_link: string | null;
        }[];
        const counts = await Promise.all(rows.map((r) => countReferrals(app, r.handle)));
        if (counts.includes(null)) errors.push(`${app.name}: referrals liess sich nicht zaehlen.`);
        rows.forEach((r, i) =>
          creators.push({
            handle: r.handle,
            name: r.display_name || r.handle,
            app: app.name,
            status: r.status,
            link: `${detourLink}?ref=${encodeURIComponent(r.handle)}`,
            shortLink: r.short_link,
            referrals: counts[i] ?? 0,
          }),
        );
      } catch (e) {
        errors.push(`${app.name}: ${e instanceof Error ? e.message : "keine Antwort"}.`);
      }
    }),
  );

  return { creators, errors };
}
