"use client";

// Wochenplaner: links die Sammelstelle ("ohne Termin"), rechts sieben
// Tagesspalten. Karten werden per Drag auf einen Tag gelegt, zwischen Tagen
// verschoben oder zurück in die Sammelstelle gezogen. Uhrzeit ist optional —
// ohne bleibt der Punkt ganztägig, mit wird er im iPhone-Kalender ein echter
// Termin.
//
// Vier Entscheidungen, die man der Oberfläche nicht ansieht:
//   - Der Tag kommt IMMER vom Server (Europe/Zurich). Würde der Client "heute"
//     selbst bestimmen, wäre der erste Render nach Mitternacht ein anderer als
//     der vom Server — ein Hydration-Fehler, den man nur im Log sieht.
//   - Verschieben ist optimistisch: die Karte sitzt sofort im Zielt-Tag, die
//     Server-Action läuft daneben. Ein Planer, bei dem jede Bewegung erst auf
//     eine Antwort wartet, benutzt man kein zweites Mal.
//   - Gezogen wird die ganze Karte (draggable), aber Klicks bleiben Klicks:
//     HTML5-Drag verlangt eine echte Ziehgeste, kein einfaches Mousedown.
//   - Ziehen ist NIE der einzige Weg. HTML5-Drag gibt es auf dem Telefon nicht
//     und mit der Tastatur auch nicht, also trägt jede Karte dieselben Ziele
//     noch einmal als benannte Bedienelemente: „Sammelstelle" und
//     „Verschieben …". Der Text steht dran, keine schwebenden Symbole.
//
// Die Sammelstelle steht in JEDER Woche links. Das ist der Grund, warum sie
// auch der Weg über grosse Distanzen ist: Karte hineinlegen, Wochen blättern,
// auf den Zieltag legen — ohne dass die Karte je unsichtbar wird.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  useOptimistic,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearDone, createTodo, editTodo, planTodo, removeTodo, toggleTodo } from "./todo-actions";
import { markPosted } from "./posting-actions";
import { tAdmin, type AdminLang } from "../_i18n";

export interface PlannerTodo {
  id: string;
  title: string;
  done: boolean;
  /** "YYYY-MM-DD" oder "" für die Sammelstelle. */
  due: string;
  /** "HH:MM" oder "" für ganztägig. */
  time: string;
  doneFmt: string | null;
  /** true, wenn der Punkt offen ist und sein Tag vor heute liegt. */
  overdue: boolean;
}

/**
 * Ein faelliger Post als Punkt im Wochenplan. Er wird NICHT als To-do
 * gespeichert, sondern aus Rhythmus und Frequenz des Accounts abgeleitet — sonst
 * gaebe es dieselbe Wahrheit zweimal, und wer den Rhythmus aendert, muesste
 * hinterher Karteileichen aufraeumen. Abhaken schreibt in denselben Verlauf wie
 * das Posting-Board; die beiden Ansichten zeigen also immer dasselbe.
 */
export interface PlannerPosting {
  accountKey: string;
  /** "YYYY-MM-DD". */
  day: string;
  slot: number;
  perDay: number;
  handle: string;
  format: string;
  appLabel: string;
  appColor: string;
  done: boolean;
}

