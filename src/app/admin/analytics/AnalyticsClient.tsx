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
import { BarChart } from "../tremor/components/BarChart/BarChart";

export type Period = "week" | "month" | "year";
export type AnalyticsTab = "apps" | "public" | "affiliate" | "funnel";

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

export interface AppFunnelRow {
  slug: string;
  name: string;
  hasBackend: boolean;
  clicks: number;
  installs: number;
  premiums: number;
  installRate: number;
  premiumRate: number;
}

export interface FunnelPayload {
  perApp: AppFunnelRow[];
  totalClicks: number;
  totalInstalls: number;
  totalPremiums: number;
}

export interface AnalyticsPayload {
  totalVisits: number;
  uniqueSessions: number;
  topPage: string | null;
  topReferrer: string | null;
  series: { label: string; visits: number; sessions: number }[];
  pages: { label: string; count: number }[];
  referrers: { label: string; count: number }[];
  countries: { label: string; count: number }[];
  browsers: { label: string; count: number }[];
  // Affiliate-Landings: hits on /i/<slug>/<code> aggregated by app slug.
  affiliates: {
    totalHits: number;
    uniqueCodes: number;
    perApp: { slug: string; name: string; hits: number }[];
    topCodes: { slug: string; code: string; hits: number }[];
  };
}

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "7 Tage" },
  { id: "month", label: "30 Tage" },
  { id: "year", label: "Jahr" },
];


const TABS: { id: AnalyticsTab; label: string; periodParam: "p_pub" | "p_aff" | "p_fun" }[] = [
  { id: "apps", label: "Apps", periodParam: "p_pub" },
  { id: "public", label: "Public", periodParam: "p_pub" },
  { id: "affiliate", label: "Affiliate-Landings", periodParam: "p_aff" },
  { id: "funnel", label: "Funnel", periodParam: "p_fun" },
];

function TabSelector({
  active,
  pubP,
  affP,
  funP,
}: {
  active: AnalyticsTab;
  pubP: Period;
  affP: Period;
  funP: Period;
}) {
  const hrefFor = (id: AnalyticsTab) => {
    const params = new URLSearchParams({ tab: id, p_pub: pubP, p_aff: affP, p_fun: funP });
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
  tab,
  pubP,
  affP,
  funP,
}: {
  active: Period;
  tab: AnalyticsTab;
  pubP: Period;
  affP: Period;
  funP: Period;
}) {
  const hrefFor = (p: Period) => {
    const params = new URLSearchParams({
      tab,
      p_pub: tab === "public" ? p : pubP,
      p_aff: tab === "affiliate" ? p : affP,
      p_fun: tab === "funnel" ? p : funP,
    });
    return `/admin/analytics?${params.toString()}`;
  };
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

function FunnelBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        height: 10,
        borderRadius: 5,
        background: "var(--surface-2)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 5,
          transition: "width .25s ease",
        }}
      />
    </span>
  );
}

function pct(n: number): string {
  if (!isFinite(n) || n <= 0) return "—";
  return `${(n * 100).toFixed(n >= 0.1 ? 1 : 2)}%`;
}

