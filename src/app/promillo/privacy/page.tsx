// Privacy Policy for the Promillo party-game app (com.promillo.app).
// Linked from App Store Connect (App Privacy + App Information) and from the
// in-app Settings. Kept in sync with what the app actually collects:
// Supabase auth (optional account), Apple/RevenueCat purchase state, and a
// one-time anonymous install ping to the Klar hub. No ads, no tracking.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Promillo Privacy Policy · Klar",
  description:
    "How the Promillo party-game app handles your data. No ads, no tracking, no selling of data. Account email and purchase state only, plus an anonymous install count.",
  robots: { index: true, follow: true },
};

const AS_OF = "5 June 2026";
const CONTACT = "support@getklar.org";

export default function PromilloPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Promillo · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Promillo is a party game you play together on one phone. We keep data
          collection to the bare minimum. We do not show ads, we do not track
          you across apps or websites, and we never sell your data.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          This policy explains what we collect, why, and the choices you have.
        </p>

        <Section n="01" title="Who is responsible">
          <p>
            The controller for this app is <b>Alain Kessler</b>, a sole
            proprietorship registered in Switzerland, operating under the brand{" "}
            <i>Klar</i>. For any privacy question or request, contact{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <Section n="02" title="What we collect">
          <p>
            <b>Account data (optional).</b> You can play as a guest without an
            account. If you create an account or use Sign in with Apple, we
            store your email address to sign you in and to sync your premium
            status across your devices. With Sign in with Apple you may use
            Apple&apos;s private relay email; that works fine.
          </p>
          <p>
            <b>Purchase and subscription status.</b> When you buy Promillo PRO,
            the purchase is processed by Apple. We receive only the resulting
            entitlement status (active or not) through our subscription provider
            RevenueCat. We never receive your card or payment details.
          </p>
          <p>
            <b>Anonymous install signal.</b> On first launch the app sends a
            single anonymous event so we can count installs. It contains a random
            identifier generated on your device, the platform (iOS or Android),
            the app version and your app language. It contains no name, email,
            contacts, advertising identifier or location, and it is not linked to
            your account.
          </p>
          <p>
            <b>On your device only.</b> Player names, chosen avatars and game
            settings stay on your device and are not sent to us.
          </p>
        </Section>

        <Section n="03" title="What we do not do">
          <p>
            No advertising and no ad networks. No cross-app or cross-site
            tracking, and no advertising identifier (IDFA). No location data, no
            access to your contacts, photos or microphone. We do not sell or rent
            personal data to anyone.
          </p>
        </Section>

        <Section n="04" title="Why we process this data">
          <p>
            To provide the app and your account, to unlock and restore Promillo
            PRO, and to understand how many people install the app. Legal bases
            under the GDPR are the performance of our contract with you (Art. 6
            para. 1 lit. b) and our legitimate interest in basic, privacy
            friendly install statistics (Art. 6 para. 1 lit. f). The Swiss Data
            Protection Act (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="05" title="Service providers">
          <p>
            We use a small set of processors, each only to run the service:
          </p>
          <p>
            <b>Apple</b> for Sign in with Apple and for all payments and
            subscriptions. <b>Supabase</b> for account authentication and
            database hosting, located in the European Union. <b>RevenueCat</b>{" "}
            for managing subscription entitlements. These providers process data
            on our behalf under data processing agreements.
          </p>
        </Section>

        <Section n="06" title="Where data is stored and how long">
          <p>
            Account data is stored on Supabase servers in the European Union
            (Frankfurt region). We keep your account data for as long as your
            account exists. You can delete your account at any time in the app
            under Settings, which removes your account data from our systems. The
            anonymous install signal is aggregated and cannot be traced back to
            you.
          </p>
        </Section>

        <Section n="07" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your
            personal data, and to object to or restrict its processing. The
            fastest way to delete everything is the in-app account deletion. For
            any other request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You
            also have the right to lodge a complaint with a data protection
            authority.
          </p>
        </Section>

        <Section n="08" title="Children">
          <p>
            Promillo is intended for a general audience and is not directed to
            children. We do not knowingly collect personal data from children
            under 13, or under 16 in the European Union. If you believe a child
            has provided us with personal data, contact us and we will delete it.
          </p>
        </Section>

        <Section n="09" title="Changes to this policy">
          <p>
            We may update this policy as the app evolves. The current version is
            always available at this page, with the date shown below. Material
            changes will be reflected here before they take effect.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Controller Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
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
