"use client";

// In-inbox reply-template manager. Opens as a drawer from the composer so Alain
// can edit / add / delete the canned replies without leaving the mailbox. CRUD
// goes against /admin/reply-templates/api (JSON); every change rebuilds the
// grouped template map and hands it back to MailClient via onMapChange, so the
// composer dropdown reflects edits instantly (no reload). The standalone
// /admin/reply-templates page stays for full-screen editing.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReplyLang, ReplyTemplate } from "@/lib/replyTemplates";

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

export default function TemplateManager({
  lang,
  baseMap,
  onClose,
  onMapChange,
}: {
  lang: ReplyLang;
  baseMap: MapT;
  onClose: () => void;
  onMapChange: (m: MapT) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [active, setActive] = useState<ReplyLang>(lang);
  const [loadErr, setLoadErr] = useState<string | null>(null);

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
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg)" }}>Antwort-Vorlagen</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Änderungen wirken sofort im Composer.</div>
        </div>
        <button className="kr-mini" onClick={onClose}>Schließen</button>
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
            <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{(rows ?? []).filter((r) => r.language === l).length}</span>
          </button>
        ))}
      </div>

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
    </div>
  );
}