function AppFunnelCard({ row }: { row: AppFunnelRow }) {
  const max = Math.max(row.clicks, row.installs, row.premiums, 1);
  return (
    <div className="card" style={{ padding: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-.01em",
            color: "var(--fg)",
          }}
        >
          {row.name}
        </h3>
        <span
          className={`pill${row.hasBackend ? " live" : ""}`}
          style={{ fontSize: 9 }}
        >
          {row.hasBackend ? "live" : "Backend pending"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              marginBottom: 4,
            }}
          >
            <span>Landing-Klicks</span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>{row.clicks}</span>
          </div>
          <FunnelBar value={row.clicks} max={max} color="var(--chart-1)" />
        </div>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              marginBottom: 4,
            }}
          >
            <span>Installs · Referrals</span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>
              {row.hasBackend ? row.installs : "—"}
              {row.hasBackend && row.clicks > 0 ? (
                <span style={{ color: "var(--fg-3)", marginLeft: 6, fontWeight: 400 }}>
                  ({pct(row.installRate)})
                </span>
              ) : null}
            </span>
          </div>
          <FunnelBar value={row.installs} max={max} color="var(--chart-2)" />
        </div>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              marginBottom: 4,
            }}
          >
            <span>Premium · Paid</span>
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>
              {row.hasBackend ? row.premiums : "—"}
              {row.hasBackend && row.installs > 0 ? (
                <span style={{ color: "var(--fg-3)", marginLeft: 6, fontWeight: 400 }}>
                  ({pct(row.premiumRate)})
                </span>
              ) : null}
            </span>
          </div>
          <FunnelBar value={row.premiums} max={max} color="var(--chart-3)" />
        </div>
      </div>
      {!row.hasBackend ? (
        <p className="muted" style={{ fontSize: 12, margin: "14px 0 0" }}>
          Affiliate-Backend für {row.name} noch nicht ausgerollt. Nur Landing-Klicks
          werden via klar_pageviews getrackt. Stage-B-Rollout startet aus dem Chat.
        </p>
      ) : null}
    </div>
  );
}

function FunnelView({ funnel }: { funnel: FunnelPayload }) {
  const overallInstallRate = funnel.totalClicks > 0 ? funnel.totalInstalls / funnel.totalClicks : 0;
  const overallPremiumRate = funnel.totalInstalls > 0 ? funnel.totalPremiums / funnel.totalInstalls : 0;
  return (
    <>
      <div className="cards">
        <StatRow label="Klicks gesamt" value={funnel.totalClicks} sub="alle Affiliate-Landings" />
        <StatRow label="Installs · Referrals" value={funnel.totalInstalls} sub={`Conv-Rate ${pct(overallInstallRate)}`} />
        <StatRow label="Premium · Paid" value={funnel.totalPremiums} sub={`Conv-Rate ${pct(overallPremiumRate)}`} />
        <StatRow
          label="Apps mit Backend"
          value={funnel.perApp.filter((a) => a.hasBackend).length}
          sub={`von ${funnel.perApp.length} insgesamt`}
        />
      </div>
      <h2>Pro App</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {funnel.perApp.map((row) => (
          <AppFunnelCard key={row.slug} row={row} />
        ))}
      </div>
    </>
  );
}

