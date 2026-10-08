"use client";

// /admin/collabs: wer schreibt an die öffentlichen per-App Mail-Adressen
// (TikTok-Bio, z.B. animevault@reply.getklar.org)? Sicht auf die
// klar_collab_messages-Threads (Daten kommen aus page.tsx via buildCollabView)
// plus die Adress-Liste zum Kopieren für die Bios. Antworten laufen weiterhin
// über die Inbox — jede Zeile deep-linkt dorthin (?f=collab&sel=<thread>).
//
// Seit 2026-08-18 nicht mehr nur eingehend: das Formular oben trägt Gespräche
// nach, die über DMs oder ein fremdes Postfach liefen (POST /admin/collab/manual).
//
// Seit 2026-08-20 trägt jede Zeile zusätzlich einen von Hand gesetzten STAND
// (POST /admin/collab/stage). Die aus den Nachrichten abgeleitete Spalte sagt
// nur, wessen Zug es ist; wie weit die Zusammenarbeit gediehen ist, weiss die
// Tabelle nicht und kann sie auch nicht raten.
//
// Seit dem Redesign (2026-10-08, Ticket 02) aus den gemeinsamen Bausteinen:
// TextureCard statt Card, Pillen statt Rahmenknoepfen, Felder als `.klar-feld`,
// Stand als gedaempfter Punkt. Auf dem Handy stapelt jede Tabellenzeile.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import {
  TextureCard,
  TextureCardDescription,
  TextureCardHeader,
  TextureCardTitle,
} from "@/components/ui/texture-card";
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
  /** Wie oft wir geschrieben haben. Ab zwei ohne Antwort wird die zweite
   *  Adresse angeboten. */
  outboundCount: number;
  /** Ausweichadresse, wenn auf der ersten nichts kam. Leer = keine hinterlegt. */
  zweiteEmail: string;
  /** Woher sie stammt (Impressum, Linktree, DM). */
  zweiteEmailQuelle: string;
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
 *  Etikett darüber: die Auswahl sagt den Namen bereits.
 *  Seit dem Redesign die gedaempften Status-Farben aus admin.css statt der
 *  Tailwind-Palette. */
const STAGE_TON: Record<CollabStage, string> = {
  kontakt: "var(--fg-4)",
  gespraech: "var(--info)",
  zugesagt: "var(--indigo)",
  material: "var(--warning)",
  live: "var(--success)",
  abgesagt: "var(--danger)",
};
const ton = (v: string) => ({ "--ton": v }) as React.CSSProperties;

