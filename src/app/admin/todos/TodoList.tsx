"use client";

// Die Liste selbst: oben ein Eingabefeld, darunter die offenen Punkte, ganz
// unten die erledigten (eingeklappt). Ein Klick auf die Checkbox hakt ab, ein
// Klick auf den Text macht ihn editierbar.
//
// Optimistisch: der Haken sitzt sofort, die Server-Action läuft daneben. Ohne
// das fühlt sich Abhaken bei jedem Klick wie Warten an — und Abhaken ist der
// einzige Grund, warum man so eine Liste überhaupt benutzt.

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearDone, createTodo, editTodo, removeTodo, toggleTodo } from "./todo-actions";
import { tAdmin, type AdminLang } from "../_i18n";

export interface TodoRow {
  id: string;
  title: string;
  done: boolean;
  /** Vorformatiert auf dem Server — der Client soll keine Zeitzone erfinden. */
  doneFmt: string | null;
}

export default function TodoList({ rows, lang }: { rows: TodoRow[]; lang: AdminLang }) {
  const t = tAdmin(lang);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Der Haken darf nicht auf den Server warten.
  const [items, setItems] = useOptimistic(rows, (state: TodoRow[], toggled: string) =>
    state.map((r) => (r.id === toggled ? { ...r, done: !r.done } : r)),
  );

  const open = items.filter((r) => !r.done);
  const done = items.filter((r) => r.done);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    inputRef.current?.focus();
    startTransition(async () => {
      await createTodo(title);
    });
  }

  function onToggle(row: TodoRow) {
    startTransition(async () => {
      setItems(row.id);
      await toggleTodo(row.id, !row.done);
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
        <ul className="list-none m-0 p-0">{open.map(row)}</ul>
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
