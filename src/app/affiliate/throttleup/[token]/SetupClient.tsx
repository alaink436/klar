"use client";

// ThrottleUp thin wrapper around the shared OnboardingShell. Posts the
// completed payout form to /api/affiliate/complete which proxies into the
// Moto Supabase via service-role.

import { OnboardingShell } from "../../_shared/onboarding";

export function SetupClient({ token, handle, displayName }: { token: string; handle: string; displayName: string }) {
  void displayName;
  async function onSubmit(form: { displayName: string; country: string; method: "paypal" | "wise" | "sepa"; handle: string; taxStatus: string; canInvoice: boolean }) {
    const promoCode = (handle.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "MOTO") + "20";
    const res = await fetch("/api/affiliate/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "moto",
        token,
        display_name: form.displayName.trim(),
        country: form.country,
        payout_method: form.method,
        payout_email: form.method === "sepa" ? null : form.handle.trim(),
        payout_iban: form.method === "sepa" ? form.handle.trim() : null,
        tax_status: form.taxStatus,
        invoice_capable: form.canInvoice,
        promo_code: promoCode,
      }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; promo_code?: string; error?: string } | null;
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    return { promoCode: j.promo_code || promoCode };
  }

  return <OnboardingShell brand="throttleup" handle={`@${handle}`} onSubmit={onSubmit} />;
}
