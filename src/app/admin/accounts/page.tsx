// Klar Control · Accounts. Every social account with its login and password.
//
// Alain, 2026-10-01: "ein ganz neues Menü, wo man alle Konten eintragen kann,
// mit Passwort und so weiter". Rows come from `social_accounts`
// (lib/socialAccountsStore); passwords are vault secrets, revealed only on a
// click. Blotato is asked live on every load, so "connected" is never a stale
// note: an account is connected when Blotato lists the same platform + handle.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readCookieFromString } from "../_shared";
import { LANG_COOKIE, flashText, normalizeAdminLang, tAdmin } from "../_i18n";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { listAccounts } from "../../../lib/socialAccountsStore";
import { getBlotatoAccounts } from "../../../lib/blotato";
import { APPS } from "../../../lib/socialAccounts";
import { AdminTopbar } from "../AdminTopbar";
import AccountsManager, { type AccountRow } from "./AccountsManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** "basalt (basalt)" and "@Basalt" both become "basalt". */
const norm = (s: string) => s.trim().replace(/^@/, "").split(" (")[0].toLowerCase();

export default async function AccountsPage({
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
  if (!(await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV))) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const lang = normalizeAdminLang(readCookieFromString(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);

  const [stored, live] = await Promise.all([listAccounts(), getBlotatoAccounts()]);
  const liveIds = new Map(live.map((l) => [`${l.platform.toLowerCase()}:${norm(l.username || l.fullname)}`, l.id]));

  const apps = [...APPS.map((a) => ({ key: a.key as string, name: a.name }))];
  for (const s of stored) if (!apps.some((a) => a.key === s.app)) apps.push({ key: s.app, name: s.app });

  const rows: AccountRow[] = stored.map((s) => ({
    id: s.id,
    app: s.app,
    appName: apps.find((a) => a.key === s.app)?.name ?? s.app,
    platform: s.platform,
    handle: s.handle,
    displayName: s.display_name ?? "",
    role: s.role,
    status: s.status,
    loginEmail: s.login_email ?? "",
    passwordSecretId: s.password_secret_id ?? "",
    notes: s.notes ?? "",
    blotatoId: s.handle ? (liveIds.get(`${s.platform}:${norm(s.handle)}`) ?? "") : "",
  }));

  return (
    <>
      <title>{`${t.navAccounts} · Klar Control`}</title>
      <AdminTopbar titel={t.navAccounts} />
      <div className="content">
        <h1>{t.navAccounts}</h1>
        {sp.err && (
          <div
            className="flash"
            style={{ borderColor: "color-mix(in oklab,var(--danger) 35%,var(--line))", color: "var(--danger)" }}
          >
            {flashText(sp.err, lang)}
          </div>
        )}
        {sp.msg && <div className="flash">{flashText(sp.msg, lang)}</div>}
        <AccountsManager rows={rows} apps={apps} lang={lang} />
      </div>
    </>
  );
}
