"use client";

// Welcome step: hero + what the app does + audience fit + reel ideas + math
// + compensation summary. ThrottleUp specific brand story.

import { type Lang, t, fill } from "./translations";

const T = {
  bg: "#16110D",
  text: "#F5EFE3",
  textSecondary: "rgba(245, 239, 227, 0.70)",
  textTertiary: "rgba(245, 239, 227, 0.46)",
  surfaceElevated: "rgba(245, 239, 227, 0.10)",
  accent: "#FFB547",
  accentDark: "#E08A1E",
  border: "rgba(245, 239, 227, 0.14)",
};

interface Body {
  what: string;
  audience: string[];
  ideas: string[];
  math: string;
  compensation: string[];
}

const BODY_DE: Body = {
  what: "ThrottleUp ist das Wartungs- und Trip-Logbuch für Motorräder: Service-Intervalle pro Bike, VIN-Lookup, Hersteller-Service-Plan, geteilte Fahrer-Gruppen, GPS-Trip-Recording mit Karte. Premium-Hebel: unbegrenzte Bikes und größere Fahrgruppen.",
  audience: [
    "Moto-Vlogger und Cafe-Racer-Creator (#motovlog, #caferacer, #adventurerider)",
    "Wartungs-Tutorial-Channels, Rider-Lifestyle, DACH plus US-Garage-Vibe",
    "Schwach: Pro-Mechanics mit Shop-Tools, Pro-Renn-Teams",
  ],
  ideas: [
    "Service-Day-Vlog: ein Service von Ölwechsel bis Kette einstellen, App zeigt Log live",
    "Pre-Ride-Check-Story: 5 Punkte vor jeder Tour, App-Reminder erklärt warum",
    "Trip-Log-Highlights: GPS-Strecke einer Wochenend-Tour mit Karten-Reveal",
  ],
  math: "Bei 12.000 Followern, 7% Reel-Engagement, 4% Click-Rate, 40% Install-Rate, 8% Premium-Conversion: rund 1 bis 2 Subs pro starkem Post. Bei 4,99 USD/Monat, 12 Monaten Premium-Schnitt und 50% Share: rund 30 USD pro Sub, etwa 30 bis 60 USD pro Post. Moto-Audience ist nischen-loyal, lange Retention.",
  compensation: [
    "50% Revenue-Share auf jede Premium-Sub über deinen Link, 24 Monate ab erstem Sub",
    "Monatliche Auszahlung via Wise, PayPal oder SEPA, Mindestauszahlung 50 EUR/USD",
    "30 Tage Refund-Holdback, danach fix berechnet",
    "Kein Posting-Zwang, keine Mindest-Reach-Vorgaben",
  ],
};

const BODY_EN: Body = {
  what: "ThrottleUp is the maintenance and trip log for motorcycles: per-bike service intervals, VIN lookup, manufacturer service plan, shared rider groups, GPS trip recording with map. Premium hooks: unlimited bikes and larger ride groups.",
  audience: [
    "Moto vloggers and cafe-racer creators (#motovlog, #caferacer, #adventurerider)",
    "Maintenance tutorial channels, rider lifestyle, DACH plus US-garage vibe",
    "Weak: pro mechanics with shop tools, pro race teams",
  ],
  ideas: [
    "Service-day vlog: one service from oil change to chain adjustment, app shows the log live",
    "Pre-ride-check story: 5 points before every ride, app reminder explains why",
    "Trip-log highlights: GPS track of a weekend tour with map reveal",
  ],
  math: "At 12,000 followers, 7% reel engagement, 4% click rate, 40% install rate, 8% premium conversion: roughly 1 to 2 subs per strong post. At $4.99/month, 12-month premium average, 50% share: about $30 per sub, roughly $30 to $60 per post. Moto audience is niche-loyal, long retention.",
  compensation: [
    "50% revenue share on every premium sub through your link, 24 months from the first sub",
    "Monthly payout via Wise, PayPal or SEPA, minimum payout 50 EUR/USD",
    "30-day refund holdback, then locked",
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
      <p style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.55, margin: "8px 0 28px" }}>
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
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
          color: T.bg,
          border: "none",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-boldonse), Georgia, serif",
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
          fontFamily: "var(--font-boldonse), Georgia, serif",
          fontSize: 14,
          fontWeight: 400,
          color: T.accent,
          margin: "0 0 10px",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {body && <p style={{ fontSize: 14.5, color: T.textSecondary, lineHeight: 1.65, margin: 0 }}>{body}</p>}
      {list && (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {list.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 14.5,
                color: T.textSecondary,
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
                  background: T.accent,
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
        background: "rgba(255, 181, 71, 0.18)",
        color: T.accent,
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 12,
        fontFamily: "var(--font-boldonse), Georgia, serif",
      }}
    >
      {children}
    </div>
  );
}

function h1(): React.CSSProperties {
  return {
    fontFamily: "var(--font-boldonse), Georgia, serif",
    fontSize: 28,
    fontWeight: 400,
    margin: 0,
    letterSpacing: -0.4,
    color: T.text,
  };
}
