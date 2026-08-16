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
//   - Ein Verbund ist ein Name, keine Verknüpfung. Wer denselben Namen trägt,
//     postet dasselbe Material; die Tagesliste schreibt das an jeden Post, weil
//     „das ist derselbe Upload wie vorhin" beim Posten die teuerste Information
//     ist, die man sonst erst nach dem Exportieren bemerkt.

import {
  Fragment,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_STATES,
  ACCOUNT_STATE_LABEL,
  FORMAT_HINTS,
  MAX_PER_DAY,
  STEER_ROUNDS,
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
  /** Wo das Material dafür liegt — Ordner, Drive, Link, Anweisung. */
  material: string;
  /** Liegt dort gerade Postbares bereit? Selbstauskunft, wie die Haken. */
  materialReady: boolean;
  /** Zielnische — wohin der Account zeigen soll. */
  niche: string;
  /** Content-Verbund: gleicher Name = dasselbe Material wie auf den anderen. */
  contentGroup: string;
  /** Ein Zeitstempel je erledigter Einsteuer-Runde, höchstens drei. */
  steeredRounds: string[];
  /** Wie oft an einem Posting-Tag gepostet wird (1–4). */
  perDay: number;
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
// Ob die Heute-Liste offen steht — im Browser, nicht im Vault: die Wahl gilt
// für dieses Gerät. Gelesen wird sie über `useSyncExternalStore` und nicht per
// `setState` im Effekt; die Lint-Regel `react-hooks/set-state-in-effect` verbietet
// das zu Recht, und derselbe Weg steht schon im Wochenplan (`Planner.tsx`).
const TODAY_OPEN_KEY = "klar_posting_today_open";

let todayOpenCache: boolean | null = null;
const todayOpenListeners = new Set<() => void>();

function readTodayOpen(): boolean {
  if (todayOpenCache === null) {
    try {
      todayOpenCache = window.localStorage.getItem(TODAY_OPEN_KEY) !== "0";
    } catch {
      todayOpenCache = true; // privater Modus o. Ä.
    }
  }
  return todayOpenCache;
}

function writeTodayOpen(next: boolean): void {
  todayOpenCache = next;
  try {
    window.localStorage.setItem(TODAY_OPEN_KEY, next ? "1" : "0");
  } catch {
    // dann gilt die Wahl eben nur für diese Sitzung
  }
  for (const l of todayOpenListeners) l();
}

function subscribeTodayOpen(cb: () => void): () => void {
  todayOpenListeners.add(cb);
  return () => {
    todayOpenListeners.delete(cb);
  };
}

const CHIP =
  "[font-family:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] px-2 py-1 rounded-[4px] border transition-colors whitespace-nowrap";

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
  // Isolieren: solange die Menge leer ist, gilt das ganze Board. Sobald ein
  // Kanal drin steht, zeigt die Seite nur noch ihn — Zahlen eingeschlossen,
  // denn eine gefilterte Tabelle über einer ungefilterten Bilanz liest sich
  // wie ein Fehler.
  const [focus, setFocus] = useState<string[]>([]);
  // Die Heute-Liste ist der Grund, warum man die Seite öffnet — sie steht
  // deshalb offen und lässt sich zuklappen, wenn die Tabelle darunter dran ist.
  const todayOpen = useSyncExternalStore(subscribeTodayOpen, readTodayOpen, () => true);

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

  // Der Schlüssel trägt den Slot: bei zweimal täglich sind das zwei Haken am
  // selben Tag, und beide müssen sich einzeln setzen lassen.
  const cellKey = (accountKey: string, iso: string, slot: number) => `${accountKey}|${iso}|${slot}`;
  const isDone = (accountKey: string, iso: string, slot: number) => cellKey(accountKey, iso, slot) in done;
  /** Wie viele der Slots eines Tages schon abgehakt sind. */
  const doneCount = (r: BoardAccount, iso: string) =>
    slotsOf(r).filter((n) => isDone(r.key, iso, n)).length;
  const slotsOf = (r: BoardAccount) => Array.from({ length: r.perDay }, (_, i) => i + 1);

  // Isoliert wird vor allem anderen: ab hier rechnet und zeichnet die Seite nur
  // noch mit `visible`. `rows` bleibt die volle Liste — die Kanalauswahl oben
  // muss auch die Kanäle anbieten, die gerade ausgeblendet sind.
  const visible = focus.length ? rows.filter((r) => focus.includes(r.key)) : rows;
  const shown = hideDropped ? visible.filter((r) => r.state !== "dropped") : visible;

  const isolated = focus.length > 0;
  function toggleFocus(key: string) {
    setFocus((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));
  }
  /** Ganze App isolieren — ein Klick statt sieben. */
  function focusApp(appLabel: string) {
    const keys = rows.filter((r) => r.appLabel === appLabel).map((r) => r.key);
    const all = keys.every((k) => focus.includes(k));
    setFocus((f) => (all ? f.filter((k) => !keys.includes(k)) : [...new Set([...f, ...keys])]));
  }

  /**
   * Die anderen Kanäle desselben Verbunds. Genau das ist die Frage beim Posten:
   * habe ich dieses Material gerade schon einmal hochgeladen?
   */
  const groupMates = (r: BoardAccount) =>
    r.contentGroup
      ? rows.filter(
          (o) => o.key !== r.key && o.contentGroup === r.contentGroup && o.state !== "dropped",
        )
      : [];

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

  /** Stand der Einsteuer-Runden setzen (0–3), optimistisch wie alles hier. */
  function setSteered(r: BoardAccount, n: number) {
    const now = new Date().toISOString();
    const next =
      n <= r.steeredRounds.length
        ? r.steeredRounds.slice(0, n)
        : [...r.steeredRounds, ...Array.from({ length: n - r.steeredRounds.length }, () => now)];
    startTransition(async () => {
      patchRow({ key: r.key, steeredRounds: next });
      await updateAccount(r.key, { steeredRounds: n });
    });
  }

  function toggleMaterialReady(r: BoardAccount) {
    const materialReady = !r.materialReady;
    startTransition(async () => {
      patchRow({ key: r.key, materialReady });
      await updateAccount(r.key, { materialReady });
    });
  }

  function toggleDone(r: BoardAccount, iso: string, slot: number) {
    const k = cellKey(r.key, iso, slot);
    const on = !(k in done);
    startTransition(async () => {
      patchDone({ k, on });
      await markPosted(r.key, iso, slot, on);
    });
  }

  function setDayNote(r: BoardAccount, iso: string, slot: number, note: string) {
    const k = cellKey(r.key, iso, slot);
    startTransition(async () => {
      patchDone({ k, on: true, note });
      await markPosted(r.key, iso, slot, true, note);
    });
  }

  /** Frequenz: wie oft an einem Tag, an dem der Account dran ist. */
  function setPerDay(r: BoardAccount, perDay: number) {
    startTransition(async () => {
      patchRow({ key: r.key, perDay });
      await updateAccount(r.key, { perDay });
    });
  }

  // Soll und Ist der ganzen Woche — die Zahl, wegen der man das Board aufmacht.
  const live = visible.filter((r) => r.state === "active" || r.state === "warmup");
  const planned = live.reduce(
    (sum, r) => sum + days.filter((d) => r.rhythm.includes(d.dow)).length * r.perDay,
    0,
  );
  const posted = visible.reduce((sum, r) => sum + days.reduce((n, d) => n + doneCount(r, d.iso), 0), 0);
  const missed = live.reduce(
    (sum, r) =>
      sum +
      days
        .filter((d) => r.rhythm.includes(d.dow) && d.iso < today)
        .reduce((n, d) => n + (r.perDay - doneCount(r, d.iso)), 0),
    0,
  );

  const dayStat = (d: BoardDay) => {
    const soll = live.filter((r) => r.rhythm.includes(d.dow)).reduce((n, r) => n + r.perDay, 0);
    const ist = visible.reduce((n, r) => n + doneCount(r, d.iso), 0);
    return { soll, ist };
  };

  const weekStat = (r: BoardAccount) => ({
    soll: days.filter((d) => r.rhythm.includes(d.dow)).length * r.perDay,
    ist: days.reduce((n, d) => n + doneCount(r, d.iso), 0),
  });

  // Solange von Hand gepostet wird, ist das hier die eigentliche Frage: was
  // steht heute an? Deshalb steht sie oben und nicht als Spalte im Raster.
  const todayCol = days.find((d) => d.iso === today);
  // Ein Eintrag je Post, nicht je Account: bei zweimal taeglich sind das zwei
  // Sachen zu tun, und eine Liste, die daraus eine macht, ist gelogen.
  const dueToday = todayCol
    ? shown
        .filter((r) => r.rhythm.includes(todayCol.dow) && r.state !== "dropped" && r.state !== "paused")
        .flatMap((r) => slotsOf(r).map((slot) => ({ r, slot })))
    : [];
  const extraToday = todayCol
    ? visible.filter((r) => doneCount(r, todayCol.iso) > 0 && !dueToday.some((x) => x.r.key === r.key))
    : [];
  const doneToday = todayCol ? dueToday.filter((x) => isDone(x.r.key, todayCol.iso, x.slot)).length : 0;

  const byHand = visible.filter((r) => !r.automated && r.state !== "dropped").length;
  // Im Warm-up ist das die Zahl, die den Fortschritt zeigt — nicht die Posts.
  const relevant = visible.filter((r) => r.state !== "dropped");
  const steered = relevant.filter((r) => r.steeredRounds.length >= STEER_ROUNDS).length;
  const allTime = visible.reduce((sum, r) => sum + (totals[r.key] ?? 0), 0);

  // Kanalauswahl: nach App gebündelt, in der Reihenfolge der Tabelle. Aufgegebene
  // Accounts stehen nur drin, wenn sie ohnehin gezeigt werden — sonst wäre die
  // Leiste voll mit Kanälen, die es nicht mehr gibt.
  const pickable = hideDropped ? rows.filter((r) => r.state !== "dropped") : rows;
  const appGroups = [...new Set(pickable.map((r) => r.appLabel))].map((label) => ({
    label,
    accounts: pickable.filter((r) => r.appLabel === label),
  }));

  return (
    <Card className="p-0 overflow-hidden mt-4">
      <div className="px-5 py-3.5 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-x-7 gap-y-3">
          <Stat
            label={isolated ? `Accounts (von ${rows.length})` : "Accounts"}
            value={String(visible.length)}
            sub={`${byHand} davon von Hand`}
          />
          <Stat
            label="Zustand"
            value={`${visible.filter((r) => r.state === "active").length} laufen`}
            sub={`${visible.filter((r) => r.state === "warmup").length} wärmen auf · ${visible.filter((r) => r.state === "paused").length} pausiert · ${visible.filter((r) => r.state === "dropped").length} aufgegeben`}
          />
          <Stat label="Diese Woche" value={`${posted} / ${planned}`} sub={missed > 0 ? `${missed} verpasst` : "nichts verpasst"} danger={missed > 0} />
          <Stat
            label="Eingesteuert"
            value={`${steered} / ${relevant.length}`}
            sub={steered === relevant.length ? "alle in ihrer Nische" : `${relevant.length - steered} noch nicht gezogen`}
          />
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

      {/* Kanäle isolieren. Vierundzwanzig Zeilen sind der Überblick; wer an
          einem Kanal arbeitet, will die anderen dreiundzwanzig für ein paar
          Minuten nicht sehen. Die Auswahl steht bewusst im Browser und nicht in
          der URL: sie ist ein Blickwinkel, kein Ort, den man verlinkt. */}
      <div className="px-5 py-2.5 border-b border-line" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-start gap-3">
          <span className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fg-4 pt-1.5 shrink-0">
            Kanäle
          </span>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setFocus([])}
              className={`${CHIP} ${
                isolated
                  ? "border-line text-fg-4 hover:border-fg-3 hover:text-fg-2"
                  : "bg-fg border-fg text-[var(--accent-fg)]"
              }`}
            >
              Alle
            </button>
            {appGroups.map((g) => {
              const keys = g.accounts.map((a) => a.key);
              const whole = keys.every((k) => focus.includes(k));
              return (
                <Fragment key={g.label}>
                  <span className="w-px self-stretch bg-[var(--line)] mx-0.5" />
                  <button
                    type="button"
                    onClick={() => focusApp(g.label)}
                    title={`Alle Kanäle von ${g.label}`}
                    className={`${CHIP} font-semibold ${
                      whole
                        ? "bg-fg border-fg text-[var(--accent-fg)]"
                        : "border-line-strong text-fg-2 hover:border-fg"
                    }`}
                  >
                    {g.label}
                  </button>
                  {g.accounts.map((a) => {
                    const on = focus.includes(a.key);
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => toggleFocus(a.key)}
                        aria-pressed={on}
                        title={`@${a.handle} — ${a.platformLabel}`}
                        className={`${CHIP} ${
                          on
                            ? "bg-fg border-fg text-[var(--accent-fg)]"
                            : "border-line text-fg-4 hover:border-fg-3 hover:text-fg-2"
                        }`}
                      >
                        @{a.handle || "?"}
                        {a.contentGroup ? <span className="opacity-60"> ⇄</span> : null}
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {todayCol ? (
        <div className="px-5 py-4 border-b border-line" style={{ background: "var(--surface-2)" }}>
          {/* Zugeklappt bleibt die Zeile stehen, die sagt, wie weit der Tag ist —
              eine Liste, die man einklappt, soll ihre Zahl nicht mitnehmen. */}
          <button
            type="button"
            onClick={() => writeTodayOpen(!todayOpen)}
            aria-expanded={todayOpen}
            className={`flex items-baseline gap-2.5 text-left ${todayOpen ? "mb-2.5" : ""}`}
          >
            <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-2">
              <span className="inline-block w-[9px] text-fg-4">{todayOpen ? "−" : "+"}</span>{" "}
              Heute · {todayCol.weekday} {todayCol.dayLabel}
            </span>
            <span className="[font-family:var(--font-mono)] text-[10.5px] text-fg-4">
              {doneToday} von {dueToday.length} erledigt
            </span>
          </button>

          {!todayOpen ? null : dueToday.length === 0 ? (
            <p className="text-[12.5px] text-fg-3 m-0">
              Für heute ist nichts eingeplant. Der Rhythmus in der Tabelle unten legt fest, an welchen
              Tagen ein Account drankommt.
            </p>
          ) : (
            <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {dueToday.map(({ r, slot }) => {
                const ticked = isDone(r.key, todayCol.iso, slot);
                // Wer dasselbe Material trägt, steht am Post — mit Haken, wenn
                // er heute schon draussen ist. Dann weiss man beim Exportieren
                // schon, dass die Datei nur noch hochgeladen werden muss.
                const mates = groupMates(r).map((m) => ({
                  m,
                  posted: doneCount(m, todayCol.iso) > 0,
                }));
                return (
                  // Karte statt Knopf: die Materialangabe kann ein Link sein,
                  // und ein <a> darf nicht in einem <button> stehen. Der
                  // Abhaken-Bereich bleibt der Knopf, er füllt die Karte.
                  <div
                    key={`${r.key}|${slot}`}
                    className="rounded-[var(--radius-sm)] border bg-surface transition-colors hover:border-fg-3"
                    style={{ borderColor: ticked ? "color-mix(in oklab,var(--fg) 35%,var(--line))" : "var(--line)" }}
                  >
                  <button
                    type="button"
                    onClick={() => toggleDone(r, todayCol.iso, slot)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
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
                        {r.perDay > 1 ? (
                          <span className="text-fg-4">
                            {" "}
                            · Post {slot} von {r.perDay}
                          </span>
                        ) : null}
                      </span>
                      {/* Das Format steht mit dabei: vor dem Posten ist „was
                          muss ich dafür produzieren" die eigentliche Frage. */}
                      <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-4">
                        {r.platformLabel} · {r.appLabel}
                        {r.format ? <span className="text-fg-2"> · {r.format}</span> : null}
                        {r.niche ? <span> · {r.niche}</span> : null}
                      </span>
                      {mates.length > 0 ? (
                        <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-2">
                          &#8644; {r.contentGroup} · gleich wie{" "}
                          {mates.map(({ m, posted }, i) => (
                            <span key={m.key} style={{ color: posted ? "var(--fg-4)" : undefined }}>
                              {i > 0 ? ", " : ""}@{m.handle}
                              {posted ? " ✓" : ""}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {/* Auf einen Account, dessen Feed noch nicht in der Nische
                          steht, zu posten heisst, ihn ans falsche Publikum
                          auszuliefern. Das gehört vor den Post, nicht in eine
                          Spalte weit rechts. */}
                      {r.steeredRounds.length < STEER_ROUNDS ? (
                        <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-warning">
                          {r.steeredRounds.length === 0
                            ? "noch nicht eingesteuert"
                            : `erst ${r.steeredRounds.length} von ${STEER_ROUNDS} Runden`}
                        </span>
                      ) : null}
                      {/* Dieselbe Logik wie beim Einsteuern: was den Post
                          verhindert, steht am Post — nicht in einer Spalte
                          weiter rechts. */}
                      {!r.materialReady ? (
                        <span className="block [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-warning">
                          Material noch nicht bereit
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {r.material ? <MaterialHint text={r.material} /> : null}
                  </div>
                );
              })}
            </div>
          )}

          {todayOpen && extraToday.length > 0 ? (
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
        <table className="w-full border-collapse" style={{ minWidth: 1490 }}>
          <thead className="sticky top-0 z-20" style={{ background: "var(--surface)" }}>
            <tr className="border-b border-line">
              <th
                className={`${HEAD} sticky left-0 z-30`}
                style={{ minWidth: 210, background: "var(--surface)" }}
              >
                Account
              </th>
              <th className={HEAD} style={{ minWidth: 104 }}>Zustand</th>
              {/* Nische und „eingesteuert" gehören in eine Zelle: das Häkchen
                  bedeutet nichts ohne das Ziel, auf das es sich bezieht. */}
              <th className={HEAD} style={{ minWidth: 170 }}>Zielnische</th>
              <th className={HEAD} style={{ minWidth: 250 }}>Format, Material &amp; Verbund</th>
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
                      <td colSpan={8 + days.length} className="px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                        <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-2">
                          {r.appLabel}
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
                      {/* Der Verbund gehört an den Kanal, nicht nur ins Format:
                          hier sucht man, wenn man wissen will, ob dieser Kanal
                          eigenes Material braucht. */}
                      {groupMates(r).length > 0 ? (
                        <div
                          className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-3 mt-0.5"
                          title={`Gleiches Material wie ${groupMates(r).map((m) => `@${m.handle}`).join(", ")}`}
                        >
                          &#8644; {r.contentGroup}
                        </div>
                      ) : null}
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
                        list="klar-niches"
                        defaultValue={r.niche}
                        placeholder="z. B. Häkeln"
                        aria-label={`Zielnische von @${r.handle}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === r.niche) return;
                          startTransition(async () => {
                            patchRow({ key: r.key, niche: v });
                            await updateAccount(r.key, { niche: v });
                          });
                        }}
                        className={`${FIELD} w-full`}
                      />
                      {/* Drei Runden, drei Kästchen. Ein Klick auf das dritte
                          setzt auch die ersten beiden — nachträglich einzeln
                          abzuhaken, was ohnehin der Reihe nach passiert, wäre
                          nur Arbeit. Ein Klick auf ein schon gefülltes nimmt
                          ab da wieder weg. */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex gap-[3px]">
                          {Array.from({ length: STEER_ROUNDS }, (_, i) => {
                            const n = i + 1;
                            const filled = r.steeredRounds.length >= n;
                            const stamp = r.steeredRounds[i];
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setSteered(r, filled && r.steeredRounds.length === n ? n - 1 : n)}
                                aria-pressed={filled}
                                aria-label={`Einsteuer-Runde ${n} von ${STEER_ROUNDS} für @${r.handle}`}
                                title={
                                  stamp
                                    ? `${n}. Runde am ${new Date(stamp).toLocaleDateString("de-CH")}`
                                    : `${n}. Runde noch offen`
                                }
                                className={`flex items-center justify-center size-[15px] rounded-[4px] border shrink-0 transition-colors ${
                                  filled
                                    ? "bg-fg border-fg text-[var(--accent-fg)]"
                                    : "border-line-strong hover:border-fg"
                                }`}
                              >
                                {filled ? (
                                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        <span
                          className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]"
                          style={{
                            color: r.steeredRounds.length >= STEER_ROUNDS ? "var(--fg-2)" : "var(--fg-4)",
                          }}
                        >
                          eingesteuert
                        </span>
                      </div>
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
                      {/* Woher das Zeug kommt, steht direkt unter dem, was es
                          ist — beim Posten wird beides in derselben Sekunde
                          gebraucht, und getrennte Spalten hätten die Zeile
                          nur breiter gemacht. */}
                      <div className="mt-1">
                        <GrowArea
                          defaultValue={r.material}
                          placeholder="Material: Ordner, Drive, Link …"
                          ariaLabel={`Wo das Material für @${r.handle} liegt`}
                          mono
                          onCommit={(v) => {
                            if (v === r.material) return;
                            startTransition(async () => {
                              patchRow({ key: r.key, material: v });
                              await updateAccount(r.key, { material: v });
                            });
                          }}
                        />
                      </div>
                      {/* Der Ort sagt nicht, ob dort etwas Postbares WARTET.
                          Genau ein Haken: beim Wochenstart gesetzt, beim
                          Leerposten weggenommen — die Heute-Liste warnt dann,
                          BEVOR man vor leerem Ordner steht. */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => toggleMaterialReady(r)}
                          aria-pressed={r.materialReady}
                          aria-label={`Material für @${r.handle} ${r.materialReady ? "als nicht bereit markieren" : "als bereit markieren"}`}
                          title={r.materialReady ? "Material liegt bereit" : "Material noch nicht bereit"}
                          className={`flex items-center justify-center size-[15px] rounded-[4px] border shrink-0 transition-colors ${
                            r.materialReady
                              ? "bg-fg border-fg text-[var(--accent-fg)]"
                              : "border-line-strong hover:border-fg"
                          }`}
                        >
                          {r.materialReady ? (
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : null}
                        </button>
                        <span
                          className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]"
                          style={{ color: r.materialReady ? "var(--fg-2)" : "var(--fg-4)" }}
                        >
                          Material bereit
                        </span>
                      </div>
                      {/* Verbund: derselbe Name auf zwei Kanälen heisst, dass
                          dort dasselbe rausgeht. Ein Textfeld mit Vorschlägen
                          statt einer Auswahl — der erste Kanal eines Verbunds
                          muss ihn benennen können, ohne dass es ihn schon gibt. */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-4 shrink-0">
                          &#8644; Verbund
                        </span>
                        <input
                          list="klar-groups"
                          defaultValue={r.contentGroup}
                          placeholder="z. B. Basalt Talking Head"
                          aria-label={`Content-Verbund von @${r.handle}`}
                          title="Kanäle mit demselben Verbund posten dasselbe Material."
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v === r.contentGroup) return;
                            startTransition(async () => {
                              patchRow({ key: r.key, contentGroup: v });
                              await updateAccount(r.key, { contentGroup: v });
                            });
                          }}
                          className={`${FIELD} h-6 text-[11px] min-w-0 flex-1`}
                        />
                      </div>
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
                      {/* Frequenz: der Rhythmus sagt an welchen Tagen, das hier
                          wie oft an so einem Tag. Zwei Angaben, weil nur beide
                          zusammen eine Zahl pro Woche ergeben — und weil der
                          Kalender die Tage braucht und die Tagesliste die Anzahl. */}
                      <label className="flex items-center gap-1.5 mt-1.5 [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em] text-fg-4">
                        <select
                          value={r.perDay}
                          onChange={(e) => setPerDay(r, Number(e.target.value))}
                          aria-label={`Posts pro Tag für @${r.handle}`}
                          className="h-6 px-1 text-[11px] [font-family:var(--font-mono)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none cursor-pointer"
                        >
                          {Array.from({ length: MAX_PER_DAY }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}&times;
                            </option>
                          ))}
                        </select>
                        pro Tag
                        <span className="text-fg-3">
                          = {r.rhythm.length * r.perDay}/Woche
                        </span>
                      </label>
                    </td>

                    {days.map((d) => {
                      const open = openDay === d.iso;
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
                            {/* Ein Kaestchen je Post des Tages: bei zweimal
                                taeglich muessen sich beide einzeln setzen
                                lassen, sonst zaehlt der halbe Tag als ganzer. */}
                            <div className="flex flex-wrap gap-[3px] shrink-0" style={{ maxWidth: 44 }}>
                              {slotsOf(r).map((slot) => {
                                const on = isDone(r.key, d.iso, slot);
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => toggleDone(r, d.iso, slot)}
                                    aria-pressed={on}
                                    aria-label={`@${r.handle} am ${d.dayLabel}, Post ${slot} von ${r.perDay} ${on ? "nicht gepostet" : "gepostet"}`}
                                    title={due ? `Eingeplant · Post ${slot}` : "Nicht eingeplant — Haken geht trotzdem"}
                                    className={`mt-[1px] flex items-center justify-center size-[18px] rounded-[4px] border shrink-0 transition-colors ${
                                      on
                                        ? "bg-fg border-fg text-[var(--accent-fg)]"
                                        : due
                                          ? "border-line-strong hover:border-fg"
                                          : "border-dashed border-line text-fg-4 hover:border-fg-3"
                                    }`}
                                  >
                                    {on ? (
                                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6 9 17l-5-5" />
                                      </svg>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                            {open ? (
                              <GrowArea
                                defaultValue={done[cellKey(r.key, d.iso, 1)] ?? ""}
                                placeholder={r.format ? `${r.format} — was ging raus?` : "was ging raus?"}
                                ariaLabel={`Notiz für @${r.handle} am ${d.dayLabel}`}
                                onCommit={(v) => {
                                  if (v === (done[cellKey(r.key, d.iso, 1)] ?? "")) return;
                                  setDayNote(r, d.iso, 1, v);
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
        {/* Nischen bekommen keine Startliste: welche es gibt, weiss nur er. */}
        <datalist id="klar-niches">
          {[...new Set(rows.map((r) => r.niche).filter(Boolean))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {/* Verbünde ebenso: es gibt nur die, die schon jemand benannt hat. */}
        <datalist id="klar-groups">
          {[...new Set(rows.map((r) => r.contentGroup).filter(Boolean))].map((g) => (
            <option key={g} value={g} />
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
 * Die Materialangabe in der Tagesliste. Ein Link wird ein Link — beim Posten
 * will man ihn anklicken, nicht abtippen. Ein Ordnerpfad bleibt Text, weil
 * ihn kein Browser öffnen darf; er steht in Schreibmaschinenschrift und lässt
 * sich mit einem Doppelklick markieren.
 */
function MaterialHint({ text }: { text: string }) {
  const isLink = /^https?:\/\/\S+$/i.test(text.trim());
  const base =
    "block border-t border-line px-3 py-2 [font-family:var(--font-mono)] text-[10.5px] leading-snug break-words";
  if (isLink) {
    return (
      <a
        href={text.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} text-fg-2 underline decoration-dotted hover:text-fg`}
      >
        {text.trim()}
      </a>
    );
  }
  return <div className={`${base} text-fg-3 whitespace-pre-wrap`}>{text}</div>;
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
  mono,
}: {
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
  /** Für Pfade und Links: Schreibmaschine, damit ein Ordner als Ordner liest. */
  mono?: boolean;
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
      className={`w-full min-w-0 px-2 py-1.5 leading-snug text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none ${
        mono
          ? "text-[11px] [font-family:var(--font-mono)] text-fg-2"
          : "text-[12px] [font-family:var(--font-body)]"
      }`}
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
