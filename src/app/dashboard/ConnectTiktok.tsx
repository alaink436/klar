"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, field } from "../components/home/formStyles";

// "Connect your TikTok", the one step inside the dashboard before the bio code (Alain 2026-10-22: "so wenig Friktion
// wie möglich"): the username and a button. The sentence next to the button replaces the old tick box; country comes
// from the IP, TikTok is the only platform we pay for, a link is offered later from 1000 followers.

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
    <form onSubmit={submit} className={`${card} mt-10`}>
      <p className="text-[22px] font-medium tracking-[-0.03em]">Connect your TikTok to get paid</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">
        Your slideshows are below. Connect first, so the posts you make count.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
      {error && <p className="mt-4 text-[14px] text-[#b42318]">{error}</p>}
      <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-3)]">
        Without a link in your bio we estimate your share from your views and Basalt&apos;s sign-ups. By connecting you
        agree to that.
      </p>
    </form>
  );
}
