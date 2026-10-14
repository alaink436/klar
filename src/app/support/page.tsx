import type { Metadata } from "next";
import Site, { SUPPORT_EMAIL } from "../components/home/Site";

// Support in the light Klar Studios frame of the front page (2026-10-14); the
// dark page that stood here still said "one-person studio".

export const metadata: Metadata = {
  title: "Support · Klar Studios",
  description:
    "Get help with a Klar Studios app: Pocketmate, Anime Vault, My Yarn Stash, Kelva, Basalt, Focus Crew, Trubel or Promillo. Real replies from a human.",
};

// Every app that can still be downloaded, as of the App Store on 2026-10-01.
const APPS = [
  { name: "Pocketmate", note: "Widgets for couples" },
  { name: "Anime Vault", note: "Anime tracker & list" },
  { name: "My Yarn Stash", note: "Row counter" },
  { name: "Kelva", note: "Strength & cycle" },
  { name: "Basalt", note: "Weekly habits" },
  { name: "Focus Crew", note: "Study together, live" },
  { name: "Trubel", note: "Shared event photos" },
  { name: "Promillo", note: "Party games" },
];

export default function Support() {
  return (
    <Site>
      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1280px] px-5 pb-20 pt-32 sm:px-8 md:px-12 md:pb-28 md:pt-40">
            <p className="text-[13px] font-medium tracking-[-0.005em]">Support</p>
            <h1 className="mt-6 text-[clamp(64px,11vw,176px)] font-medium leading-[0.88] tracking-[-0.06em]">
              Need a hand?
            </h1>
            <div className="mt-12 grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-16">
              <p className="max-w-[28ch] text-[clamp(20px,2vw,28px)] leading-[1.25] tracking-[-0.02em]">
                A real human reads every message and writes back, usually within a few days.
              </p>
              <div>
                <p className="max-w-[40ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
                  Bug, billing question, account or data request for any of the apps below. Send the
                  app name and what happened, screenshots help.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Klar%20Support`}
                  className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:px-12 md:py-24">
            <p className="text-[13px] font-medium text-[var(--ink-3)]">Apps we support</p>
            <ul className="mt-6 border-t">
              {APPS.map((app, i) => (
                <li
                  key={app.name}
                  className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 gap-y-1 border-b py-5 sm:grid-cols-[4rem_1fr_1fr]"
                >
                  <span className="text-[13px] tabular-nums text-[var(--ink-3)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[clamp(26px,3.4vw,44px)] font-medium leading-none tracking-[-0.04em]">
                    {app.name}
                  </span>
                  <span className="col-start-2 text-[15px] text-[var(--ink-2)] sm:col-start-3">{app.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-[var(--ink-3)]">
              Response time: a few days, often sooner · operated by Alain Kessler, Switzerland
            </p>
          </div>
        </section>
      </main>
    </Site>
  );
}
