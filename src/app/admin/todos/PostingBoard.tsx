"use client";

// Posting-Board — eine Zeile pro Account, sieben Spalten für die Woche.
//
// Es beantwortet genau eine Frage: halte ich meinen Rhythmus? Deshalb steht
// links, was gelten SOLL (Zustand, an welchen Tagen gepostet wird), und rechts,
// was WAR (ein Haken pro Tag). Beides in einer Zeile nebeneinander, weil der
// Vergleich die ganze Information ist — untereinander müsste man ihn im Kopf
// machen.
//
// Drei Entscheidungen, die man der Oberfläche nicht ansieht:
//   - Der Rhythmus benennt Tage, keine Anzahl. "Dreimal pro Woche" liesse sich
//     nicht zeichnen; Mo·Mi·Fr schon, und der Kalender folgt daraus, ohne dass
//     jemand Termine erzeugen muss.
//   - Ein Haken ist eine Selbstauskunft, keine Messung. Die echte Postzahl liest
//     der Profil-Scraper auf /admin/content. Der wird hier bewusst NICHT
//     aufgerufen: er kostet Evomi-Guthaben und bis zu sieben Sekunden pro
//     Profil, und diese Seite wird mehrmals täglich geöffnet.
//   - Ein Tag lässt sich aufklappen. Dann wird seine Spalte breit und jede
//     Zelle bekommt ein Textfeld — für die Tage, an denen man wissen will, WAS
//     rausging, ohne dass die anderen sechs Spalten dafür Platz opfern.

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_STATES,
  ACCOUNT_STATE_LABEL,
  FORMAT_HINTS,
  WEEKDAYS,
  WEEKDAY_SHORT,
  type AccountState,
} from "@/lib/accountStates";
import { addAccount, markPosted, removeAccount, updateAccount } from "./posting-actions";

export interface BoardAccount {
  key: string;
  handle: string;
  platformLabel: string;
  appLabel: string;
  appColor: string;
  /** Blotato kann hier posten — abgeleitet aus der Account-Liste im Code. */
  automated: boolean;
  /** Selbst angelegt: lässt sich wieder entfernen, steht nicht im Code. */
  custom: boolean;
  state: AccountState;
  rhythm: number[];
  /** Was auf diesem Account rausgeht — steht auch in der Tagesliste. */
  format: string;
  note: string;
}

export interface BoardDay {
  iso: string;
  /** ISO-Wochentag 1–7, passend zum Rhythmus. */
  dow: number;
  weekday: string;
  dayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
}

export interface BoardApp {
  key: string;
  label: string;
}

const FIELD =
  "h-8 px-2 text-[12px] [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none";
const HEAD =
  "[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fg-4 text-left px-2.5 py-2 whitespace-nowrap";

