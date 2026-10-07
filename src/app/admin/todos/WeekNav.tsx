"use client";

// Die Wochenzeile über dem Planer.
//
// Vor und zurück sind Links, keine Knöpfe: der Tag kommt vom Server, und ein
// Wochenwechsel soll im Verlauf stehen und sich teilen lassen. Nur der Sprung
// auf ein Datum rechnet im Browser — er muss den Versatz zur aktuellen Woche
// kennen, und dafür reicht der heutige Tag, den der Server mitgibt.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { tAdmin, type AdminLang } from "../_i18n";

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche, in der `iso` liegt. */
function mondayOfIso(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return addDaysIso(iso, dow === 0 ? -6 : 1 - dow);
}

/** Ganze Wochen zwischen zwei Montagen — der Wert für `?w=`. */
function weeksBetween(fromMonday: string, toMonday: string): number {
  const ms = Date.parse(`${toMonday}T12:00:00Z`) - Date.parse(`${fromMonday}T12:00:00Z`);
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

export default function WeekNav({
  lang,
  weekLabel,
  weekOffset,
  today,
}: {
  lang: AdminLang;
  weekLabel: string;
  weekOffset: number;
  /** "YYYY-MM-DD" in Europe/Zurich, vom Server. */
  today: string;
}) {
  const t = tAdmin(lang);
  const router = useRouter();
  const href = (w: number) => (w !== 0 ? `/admin/todos?w=${w}` : "/admin/todos");

  function jumpTo(iso: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    router.push(href(weeksBetween(mondayOfIso(today), mondayOfIso(iso))));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link href={href(weekOffset - 1)} className="applink text-[12px]">
        ‹ {t.todoPrevWeek}
      </Link>
      <span className="[font-family:var(--font-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-2">
        {weekLabel}
      </span>
      <Link href={href(weekOffset + 1)} className="applink text-[12px]">
        {t.todoNextWeek} ›
      </Link>
      {weekOffset !== 0 ? (
        <Link href={href(0)} className="applink text-[12px]">
          {t.todoThisWeek}
        </Link>
      ) : null}

      <label className="flex items-center gap-1.5 [font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-fg-4">
        {t.todoJumpWeek}
        <input
          type="date"
          aria-label={t.todoJumpWeekAria}
          onChange={(e) => jumpTo(e.target.value)}
          className="h-8 px-1.5 text-[12px] [font-family:var(--font-mono)] text-fg-2 bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none"
        />
      </label>
    </div>
  );
}
