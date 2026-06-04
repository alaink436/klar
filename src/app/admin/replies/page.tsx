// Klar Control · Antworten — the influencer-reply mail-client.
//
// Server component: same 2FA/device gate as the rest of /admin. Loads the
// outreach targets that are part of a conversation (replied/converted or with a
// stored last_message), pulls their full message thread from
// klar_outreach_messages, folds both into Conversation view-models, then mounts
// the interactive <InboxClient/> (list | thread | composer, resizable).
//
// Threads come from the inbound webhook (/api/inbound/brevo) + the admin reply
// route. Targets that predate the messages table get one synthesized inbound
// bubble from last_message so the thread is never empty. Reply-count is the
// number of inbound messages.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ KLAR_INBOX_* for
//      the outreach store).

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
import {
  listOutreachTargets,
  listMessagesForTargets,
  type OutreachMessage,
} from "../../../lib/outreachStore";
import { KLAR_APPS } from "../../../lib/klarApps";
import { REPLY_TEMPLATES } from "../../../lib/replyTemplates";
import InboxClient, {
  type Conversation,
  type ThreadMessage,
  type AppMeta,
} from "./InboxClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RepliesPage() {
  // Auth — identical gate to overview/brain/cal (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const apps = getApps();

  // Conversations = targets that have replied/converted or carry a last_message.
  const targets = await listOutreachTargets({ status: "all", limit: 300 });
  const candidates = targets.filter(
    (t) =>
      (t.last_message && t.last_message.trim()) ||
      t.status === "replied" ||
      t.status === "converted",
  );

  // One query for every thread, grouped by target.
  const rows = await listMessagesForTargets(candidates.map((t) => t.id));
  const byTarget = new Map<string, OutreachMessage[]>();
  for (const m of rows) {
    const arr = byTarget.get(m.target_id);
    if (arr) arr.push(m);
    else byTarget.set(m.target_id, [m]);
  }

  const conversations: Conversation[] = candidates
    .map((t): Conversation => {
      const sorted = (byTarget.get(t.id) ?? [])
        .slice()
        .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      let messages: ThreadMessage[] = sorted.map((r) => ({
        id: r.id,
        direction: r.direction,
        subject: r.subject,
        body: r.body,
        at: r.sent_at || r.created_at,
        provider: r.provider,
      }));
      // Pre-webhook targets: synthesize the known reply so the thread + count
      // are not empty.
      if (messages.length === 0 && t.last_message && t.last_message.trim()) {
        messages = [
          {
            id: `${t.id}-legacy`,
            direction: "in",
            subject: t.reply_subject,
            body: t.last_message,
            at: t.last_message_at || t.replied_at || t.updated_at,
            provider: "legacy",
          },
        ];
      }
      const inbound = messages.filter((m) => m.direction === "in");
      const appSlugs = Array.from(
        new Set(
          [...(t.for_apps ?? []), ...(t.approved_app ? [t.approved_app] : [])].filter(
            (x): x is string => Boolean(x),
          ),
        ),
      );
      const lastActivityAt =
        messages.length > 0
          ? messages[messages.length - 1].at
          : t.last_message_at || t.replied_at || t.updated_at;
      const lastInboundAt =
        inbound.length > 0
          ? inbound[inbound.length - 1].at
          : t.last_message_at || t.replied_at;
      return {
        id: t.id,
        handle: t.handle,
        displayName: t.display_name,
        platform: t.platform,
        profileUrl: t.profile_url,
        contactEmail: t.contact_email,
        language: t.language || "de",
        apps: appSlugs,
        status: t.status,
        followerEstimate: t.follower_estimate,
        mailsSent: t.mails_sent ?? 0,
        mailStatus: t.mail_status,
        messages,
        replyCount: inbound.length,
        lastInboundAt: lastInboundAt ?? null,
        lastActivityAt: lastActivityAt ?? null,
      };
    })
    .sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""));

  const appMeta: AppMeta = {};
  for (const a of KLAR_APPS) appMeta[a.slug] = { name: a.name, icon: a.icon };
  const appSlugs = KLAR_APPS.map((a) => a.slug);

  const sidebar = adminSidebar("replies", apps);
  const topbar = `
    <span class="crumb"><b>Antworten</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Antworten · Klar Control</title>
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
          <InboxClient
            conversations={conversations}
            appMeta={appMeta}
            appSlugs={appSlugs}
            templates={REPLY_TEMPLATES}
          />
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
