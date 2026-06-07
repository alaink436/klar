"use client";

// Klar Control · Antworten — interactive mail-client (client component).
//
// Three regions, shadcn-mail style: resizable thread list | conversation |
// docked composer. Shows per influencer: when they replied (relative + exact
// on hover), which app(s) they were contacted for, an inline DE-translate per
// inbound message, and the reply number ("3. Antwort"). Reply + translate go
// async (no reload) against the existing /admin/outreach endpoints; accept /
// decline stay as plain form posts (terminal actions, redirect back).
//
// Styling reuses the admin token system (var(--…)); the only RetroUI accents
// are the hard offset-shadow on the Senden button and the reply-count chip,
// dimmed in dark mode so the brutalist tell stays subtle.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import MailerClient from "../mailer/MailerClient";
import type { ReplyLang, ReplyTemplate } from "@/lib/replyTemplates";

export type Direction = "in" | "out";

export interface ThreadMessage {
  id: string;
  direction: Direction;
  subject: string | null;
  body: string;
  at: string | null;
  provider: string | null;
}

export interface Conversation {
  id: string;
  handle: string;
  displayName: string | null;
  platform: string;
  profileUrl: string | null;
  contactEmail: string | null;
  language: string;
  apps: string[];
  status: string;
  followerEstimate: number | null;
  mailsSent: number;
  mailStatus: string | null;
  messages: ThreadMessage[];
  replyCount: number;
  lastInboundAt: string | null;
  lastActivityAt: string | null;
  // true = contacted, no reply yet ("Offene Anfrage"). No real thread; the
  // detail pane shows a "waiting" state and the composer reads "Nachfassen".
  awaiting?: boolean;
  // Source of the conversation. "outreach" = scraped target thread (default,
  // also covers awaiting), "inquiry" = website contact-form request.
  kind?: "outreach" | "inquiry";
  // Present when kind === "inquiry": the website request + approve/decline state.
  inquiry?: InquiryMeta;
}

// Website contact-form request folded into the inbox. Affiliate inquiries carry
// the approve flow (mint onboarding link); consulting inquiries are reply/decline
// only. The approve/decline business logic stays in /admin/approve + /admin/decline.
export interface InquiryMeta {
  inquiryId: string;
  inquiryType: "affiliate" | "consulting" | string;
  status: string; // new | invited | approved | active | declined
  source: string | null;
  name: string | null;
  audience: string | null;
  platforms: string | null;
  why: string | null;
  project: string | null;
  budget: string | null;
  brief: string | null;
  targetApp: string | null;
  approvedApp: string | null;
  approvedCode: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  setupLink: string | null; // precomputed server-side when approved
  // outreach target this inquiry matched (for the reply composer), if any
  matchedTargetId: string | null;
}

export type AppMeta = Record<string, { name: string; icon: string }>;
type TemplatesMap = Record<ReplyLang, ReplyTemplate[]>;

