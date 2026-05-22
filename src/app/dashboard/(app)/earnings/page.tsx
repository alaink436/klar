// Earnings detail: big claimable number, area chart over the last 6 months,
// per-app breakdown table, payout history. All four pieces server-rendered
// from the same loadStatsForApp() call used on Overview.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import {
  loadAffiliate,
  loadStatsForApp,
  aggregateMonthlyEarnings,
  eur,
  type AppStats,
} from "../_shared/dashboard-data";
import { PageHeader, Card } from "../_shared/ui";
import { EarningsChart } from "./EarningsChart";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) redirect("/dashboard");

  const stats: AppStats[] = (
    await Promise.all(affiliate.apps.map((slug) => loadStatsForApp(slug, affiliate.handles[slug] ?? "")))
  ).filter((s): s is AppStats => s !== null);

  const totalClaimable = stats.reduce((s, x) => s + x.claimable_cents, 0);
  const totalMatured = stats.reduce((s, x) => s + x.matured_cents, 0);
  const totalPaid = stats.reduce((s, x) => s + x.paid_cents, 0);

  const monthly = aggregateMonthlyEarnings(stats, 6);
  const chartData = monthly.map((m) => ({
    label: m.label,
    earnings: Math.round(m.earnings_cents / 100),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Earnings"
        title={<>Your <i style={{ fontFamily: "var(--font-editorial, serif)" }}>commission.</i></>}
        intro="Total earned across every connected app, what's already been paid out, and what's still claimable."
      />

      {/* 3 top-level KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        <Kpi label="Available to claim" value={eur(totalClaimable)} accent />
        <Kpi label="Total earned" value={eur(totalMatured)} />
        <Kpi label="Already paid out" value={eur(totalPaid)} />
      </div>

      {/* Chart */}
      <Card eyebrow="Last 6 months" title="Monthly earnings">
        <EarningsChart data={chartData} />
      </Card>

      {/* Per-app breakdown */}
      {stats.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Card eyebrow="Per app" title="Where it comes from">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  <Th>App</Th>
                  <Th align="right">Earned</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Claimable</Th>
                  <Th align="right">Buyers</Th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.slug}>
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.iconUrl} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
                        <b>{s.appName}</b>
                        <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>@{s.handle}</span>
                      </span>
                    </Td>
                    <Td align="right">{eur(s.matured_cents)}</Td>
                    <Td align="right">{eur(s.paid_cents)}</Td>
                    <Td align="right" accent>{eur(s.claimable_cents)}</Td>
                    <Td align="right">{s.conversions.toLocaleString("en-IE")}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.55 }}>
        Earnings update every 60 seconds. Premium-subscription commissions count once the 30-day refund window has passed. Wise payouts land in your account on the first business day of the following month.
      </p>
    </>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent
          ? "color-mix(in oklab, var(--fg), transparent 88%)"
          : "color-mix(in oklab, var(--fg), transparent 94%)",
        border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "var(--fg-3)",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display, system-ui)",
          fontSize: accent ? 36 : 28,
          fontWeight: 700,
          letterSpacing: -1,
          color: "var(--fg)",
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: "var(--fg-3)",
        borderBottom: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
        padding: "10px 12px 10px 0",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  accent,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  accent?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "12px 12px 12px 0",
        borderBottom: "1px dashed color-mix(in oklab, var(--fg), transparent 88%)",
        color: accent ? "var(--fg)" : "var(--fg-2)",
        fontWeight: accent ? 600 : 400,
        fontFamily: align === "right" ? "var(--font-mono, monospace)" : "inherit",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </td>
  );
}
