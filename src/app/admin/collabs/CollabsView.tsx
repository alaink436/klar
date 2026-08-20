"use client";

// /admin/collabs: wer schreibt an die öffentlichen per-App Mail-Adressen
// (TikTok-Bio, z.B. animevault@reply.getklar.org)? Sicht auf die
// klar_collab_messages-Threads (Daten kommen aus page.tsx via buildCollabView)
// plus die Adress-Liste zum Kopieren für die Bios. Antworten laufen weiterhin
// über die Inbox — jede Zeile deep-linkt dorthin (?f=collab&sel=<thread>).
//
// Lag bis 2026-08-11 als Tab in /admin/outreach; eingehende Anfragen sind der
// wichtigere Kanal geworden und waren dort zwei Klicks tief vergraben.
// Seit 2026-08-18 nicht mehr nur eingehend: das Formular oben trägt Gespräche
// nach, die über DMs oder ein fremdes Postfach liefen (POST /admin/collab/manual).
//
// Seit 2026-08-20 trägt jede Zeile zusätzlich einen von Hand gesetzten STAND
// (POST /admin/collab/stage). Die aus den Nachrichten abgeleitete Spalte sagt
// nur, wessen Zug es ist; wie weit die Zusammenarbeit gediehen ist, weiss die
// Tabelle nicht und kann sie auch nicht raten.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  COLLAB_NOTE_MAX,
  COLLAB_STAGE_HINTS,
  COLLAB_STAGE_LABELS,
  COLLAB_STAGES,
  type CollabStage,
} from "@/lib/collabStages";

export interface CollabAliasRow {
  appName: string;
  address: string;
  /** true = App-übergreifende Adresse (collab@…) — für alle Bios geeignet. */
  general?: boolean;
}

export interface CollabAppOption {
  alias: string;
  app: string;
  name: string;
}

export interface CollabThreadRow {
  /** App-Slug — zusammen mit contactEmail der Schlüssel für den Stand. */
  app: string;
  contactEmail: string;
  contactName: string | null;
  contactHandle: string | null;
  channel: string;
  channelLabel: string;
  /** true = jede Nachricht des Threads wurde von Hand erfasst. */
  manualOnly: boolean;
  appName: string;
  address: string | null;
  lastSubject: string | null;
  lastSnippet: string;
  inboundCount: number;
  unanswered: boolean;
  /** open = die Gegenseite schrieb zuletzt · waiting = angeschrieben, nie eine
   *  Antwort bekommen · answered = wir schrieben zuletzt, Antwort gab es schon. */
  status: "open" | "waiting" | "answered";
  /** Von Hand gesetzter Stand der Zusammenarbeit; null = noch keiner. */
  stage: CollabStage | null;
  stageLabel: string | null;
  stageNote: string;
  /** Wie lange steht der Stand schon so ("vor 12d")? null ohne Stand. */
  stageSince: string | null;
  whenRel: string;
  inboxHref: string;
}

const CHANNELS: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram-DM" },
  { value: "tiktok", label: "TikTok-DM" },
  { value: "email", label: "E-Mail" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "other", label: "Sonstiges" },
];

/** Farbpunkt je Stufe. Grau → blau → indigo → gelb → grün, Rot als einziger
 *  Ausgang: die Spalte soll sich von oben nach unten überfliegen lassen, ohne
 *  dass man die Wörter liest. Steht neben der Auswahl und nicht als zweites
 *  Etikett darüber — die Auswahl sagt den Namen bereits. */
const STAGE_DOT: Record<CollabStage, string> = {
  kontakt: "bg-gray-400",
  gespraech: "bg-sky-500",
  zugesagt: "bg-indigo-500",
  material: "bg-amber-500",
  live: "bg-emerald-500",
  abgesagt: "bg-red-500",
};

const inputCls =
  "w-full px-3 py-2 text-sm bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none";
const labelCls =
  "[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3";

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Adresse kopieren"
      className="[font-family:var(--font-mono)] text-[12px] px-2.5 py-1 border border-line-strong rounded-[var(--radius-sm)] bg-surface text-fg hover:bg-surface-2 transition-colors"
    >
      {copied ? "✓ kopiert" : address}
    </button>
  );
}

