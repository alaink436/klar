"use client";

// Magic-link fallback for the "forgot password" + "signed up via the
// confirmation email" cases. Supabase sends a one-time link, the user
// clicks it, lands on /dashboard/auth/callback which exchanges the code
// for a session and redirects to /dashboard.

import { useState } from "react";
import Link from "next/link";
import { AuthShell, inputStyle, labelStyle, buttonStyle, errorStyle, successStyle } from "../_shared/auth-shell";
import { getBrowserSupabase } from "../_shared/supabase-browser";

export function MagicForm() {
  const [email, setEmail] = useState("");
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
      const { error: err } = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't send the magic link.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Affiliate · Magic link"
      title={<>Sign in without a <i style={{ fontFamily: "var(--font-editorial, serif)" }}>password.</i></>}
      intro="Enter your affiliate email and we'll send you a one-time login link. Valid for one hour."
      footer={
        <>
          Prefer a password? <Link href="/dashboard/login" style={{ color: "var(--fg)", fontWeight: 600 }}>Sign in</Link>
        </>
      }
    >
      {done ? (
        <div style={successStyle}>
          Magic link sent. Check your inbox (and spam folder). The link works once and expires in 60 minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="magic-email" style={labelStyle}>Email</label>
            <input
              id="magic-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Sending link…" : "Send magic link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
