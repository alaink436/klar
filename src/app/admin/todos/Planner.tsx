"use client";

// Wochenplaner: links der Backlog ("Ohne Termin"), rechts sieben Tagesspalten.
// Karten werden per Drag auf einen Tag gelegt, zwischen Tagen verschoben oder
// zurück in den Backlog gezogen. Uhrzeit ist optional — ohne bleibt der Punkt
// ganztägig, mit wird er im iPhone-Kalender ein echter Termin.
//
// Drei Entscheidungen, die man der Oberfläche nicht ansieht:
//   - Der Tag kommt IMMER vom Server (Europe/Zurich). Würde der Client "heute"
//     selbst bestimmen, wäre der erste Render nach Mitternacht ein anderer als
//     der vom Server — ein Hydration-Fehler, den man nur im Log sieht.
//   - Verschieben ist optimistisch: die Karte sitzt sofort im Zielt-Tag, die
//     Server-Action läuft daneben. Ein Planer, bei dem jede Bewegung erst auf
//     eine Antwort wartet, benutzt man kein zweites Mal.
//   - Gezogen wird die ganze Karte (draggable), aber Klicks bleiben Klicks:
//     HTML5-Drag verlangt eine echte Ziehgeste, kein einfaches Mousedown.

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearDone, createTodo, editTodo, planTodo, removeTodo, toggleTodo } from "./todo-actions";
import { tAdmin, type AdminLang } from "../_i18n";

export interface PlannerTodo {
  id: string;
  title: string;
  done: boolean;
  /** "YYYY-MM-DD" oder "" für Backlog. */
  due: string;
  /** "HH:MM" oder "" für ganztägig. */
  time: string;
  doneFmt: string | null;
  /** true, wenn der Punkt offen ist und sein Tag vor heute liegt. */
  overdue: boolean;
}

export interface PlannerDay {
  iso: string;
  weekday: string;
  dayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

const BACKLOG = "__backlog__";

export default function Planner({
  rows,
  days,
  lang,
  weekLabel,
  weekOffset,
}: {
  rows: PlannerTodo[];
  days: PlannerDay[];
  lang: AdminLang;
  weekLabel: string;
  weekOffset: number;
}) {
  const t = tAdmin(lang);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  type Patch = { id: string; done?: boolean; due?: string; time?: string };
  const [items, patch] = useOptimistic(rows, (state: PlannerTodo[], p: Patch) =>
    state.map((r) =>
      r.id !== p.id
        ? r
        : {
            ...r,
            done: p.done ?? r.done,
            due: p.due ?? r.due,
            time: p.time ?? r.time,
            // Nach dem Verschieben ist nichts mehr überfällig, bis der Server
            // das nächste Mal rechnet — sonst bleibt die rote Kante kleben.
            overdue: p.due !== undefined ? false : r.overdue,
          },
    ),
  );

  const open = items.filter((r) => !r.done);
  const done = items.filter((r) => r.done);
  const backlog = open.filter((r) => !r.due);
  const forDay = (iso: string) =>
    open
      .filter((r) => r.due === iso)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  /** Offen, geplant, aber vor dem angezeigten Fenster — sonst unsichtbar. */
  const firstDay = days[0]?.iso ?? "";
  const stale = open.filter((r) => r.due && r.due < firstDay && r.overdue);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    inputRef.current?.focus();
    startTransition(async () => {
      await createTodo(title);
    });
  }

  function move(id: string, target: string) {
    const due = target === BACKLOG ? null : target;
    startTransition(async () => {
      patch({ id, due: due ?? "" });
      await planTodo(id, due);
    });
  }

  function setTime(r: PlannerTodo, time: string) {
    startTransition(async () => {
      patch({ id: r.id, time });
      await planTodo(r.id, r.due || null, time || null);
    });
  }

  function onToggle(r: PlannerTodo) {
    startTransition(async () => {
      patch({ id: r.id, done: !r.done });
      await toggleTodo(r.id, !r.done);
    });
  }

