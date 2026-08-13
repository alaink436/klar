// Terms of Use for My Yarn Stash (com.yarnstash.app).
//
// Linked from App Store Connect, from the Google Cloud OAuth consent screen,
// and from the in-app Settings. Written against the app that ships in August
// 2026: the row counter is fully free, Premium is the label scanner plus an
// unlimited stash, and there is NO free trial — neither RevenueCat product
// carries one, so this page must never promise one.
//
// Deliberately absent: knit groups, feeds, moderation promises. The in-app
// terms once promised a 24-hour moderation turnaround for features that do not
// exist; this page describes only what the app actually does.
//
// Structure mirrors src/app/basalt/terms/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Yarn Stash Terms of Use · Klar",
  description:
    "The terms for using My Yarn Stash: what is free, what Premium is, how cancellation works, and what we are (not) liable for.",
  robots: { index: true, follow: true },
};

const AS_OF = "13 August 2026";
const CONTACT = "support@getklar.org";

export default function YarnstashTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          My Yarn Stash · Terms of Use · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 48 }}>
          My Yarn Stash is a row counter for knitting and crochet with a yarn
          stash attached, made by Alain Kessler (Switzerland), operating under
          the brand <i>Klar</i>. By using the app you agree to these terms.
        </p>

        <Section n="01" title="Usage and minimum age">
          <p>
            You need an account to use the app, so your stash and your row
            counts can follow you across devices. The app is intended for a
            general audience; you must be at least 13 years old (16 in the
            European Union) to create an account.
          </p>
        </Section>

        <Section n="02" title="Free and paid">
          <p>
            <b>The counter is free — all of it.</b> Counting rows and rounds,
            repeat counters, side counters, the screen lock, projects, the
            timer, and exporting your stash as PDF or CSV cost nothing. A free
            account can keep a stash of up to 30 entries.
          </p>
          <p>
            <b>My Yarn Stash Premium</b> is an auto-renewable subscription
            (monthly or yearly) that unlocks the yarn label scanner and an
            unlimited stash. Payment is charged to your Apple ID account at
            confirmation of purchase. The subscription renews automatically
            unless it is canceled at least 24 hours before the end of the
            current period. Prices are shown in the app before you buy.
          </p>
        </Section>

        <Section n="03" title="Cancellation">
          <p>
            You can manage and cancel your subscription at any time in your App
            Store account settings. Canceling stops the renewal; you keep access
            until the end of the period you already paid for. If your Premium
            ends, your stash stays intact — you keep everything you created, and
            entries beyond the free limit remain readable; you just cannot add
            new ones beyond it.
          </p>
        </Section>

        <Section n="04" title="The label scanner">
          <p>
            The scanner reads yarn labels (or a photo of the yarn itself) with
            the help of an AI model and suggests brand, fiber and yardage. It is
            a convenience, not an oracle: extraction can be wrong, and you
            should check the suggested values before saving them. Scans are
            rate-limited per day to keep the service affordable.
          </p>
        </Section>

        <Section n="05" title="Your content">
          <p>
            Your stash entries, photos, patterns and notes are yours. You grant
            us only the technical license needed to store them and show them
            back to you. You can export everything as CSV or PDF at any time,
            and deleting your account removes your content. Do not store
            content you have no right to keep — for purchased patterns, respect
            the designer&apos;s license.
          </p>
        </Section>

        <Section n="06" title="Fair use">
          <p>
            Do not abuse the service: no attempts to circumvent the free limit
            or the scan rate limit, no reverse engineering of the service, no
            automated bulk access. We may suspend accounts that attack the
            service, and will tell you why.
          </p>
        </Section>

        <Section n="07" title="Liability">
          <p>
            The app is provided with reasonable care, but without a guarantee of
            uninterrupted availability. To the extent permitted by law, we are
            liable only for damage caused intentionally or by gross negligence.
            A dropped stitch found late is annoying, but the row count in the
            app is a tool, not a warranty for your project&apos;s outcome.
          </p>
        </Section>

        <Section n="08" title="Changes and governing law">
          <p>
            We may update these terms as the app evolves; the current version is
            always available at this page, with the date shown below. Material
            changes will be announced in the app before they take effect. These
            terms are governed by Swiss law; the place of jurisdiction is
            Switzerland. Apple&apos;s standard licensed application terms apply
            to the App Store purchase itself.
          </p>
          <p>
            Questions? Write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/yarnstash" className="underline">My Yarn Stash</Link> ·{" "}
          <Link href="/yarnstash/privacy" className="underline">Privacy Policy</Link>
        </p>
      </article>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-3)" }}>{n}</span>
        <h2 style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 700, fontSize: "clamp(22px, 3vw, 28px)", letterSpacing: "-0.02em", color: "var(--fg)", margin: 0 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--fg-2)", display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}
