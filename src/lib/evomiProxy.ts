// SERVER ONLY. Evomi residential-proxy dispatcher for the email crawls.
//
// Link aggregators (linktr.ee & co) and some creator sites block datacenter /
// cloud IPs — a crawl from a Vercel function gets a 403 or a JS challenge. Routing
// those crawls through Evomi's Core-Residential proxy makes them look like normal
// home traffic, lifting the block. The proxy credentials are NOT static: the
// Evomi Public API (api.evomi.com/public, products.rpc) returns the current
// username/password/endpoint/ports, which we turn into an undici ProxyAgent and
// pass as the `dispatcher` of individual fetch() calls (so ONLY the crawls go
// through the proxy — Apify/Evomi/Supabase calls stay direct).
//
// Bandwidth is metered (the user's plan has a fixed MB balance), so we only ever
// route HTML document fetches, never assets. Cached 5 min. Fail-soft: if the key
// or API is unavailable the crawls fall back to direct fetch (still works for
// sites that don't block cloud IPs).
import "server-only";
import { ProxyAgent } from "undici";
import { getForProxy } from "./vault";

const EVOMI_PUBLIC_ID = "29ea867a-7887-4e78-b395-38561707bf97"; // "Evomi Public API"
const EVOMI_PUBLIC_URL = "https://api.evomi.com/public";

interface EvomiProductRpc {
  username?: string;
  password?: string;
  endpoint?: string;
  balance_mb?: number;
  ports?: { http?: number; socks5?: number };
}

export interface EvomiProxyInfo {
  /** undici dispatcher to pass as fetch's `dispatcher`, or null if unavailable. */
  dispatcher: ProxyAgent | null;
  /** remaining Core-Residential bandwidth in MB (for the billing card). */
  balanceMb: number | null;
  /** host:port actually used, for the run/report breakdown. */
  endpoint: string | null;
}

let _cache: { info: EvomiProxyInfo; at: number } | null = null;

/** Build (or reuse) the residential-proxy dispatcher. Never throws. */
export async function getEvomiProxy(): Promise<EvomiProxyInfo> {
  if (_cache && Date.now() - _cache.at < 300_000) return _cache.info;
  const empty: EvomiProxyInfo = { dispatcher: null, balanceMb: null, endpoint: null };
  try {
    const routing = await getForProxy(EVOMI_PUBLIC_ID, { touch: false });
    if (!routing) {
      _cache = { info: empty, at: Date.now() };
      return empty;
    }
    // Public API: x-apikey header. getForProxy gives us the decrypted key.
    const res = await fetch(EVOMI_PUBLIC_URL, {
      headers: { [routing.authHeader || "x-apikey"]: routing.key },
      cache: "no-store",
    });
    if (!res.ok) {
      _cache = { info: empty, at: Date.now() };
      return empty;
    }
    const json = (await res.json()) as { products?: { rpc?: EvomiProductRpc } };
    const rpc = json?.products?.rpc;
    const port = rpc?.ports?.http;
    if (!rpc?.username || !rpc?.password || !rpc?.endpoint || !port) {
      _cache = { info: empty, at: Date.now() };
      return empty;
    }
    const proxyUrl = `http://${encodeURIComponent(rpc.username)}:${encodeURIComponent(rpc.password)}@${rpc.endpoint}:${port}`;
    const info: EvomiProxyInfo = {
      dispatcher: new ProxyAgent(proxyUrl),
      balanceMb: typeof rpc.balance_mb === "number" ? Math.round(rpc.balance_mb * 10) / 10 : null,
      endpoint: `${rpc.endpoint}:${port}`,
    };
    _cache = { info, at: Date.now() };
    return info;
  } catch {
    _cache = { info: empty, at: Date.now() };
    return empty;
  }
}

/** Read-only residential bandwidth balance for the billing card (no dispatcher
 *  build). Returns null when the key/API is unavailable. */
export async function getEvomiProxyBalanceMb(): Promise<number | null> {
  const info = await getEvomiProxy();
  return info.balanceMb;
}
