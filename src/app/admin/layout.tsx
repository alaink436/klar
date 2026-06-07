// Shared admin chrome. Everything that is identical on every /admin page lives
// here ONCE and persists across client-side menu switches:
//   - fonts + the big STYLE constant + theme init/toggle scripts + glass defs
//   - the smoke-bg canvas (its WebGL loop mounts once, survives SPA nav)
//   - the confirm modal HTML + script
// Previously each page re-injected the multi-KB inline <style> on every menu
// switch, which is what made navigation flicker/feel slow (and forced SPA view
// transitions to be disabled). Hoisting it here means a menu switch only swaps
// the page content, not the whole stylesheet. Pages now render only <title> +
// their own content (and any page-specific extra <style>, e.g. settings).

import type { ReactNode } from "react";
import {
  STYLE,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  MODAL_HTML,
  MODAL_SCRIPT,
} from "./_shared";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      {children}
      {/* Confirm dialog hoisted here so it survives client-side menu switches.
          MODAL_SCRIPT runs once on first load and keeps a MutationObserver on
          <body>, so it auto-binds any data-klar-confirm form a SPA-navigated
          page renders later. Per-page injection was removed from outreach +
          [app] to avoid a duplicate #klar-modal id. */}
      <div dangerouslySetInnerHTML={{ __html: MODAL_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: MODAL_SCRIPT }} />
    </>
  );
}