export default function AnalyticsClient({
  data,
  funnel,
  appsData,
  tab,
  periodPublic,
  periodAffiliate,
  periodFunnel,
}: {
  data: AnalyticsPayload;
  funnel: FunnelPayload;
  appsData: AppsPayload;
  tab: AnalyticsTab;
  periodPublic: Period;
  periodAffiliate: Period;
  periodFunnel: Period;
}) {
  const period: Period =
    tab === "affiliate" ? periodAffiliate : tab === "funnel" ? periodFunnel : periodPublic;
  const isEmpty = data.totalVisits === 0 && funnel.totalClicks === 0;

  return (
    <>
      <TabSelector
        active={tab}
        pubP={periodPublic}
        affP={periodAffiliate}
        funP={periodFunnel}
      />
      {/* The Apps tab uses fixed windows (auth.users new-30/7d + RevenueCat's
          own 28-day overview), so a period selector there would be misleading.
          Only the visitor/affiliate/funnel tabs get one. */}
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
            active={period}
            tab={tab}
            pubP={periodPublic}
            affP={periodAffiliate}
            funP={periodFunnel}
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
      {tab === "apps" ? <AppsView apps={appsData} /> : null}
      {tab === "funnel" ? <FunnelView funnel={funnel} /> : null}
      {tab === "affiliate" ? <AffiliateLandingsView data={data} /> : null}
      {tab === "public" ? <PublicView data={data} period={period} /> : null}
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

function AppCard({ row }: { row: AppRow }) {
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

      {/* Users */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: "-.03em",
            fontVariantNumeric: "tabular-nums",
            color: "var(--fg)",
          }}
        >
          {fmtInt(row.usersTotal)}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          User
        </span>
        {row.hasBackend && row.usersNew30d !== null && row.usersNew30d > 0 ? (
          <span className="delta up" style={{ marginLeft: "auto" }}>
            +{row.usersNew30d} / 30T
          </span>
        ) : null}
      </div>
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

function AppsView({ apps }: { apps: AppsPayload }) {
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

function PublicView({ data, period }: { data: AnalyticsPayload; period: Period }) {
  return (
    <>
      <div className="cards">
        <StatRow
          label="Visits"
          value={data.totalVisits}
          sub={
            period === "week"
              ? "letzte 7 Tage"
              : period === "year"
                ? "letzte 12 Monate"
                : "letzte 30 Tage"
          }
        />
        <StatRow label="Sessions" value={data.uniqueSessions} sub="unique pro Tag" />
        <StatRow label="Top-Seite" value={data.topPage ?? "—"} sub="meist besucht" />
        <StatRow label="Top-Quelle" value={data.topReferrer ?? "—"} sub="referrer" />
      </div>

      <h2>Verlauf</h2>
      <div className="chart">
        <AreaChart
          data={data.series.map((d) => ({ label: d.label, Visits: d.visits, Sessions: d.sessions }))}
          index="label"
          categories={["Visits", "Sessions"]}
          colors={["ink", "steel"]}
          valueFormatter={(v) => v.toLocaleString("de-CH")}
          startEndOnly
          showLegend
          className="h-60"
        />
      </div>

      <h2>Top-Seiten</h2>
      <div className="chart-grid">
        <ChartCard title="Seiten">
          <HBar data={data.pages} />
        </ChartCard>
        <ChartCard title="Quellen">
          <HBar data={data.referrers} />
        </ChartCard>
      </div>

      <h2>Geo · Browser</h2>
      <div className="chart-grid">
        <ChartCard title="Länder">
          <BarChart
            data={(data.countries.length ? data.countries : [{ label: "—", count: 0 }]).map((c) => ({ label: c.label, Visits: c.count }))}
            index="label"
            categories={["Visits"]}
            colors={["ink"]}
            valueFormatter={(v) => v.toLocaleString("de-CH")}
            showLegend={false}
            className="h-52"
          />
        </ChartCard>
        <ChartCard title="Browser">
          <HBar data={data.browsers} />
        </ChartCard>
      </div>
    </>
  );
}

function AffiliateLandingsView({ data }: { data: AnalyticsPayload }) {
  return (
    <>
      <div className="cards">
        <StatRow
          label="Klicks gesamt"
          value={data.affiliates.totalHits}
          sub="auf /i/<slug>/<code>"
        />
        <StatRow
          label="Aktive Codes"
          value={data.affiliates.uniqueCodes}
          sub="einzigartig"
        />
        <StatRow
          label="Apps mit Klicks"
          value={data.affiliates.perApp.length}
          sub="von 6 Klar-Apps"
        />
      </div>
      <div className="chart-grid">
        <ChartCard title="Klicks pro App">
          {data.affiliates.perApp.length > 0 ? (
            <BarChart
              data={data.affiliates.perApp.map((a) => ({ label: a.name, Klicks: a.hits }))}
              index="label"
              categories={["Klicks"]}
              colors={["ink"]}
              valueFormatter={(v) => v.toLocaleString("de-CH")}
              showLegend={false}
              className="h-56"
            />
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              Noch keine Klicks auf Affiliate-Landings.
            </p>
          )}
        </ChartCard>
        <ChartCard title="Top-Codes">
          {data.affiliates.topCodes.length > 0 ? (
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 8 }}>
              {data.affiliates.topCodes.map((c) => (
                <li
                  key={`${c.slug}/${c.code}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 38px",
                    gap: 10,
                    alignItems: "baseline",
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
                    title={`/i/${c.slug}/${c.code}`}
                  >
                    <span style={{ color: "var(--fg-3)" }}>{c.slug}/</span>
                    {c.code}
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--fg-2)",
                      textAlign: "right",
                      fontSize: 12,
                    }}
                  >
                    {c.hits}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              Noch keine Code-Klicks.
            </p>
          )}
        </ChartCard>
      </div>
    </>
  );
}
