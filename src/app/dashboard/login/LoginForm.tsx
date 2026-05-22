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
      const msg = e instanceof Error ? e.message : "Login failed.";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Log in"
      title={<>Welcome <i style={{ fontFamily: "var(--font-editorial, serif)" }}>back.</i></>}
      intro="Sign in with the email we onboarded you with. Forgot your password? Use the magic link instead."
      footer={
        <>
          New here? <Link href="/dashboard/signup" style={{ color: "var(--fg)", fontWeight: 600 }}>Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label htmlFor="login-email" style={labelStyle}>Email</label>
          <input
            id="login-email"
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
          <label htmlFor="login-password" style={labelStyle}>Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="••••••••"
          />
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ fontSize: 12, color: "var(--fg-3)", margin: 0, textAlign: "center" }}>
          Forgot your password? <Link href="/dashboard/magic" style={{ color: "var(--fg-2)" }}>Get a magic link</Link>
        </p>
      </form>
    </AuthShell>
  );
}
