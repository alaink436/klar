// SERVER ONLY. Bio email-regex + aggregator (linktree-style) bio-link crawl.
//
// Ports klar-scraper/src/email.ts and adapts it: drop the fetchViaProxy /
// agentForSession residential-proxy plumbing (the wave runs server-side, plain
// fetch is fine) and fold in the block lists the n8n "Crawl Bio-Links For Email"
// node has that the klar-scraper port is missing (BLOCK_DOMAIN_RE additions like
// squarespace.com / cloudflare.com / cdn hosts + the aggregator hosts themselves,
// and BLOCK_PREFIX_RE additions like admin / webmaster / root + aggregator-scoped
// info@/support@). Union of both lists = strictest, which is what we want.
//
// resolveContactEmail reproduces the EXACT n8n yield order: direct email
// (business||public) -> bio regex -> aggregator crawl (only when both empty AND
// externalUrl/bioLinks[0].url is a known aggregator).

import "server-only";
import type { Dispatcher } from "undici";

// How a contact email was found — surfaced in the run/trial report so the
// operator can see WHICH source produced each hit.
export type EmailSource = "direct" | "bio" | "aggregator" | "website";

// The 16 aggregator hosts, verbatim (identical in klar-scraper email.ts + n8n).
export const AGGREGATORS = [
  "linktr.ee",
  "beacons.ai",
  "allmylinks.com",
  "bio.link",
  "lnk.bio",
  "mssg.me",
  "stan.store",
  "komi.io",
  "hoo.be",
  "snipfeed.co",
  "campsite.bio",
  "shorby.com",
  "withkoji.com",
  "flow.page",
  "taplink.cc",
  "milkshake.app",
] as const;

// Same permissive regex the n8n node + klar-scraper use on the bio text.
export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// Union of klar-scraper BLOCK_DOMAINS and the n8n Crawl-node BLOCK_DOMAIN_RE.
const BLOCK_DOMAINS: readonly string[] = [
  // klar-scraper
  "sentry.io",
  "wixpress.com",
  "example.com",
  "domain.com",
  "email.com",
  "yourdomain.com",
  "cdn.com",
  "googleusercontent.com",
  "schema.org",
  "w3.org",
  "fontawesome.com",
  "cloudfront.net",
  "gstatic.com",
  // n8n additions
  "squarespace.com",
  "cloudflare.com",
  "amazonaws.com",
  "googleapis.com",
  "jsdelivr.net",
  "unpkg.com",
  "placeholder.com",
  "example.org",
  "example.net",
  // aggregator hosts are never the creator's contact address
  ...AGGREGATORS,
];

// Union of klar-scraper BLOCK_PREFIXES and the n8n Crawl-node BLOCK_PREFIX_RE.
const BLOCK_PREFIXES: readonly string[] = [
  // klar-scraper
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "abuse",
  "support@wix",
  "privacy",
  "example",
  "you@",
  "name@",
  "your@",
  // n8n additions
  "admin",
  "webmaster",
  "hostmaster",
  "root",
  "nobody",
  "info@linktr",
  "support@linktr",
  "info@beacons",
  "support@beacons",
  "info@bio.link",
  "info@stan.store",
  "info@komi.io",
];

function isBlockedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const at = lower.indexOf("@");
  if (at < 0) return true;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (BLOCK_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return true;
  if (
    BLOCK_PREFIXES.some((p) =>
      p.includes("@") ? lower.startsWith(p) : local.startsWith(p),
    )
  ) {
    return true;
  }
  // image/asset extensions occasionally match the regex (e.g. logo@2x.png).
  if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|otf|map)$/i.test(domain)) return true;
  // n8n length guard.
  if (lower.length < 6 || lower.length > 120) return true;
  return false;
}

/** First plausible, non-blocked email in a bio string. Mirrors klar-scraper
 *  pickEmailFromBio: walk ALL matches so a leading placeholder doesn't hide a
 *  real one further in. */
export function pickEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null;
  const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bio)) !== null) {
    const cand = m[0].replace(/[.,;:]+$/, "");
    if (!isBlockedEmail(cand)) return cand;
  }
  return null;
}

/** True if url's host is one of the 16 aggregators (or a subdomain). */
export function isAggregatorUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return AGGREGATORS.some((a) => host === a || host.endsWith("." + a));
  } catch {
    return false;
  }
}

// mailto: links are the strongest signal; fall back to the bio regex over HTML.
function emailFromHtml(html: string): string | null {
  const mailto = html.match(/mailto:([\w.+-]+@[\w-]+\.[\w.-]+)/i);
  if (mailto?.[1] && !isBlockedEmail(mailto[1])) return mailto[1].toLowerCase();
  return pickEmailFromBio(html);
}

// SSRF guard for crawling arbitrary creator-site URLs: only http(s), no
// localhost/.local/.internal names, no literal private/loopback/link-local IPs.
// (No DNS resolution here — a hostname that RESOLVES to a private IP is an
// accepted residual risk; the n8n crawl had no guard at all.)
function isSafePublicUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return null;
  if (h.includes(":")) return null; // raw IPv6 literal — just block
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return null;
    }
  }
  return u;
}

