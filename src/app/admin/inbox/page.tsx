// Klar Control · Inbox, the one mailbox. Folds website contact-form requests
// (klar_inquiries) and collab threads into a single Conversation[] and mounts
// the <MailClient/> (list · thread · composer). Outreach threads, the Mailer,
// affiliate chats and the approve / decline flow are gone since 2026-10-07.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (+ optional KLAR_INBOX_SUPABASE_URL).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  readCookieFromString,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { KLAR_APPS } from "../../../lib/klarApps";
import { getReplyTemplates } from "../../../lib/replyTemplateStore";
import { listStarredIds } from "../../../lib/inboxStars";
import { listCollabThreads, COLLAB_ALIASES, COLLAB_CHANNEL_LABELS } from "../../../lib/collabStore";
import MailClient, {
  type Conversation,
  type ThreadMessage,
  type AppMeta,
  type InquiryMeta,
} from "./MailClient";
// Value-import aus einem eigenen Nicht-Client-Modul — NICHT aus MailClient:
// Client-Modul-Exports erreichen Server-Komponenten nur als Referenz-Proxies
// (Laufzeit-TypeError bei .includes), tsc/build merken davon nichts.
import { INBOX_FILTERS, type InboxFilter } from "./inboxFilters";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface Inquiry {
  id?: string;
  created_at?: string;
  type?: string;
  email?: string;
  status?: string;
  handle?: string;
  audience?: string;
  platforms?: string;
  why?: string;
  name?: string;
  project?: string;
  budget?: string;
  brief?: string;
  source?: string;
  target_app?: string;
}

const isTestInquiry = (r: Inquiry): boolean => {
  const email = (r.email ?? "").toLowerCase();
  const handle = (r.handle ?? "").toLowerCase();
  if (email === "alainkessler04@gmail.com") return true;
  if (handle.includes("selftest") || handle === "klar_test" || handle === "@bombo") return true;
  return false;
};

