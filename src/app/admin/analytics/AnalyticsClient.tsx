"use client";

// Recharts-driven analytics dashboard. Receives aggregated payload from
// the parent server component and only handles rendering + interactive
// period switching. No client-side data fetching here.
//
// Tab + period switching uses next/link so the route change is a Soft
// Navigation (only the AnalyticsClient subtree re-renders on the server)
// rather than a full reload — avoids re-bootstrapping Recharts and the
// WebGL smoke background on every click.

import Link from "next/link";
import { AreaChart } from "../tremor/components/AreaChart/AreaChart";
import type { AvailableChartColorsKeys } from "../tremor/utils/chartColors";

export type Period = "week" | "month" | "year";
export type AnalyticsTab = "apps" | "landings";

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

// Eine beworbene Seite. `label` ist die Adresse, wie man sie eintippt
// ("myloo.org/get"), `primary` markiert die Seite, die wirklich in der Bio und
// unter den Videos steht. Die anderen laufen als Kontext mit.
export interface LandingRow {
  key: string;
  app: string;
  name: string;
  icon: string;
  label: string;
  url: string;
  primary: boolean;
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

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "7 Tage" },
  { id: "month", label: "30 Tage" },
  { id: "year", label: "Jahr" },
];


const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "apps", label: "Apps" },
  { id: "landings", label: "Landings" },
];

