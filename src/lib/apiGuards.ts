// Lightweight defence-in-depth for public POST routes:
//   - origin/referer check (best-effort CSRF-style guard)
//   - per-IP in-memory rate-limit (per-lambda-instance, not cluster-wide,
//     but stops the obvious cheap-flood case before it hits Supabase)
//   - byte-cap on the raw body via Content-Length
//
// Vercel sits in front and handles real DDoS; this is just so a single
// abusive client can't burn through Supabase row-quota or function CPU.

// Production + preview origins we accept POSTs from. Any localhost / 127.0.0.1
// port is also accepted (dev servers, MCP previews pick random ports).
// Sister-app origins are listed so /api/affiliate/complete can be called
// cross-origin from the per-app onboarding pages (wavelength-web etc.).
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://getklar.org",
  "https://www.getklar.org",
  "https://klar-five.vercel.app",
  "https://onwavelength.space",
  "https://www.onwavelength.space",
  "https://kelva.space",
  "https://www.kelva.space",
  "https://trubel.space",
  "https://www.trubel.space",
  "https://myloo.org",
  "https://www.myloo.org",
]);

function isAllowedOriginString(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    // Vercel preview deployments: any *.vercel.app subdomain
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app"))
      return true;
  } catch {
    /* fallthrough */
  }
  return false;
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return isAllowedOriginString(origin);
  // Some legitimate clients (older browsers, sendBeacon in a few cases) omit
  // Origin but still send Referer. Accept if Referer matches an allowed
  // origin; reject if neither header is present at all.
  const ref = req.headers.get("referer");
  if (!ref) return false;
  try {
    return isAllowedOriginString(new URL(ref).origin);
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "0.0.0.0";
}

export function exceedsContentLength(req: Request, maxBytes: number): boolean {
  const raw = req.headers.get("content-length");
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

// Per-IP token-bucket-ish counter. Stored in a Map keyed by `${bucket}|${ip}`.
// Each entry is { count, resetAt }; once resetAt passes, the entry is reset.
// Pruned opportunistically when the map grows past a soft ceiling.
interface Slot {
  count: number;
  resetAt: number;
}
const BUCKETS = new Map<string, Slot>();
const MAX_ENTRIES = 5000;

function prune(now: number): void {
  if (BUCKETS.size < MAX_ENTRIES) return;
  for (const [k, s] of BUCKETS) {
    if (s.resetAt <= now) BUCKETS.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  bucket: string,
  ip: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const key = `${bucket}|${ip}`;
  const cur = BUCKETS.get(key);
  if (!cur || cur.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (cur.count >= max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }
  cur.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}
