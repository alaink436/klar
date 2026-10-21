"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card } from "../components/home/formStyles";

// Step 2: the bio code. The creator puts it into his TikTok bio, we read the
// bio once on "Check my bio" (Evomi, lib/creatorAccounts). Afterwards he may
// delete it again.

const ERRORS: Record<string, string> = {
  code_missing: "We can't see the code in your bio yet. TikTok sometimes takes a minute to update, try again shortly.",
  profile_unreadable: "We couldn't open your profile. Is the account public and the username right?",
  handle_taken: "This TikTok account already belongs to someone else.",
  rate_limited: "Too many tries. Give it a few minutes.",
};

export default function VerifyStep({ handle, code }: { handle: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/dashboard/verify", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(ERRORS[data.error ?? ""] ?? "Something went wrong. Try again in a minute.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* no clipboard (in-app browser): the code is on screen to type */
    }
  }

  return (
    <div className={`${card} mt-10`}>
      <p className="text-[22px] font-medium tracking-[-0.03em]">Show us @{handle} is yours</p>
      <ol className="mt-6 space-y-4 text-[15.5px] leading-snug">
        <li className="grid grid-cols-[2rem_1fr]">
          <span className="text-[13px] tabular-nums text-[var(--ink-3)]">01</span>
          <span>Add this code anywhere in your TikTok bio (Edit profile, Bio).</span>
        </li>
        <li className="grid grid-cols-[2rem_1fr]">
          <span className="text-[13px] tabular-nums text-[var(--ink-3)]">02</span>
          <span>Save it, then tap the button below. Once we have seen it, you can delete it again.</span>
        </li>
      </ol>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <code className="rounded-2xl border border-[var(--hair)] bg-white/70 px-5 py-3 font-mono text-[22px] tracking-[0.04em]">{code}</code>
        <button type="button" onClick={copy} className="h-11 rounded-full border border-[var(--hair)] bg-white/70 px-5 text-[14px] font-medium transition hover:border-[var(--ink-3)]">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {error && <p className="mt-5 text-[14px] text-[#b42318]">{error}</p>}
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="mt-6 h-12 w-full rounded-full bg-[var(--ink)] text-[15px] font-medium text-[var(--paper)] transition hover:opacity-85 disabled:opacity-40"
      >
        {busy ? "Checking your bio" : "Check my bio"}
      </button>
    </div>
  );
}