const SCOPED_CSS = `
.kr-root{flex:1;min-height:0;display:flex}
/* Inbox = fixed app-shell: bound the page height so each pane scrolls on its own.
   Without this, no ancestor has a definite height, so the whole PAGE scrolls and
   the thread on the right moves along while you scroll the contact list. */
html,body{overflow:hidden}
.layout{height:100vh;height:100dvh;min-height:0}
.main{min-height:0;overflow:hidden}
.kr-list{display:flex;flex-direction:column;min-height:0;overflow:hidden;border-right:1px solid var(--line)}
.kr-listscroll{flex:1;overflow-y:auto;min-height:0;overscroll-behavior:contain}
.kr-item{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left;padding:13px 16px;border:0;border-bottom:1px solid var(--line);background:transparent;color:inherit;cursor:pointer;font-family:inherit;transition:background .12s ease}
.kr-item:hover{background:var(--surface-2)}
.kr-item.sel{background:var(--surface-2);box-shadow:inset 2px 0 0 0 var(--fg)}
.kr-handle{width:7px;flex-shrink:0;cursor:col-resize;position:relative;background:transparent;touch-action:none}
.kr-handle::after{content:"";position:absolute;top:0;bottom:0;left:3px;width:1px;background:var(--line);transition:background .15s ease,box-shadow .15s ease}
.kr-handle:hover::after,.kr-handle[data-resize-handle-state="hover"]::after,.kr-handle[data-resize-handle-state="drag"]::after{background:var(--fg-3);box-shadow:0 0 0 .5px var(--fg-3)}
.kr-detail{min-width:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.kr-thread{flex:1;overflow-y:auto;min-height:0;overscroll-behavior:contain;padding:22px 26px;display:flex;flex-direction:column;gap:14px}
.kr-bubble{max-width:78%;border-radius:12px;padding:11px 14px;font-size:13.5px;line-height:1.5}
.kr-bubble.in{align-self:flex-start;background:var(--surface-2);border:1px solid var(--line)}
.kr-bubble.out{align-self:flex-end;background:color-mix(in oklab,var(--fg) 9%,var(--surface));border:1px solid var(--line-strong)}
.kr-chip{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.03em;padding:2px 7px;color:var(--fg-2);border:1px solid var(--line-strong);box-shadow:1.5px 1.5px 0 0 var(--line-strong);background:var(--surface);white-space:nowrap}
.kr-badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--fg-2);border:1px solid var(--line);border-radius:999px;padding:2px 9px;white-space:nowrap}
.kr-badge img{width:13px;height:13px;border-radius:4px;object-fit:cover;display:block}
.kr-input{width:100%;padding:9px 12px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body)}
.kr-input:focus{outline:none;border-color:var(--fg);box-shadow:0 0 0 3px color-mix(in oklab,var(--fg) 12%,transparent)}
textarea.kr-input{resize:vertical;line-height:1.5}
.kr-mini{padding:5px 9px;border:1px solid var(--line-strong);border-radius:var(--radius-sm);background:var(--surface);color:var(--fg-2);font-size:11.5px;font-family:var(--font-body);cursor:pointer;transition:background .12s,color .12s,border-color .12s}
.kr-mini:hover{background:var(--surface-2);color:var(--fg);border-color:var(--fg-3)}
.retro-send{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--fg);background:var(--accent);color:var(--accent-fg);font-family:var(--font-body);font-size:13px;font-weight:700;padding:9px 18px;border-radius:var(--radius-sm);cursor:pointer;box-shadow:3px 3px 0 0 var(--fg);transition:transform .08s ease,box-shadow .08s ease}
.retro-send:hover{box-shadow:4px 4px 0 0 var(--fg)}
.retro-send:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--fg)}
.retro-send:disabled{opacity:.45;box-shadow:none;cursor:not-allowed;transform:none}
[data-theme="dark"] .retro-send{box-shadow:3px 3px 0 0 rgba(250,250,250,.30)}
[data-theme="dark"] .retro-send:hover{box-shadow:4px 4px 0 0 rgba(250,250,250,.45)}
[data-theme="dark"] .retro-send:active{box-shadow:0 0 0 0 rgba(250,250,250,0)}
.kr-listscroll::-webkit-scrollbar,.kr-thread::-webkit-scrollbar{width:8px}
.kr-listscroll::-webkit-scrollbar-thumb,.kr-thread::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}
@media(max-width:760px){.kr-handle{display:none}.kr-list{border-right:0;width:100%!important}.kr-detail{width:100%}}
`;

function pickLang(raw: string): ReplyLang {
  const v = (raw || "").toLowerCase().slice(0, 2);
  return v === "en" || v === "es" || v === "it" || v === "fr" ? (v as ReplyLang) : "de";
}
const subst = (s: string, name: string, handle: string): string =>
  s.replace(/\{\{name\}\}/g, name).replace(/\{\{handle\}\}/g, handle);

