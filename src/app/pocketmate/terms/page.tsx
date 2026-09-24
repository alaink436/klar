// Terms of Use for Pocketmate (com.myloo.app), iPhone and Android.
//
// Linked from App Store Connect, the Google Play listing and the support page.
// Required by Apple Guideline 3.1.2 for apps offering auto-renewable
// subscriptions: the app must link to FUNCTIONAL terms.
//
// Content follows the in-app TERMS in constants/legal.ts of the app repo,
// adapted to the web and to both stores. The Android build ships without the
// bowel tracker (lib/healthGate, 2026-09-23), so everything about the tracker
// is framed as iPhone only. What Pro contains is deliberately described by
// example and pointed at the paywall, because the list moves faster than
// this page.
//
// Structure mirrors src/app/basalt/terms/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pocketmate Terms of Use · Klar",
  description:
    "The terms for using Pocketmate on iPhone and Android: what is free, how the subscription renews and how to cancel it, what others see, and what we are liable for.",
  robots: { index: true, follow: true },
};

const AS_OF = "24 September 2026";
const CONTACT = "feedback+pocketmate@reply.getklar.org";

export default function PocketmateTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Pocketmate · Terms of Use · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          These terms govern your use of Pocketmate on iPhone and Android,
          published by Alain Kessler, a sole proprietorship in Switzerland,
          operating under the brand <i>Klar</i>.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          By using the app you agree to them. If you do not, please do not use
          the app.
        </p>

        <Section n="01" title="About Pocketmate">
          <p>
            Pocketmate puts the two of you on each other&apos;s home screen. The
            app provides widgets, such as status, sleep, distance, a countdown,
            doodles and a shared photo, that show what the other person is up
            to.
          </p>
          <p>
            On iPhone, the app also includes a private tracker. The tracker
            stays a private diary: only what is listed under &quot;What others
            see&quot; is shared. The Android app does not include the tracker.
          </p>
        </Section>

        <Section n="02" title="Not medical advice">
          <p>
            Pocketmate is not a medical device and does not replace professional
            medical advice, diagnosis or treatment. Insights, scores and tips in
            the tracker are general gut health guidance only. For medical
            questions or persistent symptoms, please consult a doctor.
          </p>
        </Section>

        <Section n="03" title="Account and age">
          <p>
            Pocketmate requires an account. You confirm that you are at least 16
            years old, or have the consent of a parent or guardian. An account
            belongs to one person. Keep your sign-in details safe and do not
            share them. We grant you a personal, non-transferable, non-exclusive
            licence to use the app on devices you own or control.
          </p>
        </Section>

        <Section n="04" title="What others see">
          <p>
            You decide what you put on a widget, and the people it is meant for
            see it. Sleep and location are shared only if you enable them
            individually. Your location is rounded to about a
            kilometre before it leaves your device, so the other person sees a
            distance, never an address.
          </p>
          <p>
            On iPhone, people in your circle see at most how many tracker
            entries you logged this week, and your streak and calendar only if
            you switch that on. Bristol type, symptoms, notes and photos from the
            tracker are never shared.
          </p>
          <p>
            You can turn any sharing back off and remove people from your circle
            at any time.
          </p>
        </Section>

        <Section n="05" title="Playing fair">
          <p>
            Only connect with people who want to connect with you. No
            harassment, no passing on what you see about others, and no
            misrepresenting who you are. Only send photos and drawings you have
            the right to share. Do not attempt to reverse engineer the app or to
            attack the service. We may suspend accounts that break this.
          </p>
        </Section>

        <Section n="06" title="Free features">
          <p>
            One home screen widget and a circle of up to five people are free,
            permanently. On iPhone, logging entries in the tracker is free as
            well.
          </p>
        </Section>

        <Section n="07" title="Subscription (Pocketmate Pro)">
          <p>
            Pocketmate Pro unlocks the paid features, for example all widgets
            and themes, including the ones still coming, and a circle without
            the five-seat limit. What Pro includes, its price in your currency
            and the billing period are shown in the app before you buy.
          </p>
          <p>
            <b>On iPhone,</b> the subscription is billed through your Apple ID
            and the App Store. Payment is charged to your Apple ID at
            confirmation of purchase. <b>On Android,</b> it is billed through
            your Google account and Google Play, and payment is charged when you
            confirm the purchase.
          </p>
          <p>
            A subscription renews automatically for the same period until you
            cancel it. On iPhone, it renews unless you cancel at least 24 hours
            before the end of the current period, and the renewal is charged
            within the 24 hours before that end. On Android, it renews unless
            you cancel before the renewal date. If an offer includes a free
            trial, the trial turns into a paid subscription at its end unless
            you cancel before. Any unused part of a free trial is forfeited when
            you buy a subscription.
          </p>
        </Section>

        <Section n="08" title="Cancellation and refunds">
          <p>
            You manage and cancel a subscription in your store account, not in
            Pocketmate, because Apple and Google do not give apps that control.
            On iPhone, open the Settings app, tap your name, then Subscriptions.
            On Android, open the Google Play Store, tap your profile picture,
            then Payments and subscriptions, then Subscriptions.
          </p>
          <p>
            Cancelling stops the next renewal; the current period runs to its
            end. Deleting the app or your Pocketmate account does not cancel a
            subscription. Invoices and refunds are handled by Apple or Google
            under their rules, not by us. We are still happy to help if you have
            questions.
          </p>
        </Section>

        <Section n="09" title="Your content and your data">
          <p>
            Your data is yours. We store what you create and share only to
            deliver the service: no advertising, no resale, no ad tracking. How
            we handle it is described in the{" "}
            <Link href="/pocketmate/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section n="10" title="Termination">
          <p>
            You can delete your account in the app at any time: open the Me tab,
            scroll to the bottom and tap Delete account. Your data is then removed
            within 30 days, as the Privacy Policy describes. We may suspend accounts that violate these terms.
          </p>
        </Section>

        <Section n="11" title="Availability and liability">
          <p>
            Pocketmate is provided as it is. We aim for reliable service but
            cannot guarantee uninterrupted availability, and widgets refresh on a
            schedule the operating system of your phone decides, not us. To the
            extent permitted by law, our liability is limited to the amount you
            paid for the app in the last 12 months. Mandatory statutory liability
            is unaffected.
          </p>
        </Section>

        <Section n="12" title="Changes and governing law">
          <p>
            We may update these terms as the app evolves; the current version is
            always on this page with the date shown below. Material changes will
            be announced by email or in the app. Swiss law applies. Mandatory
            consumer protection rights in your country of residence are
            unaffected. Apple&apos;s standard licensed application end user
            licence agreement applies to purchases through the App Store, and
            the Google Play terms to purchases through Google Play.
          </p>
          <p>
            Questions go to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/pocketmate/privacy" className="underline">Privacy Policy</Link> ·{" "}
          <Link href="/pocketmate/support" className="underline">Support</Link> ·{" "}
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
