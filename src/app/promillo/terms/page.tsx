// Terms of Use (EULA) for the Promillo party-game app (com.promillo.app).
// Linked from App Store Connect (App Description EULA link) and from the
// in-app paywall + Settings. Required by Apple Guideline 3.1.2 for apps
// offering auto-renewable subscriptions: the app must contain a FUNCTIONAL
// link to these terms. Mirrors the in-app legal screen (Settings > Terms).

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Promillo Terms of Use (EULA) · Klar",
  description:
    "Terms of Use and end user license agreement for the Promillo party-game app, including the Promillo PRO auto-renewable subscription terms.",
  robots: { index: true, follow: true },
};

const AS_OF = "10 June 2026";
const CONTACT = "support@getklar.org";

export default function PromilloTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Promillo · Terms of Use (EULA) · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          These terms are the end user license agreement (EULA) for the
          Promillo app. By downloading or using Promillo you agree to them.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          Promillo is operated by Alain Kessler, a sole proprietorship
          registered in Switzerland, under the brand Klar.
        </p>

        <Section n="01" title="Usage and minimum age">
          <p>
            By using Promillo you agree to these terms. The minimum age to use
            the app is 16 years. If you create an account, you are responsible
            for keeping your login credentials safe.
          </p>
          <p>
            We grant you a personal, non-exclusive, non-transferable license to
            use the app for private, non-commercial purposes on Apple devices
            you own or control, as permitted by the App Store terms.
          </p>
        </Section>

        <Section n="02" title="Free content and Promillo PRO">
          <p>
            All 7 games are free to play, each with a set of free categories.
            The app shows no ads.
          </p>
          <p>
            <b>Promillo PRO</b> unlocks all premium categories. It is offered as
            an auto-renewable subscription with a duration of <b>1 month</b> or{" "}
            <b>1 year</b>. The current prices are always shown in the app
            before purchase. Payment is charged to your Apple ID account at
            confirmation of purchase.
          </p>
          <p>
            Subscriptions renew automatically unless auto-renew is turned off
            at least 24 hours before the end of the current period. Your Apple
            ID account is charged for renewal within 24 hours before the end of
            the current period, at the price shown when you subscribed.
          </p>
        </Section>

        <Section n="03" title="Cancellation">
          <p>
            You can manage and cancel the subscription at any time in your App
            Store account settings (Settings → Apple ID → Subscriptions).
            Access to PRO content remains until the end of the paid period.
            Refunds are handled by Apple according to the App Store terms.
          </p>
        </Section>

        <Section n="04" title="Game content">
          <p>
            Game sessions, player names and avatars stay on your device. We
            create and curate the question and card decks. You may use them for
            your private game rounds. Redistribution or commercial use of the
            content is not permitted. Custom packs you create remain yours; you
            are responsible for their content.
          </p>
        </Section>

        <Section n="05" title="Responsibility and alcohol">
          <p>
            Promillo can be played as a drinking game. Only play with alcohol
            if you are of legal drinking age in your country. Drinking is
            always voluntary, no one is forced. Drink responsibly, know your
            limits, never pressure anyone, and never drive under the influence.
            You are responsible for your own behaviour.
          </p>
        </Section>

        <Section n="06" title="Liability">
          <p>
            The app is provided &quot;as is&quot;. To the extent permitted by
            law, we are not liable for data loss caused by technical outages or
            device problems, or for damages resulting from improper use of the
            app.
          </p>
        </Section>

        <Section n="07" title="Changes and governing law">
          <p>
            We may update these terms as the app evolves; the current version
            is always available at this page. These terms are governed by the
            laws of Switzerland. Place of jurisdiction is Switzerland.
          </p>
          <p>
            Questions? Contact{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
            Our privacy policy is available at{" "}
            <Link href="/promillo/privacy" className="underline">
              getklar.org/promillo/privacy
            </Link>.
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
