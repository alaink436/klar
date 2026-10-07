// SERVER ONLY. Reads the rehydration JSON a public TikTok profile page embeds.
// lib/contentWarmup fetches the page through the Evomi realtime scraper and
// pulls the native post count out of this JSON.

import "server-only";

// We extract the JSON from the <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"> tag
// WITHOUT cheerio (no DOM dep in the route) via a tolerant regex, then JSON.parse.
export function extractUniversalData(html: string): unknown | null {
  const m = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}
