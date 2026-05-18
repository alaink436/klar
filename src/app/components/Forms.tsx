"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

// Submissions are persisted server-side into Supabase via /api/inquiry
// (durable, visible in /admin). No more fire-and-forget email.
const FORM_ENDPOINT = "/api/inquiry";

type SubmitState = "idle" | "loading" | "success" | "error";

async function submitForm(payload: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return res.ok && Boolean(data?.success);
  } catch {
    return false;
  }
}

// Off-screen bot trap. Real users never see or fill this.
function Honeypot() {
  return (
    <div aria-hidden="true" className="hidden">
      <label>
        company
        <input type="text" name="company" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/* ───────────────────────── Custom select (no native picker) ───────────────────────── */
interface Opt {
  value: string;
  label: string;
}

function Select({
  name,
  placeholder,
  options,
  className = "",
}: {
  name: string;
  placeholder: string;
  options: Opt[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (o: Opt) => {
    setValue(o.value);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active]);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="field flex items-center justify-between text-left"
      >
        <span className={selected ? "" : "text-[var(--fg-4)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          className="label-fg ml-3 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        >
          ↓
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-30 brut-line bg-[var(--bg)] max-h-60 overflow-auto"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                i === active
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "text-[var(--fg-2)]"
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sent({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="brut-line p-6 sm:p-8 bg-[var(--bg-2)]">
      <p className="label-fg mb-2">↳ {tag}</p>
      <p className="t-body-lg">{children}</p>
    </div>
  );
}

const PROJECT_OPTS: Opt[] = [
  { value: "new-app", label: "new app · 0 → 1" },
  { value: "rewrite", label: "rewrite / rebuild" },
  { value: "growth", label: "growth / aso / tiktok" },
  { value: "ai-features", label: "ai feature integration" },
  { value: "other", label: "other" },
];
const BUDGET_OPTS: Opt[] = [
  { value: "<5k", label: "< CHF 5k" },
  { value: "5-15k", label: "CHF 5–15k" },
  { value: "15-50k", label: "CHF 15–50k" },
  { value: ">50k", label: "CHF 50k+" },
  { value: "open", label: "open / equity" },
];
const COACHING_OPTS: Opt[] = [
  { value: "1on1-call", label: "1:1 call" },
  { value: "async-review", label: "async review / feedback" },
  { value: "audit", label: "one-off audit" },
  { value: "ongoing", label: "ongoing mentoring" },
  { value: "not-sure", label: "not sure yet" },
];

/* ───────────────────────────── AFFILIATE ───────────────────────────── */
export function AffiliateForm() {
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const ok = await submitForm({
      type: "affiliate",
      email: String(fd.get("email") || ""),
      handle: String(fd.get("handle") || ""),
      audience: String(fd.get("audience") || ""),
      platforms: String(fd.get("platforms") || ""),
      why: String(fd.get("why") || ""),
      company: String(fd.get("company") || ""),
    });
    setState(ok ? "success" : "error");
    if (ok) e.currentTarget.reset();
  };

  if (state === "success")
    return (
      <Sent tag="received.">
        Thanks. We&apos;ll get back to you within a few days. Maybe sooner if
        your numbers are wild.
      </Sent>
    );

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
    >
      <Honeypot />
      <input
        required
        type="email"
        name="email"
        placeholder="your email"
        className="field"
      />
      <input name="handle" placeholder="@yourhandle" className="field" />
      <input
        name="audience"
        placeholder="audience size (rough)"
        className="field"
      />
      <input
        name="platforms"
        placeholder="tiktok / ig / yt / ..."
        className="field"
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

/* ───────────────────────────── CONSULTING ───────────────────────────── */
export function ConsultingForm() {
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const ok = await submitForm({
      type: "consulting",
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      project: String(fd.get("project") || ""),
      budget: String(fd.get("budget") || ""),
      brief: String(fd.get("brief") || ""),
      company: String(fd.get("company") || ""),
    });
    setState(ok ? "success" : "error");
    if (ok) e.currentTarget.reset();
  };

  if (state === "success")
    return (
      <Sent tag="noted.">
        We&apos;ll read your brief and write back. Usually within 48h.
      </Sent>
    );

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
    >
      <Honeypot />
      <input required name="name" placeholder="your name" className="field" />
      <input
        required
        type="email"
        name="email"
        placeholder="your email"
        className="field"
      />
      <Select name="project" placeholder="project type" options={PROJECT_OPTS} />
      <Select name="budget" placeholder="rough budget" options={BUDGET_OPTS} />
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

/* ───────────────────────────── COACHING ───────────────────────────── */
export function CoachingForm() {
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const ok = await submitForm({
      type: "coaching",
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      project: String(fd.get("focus") || ""),
      budget: String(fd.get("format") || ""),
      brief: String(fd.get("goal") || ""),
      company: String(fd.get("company") || ""),
    });
    setState(ok ? "success" : "error");
    if (ok) e.currentTarget.reset();
  };

  if (state === "success")
    return (
      <Sent tag="got it.">
        Thanks. I&apos;ll read it and reply personally, usually within a few
        days, with whether and how I can help.
      </Sent>
    );

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
    >
      <Honeypot />
      <input required name="name" placeholder="your name" className="field" />
      <input
        required
        type="email"
        name="email"
        placeholder="your email"
        className="field"
      />
      <input
        name="focus"
        placeholder="focus (shipping solo, ai, aso, tiktok, ...)"
        className="field"
      />
      <Select name="format" placeholder="format" options={COACHING_OPTS} />
      <textarea
        required
        name="goal"
        placeholder="where are you now, what do you want to get unstuck on"
        className="field field-textarea sm:col-span-2"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="sm:col-span-2 brut-line label-fg px-4 py-3 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "loading" ? "sending…" : "request coaching →"}
      </button>
      {state === "error" && (
        <p className="label sm:col-span-2 text-[var(--fg)]">
          ↳ something broke. try again or email alainkessler04@gmail.com.
        </p>
      )}
    </form>
  );
}
