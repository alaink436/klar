"use client";

// Klar Control · Antworten — interactive mail-client (client component).
//
// Three regions, shadcn-mail style: resizable thread list | conversation |
// docked composer. Shows per conversation: when they wrote (relative + exact
// on hover), which app(s) it is about, an inline DE-translate per inbound
// message, and the reply number ("3. Antwort"). Reply + translate go async
// (no reload).
//
// Styling reuses the admin token system (var(--…)); the only RetroUI accents
// are the hard offset-shadow on the Senden button and the reply-count chip,
// dimmed in dark mode so the brutalist tell stays subtle.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TemplateManager from "./TemplateManager";
import type { ReplyLang, ReplyTemplate } from "@/lib/replyTemplates";
import type { InboxFilter } from "./inboxFilters";

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
  contactEmail: string | null;
  language: string;
  apps: string[];
  status: string;
  messages: ThreadMessage[];
  replyCount: number;
  lastInboundAt: string | null;
  lastActivityAt: string | null;
  // Source of the conversation. "inquiry" = website contact-form request,
  // "collab" = mail to a public per-app address (TikTok-Bio).
  kind?: "inquiry" | "collab";
  // Admin star (klar_inbox_stars). Toggled optimistically in the client.
  starred?: boolean;
  // Present when kind === "inquiry": the website request.
  inquiry?: InquiryMeta;
  // Present when kind === "collab": which public mailbox der Thread gehört.
  // `channel` unterscheidet Mail-Threads von den seit 2026-08-18 möglichen,
  // von Hand erfassten DM-Gesprächen — aus denen heraus nichts gesendet wird.
  collab?: {
    app: string;
    alias: string;
    address: string | null;
    channel?: string;
    channelLabel?: string;
    handle?: string | null;
  };
}

// Website contact-form request folded into the inbox. Answered by mail.
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
/* Filter chips wrap instead of overflowing — the list panel can be as narrow
   as ~25% of the viewport even on desktop, where one chip row never fits. */
.kr-list .seg{display:flex;flex-wrap:wrap;row-gap:4px}
@media(max-width:760px){
  .kr-handle{display:none}
  .kr-list{border-right:0;width:100%!important}
  .kr-detail{width:100%}
  /* Tighter chrome on phones: less padding everywhere, bubbles use almost the
     full width, header + composer shrink so the thread keeps the space. */
  .kr-header{padding:10px 12px!important}
  .kr-thread{padding:12px 10px;gap:11px}
  .kr-bubble{max-width:94%}
  .kr-composer{padding:10px 12px!important}
  .kr-composer textarea.kr-input{min-height:120px!important}
  .kr-item{padding:11px 12px}
}
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

