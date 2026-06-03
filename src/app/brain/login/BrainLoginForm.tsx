"use client";

// Magic-link sign-in for invited AI-Brain members. Mirrors the dashboard
// MagicForm: signInWithOtp with shouldCreateUser:false, so only emails that
// an admin has already provisioned (via the brain-invite flow, which creates
// the auth.users row) can request a link. The email link lands on
// /brain/auth/callback.

import { useState } from "react";
import {
  AuthShell,
  inputStyle,
  labelStyle,
  buttonStyle,
  errorStyle,
  successStyle,
} from "@/app/dashboard/_shared/auth-shell";
import { getBrowserSupabase } from "@/app/dashboard/_shared/supabase-browser";

export function BrainLoginForm({ noAccess }: { noAccess?: boolean }) {
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
          emailRedirectTo: `${window.location.origin}/brain/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Link konnte nicht gesendet werden.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="AI-Brain · Zugang"
      title={
        <>
          Anmelden ohne <i style={{ fontFamily: "var(--font-editorial, serif)" }}>Passwort.</i>
        </>
      }
      intro="Gib deine eingeladene Email ein, wir senden dir einen einmaligen Anmeldelink. Gültig für eine Stunde."
    >
      {noAccess && !done && (
        <div style={errorStyle}>
          Dieser Zugang ist nicht (mehr) freigeschaltet. Bitte wende dich an die Person, die dich eingeladen hat.
        </div>
      )}
      {done ? (
        <div style={successStyle}>
          Link gesendet. Prüfe dein Postfach (auch Spam). Der Link funktioniert einmal und läuft nach 60 Minuten ab.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 4 }}>
          <div>
            <label htmlFor="brain-email" style={labelStyle}>
              Email
            </label>
            <input
              id="brain-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="du@beispiel.com"
            />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button
            type="submit"
            disabled={busy}
            style={{ ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
          >
            {busy ? "Link wird gesendet…" : "Anmeldelink senden"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
