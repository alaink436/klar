"use client";

// ThrottleUp affiliate onboarding shell. 4 steps: welcome, tracking, payout
// form, success. Mirrors the Yarn-Stash pattern with the ThrottleUp dark
// brand palette + Boldonse display font.

import { useState } from "react";
import { t, fill, type Lang } from "./translations";
import { WelcomeStep } from "./WelcomeStep";
import { TrackingStep } from "./TrackingStep";

const T = {
  bg: "#16110D",
  surface: "rgba(245, 239, 227, 0.06)",
  surfaceElevated: "rgba(245, 239, 227, 0.10)",
  text: "#F5EFE3",
  textSecondary: "rgba(245, 239, 227, 0.70)",
  textTertiary: "rgba(245, 239, 227, 0.46)",
  accent: "#FFB547",
  accentDark: "#E08A1E",
  border: "rgba(245, 239, 227, 0.14)",
  error: "#FF8A8A",
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
      const promoCode = (handle.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "MOTO") + "20";
      const res = await fetch("/api/affiliate/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: "moto",
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
                background: done || active ? T.accent : T.border,
                marginBottom: 8,
                transition: "background 200ms",
              }}
            />
            <div
              style={{
                fontSize: 10.5,
                color: active ? T.accent : done ? T.textSecondary : T.textTertiary,
                fontWeight: active ? 700 : 500,
                fontFamily: "var(--font-boldonse), Georgia, serif",
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
      <p style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.55, margin: "8px 0 24px" }}>
        {tt.welcome_body}
      </p>

      <Field label={tt.field_name_label}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt.field_name_placeholder} style={inp()} />
      </Field>

      <Field label={tt.field_country_label}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp()}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code} style={{ background: T.bg, color: T.text }}>{c.label}</option>
          ))}
          <option value="OTHER" style={{ background: T.bg, color: T.text }}>{tt.country_other}</option>
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
                border: `1px solid ${method === m ? T.accent : T.border}`,
                background: method === m ? "rgba(255, 181, 71, 0.18)" : T.surfaceElevated,
                color: method === m ? T.text : T.textSecondary,
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
            <option value="kleinunternehmer" style={{ background: T.bg }}>{tt.tax_kleinunternehmer}</option>
            <option value="regelbesteuert" style={{ background: T.bg }}>{tt.tax_regelbesteuert}</option>
          </select>
        </Field>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 24, cursor: "pointer", color: T.textSecondary, fontSize: 14 }}>
        <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.accent }} />
        {tt.checkbox_invoice_capable}
      </label>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(255, 138, 138, 0.12)", border: `1px solid rgba(255, 138, 138, 0.35)`, borderRadius: 10, color: T.error, fontSize: 14, marginBottom: 16 }}>
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
            background: T.surfaceElevated,
            color: T.textSecondary,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 500,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
            fontFamily: "var(--font-boldonse), Georgia, serif",
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
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
            color: T.bg,
            border: "none",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
            fontFamily: "var(--font-boldonse), Georgia, serif",
            letterSpacing: 0.3,
          }}
        >
          {busy ? tt.submit_busy : tt.submit_idle}
        </button>
      </div>

      <p style={{ fontSize: 11, color: T.textTertiary, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
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
      <p style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.55, marginTop: 8 }}>{tt.done_body}</p>
      <div
        style={{
          marginTop: 14,
          padding: "16px 20px",
          background: `linear-gradient(135deg, ${T.accentDark}, ${T.accent})`,
          borderRadius: 14,
          textAlign: "center",
          fontFamily: "var(--font-boldonse), Georgia, serif",
          fontSize: 32,
          fontWeight: 400,
          color: T.bg,
          letterSpacing: 1.5,
        }}
      >
        {promoCode}
      </div>
      <p style={{ fontSize: 13, color: T.textTertiary, marginTop: 14, lineHeight: 1.6 }}>
        {fill(tt.done_share_explainer, { sharePct, shareMonths })}
      </p>
      <p style={{ fontSize: 13, color: T.textTertiary, marginTop: 18 }}>
        {tt.done_tracking_label}
        <br />
        <code
          style={{
            display: "inline-block",
            marginTop: 6,
            padding: "8px 12px",
            background: T.surfaceElevated,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.accent,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          }}
        >
          getklar.org/i/throttleup/{promoCode}
        </code>
      </p>
      <a
        href="https://getklar.org/dashboard"
        style={{
          marginTop: 24,
          display: "block",
          width: "100%",
          padding: "16px 24px",
          background: `linear-gradient(135deg, ${T.accent}, ${T.accentDark})`,
          color: T.bg,
          border: "none",
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          textAlign: "center",
          textDecoration: "none",
          fontFamily: "var(--font-boldonse), Georgia, serif",
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
        background: T.bg,
        color: T.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
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
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 24,
        padding: "32px 28px",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>{label}</label>
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
function inp(): React.CSSProperties {
  return {
    width: "100%",
    padding: "11px 14px",
    background: T.surfaceElevated,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    color: T.text,
    fontSize: 15,
    outline: "none",
  };
}