function rel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) {
    const hrs = Math.floor(diff / 3_600_000);
    if (hrs < 1) {
      const min = Math.floor(diff / 60_000);
      return min <= 1 ? "gerade eben" : `vor ${min} Min`;
    }
    return `vor ${hrs} Std`;
  }
  if (days < 2) return "gestern";
  if (days < 30) return `vor ${days} Tg`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `vor ${mo} Mon`;
  return `vor ${Math.floor(mo / 12)} J`;
}
function abs(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
const platformLabel = (p: string): string =>
  p === "tiktok" ? "TikTok" : p === "instagram" ? "Instagram" : p;
function followerLabel(n: number | null): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function MailClient({
  conversations,
  appMeta,
  appSlugs,
  templates,
  mailer,
}: {
  conversations: Conversation[];
  appMeta: AppMeta;
  appSlugs: string[];
  templates: TemplatesMap;
  mailer: { dueMail1: number; senderEnabled: boolean; cronSet: boolean; inboundSet: boolean };
}) {
  const [convs, setConvs] = useState<Conversation[]>(conversations);
  // Re-seed the list whenever the server hands us fresh data. The conversations
  // prop only gets a new identity when InboxPage re-renders on the server — i.e.
  // after the mailer drawer fires router.refresh() on a live wave send. Without
  // this re-seed the useState above would freeze the list at its mount value, so
  // a sent wave wouldn't surface its new "awaiting" threads until a manual
  // reload. Using the "store previous prop" render pattern (not an effect) keeps
  // it lint-clean and avoids an extra paint. Internal updates (optimistic
  // replies) don't change the prop identity, so they're never clobbered.
  const [seededFrom, setSeededFrom] = useState(conversations);
  if (seededFrom !== conversations) {
    setSeededFrom(conversations);
    setConvs(conversations);
  }
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "inquiry" | "replied" | "converted" | "open">("all");
  const [narrow, setNarrow] = useState(false);
  const [mailerOpen, setMailerOpen] = useState(false);

  // Soft-refresh: re-runs the server component, pulls fresh conversations and
  // re-seeds the list (via the seededFrom guard above) WITHOUT a full reload —
  // selection + scroll stay put. Covers new inbound replies/inquiries that the
  // inbox doesn't poll for, so no more manual F5 after actions.
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  // per inbound-message translation: 'loading' | 'error' | {text,provider}
  const [trans, setTrans] = useState<
    Record<string, "loading" | "error" | { text: string; provider: string }>
  >({});

  const [composer, setComposer] = useState({ subject: "", body: "" });
  const [sending, setSending] = useState(false);
  // Composer height is user-resizable (drag the grip) and remembered across
  // sessions per browser. Owned by the DOM — native textarea resize writes to
  // el.style.height, so we only restore/persist that inline value (no React
  // state → no hydration mismatch, no setState-in-effect lint).
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptApp, setAcceptApp] = useState("");
  const [sendMail, setSendMail] = useState(true);
  const [declineArmed, setDeclineArmed] = useState(false);

  const sel = useMemo(
    () => convs.find((c) => c.id === selectedId) ?? null,
    [convs, selectedId],
  );

  // Watch the narrow breakpoint (mount only). Column widths are persisted by
  // react-resizable-panels itself via autoSaveId.
  useEffect(() => {
    const mq = window.matchMedia("(max-width:760px)");
    const onMq = () => setNarrow(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  // Restore the saved composer height on mount by writing it straight to the
  // DOM node — first client render still matches the server (rows-based), then
  // we adjust, so there's no hydration mismatch.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const saved = Number(localStorage.getItem("klar-composer-h") || "");
    if (saved >= 120 && saved <= 900) el.style.height = `${saved}px`;
  }, []);

  // Persist the height after a drag-resize (native resize already wrote the new
  // value to el.style.height; we just remember it for next time).
  const persistComposerH = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    try {
      localStorage.setItem("klar-composer-h", String(el.offsetHeight));
    } catch {
      /* private mode / quota — non-critical */
    }
  }, []);

  // One-click enlarge/shrink for the composer, on top of the drag-grip. Toggles
  // between a tall editing height (~60vh) and the compact default, persisting
  // the result like a manual drag.
  const [composerBig, setComposerBig] = useState(false);
  const toggleComposerSize = useCallback(() => {
    setComposerBig((big) => {
      const el = composerRef.current;
      if (el) {
        el.style.height = big ? "200px" : `${Math.round(window.innerHeight * 0.6)}px`;
        try {
          localStorage.setItem("klar-composer-h", String(el.offsetHeight));
        } catch {
          /* non-critical */
        }
      }
      return !big;
    });
  }, []);

  const lang = sel ? pickLang(sel.language) : "de";
  const name = sel ? sel.displayName || sel.handle : "";

  // Reset composer + panels when the selection changes.
  useEffect(() => {
    if (!sel) return;
    const tpls = templates[pickLang(sel.language)] ?? templates.de ?? [];
    const def = tpls[0];
    const who = sel.displayName || sel.handle;
    setComposer({
      subject: def ? subst(def.subject, who, sel.handle) : `Re: Klar x ${who}`,
      body: def ? subst(def.body, who, sel.handle) : "",
    });
    setSendMsg(null);
    setAcceptOpen(false);
    setDeclineArmed(false);
    setAcceptApp(sel.apps[0] || appSlugs[0] || "");
    setSendMail(Boolean(sel.contactEmail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return convs.filter((c) => {
      if (filter === "inquiry" && c.kind !== "inquiry") return false;
      if (filter === "replied" && (c.kind === "inquiry" || c.awaiting || c.status !== "replied")) return false;
      if (filter === "converted" && c.status !== "converted") return false;
      if (filter === "open" && !c.awaiting) return false;
      if (!q) return true;
      const hay = `${c.displayName ?? ""} ${c.handle} ${c.messages.map((m) => m.body).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [convs, query, filter]);

  const translateMsg = useCallback(
    async (m: ThreadMessage, srcLang: string) => {
      setTrans((t) => ({ ...t, [m.id]: "loading" }));
      try {
        const text = `${m.subject ? m.subject + "\n\n" : ""}${m.body}`;
        const res = await fetch("/admin/outreach/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, target: "DE", source: srcLang }),
        });
        const j = (await res.json()) as { ok?: boolean; text?: string; provider?: string };
        if (res.ok && j.ok && j.text) {
          setTrans((t) => ({ ...t, [m.id]: { text: j.text as string, provider: j.provider ?? "" } }));
        } else {
          setTrans((t) => ({ ...t, [m.id]: "error" }));
        }
      } catch {
        setTrans((t) => ({ ...t, [m.id]: "error" }));
      }
    },
    [],
  );

  const send = useCallback(async () => {
    if (!sel) return;
    // Outreach threads reply via their target id; inquiries only when matched to
    // a target. Pure website inquiries have no in-app reply channel.
    const replyTargetId = sel.kind === "inquiry" ? sel.inquiry?.matchedTargetId ?? null : sel.id;
    if (!replyTargetId) {
      setSendMsg({ ok: false, text: `Kein In-App-Reply-Kanal — per Mail an ${sel.contactEmail ?? "die Anfrage"} antworten.` });
      return;
    }
    if (!sel.contactEmail) {
      setSendMsg({ ok: false, text: "Keine contact_email hinterlegt — Entwurf manuell kopieren." });
      return;
    }
    if (!composer.subject.trim() || !composer.body.trim()) {
      setSendMsg({ ok: false, text: "Betreff und Nachricht dürfen nicht leer sein." });
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const fd = new URLSearchParams();
      fd.set("id", replyTargetId);
      fd.set("to", sel.contactEmail);
      fd.set("subject", composer.subject);
      fd.set("body", composer.body);
      const res = await fetch("/admin/outreach/reply?json=1", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fd.toString(),
      });
      const j = (await res.json().catch(() => ({ ok: false, msg: "Antwort unlesbar" }))) as {
        ok?: boolean;
        msg?: string;
      };
      if (res.ok && j.ok) {
        const now = new Date().toISOString();
        const newMsg: ThreadMessage = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          direction: "out",
          subject: composer.subject,
          body: composer.body,
          at: now,
          provider: "brevo",
        };
        setConvs((prev) =>
          prev.map((c) =>
            c.id === sel.id ? { ...c, messages: [...c.messages, newMsg], lastActivityAt: now } : c,
          ),
        );
        setSendMsg({ ok: true, text: "Antwort gesendet. Status bleibt „Antwort“, annehmen ist separat." });
      } else {
        setSendMsg({ ok: false, text: j.msg || "Senden fehlgeschlagen." });
      }
    } catch {
      setSendMsg({ ok: false, text: "Netzwerkfehler beim Senden." });
    } finally {
      setSending(false);
    }
  }, [sel, composer]);

  function applyTemplate(id: string) {
    if (!sel) return;
    const tpls = templates[pickLang(sel.language)] ?? templates.de ?? [];
    const t = tpls.find((x) => x.id === id);
    if (!t) return;
    const who = sel.displayName || sel.handle;
    setComposer({ subject: subst(t.subject, who, sel.handle), body: subst(t.body, who, sel.handle) });
  }

  const showList = !narrow || !sel;
  const showDetail = !narrow || !!sel;
  const tpls = sel ? templates[lang] ?? templates.de ?? [] : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <PanelGroup direction="horizontal" className="kr-root" autoSaveId="klar-replies-cols">

      {/* ── Thread list ─────────────────────────────────────────────── */}
      {showList && (
        <Panel id="list" order={1} defaultSize={32} minSize={22} maxSize={52} className="kr-list">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setMailerOpen(true)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 14px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--fg)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Welle mailen{mailer.dueMail1 ? ` · ${mailer.dueMail1} fällig` : ""}
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                title="Liste neu laden (statt F5)"
                aria-label="Aktualisieren"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--fg-2)", fontSize: 15, cursor: refreshing ? "wait" : "pointer", flexShrink: 0 }}
              >
                <span style={{ display: "inline-block", transition: "transform .5s ease", transform: refreshing ? "rotate(360deg)" : "none" }}>↻</span>
              </button>
            </div>
            <input
              className="kr-input"
              placeholder="Suche Name, Handle, Text…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              {(["all", "inquiry", "replied", "open", "converted"] as const).map((f) => (
                <a
                  key={f}
                  className={filter === f ? "on" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Alle" : f === "inquiry" ? "Anfragen" : f === "replied" ? "Antworten" : f === "open" ? "Offen" : "Angenommen"}
                </a>
              ))}
            </div>
          </div>
          <div className="kr-listscroll">
            {visible.length === 0 ? (
              <div className="muted" style={{ padding: "26px 18px", fontSize: 13 }}>
                Keine Konversationen{query ? " für die Suche" : ""}. Sobald jemand auf eine Welle
                antwortet, taucht er hier auf.
              </div>
            ) : (
              visible.map((c) => {
                const lastIn = [...c.messages].reverse().find((m) => m.direction === "in");
                const preview = c.awaiting
                  ? `Kontaktiert${c.mailsSent ? ` · ${c.mailsSent} Mail(s)` : ""} · wartet auf Antwort`
                  : (lastIn?.body || c.messages[c.messages.length - 1]?.body || "").replace(/\s+/g, " ").trim();
                const firstApp = c.apps[0];
                return (
                  <button
                    key={c.id}
                    className={`kr-item${c.id === selectedId ? " sel" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%" }}>
                      <span
                        aria-hidden
                        style={{
                          width: 30,
                          height: 30,
                          flexShrink: 0,
                          borderRadius: 8,
                          background: "var(--surface-3)",
                          border: "1px solid var(--line)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "var(--fg-2)",
                        }}
                      >
                        {(c.displayName || c.handle || "?").charAt(0).toUpperCase()}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.displayName || `@${c.handle}`}
                        {(c.status === "replied" || (c.kind === "inquiry" && c.inquiry?.status === "new")) && (
                          <span title={c.kind === "inquiry" ? "Neue Anfrage" : "Neue Antwort"} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", marginLeft: 7, verticalAlign: "middle", boxShadow: "0 0 0 3px color-mix(in oklab, var(--danger) 22%, transparent)" }} />
                        )}
                        {c.awaiting && (
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", border: "1px solid var(--fg-4)", marginLeft: 7, verticalAlign: "middle" }} />
                        )}
                      </span>
                      <span className="muted" suppressHydrationWarning style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {rel(c.lastInboundAt || c.lastActivityAt)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                      {firstApp && (
                        <span className="kr-badge" style={{ fontSize: 9.5, padding: "1px 7px" }}>
                          {appMeta[firstApp]?.icon && <img src={appMeta[firstApp].icon} alt="" />}
                          {appMeta[firstApp]?.name ?? firstApp}
                          {c.apps.length > 1 ? ` +${c.apps.length - 1}` : ""}
                        </span>
                      )}
                      {c.replyCount > 0 && (
                        <span className="kr-chip" title={`${c.replyCount} Antwort(en)`}>
                          {c.replyCount}. Antw.
                        </span>
                      )}
                    </div>
                    {preview && (
                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.4, width: "100%", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {preview}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Panel>
      )}

      {/* ── Resize handle ───────────────────────────────────────────── */}
      {!narrow && showList && showDetail && <PanelResizeHandle className="kr-handle" />}

      {/* ── Conversation + composer ─────────────────────────────────── */}
      {showDetail && (
        <Panel id="detail" order={2} minSize={45} className="kr-detail">
          {!sel ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--fg-3)", padding: 24, textAlign: "center" }}>
              <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
              </svg>
              <div style={{ fontSize: 14 }}>Wähle links eine Konversation.</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                  {narrow && (
                    <button className="kr-mini" onClick={() => setSelectedId(null)}>← Liste</button>
                  )}
                  <span aria-hidden style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-3)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "var(--fg-2)", flexShrink: 0 }}>
                    {(sel.displayName || sel.handle || "?").charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "var(--fg)" }}>
                        {sel.displayName || `@${sel.handle}`}
                      </span>
                      {sel.profileUrl ? (
                        <a className="applink" href={sel.profileUrl} target="_blank" rel="noopener" style={{ fontSize: 12.5 }}>
                          @{sel.handle}
                        </a>
                      ) : (
                        <span className="muted" style={{ fontSize: 12.5 }}>@{sel.handle}</span>
                      )}
                      <span className="pill" style={{ fontSize: 9, padding: "1px 7px" }}>{platformLabel(sel.platform)}</span>
                      {followerLabel(sel.followerEstimate) && (
                        <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}>{followerLabel(sel.followerEstimate)}</span>
                      )}
                      {sel.status === "converted" && (
                        <span className="pill live" style={{ fontSize: 9, padding: "1px 7px" }}>Angenommen</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                      {sel.apps.map((slug) => (
                        <span key={slug} className="kr-badge">
                          {appMeta[slug]?.icon && <img src={appMeta[slug].icon} alt="" />}
                          {appMeta[slug]?.name ?? slug}
                        </span>
                      ))}
                      {sel.replyCount > 0 && (
                        <span className="kr-chip" title={`${sel.replyCount} eingegangene Antwort(en) von ${name}`}>
                          {sel.replyCount}. Antwort
                        </span>
                      )}
                      <span className="muted" suppressHydrationWarning style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }} title={abs(sel.awaiting ? sel.lastActivityAt : sel.lastInboundAt)}>
                        {sel.kind === "inquiry" ? `Anfrage ${rel(sel.lastInboundAt)}` : sel.awaiting ? `kontaktiert ${rel(sel.lastActivityAt)}` : `antwortete ${rel(sel.lastInboundAt)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions — inquiry (approve/decline) vs outreach (accept/decline) */}
                {sel.kind === "inquiry" && sel.inquiry ? (
                  (() => {
                    const iq = sel.inquiry!;
                    const isAffiliate = iq.inquiryType === "affiliate";
                    if (iq.status === "declined") {
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                          <span className="muted" style={{ fontSize: 12 }}>Abgelehnt{iq.declinedAt ? ` ${rel(iq.declinedAt)}` : ""}{iq.declineReason ? ` · ${iq.declineReason}` : ""}.</span>
                          <form method="POST" action="/admin/decline" style={{ marginLeft: "auto" }}>
                            <input type="hidden" name="inquiry_id" value={iq.inquiryId} />
                            <input type="hidden" name="action" value="reopen" />
                            <button type="submit" className="kr-mini">Wieder öffnen</button>
                          </form>
                        </div>
                      );
                    }
                    if (isAffiliate && iq.setupLink) {
                      return (
                        <div style={{ padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span className="kr-chip">{iq.status === "active" ? "active" : "invited"}{iq.approvedApp ? ` · ${iq.approvedApp}` : ""}</span>
                            <a className="applink" href={iq.setupLink} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-mono)", fontSize: 11, wordBreak: "break-all", flex: 1, minWidth: 200 }}>{iq.setupLink}</a>
                            <button type="button" className="kr-mini" onClick={(e) => { navigator.clipboard?.writeText(iq.setupLink!); (e.currentTarget as HTMLButtonElement).textContent = "✓ kopiert"; }}>Copy</button>
                          </div>
                          {iq.approvedAt && <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>Approved {rel(iq.approvedAt)}</div>}
                        </div>
                      );
                    }
                    return (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {isAffiliate && (
                            <button className="kr-mini" onClick={() => { setAcceptOpen((v) => !v); setDeclineArmed(false); }} style={{ borderColor: "var(--line-strong)" }}>Approve · Onboarding-Link</button>
                          )}
                          {!declineArmed ? (
                            <button className="kr-mini" onClick={() => { setDeclineArmed(true); setAcceptOpen(false); }}>Ablehnen</button>
                          ) : (
                            <form method="POST" action="/admin/decline" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <input type="hidden" name="inquiry_id" value={iq.inquiryId} />
                              <input type="hidden" name="action" value="decline" />
                              <span className="muted" style={{ fontSize: 11.5 }}>Sicher?</span>
                              <button type="submit" className="kr-mini" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Ja, ablehnen</button>
                              <button type="button" className="kr-mini" onClick={() => setDeclineArmed(false)}>Abbrechen</button>
                            </form>
                          )}
                          {!isAffiliate && sel.contactEmail && (
                            <span className="muted" style={{ fontSize: 11, fontStyle: "italic", marginLeft: "auto" }}>Antwort per Mail an {sel.contactEmail}</span>
                          )}
                        </div>
                        {isAffiliate && acceptOpen && (
                          <form method="POST" action="/admin/approve" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                            <input type="hidden" name="inquiry_id" value={iq.inquiryId} />
                            <input type="hidden" name="email" value={sel.contactEmail ?? ""} />
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>App
                              <select name="app" required className="kr-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} defaultValue={iq.targetApp ?? ""}>
                                <option value="" disabled>— wählen —</option>
                                {appSlugs.map((a) => <option key={a} value={a}>{appMeta[a]?.name ?? a}</option>)}
                              </select>
                            </label>
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>Handle
                              <input type="text" name="handle" required defaultValue={sel.handle} className="kr-input" style={{ width: 120, padding: "5px 8px", fontSize: 12 }} />
                            </label>
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>Display
                              <input type="text" name="display_name" defaultValue={sel.displayName ?? ""} className="kr-input" style={{ width: 140, padding: "5px 8px", fontSize: 12 }} />
                            </label>
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>Lang
                              <select name="language" className="kr-input" style={{ width: 64, padding: "5px 8px", fontSize: 12 }} defaultValue={pickLang(sel.language)}>
                                <option value="de">DE</option><option value="en">EN</option><option value="fr">FR</option><option value="es">ES</option><option value="it">IT</option>
                              </select>
                            </label>
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>Share %
                              <input type="number" name="share_pct" min={1} max={100} defaultValue={50} className="kr-input" style={{ width: 64, padding: "5px 8px", fontSize: 12 }} />
                            </label>
                            <label style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 3 }}>Monate
                              <input type="number" name="share_months" min={1} max={60} defaultValue={24} className="kr-input" style={{ width: 64, padding: "5px 8px", fontSize: 12 }} />
                            </label>
                            <button type="submit" className="kr-mini" style={{ borderColor: "var(--fg)", color: "var(--fg)", fontWeight: 600 }}>Onboarding-Link →</button>
                          </form>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button className="kr-mini" onClick={() => { setAcceptOpen((v) => !v); setDeclineArmed(false); }} style={{ borderColor: "var(--line-strong)" }}>
                        {sel.status === "converted" ? "Erneut annehmen" : "Als Affiliate annehmen"}
                      </button>
                      {!declineArmed ? (
                        <button className="kr-mini" onClick={() => { setDeclineArmed(true); setAcceptOpen(false); }}>Ablehnen</button>
                      ) : (
                        <form method="POST" action="/admin/outreach/decline" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input type="hidden" name="id" value={sel.id} />
                          <input type="hidden" name="suppress" value="1" />
                          <span className="muted" style={{ fontSize: 11.5 }}>Sicher?</span>
                          <button type="submit" className="kr-mini" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>Ja, ablehnen</button>
                          <button type="button" className="kr-mini" onClick={() => setDeclineArmed(false)}>Abbrechen</button>
                        </form>
                      )}
                      <span className="muted" style={{ fontSize: 11, fontStyle: "italic", marginLeft: "auto" }}>
                        Antwort heisst nicht angenommen.
                      </span>
                    </div>
                    {acceptOpen && (
                      <form method="POST" action="/admin/outreach/accept" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                        <input type="hidden" name="id" value={sel.id} />
                        <input type="hidden" name="handle" value={sel.handle} />
                        <input type="hidden" name="email" value={sel.contactEmail ?? ""} />
                        <input type="hidden" name="display_name" value={sel.displayName ?? ""} />
                        <input type="hidden" name="language" value={pickLang(sel.language)} />
                        <input type="hidden" name="share_pct" value="50" />
                        <input type="hidden" name="share_months" value="24" />
                        <label style={{ fontSize: 11.5, color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                          App
                          <select name="app" className="kr-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} value={acceptApp} onChange={(e) => setAcceptApp(e.target.value)}>
                            {(sel.apps.length > 0 ? sel.apps : appSlugs).map((a) => (
                              <option key={a} value={a}>{appMeta[a]?.name ?? a}</option>
                            ))}
                          </select>
                        </label>
                        {sel.contactEmail && (
                          <label style={{ fontSize: 11.5, color: "var(--fg-2)", display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                            <input type="checkbox" name="send_mail" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
                            Onboarding-Mail senden
                          </label>
                        )}
                        <button type="submit" className="kr-mini" style={{ borderColor: "var(--fg)", color: "var(--fg)", fontWeight: 600 }}>Annehmen bestätigen</button>
                        <span className="muted" style={{ fontSize: 11 }}>50% · 24 Mte{sel.contactEmail ? "" : " · keine Email hinterlegt"}</span>
                      </form>
                    )}
                  </>
                )}
              </div>

              {/* Thread */}
              <div className="kr-thread">
                {sel.messages.length === 0 ? (
                  <div className="muted" style={{ margin: "auto", textAlign: "center", maxWidth: 380, fontSize: 13, lineHeight: 1.6 }}>
                    Noch keine Antwort. Kontaktiert {rel(sel.lastActivityAt)}
                    {sel.mailsSent ? ` · ${sel.mailsSent} Mail(s) gesendet` : ""}. Sobald {name} antwortet,
                    erscheint der volle Thread hier mit Übersetzen-Funktion. Unten kannst du nachfassen.
                  </div>
                ) : (
                  sel.messages.map((m, i) => {
                  const tr = trans[m.id];
                  const isIn = m.direction === "in";
                  const inboundNo = isIn ? sel.messages.slice(0, i + 1).filter((x) => x.direction === "in").length : 0;
                  const label = isIn
                    ? `${inboundNo}. Antwort`
                    : m.provider === "brevo-mail1"
                      ? "Mail 1 · Erstkontakt"
                      : "Du";
                  return (
                    <div key={m.id} className={`kr-bubble ${isIn ? "in" : "out"}`}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: isIn ? "var(--warning)" : "var(--fg-3)" }}>
                          {label}
                        </span>
                        <span className="muted" suppressHydrationWarning style={{ fontSize: 10.5, fontFamily: "var(--font-mono)" }} title={abs(m.at)}>
                          {rel(m.at)}
                        </span>
                        {m.provider === "legacy" && (
                          <span className="muted" style={{ fontSize: 9.5, fontStyle: "italic" }}>importiert</span>
                        )}
                      </div>
                      {m.subject && (
                        <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 5, color: "var(--fg)" }}>{m.subject}</div>
                      )}
                      <div style={{ whiteSpace: "pre-wrap", color: "var(--fg)" }}>{m.body}</div>
                      {isIn && (
                        <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
                          {!tr || tr === "error" ? (
                            <button className="kr-mini" onClick={() => translateMsg(m, pickLang(sel.language))}>
                              {tr === "error" ? "Nochmal übersetzen" : "DE übersetzen"}
                            </button>
                          ) : tr === "loading" ? (
                            <span className="muted" style={{ fontSize: 11.5 }}>übersetze…</span>
                          ) : (
                            <div>
                              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--fg-2)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}>
                                {tr.text}
                              </div>
                              <button className="kr-mini" style={{ marginTop: 6 }} onClick={() => setTrans((t) => { const n = { ...t }; delete n[m.id]; return n; })}>
                                Original zeigen
                              </button>
                              <span className="muted" style={{ fontSize: 10.5, marginLeft: 8 }}>übersetzt via {tr.provider || "auto"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })
                )}
              </div>

              {/* Composer */}
              <div style={{ borderTop: "1px solid var(--line)", padding: "14px 24px", display: "flex", flexDirection: "column", gap: 9, background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
                    An: {sel.contactEmail || "— keine Email"}
                  </span>
                  <label style={{ fontSize: 11.5, color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                    Vorlage
                    <select className="kr-input" style={{ width: "auto", padding: "5px 8px", fontSize: 12 }} defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}>
                      <option value="" disabled>wählen…</option>
                      {tpls.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <input
                  className="kr-input"
                  value={composer.subject}
                  maxLength={300}
                  placeholder="Betreff"
                  onChange={(e) => setComposer((c) => ({ ...c, subject: e.target.value }))}
                />
                <textarea
                  ref={composerRef}
                  className="kr-input"
                  rows={10}
                  maxLength={8000}
                  value={composer.body}
                  placeholder="Antwort schreiben…"
                  style={{ minHeight: 180, maxHeight: "60vh" }}
                  onChange={(e) => setComposer((c) => ({ ...c, body: e.target.value }))}
                  onMouseUp={persistComposerH}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button className="retro-send" onClick={send} disabled={sending || !sel.contactEmail}>
                    {sending ? "Sende…" : sel.awaiting ? "Nachfassen" : "Senden"}
                  </button>
                  <button
                    className="kr-mini"
                    onClick={() => { navigator.clipboard?.writeText(`${composer.subject}\n\n${composer.body}`); }}
                  >
                    Entwurf kopieren
                  </button>
                  <button
                    className="kr-mini"
                    onClick={toggleComposerSize}
                    title="Schreibfeld vergrössern / verkleinern (oder unten rechts ziehen)"
                  >
                    {composerBig ? "↙ Kleiner" : "↗ Grösser"}
                  </button>
                  {sendMsg && (
                    <span style={{ fontSize: 12, color: sendMsg.ok ? "var(--success)" : "var(--danger)" }}>
                      {sendMsg.text}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </Panel>
      )}
      </PanelGroup>
      {mailerOpen && (
        <div
          onClick={() => setMailerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "min(600px,100%)", height: "100%", background: "var(--bg)", borderLeft: "1px solid var(--line-strong)", overflowY: "auto", padding: "20px 26px" }}
          >
            <button type="button" className="kr-mini" onClick={() => setMailerOpen(false)} style={{ position: "absolute", top: 16, right: 22 }}>Schließen</button>
            <MailerClient
              dueMail1={mailer.dueMail1}
              senderEnabled={mailer.senderEnabled}
              cronSet={mailer.cronSet}
              inboundSet={mailer.inboundSet}
            />
          </div>
        </div>
      )}
    </>
  );
}
