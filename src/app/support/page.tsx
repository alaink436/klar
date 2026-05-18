import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support · Klar",
  description:
    "Get help with a Klar app: Trubel, MyLoo, Wavelength or Yarn-Stash. One person behind it, real replies.",
};

const SUPPORT_EMAIL = "support@getklar.org";

const APPS = [
  { name: "Trubel", note: "geo photo albums" },
  { name: "MyLoo", note: "bristol-scale tracking" },
  { name: "Wavelength", note: "group planning" },
  { name: "Yarn-Stash", note: "yarn inventory" },
];

export default function Support() {
  return (
    <>
      <div className="bg-stage" aria-hidden="true">
        <div
          className="bg-layer bg-layer-1"
          style={{ backgroundImage: "url('/bg/bg-1.webp')" }}
        />
        <div
          className="bg-layer bg-layer-3"
          style={{ backgroundImage: "url('/bg/bg-3.webp')" }}
        />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        {/* NAV */}
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <Link href="/" className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">support</span>
          </Link>
          <Link href="/" className="label hover:text-[var(--fg)] transition">
            ← back
          </Link>
        </nav>

        {/* HERO */}
        <section className="veil-light px-4 sm:px-6 md:px-12 pt-14 sm:pt-20 md:pt-28 pb-12 sm:pb-16 relative z-10 border-b border-[var(--line)]">
          <div className="flex items-baseline justify-between mb-6 sm:mb-10">
            <p className="label">support // help.</p>
            <p className="label">one person · real replies</p>
          </div>

          <h1 className="display text-[clamp(2.5rem,9vw,6rem)] leading-[0.95] text-[var(--fg)] -ml-1">
            need a hand?
          </h1>

          <div className="grid grid-cols-12 gap-4 sm:gap-6 mt-8 sm:mt-12">
            <div className="col-span-1 md:col-span-2 hidden md:flex justify-end pt-2">
              <span className="label">↳</span>
            </div>
            <div className="col-span-12 md:col-span-8 max-w-2xl">
              <p className="editorial t-editorial-lg text-[var(--fg-2)]">
                klar is a one-person studio. that means{" "}
                <span className="text-[var(--fg)]">
                  a real human reads every message
                </span>{" "}
                and writes back, usually within a few days.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mt-5 sm:mt-7 max-w-md">
                Bug, billing question, account or data request for any of the
                apps below. Send the app name and what happened, screenshots
                help.
              </p>

              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Klar%20Support`}
                className="inline-block mt-7 brut-line label-fg px-5 py-3 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
              >
                {SUPPORT_EMAIL} →
              </a>

              <p className="label mt-4">
                or use the{" "}
                <Link
                  href="/#consulting"
                  className="border-b border-[var(--fg)] pb-0.5 hover:text-[var(--fg)]"
                >
                  contact form
                </Link>{" "}
                on the home page
              </p>
            </div>
          </div>
        </section>

        {/* APPS */}
        <section className="veil-mid px-4 sm:px-6 md:px-12 py-12 sm:py-16 relative z-10 border-b border-[var(--line)]">
          <p className="label mb-6 sm:mb-8">apps we support</p>
          <div className="border-t border-[var(--line-strong)]">
            {APPS.map((app, i) => (
              <div
                key={app.name}
                className="border-b border-[var(--line)] py-4 sm:py-5 grid grid-cols-12 gap-3 items-center"
              >
                <div className="col-span-1">
                  <span className="label">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="col-span-5 sm:col-span-4">
                  <span className="display text-lg sm:text-2xl">
                    {app.name.toLowerCase()}
                  </span>
                </div>
                <div className="col-span-6 sm:col-span-7">
                  <p className="editorial text-sm sm:text-base text-[var(--fg-2)]">
                    {app.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="label mt-6">
            response time: a few days, often sooner · operated by Alain Kessler,
            CH
          </p>
        </section>

        {/* FOOTER */}
        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-10 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="display text-2xl sm:text-3xl">klar</span>
              <span className="label">support</span>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <Link href="/" className="label hover:text-[var(--fg)] transition">
                home
              </Link>
              <Link
                href="/log"
                className="label hover:text-[var(--fg)] transition"
              >
                log
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="label hover:text-[var(--fg)] transition"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <p className="label mt-6">© 2026 alain kessler · ch</p>
        </footer>
      </main>
    </>
  );
}
