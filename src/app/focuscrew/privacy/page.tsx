// Privacy Policy for Focus Crew (com.podifyapp.app; the bundle id is inherited from Podify).
//
// Linked from App Store Connect, from the in-app Settings, onboarding and the paywall.
// Kept in sync with what the app does (AI-Brain Projects/Study-Buddies-App/SPEC-v1.md):
// live study rooms where other people see your chibi and timer, an account via Sign in
// with Apple on Supabase (EU), friends, postcards (user-generated content) with reports
// and moderation, study stats and an exam planner, an app lock on Apple's Screen Time,
// purchases through Apple and RevenueCat, local notifications only, and a one-time
// anonymous install event to the Klar hub for adults only.
//
// What a reviewer will look for, said plainly:
//   - Screen Time: the app never learns which apps are locked; only counts (taps on the
//     shield) are stored, never app names.
//   - Minors: no account under 13; under 18 only an alias is shown to non-friends, public
//     postcards are adults-only, and no install attribution is sent.
//   - Account deletion in the app, immediate.
//
// Structure mirrors src/app/podify/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Focus Crew Privacy Policy · Klar",
  description:
    "How Focus Crew handles your data. No ads, no tracking, no selling of data. What others in a study room can see, what we store, and how to delete it.",
  robots: { index: true, follow: true },
};

const AS_OF = "1 October 2026";
const CONTACT = "feedback+focuscrew@reply.getklar.org";

