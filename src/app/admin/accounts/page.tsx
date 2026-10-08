// Klar Control · Accounts. Every social account with its login and password.
//
// Alain, 2026-10-01: "ein ganz neues Menü, wo man alle Konten eintragen kann,
// mit Passwort und so weiter". Rows come from `social_accounts`
// (lib/socialAccountsStore); passwords are vault secrets, revealed only on a
// click. Blotato is asked live on every load, so "connected" is never a stale
// note: an account is connected when Blotato lists the same platform + handle.

import { headers } from "next/headers";
import { AtSign } from "lucide-react";
import { LANG_COOKIE, flashText, normalizeAdminLang, tAdmin } from "../_i18n";
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
import { listAccounts } from "../../../lib/socialAccountsStore";
import { getBlotatoAccounts } from "../../../lib/blotato";
import { APPS } from "../../../lib/socialAccounts";
import { AdminTopbar } from "../AdminTopbar";
import { PageHeader } from "@/components/ui/page-header";
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
  await requireAdminPage();
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";

  const sp = await searchParams;
  const lang = normalizeAdminLang(readCookie(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);

  const [stored, live] = await Promise.all([listAccounts(), getBlotatoAccounts()]);
  const liveIds = new Map(live.map((l) => [`${l.platform.toLowerCase()}:${norm(l.username || l.fullname)}`, l.id]));
  const liveIdSet = new Set(live.map((l) => l.id));

  // Only apps that still have accounts: a deleted app must not come back as a
  // choice. Names come from lib/socialAccounts where known, else the key itself.
  const apps: { key: string; name: string }[] = [];
  for (const s of stored) {
    if (apps.some((a) => a.key === s.app)) continue;
    apps.push({ key: s.app, name: APPS.find((a) => a.key === s.app)?.name ?? s.app });
  }

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
    // A pinned id wins while Blotato still lists it (a renamed account keeps its
    // id but Blotato shows the old username); otherwise match by handle.
    blotatoId:
      s.blotato_id && liveIdSet.has(s.blotato_id)
        ? s.blotato_id
        : s.handle
          ? (liveIds.get(`${s.platform}:${norm(s.handle)}`) ?? "")
          : "",
    pinnedBlotatoId: s.blotato_id ?? "",
  }));

  return (
    <>
      <title>{`${t.navAccounts} · Klar Control`}</title>
      <AdminTopbar titel={t.navAccounts} />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<AtSign />} title={t.navAccounts} />
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
