"use client";

// Client chat panel: renders the thread, sends new messages (optimistic), and
// polls every 8s for Alain's replies. Pure dashboard tokens so it inherits the
// light theme. Inbound (affiliate) bubbles sit right, Alain's replies left.

import { useCallback, useEffect, useRef, useState } from "react";

interface Msg {
  id: string;
  direction: "in" | "out";
  body: string;
  at: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ChatClient({ initial }: { initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/dashboard/api/chat", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; messages?: Array<{ id: string; direction: "in" | "out"; body: string; created_at: string }> };
      if (j.ok && Array.isArray(j.messages)) {
        setMsgs(j.messages.map((m) => ({ id: m.id, direction: m.direction, body: m.body, at: m.created_at })));
      }
    } catch {
      /* keep current view on transient errors */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [msgs.length]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const optimistic: Msg = { id: `local-${Date.now()}`, direction: "in", body, at: new Date().toISOString() };
    setMsgs((m) => [...m, optimistic]);
    setText("");
    try {
      const res = await fetch("/dashboard/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: { id: string; body: string; created_at: string } };
      if (j.ok && j.message) {
        setMsgs((m) => m.map((x) => (x.id === optimistic.id ? { id: j.message!.id, direction: "in", body: j.message!.body, at: j.message!.created_at } : x)));
      } else {
        setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      }
    } catch {
      setMsgs((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }, [text, sending]);

  return (
    <div
      style={{
        maxWidth: 720,
        border: "1px solid color-mix(in oklab, var(--fg), transparent 82%)",
        borderRadius: 14,
        overflow: "hidden",
        background: "color-mix(in oklab, var(--fg), transparent 96%)",
        display: "flex",
        flexDirection: "column",
        height: "min(620px, 70vh)",
      }}
    >
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 12 }}
      >
        {msgs.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 360, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.6 }}>
            No messages yet. Say hi, ask a question, or share what you are planning to post. I will get back to you here.
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.direction === "in";
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 3 }}>
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 13px",
                    borderRadius: 13,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    background: mine
                      ? "var(--fg)"
                      : "color-mix(in oklab, var(--fg), transparent 90%)",
                    color: mine ? "var(--bg)" : "var(--fg)",
                    border: mine ? "none" : "1px solid color-mix(in oklab, var(--fg), transparent 84%)",
                  }}
                >
                  {m.body}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--fg-4)", fontFamily: "var(--font-mono, monospace)", padding: "0 4px" }}>
                  {mine ? "You" : "Alain"} · {timeLabel(m.at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{ borderTop: "1px solid color-mix(in oklab, var(--fg), transparent 86%)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          maxLength={4000}
          style={{
            flex: 1,
            resize: "none",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
            background: "var(--bg)",
            color: "var(--fg)",
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.5,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          style={{
            padding: "11px 18px",
            background: "var(--fg)",
            color: "var(--bg)",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            opacity: sending || !text.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
