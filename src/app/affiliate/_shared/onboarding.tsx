"use client";

// Affiliate onboarding — port of the Claude Design handoff. Step routing,
// step components, calculator, attribution diagram, mascot panel — all in
// one file because they share types + helpers and Next.js bundles them as
// a single chunk anyway.

import { useEffect, useMemo, useRef, useState } from "react";
import { Brand, BrandKey, BRANDS, STEPS, StepKey, getTrackingUrl, brandText } from "./brands";
import { getMessages, type Lang, type Messages } from "./i18n";

// ── Icons ────────────────────────────────────────────────────────────────────
const ArrowRight = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14M13 5l7 7-7 7"/>
  </svg>
);
const ArrowLeft = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M19 12H5M11 5l-7 7 7 7"/>
  </svg>
);
const DocIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="14" y2="13"/>
    <line x1="8" y1="17" x2="14" y2="17"/>
  </svg>
);
const ChartIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="3" y1="20" x2="21" y2="20"/>
    <line x1="6" y1="20" x2="6" y2="13"/>
    <line x1="11" y1="20" x2="11" y2="8"/>
    <line x1="16" y1="20" x2="16" y2="15"/>
    <line x1="20" y1="20" x2="20" y2="10"/>
  </svg>
);
const CheckIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="5 12 10 17 19 7"/>
  </svg>
);
const ShareIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>
  </svg>
);
const ExternalIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/>
  </svg>
);

// ── Payout form state shape (lifted to shell so steps can navigate back) ────
// Only Wise is supported as a payout rail. PayPal + SEPA are out of scope
// until those rails are actually configured on our side.
export interface PayoutState {
  displayName: string;
  country: string;
  method: "wise";
  handle: string;
  taxStatus: string;
  canInvoice: boolean;
  agreementAccepted: boolean;
}

