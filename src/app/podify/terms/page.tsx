// Terms of Use (EULA) for Podify (com.podifyapp.app).
//
// Linked from App Store Connect (App Description EULA link), from the in-app
// Settings and from the paywall. Required by Apple Guideline 3.1.2 for apps
// offering auto-renewable subscriptions: the app must contain a FUNCTIONAL
// link to these terms, on the purchase screen itself.
//
// Sections here that Basalt's does not have, because Podify does things a
// habit app does not: it plays music from Apple Music (a third-party
// subscription with its own terms), it shows Apple Weather and Apple Maps, and
// it sells a lifetime purchase next to the subscriptions. The Focus section is
// Basalt's blocking section, cut down to Podify's single switch.
//
// Structure mirrors src/app/basalt/terms/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podify Terms of Use (EULA) · Klar",
  description:
    "Terms of Use and end user license agreement for Podify, including the subscription and lifetime purchase terms and what Focus does and does not promise.",
  robots: { index: true, follow: true },
};

const AS_OF = "8 September 2026";
const CONTACT = "support@getklar.org";

export default function PodifyTermsPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Podify · Terms of Use (EULA) · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Terms of <span className="editorial">Use.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          These terms govern your use of Podify, published by Alain Kessler
          (Klar), a sole proprietorship registered in Switzerland.
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
          <p>
            Podify is an independent app. It is not made by, affiliated with or
            endorsed by Apple. iPod, Apple Music and the other Apple names are
            trademarks of Apple Inc.
          </p>
        </Section>

        <Section n="02" title="Free and Podify Pro">
          <p>
            The player is free and stays free: the wheel, your Apple Music
            library, cover flow, the extras, the lock screen and Dynamic Island
            display, and the black body. Podify Pro adds Focus with its web
            filter, the other bodies, and the glow behind the display. What Pro
            contains is listed in the app before you buy; features named there
            as coming later are not promised for a date.
          </p>
          <p>
            Pro is sold three ways: a yearly subscription, a monthly
            subscription, and a one-time lifetime purchase. A subscription
            renews automatically for the same period unless it is cancelled at
            least 24 hours before the end of the current period. Your Apple ID
            is charged at confirmation of purchase and again on each renewal.
            The lifetime purchase is charged once and does not renew. Prices
            are shown in the app before you buy, in your local currency; the
            app carries no price of its own, and any introductory offer or free
            trial is exactly what the App Store shows at the time.
          </p>
          <p>
            All purchases are made through Apple and are subject to Apple&apos;s
            Media Services terms. Refunds are handled by Apple under Apple&apos;s
            rules; we cannot issue them ourselves. Restoring a purchase on a new
            device works through Apple&apos;s restore or, if you have signed
            in, through your account.
          </p>
        </Section>

        <Section n="03" title="Cancellation">
          <p>
            You manage and cancel a subscription in the App Store, under your
            Apple ID subscription settings — not in Podify, because Apple does
            not give apps that control. Cancelling stops the next renewal; the
            current period runs to its end. Deleting the app does not cancel a
            subscription.
          </p>
        </Section>

        <Section n="04" title="What Focus is, and what it is not">
          <p>
            Focus shuts the apps you picked while the music plays. It uses
            Apple&apos;s Screen Time framework and it is a deterrent for
            yourself, not a security control and not a guarantee. Apple decides
            what the framework can reach, iOS updates change its behaviour, and
            you can always lift Focus in the app or withdraw the permission in
            iOS Settings. We accept no liability for an app that was or was not
            blocked, or for a website the web filter let through or held back.
          </p>
          <p>
            Focus is not a parental control. It is built for the person holding
            the phone to shut their own apps; it is not designed or supported
            for supervising someone else&apos;s device.
          </p>
          <p>
            The app never learns which apps or websites you chose — that
            selection stays on your device as an opaque Apple token. The switch
            that lifts Focus is never behind the paywall. If your Pro purchase
            lapses, the app stops arming new blocks and releases the web filter,
            so a lapsed subscription can never leave your own phone locked.
          </p>
        </Section>

        <Section n="05" title="Apple Music, Spotify and other services">
          <p>
            Podify plays music you already have access to; it does not sell,
            stream or store music itself. Apple Music is a service of Apple with
            its own terms and its own subscription. Playing full songs needs an
            Apple Music subscription; without one, the catalog plays short
            previews. Availability of songs, artwork and features is
            Apple&apos;s, and if Apple changes or withdraws something the pod
            can no longer show it.
          </p>
          <p>
            The same applies to Spotify, when available in the app: it is a
            third-party service with its own terms, and it may require a
            Spotify Premium subscription. We do not control either service and
            are not responsible for their availability, content or pricing.
          </p>
        </Section>

        <Section n="06" title="Weather and maps">
          <p>
            The forecast is provided by Apple Weather and the map by Apple
            Maps. Both are shown as we receive them and may be inaccurate,
            delayed or unavailable. Do not rely on the pod&apos;s forecast or
            map for decisions where being wrong would be dangerous.
          </p>
        </Section>

        <Section n="07" title="Your content and your phone">
          <p>
            The notes, alarms and scores you make in the pod are stored on your
            phone and belong to you. We keep no copy of them, so they are not
            backed up by us and are gone when you delete the app. What the pod
            reads from your phone — calendar, contacts, photos, videos — stays
            there and is never used for anything but showing it to you.
          </p>
        </Section>

        <Section n="08" title="Account">
          <p>
            An account is optional and created with Sign in with Apple. It
            exists to tie your Pro purchase to you across devices. You are
            responsible for the Apple ID you sign in with. You can delete the
            account at any time in the app under Settings → Account; deletion is
            immediate and does not cancel a subscription, which lives with your
            Apple ID.
          </p>
        </Section>

        <Section n="09" title="Termination">
          <p>
            You can stop using the app at any time by deleting it and, if you
            have one, deleting your account. We may suspend or end your access
            if you break these terms or use the app in a way that harms the
            service or other people. Purchases made through Apple remain
            subject to Apple&apos;s terms in either case.
          </p>
        </Section>

        <Section n="10" title="Liability">
          <p>
            The app is provided as it is. To the extent permitted by law we are
            liable only for intent and gross negligence. We are not liable for
            indirect or consequential damage, for lost data where you have not
            kept your own record, for an alarm that did not ring, or for
            outcomes you were hoping the app would produce. Mandatory statutory
            liability is unaffected.
          </p>
        </Section>

        <Section n="11" title="Changes and governing law">
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
