"use client";

// In-inbox template manager. Opens as a drawer from the composer so Alain can
// edit the canned replies AND the per-app outreach mails (Mail-1 / Mail-2)
// without leaving the mailbox. Reply CRUD goes against /admin/reply-templates/api,
// the outreach mails against /admin/templates/api (both JSON); every change is
// handed back to MailClient (onMapChange / onAppMailSaved), so the composer
// dropdown reflects edits instantly (no reload). The standalone
// /admin/reply-templates and /admin/templates pages stay for full-screen editing.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReplyLang, ReplyTemplate } from "@/lib/replyTemplates";
import type { AppMailTemplate } from "@/lib/outreachStore";

const LANGS: ReplyLang[] = ["de", "en", "es", "it", "fr"];
const LANG_NAME: Record<ReplyLang, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  it: "Italiano",
  fr: "Français",
};

interface Row {
  id: string;
  language: ReplyLang;
  template_key: string;
  label: string;
  subject: string;
  body: string;
  sort_order: number;
  updated_at: string;
}

type MapT = Record<ReplyLang, ReplyTemplate[]>;

// Rebuild the grouped {lang: ReplyTemplate[]} map MailClient feeds the dropdown.
// A language that ends up with zero DB rows keeps the parent's existing list
// (hardcoded fallback) so the composer never loses its options mid-session.
function rebuild(rows: Row[], base: MapT): MapT {
  const m: MapT = { de: [], en: [], es: [], it: [], fr: [] };
  for (const r of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    (m[r.language] ??= []).push({ id: r.template_key, label: r.label, subject: r.subject, body: r.body });
  }
  for (const l of LANGS) if (m[l].length === 0 && base[l]?.length) m[l] = base[l];
  return m;
}

const card: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  padding: "13px 15px",
  display: "flex",
  flexDirection: "column",
  gap: 9,
};
const lbl: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
  fontFamily: "var(--font-mono)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={lbl}>{label}</span>
      {children}
    </label>
  );
}

function TemplateCard({
  row,
  onSave,
  onDelete,
}: {
  row: Row;
  onSave: (patch: { label: string; subject: string; body: string; sort_order: number }) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const [label, setLabel] = useState(row.label);
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [sort, setSort] = useState(row.sort_order);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  // Re-sync when the underlying row changes identity (e.g. after a save round-trip).
  useEffect(() => {
    setLabel(row.label);
    setSubject(row.subject);
    setBody(row.body);
    setSort(row.sort_order);
  }, [row.id, row.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    label !== row.label || subject !== row.subject || body !== row.body || sort !== row.sort_order;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 5, padding: "1px 7px" }}>
          {row.template_key}
        </span>
        <input
          className="kr-input"
          style={{ flex: 1, padding: "6px 9px", fontSize: 13, fontWeight: 600 }}
          value={label}
          maxLength={120}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="kr-input"
          style={{ width: 56, padding: "6px 8px", fontSize: 12, fontFamily: "var(--font-mono)", textAlign: "center" }}
          type="number"
          min={0}
          max={999}
          value={sort}
          title="Reihenfolge"
          onChange={(e) => setSort(Number(e.target.value) || 0)}
        />
      </div>
      <Field label="Subject">
        <input className="kr-input" style={{ padding: "7px 10px", fontSize: 13 }} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Body · {{name}} / {{handle}}">
        <textarea className="kr-input" style={{ padding: "9px 11px", fontSize: 13, minHeight: 130, resize: "vertical" }} rows={7} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="retro-send"
          style={{ padding: "7px 16px", fontSize: 12.5 }}
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ label, subject, body, sort_order: sort });
            setBusy(false);
          }}
        >
          {busy ? "Speichere…" : dirty ? "Speichern" : "Gespeichert"}
        </button>
        <span style={{ marginLeft: "auto" }} />
        {!armed ? (
          <button className="kr-mini" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => setArmed(true)}>
            Löschen
          </button>
        ) : (
          <>
            <span className="muted" style={{ fontSize: 11.5 }}>Sicher?</span>
            <button
              className="kr-mini"
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              onClick={async () => {
                setBusy(true);
                await onDelete();
              }}
            >
              Ja
            </button>
            <button className="kr-mini" onClick={() => setArmed(false)}>Abbrechen</button>
          </>
        )}
      </div>
    </div>
  );
}

