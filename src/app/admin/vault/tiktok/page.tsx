// Klar Control · Vault · TikTok channels.
//
// Every TikTok channel with its username, bound e-mail and password on one
// page (Alain, 2026-09-29). Username and e-mail render in clear; the password
// is sealed with the vault master key and only fetched through
// /admin/vault/tiktok/reveal on click. Same 2FA gate as /admin/vault.

import { headers } from "next/headers";
import Link from "next/link";
import { readCookieFromString } from "../../_shared";
import { DATE_LOCALE, LANG_COOKIE, flashText, normalizeAdminLang } from "../../_i18n";
import { requireAdminPage } from "../../../../lib/adminGuard";
import { datumInZone } from "@/lib/zeit";
import { vaultReady } from "../../../../lib/vault";
import { listTiktokAccounts } from "../../../../lib/tiktokAccounts";
import TiktokManager, { type TiktokRow } from "./TiktokManager";
import { AdminTopbar } from "../../AdminTopbar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TITLE = { de: "TikTok-Kanäle", en: "TikTok channels" } as const;
const BACK = { de: "← Vault", en: "← Vault" } as const;
const FLASH_EXTRA: Record<string, { de: string; en: string }> = {
  "tiktok-missing": { de: "Kanal und Benutzername sind Pflicht.", en: "Channel and username are required." },
};

export default async function TiktokPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireAdminPage();
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";

  const sp = await searchParams;
  const lang = normalizeAdminLang(readCookieFromString(cookieHeader, LANG_COOKIE));
  const flash = (code: string) => FLASH_EXTRA[code]?.[lang] ?? flashText(code, lang);
  const accounts = await listTiktokAccounts();
  const rows: TiktokRow[] = accounts.map((a) => ({
    id: a.id,
    channel: a.channel,
    username: a.username,
    email: a.email ?? "",
    note: a.note ?? "",
    hasPassword: a.hasPassword,
    updated: datumInZone(a.updated_at, DATE_LOCALE[lang]),
  }));

  return (
    <>
      <title>{`${TITLE[lang]} · Klar Control`}</title>
      <AdminTopbar titel={TITLE[lang]} />
      <div className="content">
        <Link href="/admin/vault" className="text-[13px] text-fg-3 hover:text-fg no-underline">
          {BACK[lang]}
        </Link>
        <h1>{TITLE[lang]}</h1>

        {!vaultReady() && (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--warning) 35%,var(--line))", color: "var(--warning)" }}>
            <code>VAULT_MASTER_KEY</code> fehlt in Vercel — Passwörter lassen sich weder speichern noch anzeigen.
          </div>
        )}
        {sp.err && (
          <div className="flash" style={{ borderColor: "color-mix(in oklab,var(--danger) 35%,var(--line))", color: "var(--danger)" }}>
            {flash(sp.err)}
          </div>
        )}
        {sp.msg && <div className="flash">{flash(sp.msg)}</div>}

        <TiktokManager rows={rows} lang={lang} />
      </div>
    </>
  );
}
