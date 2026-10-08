// Klar Control · API-Key Vault management view.
//
// Server component (2FA-gated like the rest of /admin). Lists vault keys
// (metadata only — plaintext is never available) and offers add / rotate /
// reveal / delete via the shadcn/ui-based VaultManager. The add + rotate forms
// post the raw key directly to /admin/vault/save, which encrypts it server-side;
// the key never passes through the client beyond the form submit.

import { headers } from "next/headers";
import Link from "next/link";
import { DATE_LOCALE, LANG_COOKIE, flashText, normalizeAdminLang, tAdmin } from "../_i18n";
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
import { datumInZone } from "@/lib/zeit";
import { listSecrets, vaultReady } from "../../../lib/vault";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { TextureCard } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-3">{label}</div>
      <div className="klar-verlauf mt-2.5 text-[40px] font-medium leading-none tracking-[-0.035em] [font-variant-numeric:tabular-nums]">
        <NumberTicker value={value} />
      </div>
    </div>
  );
}

export default async function VaultPage({
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
    lastUsed: datumInZone(s.last_used_at, DATE_LOCALE[lang]),
  }));
  const active = rows.filter((r) => r.lastUsed !== "—").length;

  const ready = vaultReady();

  return (
    <>
      <title>Vault · Klar Control</title>
      <AdminTopbar titel={t.vaultTitle} />
      <div className="content">
        <div className="flex flex-wrap items-start justify-between gap-x-6">
          <PageHeader eyebrow="Klar Control" icon={<LockKeyhole />} title={t.vaultTitle} />
          <Button asChild variant="pill-dark" size="sm" className="mb-8 h-8 px-3.5 text-[12.5px]">
            <Link href="/admin/vault/tiktok">
              {lang === "en" ? "TikTok channels" : "TikTok-Kanäle"}
              <ArrowRight />
            </Link>
          </Button>
        </div>

        {!ready && (
          <Notice tone="warn">
            {t.vaultInactiveA}
            <code>VAULT_MASTER_KEY</code>
            {t.vaultInactiveB}
          </Notice>
        )}
        {sp.err && <Notice tone="danger">{flashText(sp.err, lang)}</Notice>}
        {sp.msg && <Notice tone="ok">{flashText(sp.msg, lang)}</Notice>}

        {/* Zwei Zahlen und der Zustand des Vaults. */}
        <TextureCard className="mb-8 flex flex-wrap items-center justify-between gap-6 px-6 py-5">
          <div className="flex items-end gap-10">
            <Stat label={t.statStored} value={rows.length} />
            <Stat label={t.statActive} value={active} />
          </div>
          <Badge tone={ready ? "ok" : "warn"} dot>
            {ready ? t.badgeActive : t.badgeInactive}
          </Badge>
        </TextureCard>

        <VaultManager rows={rows} lang={lang} />
      </div>
    </>
  );
}