export default function PostingBoard({
  accounts,
  days,
  apps,
  log,
  totals,
  platforms,
  today,
}: {
  accounts: BoardAccount[];
  days: BoardDay[];
  apps: BoardApp[];
  /** Haken je Account über alle Zeiten — „wie viel habe ich schon gepostet". */
  totals: Record<string, number>;
  /** "YYYY-MM-DD" in Europe/Zurich, vom Server — was verpasst ist, hängt daran. */
  today: string;
  /** Schlüssel "accountKey|YYYY-MM-DD" → Notiz (leer erlaubt). Vorhanden = gepostet. */
  log: Record<string, string>;
  /** Vorschläge fürs Plattform-Feld, aus dem was es schon gibt. */
  platforms: string[];
}) {
  const [, startTransition] = useTransition();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [hideDropped, setHideDropped] = useState(true);
  const [adding, setAdding] = useState(false);

  const [rows, patchRow] = useOptimistic(
    accounts,
    (state: BoardAccount[], p: { key: string } & Partial<BoardAccount>) =>
      state.map((r) => (r.key === p.key ? { ...r, ...p } : r)),
  );
  const [done, patchDone] = useOptimistic(
    log,
    (state: Record<string, string>, p: { k: string; on: boolean; note?: string }) => {
      const next = { ...state };
      if (p.on) next[p.k] = p.note ?? next[p.k] ?? "";
      else delete next[p.k];
      return next;
    },
  );

  const cellKey = (accountKey: string, iso: string) => `${accountKey}|${iso}`;
  const isDone = (accountKey: string, iso: string) => cellKey(accountKey, iso) in done;

  const shown = hideDropped ? rows.filter((r) => r.state !== "dropped") : rows;

  function setState(r: BoardAccount, state: AccountState) {
    startTransition(async () => {
      patchRow({ key: r.key, state });
      await updateAccount(r.key, { state });
    });
  }

  function toggleRhythm(r: BoardAccount, dow: number) {
    const rhythm = r.rhythm.includes(dow)
      ? r.rhythm.filter((d) => d !== dow)
      : [...r.rhythm, dow].sort((a, b) => a - b);
    startTransition(async () => {
      patchRow({ key: r.key, rhythm });
      await updateAccount(r.key, { rhythm });
    });
  }

  function toggleDone(r: BoardAccount, iso: string) {
    const k = cellKey(r.key, iso);
    const on = !(k in done);
    startTransition(async () => {
      patchDone({ k, on });
      await markPosted(r.key, iso, on);
    });
  }

  function setDayNote(r: BoardAccount, iso: string, note: string) {
    const k = cellKey(r.key, iso);
    startTransition(async () => {
      patchDone({ k, on: true, note });
      await markPosted(r.key, iso, true, note);
    });
  }

  // Soll und Ist der ganzen Woche — die Zahl, wegen der man das Board aufmacht.
  const live = rows.filter((r) => r.state === "active" || r.state === "warmup");
  const planned = live.reduce(
    (sum, r) => sum + days.filter((d) => r.rhythm.includes(d.dow)).length,
    0,
  );
  const posted = rows.reduce((sum, r) => sum + days.filter((d) => isDone(r.key, d.iso)).length, 0);
  const missed = live.reduce(
    (sum, r) =>
      sum + days.filter((d) => r.rhythm.includes(d.dow) && !isDone(r.key, d.iso) && d.iso < today).length,
    0,
  );

  const dayStat = (d: BoardDay) => {
    const soll = live.filter((r) => r.rhythm.includes(d.dow)).length;
    const ist = rows.filter((r) => isDone(r.key, d.iso)).length;
    return { soll, ist };
  };

  const weekStat = (r: BoardAccount) => ({
    soll: days.filter((d) => r.rhythm.includes(d.dow)).length,
    ist: days.filter((d) => isDone(r.key, d.iso)).length,
  });

  // Solange von Hand gepostet wird, ist das hier die eigentliche Frage: was
  // steht heute an? Deshalb steht sie oben und nicht als Spalte im Raster.
  const todayCol = days.find((d) => d.iso === today);
  const dueToday = todayCol
    ? shown.filter(
        (r) => r.rhythm.includes(todayCol.dow) && r.state !== "dropped" && r.state !== "paused",
      )
    : [];
  const extraToday = todayCol
    ? rows.filter((r) => isDone(r.key, todayCol.iso) && !dueToday.some((x) => x.key === r.key))
    : [];
  const doneToday = todayCol ? dueToday.filter((r) => isDone(r.key, todayCol.iso)).length : 0;

  const byHand = rows.filter((r) => !r.automated && r.state !== "dropped").length;
  const allTime = Object.entries(totals).reduce((sum, [, n]) => sum + n, 0);

  return (
    <Card className="p-0 overflow-hidden mt-4">
      <div className="px-5 py-3.5 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-x-7 gap-y-3">
          <Stat label="Accounts" value={String(rows.length)} sub={`${byHand} davon von Hand`} />
          <Stat
            label="Zustand"
            value={`${rows.filter((r) => r.state === "active").length} laufen`}
            sub={`${rows.filter((r) => r.state === "warmup").length} wärmen auf · ${rows.filter((r) => r.state === "paused").length} pausiert · ${rows.filter((r) => r.state === "dropped").length} aufgegeben`}
          />
          <Stat label="Diese Woche" value={`${posted} / ${planned}`} sub={missed > 0 ? `${missed} verpasst` : "nichts verpasst"} danger={missed > 0} />
          <Stat label="Insgesamt gepostet" value={String(allTime)} sub="deine Haken, alle Wochen" />
          <button
            type="button"
            onClick={() => setHideDropped((v) => !v)}
            className="[font-family:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-fg-4 hover:text-fg self-end pb-0.5"
          >
            {hideDropped ? "Aufgegebene zeigen" : "Aufgegebene ausblenden"}
          </button>
        </div>
      </div>

      {todayCol ? (
        <div className="px-5 py-4 border-b border-line" style={{ background: "var(--surface-2)" }}>
          <div className="flex items-baseline gap-2.5 mb-2.5">
            <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-2">
              Heute · {todayCol.weekday} {todayCol.dayLabel}
            </span>
            <span className="[font-family:var(--font-mono)] text-[10.5px] text-fg-4">
              {doneToday} von {dueToday.length} erledigt
            </span>
          </div>

          {dueToday.length === 0 ? (
            <p className="text-[12.5px] text-fg-3 m-0">
              Für heute ist nichts eingeplant. Der Rhythmus in der Tabelle unten legt fest, an welchen
              Tagen ein Account drankommt.
            </p>
          ) : (
            <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {dueToday.map((r) => {
                const ticked = isDone(r.key, todayCol.iso);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleDone(r, todayCol.iso)}
                    className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border bg-surface px-3 py-2.5 text-left transition-colors hover:border-fg-3"
                    style={{ borderColor: ticked ? "color-mix(in oklab,var(--fg) 35%,var(--line))" : "var(--line)" }}
                  >
                    <span
                      className={`flex items-center justify-center size-[18px] rounded-[4px] border shrink-0 ${
                        ticked ? "bg-fg border-fg text-[var(--accent-fg)]" : "border-line-strong"
                      }`}
                    >
                      {ticked ? (
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] truncate ${ticked ? "text-fg-4 line-through" : "text-fg"}`}>
                        {r.handle ? `@${r.handle}` : "Handle fehlt"}
                      </span>
                      {/* Das Format steht mit dabei: vor dem Posten ist „was
                          muss ich dafür produzieren" die eigentliche Frage. */}
                      <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-4">
                        {r.platformLabel} · {r.appLabel}
                        {r.format ? <span className="text-fg-2"> · {r.format}</span> : null}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {extraToday.length > 0 ? (
            <p className="text-[11.5px] text-fg-4 m-0 mt-2.5">
              Ausserdem heute gepostet, ohne dass es geplant war:{" "}
              {extraToday.map((r) => `@${r.handle}`).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Eigene Scroll-Box statt der ganzen Seite: nur so bleiben Kopfzeile und
          Account-Spalte beim Blättern stehen — sonst verliert man bei zwanzig
          Zeilen die Zuordnung, welcher Haken zu wem gehört. */}
      <div className="overflow-auto" style={{ maxHeight: "min(70vh, 760px)" }}>
        <table className="w-full border-collapse" style={{ minWidth: 1320 }}>
          <thead className="sticky top-0 z-20" style={{ background: "var(--surface)" }}>
            <tr className="border-b border-line">
              <th
                className={`${HEAD} sticky left-0 z-30`}
                style={{ minWidth: 210, background: "var(--surface)" }}
              >
                Account
              </th>
              <th className={HEAD} style={{ minWidth: 104 }}>Zustand</th>
              <th className={HEAD} style={{ minWidth: 130 }}>Format</th>
              {/* Notiz steht neben dem Format, nicht hinter der Woche: was du
                  dir überlegt hast, gehört neben das, worauf es sich bezieht —
                  sonst liest man es erst, wenn man ganz nach rechts scrollt. */}
              <th className={HEAD} style={{ minWidth: 230 }}>Notiz</th>
              <th className={HEAD} style={{ minWidth: 150 }}>Rhythmus</th>
              {days.map((d) => {
                const { soll, ist } = dayStat(d);
                const open = openDay === d.iso;
                return (
                  <th
                    key={d.iso}
                    className="px-1.5 py-1.5 align-bottom"
                    style={{
                      minWidth: open ? 210 : 60,
                      background: d.isWeekend ? "color-mix(in oklab,var(--fg) 3%,transparent)" : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDay(open ? null : d.iso)}
                      title={open ? "Tag wieder zuklappen" : "Tag aufklappen"}
                      className="w-full text-left"
                    >
                      <div
                        className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: d.isToday ? "var(--fg)" : "var(--fg-3)" }}
                      >
                        {d.weekday}
                      </div>
                      <div className="[font-family:var(--font-mono)] text-[9px] text-fg-4">{d.dayLabel}</div>
                      <div
                        className="[font-family:var(--font-mono)] text-[9px] mt-0.5"
                        style={{ color: soll > 0 && ist >= soll ? "var(--success,var(--fg-2))" : "var(--fg-4)" }}
                      >
                        {ist}/{soll}
                      </div>
                    </button>
                  </th>
                );
              })}
              <th className={`${HEAD} text-right`} style={{ minWidth: 66 }}>Woche</th>
              <th className={`${HEAD} text-right`} style={{ minWidth: 66 }}>Gesamt</th>
            </tr>
          </thead>

          <tbody>
            {shown.map((r, i) => {
              const first = i === 0 || shown[i - 1].appLabel !== r.appLabel;
              return (
                <Fragment key={r.key}>
                  {first ? (
                    <tr>
                      <td colSpan={7 + days.length} className="px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                        <span className="inline-flex items-center gap-2">
                          <span className="size-[8px] rounded-full" style={{ background: r.appColor }} />
                          <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-2">
                            {r.appLabel}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ) : null}

                  <tr className="border-t border-line" style={{ opacity: r.state === "dropped" ? 0.5 : 1 }}>
                    <td
                      className="px-2.5 py-2 sticky left-0 z-10 align-top"
                      style={{ minWidth: 210, background: "var(--surface)" }}
                    >
                      <div className="text-[13px] text-fg">
                        {r.handle ? `@${r.handle}` : <span className="text-fg-4">Handle fehlt</span>}
                      </div>
                      <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4">
                        {r.platformLabel}
                        {r.automated ? " · Blotato" : ""}
                        {r.custom ? (
                          <>
                            {" · "}
                            <button
                              type="button"
                              onClick={() => startTransition(async () => void (await removeAccount(r.key)))}
                              className="hover:text-danger underline decoration-dotted"
                            >
                              entfernen
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-2.5 py-2">
                      <select
                        value={r.state}
                        aria-label={`Zustand von @${r.handle}`}
                        onChange={(e) => setState(r, e.target.value as AccountState)}
                        className={`${FIELD} cursor-pointer`}
                      >
                        {ACCOUNT_STATES.map((s) => (
                          <option key={s} value={s}>
                            {ACCOUNT_STATE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2.5 py-2 align-top">
                      <input
                        list="klar-formats"
                        defaultValue={r.format}
                        placeholder="Slideshow …"
                        aria-label={`Format von @${r.handle}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === r.format) return;
                          startTransition(async () => {
                            patchRow({ key: r.key, format: v });
                            await updateAccount(r.key, { format: v });
                          });
                        }}
                        className={`${FIELD} w-full`}
                      />
                    </td>

                    <td className="px-2.5 py-2 align-top">
                      <GrowArea
                        defaultValue={r.note}
                        placeholder="warum, seit wann, was als Nächstes"
                        ariaLabel={`Notiz zu @${r.handle}`}
                        onCommit={(v) => {
                          if (v === r.note) return;
                          startTransition(async () => {
                            patchRow({ key: r.key, note: v });
                            await updateAccount(r.key, { note: v });
                          });
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <div className="flex gap-[3px]">
                        {WEEKDAYS.map((d) => {
                          const on = r.rhythm.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => toggleRhythm(r, d)}
                              aria-pressed={on}
                              aria-label={`${WEEKDAY_SHORT[d]} für @${r.handle} ${on ? "abwählen" : "einplanen"}`}
                              className={`size-[19px] rounded-[4px] border [font-family:var(--font-mono)] text-[8.5px] uppercase transition-colors ${
                                on
                                  ? "bg-fg border-fg text-[var(--accent-fg)]"
                                  : "border-line text-fg-4 hover:border-fg-3 hover:text-fg-2"
                              }`}
                            >
                              {WEEKDAY_SHORT[d].slice(0, 2)}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {days.map((d) => {
                      const open = openDay === d.iso;
                      const ticked = isDone(r.key, d.iso);
                      const due = r.rhythm.includes(d.dow) && r.state !== "dropped" && r.state !== "paused";
                      return (
                        <td
                          key={d.iso}
                          className="px-1.5 py-2 align-top"
                          style={{
                            background: d.isWeekend ? "color-mix(in oklab,var(--fg) 3%,transparent)" : undefined,
                          }}
                        >
                          <div className="flex items-start gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleDone(r, d.iso)}
                              aria-pressed={ticked}
                              aria-label={`@${r.handle} am ${d.dayLabel} ${ticked ? "nicht gepostet" : "gepostet"}`}
                              title={due ? "Eingeplant" : "Nicht eingeplant — Haken geht trotzdem"}
                              className={`mt-[1px] flex items-center justify-center size-[18px] rounded-[4px] border shrink-0 transition-colors ${
                                ticked
                                  ? "bg-fg border-fg text-[var(--accent-fg)]"
                                  : due
                                    ? "border-line-strong hover:border-fg"
                                    : "border-dashed border-line text-fg-4 hover:border-fg-3"
                              }`}
                            >
                              {ticked ? (
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              ) : null}
                            </button>
                            {open ? (
                              <GrowArea
                                defaultValue={done[cellKey(r.key, d.iso)] ?? ""}
                                placeholder={r.format ? `${r.format} — was ging raus?` : "was ging raus?"}
                                ariaLabel={`Notiz für @${r.handle} am ${d.dayLabel}`}
                                onCommit={(v) => {
                                  if (v === (done[cellKey(r.key, d.iso)] ?? "")) return;
                                  setDayNote(r, d.iso, v);
                                }}
                              />
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-2.5 py-2 text-right [font-family:var(--font-mono)] text-[12px] [font-variant-numeric:tabular-nums]">
                      {(() => {
                        const { soll, ist } = weekStat(r);
                        return (
                          <span style={{ color: soll > 0 && ist >= soll ? "var(--fg)" : "var(--fg-3)" }}>
                            {ist}
                            <span className="text-fg-4">/{soll}</span>
                          </span>
                        );
                      })()}
                    </td>

                    <td className="px-2.5 py-2 text-right [font-family:var(--font-mono)] text-[12px] text-fg-3 [font-variant-numeric:tabular-nums]">
                      {totals[r.key] ?? 0}
                    </td>

                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Vorschläge: erst was schon eingetragen ist, dann die Startliste —
            eigene Bezeichnungen sollen sich durchsetzen, nicht meine. */}
        <datalist id="klar-formats">
          {[...new Set([...rows.map((r) => r.format).filter(Boolean), ...FORMAT_HINTS])].map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>

      <div className="px-5 py-3 border-t border-line">
        {adding ? (
          <AddAccountForm
            apps={apps}
            platforms={platforms}
            onCancel={() => setAdding(false)}
            onSubmit={(app, platform, handle) => {
              setAdding(false);
              startTransition(async () => {
                await addAccount(app, platform, handle);
              });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 hover:text-fg"
          >
            Account hinzuf&uuml;gen
          </button>
        )}
      </div>
    </Card>
  );
}

/**
 * Notizfeld, das beim Schreiben nach unten aufgeht statt in einer Zeile zu
 * scrollen. Eine Notiz, von der man immer nur sieben Wörter sieht, schreibt
 * niemand zu Ende.
 *
 * Gespeichert wird beim Verlassen des Feldes, nicht bei jedem Zeichen — sonst
 * schriebe jeder Tastendruck in die Datenbank. `defaultValue` statt `value`:
 * das Feld gehört dem Browser, bis es fertig ist.
 */
function GrowArea({
  defaultValue,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function fit() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  // Auch beim ersten Zeichnen: ein gespeicherter Dreizeiler muss dreizeilig
  // ankommen, nicht abgeschnitten.
  useEffect(fit, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={defaultValue}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onInput={fit}
      onBlur={(e) => onCommit(e.target.value.trim())}
      className="w-full min-w-0 px-2 py-1.5 text-[12px] leading-snug [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none"
      style={{ resize: "none", overflow: "hidden" }}
    />
  );
}

function Stat({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div>
      <div className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fg-4">
        {label}
      </div>
      <div className="text-[19px] leading-tight text-fg [font-variant-numeric:tabular-nums]">{value}</div>
      <div className="text-[11px] leading-snug" style={{ color: danger ? "var(--danger)" : "var(--fg-4)" }}>
        {sub}
      </div>
    </div>
  );
}

/**
 * Ein Account, den die Liste im Code nicht kennt — YouTube, Threads, ein
 * zweiter Zweitaccount. Bis hierher brauchte so etwas einen Deploy.
 */
function AddAccountForm({
  apps,
  platforms,
  onSubmit,
  onCancel,
}: {
  apps: BoardApp[];
  platforms: string[];
  onSubmit: (app: string, platform: string, handle: string) => void;
  onCancel: () => void;
}) {
  const [app, setApp] = useState(apps[0]?.key ?? "");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const ready = Boolean(app && platform.trim() && handle.trim());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
        App
        <select value={app} onChange={(e) => setApp(e.target.value)} className={`${FIELD} cursor-pointer`}>
          {apps.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
        Plattform
        <input
          list="klar-platforms"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="youtube"
          className={`${FIELD} w-[140px]`}
        />
        <datalist id="klar-platforms">
          {platforms.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-fg-4">
        Handle
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="ohne @"
          className={`${FIELD} w-[180px]`}
        />
      </label>
      <Button variant="pop" size="sm" disabled={!ready} onClick={() => onSubmit(app, platform, handle)}>
        Hinzuf&uuml;gen
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Abbrechen
      </Button>
    </div>
  );
}
