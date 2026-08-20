"use client";

// Die Posts, die auf einem Kanal gelaufen sind — mit Alains Anweisung, worauf
// sich künftige Posts beziehen sollen.
//
// Das Gegenstück zur Referenz direkt darüber. Die Referenz ist das FREMDE
// Video, dessen Machart wir übernehmen: eines je Ebene, mit Verlauf. Hier
// liegen die EIGENEN Posts, die konvertiert haben: beliebig viele, nebeneinander.
//
//   Referenz  „wonach bauen wir"     → einer gilt
//   Posts     „was lief hier schon"  → alle gelten nebeneinander
//
// Deshalb sammelt diese Liste über die Ebenen hinweg statt den spezifischsten
// Treffer zu nehmen: was auf einem Kelva-Kanal lief, ist auch für die anderen
// beiden ein Vorbild.
//
// Zugeklappt kostet das eine Zeile. Die Kanalzeile trägt schon Richtung,
// Referenz, Material und Woche; eine offene Videosammlung obendrauf wäre nicht
// mehr überblickbar.

import { useState, useTransition } from "react";
import { FIELD } from "./boardStyles";
import { dropPostSample, setPostSample } from "./posting-actions";
import FileDrop from "./FileDrop";
import Medienkachel, { type Medium } from "./Medienkachel";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

export interface ViewPost {
  id: number;
  scope: string;
  titel: string | null;
  notiz: string | null;
  /** Bei einem Carousel mehrere, in Reihenfolge. */
  medien: Medium[];
  videoLink: string | null;
  ergebnis: string | null;
}

export default function PostSamples({
  scope,
  handle,
  posts,
}: {
  /** Der Kanal, an den ein neuer Post gehängt wird. */
  scope: string;
  handle: string;
  /** Eigene plus geerbte, schon zusammengeführt. */
  posts: ViewPost[];
}) {
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notiz, setNotiz] = useState("");

  return (
    <div className="mt-1.5 pt-1.5 border-t border-line">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        className={`${MONO} hover:text-fg`}
        style={{ color: posts.length ? "var(--fg-3)" : "var(--fg-4)" }}
      >
        {offen ? "▾" : "▸"} Posts die liefen ({posts.length})
      </button>

      {offen ? (
        <div className={pending ? "opacity-60 mt-1.5" : "mt-1.5"}>
          {/* Die Notiz steht VOR dem Dateifeld, nicht dahinter: sie ist der
              eigentliche Inhalt der Zeile. Ein Post ohne Anweisung ist nur ein
              Video, und hinterher tippt sie niemand nach. */}
          <form action="/admin/referenz-video" method="post" encType="multipart/form-data">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="art" value="post" />
            <input
              name="notiz"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Worauf soll man sich beziehen? z. B. gleicher Hook, ruhigerer Schnitt"
              aria-label={`Anweisung zum neuen Post für @${handle}`}
              className={`${FIELD} w-full`}
            />
            <div className="flex gap-1.5 mt-1 items-center flex-wrap">
              <input
                name="ergebnis"
                placeholder="Ergebnis (12k Views …)"
                aria-label={`Ergebnis des neuen Posts für @${handle}`}
                className={FIELD}
                style={{ maxWidth: 150 }}
              />
              <div style={{ minWidth: 150 }}>
                <FileDrop
                  name="datei"
                  accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                  ariaLabel={`Dateien des Posts für @${handle} wählen`}
                  klein
                />
              </div>
              <button
                type="submit"
                className={`${MONO} px-2 py-1 rounded-[3px] bg-fg text-[var(--accent-fg)]`}
              >
                Post dazu
              </button>
            </div>
          </form>

          {posts.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {posts.map((p) => (
                <li key={p.id} className="border border-line rounded-[5px] p-1.5" style={{ width: 168 }}>
                  {p.medien.length ? (
                    <div className={p.medien.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}>
                      {p.medien.map((m, k) => (
                        <Medienkachel
                          key={k}
                          medium={m}
                          alt={`${p.titel ?? "Gelaufener Post"}, Teil ${k + 1}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`${MONO} w-full rounded-[4px] border border-dashed border-line-strong flex items-center justify-center`}
                      style={{ aspectRatio: "9 / 16", color: "var(--fg-4)" }}
                    >
                      ohne Datei
                    </div>
                  )}

                  {p.scope !== scope ? (
                    <div className={`${MONO} mt-1`} style={{ color: "var(--fg-4)" }}>
                      von {p.scope}
                    </div>
                  ) : null}

                  <textarea
                    defaultValue={p.notiz ?? ""}
                    placeholder="worauf beziehen?"
                    aria-label={`Anweisung zu Post ${p.id}`}
                    rows={2}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (p.notiz ?? "")) {
                        startTransition(async () => {
                          await setPostSample(p.id, { notiz: v || null });
                        });
                      }
                    }}
                    className={`${FIELD} w-full h-auto py-1 mt-1 leading-snug resize-y text-[11px]`}
                  />
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className={MONO} style={{ color: "var(--fg-4)" }}>
                      {p.ergebnis || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await dropPostSample(p.id);
                        })
                      }
                      className={`${MONO} hover:text-fg`}
                      style={{ color: "var(--fg-4)" }}
                      title="Aus der Sammlung nehmen. Bleibt als Beleg erhalten."
                    >
                      raus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${MONO} mt-2`} style={{ color: "var(--fg-4)" }}>
              noch keiner. Sobald einer konvertiert, hier hochladen — dann bauen die
              nächsten darauf auf.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
