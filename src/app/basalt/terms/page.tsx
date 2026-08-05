// Terms of Use (EULA) for Basalt - Follow Through (com.wavelenght.app).
//
// Linked from App Store Connect (App Description EULA link) and from the in-app
// Settings. Required by Apple Guideline 3.1.2 for apps offering auto-renewable
// subscriptions: the app must contain a FUNCTIONAL link to these terms.
//
// Two sections exist here that Promillio's does not, because Basalt does two
// things a party game does not: it can shut apps on your phone through Apple's
// Screen Time, and it can let one other person watch a routine.
//
// Structure mirrors src/app/promillo/terms/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Basalt Terms of Use (EULA) · Klar",
  description:
    "Terms of Use and end user license agreement for Basalt - Follow Through, including the subscription terms and what blocking apps does and does not promise.",
  robots: { index: true, follow: true },
};

const AS_OF = "5 August 2026";
const CONTACT = "support@getklar.org";

export default function BasaltTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Basalt · Terms of Use (EULA) · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          These terms govern your use of Basalt - Follow Through, published by
          Alain Kessler (Klar), a sole proprietorship registered in Switzerland.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          By using the app you agree to them. If you do not, please do not use
          the app.
        </p>

        <Section n="01" title="Usage and minimum age">
          <p>
            We grant you a personal, non-transferable, non-exclusive licence to
            use the app on devices you own or control, for your own private use.
            You need to be at least 13 years old, or 16 in the European Union. Do
            not attempt to reverse engineer the app, resell it, or use it in a
            way that breaks the law.
          </p>
        </Section>

        <Section n="02" title="Free and paid">
          <p>
            Writing a routine, ticking off your days, the home screen widget, the
            reminder, and sharing a routine with one person are free and stay
            free. What you pay for is enforcement: shutting apps and websites,
            by hand or on a schedule.
          </p>
          <p>
            A subscription renews automatically for the same period unless it is
            cancelled at least 24 hours before the end of the current period.
            Your Apple ID is charged at confirmation of purchase and again on
            each renewal. Prices are shown in the app before you buy, in your
            local currency.
          </p>
        </Section>

        <Section n="03" title="Cancellation">
          <p>
            You manage and cancel a subscription in the App Store, under your
            Apple ID subscription settings — not in Basalt, because Apple does
            not give apps that control. Cancelling stops the next renewal; the
            current period runs to its end. Deleting the app does not cancel a
            subscription.
          </p>
        </Section>

        <Section n="04" title="What blocking is, and what it is not">
          <p>
            Blocking uses Apple&apos;s Screen Time framework. It is a strong
            deterrent, not a security control, and it is not a guarantee. Apple
            decides what the framework can reach, iOS updates change its
            behaviour, and a determined person can always turn it off in system
            settings. Do not rely on it as the only thing standing between you
            and something serious.
          </p>
          <p>
            The app never learns which apps or websites you chose — that
            selection stays on your device as an opaque Apple token. If your
            subscription lapses, the app stops arming new blocks and releases the
            ones it set, so a lapsed subscription can never leave your own phone
            locked.
          </p>
        </Section>

        <Section n="05" title="Sharing a routine">
          <p>
            You can let one person follow one routine. It is read-only: they see
            which days you ticked off and cannot change anything, and the same is
            true in reverse. Only share with someone you are content to show that
            to. You can stop sharing at any time, which takes their access away
            immediately. You are responsible for who you invite.
          </p>
        </Section>

        <Section n="06" title="Your content">
          <p>
            The routines you write are yours. We store them to run the service
            and do not use them for anything else — not for advertising, not for
            training, not for sale. You can delete everything at any time in the
            app under Settings.
          </p>
        </Section>

        <Section n="07" title="Not medical or therapeutic advice">
          <p>
            Basalt is a tool for building habits. It is not a medical device and
            does not provide medical, psychological or therapeutic advice or
            treatment. If you are struggling with a compulsion or an addiction,
            please talk to a qualified professional. Nothing in the app is a
            substitute for that.
          </p>
        </Section>

        <Section n="08" title="Liability">
          <p>
            The app is provided as it is. To the extent permitted by law we are
            liable only for intent and gross negligence. We are not liable for
            indirect or consequential damage, for lost data where you have not
            kept your own record, or for outcomes you were hoping the app would
            produce. Mandatory statutory liability is unaffected.
          </p>
        </Section>

        <Section n="09" title="Changes and governing law">
          <p>
            We may update these terms as the app evolves; the current version is
            always on this page with the date shown below. Swiss law applies, to
            the extent that mandatory consumer protection law in your country of
            residence does not say otherwise. Questions go to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
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
