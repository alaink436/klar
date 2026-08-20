"use client";

// Der Referenz-Reiter: anlegen, bearbeiten, Video hinterlegen, ansehen.
//
// Bis 2026-08-20 hing die Liste als aufklappbares Panel unter der
// Posting-Tabelle. Erreichbar war sie, auffindbar nicht, und für einen
// Videospieler war dort schlicht kein Platz. Als eigene Ansicht bekommt sie die
// Breite, die ein Clip braucht.
//
// Die Verbindung zum Posting-Reiter steht an jeder Zeile: **wer fährt das
// gerade**. Ohne sie wären es zwei Listen, die man im Kopf abgleicht, und genau
// das war der Zustand, aus dem diese ganze Arbeit kam.
//
// Zwei Wege zum Video, weil es zwei Fälle gibt: die Datei hochladen (dann läuft
// sie hier im Spieler) oder nur die Adresse des Originals hinterlegen (bei
// fremden Posts, die sich nicht herunterladen lassen). Beide dürfen
// gleichzeitig stehen, der Link belegt die Herkunft.
//
// Was hier NICHT getippt wird, ist die Machart — Länge, Schnittliste,
// Kameraführung. Die misst ein Agent bei 10 fps über den ganzen Clip und
// schreibt sie ins Vault-Manifest unter derselben Kennung. Zwei Fassungen
// davon wären eine zu viel, und die getippte wäre die schlechtere.

