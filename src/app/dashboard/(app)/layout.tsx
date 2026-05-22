// Authenticated dashboard shell: sidebar with Klar wordmark + 4 nav items,
// main content area to the right. Route group "(app)" so the sidebar only
// wraps /dashboard pages that require a session — /dashboard/login,
// /signup, /magic, /auth/callback, /logout keep the bare AuthShell layout.
//
// Server component for the auth gate (session check + redirect), then it
// delegates the actual rendering to the client-side <Sidebar /> which can
// read the live pathname for nav-item highlighting.

import { redirect } from "next/navigation";
import { getSessionUser, isSupabaseConfigured } from "@/lib/supabaseAuth";
import { Sidebar } from "./_shared/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <>{children}</>; // page renders its own empty-state
  }
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 240px) 1fr",
        minHeight: "100dvh",
        gap: 0,
      }}
    >
      <Sidebar email={user.email ?? ""} />
      <main style={{ padding: "32px 32px 80px", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
