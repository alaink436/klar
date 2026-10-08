"use client";

// Recharts-driven analytics dashboard. Receives aggregated payload from
// the parent server component and only handles rendering + interactive
// period switching. No client-side data fetching here.
//
// Tab + period switching uses next/link so the route change is a Soft
// Navigation (only the AnalyticsClient subtree re-renders on the server)
// rather than a full reload, so Recharts is not re-bootstrapped on every
// click.

//
// Redesign 2026-10-08 (Ticket 03): Karten, Umschalter und Chips aus den
// Klar-Bausteinen (admin.css); die Apps behalten in Diagrammen ihre Farbe,
// gedaempft (`chartColorValue`). Zahlen und Verhalten unveraendert.

import Link from "next/link";
import type { CSSProperties } from "react";
import { AreaChart } from "../tremor/components/AreaChart/AreaChart";
import { BarChart } from "../tremor/components/BarChart/BarChart";
import { chartColorValue, type AvailableChartColorsKeys } from "../tremor/utils/chartColors";
import { Kennzahlen } from "../Kennzahlen";
import { Badge } from "@/components/ui/badge";
import {
  TextureCard,
  TextureCardContent,
  TextureCardHeader,
  TextureCardTitle,
} from "@/components/ui/texture-card";

export type Period = "week" | "month" | "year";
export type AnalyticsTab = "apps" | "landings" | "site";

// Per-app users + revenue, the centerpiece of the rebuilt Analytics tab.
// `hasBackend` = app's Supabase is wired in KLAR_ADMIN_APPS (so user counts are
// available). `hasRevenueCat` = a RevenueCat secret key is configured for it.
// Money fields are in RevenueCat's display currency (`currency`, usually $).
export interface AppRow {
  slug: string;
  name: string;
  icon: string;
  hasBackend: boolean;
  usersTotal: number | null;
  usersNew30d: number | null;
  usersNew7d: number | null;
  usersActive30d: number | null;
  /** New signups in the last 7 days, and in the 7 days before those. */
  new7d?: number | null;
  new7dPrev?: number | null;
  /** New signups per day, oldest first — the sparkline behind the number. */
  spark?: number[];
  /** Chart colour key of the app, the same as its line in the chart. */
  color?: string;
  hasRevenueCat: boolean;
  mrr: number | null;
  revenue28d: number | null;
  activeSubscriptions: number | null;
  activeTrials: number | null;
  currency: string;
}

export interface AppsPayload {
  perApp: AppRow[];
  totalUsers: number;
  totalNew30d: number;
  totalActiveSubs: number;
  totalMrr: number;
  totalRevenue28d: number;
  currency: string;
  connectedCount: number;
  revenueCatCount: number;
}

// Time-series chart payload for the Apps tab (metric/app/period switchable).
export type AppsMetric = "users" | "revenue";

export interface AppsChartPayload {
  metric: AppsMetric;
  period: Period;
  categories: string[]; // selected app display names = chart series
  colors: string[]; // chart-colour keys aligned to categories
  data: Record<string, number | string>[]; // [{ label, [appName]: value }]
  apps: { slug: string; name: string; on: boolean; color: string }[]; // chip state
  unit: "" | "$";
  note: string | null;
}

// Die beworbene Seite einer App, genau eine je App. `label` ist die Adresse,
// wie man sie eintippt ("myloo.org/get").
export interface LandingRow {
  key: string;
  app: string;
  name: string;
  icon: string;
  label: string;
  url: string;
  tracked: boolean;
  repo: string;
  visits: number;
  sessions: number;
  /** Aufrufe im gleich langen Fenster davor. */
  prevVisits: number;
  topReferrer: string | null;
  referrers: { label: string; count: number }[];
  color: string;
  /** Aufrufe pro Bucket, aelteste zuerst. Die Balken hinter der Zahl. */
  spark: number[];
}

export interface LandingsPayload {
  period: Period;
  perLanding: LandingRow[];
  totalVisits: number;
  totalPrev: number;
  totalSessions: number;
  best: string | null;
  categories: string[];
  colors: string[];
  data: Record<string, number | string>[];
  chips: { key: string; label: string; on: boolean; color: string }[];
  /** Gemessene Seiten, die in keiner Landing-Definition stehen. */
  otherPages: { label: string; count: number }[];
  withData: number;
  trackedCount: number;
}

