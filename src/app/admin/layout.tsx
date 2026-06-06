// Shared admin chrome. The smoke background is hoisted here (out of every page)
// so its WebGL loop mounts ONCE and survives client-side menu switches. Per-page
// inline scripts do NOT re-run on SPA navigation, so the per-page canvas used to
// go blank after the first switch (and leak a zombie rAF loop). A layout persists
// across /admin/* navigations, so the canvas + loop stay alive.
//
// STYLE / fonts / theme-init stay per-page on purpose: they're harmless to repeat
// and moving them would touch every page's imports. With SPA view transitions off
// (see _shared STYLE) there's no FOUC on navigation.

import type { ReactNode } from "react";
import { SMOKE_BG_SCRIPT } from "./_shared";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      {children}
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
