"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ScanSearch } from "lucide-react";
import { RiTiktokFill } from "@remixicon/react";
import { card } from "../components/home/formStyles";

// After "Connect your TikTok": the bio code. The creator puts it into his TikTok
// bio, we read the bio once on "Check my bio" (Evomi, lib/creatorAccounts).
// Afterwards he may delete it again. A typo in the username is undone with
// "Use a different account".
//
// Coming back to tap is its own step (Alain 2026-10-22, "einen Hinweis, dass man
// das noch extra klicken muss"): the first creator with a large account put the
// code into the bio and never tapped, so nothing confirmed the account.
//
// The steps read as a small path (Alain 2026-10-22: "nicht so gevibecodet"): a
// circle per step joined by a line, side by side from sm, stacked on a phone; the
// last one dark, because the button below it is what confirms.

function Step({ icon, title, last, children }: { icon: ReactNode; title: string; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-4 sm:block">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute -bottom-5 left-[21px] top-12 w-px bg-black/10 sm:bottom-auto sm:left-[52px] sm:right-[-8px] sm:top-[21px] sm:h-px sm:w-auto"
        />
      )}
      <span
        className={`relative grid size-11 shrink-0 place-items-center rounded-full border ${last ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--hair)] bg-white text-[var(--ink)]"}`}
      >
        {icon}
      </span>
      <div className="min-w-0 pt-2.5 sm:pt-4">
        <p className="text-[15.5px] font-medium leading-snug">{title}</p>
        <div className="mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{children}</div>
      </div>
    </li>
  );
}

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

  async function change() {
    if (busy) return;
    setBusy(true);
    await fetch("/dashboard/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) }).catch(() => {});
    router.refresh();
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
      <ol className="mt-7 grid gap-6 sm:grid-cols-3 sm:gap-4">
        <Step icon={<Copy className="size-[18px]" strokeWidth={1.8} />} title="Copy your code">
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${code}`}
            className="mt-1 inline-flex items-center gap-2.5 rounded-xl border border-[var(--hair)] bg-white px-3 py-1.5 font-mono text-[17px] tracking-[0.04em] text-[var(--ink)] transition hover:border-[var(--ink-3)]"
          >
            {code}
            {copied ? <Check className="size-4 text-[var(--ink-3)]" strokeWidth={2} /> : <Copy className="size-4 text-[var(--ink-3)]" strokeWidth={1.8} />}
          </button>
        </Step>
        <Step icon={<RiTiktokFill className="size-[18px]" />} title="Put it in your TikTok bio">
          Edit profile, Bio, anywhere in it. Then save.
        </Step>
        <Step icon={<ScanSearch className="size-[18px]" strokeWidth={1.8} />} title="Come back and check" last>
          We only look when you tap the button below.
        </Step>
      </ol>
      {error && <p className="mt-5 text-[14px] text-[#b42318]">{error}</p>}
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="mt-7 h-12 w-full rounded-full bg-[var(--ink)] text-[15px] font-medium text-[var(--paper)] transition hover:opacity-85 disabled:opacity-40"
      >
        {busy ? "Checking your bio" : "Check my bio"}
      </button>
      <p className="mt-3 text-center text-[13px] leading-relaxed text-[var(--ink-3)]">
        We&apos;ll email you once you&apos;re confirmed. After that you can delete the code again.
      </p>
      <button type="button" onClick={change} disabled={busy} className="mt-4 text-[13px] font-medium text-[var(--ink-3)] transition hover:text-[var(--ink)]">
        Not @{handle}? Use a different account
      </button>
    </div>
  );
}
