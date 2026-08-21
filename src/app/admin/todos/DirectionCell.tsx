"use client";

// Die Richtung eines Kanals: was dort gemacht wird, welche Referenz die Vorlage
// ist, und wessen Richtung übernommen wird.
//
// Bis 2026-08-20 war das ein Freitextfeld namens „Format", und ein Wechsel
// überschrieb, was vorher dort stand. Beides ist hier anders:
//
//   - Die Richtung ist eine feste Liste (`DIRECTIONS`). Vorher trugen acht
//     Zeilen dieselbe Richtung in drei Schreibweisen, und damit war nicht mehr
//     zu beantworten, welche Richtung über alle Kanäle am besten läuft.
//   - Ein Wechsel ist ein Wechsel, kein Überschreiben: die alte Zeile wird mit
//     Enddatum und Grund geschlossen (Migration 0027). Deshalb fragt die Zelle
//     beim Umstellen nach dem Grund, statt sofort zu schreiben — der Grund ist
//     die einzige Information, die es nur in dieser Sekunde gibt.
//
// **ZWEI FORMATE GLEICHZEITIG** (Migration 0037). 0027 liess je Kanal genau
// eine laufende Richtung zu. Seit 2026-08-21 laufen zwei: ein Hauptformat auf
// Platz 1 und ein mitlaufendes auf Platz 2. Der Anlass war handfest — ein
// generierter Spot kostet Credits bei einem Anbieter mit endlichem Abo, und
// daneben soll ein günstiges Format MITLAUFEN statt es abzulösen.
//
// Beide Plätze haben dieselbe Bedienung, deshalb steht sie einmal da und wird
// zweimal gerendert. Zwei Fassungen derselben Zelle wären in einem halben Jahr
// zwei verschiedene Zellen.
//
// Was Platz 2 zusätzlich hat, ist „beenden": aufhören ohne Ersatz. `reorient()`
// kann das nicht, es legt immer eine neue Zeile an. Wer das teure Format
// aufgibt, weil das Guthaben zur Neige geht, fängt aber nichts Neues an.
//
// Ein Kanal OHNE bisherige Richtung wird direkt gesetzt: da ist nichts zu
// begründen, und eine Rückfrage wäre nur im Weg.
//
// Der Verlauf steht als Zahl daneben, nicht als Zeitleiste (Alains Entscheid
// vom 2026-08-20): 24 Kanäle mit ausgeklappter Geschichte wären nicht mehr
// lesbar. Ein Klick auf die Zahl holt sie nach, je Platz getrennt.

import { useState, useTransition } from "react";
import { DIRECTIONS, type Direction } from "@/lib/accountStates";
import { FIELD } from "./boardStyles";
import {
  loadChannelTimeline,
  reorientAccount,
  setDirectionPointer,
  stopDirection,
} from "./posting-actions";
import ReferenceSlot, { type SlotRef } from "./ReferenceSlot";
import PostSamples, { type ViewPost } from "./PostSamples";
import type { BoardAccount, ViewDirection } from "./PostingBoard";

interface Verlaufszeile {
  art: "richtung" | "referenz";
  was: string;
  ebene?: string;
  ab: string;
  bis: string | null;
  grund: string | null;
}

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

function tag(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
}

/**
 * Ein Steckplatz: Auswahl, Verlauf, Referenzkennung, Spiegelung.
 *
 * `laufend` ist `null`, solange auf diesem Platz nichts läuft — dann ist die
 * Auswahl leer und alles darunter fällt weg, weil es nichts gibt, woran es
 * hängen könnte.
 */