export interface PlannerDay {
  iso: string;
  weekday: string;
  dayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

const BACKLOG = "__backlog__";

/**
 * Merker im Browser: sollen die abgeleiteten Posting-Punkte mitlaufen?
 *
 * `localStorage` ist ein externer Speicher, kein React-Zustand — also wird er
 * auch so behandelt und nicht in einem Effekt in den Zustand kopiert. Der
 * Server-Schnappschuss ist "sichtbar", damit der erste Render auf beiden Seiten
 * gleich aussieht; unmittelbar nach dem Hydrieren zieht der echte Wert nach.
 */
const HIDE_POSTS_KEY = "klar_planner_hide_postings";

let hidePostsCache: boolean | null = null;
const hidePostsListeners = new Set<() => void>();

function readHidePosts(): boolean {
  if (hidePostsCache === null) {
    try {
      hidePostsCache = window.localStorage.getItem(HIDE_POSTS_KEY) === "1";
    } catch {
      hidePostsCache = false; // privater Modus o. Ae.
    }
  }
  return hidePostsCache;
}

function writeHidePosts(next: boolean): void {
  hidePostsCache = next;
  try {
    window.localStorage.setItem(HIDE_POSTS_KEY, next ? "1" : "0");
  } catch {
    // dann gilt die Wahl eben nur fuer diese Sitzung
  }
  for (const l of hidePostsListeners) l();
}

function subscribeHidePosts(cb: () => void): () => void {
  hidePostsListeners.add(cb);
  return () => {
    hidePostsListeners.delete(cb);
  };
}

/** Kleine benannte Aktion auf einer Karte — Text, kein schwebendes Symbol. */
const ACTION =
  "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4 hover:text-fg focus-visible:text-fg transition-colors";
const ACTION_SELECT = `${ACTION} h-[18px] max-w-[104px] bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:underline`;

export default function Planner({
  rows,
  days,
  postings,
  lang,
  today,
  tomorrow,
}: {
  rows: PlannerTodo[];
  days: PlannerDay[];
  /** Abgeleitete Posting-Punkte der gezeigten Woche, ein Eintrag je Post. */
  postings: PlannerPosting[];
  lang: AdminLang;
  /** "YYYY-MM-DD" in Europe/Zurich, vom Server. */
  today: string;
  tomorrow: string;
}) {
  const t = tAdmin(lang);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [addTarget, setAddTarget] = useState<string>(BACKLOG);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  // Die Posting-Punkte lassen sich ausblenden: an einer Woche mit vier Accounts
  // im Tagesrhythmus stehen schnell zwanzig davon in den Spalten, und dann
  // findet man die eigenen To-dos nicht mehr. Die Wahl bleibt im Browser —
  // sie gilt fuer dieses Geraet, nicht fuer den Vault.
  const hidePosts = useSyncExternalStore(subscribeHidePosts, readHidePosts, () => false);
  // Eingeklappt ist der Normalfall — seit 2026-08-18 auch fuer heute (Alain:
  // aufgeklappt verwirrt). Der Kopf sagt weiter, wie viele Posts anstehen und
  // wie viele davon stehen; ein Klick oeffnet den Tag. Sonst deckt eine Woche
  // mit drei Accounts im Tagesrhythmus die eigenen To-dos komplett zu.
  const [openPostDays, setOpenPostDays] = useState<Set<string>>(() => new Set<string>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  // Die Haken der Posting-Punkte liegen im selben Verlauf wie im Board; hier
  // wird nur optimistisch vorgegriffen, damit der Klick sofort sitzt.
  const [posts, patchPost] = useOptimistic(
    postings,
    (state: PlannerPosting[], p: { id: string; done: boolean }) =>
      state.map((x) => (`${x.accountKey}|${x.day}|${x.slot}` === p.id ? { ...x, done: p.done } : x)),
  );

  // Heute in die Mitte rollen. Sieben Spalten passen auf keinen Bildschirm, und
  // links anzufangen heisst, dass der wichtigste Tag ab Donnerstag ausserhalb
  // liegt. Gerechnet wird ueber die Rechtecke statt ueber offsetLeft: das gilt
  // auch, wenn zwischendrin ein positioniertes Element steht.
  useEffect(() => {
    const box = scrollerRef.current;
    if (!box) return;
    const col = box.querySelector<HTMLElement>('[data-today="1"]');
    if (!col) return;
    const b = box.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    box.scrollLeft += c.left - b.left - (b.width - c.width) / 2;
  }, [today]);

  function togglePostDay(iso: string) {
    setOpenPostDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function togglePosting(p: PlannerPosting) {
    const id = `${p.accountKey}|${p.day}|${p.slot}`;
    startTransition(async () => {
      patchPost({ id, done: !p.done });
      await markPosted(p.accountKey, p.day, p.slot, !p.done);
    });
  }

  // Filter über ALLE Spalten, nicht pro Spalte: bei „wo lag nochmal der
  // Steuertermin?" weiss man den Tag ja gerade nicht.
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? items.filter((r) => r.title.toLowerCase().includes(q)) : items),
    [items, q],
  );

  const open = visible.filter((r) => !r.done);
  const done = visible.filter((r) => r.done);
  const backlog = open.filter((r) => !r.due);
  const forDay = (iso: string) =>
    open
      .filter((r) => r.due === iso)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  /** Die Posting-Punkte eines Tages, in Slot-Reihenfolge. */
  const postingsFor = (iso: string) =>
    posts.filter((x) => x.day === iso).sort((a, b) => a.slot - b.slot);

  /** Offen, geplant, aber vor dem angezeigten Fenster — sonst unsichtbar. */
  const firstDay = days[0]?.iso ?? "";
  const stale = open.filter((r) => r.due && r.due < firstDay && r.overdue);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    const due = addTarget === BACKLOG ? null : addTarget;
    setDraft("");
    inputRef.current?.focus();
    startTransition(async () => {
      await createTodo(title, due);
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

  /**
   * Ziele für „Verschieben …": erst die Sammelstelle, dann Heute/Morgen (auch
   * wenn sie ausserhalb der gezeigten Woche liegen), dann die sieben Tage der
   * Woche. Der eigene Tag fällt raus — ein Ziel, das nichts ändert, ist keins.
   */
  function moveOptions(r: PlannerTodo): { value: string; label: string }[] {
    const out: { value: string; label: string }[] = [];
    if (r.due) out.push({ value: BACKLOG, label: t.todoToBacklog });
    if (r.due !== today) out.push({ value: today, label: t.todoPlanToday });
    if (r.due !== tomorrow) out.push({ value: tomorrow, label: t.todoPlanTomorrow });
    for (const d of days) {
      if (d.iso === r.due || d.iso === today || d.iso === tomorrow) continue;
      out.push({ value: d.iso, label: `${d.weekday} ${d.dayLabel}` });
    }
    return out;
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
        className="group rounded-[var(--radius-sm)] border bg-surface px-3 py-2.5 cursor-grab active:cursor-grabbing"
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
              className="flex-1 min-w-0 bg-transparent text-[13.5px] text-fg border-b border-line-strong focus:outline-none focus:border-fg"
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
              className={`flex-1 min-w-0 text-left text-[13.5px] leading-snug break-words ${
                r.done ? "text-fg-4 line-through" : "text-fg"
              }`}
            >
              {r.title}
            </button>
          )}
        </div>

        {withTime && !r.done ? (
          <div className="flex items-center gap-1.5 mt-1.5 pl-[24px]">
            <input
              type="time"
              value={r.time}
              onChange={(e) => setTime(r, e.target.value)}
              aria-label={t.todoTimeAria(r.title)}
              className="h-7 px-1.5 text-[12px] [font-family:var(--font-mono)] text-fg-2 bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none"
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

        {/* Benannte Wege für alles, was sonst nur das Ziehen könnte. */}
        {!r.done ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 pl-[24px]">
            {r.due ? (
              <button
                type="button"
                onClick={() => move(r.id, BACKLOG)}
                aria-label={t.todoToBacklogAria(r.title)}
                className={ACTION}
              >
                ← {t.todoToBacklog}
              </button>
            ) : (
              <button type="button" onClick={() => move(r.id, today)} className={ACTION}>
                {t.todoPlanToday}
              </button>
            )}
            <select
              value=""
              aria-label={t.todoMoveAria(r.title)}
              onChange={(e) => {
                const v = e.target.value;
                if (v) move(r.id, v);
              }}
              className={ACTION_SELECT}
            >
              <option value="">{t.todoMoveTo}</option>
              {moveOptions(r).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => startTransition(async () => void (await removeTodo(r.id)))}
              className={`${ACTION} hover:text-danger`}
            >
              {t.todoDelete}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  /**
   * Sieht bewusst anders aus als ein To-do: farbige Kante in der App-Farbe und
   * ein Wort davor. Es ist auch anders — verschieben laesst es sich nicht, denn
   * sein Tag steht im Rhythmus des Accounts, nicht in dieser Karte.
   */
  function postingCard(p: PlannerPosting) {
    return (
      <button
        key={`${p.accountKey}|${p.day}|${p.slot}`}
        type="button"
        onClick={() => togglePosting(p)}
        title="Aus dem Posting-Rhythmus dieses Accounts. Tag oder Anzahl aendert man im Posting-Reiter."
        className="flex items-start gap-2 rounded-[var(--radius-sm)] border bg-surface px-3 py-2 text-left transition-colors hover:border-fg-3"
        style={{ borderColor: "var(--line)", borderLeft: `3px solid ${p.appColor}` }}
      >
        <span
          className={`mt-[1px] flex items-center justify-center size-[16px] rounded-[4px] border shrink-0 ${
            p.done ? "bg-fg border-fg text-[var(--accent-fg)]" : "border-line-strong"
          }`}
        >
          {p.done ? (
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : null}
        </span>
        <span className="min-w-0">
          <span className={`block text-[13px] leading-snug break-words ${p.done ? "text-fg-4 line-through" : "text-fg"}`}>
            {p.handle ? `@${p.handle}` : "Handle fehlt"}
            {p.perDay > 1 ? <span className="text-fg-4"> · {p.slot}/{p.perDay}</span> : null}
          </span>
          <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-4">
            Posting · {p.appLabel}
            {p.format ? ` · ${p.format}` : ""}
          </span>
        </span>
      </button>
    );
  }

  /**
   * Der Kopf ueber den Posting-Punkten eines Tages. Eingeklappt sagt er, wie
   * viele es sind und wie viele davon stehen; ausgeklappt stehen die Karten
   * darunter. Beschriftet, nicht nur ein Pfeil: der Text sagt, was passiert.
   */
  function postingHead(iso: string, list: PlannerPosting[]) {
    const isOpen = openPostDays.has(iso);
    const done = list.filter((x) => x.done).length;
    const all = done === list.length;
    return (
      <button
        type="button"
        onClick={() => togglePostDay(iso)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 px-1 py-1 text-left [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4 hover:text-fg transition-colors"
      >
        <span className="inline-block w-[7px] shrink-0">{isOpen ? "\u25be" : "\u25b8"}</span>
        <span>Posting {list.length}</span>
        <span style={{ color: all ? "var(--fg-3)" : "var(--warning)" }}>
          {all ? "erledigt" : `${done}/${list.length}`}
        </span>
      </button>
    );
  }

  function column(key: string, head: React.ReactNode, list: PlannerTodo[], withTime: boolean, tint?: string, extra?: React.ReactNode) {
    const isOver = overCol === key && dragId !== null;
    return (
      <div
        key={key}
        data-today={key === today ? "1" : undefined}
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
        className="flex flex-col gap-2 rounded-[var(--radius-sm)] p-2.5 min-w-[230px] flex-1 transition-colors"
        style={{
          background: isOver ? "color-mix(in oklab,var(--fg) 7%,var(--surface-2))" : tint ?? "var(--surface-2)",
          outline: isOver ? "1px dashed var(--fg-3)" : "1px solid transparent",
          minHeight: 220,
        }}
      >
        {head}
        {extra}
        {list.map((r) => card(r, withTime))}
        {list.length === 0 && !extra ? (
          <div className="text-[11px] text-fg-4 px-1 py-2">{isOver ? t.todoDropHere : ""}</div>
        ) : null}
      </div>
    );
  }

  const openTotal = items.filter((r) => !r.done).length;

  return (
    <>
      <Card className="p-0 overflow-hidden mb-4">
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-line">
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
            className="flex-1 min-w-[220px]"
          />
          {/* Der neue Punkt darf gleich einen Tag haben — sonst schreibt man
              ihn und verschiebt ihn im nächsten Griff sofort weiter. */}
          <label className="flex items-center gap-1.5 [font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-4">
            {t.todoAddTo}
            <select
              value={addTarget}
              onChange={(e) => setAddTarget(e.target.value)}
              className="h-9 px-2 text-[12px] [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[var(--radius-sm)] focus:border-fg focus:outline-none cursor-pointer"
            >
              <option value={BACKLOG}>{t.todoBucketNone}</option>
              <option value={today}>{t.todoPlanToday}</option>
              <option value={tomorrow}>{t.todoPlanTomorrow}</option>
            </select>
          </label>
          <Button variant="pop" onClick={submit} disabled={!draft.trim()}>
            {t.todoAdd}
          </Button>
        </div>

        {/* Die Wochenzeile steht über beiden Ansichten (WeekNav) — hier bleibt
            nur, was den Planer allein betrifft. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 border-b border-line">
          <label className="flex items-center gap-1.5 [font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-4">
            {t.todoSearch}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t.todoSearchAria}
              className="h-8 w-[150px] px-2 text-[12px] [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none"
            />
          </label>
          {q ? (
            <span className="flex items-center gap-2 [font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-3">
              {t.todoSearchHits(open.length, openTotal)}
              <button type="button" onClick={() => setQuery("")} className={ACTION}>
                {t.todoSearchClear}
              </button>
            </span>
          ) : null}

          {posts.length > 0 ? (
            <button type="button" onClick={() => writeHidePosts(!hidePosts)} className={`${ACTION} ml-auto`}>
              {hidePosts ? `Posts zeigen (${posts.length})` : `Posts ausblenden (${posts.length})`}
            </button>
          ) : null}
        </div>

        <div className="p-3 overflow-x-auto" ref={scrollerRef}>
          <div className="flex gap-2.5 items-start" style={{ minWidth: 1180 }}>
            {column(
              BACKLOG,
              <div className="flex items-baseline gap-2 px-1 pb-1">
                <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3">
                  {t.todoBucketNone}
                </span>
                <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">{backlog.length}</span>
                <span className="[font-family:var(--font-mono)] text-[9px] text-fg-4">{t.todoBucketNoneHint}</span>
              </div>,
              backlog,
              false,
              "var(--surface)",
            )}

            {days.map((d) => {
              const list = forDay(d.iso);
              const dayPosts = hidePosts ? [] : postingsFor(d.iso);
              const openPosts = dayPosts.filter((x) => !x.done).length;
              return column(
                d.iso,
                <div className="flex items-baseline gap-2 px-1 pb-1">
                  <span
                    className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: d.isToday ? "var(--fg)" : "var(--fg-3)" }}
                  >
                    {d.weekday}
                  </span>
                  <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">{d.dayLabel}</span>
                  {/* Die Zahl macht eine volle Woche auf einen Blick lesbar —
                      sie zählt Posts mit, denn zu tun sind sie auch. */}
                  {list.length + openPosts > 0 ? (
                    <span className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">
                      {list.length + openPosts}
                    </span>
                  ) : null}
                  {d.isToday ? (
                    <span className="[font-family:var(--font-mono)] text-[8.5px] uppercase tracking-[0.1em] text-[var(--accent-fg)] bg-fg rounded-[3px] px-1 py-[1px]">
                      {t.todoBucketToday}
                    </span>
                  ) : null}
                </div>,
                list,
                true,
                d.isWeekend ? "color-mix(in oklab,var(--fg) 3%,var(--surface-2))" : undefined,
                dayPosts.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {postingHead(d.iso, dayPosts)}
                    {openPostDays.has(d.iso) ? dayPosts.map(postingCard) : null}
                  </div>
                ) : undefined,
              );
            })}
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
          <div className="p-3 flex flex-wrap gap-2">
            {stale.map((r) => (
              <div key={r.id} className="w-[260px]">
                {card(r, true)}
              </div>
            ))}
          </div>
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
