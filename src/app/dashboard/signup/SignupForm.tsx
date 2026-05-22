"use client";

// Klar Affiliate signup: email + password. Supabase Auth sends a confirm
// link (template "Confirm signup") that lands back on /dashboard/auth/
// callback, where the route handler then links the auth.users row to
// klar_affiliates + the per-app influencer rows by email.
//
// Two error paths to surface clearly:
//   - already-registered email → suggest Login or Magic-Link
//   - email not in any klar_affiliates / influencers table → user typed
//     a different email than the one we onboarded them under. Tell them
//     to use the email from their confirmation email.

import { useState } from "react";
import Link from "next/link";
import { AuthShell, inputStyle, labelStyle, buttonStyle, errorStyle, successStyle } from "../_shared/auth-shell";
import { getBrowserSupabase } from "../_shared/supabase-browser";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const redirectTo = `${window.location.origin}/dashboard/auth/callback`;
      const { error: err } = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Signup fehlgeschlagen.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Konto erstellen"
      title={<>Dein <i style={{ fontFamily: "var(--font-editorial, serif)" }}>Affiliate-Account.</i></>}
      intro="Gib die E-Mail an mit der wir dich ins Programm eingeladen haben. Wir verknüpfen den Account automatisch mit deinen Apps."
      footer={
        <>
          Schon ein Konto? <Link href="/dashboard/login" style={{ color: "var(--fg)", fontWeight: 600 }}>Einloggen</Link>
        </>
      }
    >
      {done ? (
        <div style={successStyle}>
          E-Mail zur Bestätigung ist unterwegs. Klick den Link in der Mail um den Login zu aktivieren. Du kannst dieses Fenster schließen.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="signup-email" style={labelStyle}>E-Mail</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="nina@example.com"
            />
          </div>
          <div>
            <label htmlFor="signup-password" style={labelStyle}>Passwort (min. 8 Zeichen)</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Erstelle Konto…" : "Konto erstellen"}
          </button>
          <p style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, textAlign: "center" }}>
            Lieber ohne Passwort? <Link href="/dashboard/magic" style={{ color: "var(--fg-2)" }}>Magic-Link per E-Mail</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
