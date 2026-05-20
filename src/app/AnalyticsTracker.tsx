"use client";

// Privacy-friendly visitor pings to /api/track on every pathname change.
// No cookies, no IDs, no search-params, no document.title. Pathname +
// document.referrer only. Server hashes IP+UA into a daily-rotating session.
//
// sendBeacon is preferred because it survives navigation; falls back to
// keepalive fetch for browsers that don't expose it.

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== "undefined" && document.referrer
        ? document.referrer
        : undefined,
    });

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
      } else {
        void fetch("/api/track", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        });
      }
    } catch {
      // tracking is best-effort
    }
  }, [pathname]);

  return null;
}
