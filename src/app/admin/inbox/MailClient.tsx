"use client";

// Klar Control · Antworten — interactive mail-client (client component).
//
// Three regions, shadcn-mail style: resizable thread list | conversation |
// docked composer. Shows per conversation: when they wrote (relative + exact
// on hover), which app(s) it is about, an inline DE-translate per inbound
// message, and the reply number ("3. Antwort"). Reply + translate go async
// (no reload).
//
// Since the 2026-10-08 redesign (ticket 02) it is built from the shared
// building blocks only: pills for every button, marks for apps and counts, a
// muted dot for "unanswered", messages as `.klar-blase`, fields as
// `.klar-feld`. The frame (fixed height, panes that scroll on their own) lives
// in admin/admin.css as `.klar-postfach-*`; until then it was a STYLE string
// here with its own RetroUI send button.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  ArrowLeft,
  Copy,
  Inbox,
  Languages,
  Maximize2,
  Minimize2,
  PencilLine,
  RotateCw,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

// Phones (max 760px, same breakpoint as `narrow` below) get tighter chrome:
// less padding everywhere, messages use almost the full width, header and
// composer shrink so the thread keeps the space (the `max-[760px]:` classes).

/** Ton fuer `.klar-punkt` (Status-Punkt, Farbe nur dort). */
const ton = (v: string) => ({ "--ton": v }) as React.CSSProperties;

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
      <PanelGroup direction="horizontal" className="klar-postfach" autoSaveId="klar-replies-cols">

      {/* ── Thread list ─────────────────────────────────────────────── */}
      {showList && (
        <Panel id="list" order={1} defaultSize={32} minSize={22} maxSize={52} className="klar-postfach-liste">
          <div className="flex flex-col gap-2.5 border-b px-4 py-3.5">
            <div className="flex gap-2">
              <input
                className="klar-feld rounded-full px-3.5"
                placeholder="Suche Name, Handle, Text…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                type="button"
                variant="pill-dark"
                size="icon"
                className={cn("size-9 shrink-0", refreshing && "cursor-wait")}
                onClick={refresh}
                disabled={refreshing}
                title="Liste neu laden (statt F5)"
                aria-label="Aktualisieren"
              >
                <RotateCw className={cn("transition-transform duration-500", refreshing && "rotate-[360deg]")} />
              </Button>
            </div>
            {/* Wraps instead of overflowing: the list panel can be as narrow as
                ~22% of the viewport even on desktop. */}
            <div className="klar-segment self-start">
              {(["all", "starred", "inquiry", "collab"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  aria-label={f === "starred" ? "Mit Stern" : undefined}
                  title={f === "starred" ? "Nur mit Stern markierte" : f === "collab" ? "Mails an die öffentlichen App-Adressen (TikTok-Bio)" : undefined}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Alle" : f === "starred" ? <Star /> : f === "inquiry" ? "Anfragen" : "Collabs"}
                </button>
              ))}
            </div>
          </div>
          <div className="klar-postfach-scroll">
            {visible.length === 0 ? (
              <div className="px-[18px] py-[26px] text-[13px] text-fg-3">
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
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-[7px] border-b px-4 py-[13px] text-left transition-colors hover:bg-white/[.03] max-[760px]:px-3 max-[760px]:py-[11px]",
                      c.id === selectedId && "bg-white/[.045] shadow-[inset_2px_0_0_0_var(--fg)] hover:bg-white/[.045]",
                    )}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex w-full items-center gap-[9px]">
                      <span aria-hidden className="klar-kachel size-[30px] text-[13px] font-semibold">
                        {(c.displayName || c.handle || "?").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
                        {c.displayName || `@${c.handle}`}
                        {c.messages[c.messages.length - 1]?.direction === "in" && (
                          <span
                            title={c.kind === "inquiry" ? "Unbeantwortete Anfrage" : "Unbeantwortet"}
                            className="klar-punkt ml-2 inline-block align-middle"
                            style={ton("var(--danger)")}
                          />
                        )}
                      </span>
                      <span suppressHydrationWarning className="whitespace-nowrap text-[10.5px] text-fg-4 [font-family:var(--font-mono)]">
                        {rel(c.lastInboundAt || c.lastActivityAt)}
                      </span>
                      <span
                        role="button"
                        aria-label={c.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        title={c.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        onClick={(e) => { e.stopPropagation(); void toggleStar(c.id); }}
                        className={cn("shrink-0 cursor-pointer px-px leading-none", c.starred ? "text-fg" : "text-fg-4 hover:text-fg-2")}
                      >
                        <Star className={cn("size-3.5", c.starred && "fill-current")} />
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-1.5">
                      {firstApp && (
                        <Badge className="h-5 gap-[5px] px-2 text-[10.5px]">
                          {appMeta[firstApp]?.icon && <img src={appMeta[firstApp].icon} alt="" className="size-3.5 rounded-[4px] object-cover" />}
                          {appMeta[firstApp]?.name ?? firstApp}
                          {c.apps.length > 1 ? ` +${c.apps.length - 1}` : ""}
                        </Badge>
                      )}
                      {c.replyCount > 0 && (
                        <Badge className="h-5 px-2 text-[10.5px] [font-family:var(--font-mono)]" title={`${c.replyCount} Antwort(en)`}>
                          {c.replyCount}. Antw.
                        </Badge>
                      )}
                    </div>
                    {preview && (
                      <div className="line-clamp-2 w-full text-[12px] leading-[1.4] text-fg-3">
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
      {!narrow && showList && showDetail && <PanelResizeHandle className="klar-postfach-griff" />}

      {/* ── Conversation + composer ─────────────────────────────────── */}
      {showDetail && (
        <Panel id="detail" order={2} minSize={45} className="klar-postfach-detail">
          {!sel ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-fg-3">
              <span className="klar-kachel size-12">
                <Inbox className="size-5" />
              </span>
              <div className="text-[14px]">Wähle links eine Konversation.</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col gap-2.5 border-b px-6 py-4 max-[760px]:px-3 max-[760px]:py-2.5">
                <div className="flex flex-wrap items-center gap-[11px]">
                  {narrow && (
                    <Button variant="pill-dark" size="sm" className="h-7 px-3 text-[12px]" onClick={() => setSelectedId(null)}>
                      <ArrowLeft />
                      Liste
                    </Button>
                  )}
                  <span aria-hidden className="klar-kachel size-[38px] text-[16px] font-semibold">
                    {(sel.displayName || sel.handle || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-[9px] gap-y-1">
                      <span className="text-[19px] font-medium leading-tight tracking-[-0.015em] text-fg">
                        {sel.displayName || `@${sel.handle}`}
                      </span>
                      <span
                        role="button"
                        aria-label={sel.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        title={sel.starred ? "Stern entfernen" : "Mit Stern markieren"}
                        onClick={() => void toggleStar(sel.id)}
                        className={cn("cursor-pointer leading-none", sel.starred ? "text-fg" : "text-fg-4 hover:text-fg-2")}
                      >
                        <Star className={cn("size-4", sel.starred && "fill-current")} />
                      </span>
                      <span className="text-[12.5px] text-fg-3">@{sel.handle}</span>
                      {sel.platform ? <Badge className="h-5 px-2 text-[10.5px]">{platformLabel(sel.platform)}</Badge> : null}
                    </div>
                    <div className="mt-[7px] flex flex-wrap items-center gap-2">
                      {sel.apps.map((slug) => (
                        <Badge key={slug} className="gap-[5px]">
                          {appMeta[slug]?.icon && <img src={appMeta[slug].icon} alt="" className="size-3.5 rounded-[4px] object-cover" />}
                          {appMeta[slug]?.name ?? slug}
                        </Badge>
                      ))}
                      {sel.replyCount > 0 && (
                        <Badge className="[font-family:var(--font-mono)] text-[11px]" title={`${sel.replyCount} eingegangene Antwort(en) von ${name}`}>
                          {sel.replyCount}. Antwort
                        </Badge>
                      )}
                      <span suppressHydrationWarning className="text-[11.5px] text-fg-3 [font-family:var(--font-mono)]" title={abs(sel.lastInboundAt)}>
                        {sel.kind === "inquiry" || sel.kind === "collab" ? `Anfrage ${rel(sel.lastInboundAt)}` : `antwortete ${rel(sel.lastInboundAt)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Context: collab mailbox, or the mail address of an inquiry */}
                {sel.kind === "collab" ? (
                  <div className="klar-einschub flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-1.5">
                    <Badge>
                      {sel.collab?.channel && sel.collab.channel !== "email" ? "Collab-Gespräch" : "Collab-Anfrage"}
                    </Badge>
                    <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-fg-3">
                      {sel.collab?.channel && sel.collab.channel !== "email"
                        ? `Lief über ${sel.collab.channelLabel ?? sel.collab.channel}${sel.collab.handle ? ` mit @${sel.collab.handle}` : ""} und wurde von Hand erfasst. Gesendet wird hier nichts: antworte in der App und trage es unter Collabs nach.`
                        : `Eingegangen über ${sel.collab?.address ?? "die öffentliche App-Adresse"}. Deine Antwort geht per Mail raus und läuft über dieselbe Adresse zurück in diesen Thread.`}
                    </span>
                  </div>
                ) : sel.kind === "inquiry" && sel.contactEmail ? (
                  <span className="text-[11.5px] text-fg-3">Antwort per Mail an {sel.contactEmail}</span>
                ) : null}
              </div>

              {/* Thread */}
              <div className="klar-postfach-scroll flex flex-col gap-3.5 px-[26px] py-[22px] max-[760px]:gap-[11px] max-[760px]:px-2.5 max-[760px]:py-3">
                {sel.messages.length === 0 ? (
                  <div className="m-auto max-w-[380px] text-center text-[13px] leading-relaxed text-fg-3">
                    Noch keine Nachrichten.
                  </div>
                ) : (
                  sel.messages.map((m, i) => {
                  const tr = trans[m.id];
                  const isIn = m.direction === "in";
                  const inboundNo = isIn ? sel.messages.slice(0, i + 1).filter((x) => x.direction === "in").length : 0;
                  const label = isIn ? `${inboundNo}. Antwort` : "Du";
                  return (
                    <div
                      key={m.id}
                      data-richtung={isIn ? "ein" : "aus"}
                      className={cn("klar-blase max-w-[78%] max-[760px]:max-w-[94%]", isIn ? "self-start" : "self-end")}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className={cn("text-[9.5px] font-semibold uppercase tracking-[0.1em] [font-family:var(--font-mono)]", isIn ? "text-fg-2" : "text-fg-3")}>
                          {label}
                        </span>
                        <span suppressHydrationWarning className="text-[10.5px] text-fg-4 [font-family:var(--font-mono)]" title={abs(m.at)}>
                          {rel(m.at)}
                        </span>
                      </div>
                      {m.subject && (
                        <div className="mb-[5px] text-[12.5px] font-semibold text-fg">{m.subject}</div>
                      )}
                      <div className="whitespace-pre-wrap text-fg">{m.body}</div>
                      {isIn && (
                        <div className="mt-2.5 border-t border-dashed pt-2.5">
                          {!tr || tr === "error" ? (
                            <Button variant="pill-dark" size="sm" className="h-7 px-3 text-[11.5px]" onClick={() => translateMsg(m, pickLang(sel.language))}>
                              <Languages />
                              {tr === "error" ? "Nochmal übersetzen" : "DE übersetzen"}
                            </Button>
                          ) : tr === "loading" ? (
                            <span className="text-[11.5px] text-fg-3">übersetze…</span>
                          ) : (
                            <div>
                              <div className="klar-einschub whitespace-pre-wrap px-2.5 py-2 text-[13px] text-fg-2">
                                {tr.text}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button variant="pill-dark" size="sm" className="h-7 px-3 text-[11.5px]" onClick={() => setTrans((t) => { const n = { ...t }; delete n[m.id]; return n; })}>
                                  Original zeigen
                                </Button>
                                <span className="text-[10.5px] text-fg-4">übersetzt via {tr.provider || "auto"}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })
                )}
              </div>

              {/* Composer, collapsed to a click-bar until opened */}
              <div className="flex flex-col gap-[9px] border-t bg-black/40 px-6 py-3.5 max-[760px]:px-3 max-[760px]:py-2.5">
                {!composerOpen ? (
                  <button
                    type="button"
                    onClick={() => { setComposerOpen(true); requestAnimationFrame(() => composerRef.current?.focus()); }}
                    className="klar-feld cursor-text px-3.5 py-[11px] text-left text-[13.5px] text-fg-3"
                  >
                    Antworten…
                  </button>
                ) : (
                  <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[11.5px] text-fg-3 [font-family:var(--font-mono)]">
                    An:{" "}
                    {sel.collab?.channel && sel.collab.channel !== "email"
                      ? `${sel.collab.channelLabel ?? sel.collab.channel}, kein Mailversand`
                      : sel.contactEmail || "keine Email"}
                  </span>
                  <div className="ml-auto inline-flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-[5px] text-[11.5px] text-fg-3">
                      Vorlage
                      <select
                        className="klar-feld w-auto px-2 py-[5px] text-[12px]"
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__none") setComposer((c) => ({ ...c, body: "" }));
                          else if (v) applyTemplate(v);
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>einsetzen…</option>
                        <option value="__none">keine (Feld leeren)</option>
                        {tpls.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <Button type="button" variant="pill-dark" size="sm" className="h-7 px-3 text-[12px]" onClick={() => setTplOpen(true)} title="Vorlagen verwalten">
                      <PencilLine />
                      Vorlagen
                    </Button>
                    <Button
                      type="button"
                      variant="pill-dark"
                      size="icon"
                      className="size-7"
                      onClick={() => setComposerOpen(false)}
                      title="Schreibfeld einklappen (Entwurf bleibt erhalten)"
                      aria-label="Schreibfeld einklappen"
                    >
                      <X />
                    </Button>
                  </div>
                </div>
                <input
                  className="klar-feld"
                  value={composer.subject}
                  maxLength={300}
                  placeholder="Betreff"
                  onChange={(e) => setComposer((c) => ({ ...c, subject: e.target.value }))}
                />
                <textarea
                  ref={composerRef}
                  className="klar-feld leading-normal max-[760px]:min-h-[120px]!"
                  rows={10}
                  maxLength={8000}
                  value={composer.body}
                  placeholder="Antwort schreiben…"
                  style={{ minHeight: 180, maxHeight: "60vh" }}
                  onChange={(e) => setComposer((c) => ({ ...c, body: e.target.value }))}
                  onMouseUp={persistComposerH}
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="pill"
                    className="h-9 px-5"
                    onClick={send}
                    disabled={
                      sending ||
                      !sel.contactEmail ||
                      Boolean(sel.collab?.channel && sel.collab.channel !== "email")
                    }
                  >
                    {sending ? "Sende…" : "Senden"}
                  </Button>
                  <Button
                    variant="pill-dark"
                    size="sm"
                    onClick={() => { navigator.clipboard?.writeText(`${composer.subject}\n\n${composer.body}`); }}
                  >
                    <Copy />
                    Entwurf kopieren
                  </Button>
                  <Button
                    variant="pill-dark"
                    size="sm"
                    onClick={toggleComposerSize}
                    title="Schreibfeld vergrössern / verkleinern (oder unten rechts ziehen)"
                  >
                    {composerBig ? <Minimize2 /> : <Maximize2 />}
                    {composerBig ? "Kleiner" : "Grösser"}
                  </Button>
                  {sendMsg && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-fg-2">
                      <span className="klar-punkt" style={ton(sendMsg.ok ? "var(--success)" : "var(--danger)")} />
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
      {/* Lade fuer die Vorlagen: Grund nur abgedunkelt wie beim Dialog, die
          Lade selbst ist eine Karte, die von rechts hereinsteht. */}
      {tplOpen && (
        <div onClick={() => setTplOpen(false)} className="fixed inset-0 z-[60] flex justify-end bg-black/65">
          <div
            onClick={(e) => e.stopPropagation()}
            className="klar-karte h-full w-[min(640px,100%)] rounded-none rounded-l-[var(--radius-lg)]"
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
