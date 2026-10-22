import type { Metadata } from "next";
import Site, { SUPPORT_EMAIL } from "../components/home/Site";

// The terms of the creator programme (Alain 2026-10-22: "mach du den Entwurf", accepted with the first payout, "so
// wenig Aufwand wie möglich"). Every rule here is one the dashboard already applies: lib/creatorModel (50 %, cap 40 %),
// lib/payouts (25 USD, Wise, USD), lib/postCheck (strikes, 30-day pause), lib/creatorAccounts (bio code). Square
// brackets are what Alain still has to decide.

export const metadata: Metadata = {
  title: "Creator terms · Klar Studios",
  description: "The terms for posting Klar Studios slideshows from the creator dashboard and getting paid for them.",
};

const UPDATED = "22 October 2026";

const SECTIONS: Array<[string, string[]]> = [
  ["Who we are", [`Klar Studios is a brand of Alain Kessler, a sole proprietorship in Switzerland. Questions about these terms: ${SUPPORT_EMAIL}.`]],
  [
    "Taking part",
    [
      "Taking part is free and you don't need a minimum number of followers. You must be 18 or older.",
      "You need a public TikTok account that is yours. You confirm it once with a code in your bio. One person, one account.",
    ],
  ],
  [
    "The slideshows",
    [
      "Every slideshow in your dashboard is a version made for you. Post it as a TikTok photo slideshow with all slides, in their order, without cropping or editing them.",
      "The slideshows stay ours. You may post them on your confirmed TikTok account as part of this programme, nowhere else.",
      "Keep the app's name in the caption. Your own words are fine, but don't promise anything the app doesn't do.",
    ],
  ],
  [
    "What counts",
    [
      "A post counts when it is one of your slideshows, unchanged, with the app's name in the caption, posted while your account is active. Your own content counts only once you have your own link.",
      "We read public posts and their views several times a day, and pay on what we read. If you think we missed a post, write to us within 30 days.",
    ],
  ],
  [
    "What you earn",
    [
      "Without a link, we estimate how many sign-ups your counted views brought, from all posts that advertise the app. You get 50 % of the revenue from those sign-ups.",
      "All creators together get at most 40 % of what the app earns above its usual sign-ups in a month. If that limit is reached, everyone's share shrinks by the same factor.",
      "The estimate updates every day and is final when the month ends. It is an estimate, not an exact count.",
      "From 1,000 followers you can get your own link. Installs through it count exactly, and you get 50 % of the revenue they bring. Posts that counted before you switched keep earning from the estimate.",
    ],
  ],
  [
    "Payouts",
    [
      "Once a month we pay what you earned in the months that have ended, in US dollars through Wise, as soon as you are owed at least 25 USD. Below that, it carries over to the next month.",
      "For your first payout you give us the email of your Wise account and your full name, and you accept these terms.",
      "We pay our side of the transfer. Fees your bank or Wise charges on your side are yours.",
      "You take part as an independent creator, not as an employee, and you take care of taxes and any reporting in your country.",
    ],
  ],
  [
    "Rules",
    [
      "No bought views, likes or followers, no bots, no fake accounts.",
      "A rejected post, for example your own content without a link or false promises about the app, is a strike. The first is a warning, the second pauses your account for 30 days, the third closes it.",
      "While your account is paused, posts don't count and you get no new slideshows. Paused or closed, what you earned with posts that counted is still paid out.",
      "Follow the rules for paid posts that apply to you, including TikTok's and those of your country.",
    ],
  ],
  [
    "Your data",
    [
      `We keep your email, your TikTok username, the country you signed up from, the public data of your posts and, for payouts, your Wise email and name. We use them only to run this programme. Write to ${SUPPORT_EMAIL} to have them deleted; what we must keep for our accounts we keep as long as the law requires.`,
    ],
  ],
  [
    "Changes and ending",
    [
      "You can stop at any time. We can change these terms or end the programme, and tell you in your dashboard or by email first. What you earned until then is paid out under these terms.",
      "Swiss law applies. Place of jurisdiction: [place], Switzerland.",
    ],
  ],
];

export default function CreatorTerms() {
  return (
    <Site>
      <main className="mx-auto max-w-[760px] px-5 pb-24 pt-32 sm:px-8 md:pt-40">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Klar Studios creators</p>
        <h1 className="mt-4 text-[clamp(40px,7vw,72px)] font-medium leading-[0.95] tracking-[-0.05em]">Creator terms</h1>
        <p className="mt-6 max-w-[56ch] text-[17px] leading-relaxed text-[var(--ink-2)]">
          The short version: post our slideshows unchanged, keep it honest, and we pay you a share of what your posts bring
          in. The details are below.
        </p>
        <p className="mt-3 text-[13px] text-[var(--ink-3)]">Last updated {UPDATED}</p>
        <div className="mt-12 grid gap-10">
          {SECTIONS.map(([head, paras], i) => (
            <section key={head} className="grid gap-3 border-t pt-6 sm:grid-cols-[3rem_1fr]">
              <span className="text-[13px] tabular-nums text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-[20px] font-medium tracking-[-0.02em]">{head}</h2>
                {paras.map((p) => (
                  <p key={p} className="mt-3 text-[15px] leading-relaxed text-[var(--ink-2)]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </Site>
  );
}
