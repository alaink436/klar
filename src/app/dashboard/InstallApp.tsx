"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { card } from "../components/home/formStyles";

// The dashboard as an app (Alain 2026-10-22: "Icon auf dem Homescreen am Handy, eigenes Fenster am PC, mit einem Knopf
// zum Installieren im Dashboard"). Chrome and Edge, on a phone and on a computer, hand over their install dialog
// through beforeinstallprompt, so the button opens it. An iPhone has no such dialog: there the button shows how to add
// the page in Safari. Nothing shows inside the installed app or in a browser that can't install; "Not now" hides it in
// this browser. Also registers the service worker those browsers want before they offer the install.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const HIDDEN = "dashboard-install-hidden";

export default function InstallApp({ variant }: { variant: "side" | "bar" }) {
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const [help, setHelp] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    navigator.serviceWorker?.register("/dashboard-sw.js", { scope: "/dashboard" }).catch(() => {});
    const keep = (e: Event) => {
      e.preventDefault(); // our button instead of Chrome's own bar
      deferred.current = e as InstallEvent;
      setMode("prompt");
    };
    const installed = () => setMode("none");
    const start = () => {
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      let hidden = false;
      try {
        hidden = !!localStorage.getItem(HIDDEN);
      } catch {}
      if (standalone || hidden) return false;
      // iPadOS reports itself as a Mac; the touch points give it away.
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) setMode("ios");
      return true;
    };
    if (!start()) return;
    addEventListener("beforeinstallprompt", keep);
    addEventListener("appinstalled", installed);
    return () => {
      removeEventListener("beforeinstallprompt", keep);
      removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (mode === "ios") return setHelp((h) => !h);
    const e = deferred.current;
    deferred.current = null;
    setMode("none"); // the event works once; Chrome sends a new one when it would offer the install again
    if (e) await e.prompt();
  }

  function later() {
    try {
      localStorage.setItem(HIDDEN, "1");
    } catch {}
    setMode("none");
  }

  if (mode === "none") return null;
  const icon = (
    // eslint-disable-next-line @next/next/no-img-element -- the app icon as it lands on the home screen
    <img src="/logo/klar-maskable-512.png" alt="" className="size-10 shrink-0 rounded-[11px] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]" />
  );
  const howTo = help && (
    <p className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
      Open this page in Safari, tap Share and choose &ldquo;Add to Home Screen&rdquo;. Inside TikTok&apos;s browser this
      doesn&apos;t work, open Safari first.
    </p>
  );
  const button = (
    <button
      type="button"
      onClick={install}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-4 text-[13.5px] font-medium text-[var(--paper)] transition hover:opacity-85"
    >
      <Download className="size-4" strokeWidth={1.9} />
      {mode === "ios" ? "How to install" : "Install app"}
    </button>
  );
  const notNow = (
    <button type="button" onClick={later} className="text-[12.5px] font-medium text-[var(--ink-3)] transition hover:text-[var(--ink)]">
      Not now
    </button>
  );

  if (variant === "side") {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium leading-snug">Klar Studios app</p>
            <p className="text-[12.5px] leading-snug text-[var(--ink-3)]">Your dashboard in its own window.</p>
          </div>
        </div>
        <div className="mt-3 grid">{button}</div>
        {howTo}
        <div className="mt-2 text-center">{notNow}</div>
      </div>
    );
  }
  return (
    <div className={`${card} mt-8 p-4! md:hidden`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-snug">Get the app</p>
          <p className="text-[13px] leading-snug text-[var(--ink-3)]">Klar Studios on your home screen.</p>
        </div>
        {button}
      </div>
      {howTo}
      <div className="mt-2 text-right">{notNow}</div>
    </div>
  );
}
