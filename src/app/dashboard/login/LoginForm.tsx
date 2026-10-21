"use client";

import { useState } from "react";
import { card, field, label } from "../../components/home/formStyles";
import { getBrowserSupabase } from "../../brain/_shared/supabase-browser";

// signInWithOtp creates the user on first use (unlike /brain, which is invite
// only). The link lands on /dashboard/auth/callback, the one redirect the hub's
// Supabase Auth allows for getklar.org.

export default function LoginForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(expired ? "That link has expired or was already used. Ask for a new one." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const { error: err } = await getBrowserSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/auth/callback`, shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError(err.status === 429 ? "Too many tries. Give it a few minutes." : "We couldn't send the link. Check the address.");
    else setSent(true);
  }

  if (sent) {
    return (
      <div className={`${card} mt-10 text-[15.5px] leading-relaxed`}>
        Check your inbox (and spam) for a link from Klar. It works once and for an hour.
      </div>
    );
  }
  return (
    <form onSubmit={submit} className={`${card} mt-10 grid gap-5`}>
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={field}
        />
      </div>
      {error && <p className="text-[14px] text-[#b42318]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-full bg-[var(--ink)] text-[15px] font-medium text-[var(--paper)] transition hover:opacity-85 disabled:opacity-40"
      >
        {busy ? "Sending" : "Send me a link"}
      </button>
    </form>
  );
}
