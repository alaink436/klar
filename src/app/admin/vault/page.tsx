// Klar Control · API-Key Vault management view.
//
// Server component (2FA-gated like the rest of /admin). Lists vault keys
// (metadata only — plaintext is never available) and offers add / rotate /
// reveal / delete via the shadcn/ui-based VaultManager. The add + rotate forms
// post the raw key directly to /admin/vault/save, which encrypts it server-side;
// the key never passes through the client beyond the form submit.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  readCookieFromString,
} from "../_shared";
import { DATE_LOCALE, LANG_COOKIE, flashText, normalizeAdminLang, tAdmin } from "../_i18n";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listSecrets, vaultReady } from "../../../lib/vault";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import VaultManager, { type VaultRow } from "./VaultManager";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "getklar.org";
  return `${proto}://${host}`;
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const lang = normalizeAdminLang(readCookieFromString(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);
  const origin = originFromHeaders(h);
  const secrets = await listSecrets();
  const rows: VaultRow[] = secrets.map((s) => ({
    id: s.id,
    label: s.label,
    provider: s.provider,
    category: (s.category ?? "").trim() || "Sonstiges",
    baseUrl: s.base_url ?? "",
    authHeader: s.auth_header,
    authScheme: s.auth_scheme,
    // store-only secrets (no base_url) have no proxy endpoint
    proxy: s.base_url ? `${origin}/api/vault/proxy/${s.id}/` : "",
    lastUsed: s.last_used_at ? new Date(s.last_used_at).toLocaleDateString(DATE_LOCALE[lang]) : "—",
  }));
  const active = rows.filter((r) => r.lastUsed !== "—").length;

  const ready = vaultReady();

  return (
    <>
      <title>Vault · Klar Control</title>
      <AdminTopbar titel={t.vaultTitle} />
      <div className="content">
        <h1>{t.vaultTitle}</h1>

        {!ready && (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            {t.vaultInactiveA}
            <code>VAULT_MASTER_KEY</code>
            {t.vaultInactiveB}
          </div>
        )}
        {sp.err && (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--danger) 35%,var(--line))", color: "var(--danger)" }}>
            {flashText(sp.err, lang)}
          </div>
        )}
        {sp.msg && <div className="flash">{flashText(sp.msg, lang)}</div>}

        {/* Stat hero — key count + status. */}
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 px-6 py-5">
          <div className="flex items-end gap-8">
            <div>
              <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                {t.statStored}
              </div>
              <div className="[font-family:var(--font-display)] font-extrabold text-[42px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">
                <NumberTicker value={rows.length} />
              </div>
            </div>
            <div>
              <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                {t.statActive}
              </div>
              <div className="[font-family:var(--font-display)] font-extrabold text-[42px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">
                <NumberTicker value={active} />
              </div>
            </div>
          </div>
          <Badge tone={ready ? "ok" : "warn"} dot>
            {ready ? t.badgeActive : t.badgeInactive}
          </Badge>
        </Card>

        <VaultManager rows={rows} lang={lang} />
      </div>
    </>
  );
}
