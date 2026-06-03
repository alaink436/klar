// Auth gate + chrome for the invited-member AI-Brain viewer.
//
// Server component: requires a Supabase session AND an active brain_members
// row (non-revoked). No session → /brain/login. Session but no/revoked
// membership → /brain/login?error=no_access. Sibling routes (login, auth/
// callback, logout, note) sit outside this route group and handle their own
// state, so this gate only wraps the viewer itself.

import { redirect } from "next/navigation";
import { getSessionUser, isSupabaseConfigured } from "@/lib/supabaseAuth";
import { getBrainMember } from "@/lib/brainMembers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WRAP: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  background: "var(--bg)",
  color: "var(--fg)",
};

export default async function ViewerLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <div style={{ ...WRAP, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ color: "var(--fg-3)", maxWidth: 420, textAlign: "center", fontSize: 14 }}>
          Der Zugang ist noch nicht konfiguriert. Bitte später erneut versuchen.
        </p>
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user?.email) redirect("/brain/login");
  const member = await getBrainMember(user.email);
  if (!member || member.revoked_at) redirect("/brain/login?error=no_access");

  const scopeLabel =
    member.clearance === "full"
      ? "Voller Zugriff"
      : `${member.folders.length} ${member.folders.length === 1 ? "Bereich" : "Bereiche"}`;

  return (
    <div style={WRAP}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "-0.01em",
          }}
        >
          Klar
        </span>
        <span style={{ color: "var(--fg-4)" }}>/</span>
        <span style={{ color: "var(--fg-2)", fontSize: 14 }}>AI-Brain</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: "var(--fg-3)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          <span className="hidden sm:inline">{user.email}</span>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              color: member.clearance === "full" ? "#74D6C4" : "var(--fg-3)",
            }}
          >
            {scopeLabel}
          </span>
          <form action="/brain/logout" method="post" style={{ display: "inline" }}>
            <button
              type="submit"
              style={{
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--fg-2)",
                fontSize: 12,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Abmelden
            </button>
          </form>
        </span>
      </header>
      <main style={{ flex: 1, minHeight: 0, padding: 20 }}>{children}</main>
    </div>
  );
}
