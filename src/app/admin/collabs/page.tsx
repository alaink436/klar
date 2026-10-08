// Klar Control · Collabs — eingehende Anfragen an die öffentlichen Bio-Adressen.
//
// Server component, 2FA-gated wie der Rest von /admin. Zeigt die Adressen zum
// Kopieren (TikTok/IG-Bio) und alle Threads aus `klar_collab_messages`.
// Geantwortet wird in der Inbox; jede Zeile deep-linkt dorthin.

import { headers } from "next/headers";
import { MessageSquareDot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminPage } from "../../../lib/adminGuard";
import { readCookie } from "../../../lib/adminSession";
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
  await requireAdminPage();
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";

  const lang = normalizeAdminLang(readCookie(cookieHeader, LANG_COOKIE));
  const t = tAdmin(lang);
  const view = await buildCollabView();
  const msg = (await searchParams).msg?.slice(0, 400);


  return (
    <>
      <title>Collabs · Klar Control</title>
      <AdminTopbar titel={t.navCollabs} />
      <div className="content">
        <PageHeader eyebrow="Klar Studios" icon={<MessageSquareDot />} title={t.navCollabs} />
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