function TabSelector({ active, landP }: { active: AnalyticsTab; landP: Period }) {
  const hrefFor = (id: AnalyticsTab) => {
    const params = new URLSearchParams({ tab: id, p_pub: landP });
    return `/admin/analytics?${params.toString()}`;
  };
  return (
    <div className="seg" role="tablist" aria-label="Analytics Tab" style={{ marginBottom: 18 }}>
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={hrefFor(t.id)}
          className={active === t.id ? "on" : ""}
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

function PeriodSelector({
  active,
  onKeys,
  allCount,
}: {
  active: Period;
  onKeys: string[];
  allCount: number;
}) {
  const hrefFor = (p: Period) => landingsHref(p, onKeys, allCount);
  return (
    <div className="seg" role="tablist" aria-label="Zeitraum">
      {PERIODS.map((p) => (
        <Link
          key={p.id}
          href={hrefFor(p.id)}
          className={active === p.id ? "on" : ""}
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

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function HBar({ data, max }: { data: { label: string; count: number }[]; max?: number }) {
  if (data.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
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
              height: 8,
              borderRadius: 4,
              background: "var(--surface-2)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${(d.count / M) * 100}%`,
                background: "var(--chart-1)",
                borderRadius: 4,
                transition: "width .25s ease",
              }}
            />
          </span>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
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
  appsData,
  appsChart,
  tab,
  periodLandings,
}: {
  landings: LandingsPayload;
  appsData: AppsPayload;
  appsChart: AppsChartPayload;
  tab: AnalyticsTab;
  periodLandings: Period;
}) {
  const onKeys = landings.chips.filter((c) => c.on).map((c) => c.key);

  return (
    <>
      <TabSelector active={tab} landP={periodLandings} />
      {/* The Apps tab uses fixed windows (auth.users new-30/7d + RevenueCat's
          own 28-day overview), so a period selector there would be misleading.
          Nur der Landing-Tab bekommt einen. */}
      {tab === "landings" ? (
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
            active={periodLandings}
            onKeys={onKeys}
            allCount={landings.chips.length}
          />
          {landings.totalVisits === 0 ? (
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
          fontWeight: 600,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
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
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
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
            background: i >= cutoff ? "var(--fg)" : "color-mix(in oklab,var(--fg) 26%,transparent)",
            borderRadius: 1,
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
    <div className="card" style={{ padding: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
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
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-.01em",
            color: "var(--fg)",
          }}
        >
          {row.name}
        </h3>
        <span className={`pill${row.hasBackend ? " live" : ""}`} style={{ fontSize: 9 }}>
          {row.hasBackend ? "live" : "kein Backend"}
        </span>
      </div>

      {/* Users — the movement is the headline, the total is the context. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 38,
                lineHeight: 1,
                letterSpacing: "-.03em",
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
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: "var(--fg-2)",
            }}
          >
            {fmtInt(row.usersTotal)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-4)", marginTop: 4 }}>
            User gesamt
          </div>
        </div>
      </div>

      {row.spark && row.spark.length > 0 ? <Sparkline values={row.spark} /> : null}

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
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--fg-4)" }}>
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
          <p className="muted" style={{ fontSize: 12, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pill" style={{ fontSize: 9 }}>Umsatz</span>
            RevenueCat-Key fehlt — in <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>KLAR_REVENUECAT_KEYS</code> ergänzen.
          </p>
        )}
      </div>
    </div>
  );
}

// Hex for the chip dots, matching the Tailwind *-500 the AreaChart fills with.
const CHART_DOT: Record<string, string> = {
  blue: "#3b82f6",
  emerald: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  pink: "#ec4899",
  lime: "#84cc16",
  fuchsia: "#d946ef",
};
function dotColor(c: string): string {
  return CHART_DOT[c] ?? "var(--fg-3)";
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="seg" role="tablist" aria-label="Metrik">
          {APPS_METRICS.map((m) => (
            <Link
              key={m.id}
              href={appsHref(m.id, chart.period, onSlugs, allCount)}
              className={chart.metric === m.id ? "on" : ""}
              role="tab"
              aria-selected={chart.metric === m.id}
              prefetch
            >
              {m.label}
            </Link>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Zeitraum">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={appsHref(chart.metric, p.id, onSlugs, allCount)}
              className={chart.period === p.id ? "on" : ""}
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
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px",
                borderRadius: 999,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--line-strong)",
                background: a.on ? "var(--surface-2)" : "var(--surface)",
                color: a.on ? "var(--fg)" : "var(--fg-4)",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: dotColor(a.color),
                  display: "inline-block",
                  opacity: a.on ? 1 : 0.35,
                }}
              />
              {a.name}
            </Link>
          );
        })}
      </div>
      <div className="chart">
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
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Keine App ausgewählt oder keine Daten im Zeitraum.
          </p>
        )}
        {chart.note ? (
          <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>
            {chart.note}
          </p>
        ) : null}
      </div>
    </>
  );
}

function AppsView({ apps, chart }: { apps: AppsPayload; chart: AppsChartPayload }) {
  return (
    <>
      <div className="cards">
        <StatRow
          label="User gesamt"
          value={fmtInt(apps.totalUsers)}
          sub={`+${fmtInt(apps.totalNew30d)} in 30 Tagen · ${apps.connectedCount}/${apps.perApp.length} Apps verbunden`}
        />
        <StatRow
          label="Aktive Abos"
          value={fmtInt(apps.totalActiveSubs)}
          sub={apps.revenueCatCount > 0 ? `${apps.revenueCatCount} Apps mit RevenueCat` : "RevenueCat noch nicht verbunden"}
        />
        <StatRow
          label="MRR gesamt"
          value={apps.revenueCatCount > 0 ? fmtMoney(apps.totalMrr, apps.currency) : "—"}
          sub={apps.revenueCatCount > 0 ? "Σ über verbundene Apps" : "Key fehlt"}
        />
        <StatRow
          label="Umsatz 28T"
          value={apps.revenueCatCount > 0 ? fmtMoney(apps.totalRevenue28d, apps.currency) : "—"}
          sub={apps.revenueCatCount > 0 ? "letzte 28 Tage (RevenueCat)" : "Key fehlt"}
        />
      </div>
      <AppsChartSection chart={chart} />
      <h2>Pro App</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
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
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.icon}
          alt=""
          width={30}
          height={30}
          style={{ borderRadius: 7, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{row.name}</span>
            {row.primary ? (
              <span
                title="Diese Adresse steht in der Bio und unter den Videos"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                Beworben
              </span>
            ) : null}
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
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: dotColor(row.color),
            flexShrink: 0,
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span
          style={{
            fontSize: 30,
            lineHeight: 1,
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
        <Sparkline values={row.spark} />
      </div>

      <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 10 }}>
        {row.visits > 0 ? (
          <>
            Top-Quelle: <span style={{ color: "var(--fg-3)" }}>{row.topReferrer ?? "(direkt)"}</span>
          </>
        ) : (
          <>
            Noch kein Aufruf gemessen · Beacon in <code>{row.repo}</code>
          </>
        )}
      </div>
    </div>
  );
}

function LandingsView({ landings }: { landings: LandingsPayload }) {
  const onKeys = landings.chips.filter((c) => c.on).map((c) => c.key);
  const allCount = landings.chips.length;
  const total = deltaOf(landings.totalVisits, landings.totalPrev);

  return (
    <>
      <div className="cards">
        <StatRow
          label="Aufrufe gesamt"
          value={fmtInt(landings.totalVisits)}
          sub={`${periodLabel(landings.period)} · ${total.text} vs. ${prevLabel(landings.period)} (${fmtInt(landings.totalPrev)})`}
        />
        <StatRow
          label="Sessions"
          value={fmtInt(landings.totalSessions)}
          sub="unique pro Tag, über alle Landings"
        />
        <StatRow
          label="Stärkste Seite"
          value={landings.best ?? "—"}
          sub={landings.best ? "meiste Aufrufe im Zeitraum" : "noch keine Aufrufe"}
        />
        <StatRow
          label="Seiten mit Daten"
          value={`${landings.withData} / ${landings.trackedCount}`}
          sub={
            landings.withData === 0
              ? "Beacon noch nicht deployt?"
              : "gemessene von definierten Landings"
          }
        />
      </div>

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
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px",
                borderRadius: 999,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                border: "1px solid var(--line-strong)",
                background: c.on ? "var(--surface-2)" : "var(--surface)",
                color: c.on ? "var(--fg)" : "var(--fg-4)",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: dotColor(c.color),
                  display: "inline-block",
                  opacity: c.on ? 1 : 0.35,
                }}
              />
              {c.label}
            </Link>
          );
        })}
      </div>
      <div className="chart">
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
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Keine Seite ausgewählt.
          </p>
        )}
      </div>

      <h2>Pro Landing</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {landings.perLanding.map((row) => (
          <LandingCard key={row.key} row={row} period={landings.period} />
        ))}
      </div>

      <h2>Andere Seiten</h2>
      <div className="chart-grid">
        <ChartCard title="Gemessen, aber keine Landing">
          <HBar data={landings.otherPages} />
          <p className="muted" style={{ fontSize: 12, margin: "14px 0 0" }}>
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
