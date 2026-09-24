// Support page for Pocketmate (com.myloo.app), iPhone and Android.
//
// The support URL for App Store Connect and Google Play. Apple checks that it
// leads to real contact information, so the address is the first thing on
// the page. Deletion and cancellation are here because they are the two
// questions that arrive most, and neither is answered inside the app for a
// person who no longer has it installed.
//
// Structure mirrors the Pocketmate privacy and terms pages next to it.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pocketmate Support · Klar",
  description:
    "Help with Pocketmate: contact, deleting your account, and cancelling a subscription on iPhone and Android.",
  robots: { index: true, follow: true },
};

const CONTACT = "feedback+pocketmate@reply.getklar.org";

export default function PocketmateSupportPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Pocketmate · Support
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Need a <span className="editorial">hand?</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 48 }}>
          Pocketmate is made by one person. A real human reads every message and
          writes back, usually within a few days.
        </p>

        <Section n="01" title="Contact">
          <p>
            Write to{" "}
            <a href={`mailto:${CONTACT}?subject=Pocketmate`} className="underline">{CONTACT}</a>{" "}
            with what happened, whether you use an iPhone or an Android phone,
            and the app version if you know it. Screenshots help. You can also
            write to us from inside the app.
          </p>
        </Section>

        <Section n="02" title="Delete your account">
          <p>
            In the app, open the Me tab, scroll to the bottom and tap Delete
            account. That removes your account and your data; the details are
            in the{" "}
            <Link href="/pocketmate/privacy" className="underline">Privacy Policy</Link>.
          </p>
          <p>
            If you no longer have the app, see{" "}
            <Link href="/delete-account#pocketmate" className="underline">getklar.org/delete-account</Link>{" "}
            or write to the address above from the email address of your
            account.
          </p>
          <p>
            Deleting your account does not cancel a subscription. Cancel it in
            your store account as described below.
          </p>
        </Section>

        <Section n="03" title="Cancel a subscription">
          <p>
            Subscriptions are managed by Apple and Google, not in Pocketmate.
            Cancelling stops the next renewal, and you keep Pro until the end of
            the period you already paid for.
          </p>
          <p>
            <b>iPhone.</b> Open the Settings app, tap your name, then
            Subscriptions, choose Pocketmate and tap Cancel Subscription.
          </p>
          <p>
            <b>Android.</b> Open the Google Play Store, tap your profile
            picture, then Payments and subscriptions, then Subscriptions, choose
            Pocketmate and tap Cancel subscription.
          </p>
          <p>
            Refunds are handled by Apple or Google under their rules. We are
            still happy to help if something went wrong with a purchase.
          </p>
        </Section>

        <Section n="04" title="Legal">
          <p>
            <Link href="/pocketmate/privacy" className="underline">Privacy Policy</Link>{" "}
            ·{" "}
            <Link href="/pocketmate/terms" className="underline">Terms of Use</Link>
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/" className="underline">getklar.org</Link>
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
