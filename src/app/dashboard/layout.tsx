// Everything under /dashboard installs as an app (Alain 2026-10-22: "Icon auf dem Homescreen am Handy, eigenes
// Fenster am PC"): the manifest with scope /dashboard, so the front page stays a website. The service worker that
// browsers want for it is registered by InstallApp.

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  manifest: "/dashboard.webmanifest",
  appleWebApp: { capable: true, title: "Klar Studios", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ededeb" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