/** getklar.org selbst: Sitzungen, Seiten, Herkunft. */
export interface SitePayload {
  period: Period;
  totalVisits: number;
  totalSessions: number;
  /** Sitzungen im gleich langen Fenster davor. */
  prevSessions: number;
  topPage: string | null;
  topReferrer: string | null;
  series: { label: string; visits: number; sessions: number }[];
  pages: { label: string; count: number }[];
  referrers: { label: string; count: number }[];
  countries: { label: string; count: number }[];
  browsers: { label: string; count: number }[];
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "7 Tage" },
  { id: "month", label: "30 Tage" },
  { id: "year", label: "Jahr" },
];


const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "apps", label: "Apps" },
  { id: "landings", label: "Landings" },
  { id: "site", label: "getklar.org" },
];

function TabSelector({
  active,
  landP,
  siteP,
}: {
  active: AnalyticsTab;
  landP: Period;
  siteP: Period;
}) {
  const hrefFor = (id: AnalyticsTab) => {
    const params = new URLSearchParams({ tab: id, p_pub: landP, p_site: siteP });
    return `/admin/analytics?${params.toString()}`;
  };
  return (
    <div className="klar-wahl mb-5" role="tablist" aria-label="Analytics Tab">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={hrefFor(t.id)}
          role="tab"
          aria-selected={active === t.id}
          prefetch
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function PeriodSelector({ active, hrefFor }: { active: Period; hrefFor: (p: Period) => string }) {
  return (
    <div className="klar-wahl" role="tablist" aria-label="Zeitraum">
      {PERIODS.map((p) => (
        <Link
          key={p.id}
          href={hrefFor(p.id)}
          role="tab"
          aria-selected={active === p.id}
          prefetch
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <TextureCard>
      <TextureCardHeader className="pb-1">
        <TextureCardTitle>{title}</TextureCardTitle>
      </TextureCardHeader>
      <TextureCardContent className="pb-5">{children}</TextureCardContent>
    </TextureCard>
  );
}

/** Eine Karte um ein Diagramm, mit Luft fuer Achsen und Legende. */
function ChartFrame({ children }: { children: React.ReactNode }) {
  return <TextureCard className="px-4 pb-4 pt-5 sm:px-6">{children}</TextureCard>;
}

/** Zwei Karten nebeneinander, auf dem Handy untereinander. */
const ZWEIER = "mb-7 grid grid-cols-1 gap-3.5 md:grid-cols-2";

/** Der Punkt mit der Farbe einer App oder Landing. */
function FarbPunkt({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`klar-punkt ${className ?? ""}`}
      style={{ "--ton": chartColorValue(color) } as CSSProperties}
    />
  );
}

function HBar({ data, max }: { data: { label: string; count: number }[]; max?: number }) {
  if (data.length === 0) {
    return (
      <p className="m-0 mt-3 text-[13px] text-fg-3">
        Noch keine Daten.
      </p>
    );
  }
  const peak = Math.max(1, ...data.map((d) => d.count));
  const M = max ?? peak;
  return (
    <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
      {data.map((d) => (
        <li
          key={d.label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1fr) 64px 38px",
            gap: 10,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <span
            style={{
              color: "var(--fg)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            title={d.label}
          >
            {d.label}
          </span>
          <span
            aria-hidden
            style={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.06)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${(d.count / M) * 100}%`,
                background: "linear-gradient(90deg, rgba(255, 255, 255, 0.4), #f5f5f5)",
                borderRadius: 999,
                transition: "width .25s ease",
              }}
            />
          </span>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-mono)",
              color: "var(--fg-2)",
              textAlign: "right",
              fontSize: 12,
            }}
          >
            {d.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsClient({
  landings,
  site,
  appsData,
  appsChart,
  tab,
  periodLandings,
  periodSite,
}: {
  landings: LandingsPayload;
  site: SitePayload;
  appsData: AppsPayload;
  appsChart: AppsChartPayload;
  tab: AnalyticsTab;
  periodLandings: Period;
  periodSite: Period;
}) {
  const onKeys = landings.chips.filter((c) => c.on).map((c) => c.key);
  const isLandings = tab === "landings";
  const activePeriod = isLandings ? periodLandings : periodSite;
  const isEmpty = isLandings ? landings.totalVisits === 0 : site.totalVisits === 0;

  return (
    <>
      <TabSelector active={tab} landP={periodLandings} siteP={periodSite} />
      {/* The Apps tab uses fixed windows (auth.users new-30/7d + RevenueCat's
          own 28-day overview), so a period selector there would be misleading.
          Die beiden Pageview-Tabs bekommen einen, jeder mit eigener Periode:
          wer 7 Tage Landings ansieht, will deswegen nicht 7 Tage getklar.org. */}
      {tab !== "apps" ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <PeriodSelector
            active={activePeriod}
            hrefFor={(p) =>
              isLandings
                ? landingsHref(p, onKeys, landings.chips.length)
                : `/admin/analytics?${new URLSearchParams({ tab: "site", p_site: p }).toString()}`
            }
          />
          {isEmpty ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-4)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Wartet auf erste Daten
            </span>
          ) : null}
        </div>
      ) : null}
      {tab === "apps" ? <AppsView apps={appsData} chart={appsChart} /> : null}
      {tab === "landings" ? <LandingsView landings={landings} /> : null}
      {tab === "site" ? <SiteView site={site} /> : null}
    </>
  );
}

// ===== Apps tab: users + revenue per app =====

function fmtInt(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  return n.toLocaleString("de-CH");
}

// RevenueCat money: value is in the project's display currency (usually USD),
// `currency` is the unit symbol RevenueCat returned. We keep it labeled in that
// currency rather than pretending it's CHF.
function fmtMoney(n: number | null, currency: string): string {
  if (n === null || !isFinite(n)) return "—";
  const sym = currency || "$";
  return `${sym}${n.toLocaleString("de-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          fontWeight: 500,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 500,
          fontSize: 19,
          lineHeight: 1,
          letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
          color: accent ? "var(--fg)" : "var(--fg-2)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * 28 days of daily signups as thin bars. Deliberately unlabelled: it answers
 * "is this moving and when" at a glance, the exact numbers are underneath.
 */
function Sparkline({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  // In der Farbe der App, wie ihre Linie im Verlauf; ohne Farbe weiss.
  const ton = color ? chartColorValue(color) : "#f5f5f5";
  const cutoff = values.length - 7;
  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 34 }}
      aria-hidden="true"
    >
      {values.map((v, i) => (
        <span
          key={i}
          title={`${v}`}
          style={{
            flex: 1,
            // A zero day still gets a hairline, otherwise the gap reads as
            // "no data" rather than "nobody signed up".
            height: `${Math.max(v === 0 ? 1.5 : 8, (v / max) * 100)}%`,
            background: ton,
            opacity: i >= cutoff ? 0.95 : 0.3,
            borderRadius: 1.5,
          }}
        />
      ))}
    </div>
  );
}

/** The line the card leads with: growth this week, compared to last week. */
function growthFor(row: AppRow): { headline: string; unit: string; caption: string; tone: string } {
  if (!row.hasBackend) {
    return { headline: "—", unit: "", caption: "Kein Backend verdrahtet", tone: "var(--fg-4)" };
  }
  const cur = row.new7d ?? row.usersNew7d;
  if (cur === null || cur === undefined) {
    return { headline: fmtInt(row.usersTotal), unit: "User", caption: "Kein Verlauf verfügbar", tone: "var(--fg)" };
  }
  const prev = row.new7dPrev ?? null;
  let caption = "neue User · letzte 7 Tage";
  if (cur === 0) {
    caption = prev && prev > 0 ? `keine neuen User · Vorwoche ${prev}` : "keine neuen User in 7 Tagen";
  } else if (prev !== null && prev > 0) {
    const pct = Math.round(((cur - prev) / prev) * 100);
    const dir = pct >= 0 ? "↑" : "↓";
    caption = `neue User · 7 Tage · ${dir} ${Math.abs(pct)}% vs. Vorwoche (${prev})`;
  } else if (prev === 0) {
    caption = "neue User · 7 Tage · Vorwoche keine";
  }
  return {
    headline: cur > 0 ? `+${fmtInt(cur)}` : "0",
    unit: "neu",
    caption,
    tone: cur > 0 ? "var(--fg)" : "var(--fg-3)",
  };
}

function AppCard({ row }: { row: AppRow }) {
  const growth = growthFor(row);
  return (
    <TextureCard className="p-[22px]">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span className="klar-kachel size-11">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.icon}
            alt=""
            width={44}
            height={44}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </span>
        <h3
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            fontWeight: 500,
            fontSize: 17,
            letterSpacing: "-.015em",
            color: "var(--fg)",
          }}
        >
          {row.name}
        </h3>
        <Badge tone={row.hasBackend ? "ok" : "neutral"} dot>
          {row.hasBackend ? "live" : "kein Backend"}
        </Badge>
      </div>

      {/* Users — the movement is the headline, the total is the context. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontWeight: 500,
                fontSize: 38,
                lineHeight: 1,
                letterSpacing: "-.035em",
                fontVariantNumeric: "tabular-nums",
                color: growth.tone,
              }}
            >
              {growth.headline}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)" }}>
              {growth.unit}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 5 }}>{growth.caption}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: 20,
              lineHeight: 1,
              letterSpacing: "-.02em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg-2)",
            }}
          >
            {fmtInt(row.usersTotal)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--fg-4)", marginTop: 6, whiteSpace: "nowrap" }}>
            User gesamt
          </div>
        </div>
      </div>

      {row.spark && row.spark.length > 0 ? <Sparkline values={row.spark} color={row.color} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          paddingTop: 14,
          marginTop: 8,
          borderTop: "1px solid var(--line)",
        }}
      >
        <MiniStat label="Neu 7T" value={row.hasBackend ? fmtInt(row.usersNew7d) : "—"} />
        <MiniStat label="Neu 30T" value={row.hasBackend ? fmtInt(row.usersNew30d) : "—"} />
        <MiniStat label="Aktiv 30T" value={row.hasBackend ? fmtInt(row.usersActive30d) : "—"} />
      </div>

      {/* Revenue */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--line)",
        }}
      >
        {row.hasRevenueCat ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <MiniStat label="MRR" value={fmtMoney(row.mrr, row.currency)} accent />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--fg-4)" }}>
                RevenueCat
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <MiniStat label="Umsatz 28T" value={fmtMoney(row.revenue28d, row.currency)} />
              <MiniStat label="Abos" value={fmtInt(row.activeSubscriptions)} />
              <MiniStat label="Trials" value={fmtInt(row.activeTrials)} />
            </div>
          </>
        ) : (
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] leading-relaxed text-fg-3">
            <Badge>Umsatz</Badge>
            <span>
              RevenueCat-Key fehlt: im Vault als <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Revenuecat &lt;App&gt;</code> ablegen.
            </span>
          </p>
        )}
      </div>
    </TextureCard>
  );
}

// Build an Apps-tab URL preserving metric/period/app-selection. Omits the `apps`
// param when every app is on (canonical "all").
function appsHref(
  metric: AppsMetric,
  period: Period,
  onSlugs: string[],
  allCount: number,
): string {
  const p = new URLSearchParams({ tab: "apps", am: metric, p_app: period });
  if (onSlugs.length > 0 && onSlugs.length < allCount) p.set("apps", onSlugs.join(","));
  return `/admin/analytics?${p.toString()}`;
}

const APPS_METRICS: { id: AppsMetric; label: string }[] = [
  { id: "users", label: "User" },
  { id: "revenue", label: "Umsatz" },
];

function AppsChartSection({ chart }: { chart: AppsChartPayload }) {
  const allCount = chart.apps.length;
  const onSlugs = chart.apps.filter((a) => a.on).map((a) => a.slug);
  return (
    <>
      <h2>Verlauf</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="klar-wahl" role="tablist" aria-label="Metrik">
          {APPS_METRICS.map((m) => (
            <Link
              key={m.id}
              href={appsHref(m.id, chart.period, onSlugs, allCount)}
              role="tab"
              aria-selected={chart.metric === m.id}
              prefetch
            >
              {m.label}
            </Link>
          ))}
        </div>
        <div className="klar-wahl" role="tablist" aria-label="Zeitraum">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={appsHref(chart.metric, p.id, onSlugs, allCount)}
              role="tab"
              aria-selected={chart.period === p.id}
              prefetch
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {chart.apps.map((a) => {
          const toggled = a.on ? onSlugs.filter((s) => s !== a.slug) : [...onSlugs, a.slug];
          // Never allow an empty selection — turning the last one off shows all.
          const next = toggled.length === 0 ? chart.apps.map((x) => x.slug) : toggled;
          return (
            <Link
              key={a.slug}
              href={appsHref(chart.metric, chart.period, next, allCount)}
              prefetch
              className="klar-chip"
              data-aus={a.on ? undefined : "ja"}
            >
              <FarbPunkt color={a.color} />
              {a.name}
            </Link>
          );
        })}
      </div>
      <ChartFrame>
        {chart.categories.length > 0 && chart.data.length > 0 ? (
          <AreaChart
            data={chart.data}
            index="label"
            categories={chart.categories}
            colors={chart.colors as AvailableChartColorsKeys[]}
            valueFormatter={(v) =>
              chart.unit === "$" ? `$${v.toLocaleString("de-CH")}` : v.toLocaleString("de-CH")
            }
            showLegend
            startEndOnly
            className="h-72"
          />
        ) : (
          <p className="m-0 text-[13px] text-fg-3">
            Keine App ausgewählt oder keine Daten im Zeitraum.
          </p>
        )}
        {chart.note ? (
          <p className="m-0 mt-3 text-[12px] text-fg-3">
            {chart.note}
          </p>
        ) : null}
      </ChartFrame>
    </>
  );
}

function AppsView({ apps, chart }: { apps: AppsPayload; chart: AppsChartPayload }) {
  return (
    <>
      <Kennzahlen
        zahlen={[
          {
            label: "User gesamt",
            wert: fmtInt(apps.totalUsers),
            zusatz: `+${fmtInt(apps.totalNew30d)} in 30 Tagen · ${apps.connectedCount}/${apps.perApp.length} Apps verbunden`,
          },
          {
            label: "Aktive Abos",
            wert: fmtInt(apps.totalActiveSubs),
            zusatz: apps.revenueCatCount > 0 ? `${apps.revenueCatCount} Apps mit RevenueCat` : "RevenueCat noch nicht verbunden",
          },
          {
            label: "MRR gesamt",
            wert: apps.revenueCatCount > 0 ? fmtMoney(apps.totalMrr, apps.currency) : "—",
            zusatz: apps.revenueCatCount > 0 ? "Σ über verbundene Apps" : "Key fehlt",
          },
          {
            label: "Umsatz 28T",
            wert: apps.revenueCatCount > 0 ? fmtMoney(apps.totalRevenue28d, apps.currency) : "—",
            zusatz: apps.revenueCatCount > 0 ? "letzte 28 Tage (RevenueCat)" : "Key fehlt",
          },
        ]}
      />
      <AppsChartSection chart={chart} />
      <h2>Pro App</h2>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        {apps.perApp.map((row) => (
          <AppCard key={row.slug} row={row} />
        ))}
      </div>
    </>
  );
}

// ===== Landings tab: Aufrufe pro beworbener Seite =====
//
// Die Frage, die dieser Tab beantwortet, ist nicht "wieviel Web-Traffic haben
// wir" sondern "welche der beworbenen Seiten bekommt ihn". Deshalb steht jede
// Landing als eigene Zeile mit eigenem Verlauf da, statt als Pfad in einer
// Top-Seiten-Liste unterzugehen, und jede Zahl hat ihren Vergleichswert aus
// der Vorperiode neben sich. Eine Zahl ohne Vorher ist keine Entscheidung.

/** URL des Landing-Tabs, Auswahl erhalten. `lp` faellt weg, wenn alle an sind. */
function landingsHref(period: Period, onKeys: string[], allCount: number): string {
  const p = new URLSearchParams({ tab: "landings", p_pub: period });
  if (onKeys.length > 0 && onKeys.length < allCount) p.set("lp", onKeys.join(","));
  return `/admin/analytics?${p.toString()}`;
}

/** "↑ 38 %" / "↓ 12 %" / "neu" / "—", plus der Ton dazu. */
function deltaOf(cur: number, prev: number): { text: string; tone: string } {
  if (cur === 0 && prev === 0) return { text: "—", tone: "var(--fg-4)" };
  if (prev === 0) return { text: "neu", tone: "var(--fg)" };
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return { text: "±0 %", tone: "var(--fg-3)" };
  return {
    text: `${p > 0 ? "↑" : "↓"} ${Math.abs(p)} %`,
    tone: p > 0 ? "var(--fg)" : "var(--fg-3)",
  };
}

function periodLabel(p: Period): string {
  return p === "week" ? "letzte 7 Tage" : p === "year" ? "letzte 12 Monate" : "letzte 30 Tage";
}

function prevLabel(p: Period): string {
  return p === "week" ? "7 Tage davor" : p === "year" ? "12 Monate davor" : "30 Tage davor";
}

function LandingCard({ row, period }: { row: LandingRow; period: Period }) {
  const delta = deltaOf(row.visits, row.prevVisits);
  return (
    <TextureCard className="p-5">
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <span className="klar-kachel size-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.icon} alt="" width={32} height={32} className="size-full object-cover" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)" }}>{row.name}</span>
          </div>
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              color: "var(--fg-3)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={row.url}
          >
            {row.label}
          </a>
        </div>
        <FarbPunkt color={row.color} className="size-2" />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-.03em",
            fontVariantNumeric: "tabular-nums",
            color: row.visits > 0 ? "var(--fg)" : "var(--fg-4)",
          }}
        >
          {fmtInt(row.visits)}
        </span>
        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Aufrufe</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: delta.tone,
          }}
        >
          {delta.text}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 5 }}>
        {periodLabel(period)} · {fmtInt(row.sessions)} Sessions · {prevLabel(period)}:{" "}
        {fmtInt(row.prevVisits)}
      </div>

      <div style={{ marginTop: 14 }}>
        <Sparkline values={row.spark} color={row.color} />
      </div>

      <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 10 }}>
        {row.visits > 0 ? (
          <>
            Top-Quelle: <span style={{ color: "var(--fg-3)" }}>{row.topReferrer ?? "(direkt)"}</span>
          </>
        ) : row.tracked ? (
          <>
            Noch kein Aufruf gemessen · Beacon in <code>{row.repo}</code>
          </>
        ) : (
          <>
            Wird nicht gemessen · Beacon in <code>{row.repo}</code> committet, aber nicht
            ausgeliefert. Diese Null heisst nicht {"„niemand kommt“"}.
          </>
        )}
      </div>
    </TextureCard>
  );
}