const inputCls = "klar-feld";
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
      className="klar-pille klar-pille-dunkel h-7 px-3 text-[12px] [font-family:var(--font-mono)]"
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
          kopiert
        </>
      ) : (
        address
      )}
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
  const [stage, setStage] = useState<CollabStage | "">("");
  const isEmail = channel === "email";

  return (
    <TextureCard className="mb-6">
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="flex cursor-pointer select-none items-center gap-3 px-6 py-4 text-[14px] font-medium text-fg transition-colors hover:bg-white/[.025] [&::-webkit-details-marker]:hidden">
          <span className="klar-kachel size-8">
            <Plus className="size-3.5" />
          </span>
          Gespräch von Hand eintragen
        </summary>
        <form
          method="POST"
          action="/admin/collab/manual"
          className="px-6 pb-6 pt-1 grid grid-cols-1 md:grid-cols-3 gap-3.5"
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
              <option value="">nicht ändern</option>
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

          <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
            <Button type="submit" variant="pill">Eintrag speichern</Button>
            <span className="text-fg-4 text-[11px]">
              Mehrere Nachrichten mit demselben Handle und derselben App landen im selben Thread.
            </span>
          </div>
        </form>
      </details>
    </TextureCard>
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
    <div className="flex flex-col gap-1.5 min-w-[190px]">
    <form method="POST" action="/admin/collab/stage" className="flex flex-col gap-1.5">
      <input type="hidden" name="app" value={row.app} />
      <input type="hidden" name="contact_key" value={row.contactEmail} />

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("klar-punkt", !stage && "bg-transparent shadow-[inset_0_0_0_1px_var(--fg-4)]")}
          style={stage ? ton(STAGE_TON[stage]) : undefined}
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
          className={cn("klar-feld px-2 py-1.5 text-[12.5px]", !stage && "border-dashed text-fg-3")}
        >
          <option value="" disabled>
            Stand setzen
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
            className="klar-feld px-2 py-1.5 text-[12px]"
          />
          <Button type="submit" variant="pill-dark" size="sm" className="h-7 self-start px-3 text-[12px]">
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

      <ZweiteAdresse row={row} />
    </div>
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
      dot: STAGE_TON[s],
    })),
  ];
  return (
    <div className="border-t px-6 py-3">
      <div className="klar-segment">
        {chips.map((c) => (
          <button key={c.value} type="button" aria-pressed={active === c.value} onClick={() => onPick(c.value)}>
            {c.dot && <span aria-hidden="true" className="klar-punkt" style={ton(c.dot)} />}
            {c.label}
          </button>
        ))}
      </div>
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
      {msg && <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{msg}</TextureCard>}

      <ManualEntryForm apps={apps} />

      {/* Bio-Adressen: eine pro App, klick = kopieren (für TikTok/IG-Bios). */}
      <TextureCard className="mb-6 p-6">
        <TextureCardTitle className="mb-1">Öffentliche Collab-Adressen</TextureCardTitle>
        <TextureCardDescription className="mb-4 text-[12.5px]">
          Diese Adressen gehören in die TikTok/IG-Bios. Eingehende Mails landen automatisch hier
          und in der Inbox unter „Collabs&#8220;. Klick auf eine Adresse kopiert sie.
        </TextureCardDescription>
        {aliases.some((a) => a.general) && (
          <div className="klar-einschub mb-4 flex flex-wrap items-center gap-3 p-3">
            <span className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg">
              Allgemein — alle Apps
            </span>
            <CopyAddress address={aliases.find((a) => a.general)!.address} />
            <span className="text-fg-4 text-[11px]">
              Eine Adresse für jede Bio. Nennt die Mail eine App (z.B. „MyLoo&#8220;), wird sie
              ihr automatisch zugeordnet, sonst läuft sie unter „Klar&#8220; auf.
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
      </TextureCard>

      {/* Eingegangene Anfragen + von Hand erfasste Gespräche */}
      <TextureCard>
        <TextureCardHeader>
          <TextureCardTitle>
            Collab-Gespräche{" "}
            <span className="ml-1 text-[12px] font-normal text-fg-3">
              {threads.length} Thread{threads.length === 1 ? "" : "s"}
              {open > 0 ? ` · ${open} unbeantwortet` : ""}
              {waiting > 0 ? ` · ${waiting} ohne Antwort` : ""}
            </span>
          </TextureCardTitle>
          <Button asChild variant="pill-dark" size="sm" className="h-7 px-3 text-[12px]">
            <Link href="/admin/inbox?f=collab">
              In der Inbox öffnen
              <ArrowRight />
            </Link>
          </Button>
        </TextureCardHeader>

        {threads.length > 0 && (
          <StageFilter
            counts={counts}
            total={threads.length}
            active={filter}
            onPick={setFilter}
          />
        )}

        {threads.length === 0 ? (
          <div className="border-t px-6 py-8 text-center text-[12.5px] text-fg-3">
            Noch nichts hier. Sobald jemand an eine der Bio-Adressen schreibt, taucht der Thread
            auf, oder du trägst ein Gespräch oben von Hand ein.
          </div>
        ) : shown.length === 0 ? (
          <div className="border-t px-6 py-8 text-center text-[12.5px] text-fg-3">
            In diesem Stand steht gerade nichts.
          </div>
        ) : (
          // Die Karte traegt Kante und Grund, die Tabelle darin steht ohne
          // eigenen Rahmen. Unter md stapelt jede Zeile: wer und wann oben,
          // App und Zug darunter, dann Nachricht, Stand und der Knopf.
          <Table className="rounded-none border-0 border-t bg-transparent [&_th]:bg-transparent max-md:block max-md:[&_tbody]:block max-md:[&_thead]:hidden max-md:[&_tr]:flex max-md:[&_tr]:flex-wrap max-md:[&_tr]:items-center max-md:[&_tr]:gap-x-2.5 max-md:[&_tr]:gap-y-2 max-md:[&_tr]:border-b max-md:[&_tr]:px-5 max-md:[&_tr]:py-4 max-md:[&_tr:last-child]:border-b-0 max-md:[&_td]:border-0 max-md:[&_td]:p-0">
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
                  <TableCell className="text-fg-4 text-[11px] whitespace-nowrap align-top max-md:order-2 max-md:w-16 max-md:self-start max-md:text-right">{t.whenRel}</TableCell>
                  <TableCell className="align-top max-md:order-1 max-md:basis-[calc(100%-5rem)]">
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
                  <TableCell className="align-top max-md:order-3"><Badge tone="neutral">{t.appName}</Badge></TableCell>
                  <TableCell className="max-w-[280px] align-top max-md:order-5 max-md:w-full max-md:max-w-none">
                    {t.lastSubject && (
                      <div className="text-[12px] font-semibold text-fg-2 truncate">{t.lastSubject}</div>
                    )}
                    <div className="text-[12px] text-fg-3 truncate">{t.lastSnippet || "—"}</div>
                  </TableCell>
                  <TableCell className="align-top max-md:order-4 max-md:flex max-md:items-center max-md:gap-2">
                    {t.status === "open" ? (
                      <Badge tone="warn">offen</Badge>
                    ) : t.status === "waiting" ? (
                      <Badge tone="neutral" dot>angeschrieben</Badge>
                    ) : (
                      <Badge tone="ok">beantwortet</Badge>
                    )}
                    <div className="text-fg-4 text-[10px] mt-1 max-md:mt-0">
                      {t.inboundCount} eingehend
                    </div>
                  </TableCell>
                  <TableCell className="align-top max-md:order-6 max-md:w-full">
                    <StageCell row={t} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top max-md:order-7">
                    <Button asChild variant="pill-dark" size="sm" className="h-7 px-3 text-[12px]">
                      <Link href={t.inboxHref}>
                        {t.channel === "email" ? "Antworten" : "Thread öffnen"}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TextureCard>
    </>
  );
}


/**
 * Die Ausweichadresse eines Threads.
 *
 * Angeboten wird sie erst, wenn wir **zweimal geschrieben und nie eine Antwort
 * bekommen** haben — vorher ist sie nur ein Feld, das man ignoriert. Steht
 * schon eine drin, bleibt sie immer sichtbar, sonst wäre sie nach der ersten
 * Antwort unauffindbar.
 *
 * Die Bedingung wird hier gestellt und nicht auf dem Server: die Route soll
 * eine Eingabe nicht wegen einer Zählung abweisen, wenn Alain es einmal besser
 * weiss. Die Zahlen kommen aus den Nachrichten und werden nirgends gespeichert.
 */
function ZweiteAdresse({ row }: { row: CollabThreadRow }) {
  const zweimalOhneAntwort = row.outboundCount >= 2 && row.inboundCount === 0;
  const [offen, setOffen] = useState(false);

  if (!zweimalOhneAntwort && !row.zweiteEmail) return null;

  if (!offen && !row.zweiteEmail) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="self-start text-[11px] text-fg-3 underline underline-offset-2 hover:text-fg"
        title={`${row.outboundCount}× geschrieben, keine Antwort`}
      >
        zweite Adresse eintragen
      </button>
    );
  }

  return (
    <form
      method="POST"
      action="/admin/collab/zweite-email"
      className="flex flex-col gap-1 pt-1.5 border-t border-line"
    >
      <input type="hidden" name="app" value={row.app} />
      <input type="hidden" name="contact_key" value={row.contactEmail} />

      <span className="text-fg-4 text-[10px]">
        {row.outboundCount}× geschrieben, keine Antwort
      </span>

      <input
        name="zweite_email"
        defaultValue={row.zweiteEmail}
        placeholder="zweite Adresse oder Weg"
        aria-label={`Zweite Adresse für ${row.contactEmail}`}
        className="klar-feld px-2 py-1.5 text-[12px]"
      />
      <input
        name="quelle"
        defaultValue={row.zweiteEmailQuelle}
        placeholder="woher? Impressum, Linktree, DM"
        aria-label={`Woher die zweite Adresse für ${row.contactEmail} stammt`}
        className="klar-feld px-2 py-1 text-[11px] text-fg-2"
      />
      <Button type="submit" variant="pill-dark" size="sm" className="h-7 self-start px-3 text-[12px]">
        {row.zweiteEmail ? "Adresse ändern" : "Adresse merken"}
      </Button>
    </form>
  );
}

