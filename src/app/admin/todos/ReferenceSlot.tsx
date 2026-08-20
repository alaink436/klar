"use client";

// Das Referenzvideo einer Ebene, kompakt genug für eine Zeile im Posting-Board.
//
// Bis heute stand das in einem eigenen Reiter. Zwei Reiter für eine Sache waren
// zu umständlich: der Kanal steht im Board, also gehört sein Referenzvideo
// dorthin. Der eigene Reiter ist weg.
//
// Drei Ebenen, sie erben nach unten — App, Plattform, Kanal. Was ein Kanal
// zeigt, kann von seiner App kommen; dann steht es an der Zeile, und ein Upload
// hier überschreibt es nur für diesen Kanal.
//
// Ein neues Video ist ein **Wechsel**, kein Überschreiben: die alte Zeile wird
// mit Datum und Grund geschlossen (Migration 0031) und bleibt im Verlauf
// sichtbar. Titel und Notiz zu ändern ist dagegen kein Wechsel.

import { useState, useTransition } from "react";
import { FIELD } from "./boardStyles";
import { setChannelReference } from "./posting-actions";
import FileDrop from "./FileDrop";
import Medienkachel, { type Medium } from "./Medienkachel";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

export interface SlotRef {
  scope: string;
  titel: string | null;
  notiz: string | null;
  /** Bei einer Slideshow mehrere, in Reihenfolge. */
  medien: Medium[];
  videoLink: string | null;
}

export default function ReferenceSlot({
  scope,
  eigen,
  geerbt,
  etikett,
  breit,
}: {
  /** Die Ebene, an der dieser Schalter hängt. */
  scope: string;
  /** Was an genau dieser Ebene hängt, falls überhaupt etwas. */
  eigen?: SlotRef;
  /** Was gilt, wenn hier nichts hängt — samt Ebene, von der es kommt. */
  geerbt?: { ref: SlotRef; ebene: string } | null;
  etikett: string;
  /** Im Board schmal, in der App-Leiste etwas breiter. */
  breit?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);

  const hatEigenes = Boolean(eigen && (eigen.medien.length > 0 || eigen.videoLink));
  const quelle = hatEigenes ? eigen : geerbt?.ref;
  const medien = quelle?.medien ?? [];
  const w = breit ? 96 : 72;

  function feld(patch: Parameters<typeof setChannelReference>[1]): void {
    startTransition(async () => {
      await setChannelReference(scope, patch);
    });
  }

  return (
    <div className={`flex gap-1.5 ${pending ? "opacity-60" : ""}`}>
      <div className="shrink-0" style={{ width: w }}>
        {medien.length ? (
          <div className={medien.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}>
            {medien.map((m, k) => (
              <Medienkachel
                key={k}
                medium={m}
                alt={`Referenz für ${etikett}, Teil ${k + 1}`}
                gedimmt={!hatEigenes}
              />
            ))}
          </div>
        ) : (
          <div
            className={`${MONO} w-full rounded-[4px] border border-dashed border-line-strong flex items-center justify-center text-center px-1`}
            style={{ aspectRatio: "9 / 16", color: "var(--fg-4)" }}
          >
            leer
          </div>
        )}

        {/* Gewöhnliches Formular an eine Route: 200 MB passen nicht durch die
            Serialisierung einer Server-Action, und so geht es auch ohne JS. */}
        <form
          action="/admin/referenz-video"
          method="post"
          encType="multipart/form-data"
          className="mt-1"
        >
          <input type="hidden" name="scope" value={scope} />
          <FileDrop
            name="datei"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            ariaLabel={`Referenz für ${etikett} wählen`}
            klein
          />
          <div className="flex gap-1 mt-1">
            <button
              type="submit"
              className={`${MONO} px-1.5 py-0.5 rounded-[3px] border border-line-strong`}
              style={{ color: "var(--fg-2)" }}
            >
              hoch
            </button>
            {eigen && eigen.medien.length > 0 ? (
              <button
                type="submit"
                name="aktion"
                value="entfernen"
                onClick={(e) => {
                  if (!offen) {
                    e.preventDefault();
                    setOffen(true);
                  }
                }}
                className={`${MONO} px-1.5 py-0.5 rounded-[3px] border border-line-strong`}
                style={{ color: offen ? "var(--fg)" : "var(--fg-4)" }}
              >
                {offen ? "sicher?" : "weg"}
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <input
          defaultValue={eigen?.titel ?? ""}
          placeholder="Referenz: Titel"
          aria-label={`Titel der Referenz für ${etikett}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (eigen?.titel ?? "")) feld({ titel: v || null });
          }}
          className={`${FIELD} w-full`}
        />
        <input
          defaultValue={eigen?.videoLink ?? ""}
          placeholder="oder Link zum Original"
          aria-label={`Link zur Referenz für ${etikett}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (eigen?.videoLink ?? "")) feld({ videoLink: v || null });
          }}
          className={`${FIELD} w-full [font-family:var(--font-mono)] text-[10.5px]`}
        />
        {!hatEigenes && geerbt ? (
          <p className={MONO} style={{ color: "var(--fg-4)" }}>
            von {geerbt.ebene}
          </p>
        ) : null}
      </div>
    </div>
  );
}
