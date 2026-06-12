// Account: contract overview + contact methods + cancel-contract entry.
// Bundles every "out-of-band" action (book a call, email Alain, read the
// legal terms, cancel) into one focused page so they don't clutter
// Overview / Earnings / Funnel.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabaseAuth";
import { loadAffiliate } from "../_shared/dashboard-data";
import { PageHeader, Card, primaryButton, secondaryButton, pillLink, AppBadges } from "../_shared/ui";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");

  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) redirect("/dashboard");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={<>Your <i style={{ fontFamily: "var(--font-editorial, serif)" }}>contract.</i></>}
        intro="Everything around the legal side, how to reach us, and how to cancel your affiliate contract if you ever need to."
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card eyebrow="Legal" title="Affiliate terms v1.0">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Effective 21 May 2026. App-specific commission rate, 12 to 24 month attribution window, 30-day refund hold-back. Wise payouts on the first of every month.
          </p>
          <Link href="/legal/affiliate-agreement-en" target="_blank" rel="noopener noreferrer" style={pillLink}>
            Read agreement (EN) →
          </Link>
          <Link href="/legal/affiliate-agreement" target="_blank" rel="noopener noreferrer" style={{ ...pillLink, marginTop: 6 }}>
            Lesen auf Deutsch ↗
          </Link>
        </Card>

        <Card eyebrow="Contact" title="Talk to Alain">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Stuck on tracking, need a different commission split, want feedback on a Reel? Book a 15-min call or just send an email.
          </p>
          <a
            href="https://cal.getklar.org/klar/15min"
            target="_blank"
            rel="noopener noreferrer"
            style={primaryButton}
          >
            Book a call (15 min)
          </a>
          <a href="mailto:alain@getklar.org" style={secondaryButton}>
            Email alain@getklar.org
          </a>
        </Card>

        <Card eyebrow="Danger zone" title="Cancel contract">
          <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Cancelling stops new commission attribution. Already-earned commissions still get paid out on the next monthly batch.
          </p>
          {affiliate.status === "cancelled" ? (
            <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Already cancelled.</p>
          ) : (
            <Link
              href="/dashboard/cancel"
              style={{
                ...secondaryButton,
                color: "#f59e0b",
                borderColor: "color-mix(in oklab, #f59e0b, transparent 70%)",
              }}
            >
              Cancel contract →
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
