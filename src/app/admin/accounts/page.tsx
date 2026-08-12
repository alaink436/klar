// Klar Control · Account-Landkarte.
//
// Server component, same 2FA gate as the rest of /admin (device cookie + admin
// session). Renders the social-account landscape as a React Flow graph — the
// same mechanics the AI-Brain viewer runs on.
//
// Why a curated list instead of reading Blotato alone: Blotato only knows the
// accounts that were connected to it. The private niche accounts post by hand
// and would be invisible — which is exactly the blind spot this page exists to
// close. So `ACCOUNTS` is the source of truth for *which* accounts exist, and
// Blotato is asked only whether the pipeline can currently post to each one.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readCookieFromString } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getBlotatoOverview } from "@/lib/blotato";
import { ACCOUNTS, reconcile } from "@/lib/socialAccounts";
import { PageHeader } from "@/components/ui/page-header";
import AccountBoard from "@/app/components/accounts/AccountBoard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountsPage() {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  // Best-effort: a Blotato outage must not blank the page, it just means the
  // connection flags fall back to what the file says.
  let live: { id: string; platform: string; username: string }[] = [];
  let liveOk = false;
  try {
    const overview = await getBlotatoOverview();
    if (overview.ok) {
      live = overview.accounts;
      liveOk = true;
    }
  } catch {
    /* fall through — curated list stands on its own */
  }

  const accounts = reconcile(ACCOUNTS, live);

  return (
    <>
      <PageHeader eyebrow="Klar Studios" title="Account-Landkarte">
        Alle Social-Accounts über die fünf Apps: wem sie gehören, wie gross sie sind und ob
        Blotato dorthin posten kann. Follower und Likes sind vom Profil abgelesen, nicht live.
      </PageHeader>

      {!liveOk ? (
        <p className="mb-4 rounded-[var(--radius-sm)] border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[12px] text-amber-700 dark:text-amber-300">
          Blotato antwortet gerade nicht — die Verbindungs-Markierungen zeigen den zuletzt
          notierten Stand, nicht den echten.
        </p>
      ) : null}

      <AccountBoard accounts={accounts} />
    </>
  );
}
