// Privacy Policy for My Yarn Stash (com.yarnstash.app).
//
// Linked from App Store Connect (App Privacy + App Information), from the
// Google Cloud OAuth consent screen, and from the in-app Settings. Written
// against what the app actually does as of August 2026 — a row counter with a
// yarn stash attached: Supabase auth (email, Apple, Google), stash entries and
// photos, row counts on projects, an AI label scanner (Premium) that sends one
// photo per scan to Anthropic, local-only notifications, crash reporting on our
// own server, and a one-time clipboard read for influencer attribution.
//
// Two things need saying out loud because a reviewer will look for them:
//   - The camera has exactly two jobs: scanning a yarn label / yarn photo
//     (image goes to our server and on to Anthropic for extraction, then is
//     discarded) and reading an invite QR code (never leaves the device).
//   - Repeat and side counters live in device storage only; they never reach
//     our servers at all.
//
// Structure mirrors src/app/basalt/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My Yarn Stash Privacy Policy · Klar",
  description:
    "How My Yarn Stash handles your data. No ads, no tracking, no selling of data. Your yarn, your projects, your row counts, and nothing we do not need.",
  robots: { index: true, follow: true },
};

const AS_OF = "13 August 2026";
const CONTACT = "support@getklar.org";

export default function YarnstashPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          My Yarn Stash · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          My Yarn Stash is a row counter for knitting and crochet, with a place
          to keep your yarn. It is a tool, not a social network. We do not show
          ads, we do not track you across apps or websites, and we never sell
          your data.
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
            to keep your stash across devices. You can sign in with email, with
            Apple, or with Google. With Sign in with Apple you may use
            Apple&apos;s private relay email; that works fine. When you sign in
            with Google, we receive your email address and basic profile from
            Google — nothing else from your Google account. A display name and
            an avatar are optional and set by you.
          </p>
          <p>
            <b>Your stash and projects.</b> The yarn entries you create — name,
            brand, color, fiber, weight, yardage, price, notes — the patterns
            and projects you add, and the photos you attach. Photos are stored
            with your account so they follow you across devices. Free accounts
            can keep up to 30 entries; this limit is enforced on our server.
          </p>
          <p>
            <b>Your counting.</b> The current row count and target rows of a
            project, and — if you use the timer — how long you have worked on
            it. Repeat counters and side counters are stored on your device
            only and never reach our servers.
          </p>
          <p>
            <b>Purchase status.</b> Purchases are processed by Apple. We receive
            only the resulting entitlement status (active or not) through our
            subscription provider RevenueCat. We never receive your card or
            payment details.
          </p>
          <p>
            <b>Crash reports.</b> If the app crashes, a technical report (stack
            trace, device model, app version) is sent to our own self-hosted
            crash server. These reports are for fixing bugs and are not used for
            advertising or profiling.
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

        <Section n="03" title="The camera and the label scanner">
          <p>
            The camera has exactly two jobs, and you choose when to use it.
          </p>
          <p>
            <b>Scanning a yarn label (Premium).</b> When you photograph a yarn
            label — or the yarn itself, if the label is long gone — that one
            photo is sent to our server and passed to Anthropic&apos;s Claude
            model, which reads brand, fiber and yardage out of the image. The
            photo is used for that single extraction and is not kept by us
            afterwards; only the extracted text fields you choose to save end up
            in your stash. Scans are rate-limited on our server.
          </p>
          <p>
            <b>Reading an invite code.</b> The scanner that reads a friend&apos;s
            QR invite code runs entirely on your device. Nothing is recorded and
            no image leaves your phone.
          </p>
        </Section>

        <Section n="04" title="What stays on your phone">
          <p>
            <b>Repeat and side counters.</b> The rhythm of your pattern
            (&ldquo;increase every 6 rows&rdquo;) and any extra counters you run
            alongside a project are stored in the app&apos;s local storage on
            your device.
          </p>
          <p>
            <b>Reminders.</b> Project reminders and the monthly summary are
            local notifications scheduled on your phone. There is no push
            server involved; we do not know whether they fired or whether you
            opened them.
          </p>
          <p>
            <b>Appearance and language.</b> Your theme and language choices are
            kept on the device.
          </p>
        </Section>

        <Section n="05" title="What we do not do">
          <p>
            No advertising and no ad networks. No cross-app or cross-site
            tracking, and no advertising identifier (IDFA). No location data, no
            access to your contacts or microphone. Photo library access happens
            only when you actively pick a photo to attach. There is no feed and
            no public profile. We do not sell or rent personal data to anyone.
          </p>
        </Section>

        <Section n="06" title="Why we process this data">
          <p>
            To provide the app and your account, to keep your stash, projects
            and row counts across devices, to run the label scanner when you ask
            for it, to unlock and restore the paid features, and to fix crashes.
            Legal bases under the GDPR are the performance of our contract with
            you (Art. 6 para. 1 lit. b) and our legitimate interest in keeping
            the app working (Art. 6 para. 1 lit. f). The Swiss Data Protection
            Act (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="07" title="Service providers">
          <p>
            We use a small set of processors, each only to run the service:
          </p>
          <p>
            <b>Apple</b> for Sign in with Apple and for all payments.{" "}
            <b>Google</b> for Sign in with Google, if you choose it.{" "}
            <b>Supabase</b> for account authentication, database and photo
            storage, located in the European Union. <b>RevenueCat</b> for
            managing subscription entitlements. <b>Anthropic</b> for the label
            scanner: it receives the single photo you scan and returns the
            extracted text. These providers process data on our behalf under
            data processing agreements.
          </p>
        </Section>

        <Section n="08" title="Where data is stored and how long">
          <p>
            Account data, your stash and your photos are stored on Supabase
            servers in the European Union. Crash reports are stored on our own
            server. We keep your data for as long as your account exists. You
            can delete your account at any time in the app under Settings; that
            removes your account, your stash, your projects, your photos and
            your counts.
          </p>
        </Section>

        <Section n="09" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your
            personal data, and to object to or restrict its processing. The
            app can export your whole stash as CSV or PDF at any time, and the
            fastest way to delete everything is the in-app account deletion. For
            any other request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You
            also have the right to lodge a complaint with a data protection
            authority.
          </p>
        </Section>

        <Section n="10" title="Children">
          <p>
            My Yarn Stash is intended for a general audience and is not directed
            to children. We do not knowingly collect personal data from children
            under 13, or under 16 in the European Union. If you believe a child
            has provided us with personal data, contact us and we will delete it.
          </p>
        </Section>

        <Section n="11" title="Changes to this policy">
          <p>
            We may update this policy as the app evolves. The current version is
            always available at this page, with the date shown below. Material
            changes will be reflected here before they take effect.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Controller Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/yarnstash" className="underline">My Yarn Stash</Link> ·{" "}
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
