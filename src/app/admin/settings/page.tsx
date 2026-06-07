// Klar Control · Settings view.
//
// Server component. Reads admin_settings + admin_invites from the Klar Inbox
// Supabase (anime-vault project, service-role key), then renders the settings UI
// (SettingsManager, built on the shadcn/ui kit). Three sections:
//   1) Globale Einstellungen — shader on/off, auto-accept toggle.
//   2) Benachrichtigungen — trigger toggles, batch size, recipient email.
//   3) Zugriff — invite generator + list of existing invite tokens.
//
// All form posts still go to plain server routes (/admin/settings/save and
// /admin/invite), no client-side state. Auth gate matches /admin (klar_device
// HMAC + klar_admin session cookie).

import { headers } from "next/headers";
import AdminSidebar from "../AdminSidebar";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import { getAdminSettings, listInvites } from "../../../lib/adminSettings";
import SettingsManager, { type InviteRow } from "./SettingsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Origin used to build the absolute invite URL displayed to the admin.
function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "getklar.org";
  return `${proto}://${host}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  // Auth — same gate as /admin and /admin/analytics.
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
  const [settings, invites] = await Promise.all([getAdminSettings(), listInvites()]);
  const origin = originFromHeaders(h);
  const now = Date.now();

  const inviteRows: InviteRow[] = invites.map((inv) => ({
    name: inv.invited_name || "",
    email: inv.invited_email || "",
    url: `${origin}/admin/login?invite=${encodeURIComponent(inv.token)}`,
    expiresFmt: new Date(inv.expires_at).toLocaleDateString("de-CH"),
    status: inv.used_at ? "used" : new Date(inv.expires_at).getTime() < now ? "expired" : "open",
  }));

  const flashRaw = sp.err ?? sp.msg ?? null;
  const isErr = Boolean(sp.err);

  const topbar = `
    <span class="crumb"><b>Einstellungen</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Einstellungen · Klar Control</title>
      <div className="layout">
        <AdminSidebar active={"settings"} apps={getApps()} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Einstellungen</h1>
            <p className="sub">
              Globale Schalter für das Klar-Studio — Marketing-Shader, Auto-Accept
              für Affiliate-Inquiries, Benachrichtigungs-Trigger und Einladungen
              für neue Admin-Geräte.
            </p>
            {flashRaw ? (
              <div
                className={
                  isErr
                    ? "mb-6 rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--danger)_35%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] px-4 py-3 text-[13.5px] text-danger"
                    : "mb-6 rounded-[var(--radius-sm)] border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2"
                }
              >
                {flashRaw}
              </div>
            ) : null}
            <SettingsManager
              settings={{
                shader_enabled: settings.shader_enabled,
                auto_accept_affiliates: settings.auto_accept_affiliates,
                notification_trigger_inquiry: settings.notification_trigger_inquiry,
                notification_trigger_complete: settings.notification_trigger_complete,
                notification_batch_size: settings.notification_batch_size,
                notification_recipient_email: settings.notification_recipient_email,
              }}
              invites={inviteRows}
            />
          </div>
        </main>
      </div>
    </>
  );
}
