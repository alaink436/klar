// Privacy Policy for Pocketmate (com.myloo.app), iPhone and Android.
//
// Linked from App Store Connect, the Google Play listing and the support page.
// One policy for both platforms, because both share one account and one
// backend. The two builds differ in one place: the Android build ships
// without the bowel tracker (lib/healthGate in the app repo, 2026-09-23),
// because Google Play treats that as a health app and this account cannot
// publish those. Everything that exists only on iPhone (the tracker, Apple
// Health sleep, Sign in with Apple, the live lock screen drawing) carries an
// "iPhone only" tag, so the Android reader is never told about a digestive
// diary the Android app does not have.
//
// Checked against the app code on 2026-09-24: no AI photo analysis is called
// any more (the in-app text still lists Anthropic; there is no call site and
// no edge function), so it is deliberately absent here.
// Structure mirrors src/app/basalt/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pocketmate Privacy Policy · Klar",
  description:
    "How Pocketmate for iPhone and Android handles your data. No ads, no selling of data, and your exact location never leaves your phone.",
  robots: { index: true, follow: true },
};

const AS_OF = "24 September 2026";
const CONTACT = "feedback+pocketmate@reply.getklar.org";

export default function PocketmatePrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Pocketmate · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Pocketmate is a home screen widget for two people, or a circle of up to
          five, who like each other. It shows what the others are up to. We do
          not show ads, we do not track you across apps or websites, and we never
          sell your data.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          This policy covers Pocketmate on iPhone and on Android. Both use the
          same account and the same servers. The iPhone app has a few features
          the Android app does not, among them a private tracker and sleep from
          Apple Health. Those parts are marked <Only>iPhone only</Only> and do
          not apply to the Android app.
        </p>

        <Section n="01" title="Who is responsible">
          <p>
            The controller for this app is <b>Alain Kessler</b>, a sole
            proprietorship in Switzerland, operating under the brand{" "}
            <i>Klar</i>. For any privacy question or request, contact{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <Section n="02" title="What we collect">
          <p>
            <b>Account data.</b> Your email address, so you can sign in and keep
            your widgets across devices. If you sign in with Google, we receive
            your email address and basic profile from Google, nothing else. A
            nickname and an avatar are optional and set by you.
          </p>
          <p>
            <Only>iPhone only</Only>
            <b>Sign in with Apple.</b> If you use it, we receive the email
            address Apple gives us, which can be a private relay address instead
            of your real one, and your name if you choose to share it. Nothing
            else.
          </p>
          <p>
            <b>Your circle.</b> Who you are paired with, the people in your
            circle, and when you connected. Only the people you added see what
            you share.
          </p>
          <p>
            <b>What you put on a widget.</b> The status you set, whether you are
            asleep or awake if you tell the app, dates you add such as a
            countdown, a birthday or the day you got together, the doodles you
            draw and the photos you send. These are stored so the others in your
            circle can see them, and they appear in your shared moments
            timeline.
          </p>
          <p>
            <b>Photos you send to one person.</b> A photo for the photo widget,
            or one you send to the person you are paired with, is uploaded to a
            private storage area. Only you and that person can open it, and the
            app shows it through links that expire after an hour. Photos are
            never public.
          </p>
          <p>
            <Only>iPhone only</Only>
            <b>The tracker.</b> The iPhone app includes a private tracker for
            bowel movements. Each entry stores when you logged it. If you add
            details to an entry, such as the type on the Bristol stool scale, a
            colour, symptoms or a note, those are stored with it. This is health
            data, and we process it only with the explicit consent you give when
            you create your account. The people in your circle see at most how
            many entries you logged this week, and your streak and calendar only
            if you switch that on. Bristol type, symptoms, notes and photos are
            never shared with anyone. A photo attached to an entry stays on your
            phone and is not uploaded.
          </p>
          <p>
            <Only>iPhone only</Only>
            <b>Sleep from Apple Health.</b> Only with your explicit consent does
            Pocketmate read your sleep from Apple Health. It reads sleep and
            nothing else, and never writes anything to Health. Whether you are
            asleep and how long you slept is shared only with the person you are
            paired with, and only while that sharing is on. You can withdraw it
            at any time in the app or in the iOS Settings.
          </p>
          <p>
            <b>Distance, if you turn it on.</b> To show how far apart you are,
            the app reads your location while it is open and rounds it to about a
            kilometre before it leaves the phone. Your exact position is never
            sent to us, and the app does not read your location in the
            background.
          </p>
          <p>
            <b>Finding friends in your contacts, if you choose to.</b> Phone
            numbers and email addresses from your address book are turned into
            unreadable checksums on your phone. Only those checksums are compared
            with the ones other users chose to publish, and only the matches come
            back. We do not store your address book or who is in it.
          </p>
          <p>
            <b>Messages to support.</b> If you write to us from inside the app,
            your message is stored so we can answer it.
          </p>
          <p>
            <b>Purchase status.</b> Payments are processed by Apple through the
            App Store on iPhone, and by Google Play on Android. We receive only
            the resulting entitlement status, active or not, through our
            subscription provider RevenueCat. We never receive your card or
            payment details.
          </p>
          <p>
            <b>Notifications.</b> Our server sends you push notifications, for
            example when someone in your circle does something for you or a date
            you share comes up. If you allow notifications, your phone gets a
            push token that we store with your account. We also store the
            language you use the app in and your time zone, so that a
            notification arrives in your language and at a sensible local hour.
            Notifications are delivered through the Expo push service, which
            passes them on to Apple or Google for the last step.
          </p>
          <p>
            <Only>iPhone only</Only>
            <b>Drawings on the lock screen.</b> When someone draws for you, the
            drawing can appear live on your lock screen. For that, your iPhone
            gives us a token for this lock screen display, which we store with
            your account. These updates go from our server straight to
            Apple&apos;s push service.
          </p>
          <p>
            <b>Usage statistics.</b> Which screens are opened, sent to our
            analytics provider PostHog in the European Union. After you sign in
            they are linked to your account ID, never to your name or email.
          </p>
          <p>
            <b>Crash reports.</b> If the app crashes, a technical report (stack
            trace, device model, system version, app version) goes to our own
            crash server in Germany. It is used to fix bugs and nothing else.
          </p>
          <p>
            <b>Recommendation links.</b> If you installed the app through a link
            from someone who recommends it, we compare your IP address and
            browser type once, at your first sign-in, with recent clicks on such
            links, to credit the person who recommended it. The IP address is
            only ever stored as a salted checksum, and the click records are
            deleted after 7 days. Your account keeps only the name of the person
            who recommended the app.
          </p>
        </Section>

        <Section n="03" title="What stays on your phone">
          <p>
            <b>The camera.</b> Used to scan a friend&apos;s QR code, and to take a
            photo for the photo widget if you choose to. A scanned code is read
            on the phone and nothing is recorded.
          </p>
          <p>
            <b>Your exact location, and your address book.</b> See above: only a
            rounded position and unreadable checksums ever leave the device.
          </p>
          <p>
            <b>Appearance.</b> Your theme and how you arranged your widgets are
            kept on the device. The widget images themselves are drawn on your
            phone.
          </p>
        </Section>

        <Section n="04" title="What we do not do">
          <p>
            No advertising and no ad networks. No cross-app or cross-site
            tracking, and no advertising identifier. No precise location and no
            background location. Nothing about you is public: only the people in
            your circle see what you share. We do not sell or rent personal data
            to anyone.
          </p>
          <p>
            The Android app processes no health data at all. On iPhone, health
            data (tracker entries and, if you allow it, sleep) is used only to
            run those features for you, and never for advertising or for anything
            else.
          </p>
        </Section>

        <Section n="05" title="Why we process this data">
          <p>
            To provide the app and your account, to show your circle what you
            share, to send you notifications, to unlock and restore the paid
            features, to fix crashes and to understand how the app is used. Legal
            bases under the GDPR are the performance of our contract with you
            (Art. 6 para. 1 lit. b), our legitimate interest in stable software
            and basic usage statistics (Art. 6 para. 1 lit. f), and your consent
            for location, contacts and notifications (Art. 6 para. 1 lit. a),
            which you can withdraw in the system settings at any time. The Swiss
            Data Protection Act (DSG) applies in parallel.
          </p>
          <p>
            <Only>iPhone only</Only>
            Tracker entries and sleep are health data. We process them only on
            the basis of your explicit consent (Art. 9 para. 2 lit. a GDPR). You
            can withdraw the consent for sleep at any time in the app or in the
            iOS Settings, and the consent for the tracker by deleting your
            account.
          </p>
        </Section>

        <Section n="06" title="Service providers">
          <p>
            <b>Supabase</b> for sign-in, database and file storage, in the
            European Union (Frankfurt). <b>Apple</b> for Sign in with Apple,
            payments and push delivery on iPhone. <b>Google</b> for Google
            sign-in, and for payments and push delivery on Android.{" "}
            <b>Expo</b> for delivering push notifications. <b>RevenueCat</b> for
            subscription entitlements. <b>PostHog</b> for usage statistics, in
            the European Union. <b>Vercel</b> for hosting the web page behind
            recommendation links, which logs the click described above. Crash
            reports go to a server we run ourselves in Germany. These providers
            process data on our behalf under data processing agreements.
          </p>
        </Section>

        <Section n="07" title="Where data is stored and how long">
          <p>
            Your account and everything you share are stored on Supabase servers
            in Frankfurt, Germany, for as long as your account exists. You can
            delete your account at any time in the app: open the Me tab, scroll to
            the bottom and tap Delete account. That removes your account, your
            profile and avatar, your widgets and doodles, your tracker entries on
            iPhone, your notification tokens, and your place in every circle. A
            photo you shared into a pair is kept for the other person until you
            ask us to remove it; write to the address above and we delete it
            within 30 days. How to ask for deletion without the app is described
            at{" "}
            <a href="https://getklar.org/delete-account#pocketmate" className="underline">
              getklar.org/delete-account
            </a>
            . Server logs are kept for at most 30 days.
          </p>
        </Section>

        <Section n="08" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your
            personal data, to withdraw a consent you gave, and to object to or
            restrict its processing. The fastest way to delete everything is the
            in-app account deletion. For any other request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You
            also have the right to lodge a complaint with a data protection
            authority.
          </p>
        </Section>

        <Section n="09" title="Children">
          <p>
            Pocketmate is not directed to children. We do not knowingly collect
            personal data from children under 13, or under 16 in the European
            Union. If you believe a child has provided us with personal data,
            contact us and we will delete it.
          </p>
        </Section>

        <Section n="10" title="Changes to this policy">
          <p>
            We may update this policy as the app evolves. The current version is
            always available at this page, with the date shown below.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Controller Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/pocketmate/terms" className="underline">Terms of Use</Link> ·{" "}
          <Link href="/pocketmate/support" className="underline">Support</Link> ·{" "}
          <Link href="/" className="underline">getklar.org</Link>
        </p>
      </article>
    </main>
  );
}

/** Marks a paragraph that describes an iPhone-only feature. */
function Only({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--fg-3)",
        border: "1px solid var(--line)",
        padding: "1px 6px",
        marginRight: 8,
        whiteSpace: "nowrap",
        verticalAlign: "1px",
      }}
    >
      {children}
    </span>
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
