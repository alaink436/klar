// Outreach billing/budget overview, on the shadcn kit. Replaces the three
// hand-rolled HTML cards (Apify account, Brevo daily-cap, Klar wave cost) with
// one clean three-up grid. All numbers are computed server-side in page.tsx and
// passed as plain data, so this stays a thin presentational client component.

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface OutreachBillingData {
  evomi: {
    ok: boolean;
    reason: string; // live | no-key | unauthorized | http-error | exception
    credits: number | null;
    concurrency: number | null;
  };
  apify: {
    ok: boolean;
    reason: string;
    planLabel: string | null;
    usageUsd: number;
    budgetUsd: number | null; // included credits, else plan cap
    budgetKind: "credits" | "cap" | "none";
    remainingUsd: number | null;
    pct: number | null;
    cycleResetLabel: string | null;
    cuUsed: number | null;
    cuMax: number | null;
    klarShareUsd: number | null;
    klarSharePct: number | null;
  };
  brevo: {
    ok: boolean;
    note: string | null;
    planName: string | null;
    usedToday: number;
    capDaily: number;
    pct: number;
    resetHours: number;
  };
  waves: {
    runs: number;
    targets: number;
    mails: number;
    apifyEstimateUsd: number;
    apifyActualUsd: number;
    actualPct: number | null;
  };
}