function LandingsView({ landings }: { landings: LandingsPayload }) {
  const onKeys = landings.chips.filter((c) => c.on).map((c) => c.key);
  const allCount = landings.chips.length;
  const total = deltaOf(landings.totalVisits, landings.totalPrev);

  return (
    <>
      <Kennzahlen
        zahlen={[
          {
            label: "Aufrufe gesamt",
            wert: fmtInt(landings.totalVisits),
            zusatz: `${periodLabel(landings.period)} · ${total.text} vs. ${prevLabel(landings.period)} (${fmtInt(landings.totalPrev)})`,
          },
          {
            label: "Sessions",
            wert: fmtInt(landings.totalSessions),
            zusatz: "unique pro Tag, über alle Landings",
          },
          {
            label: "Stärkste Seite",
            wert: landings.best ?? "—",
            zusatz: landings.best ? "meiste Aufrufe im Zeitraum" : "noch keine Aufrufe",
          },
          {
            label: "Seiten mit Daten",
            wert: `${landings.withData} / ${landings.trackedCount}`,
            zusatz:
              landings.withData === 0
                ? "Beacon noch nicht deployt?"
                : "gemessene von definierten Landings",
          },
        ]}
      />

      <h2>Verlauf</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {landings.chips.map((c) => {
          const toggled = c.on ? onKeys.filter((k) => k !== c.key) : [...onKeys, c.key];
          // Die letzte abzuschalten zeigt wieder alle. Eine leere Auswahl
          // waere ein Diagramm, das nichts behauptet.
          const next = toggled.length === 0 ? landings.chips.map((x) => x.key) : toggled;
          return (
            <Link
              key={c.key}
              href={landingsHref(landings.period, next, allCount)}
              prefetch
              className="klar-chip"
              data-aus={c.on ? undefined : "ja"}
            >
              <FarbPunkt color={c.color} />
              {c.label}
            </Link>
          );
        })}
      </div>
      <ChartFrame>
        {landings.categories.length > 0 && landings.data.length > 0 ? (
          <AreaChart
            data={landings.data}
            index="label"
            categories={landings.categories}
            colors={landings.colors as AvailableChartColorsKeys[]}
            valueFormatter={(v) => v.toLocaleString("de-CH")}
            showLegend
            startEndOnly
            className="h-72"
          />
        ) : (
          <p className="m-0 text-[13px] text-fg-3">
            Keine Seite ausgewählt.
          </p>
        )}
      </ChartFrame>

      <h2>Pro Landing</h2>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {landings.perLanding.map((row) => (
          <LandingCard key={row.key} row={row} period={landings.period} />
        ))}
      </div>

      <h2>Andere Seiten</h2>
      <div className="mb-7">
        <ChartCard title="Gemessen, aber keine Landing">
          <HBar data={landings.otherPages} />
          <p className="m-0 mt-3.5 text-[12px] leading-relaxed text-fg-3">
            Alles, was auf einer getrackten Domain aufgerufen wurde und in keiner
            Landing-Definition steht: Rechtstexte, Support, Einladungslinks. Taucht hier ein
            Pfad auf, der eigentlich eine Landing ist, wurde er umbenannt und gehört in{" "}
            <code>lib/klarLandings.ts</code>. Affiliate-Links (<code>/i/…</code>) sind bewusst
            ausgenommen.
          </p>
        </ChartCard>
      </div>
    </>
  );
}

