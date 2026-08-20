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
// Ein Kanal OHNE bisherige Richtung wird direkt gesetzt: da ist nichts zu
// begründen, und eine Rückfrage wäre nur im Weg.
//
// Der Verlauf steht als Zahl daneben, nicht als Zeitleiste (Alains Entscheid
// vom 2026-08-20): 24 Kanäle mit ausgeklappter Geschichte wären nicht mehr
// lesbar. Ein Klick auf die Zahl holt sie nach.

import { useState, useTransition } from "react";
import { DIRECTIONS, type Direction } from "@/lib/accountStates";
import { FIELD } from "./boardStyles";
import { loadChannelTimeline, reorientAccount, setDirectionPointer } from "./posting-actions";
import ReferenceSlot, { type SlotRef } from "./ReferenceSlot";
import PostSamples, { type ViewPost } from "./PostSamples";
import type { BoardAccount } from "./PostingBoard";

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
  const [pending, startTransition] = useTransition();
  // Was gewählt wurde, solange der Grund noch fehlt. `null` = keine Umstellung.
  const [wechsel, setWechsel] = useState<Direction | null>(null);
  const [grund, setGrund] = useState("");
  const [verlauf, setVerlauf] = useState<Verlaufszeile[] | null>(null);

  const laufend = row.direction;

  function waehle(v: string): void {
    if (!v || v === laufend) return;
    const d = v as Direction;
    if (!laufend) {
      startTransition(async () => {
        await reorientAccount(row.key, d);
      });
      return;
    }
    setWechsel(d);
  }

  function bestaetige(): void {
    const d = wechsel;
    if (!d) return;
    startTransition(async () => {
      await reorientAccount(row.key, d, { grund: grund.trim() || null });
      setWechsel(null);
      setGrund("");
    });
  }

  function abbrechen(): void {
    setWechsel(null);
    setGrund("");
  }

  function zeigeVerlauf(): void {
    if (verlauf) {
      setVerlauf(null);
      return;
    }
    startTransition(async () => {
      setVerlauf(await loadChannelTimeline(row.key));
    });
  }

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <select
        value={laufend}
        aria-label={`Richtung von @${row.handle}`}
        onChange={(e) => waehle(e.target.value)}
        className={`${FIELD} w-full cursor-pointer`}
      >
        <option value="">— keine Richtung —</option>
        {DIRECTIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* Seit wann, und wie viele es vorher schon gab. Die Zahl ist der Einstieg
          in den Verlauf — ohne sie wüsste niemand, dass es einen gibt. */}
      {laufend || row.priorDirections > 0 ? (
        <div className={`flex items-center gap-1.5 mt-1 ${MONO}`}>
          {row.directionSince ? (
            <span style={{ color: "var(--fg-4)" }}>seit {tag(row.directionSince)}</span>
          ) : null}
          {row.priorDirections > 0 ? (
            <button
              type="button"
              onClick={zeigeVerlauf}
              aria-expanded={Boolean(verlauf)}
              className="underline decoration-dotted hover:text-fg"
              style={{ color: "var(--fg-3)" }}
            >
              {row.priorDirections} vorher
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Der Grund gehört an die Richtung, die ENDET — die Frage, die man später
          stellt, ist „warum haben wir damit aufgehört", nicht „warum haben wir
          damit angefangen". */}
      {wechsel ? (
        <div className="mt-1.5 border border-line-strong rounded-[5px] p-1.5">
          <div className={`${MONO} mb-1`} style={{ color: "var(--fg-3)" }}>
            {laufend} → {wechsel}
          </div>
          <input
            value={grund}
            autoFocus
            placeholder="Warum weg von der alten? (darf leer bleiben)"
            aria-label={`Grund für den Richtungswechsel bei @${row.handle}`}
            onChange={(e) => setGrund(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") bestaetige();
              if (e.key === "Escape") abbrechen();
            }}
            className={`${FIELD} w-full`}
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={bestaetige}
              className={`${MONO} px-2 py-1 rounded-[4px] bg-fg text-[var(--accent-fg)]`}
            >
              wechseln
            </button>
            <button
              type="button"
              onClick={abbrechen}
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
      {laufend ? (
        <div className="mt-1 flex gap-1">
          {/* Die früher gesetzte Kennung bleibt sichtbar, damit sie beim
              Umstellen nicht still verschwindet. Das Video selbst hängt
              darunter am Kanal. */}
          {row.directionRef ? (
            <div
              className={`${MONO} flex-1 min-w-0 self-center truncate`}
              style={{ color: "var(--fg-4)" }}
              title={row.directionRef}
            >
              Ref: {row.directionRef}
            </div>
          ) : null}
          <select
            value={row.directionMirrors}
            aria-label={`Welchen Kanal @${row.handle} spiegelt`}
            onChange={(e) => {
              const v = e.target.value;
              startTransition(async () => {
                await setDirectionPointer(row.key, { spiegelt: v });
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
      {row.format && row.format !== laufend ? (
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