const usd = (n: number) => `$${n.toFixed(2)}`;
function tone(pct: number): { color: string; badge: "ok" | "warn" | "danger" } {
  if (pct >= 90) return { color: "var(--danger)", badge: "danger" };
  if (pct >= 70) return { color: "var(--warning)", badge: "warn" };
  return { color: "var(--success)", badge: "ok" };
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

function CardHead({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3.5">
      <h2 className="[font-family:var(--font-display)] font-bold text-[15px] tracking-[-0.01em] text-fg flex items-baseline gap-2">
        {title}
        {note && <span className="text-fg-4 text-[10px] font-normal [font-family:var(--font-mono)]">{note}</span>}
      </h2>
      {right}
    </div>
  );
}

const Metric = ({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) => (
  <div>
    <div
      className="[font-family:var(--font-display)] font-extrabold text-[26px] leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums]"
      style={{ color: accent ? "var(--accent)" : "var(--fg)" }}
    >
      {value}
    </div>
    <div className="[font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-3 mt-1.5">{label}</div>
  </div>
);

export default function OutreachBilling({ data }: { data: OutreachBillingData }) {
  const { evomi, apify, brevo, waves } = data;
  const apifyT = tone(apify.pct ?? 0);
  const brevoT = tone(brevo.pct);
  // Credits have no fixed plan ceiling — tone by absolute remaining instead.
  const evomiLow = evomi.credits !== null && evomi.credits < 200;
  const evomiCrit = evomi.credits !== null && evomi.credits < 50;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
      {/* ── Evomi credits ── */}
      <Card className="p-5">
        <CardHead
          title="Evomi-Credits"
          note={evomi.ok ? undefined : `(${evomi.reason})`}
          right={
            evomi.ok ? (
              <Badge tone={evomiCrit ? "danger" : evomiLow ? "warn" : "ok"}>
                {evomiCrit ? "fast leer" : evomiLow ? "wenig" : "ok"}
              </Badge>
            ) : null
          }
        />
        {!evomi.ok ? (
          <p className="text-fg-3 text-[12.5px] leading-relaxed">
            {evomi.reason === "no-key"
              ? "Kein Evomi-Key im Vault gefunden."
              : evomi.reason === "unauthorized"
                ? "Der Scraper-Key darf die Public-API nicht lesen. Auf my.evomi.com → Settings → API den Profile-API-Key holen und im Vault als „Evomi Public API“ anlegen (base_url https://api.evomi.com, Header x-apikey) — die Karte findet ihn automatisch."
                : "Evomi-API antwortet nicht."}
          </p>
        ) : (
          <>
            <Metric
              value={evomi.credits !== null ? evomi.credits.toLocaleString("de-CH") : "—"}
              label="Scraper-Credits übrig"
              accent
            />
            <p className="[font-family:var(--font-mono)] text-[10.5px] text-fg-3 mt-3 leading-relaxed">
              TikTok-Anreicherung: ~2 Credits (request) bis ~6 (Browser-Render) pro Profil
              {evomi.concurrency !== null ? ` · Concurrency ${evomi.concurrency}` : ""}
            </p>
          </>
        )}
      </Card>

      {/* ── Apify billing ── */}
      <Card className="p-5 lg:col-span-1">
        <CardHead
          title="Apify-Billing"
          note={apify.ok ? undefined : `(${apify.reason})`}
          right={apify.planLabel ? <Badge tone="info">{apify.planLabel}</Badge> : null}
        />
        {!apify.ok ? (
          <p className="text-fg-3 text-[12.5px] leading-relaxed">
            Billing nicht abrufbar.{" "}
            {apify.reason === "no-token" ? "APIFY_API_TOKEN fehlt in den Vercel-Env-Vars." : "Apify-API antwortet nicht (Token gültig?)."}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 mb-3">
              {apify.budgetKind !== "none" && apify.remainingUsd !== null ? (
                <Metric value={usd(apify.remainingUsd)} label={`übrig von ${usd(apify.budgetUsd ?? 0)} ${apify.budgetKind === "credits" ? "Plan-Credits" : "Plan-Cap"}`} accent />
              ) : (
                <Metric value={usd(apify.usageUsd)} label="verbraucht · kein Budget gesetzt" accent />
              )}
              {apify.cycleResetLabel && (
                <div className="text-right">
                  <div className="[font-family:var(--font-mono)] text-[12px] text-fg-2 font-semibold">{apify.cycleResetLabel}</div>
                  <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4">Reset</div>
                </div>
              )}
            </div>
            {apify.pct !== null && <Bar pct={apify.pct} color={apifyT.color} />}
            <div className="flex justify-between [font-family:var(--font-mono)] text-[10.5px] text-fg-3 mt-2">
              <span>{usd(apify.usageUsd)} verbraucht{apify.pct !== null ? ` · ${apify.pct}%` : ""}</span>
              {apify.klarShareUsd !== null && <span>Klar-Wellen ~{apify.klarSharePct}% ({usd(apify.klarShareUsd)})</span>}
            </div>
            {apify.cuUsed !== null && apify.cuMax !== null && (
              <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4 mt-2">
                Compute-Units: {apify.cuUsed.toLocaleString()} / {apify.cuMax.toLocaleString()} CU
              </div>
            )}
            {apify.pct !== null && apify.pct >= 70 && (
              <p className="text-[11px] mt-2.5 italic" style={{ color: apifyT.color }}>
                {apify.pct >= 90 ? "Budget fast aufgebraucht — " : "Budget wird knapp — "}
                <a href="https://console.apify.com/billing" target="_blank" rel="noopener" className="underline" style={{ color: "inherit" }}>
                  in der Apify-Console anpassen
                </a>.
              </p>
            )}
          </>
        )}
      </Card>

      {/* ── Brevo daily cap ── */}
      <Card className="p-5">
        <CardHead
          title="Brevo Daily-Cap"
          note={brevo.planName ?? (brevo.ok ? undefined : "Mailversand")}
          right={brevo.ok ? <Badge tone={brevoT.badge} dot>{brevo.pct}%</Badge> : null}
        />
        {!brevo.ok ? (
          <p className="text-fg-3 text-[12.5px] leading-relaxed">{brevo.note ?? "Brevo-Kontingent nicht abrufbar."}</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 mb-3">
              <Metric value={`${brevo.usedToday}`} label={`von ${brevo.capDaily} Mails heute`} accent />
              <div className="text-right">
                <div className="[font-family:var(--font-mono)] text-[12px] text-fg-2 font-semibold">~{brevo.resetHours}h</div>
                <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4">bis Reset</div>
              </div>
            </div>
            <Bar pct={brevo.pct} color={brevoT.color} />
            <div className="flex justify-between [font-family:var(--font-mono)] text-[10.5px] text-fg-3 mt-2">
              <span>{brevo.pct}% des Tages-Caps</span>
              <span>Rest: {Math.max(0, brevo.capDaily - brevo.usedToday)}</span>
            </div>
          </>
        )}
      </Card>

      {/* ── Klar waves this month ── */}
      <Card className="p-5">
        <CardHead
          title="Klar-Wellen"
          note="diesen Monat"
          right={<Badge>{waves.runs} Wellen</Badge>}
        />
        <div className="flex items-end justify-between gap-4 mb-3">
          <Metric value={usd(waves.apifyActualUsd || waves.apifyEstimateUsd)} label={waves.apifyActualUsd > 0 ? "Apify (actual)" : "Apify (estimate)"} accent />
          <div className="text-right">
            <Metric value={`${waves.mails}`} label="Mails" />
          </div>
        </div>
        <div className="[font-family:var(--font-mono)] text-[10.5px] text-fg-3">
          {waves.targets} Targets gescraped · Estimate {usd(waves.apifyEstimateUsd)}
          {waves.actualPct !== null ? ` · Actual ${waves.actualPct}% davon` : ""}
        </div>
      </Card>
    </section>
  );
}
