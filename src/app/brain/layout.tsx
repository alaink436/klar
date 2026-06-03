// Bare shell for everything under /brain. The actual auth gate + viewer
// chrome live in the (viewer) route group so the ungated sub-routes
// (login / auth/callback / logout / note) are NOT bounced by the gate.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Brain · Klar",
  description: "Eingeladener Zugang zum Klar AI-Brain.",
  robots: { index: false, follow: false },
};

export default function BrainShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily: "var(--font-body, system-ui)",
      }}
    >
      {children}
    </main>
  );
}