// One guarded HTML fetch with manual, re-validated redirects (max 3 hops — many
// sites 3xx http->https or apex->www; each hop goes through the SSRF guard).
// `dispatcher` (an undici ProxyAgent) routes the request through the residential
// proxy; omit it for a direct fetch. `dispatcher` is a Node/undici fetch option,
// hence the cast (it's not in the standard RequestInit type).
async function fetchHtml(
  rawUrl: string,
  opts: { timeoutMs?: number; dispatcher?: Dispatcher | null } = {},
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 4500;
  let current = isSafePublicUrl(rawUrl);
  for (let hop = 0; current && hop < 4; hop++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const init: RequestInit & { dispatcher?: Dispatcher } = {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KlarBot/1.0; +https://getklar.org)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de,en;q=0.7",
        },
      };
      if (opts.dispatcher) init.dispatcher = opts.dispatcher;
      const res = await fetch(current.toString(), init);
      clearTimeout(t);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        current = loc ? isSafePublicUrl(new URL(loc, current).toString()) : null;
        continue;
      }
      if (!res.ok) return null;
      return await res.text();
    } catch {
      clearTimeout(t);
      return null;
    }
  }
  return null;
}

/** Fetch an aggregator page and scrape an email (mailto: first, then regex),
 *  applying the same block filters. null on any failure. */
export async function crawlAggregator(url: string, dispatcher?: Dispatcher | null): Promise<string | null> {
  if (!isAggregatorUrl(url)) return null;
  const html = await fetchHtml(url, { timeoutMs: 6000, dispatcher }); // n8n-parity timeout
  return html ? emailFromHtml(html) : null;
}

// Contact/imprint page names across the five outreach regions: DE/AT/CH
// (Impressumspflicht), FR (mentions légales), ES (aviso legal/contacto),
// IT (contatti), EN/universal (contact/about/legal).
const CONTACT_HREF_RE =
  /href=["']([^"'#]*(?:impressum|imprint|kontakt|contact|mentions|aviso|contatti|contacto|legal|about)[^"'#]*)["']/gi;

/** Crawl a creator's own website for a contact email: homepage first, then up
 *  to two contact-ish pages (links found on the homepage, same-origin; blind
 *  /impressum + /contact as fallback). Budget: max 3 HTML fetches à 4.5s. */
export async function crawlWebsiteForEmail(rawUrl: string, dispatcher?: Dispatcher | null): Promise<string | null> {
  const u = isSafePublicUrl(rawUrl);
  if (!u) return null;
  const home = await fetchHtml(u.toString(), { dispatcher });
  if (home) {
    const direct = emailFromHtml(home);
    if (direct) return direct;
  }
  // Candidate contact pages: prefer real links from the homepage (same-origin
  // only — a footer link to facebook.com/contact must not burn the budget).
  const candidates: string[] = [];
  if (home) {
    let m: RegExpExecArray | null;
    while ((m = CONTACT_HREF_RE.exec(home)) !== null && candidates.length < 4) {
      try {
        const link = new URL(m[1], u);
        if (link.origin === u.origin && !candidates.includes(link.toString())) {
          candidates.push(link.toString());
        }
      } catch {
        /* unparseable href */
      }
    }
  }
  if (candidates.length === 0) {
    candidates.push(new URL("/impressum", u).toString(), new URL("/contact", u).toString());
  }
  for (const c of candidates.slice(0, 2)) {
    const html = await fetchHtml(c, { dispatcher });
    if (!html) continue;
    const email = emailFromHtml(html);
    if (email) return email;
  }
  return null;
}

export interface ResolvedEmail {
  email: string | null;
  source: EmailSource | null; // null when no email found
  crawled: boolean;           // a network crawl was attempted (aggregator/website)
}

/** Resolved contact email + WHERE it came from. Order: direct (business/public)
 *  -> bio regex -> link crawl. The crawl covers BOTH aggregators (linktree & co,
 *  n8n parity) AND the creator's own website (homepage + imprint/contact pages).
 *  Crawls go through `opts.dispatcher` (residential proxy) when provided. */
export async function resolveContactEmailDetailed(
  p: {
    biography: string;
    businessEmail: string | null;
    publicEmail: string | null;
    externalUrl: string | null;
    bioLinks: { url: string }[];
  },
  opts: { dispatcher?: Dispatcher | null } = {},
): Promise<ResolvedEmail> {
  const direct = (p.businessEmail || p.publicEmail || "").trim().toLowerCase();
  if (direct && !isBlockedEmail(direct)) return { email: direct, source: "direct", crawled: false };
  const fromBio = pickEmailFromBio(p.biography);
  if (fromBio) return { email: fromBio, source: "bio", crawled: false };
  const ext = p.externalUrl || p.bioLinks?.[0]?.url || "";
  if (!ext) return { email: null, source: null, crawled: false };
  if (isAggregatorUrl(ext)) {
    const email = await crawlAggregator(ext, opts.dispatcher);
    return { email, source: email ? "aggregator" : null, crawled: true };
  }
  const email = await crawlWebsiteForEmail(ext, opts.dispatcher);
  return { email, source: email ? "website" : null, crawled: true };
}

/** Backwards-compatible thin wrapper (email only). */
export async function resolveContactEmail(p: {
  biography: string;
  businessEmail: string | null;
  publicEmail: string | null;
  externalUrl: string | null;
  bioLinks: { url: string }[];
}): Promise<string | null> {
  return (await resolveContactEmailDetailed(p)).email;
}