import { useState, useTransition } from "react";
import { FIELD } from "./boardStyles";
import { dropReference, upsertReference } from "./posting-actions";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";
const KENNUNG_FORM = /^[a-z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export interface ViewReference {
  kennung: string;
  titel: string;
  herkunft: string | null;
  notiz: string | null;
  ablage: string | null;
  aktiv: boolean;
  videoPfad: string | null;
  videoLink: string | null;
  /** Signierte Abspiel-URL, eine Stunde gültig. Vom Server bei jedem Aufruf frisch. */
  videoUrl: string | null;
}

export interface ViewUse {
  accountKey: string;
  handle: string;
  richtung: string;
}

export default function ReferenceView({
  references,
  usage,
  meldung,
}: {
  references: ViewReference[];
  /** Kennung → welche Kanäle sie gerade fahren. Die Brücke zum Posting-Reiter. */
  usage: Record<string, ViewUse[]>;
  /** Rückmeldung der Upload-Route, kommt als `?msg=` zurück. */
  meldung?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [kennung, setKennung] = useState("");
  const [titel, setTitel] = useState("");
  const [herkunft, setHerkunft] = useState("");

  const aktive = references.filter((r) => r.aktiv);
  const stillgelegt = references.filter((r) => !r.aktiv);
  const mitVideo = references.filter((r) => r.videoPfad || r.videoLink).length;

  function anlegen(): void {
    const k = kennung.trim().toLowerCase();
    if (!KENNUNG_FORM.test(k)) {
      setFehler("Kennung braucht die Form <projekt>/<id>, z. B. basalt/avow-gym-fyp");
      return;
    }
    if (!titel.trim()) {
      setFehler("Ohne Titel stünde die Zeile namenlos in der Auswahl.");
      return;
    }
    setFehler(null);
    startTransition(async () => {
      const res = await upsertReference(k, {
        titel: titel.trim(),
        herkunft: herkunft.trim() || null,
        aktiv: true,
      });
      if (!res.ok) {
        setFehler(res.fehler ?? "Speichern fehlgeschlagen");
        return;
      }
      setKennung("");
      setTitel("");
      setHerkunft("");
    });
  }

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="px-5 py-4 border-b border-line">
        <p className="text-[12px] leading-snug max-w-[62ch]" style={{ color: "var(--fg-3)" }}>
          Deine Referenzvideos. Was hier steht, lässt sich im Posting-Reiter jedem Kanal als
          Richtung-Referenz zuweisen. Die <strong>Kennung</strong> ist der Zeiger, den auch das
          Manifest im AI-Brain benutzt, und sie lässt sich nachträglich nicht ändern.
        </p>
        <p className={`${MONO} mt-2`} style={{ color: "var(--fg-4)" }}>
          {aktive.length} aktiv · {mitVideo} mit Video · {stillgelegt.length} stillgelegt
        </p>
      </div>

      {meldung ? (
        <div
          className="px-5 py-2.5 border-b border-line text-[12px]"
          style={{ color: "var(--fg-2)" }}
          role="status"
        >
          {meldung}
        </div>
      ) : null}
      {fehler ? (
        <div
          className="px-5 py-2.5 border-b border-line text-[12px]"
          style={{ color: "var(--fg-2)" }}
          role="status"
        >
          {fehler}
        </div>
      ) : null}

      {/* Anlegen steht oben: eine Referenz trägt man ein, während man sie noch
          vor Augen hat, nicht nachdem man durch die ganze Liste gescrollt ist. */}
      <div className="px-5 py-3 border-b border-line flex flex-wrap gap-1.5 items-center">
        <input
          value={kennung}
          onChange={(e) => setKennung(e.target.value)}
          placeholder="basalt/mein-neues-video"
          aria-label="Kennung der neuen Referenz"
          className={`${FIELD} [font-family:var(--font-mono)]`}
          style={{ minWidth: 250 }}
        />
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Titel"
          aria-label="Titel der neuen Referenz"
          className={FIELD}
          style={{ minWidth: 170 }}
        />
        <input
          value={herkunft}
          onChange={(e) => setHerkunft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") anlegen();
          }}
          placeholder="Herkunft: TikTok-Link, @konto …"
          aria-label="Herkunft der neuen Referenz"
          className={`${FIELD} flex-1`}
          style={{ minWidth: 220 }}
        />
        <button
          type="button"
          onClick={anlegen}
          className={`${MONO} px-3 h-8 rounded-[4px] bg-fg text-[var(--accent-fg)]`}
        >
          anlegen
        </button>
      </div>

      {references.length === 0 ? (
        <p className={`${MONO} px-5 py-6`} style={{ color: "var(--fg-4)" }}>
          noch keine Referenz eingetragen
        </p>
      ) : (
        <ul>
          {[...aktive, ...stillgelegt].map((r) => (
            <ReferenceRow key={r.kennung} r={r} uses={usage[r.kennung] ?? []} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Eine Zeile: links das Video, rechts die Felder.
 *
 * Die Felder schreiben beim Verlassen (`onBlur`), nicht bei jedem Tastendruck —
 * sonst liefe pro Buchstabe ein Schreibvorgang. Dasselbe Muster wie im
 * Posting-Board, damit sich beide Reiter gleich anfühlen.
 */
function ReferenceRow({ r, uses }: { r: ViewReference; uses: ViewUse[] }) {
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);

  function feld(patch: Parameters<typeof upsertReference>[1]): void {
    startTransition(async () => {
      await upsertReference(r.kennung, patch);
    });
  }

  return (
    <li
      className="border-b border-line px-5 py-4"
      style={{ opacity: r.aktiv ? 1 : 0.55 }}
    >
      <div className="flex gap-5 flex-wrap">
        {/* Der Spieler ist bewusst schmal und hochkant: fast jede Referenz ist
            9:16, und in Postkartenbreite sähe man nichts von der Mimik. */}
        <div className="shrink-0" style={{ width: 168 }}>
          {r.videoUrl ? (
            <video
              src={r.videoUrl}
              controls
              preload="metadata"
              playsInline
              className="w-full rounded-[6px] border border-line bg-black"
              style={{ aspectRatio: "9 / 16", objectFit: "contain" }}
            />
          ) : (
            <div
              className={`${MONO} w-full rounded-[6px] border border-dashed border-line-strong flex items-center justify-center text-center px-2`}
              style={{ aspectRatio: "9 / 16", color: "var(--fg-4)" }}
            >
              kein Video
              <br />
              hinterlegt
            </div>
          )}

          {/* Ein gewöhnliches Formular an eine Route: eine 200-MB-Datei durch
              eine Server-Action zu schicken ginge nicht, und so läuft es auch
              ohne JavaScript. */}
          <form
            action="/admin/referenz-video"
            method="post"
            encType="multipart/form-data"
            className="mt-1.5"
          >
            <input type="hidden" name="kennung" value={r.kennung} />
            <input
              type="file"
              name="datei"
              accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
              aria-label={`Video für ${r.kennung} wählen`}
              className="block w-full text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded-[4px] file:border file:border-line file:bg-bg file:text-fg file:text-[10px]"
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="submit"
                className={`${MONO} px-2 py-1 rounded-[4px] border border-line-strong`}
                style={{ color: "var(--fg-2)" }}
              >
                hochladen
              </button>
              {r.videoPfad ? (
                <button
                  type="submit"
                  name="aktion"
                  value="entfernen"
                  className={`${MONO} px-2 py-1 rounded-[4px] border border-line-strong`}
                  style={{ color: "var(--fg-4)" }}
                >
                  entfernen
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="flex-1 min-w-[280px] space-y-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <code
              className="[font-family:var(--font-mono)] text-[10.5px]"
              style={{ color: "var(--fg-4)" }}
            >
              {r.kennung}
            </code>
            {!r.aktiv ? (
              <span className={MONO} style={{ color: "var(--fg-4)" }}>
                stillgelegt
              </span>
            ) : null}
          </div>

          <input
            defaultValue={r.titel}
            placeholder="Titel"
            aria-label={`Titel von ${r.kennung}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== r.titel) feld({ titel: v });
            }}
            className={`${FIELD} w-full`}
          />
          <input
            defaultValue={r.herkunft ?? ""}
            placeholder="Herkunft: TikTok-Post, @konto, eigene Aufnahme"
            aria-label={`Herkunft von ${r.kennung}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (r.herkunft ?? "")) feld({ herkunft: v || null });
            }}
            className={`${FIELD} w-full`}
          />
          <input
            defaultValue={r.videoLink ?? ""}
            placeholder="Link zum Original (falls die Datei nicht herunterladbar ist)"
            aria-label={`Videolink von ${r.kennung}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (r.videoLink ?? "")) feld({ videoLink: v || null });
            }}
            className={`${FIELD} w-full [font-family:var(--font-mono)] text-[11px]`}
          />
          {r.videoLink ? (
            <a
              href={r.videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${MONO} inline-block underline decoration-dotted`}
              style={{ color: "var(--fg-3)" }}
            >
              Original öffnen
            </a>
          ) : null}
          <textarea
            defaultValue={r.notiz ?? ""}
            placeholder="Deine Notiz. Die gemessene Machart kommt aus dem AI-Brain, nicht hierher."
            aria-label={`Notiz zu ${r.kennung}`}
            rows={2}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (r.notiz ?? "")) feld({ notiz: v || null });
            }}
            className={`${FIELD} w-full h-auto py-1.5 leading-snug resize-y`}
          />

          {/* Die Brücke zum Posting-Reiter. */}
          <div className="pt-0.5">
            {uses.length ? (
              <div className={MONO} style={{ color: "var(--fg-3)" }}>
                fährt gerade:{" "}
                {uses.map((u, i) => (
                  <span key={u.accountKey}>
                    {i > 0 ? " · " : ""}@{u.handle} ({u.richtung})
                  </span>
                ))}
              </div>
            ) : (
              <div className={MONO} style={{ color: "var(--fg-4)" }}>
                noch keinem Kanal zugewiesen
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => feld({ aktiv: !r.aktiv })}
              className={`${MONO} hover:text-fg`}
              style={{ color: "var(--fg-3)" }}
            >
              {r.aktiv ? "stilllegen" : "aktivieren"}
            </button>
            {uses.length === 0 ? (
              <button
                type="button"
                onClick={() => setOffen(true)}
                className={`${MONO} hover:text-fg`}
                style={{ color: "var(--fg-4)" }}
              >
                löschen
              </button>
            ) : null}
            {offen ? (
              <span className={MONO} style={{ color: "var(--fg-2)" }}>
                sicher?{" "}
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await dropReference(r.kennung);
                      setOffen(false);
                    })
                  }
                  className="underline"
                >
                  ja, löschen
                </button>{" "}
                <button type="button" onClick={() => setOffen(false)} className="underline">
                  nein
                </button>
              </span>
            ) : null}
            {pending ? (
              <span className={MONO} style={{ color: "var(--fg-4)" }}>
                speichert …
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
