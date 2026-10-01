// Terms of Use for Focus Crew (com.podifyapp.app).
//
// Linked from App Store Connect, onboarding (terms_version 2026-10-01 is stored on accept),
// Settings and the paywall. The parts Apple's review checks for an app with user-generated
// content (Guideline 1.2) are in section 04: no tolerance for objectionable content or abusive
// users, a way to report and block, and action within 24 hours.
//
// Structure and the liability/law clauses mirror src/app/podify/terms/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Focus Crew Terms of Use · Klar",
  description: "The rules for using Focus Crew: age, account, study rooms, postcards and community rules, Pro, and liability.",
  robots: { index: true, follow: true },
};

const AS_OF = "1 October 2026";
const CONTACT = "feedback+focuscrew@reply.getklar.org";

export default function FocusCrewTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Focus Crew · Terms · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 48 }}>
          These terms apply between you and Alain Kessler, a sole proprietorship registered in Switzerland operating
          under the brand <i>Klar</i>, for the Focus Crew app. By creating an account you accept them.
        </p>

        <Section n="01" title="Minimum age">
          <p>
            You must be at least 13 to create an account. If you are under the age of majority where you live, a parent
            or guardian should agree to these terms with you. Members under 18 get extra protections: others who are not
            their friends see only an alias, and their postcards are not shown publicly.
          </p>
        </Section>

        <Section n="02" title="Your account">
          <p>
            You sign in with Apple and are responsible for that Apple ID. Keep your display name respectful; it is shown to
            friends and, unless you are under 18 or in ghost mode, in rooms and leaderboards. You can delete your account at
            any time in the app under Settings → Account → Delete account. Deletion is immediate and does not cancel a
            subscription, which lives with your Apple ID.
          </p>
        </Section>

        <Section n="03" title="Study rooms">
          <p>
            Rooms are shared spaces. When you join one, other people see your chibi, your public name, your subject and your
            study time today. When only a few people are in a room, fill-in figures sit at some tables so it never feels
            empty. They are marked &ldquo;Regular&rdquo; with a small house badge, are not real users, and are never counted in
            room totals, leaderboards or statistics.
          </p>
        </Section>

        <Section n="04" title="Community rules and moderation">
          <p>
            There is no tolerance for objectionable content or abusive behaviour. Do not post or use as a display name
            anything that is hateful, harassing, sexual, violent, threatening, illegal, spam, or that shares someone&apos;s
            personal information. Do not impersonate others.
          </p>
          <p>
            You can report any postcard or user and block any user in the app. We review reports and act within 24 hours,
            for example by removing content, resetting a display name or ending an account. Three reports from different
            people hide a postcard or reset a display name automatically until we have looked at it. Text is also filtered
            for banned words before it is posted.
          </p>
        </Section>

        <Section n="05" title="Your content">
          <p>
            Postcards and display names you post remain yours. You give us a non-exclusive, worldwide, free license to store
            and show them in the app to the people allowed to see them, for as long as they are in the app. Deleting a
            postcard or your account ends that license.
          </p>
        </Section>

        <Section n="06" title="Focus Crew Pro">
          <p>
            Pro unlocks the app lock, the Pro rooms, the premium season track and more acorns, as described in the app. It is
            offered as a yearly subscription or as a one-time lifetime purchase, at the prices shown in the app before you buy.
            Payment is charged to your Apple ID. A subscription renews automatically unless you turn it off at least 24 hours
            before the end of the current period; you manage and cancel it in your Apple ID settings. Refunds are handled by
            Apple under its terms.
          </p>
          <p>
            Acorns, items and season rewards are earned by studying. They cannot be bought, have no money value, cannot be
            exchanged or transferred, and end with your account.
          </p>
        </Section>

        <Section n="07" title="The app lock">
          <p>
            The lock uses Apple&apos;s Screen Time and only works while Apple allows it. It is a focus aid, not a security or
            parental-control tool. You can end it in the app at any time, including an emergency unlock.
          </p>
        </Section>

        <Section n="08" title="Termination">
          <p>
            You can stop using the app at any time by deleting your account. We may suspend or end your access if you break
            these terms or use the app in a way that harms the service or other people. Purchases made through Apple remain
            subject to Apple&apos;s terms in either case.
          </p>
        </Section>

        <Section n="09" title="Liability">
          <p>
            The app is provided as it is. To the extent permitted by law we are liable only for intent and gross negligence.
            We are not liable for indirect or consequential damage, for what other members post, or for exam results or other
            outcomes you were hoping the app would produce. Mandatory statutory liability is unaffected.
          </p>
        </Section>

        <Section n="10" title="Changes and governing law">
          <p>
            We may update these terms as the app evolves; the current version is always on this page with the date shown
            below, and the app asks you to accept a new version. Swiss law applies, to the extent that mandatory consumer
            protection law in your country of residence does not say otherwise. Questions go to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/focuscrew" className="underline">Focus Crew</Link> ·{" "}
          <Link href="/focuscrew/privacy" className="underline">Privacy</Link>
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