function AddCard({ lang, onAdd }: { lang: ReplyLang; onAdd: (r: { template_key: string; label: string; subject: string; body: string; sort_order: number }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("Re: Klar x {{name}}");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const keyOk = /^[a-z0-9_]+$/i.test(key);
  const valid = keyOk && label.trim().length > 0;

  if (!open) {
    return (
      <button className="kr-mini" style={{ alignSelf: "flex-start", padding: "8px 14px" }} onClick={() => setOpen(true)}>
        + Neue Vorlage ({LANG_NAME[lang]})
      </button>
    );
  }

  return (
    <div style={{ ...card, borderStyle: "dashed" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Key">
          <input className="kr-input" style={{ width: 150, padding: "6px 9px", fontSize: 12, fontFamily: "var(--font-mono)" }} value={key} maxLength={40} placeholder="z.B. preise" onChange={(e) => setKey(e.target.value)} aria-invalid={key.length > 0 && !keyOk} />
        </Field>
        <Field label="Label">
          <input className="kr-input" style={{ padding: "6px 9px", fontSize: 13 }} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      <Field label="Subject">
        <input className="kr-input" style={{ padding: "7px 10px", fontSize: 13 }} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Body · {{name}} / {{handle}}">
        <textarea className="kr-input" style={{ padding: "9px 11px", fontSize: 13, minHeight: 110, resize: "vertical" }} rows={6} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {err && <span style={{ fontSize: 12, color: "var(--danger)" }}>{err}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="retro-send"
          style={{ padding: "7px 16px", fontSize: 12.5 }}
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const ok = await onAdd({ template_key: key.trim().toLowerCase(), label: label.trim(), subject, body, sort_order: 50 });
            setBusy(false);
            if (ok) {
              setOpen(false);
              setKey(""); setLabel(""); setSubject("Re: Klar x {{name}}"); setBody("");
            } else {
              setErr("Anlegen fehlgeschlagen (Key schon vergeben?).");
            }
          }}
        >
          {busy ? "Lege an…" : "Anlegen"}
        </button>
        <button className="kr-mini" onClick={() => setOpen(false)}>Abbrechen</button>
      </div>
    </div>
  );
}

// Editor for one app x language outreach template: both mail variants (Mail-1
// Erstkontakt + Mail-2 Pitch) editable side by side. Saves via
// /admin/templates/api and hands the fresh row up so the composer dropdown
// inserts the new text immediately.
function AppMailEditor({
  app,
  appName,
  lang,
  row,
  onSaved,
}: {
  app: string;
  appName: string;
  lang: ReplyLang;
  row: AppMailTemplate | null;
  onSaved: (row: AppMailTemplate) => void;
}) {
  const [m1s, setM1s] = useState(row?.mail1_subject ?? "");
  const [m1b, setM1b] = useState(row?.mail1_body ?? "");
  const [m2s, setM2s] = useState(row?.mail2_subject ?? "");
  const [m2b, setM2b] = useState(row?.mail2_body ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Re-seed when switching app/lang or after a save round-trip.
  useEffect(() => {
    setM1s(row?.mail1_subject ?? "");
    setM1b(row?.mail1_body ?? "");
    setM2s(row?.mail2_subject ?? "");
    setM2b(row?.mail2_body ?? "");
    setErr(null);
  }, [app, lang, row?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    m1s !== (row?.mail1_subject ?? "") ||
    m1b !== (row?.mail1_body ?? "") ||
    m2s !== (row?.mail2_subject ?? "") ||
    m2b !== (row?.mail2_body ?? "");

  const save = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/admin/templates/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_slug: app,
          language: lang,
          mail1_subject: m1s,
          mail1_body: m1b,
          mail2_subject: m2s,
          mail2_body: m2b,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; row?: AppMailTemplate; error?: string };
      if (res.ok && j.ok && j.row) onSaved(j.row);
      else setErr(j.error || "Speichern fehlgeschlagen.");
    } catch {
      setErr("Netzwerkfehler beim Speichern.");
    } finally {
      setBusy(false);
    }
  }, [app, lang, m1s, m1b, m2s, m2b, onSaved]);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{appName}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 5, padding: "1px 7px" }}>
          {app} · {lang}
        </span>
        {!row && <span className="muted" style={{ fontSize: 11.5 }}>noch kein Template — Speichern legt es an</span>}
      </div>
      <div style={lbl}>Mail 1 · Erstkontakt</div>
      <Field label="Subject">
        <input className="kr-input" style={{ padding: "7px 10px", fontSize: 13 }} value={m1s} maxLength={200} onChange={(e) => setM1s(e.target.value)} />
      </Field>
      <Field label="Body · {{NAME}} / {{HANDLE}}">
        <textarea className="kr-input" style={{ padding: "9px 11px", fontSize: 13, minHeight: 150, resize: "vertical" }} rows={8} value={m1b} maxLength={10000} onChange={(e) => setM1b(e.target.value)} />
      </Field>
      <div style={{ ...lbl, marginTop: 6 }}>Mail 2 · Pitch mit Painpoint (Reply-Auto)</div>
      <Field label="Subject · leer = „Re: …“ vom Reply-Tracker">
        <input className="kr-input" style={{ padding: "7px 10px", fontSize: 13 }} value={m2s} maxLength={200} onChange={(e) => setM2s(e.target.value)} />
      </Field>
      <Field label="Body">
        <textarea className="kr-input" style={{ padding: "9px 11px", fontSize: 13, minHeight: 150, resize: "vertical" }} rows={8} value={m2b} maxLength={10000} onChange={(e) => setM2b(e.target.value)} />
      </Field>
      {err && <span style={{ fontSize: 12, color: "var(--danger)" }}>{err}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="retro-send"
          style={{ padding: "7px 16px", fontSize: 12.5 }}
          disabled={!dirty || busy}
          onClick={() => void save()}
        >
          {busy ? "Speichere…" : dirty ? "Speichern" : "Gespeichert"}
        </button>
      </div>
    </div>
  );
}

