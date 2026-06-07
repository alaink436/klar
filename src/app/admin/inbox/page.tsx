// Klar Control · Inbox — the one mailbox. Folds website contact-form requests
// (klar_inquiries) AND outreach reply threads (klar_outreach_targets/messages)
// into a single Conversation[] and mounts the <MailClient/> (list · thread ·
// composer). The Mailer (send Mail-1) lives as a drawer action in the client.
// Affiliate-approve / decline / outreach-reply logic stays in their existing
// POST routes — the client only renders the forms.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (+ optional KLAR_INBOX_SUPABASE_URL).

import { headers } from "next/headers";
import AdminSidebar from "../AdminSidebar";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  readCookieFromString,} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, setupLandingUrl } from "../../../lib/adminApps";
import {
  listOutreachTargets,
  listMessagesForTargets,
  listTargetsForMail1,
  type OutreachMessage,
  type OutreachTarget,
} from "../../../lib/outreachStore";
import { KLAR_APPS } from "../../../lib/klarApps";
import { getReplyTemplates } from "../../../lib/replyTemplateStore";
import MailClient, {
  type Conversation,
  type ThreadMessage,
  type AppMeta,
  type InquiryMeta,
} from "./MailClient";

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
  approved_app?: string;
  approved_code?: string;
  approved_at?: string;
  target_app?: string;
  declined_at?: string | null;
  decline_reason?: string | null;
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
  searchParams: Promise<{ msg?: string }>;
}) {
  const flashMsg = ((await searchParams).msg ?? "").slice(0, 300);
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
  const appMeta: AppMeta = {};
  for (const a of KLAR_APPS) appMeta[a.slug] = { name: a.name, icon: a.icon };
  const appSlugs = KLAR_APPS.map((a) => a.slug);

  // ── Outreach side: targets + threads + awaiting (same logic as the old
  //    replies route) ───────────────────────────────────────────────────────
  const targets = await listOutreachTargets({ status: "all", limit: 300 });
  const candidates = targets.filter(
    (t) => (t.last_message && t.last_message.trim()) || t.status === "replied" || t.status === "converted",
  );
  const candidateIds = new Set(candidates.map((t) => t.id));
  const TERMINAL = new Set(["replied", "converted", "declined", "dead"]);
  const awaitingTargets = targets
    .filter(
      (t) =>
        !candidateIds.has(t.id) &&
        !TERMINAL.has(t.status) &&
        (t.status === "dm_sent" || t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent"),
    )
    .sort((a, b) => {
      const ax = new Date(a.last_mail_at || a.mail1_sent_at || a.contacted_at || a.updated_at).getTime();
      const bx = new Date(b.last_mail_at || b.mail1_sent_at || b.contacted_at || b.updated_at).getTime();
      return bx - ax;
    })
    .slice(0, 100);

  const rows = await listMessagesForTargets(
    [...candidates, ...awaitingTargets].map((t) => t.id),
  );
  const byTarget = new Map<string, OutreachMessage[]>();
  for (const m of rows) {
    const arr = byTarget.get(m.target_id);
    if (arr) arr.push(m);
    else byTarget.set(m.target_id, [m]);
  }
  const appsOf = (t: OutreachTarget): string[] =>
    Array.from(
      new Set(
        [...(t.for_apps ?? []), ...(t.approved_app ? [t.approved_app] : [])].filter(
          (x): x is string => Boolean(x),
        ),
      ),
    );

  const repliedConvs: Conversation[] = candidates.map((t): Conversation => {
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
    const lastActivityAt =
      messages.length > 0 ? messages[messages.length - 1].at : t.last_message_at || t.replied_at || t.updated_at;
    const lastInboundAt = inbound.length > 0 ? inbound[inbound.length - 1].at : t.last_message_at || t.replied_at;
    return {
      id: t.id,
      handle: t.handle,
      displayName: t.display_name,
      platform: t.platform,
      profileUrl: t.profile_url,
      contactEmail: t.contact_email,
      language: t.language || "de",
      apps: appsOf(t),
      status: t.status,
      followerEstimate: t.follower_estimate,
      mailsSent: t.mails_sent ?? 0,
      mailStatus: t.mail_status,
      messages,
      replyCount: inbound.length,
      lastInboundAt: lastInboundAt ?? null,
      lastActivityAt: lastActivityAt ?? null,
      kind: "outreach",
    };
  });

  const awaitingConvs: Conversation[] = awaitingTargets.map((t): Conversation => {
    // The sent Mail-1 (and any follow-up) is now stored — show it in the thread.
    const msgs: ThreadMessage[] = (byTarget.get(t.id) ?? [])
      .slice()
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
      .map((r) => ({
        id: r.id,
        direction: r.direction,
        subject: r.subject,
        body: r.body,
        at: r.sent_at || r.created_at,
        provider: r.provider,
      }));
    return {
      id: t.id,
      handle: t.handle,
      displayName: t.display_name,
      platform: t.platform,
      profileUrl: t.profile_url,
      contactEmail: t.contact_email,
      language: t.language || "de",
      apps: appsOf(t),
      status: t.status,
      followerEstimate: t.follower_estimate,
      mailsSent: t.mails_sent ?? 0,
      mailStatus: t.mail_status,
      messages: msgs,
      replyCount: 0,
      lastInboundAt: null,
      lastActivityAt: (t.last_mail_at || t.mail1_sent_at || t.contacted_at || t.updated_at) ?? null,
      awaiting: true,
      kind: "outreach",
    };
  });

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
      // match outreach target by email/handle so an inquiry's reply composer can
      // hit /admin/outreach/reply and show the influencer's stored reply.
      const targetByEmail = new Map<string, OutreachTarget>();
      const targetByHandle = new Map<string, OutreachTarget>();
      for (const t of targets) {
        const e = (t.contact_email ?? "").toLowerCase().trim();
        if (e && !targetByEmail.has(e)) targetByEmail.set(e, t);
        const hh = (t.handle ?? "").toLowerCase().replace(/^@/, "").trim();
        if (hh && !targetByHandle.has(hh)) targetByHandle.set(hh, t);
      }
      const matchTarget = (r: Inquiry): OutreachTarget | null => {
        const e = (r.email ?? "").toLowerCase().trim();
        if (e && targetByEmail.has(e)) return targetByEmail.get(e)!;
        const hh = (r.handle ?? "").toLowerCase().replace(/^@/, "").trim();
        if (hh && targetByHandle.has(hh)) return targetByHandle.get(hh)!;
        return null;
      };

      inquiryConvs = rowsAll
        .filter((r) => !isTestInquiry(r))
        .filter((r): r is Inquiry & { id: string } => Boolean(r.id))
        .map((r): Conversation => {
          const t = matchTarget(r);
          const at = r.created_at ?? null;
          const messages: ThreadMessage[] = [
            { id: `${r.id}-req`, direction: "in", subject: null, body: inquiryBody(r), at, provider: "form" },
          ];
          if (t?.last_message && t.last_message.trim()) {
            messages.push({
              id: `${r.id}-reply`,
              direction: "in",
              subject: t.reply_subject,
              body: t.last_message,
              at: t.last_message_at || t.replied_at || at,
              provider: "legacy",
            });
          }
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
            targetApp: r.target_app ?? null,
            approvedApp: r.approved_app ?? null,
            approvedCode: r.approved_code ?? null,
            approvedAt: r.approved_at ?? null,
            declinedAt: r.declined_at ?? null,
            declineReason: r.decline_reason ?? null,
            setupLink:
              r.approved_app && r.approved_code ? setupLandingUrl(r.approved_app, r.approved_code) : null,
            matchedTargetId: t?.id ?? null,
          };
          return {
            id: `inq-${r.id}`,
            handle: (r.handle ?? "").replace(/^@/, "") || (r.email ?? "").split("@")[0] || "anfrage",
            displayName: r.name || r.handle || null,
            platform: t?.platform ?? "",
            profileUrl: t?.profile_url ?? null,
            contactEmail: r.email ?? null,
            language: t?.language || "de",
            apps: r.approved_app ? [r.approved_app] : r.target_app ? [r.target_app] : [],
            status: r.status ?? "new",
            followerEstimate: t?.follower_estimate ?? null,
            mailsSent: t?.mails_sent ?? 0,
            mailStatus: t?.mail_status ?? null,
            messages,
            replyCount: messages.filter((m) => m.direction === "in").length,
            lastInboundAt: at,
            lastActivityAt: r.approved_at || r.declined_at || at,
            kind: "inquiry",
            inquiry: meta,
          };
        });
    } catch {
      inquiryConvs = [];
    }
  }

  // Dedupe: a person who BOTH submitted a website inquiry AND was scraped as an
  // outreach target would otherwise show up twice (the inquiry conv + the
  // outreach thread). Keep the inquiry conv (it carries the approve flow), graft
  // the outreach target's real message thread onto it, and drop the standalone
  // outreach conv.
  const outreachConvs = [...repliedConvs, ...awaitingConvs];
  const outreachById = new Map(outreachConvs.map((c) => [c.id, c]));
  const mergedOutreachIds = new Set<string>();
  for (const iq of inquiryConvs) {
    const tid = iq.inquiry?.matchedTargetId;
    if (!tid) continue;
    const oc = outreachById.get(tid);
    if (!oc) continue;
    mergedOutreachIds.add(tid);
    const realMsgs = oc.messages.filter((m) => m.provider !== "legacy");
    if (realMsgs.length > 0) {
      const requestBubbles = iq.messages.filter((m) => m.provider === "form");
      iq.messages = [...requestBubbles, ...realMsgs].sort((a, b) => (a.at || "").localeCompare(b.at || ""));
      iq.replyCount = realMsgs.filter((m) => m.direction === "in").length;
      iq.lastInboundAt = oc.lastInboundAt ?? iq.lastInboundAt;
      iq.lastActivityAt = oc.lastActivityAt ?? iq.lastActivityAt;
      // Carry the outreach reply state so the red dot + status read correctly.
      if (oc.status === "replied" || oc.status === "converted") iq.status = oc.status;
    }
  }
  const dedupedOutreach = outreachConvs.filter((c) => !mergedOutreachIds.has(c.id));

  const conversations: Conversation[] = [...inquiryConvs, ...dedupedOutreach].sort(
    (a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""),
  );

  // ── Mailer drawer data ───────────────────────────────────────────────────
  const dueMail1 = (await listTargetsForMail1(500)).length;
  // Reply templates for the composer: DB-editable (klar_reply_templates) with a
  // fallback to the hardcoded set so the dropdown is never empty.
  const replyTemplates = await getReplyTemplates();
  const senderEnabled = process.env.KLAR_OUTREACH_SENDER === "on";
  const cronSet = Boolean(process.env.CRON_SECRET);
  const inboundSet = Boolean(process.env.KLAR_INBOUND_DOMAIN);  const topbar = `
    <span class="crumb"><b>Inbox</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Inbox · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <AdminSidebar active={"inbox"} apps={apps} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          {flashMsg && <div className="flash" style={{ margin: "12px 36px 0" }}>{flashMsg}</div>}
          <MailClient
            conversations={conversations}
            appMeta={appMeta}
            appSlugs={appSlugs}
            templates={replyTemplates}
            mailer={{ dueMail1, senderEnabled, cronSet, inboundSet }}
          />
        </main>
      </div>
    </>
  );
}
