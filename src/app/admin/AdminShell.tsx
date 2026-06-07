"use client";

// Persistent admin shell. Lives in admin/layout.tsx so the sidebar + .layout/.main
// frame mount ONCE and stay put across client-side menu switches — only the page
// content (children) is swapped. This is what makes navigation feel instant.
//
// Login is the one /admin route without the rail: there we render children bare.
// The active nav item is derived from the pathname (client) since the layout is
// shared across all pages.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";

function activeFromPath(path: string): string {
  // /admin/<seg>/... -> "<seg>"; bare /admin or /admin/ -> "overview".
  const seg = path.replace(/^\/admin\/?/, "").split("/")[0];
  return seg || "overview";
}

export default function AdminShell({
  apps,
  children,
}: {
  apps: { slug: string; name: string }[];
  children: ReactNode;
}) {
  const path = usePathname() || "/admin";

  // Login has no sidebar — render its centered card on its own.
  if (path === "/admin/login") return <>{children}</>;

  return (
    <div className="layout">
      <AdminSidebar active={activeFromPath(path)} apps={apps} />
      <main className="main">{children}</main>
    </div>
  );
}