  function card(r: PlannerTodo, withTime: boolean) {
    return (
      <div
        key={r.id}
        draggable
        onDragStart={(e) => {
          setDragId(r.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", r.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverCol(null);
        }}
        className="group rounded-[var(--radius-sm)] border bg-surface px-2.5 py-2 cursor-grab active:cursor-grabbing"
        style={{
          borderColor: r.overdue ? "color-mix(in oklab,var(--danger) 45%,var(--line))" : "var(--line)",
          opacity: dragId === r.id ? 0.4 : 1,
        }}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => onToggle(r)}
            aria-label={r.done ? t.todoReopenAria(r.title) : t.todoDoneAria(r.title)}
            className={`mt-[1px] flex items-center justify-center size-[16px] rounded-[4px] border shrink-0 transition-colors ${
              r.done ? "bg-fg border-fg text-[var(--accent-fg)]" : "border-line-strong hover:border-fg"
            }`}
          >
            {r.done ? (
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
          </button>

          {editing === r.id ? (
            <input
              autoFocus
              defaultValue={r.title}
              className="flex-1 min-w-0 bg-transparent text-[12.5px] text-fg border-b border-line-strong focus:outline-none focus:border-fg"
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
              className={`flex-1 min-w-0 text-left text-[12.5px] leading-snug break-words ${
                r.done ? "text-fg-4 line-through" : "text-fg"
              }`}
            >
              {r.title}
            </button>
          )}

          <button
            type="button"
            onClick={() => startTransition(async () => void (await removeTodo(r.id)))}
            aria-label={t.todoDelete}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-fg-4 hover:text-danger shrink-0 leading-none text-[15px]"
          >
            ×
          </button>
        </div>

        {withTime && !r.done ? (
          <div className="flex items-center gap-1.5 mt-1.5 pl-[24px]">
            <input
              type="time"
              value={r.time}
              onChange={(e) => setTime(r, e.target.value)}
              aria-label={t.todoTimeAria(r.title)}
              className="h-6 px-1 text-[11px] [font-family:var(--font-mono)] text-fg-2 bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none"
            />
            {r.time ? (
              <button
                type="button"
                onClick={() => setTime(r, "")}
                className="text-[10px] text-fg-4 hover:text-fg"
              >
                {t.todoAllDay}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function column(key: string, head: React.ReactNode, list: PlannerTodo[], withTime: boolean, tint?: string) {
    const isOver = overCol === key && dragId !== null;
    return (
      <div
        key={key}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOverCol(key);
        }}
        onDragLeave={() => setOverCol((c) => (c === key ? null : c))}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain") || dragId;
          setDragId(null);
          setOverCol(null);
          if (id) move(id, key);
        }}
        className="flex flex-col gap-2 rounded-[var(--radius-sm)] p-2 min-w-[180px] flex-1 transition-colors"
        style={{
          background: isOver ? "color-mix(in oklab,var(--fg) 7%,var(--surface-2))" : tint ?? "var(--surface-2)",
          outline: isOver ? "1px dashed var(--fg-3)" : "1px solid transparent",
          minHeight: 120,
        }}
      >
        {head}
        {list.map((r) => card(r, withTime))}
        {list.length === 0 ? (
          <div className="text-[11px] text-fg-4 px-1 py-2">{isOver ? t.todoDropHere : ""}</div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Card className="p-0 overflow-hidden mb-4">
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

        {/* Wochennavigation — server-gerendert, damit der Tag vom Server kommt. */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-line">
          <Link href={`/admin/todos?w=${weekOffset - 1}`} className="applink text-[12px]">
            ‹ {t.todoPrevWeek}
          </Link>
          <span className="[font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-2">
            {weekLabel}
          </span>
          <Link href={`/admin/todos?w=${weekOffset + 1}`} className="applink text-[12px]">
            {t.todoNextWeek} ›
          </Link>
          {weekOffset !== 0 ? (
            <Link href="/admin/todos" className="applink text-[12px] ml-auto">
              {t.todoThisWeek}
            </Link>
          ) : null}
        </div>

        <div className="p-3 overflow-x-auto">
          <div className="flex gap-2 items-start" style={{ minWidth: 900 }}>
            {column(
              BACKLOG,
              <div className="flex items-baseline gap-2 px-1 pb-1">
                <span className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                  {t.todoBucketNone}
                </span>
                <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">{backlog.length}</span>
              </div>,
              backlog,
              false,
              "var(--surface)",
            )}

            {days.map((d) =>
              column(
                d.iso,
                <div className="flex items-baseline gap-2 px-1 pb-1">
                  <span
                    className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: d.isToday ? "var(--fg)" : "var(--fg-3)" }}
                  >
                    {d.weekday}
                  </span>
                  <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">{d.dayLabel}</span>
                  {d.isToday ? (
                    <span className="[font-family:var(--font-mono)] text-[8.5px] uppercase tracking-[0.1em] text-[var(--accent-fg)] bg-fg rounded-[3px] px-1 py-[1px]">
                      {t.todoBucketToday}
                    </span>
                  ) : null}
                </div>,
                forDay(d.iso),
                true,
                d.isWeekend ? "color-mix(in oklab,var(--fg) 3%,var(--surface-2))" : undefined,
              ),
            )}
          </div>
        </div>
      </Card>

      {/* Was vor dem Fenster liegt und offen ist, darf nicht verschwinden. */}
      {stale.length > 0 ? (
        <Card className="p-0 overflow-hidden mb-4">
          <div className="px-5 py-2.5 border-b border-line">
            <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
              {t.todoBucketOverdue} · {stale.length}
            </span>
          </div>
          <div className="p-3 flex flex-wrap gap-2">{stale.map((r) => card(r, true))}</div>
        </Card>
      ) : null}

      {done.length > 0 ? (
        <Card className="p-0 overflow-hidden">
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
          {showDone ? (
            <ul className="list-none m-0 p-0">
              {done.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2 border-t border-line group">
                  <button
                    type="button"
                    onClick={() => onToggle(r)}
                    aria-label={t.todoReopenAria(r.title)}
                    className="flex items-center justify-center size-[16px] rounded-[4px] border bg-fg border-fg text-[var(--accent-fg)] shrink-0"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                  <span className="flex-1 text-[13px] text-fg-4 line-through">{r.title}</span>
                  {r.doneFmt ? (
                    <span className="[font-family:var(--font-mono)] text-[10.5px] text-fg-4">{r.doneFmt}</span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => startTransition(async () => void (await removeTodo(r.id)))}
                  >
                    {t.todoDelete}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
