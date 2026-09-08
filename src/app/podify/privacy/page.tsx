// Privacy Policy for Podify (com.podifyapp.app).
//
// Linked from App Store Connect (App Privacy + App Information), from the
// in-app Settings and from the paywall. Kept in sync with what the app actually
// does: an iPod Classic as an app. Apple Music through MusicKit, Apple Weather
// through WeatherKit, a map, and the phone's calendar, contacts, photos and
// videos drawn on the click wheel; local alarms; Focus through Apple's Screen
// Time; an optional Sign in with Apple account on Supabase; purchases through
// Apple and RevenueCat; and a one-time anonymous install event to the Klar hub.
//
// Three things need saying out loud because a reviewer will look for them:
//   - Screen Time. The app never learns WHICH apps you picked. The selection is
//     an opaque Apple token stored on the device; we record only that Focus is
//     on and the web filter level.
//   - Calendar, contacts, photos, videos. Read on the device to draw them in
//     the display, kept in memory only, never written to storage by us and
//     never uploaded.
//   - Location. Only while the weather or the map is on screen, only to fetch
//     a forecast from Apple or centre the map. Never sent to us.
//
// Structure mirrors src/app/basalt/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Podify Privacy Policy · Klar",
  description:
    "How Podify handles your data. No ads, no tracking, no selling of data. Your music, your phone's own calendar, contacts and photos on a click wheel — read on the device and never uploaded.",
  robots: { index: true, follow: true },
};

const AS_OF = "8 September 2026";
const CONTACT = "support@getklar.org";

