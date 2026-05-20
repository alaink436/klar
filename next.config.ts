import type { NextConfig } from "next";

// Security headers applied to all routes. CSP intentionally permissive on
// script-src ('unsafe-inline' needed for the inline THEME_INIT / smoke / etc
// scripts in /admin) but tightens the rest (frame-ancestors, base-uri, etc).
// frame-src allows cal.getklar.org so the /admin?view=cal iframe works.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      // Permit embedding our own Cal.com and Brevo/Supabase POST targets
      "frame-src 'self' https://cal.getklar.org",
      "connect-src 'self' https://*.supabase.co https://api.brevo.com https://cal.getklar.org https://va.vercel-scripts.com",
      // Only Klar itself may embed Klar pages
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.supabase.co https://api.brevo.com",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // HSTS: 1 year + subdomains, eligible for HSTS preload registry
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict powerful APIs the site doesn't use
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // Browser opt-in to cross-origin isolation hints (mild, not enforced)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers site-wide
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Admin must never be cached anywhere (dynamic per-user data)
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      {
        // Service worker: scoped + never cached
        source: "/admin-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/admin" },
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
        ],
      },
      {
        // Static assets in /public/* can be cached aggressively (immutable
        // by file content; Next handles hashed routes separately).
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/screenshots/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/logo/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
