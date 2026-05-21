"use client";

// Yarn-Stash thin wrapper around the shared OnboardingShell. Posts the
// completed payout form to /api/affiliate/complete which:
//   1. proxies into the Yarn-Stash Supabase via service-role to call
//      complete_influencer_setup
//   2. logs the click-through agreement in anime-vault.affiliate_agreements
//   3. fires the confirmation email via the affiliate-confirmation-email
//      edge function

import { OnboardingShell } from "../../_shared/onboarding";
import type { PayoutState } from "../../_shared/onboarding";
import { BRANDS } from "../../_shared/brands";

const BRAND = BRANDS.yarnstash;

export function SetupClient({ token, handle, displayName }: { token: string; handle: string; displayName: string }) {
  void displayName;
  async function onSubmit(form: PayoutState) {
    const promoCode = (handle.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "YARN") + "20";
    const res = await fetch("/api/affiliate/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "yarn-stash",
        token,
        display_name: form.displayName.trim(),
        country: form.country,
        payout_method: form.method,
        payout_email: form.method === "sepa" ? null : form.handle.trim(),
        payout_iban: form.method === "sepa" ? form.handle.trim() : null,
        tax_status: form.taxStatus,
        invoice_capable: form.canInvoice,
        promo_code: promoCode,
        agreement_accepted: form.agreementAccepted,
        assets_drive_url: BRAND.assetsDriveUrl ?? null,
      }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; promo_code?: string; error?: string } | null;
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    return { promoCode: j.promo_code || promoCode };
  }

  return <OnboardingShell brand="yarnstash" handle={`@${handle}`} onSubmit={onSubmit} />;
}
