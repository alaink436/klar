"use client";

// Klar Affiliate signup: email + password. Supabase Auth sends a confirm
// link (template "Confirm signup") that lands back on /dashboard/auth/
// callback, where the route handler then links the auth.users row to
// klar_affiliates + the per-app influencer rows by email.

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
      const msg = e instanceof Error ? e.message : "Sign-up failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Sign up"
      title={<>Your <i style={{ fontFamily: "var(--font-editorial, serif)" }}>affiliate</i> account.</>}
      intro="Use the email we invited you with. We'll link your dashboard to your apps automatically."
      footer={
        <>
          Already have an account? <Link href="/dashboard/login" style={{ color: "var(--fg)", fontWeight: 600 }}>Sign in</Link>
        </>
      }
    >
      {done ? (
        <div style={successStyle}>
          A confirmation email is on its way. Click the link inside to activate your login. You can close this tab.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="signup-email" style={labelStyle}>Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="signup-password" style={labelStyle}>Password (min. 8 characters)</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Creating account…" : "Create account"}
          </button>
          <p style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, textAlign: "center" }}>
            Prefer no password? <Link href="/dashboard/magic" style={{ color: "var(--fg-2)" }}>Use a magic link instead</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
