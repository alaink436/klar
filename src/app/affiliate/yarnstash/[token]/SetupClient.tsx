"use client";

// Yarn-Stash affiliate-onboarding form (Klar-hosted, posts to
// /api/affiliate/complete which forwards to the Yarn-Stash Supabase RPC).
// Visual: Atelier palette mirrors the in-app design system.

import { useState } from "react";

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
  error: "#B91C1C",
};

const COUNTRIES = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "NL", label: "Nederland" },
  { code: "FR", label: "France" },
  { code: "IT", label: "Italia" },
  { code: "ES", label: "España" },
  { code: "UK", label: "United Kingdom" },
  { code: "US", label: "USA" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "OTHER", label: "Other / Anderes Land" },
];

type Method = "wise" | "paypal" | "sepa";
type Tax = "kleinunternehmer" | "regelbesteuert" | "foreign";

export function SetupClient({
  token,
  handle,
  displayName,
  sharePct,
  shareMonths,
}: {
  token: string;
  handle: string;
  displayName: string;
  sharePct: number;
  shareMonths: number;
}) {
  const [name, setName] = useState(displayName);
  const [country, setCountry] = useState("DE");
  const [method, setMethod] = useState<Method>("paypal");
  const [email, setEmail] = useState("");
  const [iban, setIban] = useState("");
  const [tax, setTax] = useState<Tax>("kleinunternehmer");
  const [invoice, setInvoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ promoCode: string } | null>(null);

  const isForeign = ["US", "CA", "AU", "UK"].includes(country);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Bitte deinen Anzeigenamen angeben.");
    if (method === "sepa" && !iban.trim()) return setError("IBAN fehlt.");
    if ((method === "paypal" || method === "wise") && !email.trim()) {
      return setError("Payout-Email fehlt.");
    }
    setBusy(true);
    try {
      const promoCode = (handle.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "YARN") + "20";
      const res = await fetch("/api/affiliate/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "yarn-stash",
          token,
          display_name: name.trim(),
          country,
          payout_method: method,
          payout_email: method === "sepa" ? null : email.trim(),
          payout_iban: method === "sepa" ? iban.trim() : null,
          tax_status: isForeign ? "foreign" : tax,
          invoice_capable: invoice,
          promo_code: promoCode,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; promo_code?: string; error?: string } | null;
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setDone({ promoCode: j.promo_code || promoCode });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Page>
        <Card>
          <h1 style={h1()}>Du bist live ✓</h1>
          <p style={{ fontSize: 15, color: T.mute, lineHeight: 1.55, marginTop: 8 }}>
            Wir haben deinen Affiliate-Account eingerichtet. Dein persönlicher Code:
          </p>
          <div
            style={{
              marginTop: 14,
              padding: "16px 20px",
              background: `linear-gradient(135deg, ${T.roseInk}, ${T.rose})`,
              borderRadius: 14,
              textAlign: "center",
              fontFamily: "var(--ys-display), Georgia, serif",
              fontSize: 32,
              fontWeight: 400,
              color: "white",
              letterSpacing: 1.5,
            }}
          >
            {done.promoCode}
          </div>
          <p style={{ fontSize: 13, color: T.faint, marginTop: 14, lineHeight: 1.6 }}>
            {sharePct}% Revenue-Share für {shareMonths} Monate ab erstem Sub. Auszahlung monatlich via Wise/PayPal/SEPA, 30 Tage Refund-Holdback.
          </p>
          <p style={{ fontSize: 13, color: T.faint, marginTop: 18 }}>
            Dein Sharing-Link:
            <br />
            <code
              style={{
                display: "inline-block",
                marginTop: 6,
                padding: "8px 12px",
                background: T.chip,
                border: `1px solid ${T.hair}`,
                borderRadius: 8,
                color: T.rose,
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
              }}
            >
              getklar.org/i/yarnstash/{done.promoCode}
            </code>
          </p>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <Tag>Yarn-Stash · Onboarding</Tag>
        <h1 style={h1()}>Hi @{handle},</h1>
        <p style={{ fontSize: 15, color: T.mute, lineHeight: 1.55, margin: "8px 0 24px" }}>
          Letzter Schritt: Auszahlungs-Setup. 2-3 Minuten, dann ist dein persönlicher Link live.
        </p>

        <Field label="Anzeigename">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wie wir dich nennen" style={inp()} />
        </Field>

        <Field label="Land (für Steuer)">
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp()}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Auszahlungsmethode">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["paypal", "wise", "sepa"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `1px solid ${method === m ? T.rose : T.hair}`,
                  background: method === m ? T.roseSoft : T.chip,
                  color: method === m ? T.roseInk : T.mute,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {m === "sepa" ? "SEPA" : m}
              </button>
            ))}
          </div>
        </Field>

        {method === "sepa" ? (
          <Field label="IBAN">
            <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="DE89 …" style={inp()} />
          </Field>
        ) : (
          <Field label={method === "paypal" ? "PayPal-Email" : "Wise-Email"}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" style={inp()} />
          </Field>
        )}

        {!isForeign && (
          <Field label="Steuerstatus (DACH)">
            <select value={tax} onChange={(e) => setTax(e.target.value as Tax)} style={inp()}>
              <option value="kleinunternehmer">Kleinunternehmer / nicht USt-pflichtig</option>
              <option value="regelbesteuert">Regelbesteuert / USt-pflichtig</option>
            </select>
          </Field>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 24, cursor: "pointer", color: T.mute, fontSize: 14 }}>
          <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.rose }} />
          Ich kann eine korrekte Rechnung mit MwSt ausstellen
        </label>

        {error && (
          <div style={{ padding: "10px 14px", background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 10, color: T.error, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            width: "100%",
            padding: "16px 24px",
            background: `linear-gradient(135deg, ${T.rose}, ${T.roseInk})`,
            color: "white",
            border: "none",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            boxShadow: `0 14px 28px -10px ${T.rose}`,
          }}
        >
          {busy ? "Wird eingerichtet …" : "Affiliate-Setup abschließen"}
        </button>

        <p style={{ fontSize: 11, color: T.faint, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          Mit dem Klick bestätige ich {sharePct}% Revenue-Share über {shareMonths} Monate als
          Direkt-Vereinbarung mit Alain Kessler (CH, Einzelfirma).
        </p>
      </Card>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          `radial-gradient(circle at 80% 0%, ${T.roseSoft} 0%, transparent 50%), ` +
          `radial-gradient(circle at 0% 100%, ${T.sand} 0%, transparent 55%), ${T.bone}`,
        color: T.ink,
        padding: 24,
      }}
    >
      {children}
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 480,
        width: "100%",
        background: T.paper,
        border: `1px solid ${T.hair}`,
        borderRadius: 28,
        padding: "32px 28px",
        boxShadow: "0 24px 60px -20px rgba(40,30,24,0.12)",
      }}
    >
      {children}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.mute, marginBottom: 6 }}>{label}</label>
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
function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "11px 14px",
    background: T.bone,
    border: `1px solid ${T.hair}`,
    borderRadius: 12,
    color: T.ink,
    fontSize: 15,
    outline: "none",
  };
}
