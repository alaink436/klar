"use client";

// Die Liste: oben ein Eingabefeld, darunter die offenen Punkte nach Tagen
// gruppiert, ganz unten die erledigten (eingeklappt). Klick auf die Box hakt
// ab, Klick auf den Text macht ihn editierbar, das Datumsfeld legt den Punkt
// auf einen Tag.
//
// Optimistisch: Haken und Datum sitzen sofort, die Server-Action läuft daneben.
// Ohne das fühlt sich Abhaken bei jedem Klick wie Warten an — und Abhaken ist
// der einzige Grund, warum man so eine Liste überhaupt benutzt.
//
// Die Tagesgruppe wird auf dem SERVER berechnet und mitgeliefert. Würde der
// Client "heute" selbst bestimmen, wäre der erste Render nach Mitternacht (oder
// in einer anderen Zeitzone) ein anderer als der vom Server — genau die Sorte
// Hydration-Fehler, die man erst im Log sieht.

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearDone, createTodo, editTodo, planTodo, removeTodo, toggleTodo } from "./todo-actions";
import { tAdmin, type AdminLang } from "../_i18n";

export type TodoBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export interface TodoRow {
  id: string;
  title: string;
  done: boolean;
  /** Vorformatiert auf dem Server — der Client soll keine Zeitzone erfinden. */
  doneFmt: string | null;
  /** "YYYY-MM-DD" für das Datumsfeld, leer wenn ungeplant. */
  due: string;
  dueFmt: string | null;
  bucket: TodoBucket;
}

const BUCKET_ORDER: TodoBucket[] = ["overdue", "today", "tomorrow", "week", "later", "none"];

export default function TodoList({
  rows,
  lang,
  today,
  tomorrow,
}: {
  rows: TodoRow[];
  lang: AdminLang;
  /** Vom Server, für die Schnellknöpfe — siehe Kommentar oben. */
  today: string;
  tomorrow: string;
}) {
  const t = tAdmin(lang);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  type Patch = { id: string; done?: boolean; due?: string };
  const [items, applyPatch] = useOptimistic(rows, (state: TodoRow[], p: Patch) =>
    state.map((r) =>
      r.id !== p.id
        ? r
        : {
            ...r,
            done: p.done ?? r.done,
            due: p.due ?? r.due,
            // Der Server liefert Gruppe und Format beim nächsten Render nach;
            // bis dahin nicht raten, sondern die Zeile stehen lassen.
            bucket: p.due !== undefined ? r.bucket : r.bucket,
          },
    ),
  );

  const open = items.filter((r) => !r.done);
  const done = items.filter((r) => r.done);

  const label: Record<TodoBucket, string> = {
    overdue: t.todoBucketOverdue,
    today: t.todoBucketToday,
    tomorrow: t.todoBucketTomorrow,
    week: t.todoBucketWeek,
    later: t.todoBucketLater,
    none: t.todoBucketNone,
  };

  function submit() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    inputRef.current?.focus();
    startTransition(async () => {
      await createTodo(title);
    });
  }

  function onToggle(r: TodoRow) {
    startTransition(async () => {
      applyPatch({ id: r.id, done: !r.done });
      await toggleTodo(r.id, !r.done);
    });
  }

  function onPlan(r: TodoRow, due: string) {
    startTransition(async () => {
      applyPatch({ id: r.id, due });
      await planTodo(r.id, due || null);
    });
  }

  function row(r: TodoRow) {
    return (
      <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-line group">
        <button
          type="button"
          onClick={() => onToggle(r)}
          aria-pressed={r.done}
          aria-label={r.done ? t.todoReopenAria(r.title) : t.todoDoneAria(r.title)}
          className={`flex items-center justify-center size-[18px] rounded-[5px] border shrink-0 transition-colors ${
            r.done ? "bg-fg border-fg text-[var(--accent-fg)]" : "border-line-strong hover:border-fg"
          }`}
        >
          {r.done ? (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : null}
        </button>

        {editing === r.id ? (
          <Input
            autoFocus
            defaultValue={r.title}
            className="flex-1 h-8 py-1"
            onBlur={(e) => {
              const v = e.target.value.trim();
              setEditing(null);
              if (v && v !== r.title) startTransition(async () => void (await editTodo(r.id, v)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(null);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(r.id)}
            title={t.todoEditHint}
            className={`flex-1 text-left text-[13.5px] leading-snug ${r.done ? "text-fg-4 line-through" : "text-fg"}`}
          >
            {r.title}
          </button>
        )}

        {!r.done ? (
          <>
            {/* Schnellknöpfe erscheinen erst beim Hover — sie sind die Abkürzung,
                das Datumsfeld daneben bleibt der vollständige Weg. */}
            {r.due !== today ? (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                onClick={() => onPlan(r, today)}
              >
                {t.todoPlanToday}
              </Button>
            ) : null}
            {r.due !== tomorrow ? (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                onClick={() => onPlan(r, tomorrow)}
              >
                {t.todoPlanTomorrow}
              </Button>
            ) : null}
            <input
              type="date"
              value={r.due}
              onChange={(e) => onPlan(r, e.target.value)}
              aria-label={t.todoPlanAria(r.title)}
              title={t.todoPlanAria(r.title)}
              className="shrink-0 h-8 px-2 text-[12px] [font-family:var(--font-mono)] text-fg-2 bg-bg border border-line rounded-[var(--radius-sm)] focus:border-fg focus:outline-none"
            />
          </>
        ) : null}

        {r.done && r.doneFmt ? (
          <span className="[font-family:var(--font-mono)] text-[10.5px] text-fg-4 shrink-0">{r.doneFmt}</span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
          onClick={() => startTransition(async () => void (await removeTodo(r.id)))}
        >
          {t.todoDelete}
        </Button>
      </li>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t.todoPlaceholder}
          aria-label={t.todoPlaceholder}
          className="flex-1"
        />
        <Button variant="pop" onClick={submit} disabled={!draft.trim()}>
          {t.todoAdd}
        </Button>
      </div>

      {open.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-fg-3">{t.todoEmpty}</div>
      ) : (
        BUCKET_ORDER.map((b) => {
          const group = open.filter((r) => r.bucket === b);
          if (group.length === 0) return null;
          return (
            <section key={b}>
              <div className="flex items-center gap-2 px-5 py-2 border-t border-line bg-surface-2">
                <span
                  className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: b === "overdue" ? "var(--danger)" : "var(--fg-3)" }}
                >
                  {label[b]}
                </span>
                <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">{group.length}</span>
              </div>
              <ul className="list-none m-0 p-0">{group.map(row)}</ul>
            </section>
          );
        })
      )}

      {done.length > 0 ? (
        <div className="border-t border-line">
          <div className="flex items-center justify-between gap-3 px-5 py-2.5">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 hover:text-fg"
            >
              {showDone ? t.todoHideDone(done.length) : t.todoShowDone(done.length)}
            </button>
            {showDone ? (
              <Button variant="ghost" size="sm" onClick={() => startTransition(async () => void (await clearDone()))}>
                {t.todoClearDone}
              </Button>
            ) : null}
          </div>
          {showDone ? <ul className="list-none m-0 p-0">{done.map(row)}</ul> : null}
        </div>
      ) : null}
    </Card>
  );
}
