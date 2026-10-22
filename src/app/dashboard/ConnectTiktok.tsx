"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { field } from "../components/home/formStyles";

// "Connect your TikTok", the one step inside the dashboard before the bio code (Alain 2026-10-22: "so wenig Friktion
// wie möglich"), a slim bar above the tabs ("Hinweis-Balken"): the username and a button. The sentence under them
// replaces the old tick box; country comes from the IP, TikTok is the only platform we pay for, a link is offered
// later from 1000 followers.

const ERRORS: Record<string, string> = {
  bad_handle: "That does not look like a TikTok username.",
  handle_taken: "This TikTok account is already taken.",
  exists: "Your TikTok is already connected. Reload the page.",
};

export default function ConnectTiktok() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/dashboard/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(ERRORS[data.error ?? ""] ?? "Something went wrong. Try again in a minute.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 rounded-[22px] border border-white/80 bg-white/60 p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-5"
    >
      <p className="text-[16px] font-medium tracking-[-0.02em]">
        Connect your TikTok to get paid <span className="font-normal text-[var(--ink-3)]">· so the posts you make count</span>
      </p>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        <input
          className={`${field} sm:flex-1`}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="TikTok username"
          required
        />
        <button
          type="submit"
          disabled={busy || !handle.trim()}
          className="h-12 rounded-full bg-[var(--ink)] px-7 text-[15px] font-medium text-[var(--paper)] transition hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Connecting" : "Connect"}
        </button>
      </div>
      {error && <p className="mt-3 text-[14px] text-[#b42318]">{error}</p>}
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--ink-3)]">
        Without a link in your bio we estimate your share from your views and the app&apos;s sign-ups. By connecting you
        agree to that.
      </p>
    </form>
  );
}
