"use client";

import { useState } from "react";

// The creator application on the front page. Creators pick ONE way in (Alain:
// both at once was confusing): by email, which posts to /api/inquiry as an
// `affiliate` request and lands in Klar Control's inbox, or by TikTok DM.
// TikTok and Instagram only; no promo codes, creators earn through their own
// link or CPM. Every choice is a chip, never a native select menu.

type AppOption = { slug: string; name: string; icon: string };
type Mode = "email" | "dm";
type State = "idle" | "sending" | "sent" | "error";

// Minimum 1k followers (Alain, 2026-10-14), so there is no option below it.
const AUDIENCE = ["1k-10k", "10k-100k", "100k+"];
const PLATFORMS = ["TikTok", "Instagram"];

const ERRORS: Record<string, string> = {
  bad_email: "That email address does not look right.",
  rate_limited: "Too many tries. Give it a few minutes.",
};

const field =
  "h-12 w-full rounded-2xl border border-[var(--hair)] bg-white/70 px-4 text-[15px] outline-none transition placeholder:text-[var(--ink-3)] focus:border-[var(--ink)]";
const label = "mb-2 block text-[13px] font-medium text-[var(--ink-2)]";

function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])}
            className={`h-10 rounded-full border px-4 text-[14px] font-medium transition ${on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--hair)] bg-white/70 hover:border-[var(--ink-3)]"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

const card =
  "rounded-[28px] border border-white/70 bg-white/50 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-8";

export default function CreatorForm({ apps, tiktok }: { apps: AppOption[]; tiktok: string }) {
  const [mode, setMode] = useState<Mode>("email");
  const [app, setApp] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["TikTok"]);
  const [audience, setAudience] = useState<string[]>([]);
  const [deal, setDeal] = useState<"commission" | "cpm" | "">("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deal) {
      setState("error");
      setError("Pick how you want to be paid.");
      return;
    }
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "affiliate",
          handle: f.get("handle"),
          email: f.get("email"),
          platforms: platforms.join(", "),
          audience: audience[0] ?? "",
          deal,
          target_app: app,
          why: f.get("why"),
          company: f.get("company"),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (body.success) {
        setState("sent");
        return;
      }
      setState("error");
      setError(ERRORS[body.error ?? ""] ?? "Something went wrong. Try again, or DM us.");
    } catch {
      setState("error");
      setError("No connection. Try again in a moment.");
    }
  }

  if (state === "sent") {
    return (
      <div className={card}>
        <p className="text-[clamp(26px,3vw,36px)] font-medium leading-tight tracking-[-0.04em]">Got it.</p>
        <p className="mt-3 max-w-[36ch] text-[16px] leading-relaxed text-[var(--ink-2)]">
          We read every application and write back by email, usually within a few days.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <span className={label}>How do you want to apply?</span>
      <div className="grid grid-cols-2 gap-1 rounded-full border border-[var(--hair)] bg-white/70 p-1">
        {(["email", "dm"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-full text-[14px] font-medium transition ${mode === m ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-white"}`}
          >
            {m === "email" ? "Email" : "TikTok DM"}
          </button>
        ))}
      </div>

      {mode === "dm" ? (
        <div className="mt-7">
          <p className="text-[16px] leading-relaxed text-[var(--ink-2)]">
            Send a DM to <span className="font-medium text-[var(--ink)]">@{tiktok}</span> with your handle, your
            follower count, the app you would post about and whether you want commission or CPM.
          </p>
          <a
            href={`https://www.tiktok.com/@${tiktok}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-12 items-center rounded-full bg-[var(--ink)] px-7 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
          >
            Open @{tiktok} on TikTok
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="cf-handle">Your handle</label>
              <input id="cf-handle" name="handle" required maxLength={200} placeholder="@yourname" className={field} />
            </div>
            <div>
              <label className={label} htmlFor="cf-email">Email</label>
              <input id="cf-email" name="email" type="email" required maxLength={320} placeholder="you@example.com" className={field} />
            </div>
          </div>

          <div className="mt-5">
            <span className={label}>Where you post</span>
            <Chips options={PLATFORMS} value={platforms} onChange={setPlatforms} multi />
          </div>

          <div className="mt-5">
            <span className={label}>Followers <span className="font-normal text-[var(--ink-3)]">· minimum 1k</span></span>
            <Chips options={AUDIENCE} value={audience} onChange={setAudience} />
          </div>

          <div className="mt-5">
            <span className={label}>How you want to be paid</span>
            <div className="grid grid-cols-2 gap-2">
              {(["commission", "cpm"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={deal === d}
                  onClick={() => setDeal(d)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${deal === d ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--hair)] bg-white/70 hover:border-[var(--ink-3)]"}`}
                >
                  <span className="block text-[15px] font-medium">{d === "cpm" ? "CPM" : "Commission"}</span>
                  <span className={`block text-[12.5px] ${deal === d ? "text-white/70" : "text-[var(--ink-3)]"}`}>
                    {d === "cpm" ? "Per 1,000 views" : "Your own link"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <span className={label}>App you would post about</span>
            <div className="flex flex-wrap gap-2">
              {[{ slug: "", name: "Any, you pick", icon: "" }, ...apps].map((a) => (
                <button
                  key={a.slug || "any"}
                  type="button"
                  aria-pressed={app === a.slug}
                  onClick={() => setApp(a.slug)}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border pr-4 text-[14px] font-medium transition ${a.icon ? "pl-2" : "pl-4"} ${app === a.slug ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--hair)] bg-white/70 hover:border-[var(--ink-3)]"}`}
                >
                  {a.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.icon} alt="" width={24} height={24} className="size-6 rounded-[22.5%]" />
                  )}
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className={label} htmlFor="cf-why">Anything else</label>
            <textarea
              id="cf-why"
              name="why"
              rows={3}
              maxLength={8000}
              placeholder="Links to videos of yours you like"
              className={`${field} h-auto resize-y py-3`}
            />
          </div>

          {/* Honeypot: people never see or fill this, form bots do. */}
          <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={state === "sending"}
              className="inline-flex h-12 items-center rounded-full bg-[var(--ink)] px-7 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85 disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Apply"}
            </button>
            {state === "error" && <p role="alert" className="text-[14px] text-[#b42318]">{error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
