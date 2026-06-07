// Dev-only preview of the auth-gated affiliate dashboard (overview) with mock
// data, so the UI can be eyeballed without a Supabase session. Lives OUTSIDE
// the (app) route group so it skips the auth gate. Returns 404 in production.

import { notFound } from "next/navigation";
import { Sidebar } from "../(app)/_shared/sidebar";
import { PageHeader, Card, Row, AppBadges } from "../(app)/_shared/ui";
import { eur } from "../(app)/_shared/dashboard-data";
import { EarningsChart } from "../(app)/earnings/EarningsChart";

export const dynamic = "force-dynamic";

export default function DashboardDevPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const affiliate = {
    display_name: "Alain Kessler",
    apps: ["wavelength", "myloo"],
    handles: { wavelength: "aktest", myloo: "aktest" } as Record<string, string>,
    status: "active" as const,
  };
  const stats = [
    { claimable_cents: 9600, clicks: 1284, installs: 317, conversions: 24 },
    { claimable_cents: 3100, clicks: 540, installs: 96, conversions: 7 },
  ];
  const totalClaimable = stats.reduce((s, x) => s + x.claimable_cents, 0);
  const totalClicks = stats.reduce((s, x) => s + x.clicks, 0);
  const totalInstalls = stats.reduce((s, x) => s + x.installs, 0);
  const totalConversions = stats.reduce((s, x) => s + x.conversions, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 240px) 1fr", minHeight: "100dvh" }}>
      <Sidebar email="alainkessler04@gmail.com" />
      <div style={{ padding: "32px 32px 80px", minWidth: 0 }}>
        <PageHeader
          eyebrow="Overview · DEV PREVIEW (mock data)"
          title={<>Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>Alain.</i></>}
        />

        <div style={{ marginBottom: 22 }}>
          <AppBadges apps={affiliate.apps} handles={affiliate.handles} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <Card eyebrow="① Earnings" title="Available to claim" href="#">
            <div
              style={{
                fontFamily: "var(--font-display, system-ui)",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: -1,
                color: "var(--fg)",
                margin: "4px 0 8px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {eur(totalClaimable)}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)" }}>Tap for breakdown →</div>
          </Card>

          <Card eyebrow="② Funnel" title="Clicks → Buyers" href="#">
            <Row label="Clicks" value={totalClicks.toLocaleString("en-IE")} />
            <Row label="Installs" value={totalInstalls.toLocaleString("en-IE")} />
            <Row label="Buyers" value={totalConversions.toLocaleString("en-IE")} accent />
          </Card>

          <Card eyebrow="③ Contract" title="Active since onboarding" href="#">
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 4px", lineHeight: 1.55 }}>
              Affiliate terms v1.0. App-specific commission, 12-24 month attribution, 30-day refund hold-back.
            </p>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>Open agreement →</div>
          </Card>

          <Card eyebrow="④ Need help" title="Talk to Alain" href="#">
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 4px", lineHeight: 1.55 }}>
              Book a call, send an email, or cancel your contract, all in Account.
            </p>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>Open account →</div>
          </Card>
        </div>

        <div style={{ marginTop: 16 }}>
          <Card eyebrow="Last 6 months" title="Monthly earnings">
            <EarningsChart
              data={[
                { label: "Jan", earnings: 0 },
                { label: "Feb", earnings: 18 },
                { label: "Mar", earnings: 24 },
                { label: "Apr", earnings: 47 },
                { label: "May", earnings: 62 },
                { label: "Jun", earnings: 96 },
              ]}
              height={220}
            />
          </Card>
        </div>

        <footer style={{ marginTop: 32, fontSize: 12, color: "var(--fg-4)" }}>
          Dev preview with mock numbers. The live dashboard pulls real attribution data per app.
        </footer>
      </div>
    </div>
  );
}
