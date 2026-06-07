// Instant navigation feedback. Next shows this the moment a menu item is
// clicked, while the (force-dynamic) target page renders on the server. Without
// it, a menu switch looked frozen until the server round-trip + Supabase queries
// finished. The skeleton reuses the real <AdminSidebar> + .layout/.main chrome so
// the frame is byte-identical to the loaded page; only the content area shimmers.
//
// Server component (no 'use client'): it just reads getApps() and renders markup.
// The big STYLE + theme scripts come from the persistent admin/layout.tsx.

import AdminSidebar from "./AdminSidebar";
import { ICON } from "./_shared";
import { getApps } from "@/lib/adminApps";

const SKEL_STYLE = `@keyframes klarSkel{0%,100%{opacity:.55}50%{opacity:.9}}
.klar-skel{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius);animation:klarSkel 1.1s ease-in-out infinite}`;

export default function AdminLoading() {
  const apps = getApps();
  const topbar = `<span class="crumb"><b>Lädt…</b></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>`;

  return (
    <div className="layout">
      <AdminSidebar active="" apps={apps} />
      <main className="main">
        <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
        <div className="content">
          <style dangerouslySetInnerHTML={{ __html: SKEL_STYLE }} />
          <div className="klar-skel" style={{ height: 46, width: "42%", marginBottom: 14 }} />
          <div className="klar-skel" style={{ height: 18, width: "62%", marginBottom: 26, opacity: 0.7 }} />
          <div className="cards">
            <div className="klar-skel" style={{ height: 98 }} />
            <div className="klar-skel" style={{ height: 98 }} />
            <div className="klar-skel" style={{ height: 98 }} />
            <div className="klar-skel" style={{ height: 98 }} />
          </div>
          <div className="klar-skel" style={{ height: 280, marginTop: 22 }} />
        </div>
      </main>
    </div>
  );
}
