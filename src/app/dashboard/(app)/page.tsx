// Overview: compact at-a-glance summary of all 4 dashboard sections. Each
// summary card links to the detailed sub-page (Earnings, Funnel, Account).
// Auth is enforced at the layout boundary, here we just load + render.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabaseAuth";
import { ensureAffiliate } from "@/lib/ensureAffiliate";
import {
  loadAffiliate,
  loadStatsForApp,
  eur,
  type AppStats,
} from "./_shared/dashboard-data";
import { PageHeader, Card, Row, AppBadges } from "./_shared/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  if (user.email) {
    await ensureAffiliate(user.id, user.email).catch((e) => {
      console.warn("[dashboard/overview] ensure-affiliate threw", e);
    });
  }

  const affiliate = await loadAffiliate(user.id);
  const firstName = (affiliate?.display_name || user.email?.split("@")[0] || "there").split(/\s+/)[0];

  if (!affiliate) {
    return (
      <>
        <PageHeader
          eyebrow="Overview"
          title={<>Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{firstName}.</i></>}
          intro="We couldn't link your account to any of the apps yet. If you just signed up, give it a minute and refresh. If you used a different email in the outreach, drop us a note."
        />
        <a
          href="mailto:alain@getklar.org"
          style={{
            display: "inline-block",
            padding: "11px 18px",
            background: "var(--fg)",
            color: "var(--bg)",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Email alain@getklar.org
        </a>
      </>
    );
  }

  const stats: AppStats[] = (
    await Promise.all(affiliate.apps.map((slug) => loadStatsForApp(slug, affiliate.handles[slug] ?? "")))
  ).filter((s): s is AppStats => s !== null);

  const totalClaimable = stats.reduce((s, x) => s + x.claimable_cents, 0);
  const totalClicks = stats.reduce((s, x) => s + x.clicks, 0);
  const totalInstalls = stats.reduce((s, x) => s + x.installs, 0);
  const totalConversions = stats.reduce((s, x) => s + x.conversions, 0);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={<>Hi <i style={{ fontFamily: "var(--font-editorial, serif)" }}>{firstName}.</i></>}
      />

      <div style={{ marginBottom: 22 }}>
        <AppBadges apps={affiliate.apps} handles={affiliate.handles} />
      </div>

      {affiliate.status === "cancelled" && (
        <div
          style={{
            padding: "14px 16px",
            background: "color-mix(in oklab, #f59e0b, transparent 86%)",
            border: "1px solid color-mix(in oklab, #f59e0b, transparent 70%)",
            borderRadius: 10,
            marginBottom: 24,
            fontSize: 14,
            color: "var(--fg)",
          }}
        >
          Your affiliate contract was cancelled on{" "}
          {affiliate.cancelled_at ? new Date(affiliate.cancelled_at).toLocaleDateString("en-IE") : "-"}.
          Already-earned commissions will still be paid out.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Card eyebrow="① Earnings" title="Available to claim" href="/dashboard/earnings">
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

        <Card eyebrow="② Funnel" title="Clicks → Buyers" href="/dashboard/funnel">
          <Row label="Clicks" value={totalClicks.toLocaleString("en-IE")} />
          <Row label="Installs" value={totalInstalls.toLocaleString("en-IE")} />
          <Row label="Buyers" value={totalConversions.toLocaleString("en-IE")} accent />
        </Card>

        <Card eyebrow="③ Contract" title="Active since onboarding" href="/dashboard/account">
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 4px", lineHeight: 1.55 }}>
            Affiliate terms v1.0. App-specific commission, 12-24 month attribution, 30-day refund hold-back.
          </p>
          <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>Open agreement →</div>
        </Card>

        <Card eyebrow="④ Need help" title="Talk to Alain" href="/dashboard/account">
          <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 4px", lineHeight: 1.55 }}>
            Book a call, send an email, or cancel your contract — all in Account.
          </p>
          <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>Open account →</div>
        </Card>
      </div>

      <footer style={{ marginTop: 32, fontSize: 12, color: "var(--fg-4)" }}>
        Data cached for 60 seconds. Last refreshed: {new Date().toLocaleTimeString("en-IE")}.
      </footer>
    </>
  );
}
