"use client";

import { useState, FormEvent } from "react";

// NOTE: formsubmit.co requires the destination email to actually exist.
// Switch to alainkessler04@gmail.com once the domain is wired and a forwarder is in place.
const FORM_ENDPOINT = "https://formsubmit.co/ajax/alainkessler04@gmail.com";

type SubmitState = "idle" | "loading" | "success" | "error";

async function submitForm(
  payload: Record<string, string>,
  subject: string
): Promise<boolean> {
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...payload,
        _subject: subject,
        _captcha: "false",
      }),
    });
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────── AFFILIATE FORM ─────────────────────────────────────── */
export function AffiliateForm() {
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const ok = await submitForm(
      {
        type: "affiliate",
        email: String(fd.get("email") || ""),
        handle: String(fd.get("handle") || ""),
        audience: String(fd.get("audience") || ""),
        platforms: String(fd.get("platforms") || ""),
        why: String(fd.get("why") || ""),
      },
      "klar / affiliate inquiry"
    );
    setState(ok ? "success" : "error");
    if (ok) e.currentTarget.reset();
  };

  if (state === "success") {
    return (
      <div className="brut-line p-6 sm:p-8 bg-[var(--bg-2)]/40 backdrop-blur-sm">
        <p className="label-fg mb-2">↳ received.</p>
        <p className="t-body-lg">
          Thanks. We&apos;ll get back to you within a few days. Maybe sooner if
          your numbers are wild.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
    >
      <input
        required
        type="email"
        name="email"
        placeholder="your email"
        className="field sm:col-span-1"
      />
      <input
        name="handle"
        placeholder="@yourhandle"
        className="field sm:col-span-1"
      />
      <input
        name="audience"
        placeholder="audience size (rough)"
        className="field sm:col-span-1"
      />
      <input
        name="platforms"
        placeholder="tiktok / ig / yt / ..."
        className="field sm:col-span-1"
      />
      <textarea
        name="why"
        placeholder="what app / why klar / niche"
        className="field field-textarea sm:col-span-2"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="sm:col-span-2 brut-line label-fg px-4 py-3 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "loading" ? "sending…" : "apply →"}
      </button>
      {state === "error" && (
        <p className="label sm:col-span-2 text-[var(--fg)]">
          ↳ something broke. try again or email alainkessler04@gmail.com.
        </p>
      )}
    </form>
  );
}

/* ─────────────────────────────────────── CONSULTING FORM ─────────────────────────────────────── */
export function ConsultingForm() {
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const ok = await submitForm(
      {
        type: "consulting",
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        project: String(fd.get("project") || ""),
        budget: String(fd.get("budget") || ""),
        brief: String(fd.get("brief") || ""),
      },
      "klar / consulting inquiry"
    );
    setState(ok ? "success" : "error");
    if (ok) e.currentTarget.reset();
  };

  if (state === "success") {
    return (
      <div className="brut-line p-6 sm:p-8 bg-[var(--bg-2)]/40 backdrop-blur-sm">
        <p className="label-fg mb-2">↳ noted.</p>
        <p className="t-body-lg">
          We&apos;ll read your brief and write back. Usually within 48h.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
    >
      <input
        required
        name="name"
        placeholder="your name"
        className="field sm:col-span-1"
      />
      <input
        required
        type="email"
        name="email"
        placeholder="your email"
        className="field sm:col-span-1"
      />
      <select name="project" className="field sm:col-span-1" defaultValue="">
        <option value="" disabled>
          project type
        </option>
        <option value="new-app">new app · 0 → 1</option>
        <option value="rewrite">rewrite / rebuild</option>
        <option value="growth">growth / aso / tiktok</option>
        <option value="ai-features">ai feature integration</option>
        <option value="other">other</option>
      </select>
      <select name="budget" className="field sm:col-span-1" defaultValue="">
        <option value="" disabled>
          rough budget
        </option>
        <option value="<5k">&lt; CHF 5k</option>
        <option value="5-15k">CHF 5-15k</option>
        <option value="15-50k">CHF 15-50k</option>
        <option value=">50k">CHF 50k+</option>
        <option value="open">open / equity</option>
      </select>
      <textarea
        required
        name="brief"
        placeholder="what are you building, where are you stuck, what would success look like"
        className="field field-textarea sm:col-span-2"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="sm:col-span-2 brut-line label-fg px-4 py-3 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "loading" ? "sending…" : "send brief →"}
      </button>
      {state === "error" && (
        <p className="label sm:col-span-2 text-[var(--fg)]">
          ↳ something broke. try again or email alainkessler04@gmail.com.
        </p>
      )}
    </form>
  );
}