// ── Top frame (icon header + progress bars + step label) ───────────────────
function stepLabel(t: Messages, key: StepKey): string {
  switch (key) {
    case "welcome": return t.stepWelcome;
    case "tracking": return t.stepTracking;
    case "payout": return t.stepPayout;
    case "live": return t.stepLive;
  }
}
function Topframe({ brand, step, t, lang }: { brand: Brand; step: number; t: Messages; lang: Lang }) {
  const vibeText = brandText(brand, "vibe", lang);
  return (
    <div className="aff-topframe">
      <div className="aff-icon-header">
        <div className="icon-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.iconUrl} alt={`${brand.name} icon`} />
        </div>
        <div className="icon-meta">
          <div className="app-name">{brand.name}</div>
          <div className="app-meta">{t.brandSubline} <span className="dot">●</span> {vibeText.split(",")[0]}</div>
        </div>
      </div>
      <div className="aff-steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`bar${i < step ? " done" : ""}${i === step ? " active" : ""}`} />
        ))}
      </div>
      <div className="aff-steplabel">
        <span className="name">{stepLabel(t, STEPS[step].key)}</span>
        <span className="count">{t.stepShort} {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

// ── Icon panel — replaces the per-brand mascot, always shows the app icon ───
function IconPanel({ brand, tagline }: { brand: Brand; tagline?: string }) {
  return (
    <div className="aff-icon-panel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.iconUrl} alt={`${brand.name} app icon`} />
      {tagline ? <span className="tagline">{tagline}</span> : null}
    </div>
  );
}

// ── Stream cards summary (top of Step 1) ────────────────────────────────────
function StreamCardsForBrand({ brand }: { brand: Brand }) {
  const months = brand.attributionMonths || 12;
  const s2 = brand.secondStream;
  const isSub = /\/mo|\/m/i.test(brand.productPrice);
  return (
    <div className={`aff-streams-grid${s2 ? "" : " single"}`}>
      <div className="aff-stream-card">
        <span className="stream-num">①</span>
        <div className="stream-eyebrow">{isSub ? "Premium-Abos" : "Premium-Verkäufe"}</div>
        <div className="stream-title">
          {brand.commissionPct} % <span className="italic">{isSub ? "der Sub." : "pro Verkauf."}</span>
        </div>
        <div className="stream-detail">
          {isSub
            ? <>Pro Premium-Kauf bekommst du <b>{brand.commissionPct} %</b> der Sub-Einnahmen, <b>{months} Monate lang</b>. {brand.productPrice ? `Sub-Preis ${brand.productPrice}.` : ""}</>
            : <>Pro Premium-Verkauf bekommst du <b>{brand.commissionPct} %</b> des Verkaufspreises. {brand.productPrice ? `Preis ${brand.productPrice}.` : ""} <b>{months} Monate Cookie-Window</b>.</>}
        </div>
      </div>
      {s2 ? (
        <div className="aff-stream-card">
          <span className="stream-num">②</span>
          <div className="stream-eyebrow">{s2.sublabel || s2.label}</div>
          <div className="stream-title">
            {s2.kind === "yarn-shop"
              ? <>Anteil an <span className="italic">Garn-Käufen.</span></>
              : <>Anteil an <span className="italic">Album-Käufen.</span></>}
          </div>
          <div className="stream-detail">
            {s2.kind === "yarn-shop"
              ? <>Jedes Mal wenn dein User Garn über die In-App Shop-Links kauft, bekommst du einen Anteil an unserer Awin-Provision.{" "}<b>Bei Strick-Audiences meist der größere Stream</b>, weil Stricker:innen regelmäßig nachkaufen.</>
              : <>Wenn dein User ein 4k-Album kauft, bekommst du <b>50 % des Verkaufspreises</b>. One-Shot, ideal für Event-Trigger wie Hochzeiten oder Festivals.</>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Slider helpers (log + lin) ──────────────────────────────────────────────
const LOG_RES = 1000;
const logToPos = (val: number, min: number, max: number) =>
  Math.round(((Math.log(val) - Math.log(min)) / (Math.log(max) - Math.log(min))) * LOG_RES);
const logFromPos = (pos: number, min: number, max: number) =>
  Math.round(Math.exp(Math.log(min) + (pos / LOG_RES) * (Math.log(max) - Math.log(min))));

function compactNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "M";
  if (n >= 1_000)     return (n / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + "k";
  return n.toLocaleString("de-DE");
}

function NumInput({ value, setValue, min, max, ariaLabel, width = 92 }: { value: number; setValue: (n: number) => void; min: number; max: number; ariaLabel: string; width?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const fmt = (n: number) => n.toLocaleString("de-DE");
  const display = editing ? draft : fmt(value);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <input
      type="text"
      inputMode="numeric"
      className="numval"
      aria-label={ariaLabel}
      value={display}
      style={{ width }}
      onFocus={(e) => {
        setEditing(true);
        setDraft(String(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".").slice(0, 9);
        setDraft(e.target.value.slice(0, 11));
        const n = cleaned === "" ? NaN : parseFloat(cleaned);
        if (!isNaN(n)) setValue(clamp(n));
      }}
      onBlur={() => {
        setEditing(false);
        if (draft === "") setValue(min);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
    />
  );
}

function LogSlider({ value, setValue, min, max, ticks, ariaLabel }: { value: number; setValue: (n: number) => void; min: number; max: number; ticks: number[]; ariaLabel: string }) {
  const pos = logToPos(value, min, max);
  return (
    <>
      <input
        className="aff-rg" type="range"
        min={0} max={LOG_RES} step={1}
        value={pos}
        aria-label={ariaLabel}
        onChange={(e) => setValue(logFromPos(+e.target.value, min, max))}
        style={{ ["--fill" as string]: Math.round((pos / LOG_RES) * 100) + "%" } as React.CSSProperties} />
      <div className="ticks">
        {ticks.map((t) => {
          const left = ((Math.log(t) - Math.log(min)) / (Math.log(max) - Math.log(min))) * 100;
          return (
            <span key={t} className="tick" style={{ left: left + "%" }}>
              {compactNum(t)}
            </span>
          );
        })}
      </div>
    </>
  );
}

function LinSlider({ value, setValue, min, max, step = 1, ticks, ariaLabel, unit }: { value: number; setValue: (n: number) => void; min: number; max: number; step?: number; ticks: number[]; ariaLabel: string; unit?: string }) {
  const fill = Math.round(((value - min) / (max - min)) * 100);
  return (
    <>
      <input
        className="aff-rg" type="range"
        min={min} max={max} step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => setValue(+e.target.value)}
        style={{ ["--fill" as string]: fill + "%" } as React.CSSProperties} />
      <div className="ticks">
        {ticks.map((t) => {
          const left = ((t - min) / (max - min)) * 100;
          return (
            <span key={t} className="tick" style={{ left: left + "%" }}>
              {t}{unit || ""}
            </span>
          );
        })}
      </div>
    </>
  );
}

function brandPrice(brand: Brand) {
  return parseFloat(String(brand.productPrice).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
}

// Tween-Number-Hook: interpoliert zwischen prev und next Wert über `duration` ms mit
// ease-out-cubic. Respektiert prefers-reduced-motion: dann snap-to-value. Wird im
// Calculator-Total verwendet damit Slider-Bewegung einen flüssigen Euro-Zähler triggert
// statt harten Sprung. Reine RAF-Implementation, keine externe Dep.
function useTweenNumber(value: number, duration = 280): number {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (typeof window === "undefined") { setDisplay(value); return; }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setDisplay(value); return; }
    const from = display;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(p === 1 ? value : from + (value - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // display darf nicht in deps, sonst Endlos-Loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return display;
}

// ── Calculator ──────────────────────────────────────────────────────────────
function Calculator({ brand }: { brand: Brand }) {
  const [views, setViews] = useState(50000);
  const [convPct, setConvPct] = useState(10);
  const s2 = brand.secondStream;
  const [s2Rate, setS2Rate] = useState(s2?.defaultRate ?? 0);
  const [s2Basket, setS2Basket] = useState(s2?.defaultBasket ?? 0);

  // Annahmen offen ausgewiesen (siehe formula-hint unter den mini-rows). Realistisch
  // für gut-getargetete Creator: 3,5 % Bio-CTR (Hook-driven Captions schaffen 3-5 %),
  // 28 % Install-aus-Klick (Branchenwert für Lifestyle/Utility iOS mit poliertem
  // Store-Listing liegt in 25-35 %). Bleibt deutlich unter "Show"-Werten (40 %+).
  const BIO_CTR = 0.035;
  const INSTALL_RATE = 0.28;

  const clicks = Math.round(views * BIO_CTR);
  const installs = Math.round(clicks * INSTALL_RATE);
  const buyers = Math.round(installs * (convPct / 100));

  const price = brandPrice(brand);
  const isSub = /\/mo|\/m/i.test(brand.productPrice);
  const streamOne = buyers * price * (brand.commissionPct / 100);
  const months = brand.attributionMonths || 12;

  let streamTwo = 0;
  let streamTwoNote = "";
  if (s2) {
    if (s2.kind === "yarn-shop") {
      const shoppers = Math.round(installs * (s2Rate / 100));
      streamTwo = shoppers * s2Basket * s2.commissionRate;
      streamTwoNote = `${shoppers.toLocaleString("de-DE")} aktive Garn-Käufer × ${s2Basket} € Korb × ${(s2.commissionRate * 100).toFixed(2).replace(".", ",")} %`;
    } else if (s2.kind === "album-buy") {
      const albumBuyers = Math.round(installs * (s2Rate / 100));
      streamTwo = albumBuyers * s2Basket * s2.commissionRate;
      streamTwoNote = `${albumBuyers.toLocaleString("de-DE")} Album-Käufer × ${s2Basket} € × ${(s2.commissionRate * 100).toFixed(0)} %`;
    }
  }

  const total = streamOne + streamTwo;
  const totalTween = useTweenNumber(total);
  const fmt = (n: number) => Math.round(n).toLocaleString("de-DE");

  return (
    <div className="aff-calc">
      <div className="slider-row">
        <div className="slider-head">
          <span className="name">Views pro Monat &middot; alle Posts zusammen</span>
          <NumInput value={views} setValue={setViews} min={1000} max={5_000_000} ariaLabel="Views pro Monat" />
        </div>
        <LogSlider value={views} setValue={setViews} min={1000} max={5_000_000} ticks={[1000, 10000, 100000, 1_000_000, 5_000_000]} ariaLabel="Views pro Monat" />
      </div>

      <div className="stream-divider" style={{ marginTop: 4 }}>
        <span className="label"><span className="plus">①</span>STREAM &middot; {brand.streamLabel || "Premium-Abos"}</span>
        <span className="line" />
      </div>
      <div className="stream-sub">
        {isSub
          ? `${brand.productPrice} · ${brand.commissionPct} % an dich, ${months} Monate lang.`
          : `${brand.productPrice} · ${brand.commissionPct} % an dich pro Verkauf.`}
      </div>

      <div className="slider-row">
        <div className="slider-head">
          <span className="name">Premium-Conversion nach Install</span>
          <span className="valgroup">
            <NumInput value={convPct} setValue={setConvPct} min={3} max={15} ariaLabel="Premium-Conversion" width={48} />
            <span className="unit">%</span>
          </span>
        </div>
        <LinSlider value={convPct} setValue={setConvPct} min={3} max={15} step={1} ticks={[3, 6, 9, 12, 15]} unit=" %" ariaLabel="Premium-Conversion" />
      </div>

      <div className="mini-rows">
        <span><span className="arrow">→</span> Bio-Klicks <i>(Annahme {(BIO_CTR * 100).toFixed(1).replace(".", ",")} % der Views)</i></span>
        <span className="v">{fmt(clicks)}</span>
        <span><span className="arrow">→</span> Installs <i>(Annahme {Math.round(INSTALL_RATE * 100)} % der Klicks)</i></span>
        <span className="v">{fmt(installs)}</span>
        <span><span className="arrow">→</span> Premium-Käufer <i>({convPct} % Conv)</i></span>
        <span className="v">{fmt(buyers)}</span>
        <span><span className="arrow">→</span> {brand.productPriceShort || brand.productPrice} &times; {brand.commissionPct} %</span>
        <span className="v">{fmt(streamOne)} €{isSub ? "/mo" : ""}</span>
      </div>

      {s2 ? (
        <>
          <div className="stream-divider" style={{ marginTop: 6 }}>
            <span className="label"><span className="plus">②</span>STREAM &middot; {s2.label}</span>
            <span className="line" />
          </div>
          <div className="stream-sub">{s2.sublabel}</div>

          <div className="slider-row">
            <div className="slider-head">
              <span className="name">{s2.rateLabel}</span>
              <span className="valgroup">
                <NumInput value={s2Rate} setValue={setS2Rate} min={s2.rateMin} max={s2.rateMax} ariaLabel={s2.rateLabel} width={48} />
                <span className="unit">%</span>
              </span>
            </div>
            <LinSlider value={s2Rate} setValue={setS2Rate} min={s2.rateMin} max={s2.rateMax} step={s2.rateStep} ticks={[s2.rateMin, Math.round((s2.rateMin + s2.rateMax) / 2), s2.rateMax]} unit=" %" ariaLabel={s2.rateLabel} />
          </div>

          <div className="slider-row">
            <div className="slider-head">
              <span className="name">{s2.basketLabel}</span>
              <span className="valgroup">
                <NumInput value={s2Basket} setValue={setS2Basket} min={s2.basketMin} max={s2.basketMax} ariaLabel={s2.basketLabel} width={60} />
                <span className="unit">{s2.basketUnit}</span>
              </span>
            </div>
            <LinSlider value={s2Basket} setValue={setS2Basket} min={s2.basketMin} max={s2.basketMax} step={s2.basketStep} ticks={[s2.basketMin, Math.round((s2.basketMin + s2.basketMax) / 2), s2.basketMax]} unit={" " + s2.basketUnit} ariaLabel={s2.basketLabel} />
          </div>

          <p className="formula-hint" style={{ marginTop: -4 }}>
            <b>{streamTwoNote}</b> &nbsp;&middot;&nbsp; {s2.hint}
          </p>

          <div className="mini-rows">
            <span><span className="arrow">→</span> Stream 2 {s2.recurring ? "pro Monat" : "pro Install-Cohort"}</span>
            <span className="v">{fmt(streamTwo)} €</span>
          </div>
        </>
      ) : null}

      <div className="total-pop">
        <span className="tp-label">
          {s2
            ? <>{isSub ? "Gesamt monatlich an dich" : "Gesamt pro Cohort"} <small>Stream 1 + Stream 2</small></>
            : isSub
              ? <>monatlich an dich <small>{months} Monate lang</small></>
              : <>pro Cohort an dich <small>One-Shot Premium-Verkauf</small></>}
        </span>
        <span className="tp-value">{fmt(totalTween)} €{isSub ? <span className="small">/ mo</span> : null}</span>
      </div>

      <p className="formula-hint" style={{ textAlign: "center" }}>
        Lifetime pro Install-Cohort (×&nbsp;{months}&nbsp;Monate): <b>{fmt(total * months)} €</b>
      </p>
    </div>
  );
}

// ── AttributionDiagram (Step 2 SVG) ─────────────────────────────────────────
function PhoneFrame({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-34" y="-62" width="68" height="124" rx="12" style={{ fill: "var(--aff-bg-elev)", stroke: "var(--aff-fg)", strokeWidth: 1.8 }} />
      <rect x="-10" y="-59" width="20" height="3" rx="1.5" style={{ fill: "var(--aff-fg)" }} />
      {children}
    </g>
  );
}

function TileCaption({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" style={{ fontSize: 13, fontFamily: "var(--font-editorial)", fontStyle: "italic", fill: "var(--aff-fg)" }}>
      {text}
    </text>
  );
}

function StickerLabel({ x, y, rot = 0, text, italic = false }: { x: number; y: number; rot?: number; text: string; italic?: boolean }) {
  const fontSize = italic ? 11 : 10;
  const width = Math.max(40, text.length * (italic ? 6.4 : 7.6));
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}>
      <rect x={-width / 2} y="-10" width={width} height="20" rx="3" style={{ fill: "var(--aff-bg-elev)", stroke: "var(--aff-fg)", strokeWidth: 0.8 }} />
      <text textAnchor="middle" y={italic ? 4 : 3.5} style={{ fontSize, fontFamily: italic ? "var(--font-editorial)" : "var(--font-mono)", fontStyle: italic ? "italic" : "normal", fill: "var(--aff-bg)", letterSpacing: italic ? "0" : "1.2px", fontWeight: italic ? 400 : 600 }}>{text}</text>
    </g>
  );
}

function NumberBadge({ x, y, n }: { x: number; y: number; n: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-13" y="-9" width="26" height="18" rx="4" style={{ fill: "var(--aff-fg)" }} />
      <text textAnchor="middle" y="4" style={{ fontSize: 10.5, fontFamily: "var(--font-display)", fill: "var(--aff-bg)", letterSpacing: "0.5px" }}>{n}</text>
    </g>
  );
}

function AttributionDiagram({ brand }: { brand: Brand }) {
  return (
    <figure className="aff-attr-diagram" aria-label={`Attribution-Flow für ${brand.name}`}>
      <svg viewBox="0 0 480 460" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", display: "block" }}>
        <defs>
          <marker id="aend" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 z" style={{ fill: "var(--aff-fg)" }} />
          </marker>
        </defs>

        <path d="M 138 110 Q 240 60 342 110" fill="none" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" markerEnd="url(#aend)" style={{ stroke: "var(--aff-fg)" }} />
        <path d="M 378 188 Q 250 240 102 268" fill="none" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" markerEnd="url(#aend)" style={{ stroke: "var(--aff-fg)" }} />
        <path d="M 138 335 Q 240 388 342 335" fill="none" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" markerEnd="url(#aend)" style={{ stroke: "var(--aff-fg)" }} />

        <StickerLabel x={240} y={48} rot={-2} text="60 d" />
        <StickerLabel x={250} y={230} rot={4}  text="deeplink" italic />
        <StickerLabel x={240} y={400} rot={-2} text="30 d" />

        <PhoneFrame x={100} y={110}>
          <circle cx="-20" cy="-44" r="5" style={{ fill: "var(--aff-bg-elev)", stroke: "var(--aff-fg)", strokeWidth: 0.8 }} />
          <rect x="-12" y="-46" width="26" height="2.2" rx="1.1" style={{ fill: "var(--aff-fg)", opacity: 0.65 }} />
          <rect x="-12" y="-41" width="18" height="1.6" rx="0.8" style={{ fill: "var(--aff-fg-3)", opacity: 0.55 }} />
          {[-22, -8, 6, 20].map((x, i) => (
            <rect key={i} x={x - 5} y="-33" width="10" height="3" rx="1.5" style={{ fill: i === 0 ? "var(--aff-fg)" : "var(--aff-line-strong)" }} />
          ))}
          <rect x="-26" y="-24" width="52" height="20" rx="5" style={{ fill: "var(--aff-fg)" }} />
          <circle cx="-18" cy="-14" r="4" style={{ fill: "var(--aff-bg)", opacity: 0.25 }} />
          <path d="M 12 -14 L 18 -14 M 15 -17 L 18 -14 L 15 -11" fill="none" style={{ stroke: "var(--aff-bg)", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }} />
          <circle cx="22" cy="-14" r="15" fill="none" style={{ stroke: "var(--aff-fg)", strokeWidth: 0.7, opacity: 0.18 }} />
          <circle cx="22" cy="-14" r="10" fill="none" style={{ stroke: "var(--aff-fg)", strokeWidth: 0.9, opacity: 0.4 }} />
          <circle cx="22" cy="-14" r="4" style={{ fill: "var(--aff-fg)" }} />
          {[2, 14, 26].map((y, i) => (
            <rect key={i} x="-26" y={y} width={[52, 44, 50][i]} height="6" rx="2" style={{ fill: "var(--aff-line-strong)" }} />
          ))}
          <line x1="-34" y1="46" x2="34" y2="46" style={{ stroke: "var(--aff-line-strong)", strokeWidth: 0.5 }} />
          {[-22, -10, 2, 14, 26].map((x, i) => (
            <rect key={i} x={x - 3.5} y="50" width="7" height="7" rx="1.5" style={{ fill: i === 4 ? "var(--aff-fg)" : "var(--aff-line-strong)" }} />
          ))}
        </PhoneFrame>
        <NumberBadge x={48} y={56} n="01" />
        <TileCaption x={100} y={198} text="Du teilst den Link." />

        <g transform="translate(380,118)">
          <line x1="0" y1="-72" x2="0" y2="-50" style={{ stroke: "var(--aff-fg)", strokeWidth: 1.5, strokeLinecap: "round" }} />
          <path d="M -6 -56 L 0 -50 L 6 -56" fill="none" style={{ stroke: "var(--aff-fg)", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }} />
          {/* App icon as the install target — clipped to a rounded square so
              the photo doesn't bleed outside the tile. */}
          <defs>
            <clipPath id="appicon-clip">
              <rect x="-40" y="-40" width="80" height="80" rx="18" />
            </clipPath>
          </defs>
          <rect x="-40" y="-40" width="80" height="80" rx="18" style={{ fill: "var(--aff-bg-elev)", stroke: "var(--aff-line-strong)", strokeWidth: 1.5 }} />
          <image href={brand.iconUrl} x="-40" y="-40" width="80" height="80" clipPath="url(#appicon-clip)" preserveAspectRatio="xMidYMid slice" />
          <rect x="-40" y="50" width="80" height="4" rx="2" style={{ fill: "var(--aff-line-strong)" }} />
          <rect x="-40" y="50" width="54" height="4" rx="2" style={{ fill: "var(--aff-fg)" }} />
          <g transform="translate(0,68)" style={{ fill: "var(--aff-fg)" }}>
            {[-22, -11, 0, 11, 22].map((x, i) => (
              <text key={i} x={x} y="0" textAnchor="middle" style={{ fontSize: 9 }}>★</text>
            ))}
          </g>
        </g>
        <NumberBadge x={329} y={56} n="02" />
        <TileCaption x={380} y={210} text="Sie installieren." />

        <PhoneFrame x={100} y={335}>
          <path d="M -16 -38 L -10 -28 L 0 -42 L 10 -28 L 16 -38 L 14 -22 L -14 -22 Z" style={{ fill: "var(--aff-fg)", stroke: "var(--aff-fg)", strokeWidth: 1, strokeLinejoin: "round" }} />
          <circle cx="-16" cy="-39" r="1.6" style={{ fill: "var(--aff-fg)" }} />
          <circle cx="0"   cy="-43" r="1.6" style={{ fill: "var(--aff-fg)" }} />
          <circle cx="16"  cy="-39" r="1.6" style={{ fill: "var(--aff-fg)" }} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx="-20" cy={-8 + i * 11} r="3" style={{ fill: "var(--aff-fg)" }} />
              <path d={`M -21.5 ${-8 + i * 11} L -20.2 ${-6.7 + i * 11} L -18 ${-9.5 + i * 11}`} fill="none" style={{ stroke: "var(--aff-bg)", strokeWidth: 0.9, strokeLinecap: "round", strokeLinejoin: "round" }} />
              <rect x="-14" y={-10 + i * 11} width={[30, 24, 28][i]} height="4" rx="2" style={{ fill: "var(--aff-fg)", opacity: 0.7 }} />
            </g>
          ))}
          <rect x="-28" y="34" width="56" height="18" rx="6" style={{ fill: "var(--aff-fg)" }} />
          <path d="M 6 43 L 14 43 M 10 39 L 14 43 L 10 47" fill="none" style={{ stroke: "var(--aff-bg)", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }} />
        </PhoneFrame>
        <NumberBadge x={48} y={281} n="03" />
        <TileCaption x={100} y={423} text="Sie kaufen Premium." />

        <g transform="translate(380,335)">
          {[
            { cx: -20, cy: -34, r: 8.5 },
            { cx: 18,  cy: -46, r: 10 },
            { cx: 0,   cy: -58, r: 6.5 },
          ].map((c, i) => (
            <g key={i}>
              <circle cx={c.cx} cy={c.cy} r={c.r} style={{ fill: "var(--aff-fg)", stroke: "var(--aff-fg)", strokeWidth: 1.4 }} />
              <text x={c.cx} y={c.cy + c.r * 0.35} textAnchor="middle" style={{ fontSize: c.r * 1.1, fontFamily: "var(--font-display)", fontWeight: 700, fill: "var(--aff-bg)" }}>€</text>
            </g>
          ))}
          <ellipse cx="0" cy="56" rx="36" ry="4.5" style={{ fill: "var(--aff-fg)", opacity: 0.10 }} />
          <path d="M -20 -4 L -16 -14 Q -8 -10 -4 -4 L 4 -4 Q 8 -10 16 -14 L 20 -4 Q 32 6 32 24 Q 32 50 0 50 Q -32 50 -32 24 Q -32 6 -20 -4 Z" style={{ fill: "var(--aff-bg-elev)", stroke: "var(--aff-fg)", strokeWidth: 2, strokeLinejoin: "round" }} />
          <rect x="-22" y="-5" width="44" height="6" style={{ fill: "var(--aff-fg)" }} />
          <text x="0" y="34" textAnchor="middle" style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 700, fill: "var(--aff-fg)" }}>€</text>
        </g>
        <NumberBadge x={329} y={281} n="04" />
        <TileCaption x={380} y={423} text="Du wirst ausgezahlt." />
      </svg>

      <figcaption style={{ padding: "10px 12px 4px", fontSize: 12, lineHeight: 1.5, color: "var(--aff-fg-3)", textAlign: "center" }}>
        Vier Stationen, ein Link. 30 Tage Refund-Holdback nach jedem Kauf, danach landet dein Anteil per Wise auf deinem Konto.
      </figcaption>
    </figure>
  );
}

// ── Step 1 · Welcome ────────────────────────────────────────────────────────
function StepWelcome({ brand, go, handle, t, lang }: { brand: Brand; go: () => void; handle: string; t?: Messages; lang?: Lang }) {
  void t; void lang;
  return (
    <div className="aff-pad aff-stack-lg">
      <div className="aff-stack-md">
        <h1 className="aff-h1">
          Hi <span className="italic">{handle},</span>
        </h1>
        <p className="aff-lede">
          Willkommen im {brand.name} Affiliate-Programm. Vier kurze Schritte, dann ist dein Tracking-Link live.
        </p>
      </div>

      <IconPanel brand={brand} tagline={brand.handTagline} />

      <div className="aff-section">
        <span className="aff-eyebrow">So verdienst du</span>
        <h3>
          {brand.secondStream ? <>Zwei Einkommens-<span className="italic">Ströme.</span></> : <>Dein <span className="italic">Einkommens-Strom.</span></>}
        </h3>
        <StreamCardsForBrand brand={brand} />
      </div>

      <div className="aff-section">
        <span className="aff-eyebrow">Rechne selbst</span>
        <h3>Was springt für dich <span className="italic">raus?</span></h3>
        <p style={{ marginBottom: 4 }}>
          Schieb die Regler auf realistische Werte für deine Audience. Die Rechnung passt sich live an.
        </p>
        <Calculator brand={brand} />
      </div>

      <div className="aff-cta-stack">
        <button className="aff-btn aff-btn-primary" onClick={go}>
          Weiter <ArrowRight />
        </button>
      </div>
    </div>
  );
}

// ── Step 2 · Tracking ───────────────────────────────────────────────────────
function StepTracking({ brand, go, prev, t, lang }: { brand: Brand; go: () => void; prev: () => void; t?: Messages; lang?: Lang }) {
  void t; void lang;
  return (
    <div className="aff-pad aff-stack-lg">
      <div className="aff-stack-md">
        <h1 className="aff-h1 small">So funktioniert <span className="italic">das Tracking.</span></h1>
        <p className="aff-lede">
          Selbst-attributiert, kein zusätzlicher Tracker auf deiner Seite nötig. Dein Link erkennt dich automatisch wieder, der Rest passiert serverseitig bei uns.
        </p>
      </div>

      <AttributionDiagram brand={brand} />

      <div className="aff-section">
        <span className="aff-eyebrow">Schutz-Mechanismen</span>
        <ul>
          <li><span className="mark">✓</span><span>Self-Referral-Block: dein eigener Account zählt nicht</span></li>
          <li><span className="mark">✓</span><span>Refund-Window 30 Tage, danach ist die Provision sicher</span></li>
          <li><span className="mark">✓</span><span>IP- und Device-Fingerprint gegen Fraud-Bursts</span></li>
          <li><span className="mark">✓</span><span>Cookie-loses Fallback per Install-Receipt für iOS 14+</span></li>
        </ul>
      </div>

      <div className="aff-section">
        <span className="aff-eyebrow">Werbekennzeichnung</span>
        <p style={{ fontSize: 13.5, color: "var(--aff-fg)" }}>
          Markiere Affiliate-Content immer als <i>Werbung</i> oder <i>Anzeige</i>. Bei Stories reicht der Sticker, bei Reels und Posts gehört es in die ersten Zeilen der Caption. Das schützt dich und uns.
        </p>
      </div>

      <div className="aff-btn-row">
        <button className="aff-btn aff-btn-secondary" onClick={prev} aria-label="Zurück">
          <ArrowLeft />
        </button>
        <button className="aff-btn aff-btn-primary" onClick={go}>
          Weiter <ArrowRight />
        </button>
      </div>
    </div>
  );
}

// ── Step 3 · Payout ─────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function StepPayout({ brand, go, prev, state, setState, onSubmit, t }: { brand: Brand; go: () => void; prev: () => void; state: PayoutState; setState: (s: PayoutState) => void; onSubmit?: (s: PayoutState) => Promise<void>; t?: Messages }) {
  void t;
  const f = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const set = <K extends keyof PayoutState>(k: K, v: PayoutState[K]) => setState({ ...f, [k]: v });
  const emailOk = EMAIL_RE.test(f.handle.trim());
  const valid = f.displayName.trim().length > 1
    && emailOk
    && f.country
    && f.taxStatus
    && f.agreementAccepted;

  async function handleNext() {
    if (!valid) return;
    if (!onSubmit) { go(); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(f);
      go();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup fehlgeschlagen, bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aff-pad aff-stack-lg">
      <div className="aff-stack-md">
        <h1 className="aff-h1 small">Wohin geht <span className="italic">das Geld?</span></h1>
        <p className="aff-lede">
          Wir zahlen monatlich aus, sobald 50 € erreicht sind. Beträge darunter laufen in den nächsten Monatslauf. Daten kannst du jederzeit im Dashboard ändern.
        </p>
      </div>

      <div className="aff-stack-md">
        <div className="aff-field">
          <label className="aff-field-label">Anzeigename auf der Rechnung</label>
          <input className="aff-field-input" value={f.displayName} placeholder="Molly Hartmann" onChange={(e) => set("displayName", e.target.value)} />
        </div>

        <div className="aff-field">
          <label className="aff-field-label">Land der Steuerpflicht</label>
          <select className="aff-field-select" value={f.country} onChange={(e) => set("country", e.target.value)}>
            <option value="">Bitte wählen</option>
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
            <option value="NL">Niederlande</option>
            <option value="FR">Frankreich</option>
            <option value="IT">Italien</option>
            <option value="ES">Spanien</option>
            <option value="OTHER">Anderes EU-Land</option>
          </select>
        </div>

        <div className="aff-field">
          <label className="aff-field-label">Auszahlung via Wise</label>
          <p style={{ fontSize: 13, color: "var(--aff-fg-3)", margin: "2px 0 0", lineHeight: 1.45 }}>
            Wir zahlen aktuell ausschließlich über Wise aus. Du brauchst nur eine E-Mail, die mit deinem Wise-Konto verknüpft ist. Wise leitet das Geld in deine Lokalwährung weiter.
          </p>
        </div>

        <div className="aff-field">
          <label className="aff-field-label">E-Mail deines Wise-Kontos</label>
          <input
            className="aff-field-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={f.handle}
            placeholder="pay@molly.studio"
            onChange={(e) => set("handle", e.target.value)}
            onBlur={() => setEmailTouched(true)}
            aria-invalid={emailTouched && !emailOk}
          />
          {emailTouched && !emailOk && f.handle.length > 0 ? (
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--aff-fg-2)" }}>
              Bitte gib eine vollständige E-Mail-Adresse ein, die mit deinem Wise-Konto verknüpft ist.
            </p>
          ) : null}
        </div>

        <div className="aff-field">
          <label className="aff-field-label">Steuerstatus</label>
          <select className="aff-field-select" value={f.taxStatus} onChange={(e) => set("taxStatus", e.target.value)}>
            <option value="">Bitte wählen</option>
            <option value="kleinunternehmer">Kleinunternehmer, keine MwSt</option>
            <option value="regelbesteuert">Regelbesteuert, mit MwSt</option>
            <option value="unknown">Privatperson, ohne Gewerbe</option>
          </select>
        </div>

        <label className="aff-check">
          <input type="checkbox" checked={f.canInvoice} onChange={(e) => set("canInvoice", e.target.checked)} />
          <span className="box" />
          <span className="ctext">
            Ich kann eine Rechnung mit ausgewiesener MwSt ausstellen.
            <small>Falls nicht, übernehmen wir die Gutschrift automatisch für dich.</small>
          </span>
        </label>

        <label className="aff-check">
          <input type="checkbox" checked={f.agreementAccepted} onChange={(e) => set("agreementAccepted", e.target.checked)} />
          <span className="box" />
          <span className="ctext">
            Ich akzeptiere die <a href="/legal/affiliate-agreement" target="_blank" rel="noopener noreferrer" style={{ color: "var(--aff-fg)", textDecoration: "underline", textUnderlineOffset: 2 }}>Affiliate-Bedingungen</a> der Version v1.0.
            <small>
              {brand.commissionPct}&nbsp;%&nbsp;{brand.streamLabel?.toLowerCase().includes("abo") ? "Sub-Anteil" : "Anteil"}, {brand.attributionMonths}&nbsp;Monate Attribution, 30 Tage Refund-Holdback, monatliche Auszahlung ab 50&nbsp;€. IP und Zeitstempel werden für den Audit-Trail gespeichert.
            </small>
          </span>
        </label>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "color-mix(in oklab, var(--aff-fg), transparent 88%)", border: "1px solid color-mix(in oklab, var(--aff-fg), transparent 60%)", borderRadius: 10, color: "var(--aff-bg)", fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <div className="aff-btn-row">
        <button className="aff-btn aff-btn-secondary" onClick={prev} aria-label="Zurück" disabled={busy}>
          <ArrowLeft />
        </button>
        <button className="aff-btn aff-btn-primary" disabled={!valid || busy} onClick={handleNext} style={!valid || busy ? { opacity: 0.6, cursor: busy ? "wait" : "not-allowed", transform: "none", boxShadow: "none" } : undefined}>
          {busy ? "Speichere…" : <>Affiliate-Setup abschließen <ArrowRight /></>}
        </button>
      </div>

      <p className="aff-consent">
        Mit Klick auf <i>abschließen</i> bestätigst du, dass die Angaben korrekt sind und du die <a href="/legal/affiliate-agreement" target="_blank" rel="noopener noreferrer">Affiliate-Bedingungen</a> inklusive der Datenschutz-Hinweise in §05 gelesen hast. Du kannst jederzeit kündigen, ausstehende Provisionen verfallen nicht.
      </p>
    </div>
  );
}

// ── Step 4 · Live ───────────────────────────────────────────────────────────
function StepLive({ brand, state, handle, t, lang }: { brand: Brand; state: PayoutState; handle: string; t?: Messages; lang?: Lang }) {
  void t; void lang;
  const [copied, setCopied] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  // Tracking link target depends on the brand. Apps with their own
  // tracking-landing domain (wavelength, kelva, trubel, myloo) keep pointing
  // there. Apps without a sister domain (yarn-stash, throttleup) land on
  // klar's own /i/<slug>/<code> route. Same mapping the server-side
  // confirmation-email composer reads, so UI + email never diverge.
  const slug = handle.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "creator";
  const trackingUrl = getTrackingUrl(brand.key, slug);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const copy = (key: string, value: string) => {
    try { navigator.clipboard.writeText(value); } catch (_) { /* noop */ }
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const share = async () => {
    try {
      await navigator.share({
        title: `${brand.name} · Affiliate-Link`,
        text: `Ich nutze ${brand.name} seit ein paar Wochen, hier ist mein Link:`,
        url: trackingUrl,
      });
    } catch (_) { /* user cancel or unsupported, noop */ }
  };

  const captionShort = `Werbung · ${brand.name} App, Link in der Bio. ${trackingUrl}`;
  const captionLong = `Werbung · Ich nutze ${brand.name} seit ein paar Wochen und mag, wie viel Alltag mir das spart. Wenn du es testen willst: ${trackingUrl}`;

  return (
    <div className="aff-pad aff-stack-lg">
      <div className="aff-stack-md" style={{ textAlign: "center" }}>
        <div className="aff-bigcheck"><CheckIcon /></div>
        <h1 className="aff-h1" style={{ textAlign: "center" }}>
          Du bist <span className="italic">live ✓</span>
        </h1>
        <p className="aff-lede" style={{ textAlign: "center" }}>
          Dein persönlicher Tracking-Link ist scharf. Erste Klicks tauchen innerhalb von 5 Minuten im Dashboard auf. Du brauchst keinen Code, der Link macht alles.
        </p>
      </div>

      <IconPanel brand={brand} tagline={brand.handTagline} />

      <div className="aff-stack-sm">
        <div className="aff-eyebrow" style={{ paddingLeft: 4 }}>Dein Tracking-Link</div>
        <div className="aff-codeblock">
          <span className="url">{trackingUrl}</span>
          <button className={`aff-copybtn${copied === "url" ? " copied" : ""}`} onClick={() => copy("url", trackingUrl)}>
            {copied === "url" ? "Kopiert" : "Kopieren"}
          </button>
        </div>
        {canShare ? (
          <button className="aff-btn aff-btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={share}>
            <ShareIcon /> Link teilen
          </button>
        ) : null}
      </div>

      <div className="aff-section">
        <span className="aff-eyebrow">Werbe-Caption · zum Kopieren</span>
        <div className="aff-caption-stack">
          <div className="aff-caption-card">
            <span className="aff-caption-tag">Story / Bio</span>
            <p className="aff-caption-body">{captionShort}</p>
            <button className={`aff-copybtn${copied === "cap-short" ? " copied" : ""}`} onClick={() => copy("cap-short", captionShort)}>
              {copied === "cap-short" ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <div className="aff-caption-card">
            <span className="aff-caption-tag">Reel / Post</span>
            <p className="aff-caption-body">{captionLong}</p>
            <button className={`aff-copybtn${copied === "cap-long" ? " copied" : ""}`} onClick={() => copy("cap-long", captionLong)}>
              {copied === "cap-long" ? "Kopiert" : "Kopieren"}
            </button>
          </div>
        </div>
        <p className="formula-hint" style={{ padding: "0 4px" }}>
          <i>Werbung</i> oder <i>Anzeige</i> gehört in die ersten Zeilen, dann ist die UWG-Kennzeichnung sauber. Restlichen Text gerne in deinen Voice umschreiben.
        </p>
      </div>

      {brand.assetsDriveUrl ? (
        <a href={brand.assetsDriveUrl} target="_blank" rel="noopener noreferrer" className="aff-resource-card">
          <span className="aff-resource-eyebrow">{brand.pdfTitle}</span>
          <span className="aff-resource-title">{brand.pdfHint}</span>
          <span className="aff-resource-meta">Google Drive · Logos, Screenshots, Playbook-PDF <ExternalIcon /></span>
        </a>
      ) : null}

      <div className="aff-section">
        <span className="aff-eyebrow">So teilst du</span>
        <div className="aff-share-list">
          <div className="line">
            <span className="icon">i.</span>
            <span><b>Bio-Link</b>: Setze den Link direkt in deine Instagram- oder TikTok-Bio. Beide Plattformen akzeptieren den Link ohne Redirect.</span>
          </div>
          <div className="line">
            <span className="icon">ii.</span>
            <span><b>Stories &amp; Reels</b>: Link-Sticker drauf, Sprachnotiz dazu, fertig. Werbekennzeichnung nicht vergessen.</span>
          </div>
          <div className="line">
            <span className="icon">iii.</span>
            <span><b>Captions</b>: Pack den Link auch in die Caption, falls jemand nicht auf die Bio scrollt. Tracking läuft pro Klick, nicht pro Code.</span>
          </div>
        </div>
      </div>

      <a href="https://getklar.org/dashboard" className="aff-btn aff-btn-primary" style={{ textDecoration: "none" }}>
        Zu deinem Affiliate-Dashboard <ArrowRight />
      </a>

      <p className="aff-consent" style={{ textAlign: "center" }}>
        Bestätigung an <i>{state.handle || "deine E-Mail"}</i> ist unterwegs. Fragen? <a href="mailto:alain@getklar.org">alain@getklar.org</a>
      </p>
    </div>
  );
}

// ── Onboarding Shell (main export) ──────────────────────────────────────────
export function OnboardingShell({ brand: brandKey, handle, onSubmit, initialStep = 0, lang = "de" }: { brand: BrandKey; handle: string; onSubmit?: (s: PayoutState) => Promise<void>; initialStep?: number; lang?: Lang }) {
  const brand = BRANDS[brandKey];
  const t = getMessages(lang);
  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(1);
  const [renderStep, setRenderStep] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [payout, setPayout] = useState<PayoutState>({
    displayName: "",
    country: "",
    method: "wise",
    handle: "",
    taxStatus: "",
    canInvoice: false,
    agreementAccepted: false,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-brand", brandKey);
  }, [brandKey]);

  useEffect(() => {
    if (renderStep === step) return;
    const forward = step > renderStep;
    setDir(forward ? 1 : -1);
    setPhase("out");
    const t1 = setTimeout(() => {
      setRenderStep(step);
      setPhase("in");
    }, 220);
    return () => clearTimeout(t1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  };
  const next = () => go(step + 1);
  const prev = () => go(Math.max(0, step - 1));

  const ActiveStep = useMemo(() => {
    const key: StepKey = STEPS[renderStep].key;
    switch (key) {
      case "welcome":  return <StepWelcome brand={brand} go={next} handle={handle} t={t} lang={lang} />;
      case "tracking": return <StepTracking brand={brand} go={next} prev={prev} t={t} lang={lang} />;
      case "payout":   return <StepPayout brand={brand} go={next} prev={prev} state={payout} setState={setPayout} onSubmit={onSubmit} t={t} />;
      case "live":     return <StepLive brand={brand} state={payout} handle={handle} t={t} lang={lang} />;
      default:         return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderStep, brand, payout, handle, lang]);

  const screenClass = phase === "in" ? "aff-screen in" : (dir > 0 ? "aff-screen exit-left" : "aff-screen exit-right");

  return (
    <div className="aff-stage">
      <BgStage />
      <div className="aff-shell">
        <Topframe brand={brand} step={step} t={t} lang={lang} />
        <div className="aff-card">
          <div className="aff-deck">
            <div className={screenClass} key={renderStep}>
              {ActiveStep}
            </div>
          </div>
        </div>
        <div className="aff-footer-note">{brand.short} · Affiliate · v1.0</div>
      </div>
    </div>
  );
}

// ── Animated background stage (4-layer cross-fade, same as getklar.org) ─────
function BgStage() {
  return (
    <div className="aff-bg-stage" aria-hidden="true">
      <div className="aff-bg-layer aff-bg-layer-1" style={{ backgroundImage: "url('/bg/bg-1.webp')" }} />
      <div className="aff-bg-layer aff-bg-layer-2" style={{ backgroundImage: "url('/bg/bg-2.webp')" }} />
      <div className="aff-bg-layer aff-bg-layer-3" style={{ backgroundImage: "url('/bg/bg-3.webp')" }} />
      <div className="aff-bg-layer aff-bg-layer-4" style={{ backgroundImage: "url('/bg/bg-4.webp')" }} />
      <div className="aff-bg-vignette" />
    </div>
  );
}

// ── Collapsible accordion section (mirrors getklar.org acc-* pattern) ───────
function AccSection({ tag, title, pitch, children, defaultOpen = false }: { tag: string; title: React.ReactNode; pitch: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="aff-acc" {...(defaultOpen ? { open: true } : {})}>
      <summary className="aff-acc-summary">
        <span className="aff-acc-tag">{tag}</span>
        <span className="aff-acc-title">{title}</span>
        <span className="aff-acc-pitch">{pitch}</span>
        <span className="aff-acc-toggle" aria-hidden="true" />
      </summary>
      <div className="aff-acc-body">{children}</div>
    </details>
  );
}
