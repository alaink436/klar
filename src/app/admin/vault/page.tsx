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
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import { listSecrets, vaultReady } from "../../../lib/vault";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";
import VaultManager, { type VaultRow } from "./VaultManager";

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
  const origin = originFromHeaders(h);
  const secrets = await listSecrets();
  const rows: VaultRow[] = secrets.map((s) => ({
    id: s.id,
    label: s.label,
    provider: s.provider,
    baseUrl: s.base_url,
    proxy: `${origin}/api/vault/proxy/${s.id}/`,
    lastUsed: s.last_used_at ? new Date(s.last_used_at).toLocaleDateString("de-CH") : "—",
  }));
  const active = rows.filter((r) => r.lastUsed !== "—").length;

  const ready = vaultReady();
  const sidebar = adminSidebar("vault", getApps());
  const topbar = `
    <span class="crumb"><b>Vault</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Vault · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Vault</h1>
            <p className="sub">
              Keys werden AES-256-GCM verschlüsselt gespeichert (Master-Key nur in Vercel). Ein Agent mit{" "}
              <code>vault:use</code>-Token nutzt sie über den Proxy, ohne sie je zu sehen. Klartext ist bewusst nicht abrufbar.
            </p>

            {!ready && (
              <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
                Vault inaktiv: setze <code>VAULT_MASTER_KEY</code> in Vercel, dann werden Keys ver- und entschlüsselt.
              </div>
            )}
            {sp.err && (
              <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--danger) 35%,var(--line))", color: "var(--danger)" }}>
                {sp.err}
              </div>
            )}
            {sp.msg && <div className="flash">{sp.msg}</div>}

            {/* Stat hero — animated key count + status, with a travelling border beam. */}
            <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 px-6 py-5">
              <BorderBeam duration={9} size={70} />
              <div className="flex items-end gap-8">
                <div>
                  <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                    Gespeicherte Keys
                  </div>
                  <div className="[font-family:var(--font-display)] font-extrabold text-[42px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">
                    <NumberTicker value={rows.length} />
                  </div>
                </div>
                <div>
                  <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                    Aktiv genutzt
                  </div>
                  <div className="[font-family:var(--font-display)] font-extrabold text-[42px] leading-none tracking-[-0.03em] text-fg mt-2 [font-variant-numeric:tabular-nums]">
                    <NumberTicker value={active} />
                  </div>
                </div>
              </div>
              <Badge tone={ready ? "ok" : "warn"} dot>
                {ready ? "Vault aktiv" : "Vault inaktiv"}
              </Badge>
            </Card>

            <VaultManager rows={rows} />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