// ===== getklar.org: der Studio-Auftritt selbst =====
//
// Die Sitzung fuehrt, nicht der Aufruf. Auf einer Seite mit Apps, OS und
// Rechtstexten blaettert ein Mensch mehrere Seiten; "wie viele waren da" ist
// die Zahl, an der man etwas ablesen kann, "wie viele Seiten wurden geoeffnet"
// die Zahl darunter. Auf den Landings ist es umgekehrt, dort ist eine Seite
// die ganze Begegnung.

function SiteView({ site }: { site: SitePayload }) {
  const delta = deltaOf(site.totalSessions, site.prevSessions);
  const perSession =
    site.totalSessions > 0 ? (site.totalVisits / site.totalSessions).toFixed(1) : "—";

  return (
    <>
      <Kennzahlen
        zahlen={[
          {
            label: "Sitzungen",
            wert: fmtInt(site.totalSessions),
            zusatz: `${periodLabel(site.period)} · ${delta.text} vs. ${prevLabel(site.period)} (${fmtInt(site.prevSessions)})`,
          },
          {
            label: "Aufrufe",
            wert: fmtInt(site.totalVisits),
            zusatz: perSession === "—" ? "keine Aufrufe" : `${perSession} Seiten pro Sitzung`,
          },
          { label: "Top-Seite", wert: site.topPage ?? "—", zusatz: "meist besucht" },
          { label: "Top-Quelle", wert: site.topReferrer ?? "—", zusatz: "Referrer" },
        ]}
      />

      <h2>Verlauf</h2>
      <ChartFrame>
        {site.series.length > 0 ? (
          <AreaChart
            data={site.series.map((d) => ({
              label: d.label,
              Sitzungen: d.sessions,
              Aufrufe: d.visits,
            }))}
            index="label"
            categories={["Sitzungen", "Aufrufe"]}
            colors={["ink", "steel"]}
            valueFormatter={(v) => v.toLocaleString("de-CH")}
            startEndOnly
            showLegend
            className="h-60"
          />
        ) : (
          <p className="m-0 text-[13px] text-fg-3">
            Keine Daten im Zeitraum.
          </p>
        )}
      </ChartFrame>

      <h2>Seiten · Quellen</h2>
      <div className={ZWEIER}>
        <ChartCard title="Seiten">
          <HBar data={site.pages} />
          <p className="m-0 mt-3.5 text-[12px] leading-relaxed text-fg-3">
            Ohne <code>/admin</code> und <code>/api</code>, die stehen gar nicht erst in der
            Tabelle. Affiliate-Links (<code>/i/…</code>) sind hier ausgenommen, weil es von
            denen eine pro Code gibt und sie die Liste sonst fluten.
          </p>
        </ChartCard>
        <ChartCard title="Quellen">
          <HBar data={site.referrers} />
          <p className="m-0 mt-3.5 text-[12px] leading-relaxed text-fg-3">
            {"„(direkt)“"} heisst: kein Referrer mitgeschickt. Das ist nicht nur
            direkte Eingabe, sondern auch jeder In-App-Browser, der keinen setzt.
          </p>
        </ChartCard>
      </div>

      <h2>Länder · Browser</h2>
      <div className={ZWEIER}>
        <ChartCard title="Länder">
          {site.countries.length > 0 ? (
            <BarChart
              data={site.countries.map((c) => ({ label: c.label, Aufrufe: c.count }))}
              index="label"
              categories={["Aufrufe"]}
              colors={["steel"]}
              valueFormatter={(v) => v.toLocaleString("de-CH")}
              showLegend={false}
              className="h-52"
            />
          ) : (
            <p className="m-0 mt-3 text-[13px] text-fg-3">
              Noch keine Daten.
            </p>
          )}
        </ChartCard>
        <ChartCard title="Browser">
          <HBar data={site.browsers} />
        </ChartCard>
      </div>
    </>
  );
}