// Compose the request body shown as the first inbound bubble of an inquiry.
function inquiryBody(r: Inquiry): string {
  const lines: string[] = [];
  if (r.type === "affiliate") {
    if (r.audience) lines.push(`Reichweite: ${r.audience}`);
    if (r.platforms) lines.push(`Plattformen: ${r.platforms}`);
    if (r.target_app) lines.push(`Wunsch-App: ${r.target_app}`);
    if (r.why) lines.push("", r.why);
  } else {
    if (r.project) lines.push(`Projekt: ${r.project}`);
    if (r.budget) lines.push(`Budget: ${r.budget}`);
    if (r.brief) lines.push("", r.brief);
  }
  return lines.join("\n").trim() || "(keine Details angegeben)";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; f?: string; sel?: string }>;
}) {
  const sp = await searchParams;
  const flashMsg = (sp.msg ?? "").slice(0, 300);
  // Deep-Link: ?f= Startfilter, ?sel= Konversation.
  const initialFilter: InboxFilter | undefined = (INBOX_FILTERS as readonly string[]).includes(sp.f ?? "")
    ? (sp.f as InboxFilter)
    : undefined;
  const initialSelId = (sp.sel ?? "").slice(0, 200) || undefined;
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const appMeta: AppMeta = {};
  for (const a of KLAR_APPS) appMeta[a.slug] = { name: a.name, icon: a.icon };
  // Collab-Postfächer können Apps abdecken, die KLAR_APPS nicht kennt —
  // Namen aus der Alias-Map nachtragen, damit ihre Badges nicht als Slug rendern.
  for (const meta of Object.values(COLLAB_ALIASES)) {
    if (!appMeta[meta.app]) appMeta[meta.app] = { name: meta.name, icon: "" };
  }

  // ── Inquiry side: website contact-form requests ──────────────────────────
  let inquiryConvs: Conversation[] = [];
  if (KLAR_INBOX_KEY) {
    try {
      const res = await fetch(
        `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=*&order=created_at.desc&limit=200`,
        {
          headers: { apikey: KLAR_INBOX_KEY, Authorization: `Bearer ${KLAR_INBOX_KEY}`, Accept: "application/json" },
          cache: "no-store",
        },
      );
      const rowsAll: Inquiry[] = res.ok ? ((await res.json()) as Inquiry[]) : [];
      inquiryConvs = rowsAll
        .filter((r) => !isTestInquiry(r))
        .filter((r): r is Inquiry & { id: string } => Boolean(r.id))
        .map((r): Conversation => {
          const at = r.created_at ?? null;
          const messages: ThreadMessage[] = [
            { id: `${r.id}-req`, direction: "in", subject: null, body: inquiryBody(r), at, provider: "form" },
          ];
          const meta: InquiryMeta = {
            inquiryId: r.id,
            inquiryType: r.type ?? "consulting",
            status: r.status ?? "new",
            source: r.source ?? null,
            name: r.name ?? null,
            audience: r.audience ?? null,
            platforms: r.platforms ?? null,
            why: r.why ?? null,
            project: r.project ?? null,
            budget: r.budget ?? null,
            brief: r.brief ?? null,
          };
          return {
            id: `inq-${r.id}`,
            handle: (r.handle ?? "").replace(/^@/, "") || (r.email ?? "").split("@")[0] || "anfrage",
            displayName: r.name || r.handle || null,
            platform: "",
            profileUrl: null,
            contactEmail: r.email ?? null,
            language: "de",
            apps: r.target_app ? [r.target_app] : [],
            status: r.status ?? "new",
            messages,
            replyCount: messages.filter((m) => m.direction === "in").length,
            lastInboundAt: at,
            lastActivityAt: at,
            kind: "inquiry",
            inquiry: meta,
          };
        });
    } catch {
      inquiryConvs = [];
    }
  }

  // ── Collab side: mail to the public per-app addresses (TikTok-Bio) ───────
  const collabThreads = await listCollabThreads();
  const collabConvs: Conversation[] = collabThreads.map((t): Conversation => {
    const messages: ThreadMessage[] = t.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject,
      body: m.body,
      at: m.sent_at || m.created_at,
      provider: m.provider,
    }));
    const inbound = messages.filter((m) => m.direction === "in");
    return {
      id: `collab:${t.app}:${t.contactEmail}`,
      handle: t.contactHandle || t.contactEmail.split("@")[0] || t.contactEmail,
      displayName: t.contactName,
      // DM-Threads tragen ihre Plattform, Mail-Threads wie bisher nichts.
      platform: t.channel === "email" ? "" : t.channel,
      profileUrl: null,
      contactEmail: t.contactEmail,
      // Die Adressen stehen auf englischsprachigen App-Kanälen — Vorlagen
      // defaulten auf EN, umstellen geht im Composer-Dropdown.
      language: "en",
      apps: [t.app],
      status: "new",
      messages,
      replyCount: inbound.length,
      lastInboundAt: inbound.length > 0 ? inbound[inbound.length - 1].at : null,
      lastActivityAt: t.lastActivityAt,
      kind: "collab",
      collab: {
        app: t.app,
        alias: t.alias,
        address: t.address,
        channel: t.channel,
        channelLabel: COLLAB_CHANNEL_LABELS[t.channel] ?? t.channel,
        handle: t.contactHandle,
      },
    };
  });

  const starredIds = await listStarredIds();
  const conversations: Conversation[] = [...inquiryConvs, ...collabConvs]
    .sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""))
    .map((c) => (starredIds.has(c.id) ? { ...c, starred: true } : c));

  // Reply templates for the composer: DB-editable (klar_reply_templates) with a
  // fallback to the hardcoded set so the dropdown is never empty.
  const replyTemplates = await getReplyTemplates();

  return (
    <>
      <title>Inbox · Klar Control</title>
      <AdminTopbar titel="Inbox" />
      {flashMsg && <div className="flash" style={{ margin: "12px 36px 0" }}>{flashMsg}</div>}
      <MailClient
        conversations={conversations}
        appMeta={appMeta}
        templates={replyTemplates}
        initialFilter={initialFilter}
        initialSelId={initialSelId}
      />
    </>
  );
}
