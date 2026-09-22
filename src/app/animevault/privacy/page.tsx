// Privacy Policy for Anime Vault (com.animevault.app).
//
// Linked from App Store Connect, from the Play Store listing and from the
// in-app legal screen. Replaces the old address, a bare Vercel deployment URL
// (privacy-site-fa1wirdr2-…vercel.app) that sat behind Vercel's deployment
// protection: it answered 200, but with a Vercel login page, so no reviewer
// could ever read it.
//
// Content follows the app's own legal text (constants/legalContent.ts in the
// app repo), plus the two things that text leaves out and a reviewer looks for:
// purchases run through RevenueCat, and push notifications need a device token.
//
// Structure mirrors src/app/basalt/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Anime Vault Privacy Policy · Klar",
  description:
    "How Anime Vault handles your data. No ads, no tracking, no selling of data. Your watchlist, your account, and nothing we do not need.",
  robots: { index: true, follow: true },
};

const AS_OF = "22 September 2026";
const CONTACT = "help.klar@gmail.com";

export default function AnimeVaultPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Anime Vault · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Anime Vault keeps track of the anime you are watching. We do not show
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
            <b>Account data.</b> Your email address, so you can sign in and keep
            your watchlist across devices.
          </p>
          <p>
            <b>Your watchlist.</b> The anime you save, your ratings and how far
            you have watched.
          </p>
          <p>
            <b>Profile data.</b> A username, a display name and an avatar. All
            three are optional and set by you.
          </p>
          <p>
            <b>Purchase status.</b> Payments are processed by Apple or Google. We
            receive only the resulting entitlement status, active or not, through
            our subscription provider RevenueCat. We never receive your card or
            payment details.
          </p>
          <p>
            <b>Notifications, if you allow them.</b> If you turn on reminders for
            new episodes, your device gets a push token that we store with your
            account so we can send that notification. Turning notifications off
            in the system settings stops it.
          </p>
          <p>
            <b>Anonymised usage statistics.</b> Counts such as how often a screen
            is opened, without personal attribution and not linked to your
            account.
          </p>
        </Section>

        <Section n="03" title="The community part">
          <p>
            The app has a forum and friends, and what you do there is visible to
            other people by design. Posts, replies and votes are stored with your
            account and shown with your profile name and avatar. Friend requests,
            friendships and the list of people you blocked are stored too; a
            block is visible to nobody but you. An avatar you upload is stored as
            a file under your account. Deleting your account removes all of it.
          </p>
        </Section>

        <Section n="04" title="Linked anime accounts">
          <p>
            You can connect an AniList or MyAnimeList account to import and sync
            your list. The access token that the service issues stays on your
            phone and is never sent to us; the app uses it to read and write your
            list there, and deletes it when you disconnect. If you never connect
            an account, the app asks those services only for public anime
            metadata, without saying who is asking.
          </p>
        </Section>

        <Section n="05" title="What we do not do">
          <p>
            No advertising and no ad networks. No cross-app or cross-site
            tracking, and no advertising identifier. No location data, no access
            to your contacts, photos or microphone. We do not sell or rent
            personal data to anyone.
          </p>
        </Section>

        <Section n="06" title="Why we process this data">
          <p>
            To provide the app and your account, to keep your watchlist, to
            unlock and restore the paid features, and to understand how the app
            is used. Legal bases under the GDPR are the performance of our
            contract with you (Art. 6 para. 1 lit. b), our legitimate interest in
            basic, privacy friendly statistics (Art. 6 para. 1 lit. f) and your
            consent for optional features such as notifications (Art. 6 para. 1
            lit. a). The Swiss Data Protection Act (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="07" title="Service providers">
          <p>
            <b>Supabase</b> for account authentication and database hosting,
            located in the European Union. <b>RevenueCat</b> for managing
            subscription entitlements. <b>Apple</b> and <b>Google</b> for
            payments and for delivering notifications. <b>AniList</b> and the{" "}
            <b>Jikan</b> API for anime metadata. These providers process data on
            our behalf under data processing agreements.
          </p>
        </Section>

        <Section n="08" title="Where data is stored and how long">
          <p>
            Account data, your watchlist and your profile are stored on Supabase
            servers in the European Union. We keep them for as long as your
            account exists. You can delete your account at any time in the app
            settings, which removes your account, your watchlist, your profile, your posts and your friendships. Server logs are kept for at most 30 days.
          </p>
        </Section>

        <Section n="09" title="Your rights">
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

        <Section n="10" title="Anime data and external links">
          <p>
            Titles, descriptions and images come from external sources such as
            AniList and MyAnimeList, and the rights stay with their respective
            holders. The app links to external streaming services; those sites
            are run by their providers, under their own terms and their own
            privacy policies.
          </p>
        </Section>

        <Section n="11" title="Children">
          <p>
            Anime Vault is intended for a general audience and is not directed to
            children. We do not knowingly collect personal data from children
            under 13, or under 16 in the European Union. If you believe a child
            has provided us with personal data, contact us and we will delete it.
          </p>
        </Section>

        <Section n="12" title="Changes to this policy">
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
