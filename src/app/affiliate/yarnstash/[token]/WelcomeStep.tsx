"use client";

// Welcome step: hero + what the app does + audience fit + reel ideas + math
// + compensation summary. Yarn-Stash specific brand story, DE+EN bodies,
// other langs fall back to EN to keep the file maintainable.

import { type Lang, t, fill } from "./translations";

const T = {
  bone: "#FAF6F0",
  paper: "#FFFFFF",
  ink: "#1E1A17",
  mute: "#756B62",
  faint: "#A8A099",
  hair: "rgba(30,26,23,0.10)",
  rose: "#B84A5C",
  roseSoft: "#F2DCD8",
  roseInk: "#7E2A38",
  sand: "#EBE0CE",
  chip: "#F2EDE5",
};

interface Body {
  what: string;
  audience: string[];
  ideas: string[];
  math: string;
  compensation: string[];
}

const BODY_DE: Body = {
  what: "My Yarn Stash ist die Strick- und Häkel-Stash-App: Foto-Scan packt Garn samt Marke, Gewicht, Meterzahl und Farbe in dein Regal, Projekte tracken Verbrauch automatisch, Pattern-Bibliothek und Gruppen-Stash für gemeinsame Sammlungen. Premium-Hebel: unbegrenzte Stash-Größe und das Foto-Scan-Feature.",
  audience: [
    "Knit/Crochet-Creator (#yarnstash, #knittersofinstagram, #crochettiktok)",
    "Maker-Cozy-Lifestyle, kein Anti-#ad-Klima, Audience schätzt Craft und Tools",
    "Schwach: Generic-Lifestyle ohne Yarn-Bezug, US-Highschool-Crafts",
  ],
  ideas: [
    "Stash-Declutter-Story: Audience rät welches Garn rausfliegt, du scannst und entscheidest",
    "WIP-Reveal: ein Projekt von cast-on bis bind-off, App zeigt Meterage-Tracking",
    "Pattern-Library-Tour: deine Top-5-Patterns mit den Garnen die du nutzt",
  ],
  math: "Bei 15.000 Followern, 5% Reel-Engagement, 3% Click-Rate, 50% Install-Rate, 10% Premium-Conversion: rund 1 bis 2 Subs pro starkem Post. Bei 4,99 USD/Monat, 12 Monaten Premium-Schnitt und 50% Share: rund 30 USD pro Sub, etwa 30 bis 60 USD pro Post. Plus Awin-Provisionen wenn deine Audience über deinen Link bei Knit Picks oder Minerva einkauft.",
  compensation: [
    "50% Revenue-Share auf jede Premium-Sub über deinen Link, 24 Monate ab erstem Sub",
    "Monatliche Auszahlung via Wise, PayPal oder SEPA, Mindestauszahlung 50 EUR/USD",
    "30 Tage Refund-Holdback, danach fix berechnet",
    "Zusätzlich: Awin-Provisionen für Knit Picks und Minerva direkt aus der App",
    "Kein Posting-Zwang, keine Mindest-Reach-Vorgaben",
  ],
};

const BODY_EN: Body = {
  what: "My Yarn Stash is the knit and crochet stash app: photo-scan adds yarn including brand, weight, meterage and color to your shelf, projects auto-track consumption, pattern library and group stash for shared collections. Premium hooks: unlimited stash and the photo-scan feature.",
  audience: [
    "Knit/Crochet creators (#yarnstash, #knittersofinstagram, #crochettiktok)",
    "Maker-cozy lifestyle, no anti-#ad sentiment, audience values craft and tools",
    "Weak: generic lifestyle without yarn angle, US-highschool crafts",
  ],
  ideas: [
    "Stash declutter story: audience guesses which yarn goes, you scan and decide",
    "WIP reveal: one project from cast-on to bind-off, app shows meterage tracking",
    "Pattern library tour: your top 5 patterns with the yarns you use",
  ],
  math: "At 15,000 followers, 5% reel engagement, 3% click rate, 50% install rate, 10% premium conversion: roughly 1 to 2 subs per strong post. At $4.99/month, 12-month premium average, 50% share: about $30 per sub, roughly $30 to $60 per post. Plus Awin commissions when your audience shops Knit Picks or Minerva through your link.",
  compensation: [
    "50% revenue share on every premium sub through your link, 24 months from the first sub",
    "Monthly payout via Wise, PayPal or SEPA, minimum payout 50 EUR/USD",
    "30-day refund holdback, then locked",
    "Bonus: Awin commissions for Knit Picks and Minerva straight from the app",
    "No posting requirement, no minimum reach quotas",
  ],
};

function bodyFor(lang: Lang): Body {
  return lang === "de" ? BODY_DE : BODY_EN;
}

export function WelcomeStep({
  handle,
  lang,
  sharePct,
  shareMonths,
  onNext,
}: {
  handle: string;
  lang: Lang;
  sharePct: number;
  shareMonths: number;
  onNext: () => void;
}) {
  const tt = t(lang);
  const body = bodyFor(lang);

  return (
    <div>
      <Tag>{tt.tag}</Tag>
      <h1 style={h1()}>{fill(tt.welcome_title, { handle })}</h1>
      <p style={{ fontSize: 15, color: T.mute, lineHeight: 1.55, margin: "8px 0 28px" }}>
        {fill(tt.welcome_body, { sharePct, shareMonths })}
      </p>

      <Section title={tt.welcome_what_title} body={body.what} />
      <Section title={tt.welcome_audience_title} list={body.audience} />
      <Section title={tt.welcome_ideas_title} list={body.ideas} />
      <Section title={tt.welcome_math_title} body={body.math} />
      <Section title={tt.welcome_compensation_title} list={body.compensation} />

      <button
        type="button"
        onClick={onNext}
        style={{
          marginTop: 8,
          width: "100%",
          padding: "16px 24px",
          background: `linear-gradient(135deg, ${T.rose}, ${T.roseInk})`,
          color: "white",
          border: "none",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: `0 14px 28px -10px ${T.rose}`,
          fontFamily: "var(--ys-display), Georgia, serif",
          letterSpacing: 0.3,
        }}
      >
        {tt.nav_next}
      </button>
    </div>
  );
}

function Section({ title, body, list }: { title: string; body?: string; list?: string[] }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontFamily: "var(--ys-editorial), Georgia, serif",
          fontStyle: "italic",
          fontSize: 16,
          fontWeight: 400,
          color: T.roseInk,
          margin: "0 0 10px",
          letterSpacing: 0.2,
        }}
      >
        {title}
      </h2>
      {body && <p style={{ fontSize: 14.5, color: T.mute, lineHeight: 1.65, margin: 0 }}>{body}</p>}
      {list && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {list.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 14.5,
                color: T.mute,
                lineHeight: 1.65,
                paddingLeft: 18,
                position: "relative",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 7,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: T.rose,
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: "5px 12px",
        background: T.roseSoft,
        color: T.roseInk,
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 12,
        fontFamily: "var(--ys-editorial), Georgia, serif",
        fontStyle: "italic",
      }}
    >
      {children}
    </div>
  );
}

function h1(): React.CSSProperties {
  return {
    fontFamily: "var(--ys-display), 'Gloock', Georgia, serif",
    fontSize: 28,
    fontWeight: 400,
    margin: 0,
    letterSpacing: -0.4,
    color: T.ink,
  };
}
