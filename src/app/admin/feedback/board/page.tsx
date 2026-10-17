// Klar Control · Klar Studios · Feedback · Board: das Board der Apps ("what i
// want next"). Oben die App, darunter drei Ansichten: Ideen anlegen, umstellen
// und kommentieren; Wuensche lesen und aufs Board stellen; Meldungen zu
// Spitznamen aus Events lesen und sperren (Basalt 2.6.0). Daten und Ablaeufe
// in lib/board, geschrieben wird ueber
// ./aktion. Aufbau wie das Postfach: Liste links, Auswahl rechts, gewaehlt
// wird ueber die Adresse.

import { Lightbulb, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/adminGuard";
import {
  BOARD_APPS,
  BoardError,
  IDEA_STATUSES,
  IDEA_STATUS_LABELS,
  fetchComments,
  fetchIdeas,
  fetchReports,
  fetchWishes,
  findBoardApp,
  type BoardApp,
  type EventReport,
  type Idea,
  type IdeaComment,
  type IdeaStatus,
  type Wish,
} from "@/lib/board";
import { TextureCard } from "@/components/ui/texture-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inZone } from "@/lib/zeit";
import { AdminTopbar } from "../../AdminTopbar";
import { FeedbackReiter } from "../FeedbackReiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ansicht = "ideen" | "wuensche" | "meldungen";

const AKTION = "/admin/feedback/board/aktion";

const TON: Record<IdeaStatus, string | undefined> = {
  open: undefined,
  planned: "var(--info)",
  building: "var(--warning)",
  shipped: "var(--success)",
};

const TITEL =
  "m-0 block text-[18px] font-medium normal-case leading-tight tracking-[-0.015em] text-fg [font-family:var(--font-body)] after:hidden";
const LABEL = "[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-3";

const datum = (iso: string) => inZone(iso, { day: "2-digit", month: "short", year: "numeric" });
const stimmen = (n: number) => (n === 1 ? "1 Stimme" : `${n} Stimmen`);
const meldungenZahl = (n: number) => (n === 1 ? "1 Meldung" : `${n} Meldungen`);

/** Die Flagge einer ISO-Region, wie die App sie zeigt. */
const flagge = (region: string) => String.fromCodePoint(...Array.from(region, (c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function adresse(p: { app: BoardApp; ansicht?: Ansicht; id?: string; wunsch?: string; neu?: boolean }): string {
  const q = new URLSearchParams({ app: p.app.slug });
  if (p.ansicht && p.ansicht !== "ideen") q.set("ansicht", p.ansicht);
  if (p.id) q.set("id", p.id);
  if (p.wunsch) q.set("wunsch", p.wunsch);
  if (p.neu) q.set("neu", "1");
  return `/admin/feedback/board?${q}`;
}

/** Was Alain liest: die deutsche Fassung, sonst das, was die App zeigt. */
function deutsch(i: Idea): { title: string; detail: string | null } {
  const de = i.translations.de;
  return { title: de?.title ?? i.title, detail: de ? (de.detail ?? null) : i.detail };
}

/** Kurze Meldung in einer Karte; ihr Ton steckt nur im Punkt. */
function Meldung({ ton, children }: { ton?: string; children: React.ReactNode }) {
  return (
    <TextureCard className="mb-4 flex items-start gap-3 px-5 py-4 text-[13px] text-fg-2">
      {ton ? <span aria-hidden="true" className="klar-punkt mt-[7px]" style={{ "--ton": ton } as React.CSSProperties} /> : null}
      <div className="min-w-0">{children}</div>
    </TextureCard>
  );
}

function Punkt({ ton }: { ton?: string }) {
  return <span aria-hidden="true" className="klar-punkt" style={ton ? ({ "--ton": ton } as React.CSSProperties) : undefined} />;
}

/** Die Felder, die jedes Formular an ./aktion mitschickt. */
function Felder({ app, tat, ansicht, id, wunsch }: { app: BoardApp; tat: string; ansicht: Ansicht; id?: string; wunsch?: string }) {
  return (
    <>
      <input type="hidden" name="app" value={app.slug} />
      <input type="hidden" name="tat" value={tat} />
      <input type="hidden" name="ansicht" value={ansicht} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {wunsch ? <input type="hidden" name="wunsch" value={wunsch} /> : null}
    </>
  );
}

function Listeneintrag({ href, gewaehlt, children }: { href: string; gewaehlt: boolean; children: React.ReactNode }) {
  return (
    <li className="border-t first:border-t-0">
      <a
        href={href}
        className={cn(
          "block px-4 py-3 transition-colors hover:bg-white/[.03]",
          gewaehlt && "bg-white/[.045] shadow-[inset_2px_0_0_0_var(--fg)] hover:bg-white/[.045]",
        )}
      >
        {children}
      </a>
    </li>
  );
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; ansicht?: string; id?: string; wunsch?: string; neu?: string; msg?: string; err?: string }>;
}) {
  await requireAdminPage();

  const roh = await searchParams;
  const app = findBoardApp(roh.app) ?? BOARD_APPS[0];
  const ansicht: Ansicht = roh.ansicht === "wuensche" ? "wuensche" : roh.ansicht === "meldungen" ? "meldungen" : "ideen";
  const msg = (roh.msg ?? "").slice(0, 400);
  const err = (roh.err ?? "").slice(0, 400);

  let fehler: string | null = null;
  let hinweis: string | null = null;
  let ideen: Idea[] = [];
  let kommentare: IdeaComment[] = [];
  let wuensche: Wish[] = [];
  let meldungen: EventReport[] = [];
  try {
    if (ansicht === "ideen") {
      ideen = await fetchIdeas(app);
      if (ideen.some((i) => i.id === roh.id)) kommentare = await fetchComments(app, roh.id!);
    } else if (ansicht === "wuensche") {
      const r = await fetchWishes(app);
      wuensche = r.wishes;
      hinweis = r.warning;
    } else {
      meldungen = await fetchReports(app);
    }
  } catch (e) {
    if (!(e instanceof BoardError)) throw e;
    fehler = e.message;
  }
  const idee = ideen.find((i) => i.id === roh.id) ?? null;
  const neu = ansicht === "ideen" && roh.neu === "1";
  const wunsch = wuensche.find((w) => w.id === roh.wunsch) ?? null;

  return (
    <>
      <title>Board · Feedback · Klar Control</title>
      <AdminTopbar titel="Board" bereich="Klar Studios" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios · Feedback" icon={<Lightbulb />} title="Board">
          Das Board der Apps: Ideen, auf die Nutzer stimmen, deine Kommentare dazu, die Wünsche, die Nutzer schicken, und
          Meldungen zu Spitznamen aus Events. Was du speicherst, übersetzt Claude in alle Sprachen der App.
        </PageHeader>

        <FeedbackReiter aktiv="board" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <nav className="klar-segment" aria-label="App">
            {BOARD_APPS.map((a) => (
              <a key={a.slug} href={adresse({ app: a, ansicht })} aria-current={a.slug === app.slug ? "page" : undefined}>
                {a.name}
              </a>
            ))}
          </nav>
          <nav className="klar-segment" aria-label="Ansicht">
            <a href={adresse({ app })} aria-current={ansicht === "ideen" ? "page" : undefined}>Ideen</a>
            <a href={adresse({ app, ansicht: "wuensche" })} aria-current={ansicht === "wuensche" ? "page" : undefined}>Wünsche</a>
            <a href={adresse({ app, ansicht: "meldungen" })} aria-current={ansicht === "meldungen" ? "page" : undefined}>Meldungen</a>
          </nav>
        </div>

        {fehler ? <Meldung ton="var(--danger)"><b className="text-fg">Board nicht lesbar.</b> {fehler}</Meldung> : null}
        {hinweis ? <Meldung ton="var(--warning)">{hinweis} Gezeigt wird das Original.</Meldung> : null}
        {err ? <Meldung ton="var(--danger)">{err}</Meldung> : msg ? <Meldung ton="var(--success)">{msg}</Meldung> : null}

        {ansicht === "meldungen" ? (
          <MeldungenAnsicht app={app} meldungen={meldungen} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <TextureCard className="self-start">
              {ansicht === "ideen" ? (
                <>
                  <div className="border-b px-4 py-3">
                    <Button asChild variant={neu ? "pill" : "pill-dark"} size="sm">
                      <a href={adresse({ app, neu: true })}>
                        <Plus />
                        Neue Idee
                      </a>
                    </Button>
                  </div>
                  {ideen.length === 0 ? (
                    <p className="m-0 px-4 py-8 text-center text-[12.5px] text-fg-3">Noch keine Ideen.</p>
                  ) : (
                    <ul className="m-0 list-none p-0">
                      {ideen.map((i) => (
                        <Listeneintrag key={i.id} href={adresse({ app, id: i.id })} gewaehlt={i.id === idee?.id}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-fg">{deutsch(i).title}</span>
                            <span className="shrink-0 text-[11px] text-fg-4 [font-family:var(--font-mono)]">{stimmen(i.votes)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-4">
                            <Punkt ton={TON[i.status]} />
                            {IDEA_STATUS_LABELS[i.status]} · Gewicht {i.weight}
                            {Object.keys(i.translations).length ? null : " · nicht übersetzt"}
                          </div>
                        </Listeneintrag>
                      ))}
                    </ul>
                  )}
                </>
              ) : wuensche.length === 0 ? (
                <p className="m-0 px-4 py-8 text-center text-[12.5px] text-fg-3">Noch keine Wünsche.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {wuensche.map((w) => (
                    <Listeneintrag key={w.id} href={adresse({ app, ansicht: "wuensche", wunsch: w.id })} gewaehlt={w.id === wunsch?.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-[13px] text-fg", !w.readAt && "font-semibold")}>{w.bodyDe ?? w.body}</span>
                        <span className="shrink-0 text-[11px] text-fg-4 [font-family:var(--font-mono)]">{datum(w.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-4">
                        {w.promotedIdeaId ? (
                          <>
                            <Punkt ton="var(--success)" />
                            auf dem Board
                          </>
                        ) : w.readAt ? (
                          "gelesen"
                        ) : (
                          <>
                            <Punkt ton="var(--info)" />
                            ungelesen
                          </>
                        )}
                      </div>
                    </Listeneintrag>
                  ))}
                </ul>
              )}
            </TextureCard>

            <TextureCard className="min-w-0 self-start p-6">
              {neu ? (
                <NeueIdee app={app} />
              ) : idee ? (
                <IdeeAnsicht app={app} idee={idee} kommentare={kommentare} />
              ) : wunsch ? (
                <WunschAnsicht app={app} w={wunsch} />
              ) : (
                <p className="m-0 py-10 text-center text-[13px] text-fg-3">
                  {ansicht === "ideen" ? "Links eine Idee auswählen oder eine neue anlegen." : "Links einen Wunsch auswählen."}
                </p>
              )}
            </TextureCard>
          </div>
        )}
      </div>
    </>
  );
}

/** Titel und Beschreibung einer Idee; dieselben Felder fuer Anlegen, Aendern und Aufs-Board-Stellen. */
function IdeeFelder({ titel, beschreibung }: { titel?: string; beschreibung?: string | null }) {
  return (
    <>
      <label className="grid gap-1.5">
        <span className={LABEL}>Titel</span>
        <Input name="titel" defaultValue={titel} required minLength={3} maxLength={120} />
      </label>
      <label className="grid gap-1.5">
        <span className={LABEL}>Beschreibung</span>
        <textarea name="beschreibung" defaultValue={beschreibung ?? ""} rows={3} maxLength={600} className="klar-feld" />
      </label>
    </>
  );
}

function NeueIdee({ app }: { app: BoardApp }) {
  return (
    <form method="POST" action={AKTION} data-klar-leeren="ja" className="grid gap-4">
      <Felder app={app} tat="anlegen" ansicht="ideen" />
      <h2 className={TITEL}>Neue Idee für {app.name}</h2>
      <IdeeFelder />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="pill" size="sm">Anlegen und übersetzen</Button>
        <span className="text-[12px] text-fg-4">
          Deutsch geht. Claude übersetzt in alle {app.langs.length} Sprachen, die App zeigt bis 2.6.0 die Fassung auf{" "}
          {app.sourceLang}.
        </span>
      </div>
    </form>
  );
}

function IdeeAnsicht({ app, idee, kommentare }: { app: BoardApp; idee: Idea; kommentare: IdeaComment[] }) {
  const d = deutsch(idee);
  const sprachen = Object.entries(idee.translations);
  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className={TITEL}>{d.title}</h2>
        {d.detail ? <p className="mt-2 text-[13.5px] leading-[1.7] text-fg-2">{d.detail}</p> : null}
        <p className="mt-3 text-[12px] text-fg-4">
          In der App ({app.sourceLang}): {idee.title}
          {idee.detail ? ` · ${idee.detail}` : ""}
        </p>
        <p className="mt-1 text-[12px] text-fg-4">
          {stimmen(idee.votes)} · angelegt {datum(idee.createdAt)}
        </p>
      </div>

      <section className="grid gap-2">
        <span className={LABEL}>Stand</span>
        <form method="POST" action={AKTION} className="klar-segment self-start">
          <Felder app={app} tat="stand" ansicht="ideen" id={idee.id} />
          {IDEA_STATUSES.map((s) => (
            <button key={s} type="submit" name="stand" value={s} aria-pressed={idee.status === s}>
              {IDEA_STATUS_LABELS[s]}
            </button>
          ))}
        </form>
      </section>

      <section className="grid gap-2">
        <span className={LABEL}>Gewicht</span>
        <form method="POST" action={AKTION} className="flex flex-wrap items-center gap-2">
          <Felder app={app} tat="gewicht" ansicht="ideen" id={idee.id} />
          <input
            name="gewicht"
            type="number"
            step={1}
            min={-999}
            max={999}
            required
            defaultValue={idee.weight}
            aria-label="Gewicht"
            className="klar-feld w-24"
          />
          <Button type="submit" variant="pill-dark" size="sm">Setzen</Button>
          <span className="text-[12px] text-fg-4">Höher steht weiter oben, bei Gleichstand entscheiden die Stimmen. Fertige stehen unten.</span>
        </form>
      </section>

      <section>
        <form method="POST" action={AKTION} className="grid gap-3">
          <Felder app={app} tat="text" ansicht="ideen" id={idee.id} />
          <IdeeFelder titel={d.title} beschreibung={d.detail} />
          <div>
            <Button type="submit" variant="pill-dark" size="sm">Speichern und übersetzen</Button>
          </div>
        </form>
      </section>

      <section className="grid gap-2">
        <span className={LABEL}>Übersetzungen</span>
        {sprachen.length ? (
          <details className="text-[12.5px] text-fg-2">
            <summary className="cursor-pointer text-fg-3">{sprachen.length} Sprachen ansehen</summary>
            <dl className="mt-3 grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2">
              {sprachen.map(([lang, f]) => (
                <div key={lang} className="contents">
                  <dt className="text-fg-4 [font-family:var(--font-mono)]">{lang}</dt>
                  <dd className="m-0">
                    <span className="text-fg">{f.title}</span>
                    {f.detail ? <span className="text-fg-3"> · {f.detail}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-3">Noch nicht übersetzt. Einmal den Text speichern holt es nach.</p>
        )}
      </section>

      <section className="grid gap-3">
        <span className={LABEL}>Kommentare</span>
        {kommentare.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {kommentare.map((k) => (
              <li key={k.id} className="border-l-2 border-[var(--line-strong)] pl-3">
                <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.7] text-fg">{k.body}</div>
                <div className="mt-1 text-[11.5px] text-fg-4">
                  {inZone(k.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · in{" "}
                  {Object.keys(k.translations).length} Sprachen
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[12.5px] text-fg-3">Noch keine. Nur du kommentierst, Nutzer lesen es später in ihrer Sprache.</p>
        )}
        <form method="POST" action={AKTION} data-klar-leeren="ja" className="grid gap-2">
          <Felder app={app} tat="kommentar" ansicht="ideen" id={idee.id} />
          <textarea name="text" required rows={3} maxLength={2000} aria-label="Kommentar" className="klar-feld" />
          <div>
            <Button type="submit" variant="pill" size="sm">Kommentieren</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function WunschAnsicht({ app, w }: { app: BoardApp; w: Wish }) {
  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className={TITEL}>{w.bodyDe ?? w.body}</h2>
        {w.bodyDe && w.bodyDe !== w.body ? <p className="mt-2 text-[12.5px] text-fg-3">Original: {w.body}</p> : null}
        <p className="mt-1 text-[12px] text-fg-4">
          {datum(w.createdAt)} · {w.readAt ? "gelesen" : "ungelesen"}
        </p>
        {w.readAt ? null : (
          <form method="POST" action={AKTION} className="mt-3">
            <Felder app={app} tat="gelesen" ansicht="wuensche" wunsch={w.id} />
            <Button type="submit" variant="pill-dark" size="sm">Als gelesen markieren</Button>
          </form>
        )}
      </div>

      {w.promotedIdeaId ? (
        <p className="m-0 text-[13px] text-fg-2">
          Steht als Idee auf dem Board.{" "}
          <a href={adresse({ app, id: w.promotedIdeaId })} className="text-fg underline underline-offset-2">
            Ansehen
          </a>
        </p>
      ) : (
        <form method="POST" action={AKTION} className="grid gap-4">
          <Felder app={app} tat="aufs-board" ansicht="wuensche" wunsch={w.id} />
          <span className={LABEL}>Als Idee aufs Board</span>
          <IdeeFelder titel={(w.bodyDe ?? w.body).slice(0, 120)} />
          <div>
            <Button type="submit" variant="pill" size="sm">Aufs Board stellen</Button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Gemeldete Spitznamen aus Events, ein Eintrag pro gemeldeter Person, offene
 * zuerst. Sperren ersetzt den Namen im Event durch einen neutralen; Stehen
 * lassen erledigt die Meldungen, der Name bleibt.
 */
function MeldungenAnsicht({ app, meldungen }: { app: BoardApp; meldungen: EventReport[] }) {
  return (
    <TextureCard>
      <p className="m-0 border-b px-5 py-4 text-[12.5px] leading-[1.7] text-fg-3">
        Teilnehmer melden Spitznamen aus der Liste eines Events ({app.name} ab 2.6.0). Sperren ersetzt den Spitznamen im
        Event für alle durch einen neutralen, die Teilnahme bleibt. Stehen lassen erledigt die Meldungen ohne Sperre.
      </p>
      {meldungen.length === 0 ? (
        <p className="m-0 px-4 py-8 text-center text-[12.5px] text-fg-3">Keine Meldungen.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {meldungen.map((m) => (
            <li
              key={`${m.eventId}:${m.userId}`}
              className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 first:border-t-0"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn("truncate text-[14px] font-medium", m.blocked ? "text-fg-3" : "text-fg")}>{m.nickname}</span>
                  {m.flag ? <span aria-label={m.flag}>{flagge(m.flag)}</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-4">
                  <Punkt ton={m.blocked ? "var(--danger)" : m.open > 0 ? "var(--warning)" : undefined} />
                  {m.blocked ? "gesperrt" : m.open > 0 ? `${m.open} offen` : "stehen gelassen"} · {m.eventId} ·{" "}
                  {meldungenZahl(m.reports)} · zuletzt {datum(m.lastAt)}
                </div>
              </div>
              {m.blocked ? null : (
                <div className="flex shrink-0 items-center gap-2">
                  <form method="POST" action={AKTION}>
                    <Felder app={app} tat="sperren" ansicht="meldungen" />
                    <input type="hidden" name="event" value={m.eventId} />
                    <input type="hidden" name="konto" value={m.userId} />
                    <Button type="submit" variant="pill" size="sm">Sperren</Button>
                  </form>
                  {m.open > 0 ? (
                    <form method="POST" action={AKTION}>
                      <Felder app={app} tat="stehen-lassen" ansicht="meldungen" />
                      <input type="hidden" name="event" value={m.eventId} />
                      <input type="hidden" name="konto" value={m.userId} />
                      <Button type="submit" variant="pill-dark" size="sm">Stehen lassen</Button>
                    </form>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </TextureCard>
  );
}
