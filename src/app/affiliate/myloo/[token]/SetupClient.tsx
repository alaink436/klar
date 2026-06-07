"use client";

// MyLoo thin wrapper around the shared OnboardingShell. Posts the completed
// payout form to /api/affiliate/complete which proxies into the MyLoo
// Supabase via service-role and triggers agreement-log + confirmation
// email.

import { OnboardingShell } from "../../_shared/onboarding";
import type { PayoutState } from "../../_shared/onboarding";
import { BRANDS } from "../../_shared/brands";
import { normalizeLang } from "../../_shared/i18n";

const BRAND = BRANDS.myloo;

export function SetupClient({ token, handle, displayName, language }: { token: string; handle: string; displayName: string; language?: string }) {
  const lang = normalizeLang(language);
  void displayName;
  async function onSubmit(form: PayoutState) {
    const res = await fetch("/api/affiliate/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "myloo",
        token,
        display_name: form.displayName.trim(),
        country: form.country,
        payout_method: form.method,
        payout_email: form.handle.trim(),
        tax_status: form.taxStatus,
        invoice_capable: form.canInvoice,
        agreement_accepted: form.agreementAccepted,
        signature_name: form.signature.trim(),
        handle,
        assets_drive_url: BRAND.assetsDriveUrl ?? null,
      }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  }

  return <OnboardingShell brand="myloo" handle={`@${handle}`} onSubmit={onSubmit} lang={lang} />;
}
