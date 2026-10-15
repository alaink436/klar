"use client";

import { useEffect, useRef, useState } from "react";
import { PlaySvg } from "./StoreBadges";

// Android's counterpart to Safari's Smart App Banner, which iPhones get from the
// apple-itunes-app meta tag. The page links a manifest naming the Play app
// (related_applications, prefer_related_applications), so Chrome fires
// beforeinstallprompt; a tap on the bar then opens Play's install sheet over
// the page. Where Chrome never fires the event, the same tap opens the listing.
// Closing hides the bar for the rest of the visit.

type InstallEvent = Event & { prompt: () => Promise<void> };

export default function AndroidInstallBar({
  id, name, line, icon, playUrl,
}: { id: string; name: string; line: string; icon: string; playUrl: string }) {
  const [show, setShow] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);
  const key = `install-bar-closed:${id}`;

  useEffect(() => {
    const open = () => {
      if (!/Android/i.test(navigator.userAgent)) return;
      try {
        if (sessionStorage.getItem(key)) return;
      } catch {}
      setShow(true);
    };
    open();
    const keep = (e: Event) => { deferred.current = e as InstallEvent; };
    window.addEventListener("beforeinstallprompt", keep);
    return () => window.removeEventListener("beforeinstallprompt", keep);
  }, [key]);

  async function install() {
    const e = deferred.current;
    deferred.current = null;
    if (e) {
      try {
        await e.prompt();
        return;
      } catch {}
    }
    window.location.href = playUrl;
  }

  function close() {
    setShow(false);
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
  }

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 sm:hidden">
      <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/70 p-2.5 pr-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl backdrop-saturate-150">
        <button type="button" onClick={close} aria-label="Close" className="grid size-7 shrink-0 place-items-center text-[18px] leading-none text-[var(--ink-3)]">
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="size-11 shrink-0 rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{name}</p>
          <p className="truncate text-[12.5px] text-[var(--ink-3)]">{line}</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-[14px] font-medium text-[var(--paper)]"
        >
          <PlaySvg size={14} />
          Install
        </button>
      </div>
    </div>
  );
}
