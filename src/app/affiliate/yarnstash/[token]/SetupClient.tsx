"use client";

// Yarn-Stash affiliate onboarding shell. 4 steps: welcome, tracking, payout
// form, success. WelcomeStep + TrackingStep are extracted; the form and
// success states stay inline because they share state and palette.

import { useState } from "react";
import { t, fill, type Lang } from "./translations";
import { WelcomeStep } from "./WelcomeStep";
import { TrackingStep } from "./TrackingStep";

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
];

type Method = "wise" | "paypal" | "sepa";
type Tax = "kleinunternehmer" | "regelbesteuert" | "foreign";

const TOTAL_STEPS = 4;

export function SetupClient({
  token,
  handle,
  displayName,
  sharePct,
  shareMonths,
  lang,
}: {
  token: string;
  handle: string;
  displayName: string;
  sharePct: number;
  shareMonths: number;
  lang: Lang;
}) {
  const tt = t(lang);
  const [step, setStep] = useState(0);
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
  const stepIndex = done ? 3 : step;

  async function submit() {
    setError(null);
    if (!name.trim()) return setError(tt.err_name_required);
    if (method === "sepa" && !iban.trim()) return setError(tt.err_iban_required);
    if ((method === "paypal" || method === "wise") && !email.trim()) return setError(tt.err_email_required);

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
      setError(e instanceof Error ? e.message : tt.err_generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Card>
        <StepIndicator
          step={stepIndex}
          total={TOTAL_STEPS}
          labels={[tt.step_welcome, tt.step_tracking, tt.step_payout, tt.step_done]}
        />

        {step === 0 && !done && (
          <WelcomeStep
            handle={handle}
            lang={lang}
            sharePct={sharePct}
            shareMonths={shareMonths}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && !done && (
          <TrackingStep lang={lang} onBack={() => setStep(0)} onNext={() => setStep(2)} />
        )}

        {step === 2 && !done && (
          <PayoutForm
            tt={tt}
            name={name}
            setName={setName}
            country={country}
            setCountry={setCountry}
            method={method}
            setMethod={setMethod}
            email={email}
            setEmail={setEmail}
            iban={iban}
            setIban={setIban}
            tax={tax}
            setTax={setTax}
            invoice={invoice}
            setInvoice={setInvoice}
            isForeign={isForeign}
            busy={busy}
            error={error}
            sharePct={sharePct}
            shareMonths={shareMonths}
            onBack={() => setStep(1)}
            onSubmit={submit}
          />
        )}

        {done && <SuccessView tt={tt} promoCode={done.promoCode} sharePct={sharePct} shareMonths={shareMonths} />}
      </Card>
    </Page>
  );
}

function StepIndicator({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }, (_, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: done || active ? T.rose : T.hair,
                marginBottom: 8,
                transition: "background 200ms",
              }}
            />
            <div
              style={{
                fontSize: 10.5,
                color: active ? T.roseInk : done ? T.mute : T.faint,
                fontWeight: active ? 700 : 500,
                fontFamily: "var(--ys-editorial), Georgia, serif",
                fontStyle: "italic",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PayoutFormProps {
  tt: ReturnType<typeof t>;
  name: string;
  setName: (s: string) => void;
  country: string;
  setCountry: (s: string) => void;
  method: Method;
  setMethod: (m: Method) => void;
  email: string;
  setEmail: (s: string) => void;
  iban: string;
  setIban: (s: string) => void;
  tax: Tax;
  setTax: (t: Tax) => void;
  invoice: boolean;
  setInvoice: (b: boolean) => void;
  isForeign: boolean;
  busy: boolean;
  error: string | null;
  sharePct: number;
  shareMonths: number;
  onBack: () => void;
  onSubmit: () => void;
}

function PayoutForm({
  tt, name, setName, country, setCountry, method, setMethod, email, setEmail,
  iban, setIban, tax, setTax, invoice, setInvoice, isForeign, busy, error,
  sharePct, shareMonths, onBack, onSubmit,
}: PayoutFormProps) {
  return (
    <div>
      <h1 style={h1()}>{tt.step_payout}</h1>
      <p style={{ fontSize: 15, color: T.mute, lineHeight: 1.55, margin: "8px 0 24px" }}>
        {tt.welcome_body}
      </p>

      <Field label={tt.field_name_label}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt.field_name_placeholder} style={inp()} />
      </Field>

      <Field label={tt.field_country_label}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp()}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
          <option value="OTHER">{tt.country_other}</option>
        </select>
      </Field>

      <Field label={tt.field_payout_method_label}>
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
        <Field label={tt.field_iban_label}>
          <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="DE89 …" style={inp()} />
        </Field>
      ) : (
        <Field label={method === "paypal" ? tt.field_email_label_paypal : tt.field_email_label_wise}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tt.field_email_placeholder} style={inp()} />
        </Field>
      )}

      {!isForeign && (
        <Field label={tt.field_tax_label}>
          <select value={tax} onChange={(e) => setTax(e.target.value as Tax)} style={inp()}>
            <option value="kleinunternehmer">{tt.tax_kleinunternehmer}</option>
            <option value="regelbesteuert">{tt.tax_regelbesteuert}</option>
          </select>
        </Field>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 24, cursor: "pointer", color: T.mute, fontSize: 14 }}>
        <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.rose }} />
        {tt.checkbox_invoice_capable}
      </label>

      {error && (
        <div style={{ padding: "10px 14px", background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 10, color: T.error, fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          style={{
            flex: "0 0 auto",
            padding: "16px 22px",
            background: T.chip,
            color: T.mute,
            border: `1px solid ${T.hair}`,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 500,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
            fontFamily: "var(--ys-editorial), Georgia, serif",
          }}
        >
          {tt.nav_back}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          style={{
            flex: 1,
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
            fontFamily: "var(--ys-display), Georgia, serif",
            letterSpacing: 0.3,
          }}
        >
          {busy ? tt.submit_busy : tt.submit_idle}
        </button>
      </div>

      <p style={{ fontSize: 11, color: T.faint, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
        {fill(tt.consent, { sharePct, shareMonths })}
      </p>
    </div>
  );
}

function SuccessView({
  tt, promoCode, sharePct, shareMonths,
}: {
  tt: ReturnType<typeof t>;
  promoCode: string;
  sharePct: number;
  shareMonths: number;
}) {
  return (
    <div>
      <h1 style={h1()}>{tt.done_title}</h1>
      <p style={{ fontSize: 15, color: T.mute, lineHeight: 1.55, marginTop: 8 }}>{tt.done_body}</p>
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
        {promoCode}
      </div>
      <p style={{ fontSize: 13, color: T.faint, marginTop: 14, lineHeight: 1.6 }}>
        {fill(tt.done_share_explainer, { sharePct, shareMonths })}
      </p>
      <p style={{ fontSize: 13, color: T.faint, marginTop: 18 }}>
        {tt.done_tracking_label}
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
          getklar.org/i/yarnstash/{promoCode}
        </code>
      </p>
      <a
        href="https://getklar.org/dashboard"
        style={{
          marginTop: 24,
          display: "block",
          width: "100%",
          padding: "16px 24px",
          background: `linear-gradient(135deg, ${T.rose}, ${T.roseInk})`,
          color: "white",
          border: "none",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "center",
          textDecoration: "none",
          boxShadow: `0 14px 28px -10px ${T.rose}`,
          fontFamily: "var(--ys-display), Georgia, serif",
          letterSpacing: 0.3,
        }}
      >
        {tt.done_dashboard_cta}
      </a>
    </div>
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
        maxWidth: 520,
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
