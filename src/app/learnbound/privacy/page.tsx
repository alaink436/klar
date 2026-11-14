// Privacy Policy for Learnbound (com.podifyapp.app; the bundle id is inherited from Podify,
// the app was called Focus Crew until 8 October 2026).
//
// Linked from App Store Connect, from the in-app Settings, onboarding and the paywall.
// Rewritten on 25 October 2026 for the build that goes to review as 1.2.0, every statement
// checked against alaink436/Podify origin/learnbound (8211d3f): the study rooms, the shop of
// the old rooms, the season pass and postcards are hidden (ROOMS_ENABLED = false, ADR 0003),
// so they are gone from this page. What the build has: sign-in with Apple, Google (Android,
// laptop) or an email code on Supabase (EU, Frankfurt); friends, shared sessions, nudges and
// invitations as push through Expo; the Box-Zimmer furnished with minutes; the notebook (Heft)
// with one page as the moodboard; the laptop paired by QR code; the Lern-Brain whose material
// and AI stay in the laptop's browser (ADR 0007); the Wishboard on UserJot; an app lock on
// Screen Time (Android: usage access and overlay); purchases through Apple, Google and
// RevenueCat; creator links through Detour; an anonymous install event for adults only.
//
// What a reviewer will look for, said plainly:
//   - Screen Time: the app never learns which apps are locked; only counts (taps on the
//     shield) are stored, never app names.
//   - Minors: no account under 13; under 18 only an alias is shown to non-friends, no country
//     or global leaderboard, no name to the Wishboard, no install event, no creator handle.
//   - User content: display names and the moodboard, both reportable; account deletion in the
//     app, immediate.
//
// Structure mirrors src/app/podify/privacy/page.tsx.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learnbound Privacy Policy · Klar",
  description:
    "How Learnbound handles your data. No ads, no selling of data. What the AR box uses, what others can see, what we store, and how to delete it.",
  robots: { index: true, follow: true },
};

const AS_OF = "25 October 2026";
const CONTACT = "feedback+learnbound@reply.getklar.org";

