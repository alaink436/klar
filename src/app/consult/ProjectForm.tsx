"use client";

import { useState } from "react";
import { field, label } from "../components/home/formStyles";

// Project inquiries on /consult (Alain, 2026-11-24: "wegen andersweitigen Aufträgen", "Projekt-Anfrage"): a whole app or
// a fixed piece of work, not a call. Posts to /api/inquiry as type "consulting", which lands in Klar Control > Inbox
// and sends Alain's notification mail. No calendar, no payment.

const BUDGETS = ["Under CHF 2,000", "CHF 2,000 to 5,000", "CHF 5,000 to 15,000", "Over CHF 15,000", "Not sure yet"];

type State = "idle" | "sending" | "sent" | "error";

export default function ProjectForm() {
  const [state, setState] = useState<State>("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const timeline = String(f.get("timeline") ?? "").trim();
    const link = String(f.get("link") ?? "").trim();
    const brief = [String(f.get("brief") ?? "").trim(), timeline && `Timeline: ${timeline}`, link && `Link: ${link}`]
      .filter(Boolean)
      .join("\n\n");
    setState("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consulting",
          name: f.get("name"),
          email: f.get("email"),
          project: f.get("project"),
          budget: f.get("budget"),
          brief,
          company: f.get("company"),
        }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent")
    return (
      <p className="text-[18px] leading-relaxed" role="status">
        Thanks, I got it. I read every request myself and answer by email within two days.
      </p>
    );

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="pf-name" className={label}>Your name</label>
        <input id="pf-name" name="name" required maxLength={200} autoComplete="name" className={field} />
      </div>
      <div>
        <label htmlFor="pf-email" className={label}>Email</label>
        <input id="pf-email" name="email" type="email" required maxLength={320} autoComplete="email" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="pf-project" className={label}>What should be built?</label>
        <input id="pf-project" name="project" required maxLength={200} placeholder="e.g. an iPhone and Android app for booking dog walkers" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="pf-brief" className={label}>Tell me more</label>
        <textarea
          id="pf-brief"
          name="brief"
          required
          rows={5}
          maxLength={6000}
          placeholder="Who it is for, what exists already (designs, code, a website), and what done looks like for you."
          className={`${field} h-auto py-3`}
        />
      </div>
      <div>
        <label htmlFor="pf-budget" className={label}>Budget</label>
        <select id="pf-budget" name="budget" required defaultValue="" className={field}>
          <option value="" disabled>Pick one</option>
          {BUDGETS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pf-timeline" className={label}>When do you need it?</label>
        <input id="pf-timeline" name="timeline" maxLength={200} placeholder="e.g. live by March" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="pf-link" className={label}>Link to docs, designs or code (optional)</label>
        <input id="pf-link" name="link" type="url" maxLength={500} placeholder="Google Drive, Notion, Figma, GitHub" className={field} />
      </div>
      {/* honeypot: hidden from people, bots fill it and get dropped by /api/inquiry */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-14 items-center rounded-full bg-[var(--ink)] px-8 text-[16px] font-medium tracking-[-0.01em] text-[var(--paper)] transition hover:opacity-85 disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send project request"}
        </button>
        {state === "error" && (
          <p className="text-[15px] text-[var(--ink-2)]" role="alert">
            That did not go through. Please try again or write to support@getklar.org.
          </p>
        )}
      </div>
    </form>
  );
}
