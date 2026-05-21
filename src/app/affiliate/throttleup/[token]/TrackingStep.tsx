"use client";

// Tracking step: how attribution + payout works (4-step pipeline visualisation),
// protection mechanisms, disclosure rules. Mostly generic, brand-themed dark.

import { type Lang, t } from "./translations";

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
  pipeline: { title: string; desc: string }[];
  protection: string[];
  compliance: string;
}

const BODY_DE: Body = {
  pipeline: [
    {
      title: "Klick auf deinen Link",
      desc: "Viewer tippt auf getklar.org/i/throttleup/{DEINCODE}. Klick wird in unserer Supabase als referral_clicks geloggt. Auf iOS schreibt die Seite einen signierten Token in die Zwischenablage, weil iOS keinen sauberen Install-Referrer kennt. Auf Android kommt der native Play-Install-Referrer.",
    },
    {
      title: "Install und Login",
      desc: "Bei erstem App-Start liest ThrottleUp den Clipboard-Token (iOS) oder Install-Referrer (Android). Nach Login wird der Token validiert und in referrals als Verbindung Account zu deinem Affiliate-Code gespeichert.",
    },
    {
      title: "Premium-Kauf",
      desc: "Sobald der User Premium kauft, feuert RevenueCat einen Webhook an unsere Edge-Function. Die schreibt das Conversion-Event und markiert es mit deiner Affiliate-ID. counts_for_payout=true.",
    },
    {
      title: "Auszahlung an dich",
      desc: "Am ersten jedes Monats läuft pg_cron, aggregiert deine reifen Conversions (älter als 30 Tage), berechnet 50% Share, erstellt einen Payout-Batch und stößt Wise/PayPal/SEPA an. Mindestauszahlung 50 EUR/USD, sonst Carry-over.",
    },
  ],
  protection: [
    "30 Tage Refund-Holdback: refundete Käufe werden vor Auszahlung abgezogen",
    "Self-Referral geblockt: dein eigener User-Account zählt nicht als Conversion",
    "Mindestauszahlung 50 EUR/USD: alles darunter rollt in den nächsten Monat",
    "24 Monate Cap: jeder Sub zählt 24 Monate ab erstem Premium-Kauf, dann Ende",
  ],
  compliance: "Markiere gesponserte Posts mit #ad oder Paid-Partnership-Label. In Deutschland greift UWG §5a, in der Schweiz UWG Art. 3 lit. b, in den USA FTC. Free Lifetime Premium plus Revenue-Share ist eine kommerzielle Zuwendung, also kennzeichnen.",
};

const BODY_EN: Body = {
  pipeline: [
    {
      title: "Click on your link",
      desc: "Viewer taps getklar.org/i/throttleup/{YOURCODE}. Click is logged in our Supabase as referral_clicks. On iOS the page writes a signed token to the clipboard because iOS has no clean install-referrer. On Android, the native Play install-referrer is used.",
    },
    {
      title: "Install and sign-in",
      desc: "On first launch ThrottleUp reads the clipboard token (iOS) or install referrer (Android). After login the token is validated and stored in referrals as the link between account and your affiliate code.",
    },
    {
      title: "Premium purchase",
      desc: "As soon as the user buys premium, RevenueCat fires a webhook to our edge function. It writes the conversion event and tags it with your affiliate id. counts_for_payout=true.",
    },
    {
      title: "Payout to you",
      desc: "On the first of each month pg_cron runs, aggregates your matured conversions (older than 30 days), computes the 50% share, creates a payout batch and triggers Wise/PayPal/SEPA. Minimum payout 50 EUR/USD, otherwise carry-over.",
    },
  ],
  protection: [
    "30-day refund holdback: refunded purchases are deducted before payout",
    "Self-referral blocked: your own user account doesn't count as a conversion",
    "Minimum payout 50 EUR/USD: anything below rolls into the next month",
    "24-month cap: every sub counts for 24 months from the first premium purchase, then ends",
  ],
  compliance: "Mark sponsored posts with #ad or a paid-partnership label. Germany UWG §5a, Switzerland UWG Art. 3 lit. b, US FTC. Free lifetime premium plus revenue share is a commercial benefit, so it needs to be disclosed.",
};

function bodyFor(lang: Lang): Body {
  return lang === "de" ? BODY_DE : BODY_EN;
}

export function TrackingStep({
  lang,
  onBack,
  onNext,
}: {
  lang: Lang;
  onBack: () => void;
  onNext: () => void;
}) {
  const tt = t(lang);
  const body = bodyFor(lang);

  return (
    <div>
      <h1 style={h1()}>{tt.tracking_pipeline_title}</h1>

      <div style={{ marginTop: 24, marginBottom: 28 }}>
        {body.pipeline.map((step, i) => (
          <PipelineRow key={i} index={i + 1} title={step.title} desc={step.desc} last={i === body.pipeline.length - 1} />
        ))}
      </div>

      <Section title={tt.tracking_protection_title} list={body.protection} />
      <Section title={tt.tracking_compliance_title} body={body.compliance} />

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: "0 0 auto",
            padding: "16px 22px",
            background: T.surfaceElevated,
            color: T.textSecondary,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-boldonse), Georgia, serif",
          }}
        >
          {tt.nav_back}
        </button>
        <button
          type="button"
          onClick={onNext}
          style={{
            flex: 1,
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
    </div>
  );
}

function PipelineRow({ index, title, desc, last }: { index: number; title: string; desc: string; last: boolean }) {
  return (
    <div style={{ display: "flex", gap: 14, position: "relative", paddingBottom: last ? 0 : 18 }}>
      {!last && (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 36,
            bottom: 4,
            width: 2,
            background: "rgba(255, 181, 71, 0.3)",
          }}
        />
      )}
      <div
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
          color: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "var(--font-boldonse), Georgia, serif",
        }}
      >
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-boldonse), Georgia, serif",
            fontSize: 15,
            color: T.text,
            fontWeight: 400,
            marginBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.6 }}>{desc}</div>
      </div>
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