export default function LearnboundPrivacyPage() {
  return (
    <main className="min-h-screen relative z-10 px-4 sm:px-8 py-16 sm:py-24" style={{ color: "var(--fg)" }}>
      <article className="max-w-3xl mx-auto" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
        <div className="label mb-3" style={{ color: "var(--fg-3)" }}>
          Learnbound · Privacy · as of {AS_OF}
        </div>

        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 72px)", marginBottom: 16, color: "var(--fg)", letterSpacing: "-0.025em" }}
        >
          Privacy <span className="editorial">Policy.</span>
        </h1>

        <p className="t-body-lg" style={{ color: "var(--fg-2)", marginBottom: 12 }}>
          Learnbound helps you prepare for exams: you put your phone into a virtual box on your
          desk, and only the time it stays there counts as verified study time. You can study
          alone or with friends, furnish your box room, keep a notebook, and carry on at your
          laptop. We do not show ads and we never sell your data.
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
            Study time, friends and stats need an account, which Supabase creates and stores on our
            behalf. On iPhone and iPad you sign in with Apple or with a one-time code we email to you; on
            Android with Google or the email code. The account holds your user id and your email address
            (with Apple, the address Apple gives us, which can be Apple&apos;s private relay address). If
            you share your name the first time you sign in with Apple, we keep it with your sign-in
            record; with Google, the sign-in record keeps the name and profile picture link Google shares.
          </p>
          <p>
            In onboarding you add a display name, an age band (13 to 15, 16 to 17, or 18 and over), your
            country and your answers about how you like to study; the app adds your time zone. We use the
            age band to apply the protections for minors described below, the country for your flag and
            the country leaderboard, and the time zone to count your days correctly. We also store the
            version of the terms you accepted.
          </p>
        </Section>

        <Section n="03" title="What other people can see">
          <p>
            <b>Your friends</b>{" "}(people whose request you accepted, or who opened your invite link) see
            your public name, your chibi, your country flag, your level and streak, whether you are
            studying, on your phone or on a break, whether your time is verified by the box, and how many
            minutes you studied today. They also see your box room as you furnished it: its size, the view
            from its window and the pieces standing in it.
          </p>
          <p>
            <b>In a shared session</b>{" "}(up to six people, invited by the host or joining a friend who
            opened it), everyone in it sees your public name, your chibi, your status, your verified
            minutes of today and your box room. Some of them may be friends of the host but not yours.
          </p>
          <p>
            <b>Your moodboard.</b>{" "}If you hang a page of your notebook in your box room as your
            moodboard, your accepted friends see that one page, live as you change it, wherever your
            room is shown to them. People who are not your friends never see it, and neither does
            anyone you blocked, anyone who blocked you, or a friend who reported it. All your other
            pages stay private.
          </p>
          <p>
            <b>Your public name.</b>{" "}Friends you accepted see your display name. Everyone else sees an
            automatic alias if you are under 18, if you turned on ghost mode, or if you have no display
            name. Members under 18 see the alias of everyone who is not their friend.
          </p>
          <p>
            <b>Leaderboards</b>{" "}show your public name and your weekly verified study time. By default
            only your friends see you there. If you set your leaderboard visibility to public (adults
            only), you also appear in the country and global leaderboards, unless ghost mode is on; you
            can also hide yourself from every leaderboard.
          </p>
          <p>
            <b>Your invite link</b>{" "}(learnbound.app/join/…) shows your public name and your chibi to
            anyone who opens it; in ghost mode it shows no chibi.
          </p>
        </Section>

        <Section n="04" title="What we store to run the app">
          <p>
            Your study sessions (subject, box or device mode, planned and actual minutes, verified and
            unverified minutes, the time segments behind them, the number of interruptions, how often you
            tapped the lock screen, how a session ended, and the reason you gave if you used the emergency
            exit), your subjects, exams and study phases from the planner (for an exam also its date,
            reminders, minute goal and, if you enter them, how it went and your grade), daily and weekly
            totals for your stats and streaks, your chibi (the parts you picked, never a photo), your box
            room (the pieces you bought with minutes and where they stand, its size and view), your
            friends, friend requests and the people you blocked, the shared sessions you hosted or joined
            and their invitations, your settings, how often you opened the country or global leaderboard
            this week (without Pro), the pages of your notebook (next section), your Lern-Brains (see
            &quot;The Lern-Brain on your laptop&quot;), and the reports you file. All of it is linked to
            your account and used only to provide the app.
          </p>
          <p>
            <b>Minutes</b>{" "}for the box room are not a separate balance: they are your verified study
            minutes less what you spent on pieces, room sizes and views. They cannot be bought.
          </p>
        </Section>

        <Section n="05" title="Your notebook">
          <p>
            The notebook holds the pages you draw and write on. For each page we store what is on it as
            a description of your strokes and text boxes (tool, color, points, pen pressure, position and
            the text you typed), not as an image, together with its date, the subject if you started it
            after a session, a version number, and when it was created and last changed. The pages are
            stored with your account in our database in the European Union (Frankfurt), so the notebook
            is the same on your phone, your iPad and your laptop. Your devices keep a copy so you can keep
            drawing offline; in a laptop browser that copy is removed when you sign out.
          </p>
          <p>
            <b>Who can read it.</b>{" "}Only you. Other members cannot open your pages, with one exception:
            the page you hang as your moodboard (see &quot;What other people can see&quot;). Your pages
            travel over an encrypted connection, but the notebook is not end-to-end encrypted: it is
            stored on our server in a form we could technically read. We access a page only to run the
            notebook, to handle a report about your moodboard, or where the law requires it.
          </p>
          <p>
            <b>Word filter.</b>{" "}Private pages are never checked or filtered. When you hang a page, or save
            the page that hangs, the text typed on it passes the same word filter as display names; if it
            does not, the page does not go on the wall.
          </p>
          <p>
            <b>Sharing a page.</b>{" "}&quot;Share as image&quot; draws the page into a picture on your device
            and hands it to your system&apos;s share sheet (in a browser, to its share function or a
            download). We do not receive or store that picture; where it goes is up to you and the app
            you pick.
          </p>
          <p>
            <b>Deleting.</b>{" "}A page you delete is removed from our server at once and from your other
            devices when they next sync. All your pages are deleted together with your account.
          </p>
        </Section>

        <Section n="06" title="Your laptop">
          <p>
            Learnbound also runs in a browser at learnbound.app and as an app on Mac. It shows the session
            running on your phone live and never starts one itself. To pair a laptop, it shows a QR code
            and your phone scans it. For that the laptop sends our server the hash of a random secret and
            a label made from its browser and system (for example &quot;Chrome · Windows&quot;); the
            request expires after two minutes. Once you confirm on your phone, the laptop receives a
            one-time sign-in for your account. You can also sign in on a laptop with Google or the email
            code, but only to an account made on a phone.
          </p>
          <p>
            <b>Your paired laptops.</b>{" "}Your phone lists them with their label, when they were paired
            and when they were last seen, and you can unpair each one. A laptop unused for 30 days is
            signed out. In the browser, the laptop keeps your sign-in and a copy of your notebook in the
            browser&apos;s storage; signing out removes both.
          </p>
        </Section>

        <Section n="07" title="The Lern-Brain on your laptop">
          <p>
            On the laptop you can add material for an exam (PDF, PowerPoint, Word, text and Markdown
            files) or link a folder, which the browser then lets the app read again for new files. The
            material stays in your browser on that laptop: it is read there, kept in the browser&apos;s
            storage, and never uploaded to us. The AI that builds topics, a study path, short tests and
            flashcards from it, and answers your questions, also runs on your laptop, in the browser on
            its graphics card. No AI runs on our servers.
          </p>
          <p>
            <b>What reaches your account</b>{" "}is what the AI made, so you have it on every device: areas
            and topics with short summaries, the pages they come from, the topics they build on, your
            short-test results and your flashcards, plus the name, size and a fingerprint (hash) of each
            file, never its content. Deleting an exam deletes its Lern-Brain in your account; deleting it
            on the laptop also removes its material from that browser.
          </p>
          <p>
            <b>Downloads.</b>{" "}To run, the laptop downloads the AI model from Hugging Face and the
            libraries for the AI, for reading PDFs and for opening Office files from jsDelivr; the libraries
            are checked against a fixed fingerprint before they run. Like any download, these servers see
            your IP address; none of your material or questions are sent to them.
          </p>
        </Section>

        <Section n="08" title="The app lock">
          <p>
            You can lock apps while you study: free for three preview days, then with Pro. On iPhone and
            iPad the lock runs on Apple&apos;s Screen Time framework (Family Controls). The apps you pick
            are an opaque token that Apple keeps on your device: Learnbound never learns which apps or
            websites you chose, and neither do we. With Pro, Apple&apos;s filter for adult websites can be
            on during a session, and the lock can follow your timetable.
          </p>
          <p>
            On Android the lock needs usage access (to see which app is in front) and permission to
            display over other apps (to show the lock screen). The apps you pick are kept as a list on your
            phone only.
          </p>
          <p>
            We only store counts for your stats, such as how often you tapped the lock screen during a
            session, never the names of apps. You can end a lock in the app and withdraw these permissions
            in your phone&apos;s settings at any time.
          </p>
        </Section>

        <Section n="09" title="The AR box and motion sensors">
          <p>
            <b>Camera.</b>{" "}To place the box and to check that your phone arrived in it, the app uses
            the camera through Apple&apos;s ARKit (on Android, Google Play Services for AR, also called
            ARCore), only while you place the box or put the phone back. The camera image is processed on
            your phone, it is never recorded, stored or sent to us. On Android, ARCore is provided by Google
            and governed by Google&apos;s privacy policy.
          </p>
          <p>
            <b>Motion sensors.</b>{" "}While the phone lies in the box, the app reads the motion sensors
            on your phone to notice when it is lifted. The sensor readings stay on your phone. What
            reaches our server is only the result: when your study time was verified, unverified, a
            break or an interruption.
          </p>
        </Section>

        <Section n="10" title="Nudges and invitations">
          <p>
            When your phone leaves the box outside a break, your friends and the people in your shared
            session can nudge you. We store who nudged whom and when, so that each person can nudge you only
            once per interruption, and we delete these entries after 30 days. You can turn nudges off in
            the app&apos;s settings.
          </p>
          <p>
            When a friend invites you to a shared session, we store the invitation with the session. Unless
            you are in a focus block with &quot;Show invitations right away&quot; turned off, you get a push
            with the host&apos;s public name and the rhythm.
          </p>
        </Section>

        <Section n="11" title="Reports and moderation">
          <p>
            You can report a person or a friend&apos;s moodboard. A report stores who reported what and
            the reason you gave. A new report sends an email with the reported content to our support
            inbox so we can act within 24 hours. Three reports from different people reset a display name
            automatically until we review it.
          </p>
          <p>
            A moodboard you report disappears for you at once. The email about it names the owner of the
            page and contains the page&apos;s date, its subject and the text typed on it, not the drawing.
            If we act on it, we take the page off its owner&apos;s wall; it then stays in their notebook as
            a private page.
          </p>
        </Section>

        <Section n="12" title="Notifications">
          <p>
            Notifications about your study session, such as its end or a reminder to put your phone back in
            the box, and reminders before an exam are local notifications scheduled on your phone. On
            iPhone and iPad, nudges and invitations are push notifications: if you allow notifications, the
            app stores a push token for your device with your account, together with the app&apos;s
            language, and our server sends the push with the sender&apos;s public name through Expo&apos;s
            push service to Apple. Signing out removes the token.
          </p>
        </Section>

        <Section n="13" title="Purchases">
          <p>
            Payments are processed by Apple or, on Android, by Google. To unlock Learnbound Pro, our
            subscription provider RevenueCat receives the store receipt together with your account id. We
            receive only the resulting entitlement status (active or not, and when it ends). We never
            receive your card or payment details.
          </p>
        </Section>

        <Section n="14" title="The Wishboard">
          <p>
            The Wishboard opens Learnbound&apos;s board of ideas on UserJot, where you can post and vote on
            ideas. When you open it while signed in, our server (getklar.org) checks your sign-in with
            Supabase and hands back a link that signs you in on the board under your account id; if you are
            18 or over, the link also carries your display name. Your email address is never sent. What you
            post on the board is visible there and handled by UserJot under its own privacy policy.
          </p>
        </Section>

        <Section n="15" title="Creator links and the install signal">
          <p>
            <b>Creator links.</b>{" "}If you install Learnbound after tapping a creator&apos;s link, Detour (a
            service of Software Mansion) matches that tap to your install at the first start, using
            technical details of your device and connection: IP address, device model and maker, system
            version, screen size, languages, time zone and the browser engine&apos;s user agent. The app
            does not read your clipboard for this. Detour also receives an event with a random device id
            each time the app starts. From the match we take only the creator&apos;s handle: once you finish
            onboarding as an adult, it is stored with your account so the creator can be credited. For
            members under 18 the handle is discarded. Detour runs from the first start, before the app
            knows your age.
          </p>
          <p>
            <b>The install signal (adults only).</b>{" "}If your age band is 18 and over, the app sends a
            single anonymous event to our own server so we can count installs. It contains a random
            identifier generated on your device, the platform, the app version and build, and your app
            language. No name, email, age, study data or advertising identifier, and it is not linked to
            your account. For members under 18 it is never sent.
          </p>
        </Section>

        <Section n="16" title="What we do not do">
          <p>
            No advertising, no ad networks and no advertising identifier (IDFA). No analytics SDK (Detour&apos;s
            app-start event is described above). The camera is only used for the AR box and never records. No
            microphone, no contacts, no location services: your country is the one you pick. No private
            messages. We do not sell or rent personal data to anyone.
          </p>
        </Section>

        <Section n="17" title="Children and teenagers">
          <p>
            Learnbound is for people aged 13 and over. If you choose an age under 13 in onboarding, no account
            is created. For members under 18 we show an alias to anyone who is not their friend, keep them
            off the country and global leaderboards, never pass their name to the Wishboard, and send no
            install signal and store no creator handle. If you believe a child under 13 has created an
            account, contact us and we will delete it.
          </p>
        </Section>

        <Section n="18" title="Why we process this data">
          <p>
            To provide the app and its social features, to keep your Pro purchase, to keep the community safe,
            to credit creators, and to count installs. Legal bases under the GDPR are the performance of our
            contract with you (Art. 6 para. 1 lit. b), your consent where your phone asks you for a
            permission (Art. 6 para. 1 lit. a), and our legitimate interest in moderation, crediting creators
            and privacy friendly install statistics (Art. 6 para. 1 lit. f). The Swiss Data Protection Act
            (DSG) applies in parallel.
          </p>
        </Section>

        <Section n="19" title="Service providers">
          <p>
            <b>Apple</b>{" "}for Sign in with Apple, Screen Time, ARKit, notifications and payments on iPhone and
            iPad, under its own privacy policy. <b>Google</b>{" "}for Sign in with Google, ARCore and payments
            on Android, under its own privacy policy. <b>Supabase</b>{" "}for authentication, database and
            realtime updates, hosted in the European Union (Frankfurt). <b>RevenueCat</b>{" "}for purchase
            entitlements. <b>Expo</b>{" "}(650 Industries) to deliver push notifications. <b>Resend</b>{" "}to
            deliver sign-in codes and report emails. <b>Vercel</b>{" "}to host learnbound.app and getklar.org.{" "}
            <b>UserJot</b>{" "}for the Wishboard. <b>Detour</b>{" "}(Software Mansion) for creator links. These
            providers process data on our behalf under data processing agreements. Hugging Face and jsDelivr
            only serve the downloads described under the Lern-Brain.
          </p>
        </Section>

        <Section n="20" title="How long we keep data">
          <p>
            Your account data is kept for as long as your account exists. The pages of your notebook are kept
            until you delete them or your account. Your live status is deleted after an hour without a running
            session, nudges after 30 days, and expired pairing requests when the next pairing starts. Reports are
            kept while they are needed for moderation. Purchase entitlements are held by RevenueCat for as long
            as they are needed to honour your purchase.
          </p>
        </Section>

        <Section n="21" title="Deleting your account">
          <p>
            Delete your account in the app under Settings → Account → Delete account. Deletion is immediate and
            removes your account and everything attached to it on our side: profile, sessions, stats, planner,
            Lern-Brains, chibi, box room, notebook pages, friends, blocks, nudges, push tokens, paired laptops
            and the creator handle. Reports you filed stay for moderation but are no longer linked to you. We
            also revoke your Sign in with Apple and ask RevenueCat to delete its record of you. Material you
            added to the Lern-Brain stays in that laptop&apos;s browser until you delete the exam or clear the
            site&apos;s data. An active subscription keeps running at Apple or Google until you cancel it there.
          </p>
        </Section>

        <Section n="22" title="Your rights">
          <p>
            You have the right to access, correct, delete and export your personal data, and to object to or
            restrict its processing. For any request, write to{" "}
            <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>. You also have the right to lodge a
            complaint with a data protection authority.
          </p>
        </Section>

        <Section n="23" title="Changes to this policy">
          <p>
            We may update this policy as the app evolves. The current version is always available at this page,
            with the date shown below.
          </p>
        </Section>

        <hr style={{ borderColor: "var(--line)", margin: "48px 0 24px", borderTop: "1px solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />

        <p style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.05em" }}>
          As of {AS_OF} · Controller Alain Kessler (CH sole proprietorship) · {CONTACT} ·{" "}
          <Link href="/learnbound" className="underline">Learnbound</Link> ·{" "}
          <Link href="/learnbound/terms" className="underline">Terms</Link>
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