export default function TemplateManager({
  lang,
  baseMap,
  onClose,
  onMapChange,
  appMail,
  appSlugs,
  appNames,
  initialApp,
  onAppMailSaved,
}: {
  lang: ReplyLang;
  baseMap: MapT;
  onClose: () => void;
  onMapChange: (m: MapT) => void;
  appMail: AppMailTemplate[];
  appSlugs: string[];
  appNames: Record<string, string>;
  initialApp?: string;
  onAppMailSaved: (row: AppMailTemplate) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [active, setActive] = useState<ReplyLang>(lang);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Which template family is being edited: canned replies or the per-app
  // outreach mails (Mail-1 / Mail-2).
  const [view, setView] = useState<"replies" | "appmail">("replies");
  const [activeApp, setActiveApp] = useState<string>(
    initialApp && appSlugs.includes(initialApp) ? initialApp : appSlugs[0] ?? "",
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/admin/reply-templates/api", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; rows?: Row[] };
        if (!alive) return;
        if (res.ok && j.ok && j.rows) setRows(j.rows);
        else setLoadErr("Konnte Vorlagen nicht laden.");
      } catch {
        if (alive) setLoadErr("Netzwerkfehler beim Laden.");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Push the rebuilt map up whenever rows change so the composer dropdown tracks edits.
  const pushUp = useCallback((next: Row[]) => {
    setRows(next);
    onMapChange(rebuild(next, baseMap));
  }, [baseMap, onMapChange]);

  const saveRow = useCallback(
    async (language: ReplyLang, template_key: string, patch: { label: string; subject: string; body: string; sort_order: number }): Promise<boolean> => {
      try {
        const res = await fetch("/admin/reply-templates/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, template_key, ...patch }),
        });
        const j = (await res.json()) as { ok?: boolean; row?: Row };
        if (!res.ok || !j.ok || !j.row) return false;
        const saved = j.row;
        setRows((prev) => {
          const cur = prev ?? [];
          const idx = cur.findIndex((r) => r.language === saved.language && r.template_key === saved.template_key);
          const next = idx >= 0 ? cur.map((r, i) => (i === idx ? saved : r)) : [...cur, saved];
          onMapChange(rebuild(next, baseMap));
          return next;
        });
        return true;
      } catch {
        return false;
      }
    },
    [baseMap, onMapChange],
  );

  const deleteRow = useCallback(
    async (id: string): Promise<void> => {
      try {
        const res = await fetch("/admin/reply-templates/api", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const j = (await res.json()) as { ok?: boolean };
        if (res.ok && j.ok) pushUp((rows ?? []).filter((r) => r.id !== id));
      } catch {
        /* keep the card on failure */
      }
    },
    [rows, pushUp],
  );

  const shown = useMemo(
    () => (rows ?? []).filter((r) => r.language === active).sort((a, b) => a.sort_order - b.sort_order),
    [rows, active],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 22px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg)" }}>Vorlagen</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Änderungen wirken sofort im Composer.</div>
        </div>
        <button className="kr-mini" onClick={onClose}>Schließen</button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 22px 0", flexWrap: "wrap" }}>
        {([["replies", "Antworten"], ["appmail", "Outreach Mail 1+2"]] as const).map(([v, label]) => (
          <button
            key={v}
            className="kr-mini"
            onClick={() => setView(v)}
            style={view === v ? { background: "var(--fg)", color: "var(--bg)", borderColor: "var(--fg)", fontWeight: 600 } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 22px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {LANGS.map((l) => (
          <button
            key={l}
            className="kr-mini"
            onClick={() => setActive(l)}
            style={active === l ? { background: "var(--fg)", color: "var(--bg)", borderColor: "var(--fg)", fontWeight: 600 } : undefined}
          >
            {LANG_NAME[l]}
            {view === "replies" ? (
              <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{(rows ?? []).filter((r) => r.language === l).length}</span>
            ) : (
              <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>
                {appMail.some((m) => m.app_slug === activeApp && m.language === l && (m.mail1_body || m.mail2_body)) ? "●" : "○"}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "appmail" ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {appSlugs.map((s) => (
              <button
                key={s}
                className="kr-mini"
                onClick={() => setActiveApp(s)}
                style={activeApp === s ? { background: "var(--fg)", color: "var(--bg)", borderColor: "var(--fg)", fontWeight: 600 } : undefined}
              >
                {appNames[s] ?? s}
              </button>
            ))}
          </div>
          {activeApp ? (
            <AppMailEditor
              app={activeApp}
              appName={appNames[activeApp] ?? activeApp}
              lang={active}
              row={appMail.find((m) => m.app_slug === activeApp && m.language === active) ?? null}
              onSaved={onAppMailSaved}
            />
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>Keine Apps konfiguriert.</div>
          )}
        </div>
      ) : (
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loadErr ? (
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{loadErr}</div>
        ) : rows === null ? (
          <div className="muted" style={{ fontSize: 13 }}>lädt…</div>
        ) : (
          <>
            {shown.map((r) => (
              <TemplateCard
                key={r.id}
                row={r}
                onSave={(patch) => saveRow(r.language, r.template_key, patch)}
                onDelete={() => deleteRow(r.id)}
              />
            ))}
            {shown.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Keine Vorlagen in {LANG_NAME[active]}.</div>}
            <AddCard
              lang={active}
              onAdd={(r) => saveRow(active, r.template_key, { label: r.label, subject: r.subject, body: r.body, sort_order: r.sort_order })}
            />
          </>
        )}
      </div>
      )}
    </div>
  );
}
