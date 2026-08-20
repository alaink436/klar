// Welche Landing-Page zu welcher App gehoert.
//
// Bis 2026-08-20 wusste das niemand an einer Stelle: die Bio-Links standen im
// Vault (SOCIAL-ACCOUNTS.md), die Domains in vier fremden Repos, und das
// Dashboard zeigte gar keine. Diese Datei ist die Antwort auf "welche Seite
// bewirbt welche App", und gleichzeitig der Filter, mit dem Analytics aus
// klar_pageviews die Landing-Zeilen herausschneidet.
//
// `site` ist der Host, wie ihn /api/track aus Origin/Referer schreibt (ohne
// www.). `path` ist der exakte Pfad. Beide zusammen sind der Schluessel, denn
// /get gibt es auf zwei Domains.
//
// Eine Seite steht hier NUR, wenn sie den Beacon wirklich mitliefert. Sonst
// zeigt das Dashboard eine Null, die wie "niemand kommt" aussieht, obwohl sie
// "wir messen nicht" heisst. Siehe `tracked`.

import { findKlarApp, type KlarAppMeta } from "./klarApps";

export interface LandingMeta {
  /** Slug der App aus KLAR_APPS. */
  app: string;
  /** Host ohne Schema und ohne www., so wie er in klar_pageviews.site steht. */
  site: string;
  /** Exakter Pfad, mit fuehrendem Slash. */
  path: string;
  /** Repo, in dem der Beacon sitzt. Steht in der UI als Herkunftshinweis. */
  repo: string;
  /** false = Beacon noch nicht deployt, Zahlen sind noch keine Aussage. */
  tracked: boolean;
}

/**
 * GENAU EINE Landing pro App. Bis 2026-08-20 standen hier zwei fuer MyLoo,
 * Kelva und Basalt (Startseite neben /get, getklar.org/basalt neben
 * onwavelength.space). Das war als Kontext gedacht und las sich als Unschaerfe:
 * zwei Zahlen fuer dieselbe App, und keine davon war die Antwort. Alains
 * Entscheid: eine Adresse je App, die beworbene.
 *
 * Was dadurch wegfaellt, verschwindet nicht. Die Startseiten und
 * getklar.org/basalt werden weiter gemessen und stehen im Tab unter
 * "Andere Seiten".
 */
export const KLAR_LANDINGS: LandingMeta[] = [
  { app: "myloo", site: "myloo.org", path: "/get", repo: "myloo-web", tracked: true },

  // Bio von @kelvaapp zeigt auf /get (SOCIAL-ACCOUNTS.md, 2026-08-12).
  // ⚠️ Das Vercel-Projekt haengt nicht am Repo: der Push vom 2026-08-20 hat
  // kelva.space NICHT neu ausgeliefert, dort laeuft ein aelterer Build ohne
  // Beacon. Bis das jemand von Hand deployt, bleibt diese Zeile bei null.
  { app: "kelva", site: "kelva.space", path: "/get", repo: "kelva-web", tracked: false },

  // Basalt laeuft unter dem historischen Slug "wavelength" (siehe klarApps).
  // Die Domain traegt auch die AASA, deshalb ist sie der Landing-Entscheid.
  { app: "wavelength", site: "onwavelength.space", path: "/", repo: "wavelength-web", tracked: true },

  { app: "trubel", site: "trubel.space", path: "/", repo: "trubel-web", tracked: true },

  // Liegt auf getklar.org selbst, wird also seit jeher mitgeschrieben.
  { app: "yarn-stash", site: "getklar.org", path: "/yarnstash", repo: "klar", tracked: true },
];

export interface ResolvedLanding extends LandingMeta {
  /** "myloo.org/get": was in der UI steht und was man im Browser eintippt. */
  label: string;
  meta: KlarAppMeta | undefined;
  name: string;
  icon: string;
}

function labelFor(l: LandingMeta): string {
  return l.path === "/" ? l.site : `${l.site}${l.path}`;
}

export function resolveLanding(l: LandingMeta): ResolvedLanding {
  const meta = findKlarApp(l.app);
  return {
    ...l,
    label: labelFor(l),
    meta,
    name: meta?.name ?? l.app,
    icon: meta?.icon ?? "/logo/klar-symbol.png",
  };
}

export const RESOLVED_LANDINGS: ResolvedLanding[] = KLAR_LANDINGS.map(resolveLanding);

/** Stabiler Schluessel fuer Map-Lookups und URL-Parameter. */
export function landingKey(site: string, path: string): string {
  return `${site}${path === "/" ? "/" : path}`;
}

/**
 * Host so normalisieren, wie ihn /api/track schreibt: klein, ohne www., ohne
 * Port. Beide Seiten benutzen diese Funktion, damit der Vergleich nicht an
 * einem "www." scheitert, das nur eine der beiden Seiten kennt.
 */
export function normalizeSite(host: string): string {
  return host.toLowerCase().replace(/^www\./, "").split(":")[0];
}

/**
 * Pfad so normalisieren, dass /get, /get/ und /get?utm=... dieselbe Seite
 * sind. Query und Hash kommen ohnehin nie an (der Tracker schickt nur
 * pathname), der Trailing Slash aber schon.
 */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  if (clean === "/") return "/";
  return clean.replace(/\/+$/, "") || "/";
}

/** Findet die Landing-Definition zu einer gemessenen Zeile, sonst undefined. */
export function findLanding(site: string, path: string): ResolvedLanding | undefined {
  const s = normalizeSite(site);
  const p = normalizePath(path);
  return RESOLVED_LANDINGS.find((l) => l.site === s && normalizePath(l.path) === p);
}
