"use client";

// In-inbox template manager. Opens as a drawer from the composer so Alain can
// edit the canned replies without leaving the mailbox. Reply CRUD goes against
// /admin/reply-templates/api (JSON); every change is handed back to MailClient
// (onMapChange), so the composer dropdown reflects edits instantly (no reload).
//
// Since the 2026-10-08 redesign (ticket 02): every template is a TextureCard,
// buttons are pills (white for saving, dark for the rest), the languages sit
// in a `.klar-segment`, fields are `.klar-feld`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TextureCard } from "@/components/ui/texture-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const CARD = "flex shrink-0 flex-col gap-[9px] p-4";
const BTN = "h-7 px-3 text-[12px]";

/** Status-Zeile: Ton nur im Punkt. */
function Meldung({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-fg-2">
      <span className="klar-punkt" style={{ "--ton": "var(--danger)" } as React.CSSProperties} />
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3 [font-family:var(--font-mono)]">{label}</span>
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
    <TextureCard className={CARD}>
      <div className="flex items-center gap-2">
        <Badge className="[font-family:var(--font-mono)] text-[11px]">{row.template_key}</Badge>
        <input
          className="klar-feld flex-1 px-[9px] py-1.5 font-semibold"
          value={label}
          maxLength={120}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="klar-feld w-14 px-2 py-1.5 text-center text-[12px] [font-family:var(--font-mono)]"
          type="number"
          min={0}
          max={999}
          value={sort}
          title="Reihenfolge"
          onChange={(e) => setSort(Number(e.target.value) || 0)}
        />
      </div>
      <Field label="Subject">
        <input className="klar-feld px-2.5 py-[7px]" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Body · {{name}} / {{handle}}">
        <textarea className="klar-feld min-h-[130px] px-[11px] py-[9px]" rows={7} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button
          variant="pill"
          size="sm"
          className="h-8 px-4 text-[12.5px]"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ label, subject, body, sort_order: sort });
            setBusy(false);
          }}
        >
          {busy ? "Speichere…" : dirty ? "Speichern" : "Gespeichert"}
        </Button>
        <span className="ml-auto" />
        {!armed ? (
          <Button variant="pill-dark" size="sm" className={`${BTN} text-danger`} onClick={() => setArmed(true)}>
            Löschen
          </Button>
        ) : (
          <>
            <span className="text-[11.5px] text-fg-3">Sicher?</span>
            <Button
              variant="pill-dark"
              size="sm"
              className={`${BTN} text-danger`}
              onClick={async () => {
                setBusy(true);
                await onDelete();
              }}
            >
              Ja
            </Button>
            <Button variant="pill-dark" size="sm" className={BTN} onClick={() => setArmed(false)}>Abbrechen</Button>
          </>
        )}
      </div>
    </TextureCard>
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
      <Button variant="pill-dark" size="sm" className="shrink-0 self-start" onClick={() => setOpen(true)}>
        <Plus />
        Neue Vorlage ({LANG_NAME[lang]})
      </Button>
    );
  }

  return (
    <TextureCard className={CARD}>
      <div className="flex gap-2">
        <Field label="Key">
          <input className="klar-feld w-[150px] px-[9px] py-1.5 text-[12px] [font-family:var(--font-mono)]" value={key} maxLength={40} placeholder="z.B. preise" onChange={(e) => setKey(e.target.value)} aria-invalid={key.length > 0 && !keyOk} />
        </Field>
        <Field label="Label">
          <input className="klar-feld px-[9px] py-1.5" value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        </Field>
      </div>
      <Field label="Subject">
        <input className="klar-feld px-2.5 py-[7px]" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Body · {{name}} / {{handle}}">
        <textarea className="klar-feld min-h-[110px] px-[11px] py-[9px]" rows={6} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {err && <Meldung>{err}</Meldung>}
      <div className="flex gap-2">
        <Button
          variant="pill"
          size="sm"
          className="h-8 px-4 text-[12.5px]"
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
        </Button>
        <Button variant="pill-dark" size="sm" className={BTN} onClick={() => setOpen(false)}>Abbrechen</Button>
      </div>
    </TextureCard>
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-[22px] pb-3.5 pt-5">
        <div className="flex-1">
          <div className="klar-verlauf w-fit text-[22px] font-medium leading-tight tracking-[-0.02em]">Vorlagen</div>
          <div className="mt-0.5 text-[12px] text-fg-3">Änderungen wirken sofort im Composer.</div>
        </div>
        <Button variant="pill-dark" size="sm" className={BTN} onClick={onClose}>Schließen</Button>
      </div>

      <div className="border-b px-[22px] py-3">
        <div className="klar-segment">
          {LANGS.map((l) => (
            <button key={l} type="button" aria-pressed={active === l} onClick={() => setActive(l)}>
              {LANG_NAME[l]}
              <span className="text-[10.5px] text-fg-4 [font-family:var(--font-mono)]">{(rows ?? []).filter((r) => r.language === l).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-[22px] py-4">
        {loadErr ? (
          <Meldung>{loadErr}</Meldung>
        ) : rows === null ? (
          <div className="text-[13px] text-fg-3">lädt…</div>
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
            {shown.length === 0 && <div className="text-[13px] text-fg-3">Keine Vorlagen in {LANG_NAME[active]}.</div>}
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
