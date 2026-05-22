"use client";

// Email + password login. On success Supabase writes the session cookie via
// the SSR adapter (configured in middleware + lib/supabaseAuth) and we hard
// navigate to /dashboard so the server-side data fetch runs.

import { useState } from "react";
import Link from "next/link";
import { AuthShell, inputStyle, labelStyle, buttonStyle, errorStyle } from "../_shared/auth-shell";
import { getBrowserSupabase } from "../_shared/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const { error: err } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) throw new Error(err.message);
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login fehlgeschlagen.";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Login"
      title={<>Willkommen <i style={{ fontFamily: "var(--font-editorial, serif)" }}>zurück.</i></>}
      intro="Logge dich mit deiner Affiliate-E-Mail ein. Vergessen? Nimm den Magic-Link statt Passwort."
      footer={
        <>
          Noch kein Konto? <Link href="/dashboard/signup" style={{ color: "var(--fg)", fontWeight: 600 }}>Konto erstellen</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="login-email" style={labelStyle}>E-Mail</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="login-password" style={labelStyle}>Passwort</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Logge ein…" : "Einloggen"}
        </button>
        <p style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, textAlign: "center" }}>
          Kein Passwort mehr? <Link href="/dashboard/magic" style={{ color: "var(--fg-2)" }}>Magic-Link</Link>
        </p>
      </form>
    </AuthShell>
  );
}