/** Gespräch von Hand nachtragen — für alles, was nicht über eine Bio-Adresse
 *  lief. Nativer POST auf /admin/collab/manual; nur das Datum wird vorher im
 *  Browser nach ISO mit Zeitzone übersetzt, sonst läge ein "14:30" auf dem
 *  UTC-Server zwei Stunden daneben. */
function ManualEntryForm({ apps }: { apps: CollabAppOption[] }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("instagram");
  const [at, setAt] = useState("");
  const [todo, setTodo] = useState(false);
  const [todoDue, setTodoDue] = useState("");
  const [stage, setStage] = useState<CollabStage | "">("");
  const isEmail = channel === "email";

  // Das Datum wird erst beim Ankreuzen berechnet, nicht beim Rendern: ein
  // "heute" im Server-Markup und ein anderes im Browser wäre ein
  // Hydration-Fehler, und über Mitternacht auch noch ein falsches.
  const toggleTodo = (on: boolean) => {
    setTodo(on);
    if (on && !todoDue) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setTodoDue(d.toISOString().slice(0, 10));
    }
  };

  return (
    <Card className="p-0 overflow-hidden mb-6">
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer px-5 py-3.5 font-semibold text-[13px] text-fg-2 select-none marker:content-none">
          + Gespräch von Hand eintragen
        </summary>
        <form
          method="POST"
          action="/admin/collab/manual"
          className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3.5"
        >
          <p className="md:col-span-3 text-fg-3 text-[12px] -mt-1">
            Für Influencer, die du selbst angeschrieben hast, und für Antworten, die woanders
            ankamen. Der Eintrag landet als Notiz im Board und in der Inbox. Verschickt wird hier
            nichts.
          </p>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>App*</span>
            <select name="app" required defaultValue={apps[0]?.app} className={inputCls}>
              {apps.map((a) => (
                <option key={a.app} value={a.app}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Kanal*</span>
            <select
              name="channel"
              required
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={inputCls}
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Richtung*</span>
            <select name="direction" required defaultValue="out" className={inputCls}>
              <option value="out">Ich habe geschrieben</option>
              <option value="in">Sie oder er hat geschrieben</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Handle{isEmail ? "" : "*"}</span>
            <input
              name="handle"
              required={!isEmail}
              disabled={isEmail}
              maxLength={64}
              placeholder="marie_knits"
              className={cn(inputCls, "[font-family:var(--font-mono)]", isEmail && "opacity-40")}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>E-Mail{isEmail ? "*" : " (optional)"}</span>
            <input
              type="email"
              name="email"
              required={isEmail}
              maxLength={200}
              placeholder="marie@example.com"
              className={cn(inputCls, "[font-family:var(--font-mono)]")}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Name (optional)</span>
            <input name="contact_name" maxLength={120} placeholder="Marie" className={inputCls} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Wann (optional)</span>
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              className={inputCls}
            />
            <input
              type="hidden"
              name="at"
              value={at && !isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : ""}
            />
          </label>

          <label className="md:col-span-2 flex flex-col gap-1">
            <span className={labelCls}>Betreff (optional)</span>
            <input
              name="subject"
              maxLength={300}
              placeholder="Collab-Anfrage Trubel"
              className={inputCls}
            />
          </label>

          <label className="md:col-span-3 flex flex-col gap-1">
            <span className={labelCls}>Nachricht / Notiz*</span>
            <textarea
              name="body"
              required
              rows={3}
              maxLength={8000}
              placeholder="Was hast du geschrieben, was kam zurück?"
              className={cn(inputCls, "resize-y")}
            />
          </label>

          {/* Stand gleich mitgeben: wer ein Gespräch nachträgt, weiss in dem
              Moment am besten, wo es steht. Absichtlich OPTIONAL und ohne
              Vorauswahl — ein Nachtrag zu einem laufenden Thread darf dessen
              Stand nicht stillschweigend auf "Kontakt" zurückdrehen. */}
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Stand (optional)</span>
            <select
              name="stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as CollabStage | "")}
              className={inputCls}
            >
              <option value="">— nicht ändern</option>
              {COLLAB_STAGES.map((s) => (
                <option key={s} value={s}>{COLLAB_STAGE_LABELS[s]}</option>
              ))}
            </select>
            <span className="text-fg-4 text-[11px]">
              {stage ? COLLAB_STAGE_HINTS[stage] : "Lässt sich später in der Zeile setzen."}
            </span>
          </label>

          <label className="md:col-span-2 flex flex-col gap-1">
            <span className={labelCls}>Notiz zum Stand (optional)</span>
            <input
              name="stage_note"
              maxLength={COLLAB_NOTE_MAX}
              disabled={!stage}
              placeholder="Will 80 € pro Reel, wartet auf Code"
              className={cn(inputCls, !stage && "opacity-40")}
            />
            <span className="text-fg-4 text-[11px]">
              Steht in der Zeile unter dem Stand. Was abgemacht ist, worauf du wartest.
            </span>
          </label>

          {/* Der Ball liegt jetzt bei der Gegenseite. Wer nachfassen will, sagt
              es hier einmal — dann steht der Punkt in der To-do-Liste und nicht
              nur im Kopf. */}
          <div className="md:col-span-3 flex items-center gap-3 flex-wrap p-3 border border-line rounded-[var(--radius-sm)] bg-surface-2">
            <label className="inline-flex items-center gap-2 text-[12.5px] text-fg-2 cursor-pointer select-none">
              <input
                type="checkbox"
                name="todo"
                value="1"
                checked={todo}
                onChange={(e) => toggleTodo(e.target.checked)}
                className="accent-[var(--fg)]"
              />
              Nachfassen als To-do eintragen
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-fg-3">
              am
              <input
                type="date"
                name="todo_due"
                value={todoDue}
                disabled={!todo}
                onChange={(e) => setTodoDue(e.target.value)}
                className={cn(inputCls, "w-auto py-1.5", !todo && "opacity-40")}
              />
            </label>
            <span className="text-fg-4 text-[11px]">
              Landet als eigener Punkt auf /admin/todos, abhakbar wie jeder andere.
            </span>
          </div>

          <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
            <Button type="submit" variant="outline">Eintrag speichern</Button>
            <span className="text-fg-4 text-[11px]">
              Mehrere Nachrichten mit demselben Handle und derselben App landen im selben Thread.
            </span>
          </div>
        </form>
      </details>
    </Card>
  );
}

/** Der Stand einer Zeile: Auswahl plus freie Notiz, beides in EINEM Formular
 *  auf /admin/collab/stage. Die Auswahl schickt sich selbst ab — ein Stand,
 *  der erst nach einem zweiten Klick gilt, wird nicht gepflegt. Die Notiz
 *  braucht ihren eigenen Knopf, weil ein Textfeld kein Ereignis kennt, das
 *  "jetzt bin ich fertig" bedeutet. */
function StageCell({ row }: { row: CollabThreadRow }) {
  const [stage, setStage] = useState<CollabStage | "">(row.stage ?? "");
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <form method="POST" action="/admin/collab/stage" className="flex flex-col gap-1.5 min-w-[190px]">
      <input type="hidden" name="app" value={row.app} />
      <input type="hidden" name="contact_key" value={row.contactEmail} />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 w-2 h-2 rounded-full",
            stage ? STAGE_DOT[stage] : "bg-transparent ring-1 ring-line-strong",
          )}
        />
        <select
          name="stage"
          required
          value={stage}
          onChange={(e) => {
            setStage(e.target.value as CollabStage);
            e.currentTarget.form?.requestSubmit();
          }}
          aria-label="Stand des Gesprächs"
          className={cn(
            "w-full px-2 py-1.5 text-[12.5px] bg-bg text-fg border rounded-[var(--radius-sm)] focus:border-fg focus:outline-none",
            stage ? "border-line-strong" : "border-dashed border-line-strong text-fg-3",
          )}
        >
          <option value="" disabled>
            — Stand setzen
          </option>
          {COLLAB_STAGES.map((s) => (
            <option key={s} value={s}>{COLLAB_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {row.stageSince && (
        <span className="text-fg-4 text-[10px]">zuletzt geändert: {row.stageSince}</span>
      )}

      {row.stageNote && !noteOpen && (
        <span className="text-fg-3 text-[11px] leading-snug">{row.stageNote}</span>
      )}

      {noteOpen ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            name="note"
            rows={3}
            maxLength={COLLAB_NOTE_MAX}
            defaultValue={row.stageNote}
            placeholder="Was ist abgemacht, worauf wartest du?"
            className="w-full px-2 py-1.5 text-[12px] bg-bg text-fg border border-line-strong rounded-[var(--radius-sm)] focus:border-fg focus:outline-none resize-y"
          />
          <Button type="submit" variant="outline" className="self-start">
            Notiz speichern
          </Button>
        </div>
      ) : (
        <>
          {/* Ungeöffnet trotzdem im Formular: sonst löscht ein Stufenwechsel
              die bestehende Notiz, weil das Feld nicht mitgeschickt würde. */}
          <input type="hidden" name="note" value={row.stageNote} />
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="self-start text-[11px] text-fg-3 underline underline-offset-2 hover:text-fg"
          >
            {row.stageNote ? "Notiz bearbeiten" : "Notiz schreiben"}
          </button>
        </>
      )}
    </form>
  );
}

/** Filterleiste über der Tabelle: eine Zahl pro Stufe. Der eigentliche Zweck
 *  des Stands — sehen, wo die Gespräche stehen, ohne jede Zeile zu lesen. */
function StageFilter({
  counts,
  total,
  active,
  onPick,
}: {
  counts: Record<string, number>;
  total: number;
  active: string;
  onPick: (v: string) => void;
}) {
  const chips: { value: string; label: string; dot?: string }[] = [
    { value: "all", label: `Alle (${total})` },
    { value: "none", label: `Ohne Stand (${counts.none ?? 0})` },
    ...COLLAB_STAGES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({
      value: s as string,
      label: `${COLLAB_STAGE_LABELS[s]} (${counts[s]})`,
      dot: STAGE_DOT[s],
    })),
  ];
  return (
    <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-line">
      {chips.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onPick(c.value)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] border rounded-[var(--radius-sm)] transition-colors",
            active === c.value
              ? "border-fg bg-surface-2 text-fg font-semibold"
              : "border-line-strong bg-surface text-fg-3 hover:text-fg",
          )}
        >
          {c.dot && <span aria-hidden="true" className={cn("w-2 h-2 rounded-full", c.dot)} />}
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default function CollabsView({
  aliases,
  threads,
  apps,
  msg,
}: {
  aliases: CollabAliasRow[];
  threads: CollabThreadRow[];
  apps: CollabAppOption[];
  msg?: string;
}) {
  const [filter, setFilter] = useState("all");

  const open = threads.filter((t) => t.unanswered).length;
  const waiting = threads.filter((t) => t.status === "waiting").length;

  const counts = useMemo(() => {
    const c: Record<string, number> = { none: 0 };
    for (const t of threads) {
      const k = t.stage ?? "none";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [threads]);

  const shown = useMemo(() => {
    if (filter === "all") return threads;
    if (filter === "none") return threads.filter((t) => !t.stage);
    return threads.filter((t) => t.stage === filter);
  }, [threads, filter]);

  return (
    <>
      {msg && (
        <div className="mb-4 px-4 py-2.5 border border-line-strong rounded-[var(--radius-sm)] bg-surface-2 text-fg-2 text-[12.5px]">
          {msg}
        </div>
      )}

      <ManualEntryForm apps={apps} />

      {/* Bio-Adressen: eine pro App, klick = kopieren (für TikTok/IG-Bios). */}
      <Card className="p-5 mb-6">
        <div className="font-bold text-[14px] text-fg mb-1">Öffentliche Collab-Adressen</div>
        <p className="text-fg-3 text-[12px] mb-4">
          Diese Adressen gehören in die TikTok/IG-Bios. Eingehende Mails landen automatisch hier
          und in der Inbox unter „Collabs&#8220;. Klick auf eine Adresse kopiert sie.
        </p>
        {aliases.some((a) => a.general) && (
          <div className="mb-4 p-3 border border-line-strong rounded-[var(--radius-sm)] bg-surface-2 flex items-center gap-3 flex-wrap">
            <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg">
              Allgemein — alle Apps
            </span>
            <CopyAddress address={aliases.find((a) => a.general)!.address} />
            <span className="text-fg-4 text-[11px]">
              Eine Adresse für jede Bio. Nennt die Mail eine App (z.B. „MyLoo&#8220;), wird sie
              ihr automatisch zugeordnet — sonst läuft sie unter „Klar&#8220; auf.
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {aliases.filter((a) => !a.general).map((a) => (
            <div key={a.address} className="flex items-center gap-2">
              <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                {a.appName}
              </span>
              <CopyAddress address={a.address} />
            </div>
          ))}
        </div>
      </Card>

      {/* Eingegangene Anfragen + von Hand erfasste Gespräche */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-line">
          <span className="font-bold text-[14px] text-fg">
            Collab-Gespräche{" "}
            <span className="text-fg-4 font-normal text-[11px] ml-1">
              {threads.length} Thread{threads.length === 1 ? "" : "s"}
              {open > 0 ? ` · ${open} unbeantwortet` : ""}
              {waiting > 0 ? ` · ${waiting} ohne Antwort` : ""}
            </span>
          </span>
          <Link href="/admin/inbox?f=collab" className="applink text-[12px]">
            In der Inbox öffnen →
          </Link>
        </div>

        {threads.length > 0 && (
          <StageFilter
            counts={counts}
            total={threads.length}
            active={filter}
            onPick={setFilter}
          />
        )}

        {threads.length === 0 ? (
          <div className="text-fg-4 italic text-[12px] py-8 text-center">
            Noch nichts hier. Sobald jemand an eine der Bio-Adressen schreibt, taucht der Thread
            auf, oder du trägst ein Gespräch oben von Hand ein.
          </div>
        ) : shown.length === 0 ? (
          <div className="text-fg-4 italic text-[12px] py-8 text-center">
            In diesem Stand steht gerade nichts.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wann</TableHead>
                <TableHead>Wer</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Letzte Nachricht</TableHead>
                <TableHead>Wer ist am Zug</TableHead>
                <TableHead>Stand</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((t) => (
                <TableRow key={t.inboxHref}>
                  <TableCell className="text-fg-4 text-[11px] whitespace-nowrap align-top">{t.whenRel}</TableCell>
                  <TableCell className="align-top">
                    <div className="text-[13px] text-fg">
                      {t.contactName || t.contactHandle || t.contactEmail.split("@")[0]}
                    </div>
                    <div className="[font-family:var(--font-mono)] text-[11px] text-fg-3">
                      {t.contactHandle ? `@${t.contactHandle}` : t.contactEmail}
                    </div>
                    <div className="text-fg-4 text-[10px] mt-0.5">
                      {t.channelLabel}
                      {t.manualOnly ? " · von Hand erfasst" : ""}
                    </div>
                  </TableCell>
                  <TableCell className="align-top"><Badge tone="neutral">{t.appName}</Badge></TableCell>
                  <TableCell className="max-w-[280px] align-top">
                    {t.lastSubject && (
                      <div className="text-[12px] font-semibold text-fg-2 truncate">{t.lastSubject}</div>
                    )}
                    <div className="text-[12px] text-fg-3 truncate">{t.lastSnippet || "—"}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    {t.status === "open" ? (
                      <Badge tone="warn">offen</Badge>
                    ) : t.status === "waiting" ? (
                      <Badge tone="neutral">angeschrieben</Badge>
                    ) : (
                      <Badge tone="ok">beantwortet</Badge>
                    )}
                    <div className="text-fg-4 text-[10px] mt-0.5">
                      {t.inboundCount} eingehend
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <StageCell row={t} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top">
                    <Link href={t.inboxHref} className="applink text-[12px]">
                      {t.channel === "email" ? "Antworten →" : "Thread öffnen →"}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
