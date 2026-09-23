// Account deletion for every Klar app, one page, one anchor per app
// (getklar.org/delete-account#animevault).
//
// Google Play requires a web link where users can ask for their account to be
// deleted without reinstalling the app, entered in the Data safety form. Before
// 2026-09-22 none of the apps had one; getklar.org/support covers data requests
// in general but never says "delete". One page for all apps is enough for Play
// as long as each app is named and has its own steps.
//
// The in-app paths below were read from each app's code on 2026-09-23. If a
// settings screen moves, this page moves with it.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your account · Klar",
  description:
    "How to delete your account and data in Yarn Stash, Pocketmate, Kelva, Anime Vault and Basalt, in the app or by email.",
  robots: { index: true, follow: true },
};

const AS_OF = "23 September 2026";

const APPS: {
  id: string;
  name: string;
  path: string;
  mail: string;
  data: string;
}[] = [
  {
    id: "yarnstash",
    name: "Yarn Stash",
    path: "Open the Settings tab, scroll to the bottom and tap Delete account.",
    mail: "myyarnstashsupport@gmail.com",
    data: "your account, your yarn stash, projects, patterns, counters and attachments",
  },
  {
    id: "pocketmate",
    name: "Pocketmate",
    path: "Open the Me tab, scroll to the bottom and tap Delete account.",
    mail: "feedback+pocketmate@reply.getklar.org",
    data: "your account, your profile, your entries and the connection to your partner",
  },
  {
    id: "kelva",
    name: "Kelva",
    path: "Open Settings, scroll to the bottom and tap Delete account.",
    mail: "kelvasupport@gmail.com",
    data: "your account, your profile, your plans, logs and everything you stored in the app",
  },
  {
    id: "animevault",
    name: "Anime Vault",
    path: "Open the Profile tab, scroll to the bottom and tap Delete account.",
    mail: "help.klar@gmail.com",
    data: "your account, your watchlist, your profile and avatar, your forum posts, replies and votes, your friends and your block list",
  },
  {
    id: "basalt",
    name: "Basalt",
    path: "Open Settings, scroll to the bottom and tap delete account.",
    mail: "feedback+basalt@reply.getklar.org",
    data: "your account, your routines, every day you ticked off, your pacts and any share you set up",
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Klar · Account deletion · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Delete your <span className="editorial">account.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 48 }}>
          Every app below is made by Klar, the one-person studio of Alain Kessler in
          Switzerland. You can delete your account in the app itself, which is
          immediate, or ask us by email if you no longer have the app installed.
        </p>

        {APPS.map((a) => (
          <section key={a.id} id={a.id} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <h2
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontWeight: 700,
                fontSize: "clamp(22px, 3vw, 28px)",
                letterSpacing: "-0.02em",
                color: "var(--fg)",
                margin: "0 0 14px",
              }}
            >
              {a.name}
            </h2>
            <div style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--fg-2)", display: "flex", flexDirection: "column", gap: 12 }}>
              <p>
                <b>In the app.</b> {a.path} Confirm, and the deletion happens right
                away.
              </p>
              <p>
                <b>By email.</b> Write to{" "}
                <a href={`mailto:${a.mail}?subject=${encodeURIComponent(`Delete my ${a.name} account`)}`} className="underline">
                  {a.mail}
                </a>{" "}
                from the address you signed up with and say that you want your{" "}
                {a.name} account deleted. We delete it within 30 days and reply when
                it is done.
              </p>
              <p>
                <b>What is deleted.</b> {a.data}, removed from our servers.
              </p>
            </div>
          </section>
        ))}

        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: "var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: "clamp(22px, 3vw, 28px)",
              letterSpacing: "-0.02em",
              color: "var(--fg)",
              margin: "0 0 14px",
            }}
          >
            What stays
          </h2>
          <div style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--fg-2)", display: "flex", flexDirection: "column", gap: 12 }}>
            <p>
              Server logs are kept for at most 30 days and then removed. Records of
              purchases stay with Apple or Google, as their own terms require;
              deleting your account does not cancel a subscription, so cancel it in
              your store account first. Our subscription provider RevenueCat keeps
              the purchase record that the store sends, without your name or email.
            </p>
          </div>
        </section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Alain Kessler (CH sole proprietorship) ·{" "}
          <Link href="/support" className="underline">support</Link> ·{" "}
          <Link href="/" className="underline">getklar.org</Link>
        </p>
      </article>
    </main>
  );
}
