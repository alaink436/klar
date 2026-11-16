"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Live (Alain, 2026-11-16: "das ist ein live sync"): the page asks the server again every five minutes, as long as it is open. */
export function LiveRefresh({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5 * 60_000);
    return () => clearInterval(timer);
  }, [router]);
  const time = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date(at));
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg-3">
      <span className="size-1.5 rounded-full bg-[var(--st-posted)]" aria-hidden />
      Live, Stand {time}
    </span>
  );
}
