// Privacy Policy for Basalt - Follow Through (com.wavelenght.app).
//
// Linked from App Store Connect (App Privacy + App Information) and from the
// in-app Settings. Kept in sync with what the app actually does, which for this
// app is more than the usual: Supabase auth, the routines you write and the
// days you tick off, Screen Time enforcement, a read-only share, local
// notifications, an optional calendar export, the camera for invite codes, and
// a one-time clipboard read for influencer attribution.
//
// Two of those need saying out loud because a reviewer will look for them:
//   - Screen Time. The app never learns WHICH apps you picked. The selection is
//     an opaque Apple token stored on the device; we record only that something
//     is shut.
//   - The clipboard. Read once on first cold start, matched against one exact
//     pattern, never stored otherwise. iOS shows its paste banner for it.
//
// Structure mirrors src/app/promillo/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Basalt Privacy Policy · Klar",
  description:
    "How Basalt - Follow Through handles your data. No ads, no tracking, no selling of data. Your routines, the days you tick off, and nothing we do not need.",
  robots: { index: true, follow: true },
};

const AS_OF = "5 August 2026";
const CONTACT = "support@getklar.org";

export default function BasaltPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Basalt · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Basalt helps you keep up a routine. It is a habit app with a home
          screen widget, not a social network. We do not show ads, we do not
          track you across apps or websites, and we never sell your data.
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
            <b>Account data.</b> We store your email address to sign you in and
            to keep your routines across devices. With Sign in with Apple you may
            use Apple&apos;s private relay email; that works fine. A display name
            and a small emoji are optional and set by you.
          </p>
          <p>
            <b>Your routines.</b> The name you type, how often a week you want to
            do it, whether it has an end date, and the days you tick off. The
            name is free text you write yourself — it is stored as you typed it,
            so write it however you like.
          </p>
          <p>
            <b>Sharing, if you use it.</b> You can let one person follow one
            routine. They see that routine&apos;s name and which days of the week
            you ticked off, and nothing else — not your other routines, not your
            email. It is read-only in both directions: they cannot tick a day off
            for you, and you cannot for them. If you have set a display name, the
            person you share with can see it. You can stop sharing at any time,
            which takes their access away immediately.
          </p>
          <p>
            <b>Purchase status.</b> Purchases are processed by Apple. We receive
            only the resulting entitlement status (active or not) through our
            subscription provider RevenueCat. We never receive your card or
            payment details.
          </p>
          <p>
            <b>Anonymous install signal.</b> On first launch the app sends a
            single anonymous event so we can count installs. It contains a random
            identifier generated on your device, the platform, the app version
            and your app language. No name, email, contacts, advertising
            identifier or location, and it is not linked to your account.
          </p>
          <p>
            <b>A one-time clipboard read.</b> If you arrived through a link from
            someone who recommends the app, that link places a short token on
            your clipboard. On the first cold start the app reads the clipboard
            once, and only accepts text matching that exact token format. iOS
            shows its own &ldquo;pasted from&rdquo; notice when this happens.
            Anything else on your clipboard is ignored and never leaves your
            device, and the check does not run again.
          </p>
        </Section>

        <Section n="03" title="What stays on your phone">
          <p>
            <b>Which apps you shut.</b> This is the important one. Blocking runs
            on Apple&apos;s Screen Time framework, and the selection you make is
            an opaque token that Apple keeps on the device. Basalt never learns
            which apps or websites you chose. What we store is only that
            something is shut, and whether the web filter is on — never what is
            behind it.
          </p>
          <p>
            <b>Reminders.</b> The daily nudge is a local notification scheduled on
            your phone. There is no push token and no server involved; we do not
            know whether it fired or whether you opened it.
          </p>
          <p>
            <b>The camera.</b> Used for exactly one thing: reading an invite code
            off another screen. Nothing is recorded, nothing is uploaded, and no
            image ever leaves the device.
          </p>
          <p>
            <b>Your calendar.</b> If you export a plan, the app writes sessions
            into a calendar named &ldquo;Basalt&rdquo; that belongs to you. We do
            not read your other calendars or events.
          </p>
          <p>
            <b>Appearance and layout.</b> Your light/dark choice and how you
            arranged the widget are kept on the device.
          </p>
        </Section>

        <Section n="04" title="What we do not do">
          <p>
            No advertising and no ad networks. No cross-app or cross-site
            tracking, and no advertising identifier (IDFA). No location data, no
            access to your contacts, photos or microphone. No feed, no public
            profiles, and nothing about you is visible to anyone you have not
            explicitly shared a routine with. We do not sell or rent personal
            data to anyone.
          </p>
        </Section>

        <Section n="05" title="Why we process this data">
          <p>
            To provide the app and your account, to keep your routines and your
            history, to unlock and restore the paid features, and to understand
            how many people install the app. Legal bases under the GDPR are the
            performance of our contract with you (Art. 6 para. 1 lit. b) and our
            legitimate interest in basic, privacy friendly install statistics
            (Art. 6 para. 1 lit. f). The Swiss Data Protection Act (DSG) applies
            in parallel.
          </p>
        </Section>

        <Section n="06" title="Service providers">
          <p>
            We use a small set of processors, each only to run the service:
          </p>
          <p>
            <b>Apple</b> for Sign in with Apple, for Screen Time, and for all
            payments. <b>Supabase</b> for account authentication and database
            hosting, located in the European Union. <b>RevenueCat</b> for
            managing subscription entitlements. These providers process data on
            our behalf under data processing agreements.
          </p>
        </Section>

        <Section n="07" title="Where data is stored and how long">
          <p>
            Account data and your routines are stored on Supabase servers in the
            European Union (Ireland region). We keep them for as long as your
            account exists. You can delete your account at any time in the app
            under Settings; that removes your account, your routines, every day
            you have ticked off, and any share you had set up. The anonymous
            install signal is aggregated and cannot be traced back to you.
          </p>
        </Section>

        <Section n="08" title="Your rights">
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

        <Section n="09" title="Children">
          <p>
            Basalt is intended for a general audience and is not directed to
            children. We do not knowingly collect personal data from children
            under 13, or under 16 in the European Union. If you believe a child
            has provided us with personal data, contact us and we will delete it.
          </p>
        </Section>

        <Section n="10" title="Changes to this policy">
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
