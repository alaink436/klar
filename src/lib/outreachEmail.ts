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

/** Fetch an aggregator page and scrape an email (mailto: first, then regex),
 *  applying the same block filters. 6s timeout (matches n8n). null on any failure. */
export async function crawlAggregator(url: string): Promise<string | null> {
  if (!isAggregatorUrl(url)) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000); // n8n parity
  let html: string;
  try {
    const res = await fetch(url, {
      method: "GET",
      // SSRF guard: do NOT follow redirects. The initial URL is allowlist-checked
      // (isAggregatorUrl), but a user-controlled aggregator page could 3xx to an
      // internal/metadata target; redirect:"manual" surfaces 3xx as a non-ok
      // response which we treat as a miss below.
      redirect: "manual",
      signal: ac.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KlarBot/1.0; +https://getklar.org)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de,en;q=0.7",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    clearTimeout(t);
    return null;
  }
  // mailto: links are the strongest signal; check them first.
  const mailto = html.match(/mailto:([\w.+-]+@[\w-]+\.[\w.-]+)/i);
  if (mailto?.[1] && !isBlockedEmail(mailto[1])) return mailto[1].toLowerCase();
  return pickEmailFromBio(html);
}

/** The exact n8n Crawl-node trigger + write-back, generalised. Given an enriched
 *  profile, returns the resolved contact email or null. Order: business/public ->
 *  bio-regex -> aggregator crawl. Same yield as the live workflow. */
export async function resolveContactEmail(p: {
  biography: string;
  businessEmail: string | null;
  publicEmail: string | null;
  externalUrl: string | null;
  bioLinks: { url: string }[];
}): Promise<string | null> {
  const direct = (p.businessEmail || p.publicEmail || "").trim().toLowerCase();
  if (direct && !isBlockedEmail(direct)) return direct;
  const fromBio = pickEmailFromBio(p.biography);
  if (fromBio) return fromBio;
  // n8n trigger: only crawl when no direct + no bio email AND ext is an aggregator.
  const ext = p.externalUrl || p.bioLinks?.[0]?.url || "";
  if (ext && isAggregatorUrl(ext)) return crawlAggregator(ext);
  return null;
}
