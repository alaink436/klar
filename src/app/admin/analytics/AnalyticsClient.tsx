"use client";

// Recharts-driven analytics dashboard. Receives aggregated payload from
// the parent server component and only handles rendering + interactive
// period switching. No client-side data fetching here.

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type Period = "week" | "month" | "year";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function TipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ color: "var(--fg-3)", marginBottom: 4 }}>{label}</div>
      {payload.map((e: any, i: number) => (
        <div key={i} style={{ color: e.color }}>
          {e.name}: <b style={{ color: "var(--fg)" }}>{e.value}</b>
        </div>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function PeriodSelector({ active }: { active: Period }) {
  return (
    <div className="seg" role="tablist" aria-label="Zeitraum">
      {PERIODS.map((p) => (
        <a
          key={p.id}
          href={`/admin/analytics?p=${p.id}`}
          className={active === p.id ? "on" : ""}
          role="tab"
          aria-selected={active === p.id}
        >
          {p.label}
        </a>
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
  data,
  period,
}: {
  data: AnalyticsPayload;
  period: Period;
}) {
  const isEmpty = data.totalVisits === 0;

  return (
    <>
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
        <PeriodSelector active={period} />
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
            Wartet auf erste Besucher
          </span>
        ) : null}
      </div>

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
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="fgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={36}
              />
              <Tooltip content={<TipBox />} />
              <Area
                type="monotone"
                dataKey="visits"
                name="Visits"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#fgFill)"
              />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Sessions"
                stroke="var(--chart-2)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--chart-1)" }} />
            Visits
          </span>
          <span>
            <i style={{ background: "var(--chart-2)" }} />
            Sessions
          </span>
        </div>
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
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.countries.length ? data.countries : [{ label: "—", count: 0 }]}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip content={<TipBox />} />
                <Bar dataKey="count" name="Visits" radius={[3, 3, 0, 0]}>
                  {data.countries.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "var(--chart-1)" : i < 3 ? "var(--chart-2)" : "var(--chart-3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Browser">
          <HBar data={data.browsers} />
        </ChartCard>
      </div>

      <h2>Affiliate-Landings</h2>
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
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.affiliates.perApp.map((a) => ({ label: a.name, count: a.hits }))}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: "var(--line)" }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip content={<TipBox />} />
                  <Bar dataKey="count" name="Klicks" radius={[3, 3, 0, 0]}>
                    {data.affiliates.perApp.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "var(--chart-1)" : i < 3 ? "var(--chart-2)" : "var(--chart-3)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