function RichtungsPlatz({
  row,
  others,
  slot,
  laufend,
}: {
  row: BoardAccount;
  others: BoardAccount[];
  slot: 1 | 2;
  laufend: ViewDirection | null;
}) {
  const [pending, startTransition] = useTransition();
  // Was gewählt wurde, solange der Grund noch fehlt. `null` = keine Umstellung.
  const [wechsel, setWechsel] = useState<Direction | null>(null);
  const [grund, setGrund] = useState("");
  const [verlauf, setVerlauf] = useState<Verlaufszeile[] | null>(null);
  // Zweistufig, wie „weg" beim Referenzvideo: ein Klick zeigt die Rückfrage,
  // der zweite führt aus. Ein mitlaufendes Format versehentlich zu beenden
  // kostet den Verlauf nicht, aber es schreibt eine Zeile, die nicht stimmt.
  const [beendenOffen, setBeendenOffen] = useState(false);

  const richtung = laufend?.richtung ?? "";
  const frueher = laufend?.frueher ?? 0;

  function waehle(v: string): void {
    if (!v || v === richtung) return;
    const d = v as Direction;
    if (!richtung) {
      startTransition(async () => {
        await reorientAccount(row.key, d, { slot });
      });
      return;
    }
    setWechsel(d);
  }

  function bestaetige(): void {
    const d = wechsel;
    if (!d) return;
    startTransition(async () => {
      await reorientAccount(row.key, d, { grund: grund.trim() || null, slot });
      setWechsel(null);
      setGrund("");
    });
  }

  function abbrechen(): void {
    setWechsel(null);
    setGrund("");
  }

  function beende(): void {
    if (!beendenOffen) {
      setBeendenOffen(true);
      return;
    }
    startTransition(async () => {
      await stopDirection(row.key, slot, grund.trim() || null);
      setBeendenOffen(false);
      setGrund("");
    });
  }

  function zeigeVerlauf(): void {
    if (verlauf) {
      setVerlauf(null);
      return;
    }
    startTransition(async () => {
      setVerlauf(await loadChannelTimeline(row.key, slot));
    });
  }

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* Platz 2 sagt, was er ist. Platz 1 braucht keine Beschriftung: er steht
          oben und ist der Normalfall. */}
      {slot === 2 ? (
        <div className={`${MONO} mb-0.5`} style={{ color: "var(--fg-4)" }}>
          läuft mit
        </div>
      ) : null}

      <select
        value={richtung}
        aria-label={
          slot === 1
            ? `Richtung von @${row.handle}`
            : `Mitlaufendes Format von @${row.handle}`
        }
        onChange={(e) => waehle(e.target.value)}
        className={`${FIELD} w-full cursor-pointer`}
      >
        <option value="">{slot === 1 ? "— keine Richtung —" : "— kein zweites —"}</option>
        {DIRECTIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* Seit wann, und wie viele es vorher schon gab. Die Zahl ist der Einstieg
          in den Verlauf — ohne sie wüsste niemand, dass es einen gibt. */}
      {richtung || frueher > 0 ? (
        <div className={`flex items-center gap-1.5 mt-1 ${MONO}`}>
          {laufend?.ab ? (
            <span style={{ color: "var(--fg-4)" }}>seit {tag(laufend.ab)}</span>
          ) : null}
          {frueher > 0 ? (
            <button
              type="button"
              onClick={zeigeVerlauf}
              aria-expanded={Boolean(verlauf)}
              className="underline decoration-dotted hover:text-fg"
              style={{ color: "var(--fg-3)" }}
            >
              {frueher} vorher
            </button>
          ) : null}
          {richtung ? (
            <button
              type="button"
              onClick={beende}
              className="ml-auto underline decoration-dotted hover:text-fg"
              style={{ color: beendenOffen ? "var(--fg)" : "var(--fg-4)" }}
              title="Aufhören, ohne ein neues Format zu setzen"
            >
              {beendenOffen ? "sicher?" : "beenden"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Der Grund gehört an die Richtung, die ENDET — die Frage, die man später
          stellt, ist „warum haben wir damit aufgehört", nicht „warum haben wir
          damit angefangen". Deshalb teilen Wechsel und Beenden dasselbe Feld. */}
      {wechsel || beendenOffen ? (
        <div className="mt-1.5 border border-line-strong rounded-[5px] p-1.5">
          <div className={`${MONO} mb-1`} style={{ color: "var(--fg-3)" }}>
            {wechsel ? `${richtung} → ${wechsel}` : `${richtung} → aus`}
          </div>
          <input
            value={grund}
            autoFocus
            placeholder="Warum weg von der alten? (darf leer bleiben)"
            aria-label={`Grund für das Ende von ${richtung} bei @${row.handle}`}
            onChange={(e) => setGrund(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (wechsel) bestaetige();
                else beende();
              }
              if (e.key === "Escape") {
                abbrechen();
                setBeendenOffen(false);
              }
            }}
            className={`${FIELD} w-full`}
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={wechsel ? bestaetige : beende}
              className={`${MONO} px-2 py-1 rounded-[4px] bg-fg text-[var(--accent-fg)]`}
            >
              {wechsel ? "wechseln" : "beenden"}
            </button>
            <button
              type="button"
              onClick={() => {
                abbrechen();
                setBeendenOffen(false);
              }}
              className={`${MONO} px-2 py-1 rounded-[4px] border border-line-strong`}
              style={{ color: "var(--fg-3)" }}
            >
              abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {verlauf ? (
        <ul className="mt-1.5 border-l border-line-strong pl-2 space-y-1">
          {verlauf.length === 0 ? (
            <li className={MONO} style={{ color: "var(--fg-4)" }}>
              nichts aufgezeichnet
            </li>
          ) : null}
          {verlauf.map((v, i) => (
            <li
              key={`${v.art}-${v.ab}-${i}`}
              className="[font-family:var(--font-mono)] text-[9.5px] leading-snug break-words"
            >
              <span style={{ color: "var(--fg-4)" }}>
                {v.art === "richtung" ? "Richtung" : "Referenz"}
              </span>{" "}
              <span style={{ color: v.bis ? "var(--fg-3)" : "var(--fg-2)" }}>{v.was}</span>{" "}
              <span style={{ color: "var(--fg-4)" }}>
                {tag(v.ab)}–{v.bis ? tag(v.bis) : "läuft"}
                {v.ebene && v.ebene !== row.key ? ` · ${v.ebene}` : ""}
              </span>
              {v.grund ? <div style={{ color: "var(--fg-4)" }}>{v.grund}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Die Spiegelung hängt an der laufenden Richtung. Ohne Richtung gibt es
          nichts, woran sie hängen könnte. */}
      {richtung ? (
        <div className="mt-1 flex gap-1">
          {/* Die früher gesetzte Kennung bleibt sichtbar, damit sie beim
              Umstellen nicht still verschwindet. Das Video selbst hängt
              darunter am Kanal. */}
          {laufend?.referenz ? (
            <div
              className={`${MONO} flex-1 min-w-0 self-center truncate`}
              style={{ color: "var(--fg-4)" }}
              title={laufend.referenz}
            >
              Ref: {laufend.referenz}
            </div>
          ) : null}
          <select
            value={laufend?.spiegelt ?? ""}
            aria-label={`Welchen Kanal @${row.handle} spiegelt`}
            onChange={(e) => {
              const v = e.target.value;
              startTransition(async () => {
                await setDirectionPointer(row.key, { spiegelt: v }, slot);
              });
            }}
            className={`${FIELD} cursor-pointer shrink-0`}
            style={{ maxWidth: 104 }}
            title="Spiegelt die Richtung eines anderen Kanals"
          >
            <option value="">spiegelt —</option>
            {others
              .filter((o) => o.key !== row.key)
              .map((o) => (
                <option key={o.key} value={o.key}>
                  @{o.handle}
                </option>
              ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export default function DirectionCell({
  row,
  others,
  eigen,
  geerbt,
  posts,
}: {
  row: BoardAccount;
  others: BoardAccount[];
  /** Was an genau diesem Kanal haengt. */
  eigen?: SlotRef;
  /** Was gilt, wenn am Kanal nichts haengt — samt Ebene. */
  geerbt?: { ref: SlotRef; ebene: string } | null;
  /** Eigene plus geerbte Posts, die hier gelaufen sind. */
  posts: ViewPost[];
}) {
  // Platz 2 kostet zugeklappt eine Zeile. Er steht offen, sobald dort etwas
  // laeuft; solange nicht, reicht ein Knopf. 24 Kanaele mit einem leeren
  // Zweitfeld waeren 24 Zeilen fuer nichts.
  const [zweitOffen, setZweitOffen] = useState(false);

  const platz1 = row.directions.find((d) => d.slot === 1) ?? null;
  const platz2 = row.directions.find((d) => d.slot === 2) ?? null;

  return (
    <div>
      <RichtungsPlatz row={row} others={others} slot={1} laufend={platz1} />

      {platz2 || zweitOffen ? (
        <div className="mt-1.5 pt-1.5 border-t border-dashed border-line">
          <RichtungsPlatz row={row} others={others} slot={2} laufend={platz2} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setZweitOffen(true)}
          className={`${MONO} mt-1 hover:text-fg`}
          style={{ color: "var(--fg-4)" }}
          title="Ein zweites Format, das daneben mitläuft"
        >
          + zweites Format
        </button>
      )}

      {/* Das Referenzvideo dieses Kanals. Hängt hier nichts, zeigt der Schalter
          das geerbte Video der App oder Plattform, und ein Upload überschreibt
          es nur für diesen Kanal. */}
      <div className="mt-1.5 pt-1.5 border-t border-line">
        <ReferenceSlot
          scope={row.key}
          eigen={eigen}
          geerbt={geerbt}
          etikett={`@${row.handle}`}
        />
      </div>

      {/* Was hier schon gelaufen ist. Zugeklappt eine Zeile; die Kanalzeile
          traegt bereits Richtung, Referenz, Material und Woche. */}
      <PostSamples scope={row.key} handle={row.handle} posts={posts} />

      {/* Der Altwert aus dem Freitextfeld verschwindet nicht still. Er steht da,
          solange er etwas anderes sagt als die Richtung — bei den fünf Zeilen,
          die gar keine Richtung enthielten (Verweise auf fremde Konten, ein
          abgeschnittener Satz), ist er das Einzige, was davon übrig ist. */}
      {row.format && row.format !== platz1?.richtung && row.format !== platz2?.richtung ? (
        <div
          className="mt-1 [font-family:var(--font-mono)] text-[9.5px] leading-snug break-words"
          style={{ color: "var(--fg-4)" }}
          title="Alter Wert aus dem Format-Feld, vor der Umstellung am 2026-08-20"
        >
          früher: {row.format}
        </div>
      ) : null}
    </div>
  );
}