export default function FocusCrewPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Focus Crew · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Focus Crew lets you study live next to other people: you pick a room, start a timer,
          and your chibi sits down at a table with everyone else who is focusing. We do not show
          ads, we do not track you across apps or websites, and we never sell your data.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          This policy explains what we store, what other people can see, why, and the choices you have.
        </p>

        <Section n="01" title="Who is responsible">
          <p>
            The controller for this app is <b>Alain Kessler</b>, a sole proprietorship registered in
            Switzerland, operating under the brand <i>Klar</i>. For any privacy question or request,
            contact <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <Section n="02" title="Your account">
          <p>
            Rooms, friends and stats need an account. You sign in with Apple; the account is created
            by Supabase on our behalf. It holds your user id and the email address Apple gives us (or
            Apple&apos;s private relay address, if you chose to hide yours). In onboarding you add a
            display name, an age band (13 to 15, 16 to 17, or 18 and over), your country and time
            zone, and your answers about how you like to study. We use the age band to apply the
            protections for minors described below, the country for the country leaderboard, and
            the time zone to count your days correctly. We also store the version of the terms you
            accepted.
          </p>
        </Section>

        <Section n="03" title="What other people can see">
          <p>
            <b>In a study room</b>, others see your chibi, your public name, the subject you are
            studying, whether you are focusing or on a break, and how long you have studied today.
            This presence is live and ends when you leave the room.
          </p>
          <p>
            <b>Your public name.</b> Friends you accepted see your display name. Everyone else sees an
            automatic alias if you are under 18, if you turned on ghost mode, or if you have no
            display name. Members under 18 see the alias of everyone who is not their friend.
          </p>
          <p>
            <b>Leaderboards</b> show your public name and your weekly study time, among friends, in
            your country or globally.
          </p>
          <p>
            <b>Postcards</b> are short notes you can post. Public postcards are for adults only;
            postcards from members under 18 are visible to friends only, or stay pending until a
            moderator approves them. Members under 16 only see approved postcards.
          </p>
        </Section>

        <Section n="04" title="What we store to run the app">
          <p>
            Your study sessions (room, subject, planned and actual minutes, how a session ended),
            your subjects, exams and study phases from the planner, daily and weekly totals for your
            stats and streaks, your avatar (the item ids you picked, never a photo), the items and
            acorns you earned, your season progress, your friends and blocked users, your postcards
            and cheers, and the reports you file. All of it is linked to your account and used only
            to provide the app.
          </p>
        </Section>

        <Section n="05" title="The app lock (Screen Time)">
          <p>
            With Pro you can lock apps while you study. The lock runs on Apple&apos;s Screen Time
            framework (Family Controls). The apps you pick are an opaque token that Apple keeps on
            your device: Focus Crew never learns which apps or websites you chose, and neither do we.
            We only store counts for your stats, such as how often you tapped the lock screen during
            a session, never the names of apps. You can end a lock in the app and withdraw the Screen
            Time permission in iOS Settings at any time.
          </p>
        </Section>

        <Section n="06" title="Reports and moderation">
          <p>
            You can report a user or a postcard. A report stores who reported what and the reason you
            gave. A new report sends an email with the reported content to our support inbox so we can
            act within 24 hours. Three reports from different people hide a postcard or reset a display
            name automatically until we review it.
          </p>
        </Section>

        <Section n="07" title="Notifications">
          <p>
            Notifications about your study session, such as its end, are local notifications scheduled on your
            phone. There is no push token and no server involved.
          </p>
        </Section>

        <Section n="08" title="Purchases">
          <p>
            Payments are processed by Apple. To unlock Focus Crew Pro, our subscription provider
            RevenueCat receives the App Store receipt together with your account id. We receive only the
            resulting entitlement status (active or not, and when it ends). We never receive your card or
            payment details.
          </p>
        </Section>

        <Section n="09" title="An anonymous install signal (adults only)">
          <p>
            If your age band is 18 and over, the app sends a single anonymous event to our own server so we
            can count installs. It contains a random identifier generated on your device, the platform, the
            app version and build, and your app language. No name, email, age, study data or advertising
            identifier, and it is not linked to your account. For members under 18 it is never sent.
          </p>
        </Section>

        <Section n="10" title="What we do not do">
          <p>
            No advertising and no ad networks. No analytics SDK. No cross-app or cross-site tracking, and no
            advertising identifier (IDFA). No microphone, no camera, no contacts, no precise location. No
            private messages. We do not sell or rent personal data to anyone.
          </p>
        </Section>

        <Section n="11" title="Children and teenagers">
          <p>
            Focus Crew is for people aged 13 and over. If you choose an age under 13 in onboarding, no account
            is created. For members under 18 we show an alias to anyone who is not their friend, keep their
            postcards out of the public feed, and send no install signal. If you believe a child under 13 has
            created an account, contact us and we will delete it.
          </p>
        </Section>

        <Section n="12" title="Why we process this data">
          <p>
            To provide the app and its social features, to keep your Pro purchase, to keep the community safe,
            and to count installs. Legal bases under the GDPR are the performance of our contract with you
            (Art. 6 para. 1 lit. b), your consent where iOS asks you for a permission (Art. 6 para. 1 lit. a),
            and our legitimate interest in moderation and privacy friendly install statistics (Art. 6 para. 1
            lit. f). The Swiss Data Protection Act (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="13" title="Service providers">
          <p>
            <b>Apple</b> for Sign in with Apple, Screen Time, notifications and all payments, under its own
            privacy policy. <b>Supabase</b> for authentication, database and realtime presence, hosted in the
            European Union (Frankfurt). <b>RevenueCat</b> for purchase entitlements. <b>Resend</b> to deliver
            report emails to our support inbox. These providers process data on our behalf under data
            processing agreements.
          </p>
        </Section>

        <Section n="14" title="How long we keep data">
          <p>
            Your account data is kept for as long as your account exists. Live room presence ends when you leave.
            Reports are kept while they are needed for moderation. Purchase entitlements are held by RevenueCat
            for as long as they are needed to honour your purchase.
          </p>
        </Section>

        <Section n="15" title="Deleting your account">
          <p>
            Delete your account in the app under Settings → Account → Delete account. Deletion is immediate and
            removes your account and everything attached to it on our side: profile, sessions, stats, planner,
            avatar, items, friends, postcards and reports you filed. An active subscription keeps running at Apple
            until you cancel it in your Apple ID settings.
          </p>
        </Section>

        <Section n="16" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your personal data, and to object to or
            restrict its processing. For any request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You also have the right to lodge a
            complaint with a data protection authority.
          </p>
        </Section>

        <Section n="17" title="Changes to this policy">
          <p>
            We may update this policy as the app evolves. The current version is always available at this page,
            with the date shown below.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Controller Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/focuscrew" className="underline">Focus Crew</Link> ·{" "}
          <Link href="/focuscrew/terms" className="underline">Terms</Link>
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
