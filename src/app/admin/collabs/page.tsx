// Klar Control · Collabs — eingehende Anfragen an die öffentlichen Bio-Adressen.
//
// Server component, 2FA-gated wie der Rest von /admin. Zeigt die Adressen zum
// Kopieren (TikTok/IG-Bio) und alle Threads aus `klar_collab_messages`.
// Geantwortet wird in der Inbox; jede Zeile deep-linkt dorthin.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { buildCollabView } from "@/lib/collabView";
import { LANG_COOKIE, normalizeAdminLang, tAdmin } from "../_i18n";
import CollabsView from "./CollabsView";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CollabsPage({
  searchParams,
}: {
  // ?msg=… kommt vom Redirect aus /admin/collab/manual.
  searchParams: Promise<{ msg?: string }>;
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

  const lang = normalizeAdminLang(readCookieFromString(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);
  const view = await buildCollabView();
  const msg = (await searchParams).msg?.slice(0, 400);


  return (
    <>
      <title>Collabs · Klar Control</title>
      <AdminTopbar titel={t.navCollabs} />
      <div className="content">
        <h1>{t.navCollabs}</h1>
        <CollabsView
          aliases={view.aliases}
          threads={view.threads}
          apps={view.apps}
          msg={msg}
        />
      </div>
    </>
  );
}