export default function PodifyPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Podify · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Podify turns your iPhone into a classic music player with a click
          wheel. Almost everything it shows you is already on your phone, and
          it stays there. We do not show ads, we do not track you across apps
          or websites, and we never sell your data.
        </p>
        <p className="t-body-lg" style={{ color: "var(--fg-3)", marginBottom: 48, fontSize: 14, lineHeight: 1.55 }}>
          This policy explains what the app reads, what leaves your phone, why,
          and the choices you have.
        </p>

        <Section n="01" title="Who is responsible">
          <p>
            The controller for this app is <b>Alain Kessler</b>, a sole
            proprietorship registered in Switzerland, operating under the brand{" "}
            <i>Klar</i>. For any privacy question or request, contact{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
          </p>
        </Section>

        <Section n="02" title="What stays on your phone">
          <p>
            <b>Your settings.</b> Which body and wallpaper you chose, light or
            dark, the click sounds, the web filter level, and which system
            permissions you have already been asked for. Kept on the device.
          </p>
          <p>
            <b>Notes, alarms and high scores.</b> The notes you type on the
            wheel, the alarms you set in the clock, and your best scores in the
            games are stored on your phone and nowhere else. Deleting the app
            deletes them.
          </p>
          <p>
            <b>The last forecast.</b> The most recent weather answer and the
            name of the place it was for are kept on the device so the display
            is not blank the next time you open the weather.
          </p>
          <p>
            <b>Now playing, for the widget.</b> While a song plays, its title,
            artist, position and play state are written to a small shared
            store on your device (an Apple App Group) so the lock screen, the
            Dynamic Island and the home screen widget can show what the pod is
            on. This record never leaves your phone and is cleared when
            playback stops.
          </p>
        </Section>

        <Section n="03" title="Apple Music">
          <p>
            Music plays through Apple&apos;s MusicKit framework. Apple asks you
            for permission with its own prompt; Podify only reads what it needs
            to draw the wheel — your library&apos;s albums, playlists and
            recently played, the songs in them, and their artwork — and hands
            playback to Apple&apos;s own player. If you search, your search
            term goes to Apple&apos;s catalog through the same framework.
            Nothing about your library, your listening or your searches is
            copied, stored by us or uploaded to us. What Apple does with your
            Apple Music account is governed by Apple&apos;s privacy policy.
          </p>
        </Section>

        <Section n="04" title="Weather, location and the map">
          <p>
            The forecast is Apple Weather, fetched through Apple&apos;s
            WeatherKit framework. To do that the app needs your location, which
            it asks for only for use while the app is open. Your position is
            used only while the weather or the map is on screen: it is sent to
            Apple to get a forecast and to name the place, and it centres the
            map. It is never stored beyond the cached forecast above, and it is
            never sent to us. The map is Apple Maps. There is no background
            location and no location history.
          </p>
        </Section>

        <Section n="05" title="Calendar, contacts, photos and videos">
          <p>
            The pod can show your upcoming events, your address book, and your
            photo and video library. Each of these is read on the device, only
            after you allow it with iOS&apos;s own prompt, and only to draw it
            in the display. The app keeps what it read in memory while it is
            open and forgets it when the app is closed; it never writes any of
            it to storage and never uploads any of it. The calendar is read
            only — the app never creates or changes events. Calling or writing
            to a contact hands over to the phone&apos;s own apps. For photos,
            limited access (a selection instead of the whole library) works
            fine.
          </p>
        </Section>

        <Section n="06" title="Alarms and notifications">
          <p>
            Alarms ring on your phone through Apple&apos;s own alarm system
            where iOS offers it, and otherwise as local notifications scheduled
            on the device. There is no push token and no server involved; we do
            not know whether an alarm fired or whether you dismissed it.
          </p>
        </Section>

        <Section n="07" title="Focus (Screen Time)">
          <p>
            Focus shuts the apps you picked while the music plays. It runs on
            Apple&apos;s Screen Time framework (Family Controls), and the
            selection you make is an opaque token that Apple keeps on the
            device. Podify never learns which apps or websites you chose, and
            neither do we. What the app stores is only that Focus is on and
            which web filter level you set — never what is behind it. You can
            lift Focus in the app at any time, and you can withdraw the Screen
            Time permission altogether in iOS Settings at any time.
          </p>
        </Section>

        <Section n="08" title="The optional account">
          <p>
            The pod works without an account. If you choose to sign in with
            Apple, an account is created on our behalf by Supabase, hosted in
            the European Union. It holds your user id, your email address (or
            Apple&apos;s private relay address, if you chose to hide it), and
            your given name if you shared it — Apple provides the name once,
            on the first sign-in, and we keep it only to greet you in Settings.
            The account exists so that your Podify Pro purchase, and in future
            your settings, follow you to a new phone.
          </p>
          <p>
            You can delete the account in the app under Settings → Account →
            Delete Account. Deletion is immediate and removes the account and
            everything attached to it on our side.
          </p>
        </Section>

        <Section n="09" title="Purchases">
          <p>
            Payments are processed by Apple. To unlock Podify Pro on your
            devices, our subscription provider RevenueCat receives the App
            Store receipt together with an anonymous identifier generated for
            your install, or your account id if you are signed in. We receive
            only the resulting entitlement status (active or not). We never
            receive your card or payment details.
          </p>
        </Section>

        <Section n="10" title="An anonymous install signal">
          <p>
            On first launch the app sends a single anonymous event to our own
            server so we can count installs. It contains a random identifier
            generated on your device, the platform, the app version and build,
            and your app language. No name, email, contacts, advertising
            identifier or location, and it is not linked to your account. It is
            our own server, not a third-party analytics or ad SDK.
          </p>
        </Section>

        <Section n="11" title="What we do not do">
          <p>
            No advertising and no ad networks. No analytics SDK beyond what
            Apple provides to every developer, and only if you have opted in
            with Apple. No cross-app or cross-site tracking, and no advertising
            identifier (IDFA). No microphone, no camera, no clipboard. No
            feed, no public profiles, and nothing about you is visible to
            anyone else. We do not sell or rent personal data to anyone.
          </p>
        </Section>

        <Section n="12" title="Why we process this data">
          <p>
            To provide the app, to keep your Pro purchase across devices, to
            fetch a forecast for where you are, and to understand how many
            people install the app. Legal bases under the GDPR are the
            performance of our contract with you (Art. 6 para. 1 lit. b), your
            consent where iOS asks you for a permission (Art. 6 para. 1 lit.
            a), and our legitimate interest in basic, privacy friendly install
            statistics (Art. 6 para. 1 lit. f). The Swiss Data Protection Act
            (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="13" title="Service providers">
          <p>
            We use a small set of processors, each only to run the service:
          </p>
          <p>
            <b>Apple</b> for Apple Music, Apple Weather, Apple Maps, Sign in
            with Apple, Screen Time, alarms and for all payments — Apple acts
            under its own privacy policy for these. <b>Supabase</b> for account
            authentication and database hosting, located in the European
            Union. <b>RevenueCat</b> for managing purchase entitlements. These
            providers process data on our behalf under data processing
            agreements.
          </p>
        </Section>

        <Section n="14" title="Where data is stored and how long">
          <p>
            Account data is stored on Supabase servers in the European Union
            (Ireland region) for as long as your account exists; deleting the
            account in the app removes it. Purchase entitlements are held by
            RevenueCat for as long as they are needed to honour your purchase.
            Everything else — your settings, notes, alarms, scores, the cached
            forecast and the now-playing record — lives on your phone and goes
            when you delete the app. The anonymous install signal is aggregated
            and cannot be traced back to you.
          </p>
        </Section>

        <Section n="15" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your
            personal data, and to object to or restrict its processing. The
            fastest way to delete everything on our side is the in-app account
            deletion. For any other request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You
            also have the right to lodge a complaint with a data protection
            authority.
          </p>
        </Section>

        <Section n="16" title="Children">
          <p>
            Podify is intended for a general audience and is not directed to
            children. We do not knowingly collect personal data from children
            under 13, or under 16 in the European Union. If you believe a child
            has provided us with personal data, contact us and we will delete it.
          </p>
        </Section>

        <Section n="17" title="Changes to this policy">
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