export default function MailClient({
  conversations,
  appMeta,
  templates,
  initialFilter,
  initialSelId,
}: {
  conversations: Conversation[];
  appMeta: AppMeta;
  templates: TemplatesMap;
  /** Deep-Link-Support (?f= / ?sel= auf /admin/inbox): Startfilter + vorselektierte
   *  Konversation. Nur Startwerte, danach übernimmt der Client-State wie bisher. */
  initialFilter?: InboxFilter;
  initialSelId?: string;
}) {
  const [convs, setConvs] = useState<Conversation[]>(conversations);
  // Re-seed the list whenever the server hands us fresh data. The conversations
  // prop only gets a new identity when InboxPage re-renders on the server, i.e.
  // after router.refresh(). Without this re-seed the useState above would freeze
  // the list at its mount value until a manual reload. Using the "store
  // previous prop" render pattern (not an effect) keeps
  // it lint-clean and avoids an extra paint. Internal updates (optimistic
  // replies) don't change the prop identity, so they're never clobbered.
  const [seededFrom, setSeededFrom] = useState(conversations);
  if (seededFrom !== conversations) {
    setSeededFrom(conversations);
    setConvs(conversations);
  }
  // Reply templates kept in state so the in-inbox manager can mutate them live
  // (its edits push a rebuilt map here). Re-seed when the server hands us a new
  // prop identity (e.g. after router.refresh()), same pattern as conversations.
  const [tplMap, setTplMap] = useState(templates);
  const [tplSeededFrom, setTplSeededFrom] = useState(templates);
  if (tplSeededFrom !== templates) {
    setTplSeededFrom(templates);
    setTplMap(templates);
  }
  const [tplOpen, setTplOpen] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelId && conversations.some((c) => c.id === initialSelId)
      ? initialSelId
      : conversations[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>(initialFilter ?? "all");
  const [narrow, setNarrow] = useState(false);

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
  // Composer starts collapsed; the admin clicks the bar to open it (per request).
  const [composerOpen, setComposerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  // Composer height is user-resizable (drag the grip) and remembered across
  // sessions per browser. Owned by the DOM — native textarea resize writes to
  // el.style.height, so we only restore/persist that inline value (no React
  // state → no hydration mismatch, no setState-in-effect lint).
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    const who = sel.displayName || sel.handle;
    // Default to an empty draft — no template auto-applied. Picking one from the
    // dropdown is opt-in; the subject still gets a neutral reply default so the
    // message stays sendable without typing one. Collab-Threads antworten auf
    // den Betreff der eingegangenen Mail ("Re: …") statt mit dem Default.
    const lastIn = [...sel.messages].reverse().find((m) => m.direction === "in");
    const collabSubject = lastIn?.subject
      ? /^re:/i.test(lastIn.subject.trim())
        ? lastIn.subject.trim()
        : `Re: ${lastIn.subject.trim()}`
      : `Re: Collab ${who}`;
    setComposer({ subject: sel.kind === "collab" ? collabSubject : `Re: Klar x ${who}`, body: "" });
    setComposerOpen(false);
    setSendMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Toggle the star on a conversation: optimistic flip, revert on error.
  const toggleStar = useCallback(
    async (id: string) => {
      const cur = convs.find((c) => c.id === id);
      if (!cur) return;
      const next = !cur.starred;
      setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, starred: next } : c)));
      try {
        const res = await fetch("/admin/inbox/star", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, on: next }),
        });
        const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean };
        if (!res.ok || !j.ok) throw new Error("star failed");
      } catch {
        setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, starred: !next } : c)));
      }
    },
    [convs],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return convs.filter((c) => {
      if (filter === "starred" && !c.starred) return false;
      if (filter === "inquiry" && c.kind !== "inquiry") return false;
      if (filter === "collab" && c.kind !== "collab") return false;
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
        const res = await fetch("/admin/inbox/translate", {
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
    // Collab-Postfach: Antwort geht per Brevo über /admin/collab/reply raus,
    // replyTo = die Alias-Adresse, damit die Gegenantwort im Thread bleibt.
    if (sel.kind === "collab") {
      if (!sel.collab || !sel.contactEmail) {
        setSendMsg({ ok: false, text: "Collab-Postfach unvollständig — kein Empfänger." });
        return;
      }
      // Von Hand erfasste DM-Gespräche haben keine Mailadresse; hier zu senden
      // wäre bestenfalls ein Fehler von der Route zurück.
      if (sel.collab.channel && sel.collab.channel !== "email") {
        setSendMsg({
          ok: false,
          text: `Dieser Thread lief über ${sel.collab.channelLabel ?? sel.collab.channel}. Antworte dort und trage die Antwort unter Collabs von Hand nach.`,
        });
        return;
      }
      if (!composer.subject.trim() || !composer.body.trim()) {
        setSendMsg({ ok: false, text: "Betreff und Nachricht dürfen nicht leer sein." });
        return;
      }
      const sentSubject = composer.subject;
      const sentBody = composer.body;
      const now = new Date().toISOString();
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ThreadMessage = { id: localId, direction: "out", subject: sentSubject, body: sentBody, at: now, provider: "brevo" };
      setConvs((prev) =>
        prev.map((c) => (c.id === sel.id ? { ...c, messages: [...c.messages, optimistic], lastActivityAt: now } : c)),
      );
      setComposer((c) => ({ ...c, body: "" }));
      setSending(true);
      setSendMsg(null);
      try {
        const fd = new URLSearchParams();
        fd.set("app", sel.collab.app);
        fd.set("alias", sel.collab.alias);
        fd.set("to", sel.contactEmail);
        fd.set("subject", sentSubject);
        fd.set("body", sentBody);
        const res = await fetch("/admin/collab/reply?json=1", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: fd.toString(),
        });
        const j = (await res.json().catch(() => ({ ok: false, msg: "Antwort unlesbar" }))) as { ok?: boolean; msg?: string };
        if (res.ok && j.ok) {
          setSendMsg({ ok: true, text: j.msg || "Antwort gesendet." });
        } else {
          setConvs((prev) =>
            prev.map((c) => (c.id === sel.id ? { ...c, messages: c.messages.filter((m) => m.id !== localId) } : c)),
          );
          setComposer((c) => ({ ...c, body: sentBody }));
          setSendMsg({ ok: false, text: j.msg || "Senden fehlgeschlagen." });
        }
      } catch {
        setConvs((prev) =>
          prev.map((c) => (c.id === sel.id ? { ...c, messages: c.messages.filter((m) => m.id !== localId) } : c)),
        );
        setComposer((c) => ({ ...c, body: sentBody }));
        setSendMsg({ ok: false, text: "Netzwerkfehler beim Senden." });
      } finally {
        setSending(false);
      }
      return;
    }
    // Website-Anfragen haben keinen In-App-Antwortkanal.
    setSendMsg({ ok: false, text: `Kein In-App-Reply-Kanal: per Mail an ${sel.contactEmail ?? "die Anfrage"} antworten.` });
  }, [sel, composer]);

  function applyTemplate(id: string) {
    if (!sel) return;
    const who = sel.displayName || sel.handle;
    const list = tplMap[pickLang(sel.language)] ?? tplMap.de ?? [];
    const t = list.find((x) => x.id === id);
    if (!t) return;
    setComposer({ subject: subst(t.subject, who, sel.handle), body: subst(t.body, who, sel.handle) });
  }

  const showList = !narrow || !sel;
  const showDetail = !narrow || !!sel;
  const tpls = sel ? tplMap[lang] ?? tplMap.de ?? [] : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <PanelGroup direction="horizontal" className="kr-root" autoSaveId="klar-replies-cols">

      {/* ── Thread list ─────────────────────────────────────────────── */}
      {showList && (
        <Panel id="list" order={1} defaultSize={32} minSize={22} maxSize={52} className="kr-list">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="kr-input"
                placeholder="Suche Name, Handle, Text…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
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
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              {(["all", "starred", "inquiry", "collab"] as const).map((f) => (
                <a
                  key={f}
                  className={filter === f ? "on" : ""}
                  style={{ cursor: "pointer" }}
                  title={f === "starred" ? "Nur mit Stern markierte" : f === "collab" ? "Mails an die öffentlichen App-Adressen (TikTok-Bio)" : undefined}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Alle" : f === "starred" ? "★" : f === "inquiry" ? "Anfragen" : "Collabs"}
                </a>
              ))}
            </div>
          </div>
          <div className="kr-listscroll">
            {visible.length === 0 ? (
              <div className="muted" style={{ padding: "26px 18px", fontSize: 13 }}>
                Keine Konversationen{query ? " für die Suche" : ""}.
              </div>
            ) : (
              visible.map((c) => {
                const lastIn = [...c.messages].reverse().find((m) => m.direction === "in");
                const preview = (lastIn?.body || c.messages[c.messages.length - 1]?.body || "").replace(/\s+/g, " ").trim();
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
                        {c.messages[c.messages.length - 1]?.direction === "in" && (
                          <span title={c.kind === "inquiry" ? "Unbeantwortete Anfrage" : "Unbeantwortet"} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", marginLeft: 7, verticalAlign: "middle", boxShadow: "0 0 0 3px color-mix(in oklab, var(--danger) 22%, transparent)" }} />
                        )}
                      </span>
                      <span className="muted" suppressHydrationWarning style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {rel(c.lastInboundAt || c.lastActivityAt)}
                      </span>
                      <span
                        role="button"
                        aria-label={c.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        title={c.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        onClick={(e) => { e.stopPropagation(); void toggleStar(c.id); }}
                        style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, cursor: "pointer", color: c.starred ? "var(--warning)" : "var(--fg-4)", padding: "0 1px" }}
                      >
                        {c.starred ? "★" : "☆"}
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
              <div className="kr-header" style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
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
                      <span
                        role="button"
                        aria-label={sel.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        title={sel.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        onClick={() => void toggleStar(sel.id)}
                        style={{ fontSize: 17, lineHeight: 1, cursor: "pointer", color: sel.starred ? "var(--warning)" : "var(--fg-4)" }}
                      >
                        {sel.starred ? "★" : "☆"}
                      </span>
                      <span className="muted" style={{ fontSize: 12.5 }}>@{sel.handle}</span>
                      <span className="pill" style={{ fontSize: 9, padding: "1px 7px" }}>{platformLabel(sel.platform)}</span>
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
                      <span className="muted" suppressHydrationWarning style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }} title={abs(sel.lastInboundAt)}>
                        {sel.kind === "inquiry" || sel.kind === "collab" ? `Anfrage ${rel(sel.lastInboundAt)}` : `antwortete ${rel(sel.lastInboundAt)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Context: collab mailbox, or the mail address of an inquiry */}
                {sel.kind === "collab" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                    <span className="kr-chip">
                      {sel.collab?.channel && sel.collab.channel !== "email" ? "Collab-Gespräch" : "Collab-Anfrage"}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {sel.collab?.channel && sel.collab.channel !== "email"
                        ? `Lief über ${sel.collab.channelLabel ?? sel.collab.channel}${sel.collab.handle ? ` mit @${sel.collab.handle}` : ""} und wurde von Hand erfasst. Gesendet wird hier nichts — antworte in der App und trage es unter Collabs nach.`
                        : `Eingegangen über ${sel.collab?.address ?? "die öffentliche App-Adresse"} — deine Antwort geht per Mail raus und läuft über dieselbe Adresse zurück in diesen Thread.`}
                    </span>
                  </div>
                ) : sel.kind === "inquiry" && sel.contactEmail ? (
                  <span className="muted" style={{ fontSize: 11, fontStyle: "italic" }}>Antwort per Mail an {sel.contactEmail}</span>
                ) : null}
              </div>

              {/* Thread */}
              <div className="kr-thread">
                {sel.messages.length === 0 ? (
                  <div className="muted" style={{ margin: "auto", textAlign: "center", maxWidth: 380, fontSize: 13, lineHeight: 1.6 }}>
                    Noch keine Nachrichten.
                  </div>
                ) : (
                  sel.messages.map((m, i) => {
                  const tr = trans[m.id];
                  const isIn = m.direction === "in";
                  const inboundNo = isIn ? sel.messages.slice(0, i + 1).filter((x) => x.direction === "in").length : 0;
                  const label = isIn ? `${inboundNo}. Antwort` : "Du";
                  return (
                    <div key={m.id} className={`kr-bubble ${isIn ? "in" : "out"}`}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: isIn ? "var(--warning)" : "var(--fg-3)" }}>
                          {label}
                        </span>
                        <span className="muted" suppressHydrationWarning style={{ fontSize: 10.5, fontFamily: "var(--font-mono)" }} title={abs(m.at)}>
                          {rel(m.at)}
                        </span>
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

              {/* Composer — collapsed to a click-bar until opened */}
              <div className="kr-composer" style={{ borderTop: "1px solid var(--line)", padding: "14px 24px", display: "flex", flexDirection: "column", gap: 9, background: "var(--surface)" }}>
                {!composerOpen ? (
                  <button
                    type="button"
                    onClick={() => { setComposerOpen(true); requestAnimationFrame(() => composerRef.current?.focus()); }}
                    style={{ width: "100%", textAlign: "left", padding: "11px 14px", border: "1px solid var(--line-strong)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg-3)", fontFamily: "var(--font-body)", fontSize: 13.5, cursor: "text" }}
                  >
                    Antworten…
                  </button>
                ) : (
                  <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)" }}>
                    An:{" "}
                    {sel.collab?.channel && sel.collab.channel !== "email"
                      ? `${sel.collab.channelLabel ?? sel.collab.channel} — kein Mailversand`
                      : sel.contactEmail || "— keine Email"}
                  </span>
                  <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 11.5, color: "var(--fg-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      Vorlage
                      <select
                        className="kr-input"
                        style={{ width: "auto", padding: "5px 8px", fontSize: 12 }}
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__none") setComposer((c) => ({ ...c, body: "" }));
                          else if (v) applyTemplate(v);
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>einsetzen…</option>
                        <option value="__none">— keine (Feld leeren) —</option>
                        {tpls.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="kr-mini" onClick={() => setTplOpen(true)} title="Vorlagen verwalten">
                      Vorlagen ✎
                    </button>
                    <button
                      type="button"
                      className="kr-mini"
                      onClick={() => setComposerOpen(false)}
                      title="Schreibfeld einklappen (Entwurf bleibt erhalten)"
                      aria-label="Schreibfeld einklappen"
                    >
                      ✕
                    </button>
                  </div>
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
                  <button
                    className="retro-send"
                    onClick={send}
                    disabled={
                      sending ||
                      !sel.contactEmail ||
                      Boolean(sel.collab?.channel && sel.collab.channel !== "email")
                    }
                  >
                    {sending ? "Sende…" : "Senden"}
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
                  </>
                )}
              </div>
            </>
          )}
        </Panel>
      )}
      </PanelGroup>
      {tplOpen && (
        <div
          onClick={() => setTplOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "min(640px,100%)", height: "100%", background: "var(--bg)", borderLeft: "1px solid var(--line-strong)", overflowY: "auto" }}
          >
            <TemplateManager
              lang={lang}
              baseMap={tplMap}
              onClose={() => setTplOpen(false)}
              onMapChange={(m) => setTplMap(m)}
            />
          </div>
        </div>
      )}
    </>
  );
}
