"use client";

// Der Referenz-Reiter: je App, je Plattform und je Kanal ein Feld, in das
// Alain das Referenzvideo hochlädt. **Das Hochladen ist die Zuordnung** — keine
// Kennung tippen, keine Auswahlliste.
//
// Die erste Fassung war eine Bibliothek mit Kennungen, aus der man je Kanal
// einen Eintrag auswählt. Das ging an der Sache vorbei: gemeint war ein Feld
// dort, wo der Kanal steht.
//
// Die drei Ebenen erben nach unten. Ein Video an der App gilt für alle ihre
// Kanäle, eines an der Plattform für alle Kanäle dieser Plattform, eines am
// Kanal nur dort. Der spezifischste Treffer gewinnt, und wo geerbt wird, steht
// es an der Zeile. Das passt auf den Bestand: die drei Kelva-Kanäle fahren
// dasselbe, die zwei Basalt-Motivationskanäle auch — einmal an der App
// hochladen statt dreimal am Kanal.
//
// Was hier NICHT getippt wird, ist die Machart des Videos: Länge, Schnittliste,
// Kameraführung. Die misst ein Agent bei 10 fps über den ganzen Clip und
// schreibt sie ins Vault-Manifest.

import { useState, useTransition } from "react";
import { FIELD } from "./boardStyles";
import { setChannelReference } from "./posting-actions";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

/** Eine hinterlegte Ebene. `scope` ist app | app:plattform | app:plattform:handle. */
export interface ViewScopeRef {
  scope: string;
  titel: string | null;
  notiz: string | null;
  videoPfad: string | null;
  videoLink: string | null;
  /** Signierte Abspiel-URL, eine Stunde gültig. */
  videoUrl: string | null;
}

export interface ViewChannel {
  key: string;
  handle: string;
  platform: string;
  platformLabel: string;
  app: string;
  appLabel: string;
  appColor: string;
  state: string;
  richtung: string;
}

export default function ReferenceView({
  channels,
  refs,
  meldung,
}: {
  channels: ViewChannel[];
  /** Nach `scope`. Enthält nur die Ebenen, an denen wirklich etwas hängt. */
  refs: Record<string, ViewScopeRef>;
  /** Rückmeldung der Upload-Route, kommt als `?msg=` zurück. */
  meldung?: string;
}) {
  // Nach App, dann Plattform gruppieren — dieselbe Reihenfolge, in der Alain
  // die Kanäle im Posting-Reiter sieht.
  const apps: { app: string; label: string; color: string; plattformen: Map<string, ViewChannel[]> }[] = [];
  for (const c of channels) {
    let a = apps.find((x) => x.app === c.app);
    if (!a) {
      a = { app: c.app, label: c.appLabel, color: c.appColor, plattformen: new Map() };
      apps.push(a);
    }
    const liste = a.plattformen.get(c.platform) ?? [];
    liste.push(c);
    a.plattformen.set(c.platform, liste);
  }

  const belegt = channels.filter((c) => aufloesen(c.key, refs)).length;

  return (
    <div>
      <div className="px-5 py-4 border-b border-line">
        <p className="text-[12px] leading-snug max-w-[68ch]" style={{ color: "var(--fg-3)" }}>
          Lade das Referenzvideo dort hoch, wo es gelten soll. An der <strong>App</strong> gilt es
          für alle ihre Kanäle, an der <strong>Plattform</strong> für alle Kanäle dieser
          Plattform, am <strong>Kanal</strong> nur dort. Das Genauere gewinnt, und wo ein Kanal
          erbt, steht es an seiner Zeile.
        </p>
        <p className={`${MONO} mt-2`} style={{ color: "var(--fg-4)" }}>
          {belegt} von {channels.length} Kanälen haben eine Referenz
        </p>
      </div>

      {meldung ? (
        <div className="px-5 py-2.5 border-b border-line text-[12px]" style={{ color: "var(--fg-2)" }} role="status">
          {meldung}
        </div>
      ) : null}

      {apps.map((a) => (
        <section key={a.app} className="border-b border-line">
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full" style={{ background: a.color }} />
            <h2 className="text-[15px] font-semibold text-fg">{a.label}</h2>
            <span className={MONO} style={{ color: "var(--fg-4)" }}>
              gilt für alle Kanäle dieser App
            </span>
          </div>
          <div className="px-5 pb-3">
            <Slot scope={a.app} eintrag={refs[a.app]} etikett={`${a.label}, ganze App`} />
          </div>

          {[...a.plattformen.entries()].map(([plattform, kanaele]) => {
            const pScope = `${a.app}:${plattform}`;
            return (
              <div key={pScope} className="px-5 pb-4 border-t border-line">
                <div className="pt-3 pb-2 flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-fg-2">{kanaele[0].platformLabel}</h3>
                  <span className={MONO} style={{ color: "var(--fg-4)" }}>
                    gilt für alle {a.label}-Kanäle hier
                  </span>
                </div>
                <Slot
                  scope={pScope}
                  eintrag={refs[pScope]}
                  etikett={`${a.label} auf ${kanaele[0].platformLabel}`}
                />

                <ul className="mt-3 space-y-3 pl-3 border-l border-line">
                  {kanaele.map((c) => {
                    const treffer = aufloesen(c.key, refs);
                    const geerbt = treffer && treffer.ebene !== c.key ? treffer.ebene : null;
                    return (
                      <li key={c.key}>
                        <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                          <span className="text-[12.5px] text-fg">@{c.handle}</span>
                          <span className={MONO} style={{ color: "var(--fg-4)" }}>
                            {c.state}
                            {c.richtung ? ` · ${c.richtung}` : " · keine Richtung"}
                          </span>
                          {geerbt ? (
                            <span className={MONO} style={{ color: "var(--fg-3)" }}>
                              erbt von {geerbt}
                            </span>
                          ) : null}
                        </div>
                        <Slot
                          scope={c.key}
                          eintrag={refs[c.key]}
                          etikett={`@${c.handle}`}
                          geerbtVon={geerbt}
                          geerbtesVideo={geerbt ? treffer?.treffer.videoUrl ?? null : null}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Dieselbe Auflösung wie auf dem Server, damit die Anzeige nicht abweicht. */
function aufloesen(
  key: string,
  refs: Record<string, ViewScopeRef>,
): { treffer: ViewScopeRef; ebene: string } | null {
  const teile = key.split(":");
  for (let i = teile.length; i >= 1; i--) {
    const scope = teile.slice(0, i).join(":");
    const r = refs[scope];
    // Eine Zeile zählt erst als hinterlegt, wenn wirklich etwas dranhängt.
    if (r && (r.videoPfad || r.videoLink)) return { treffer: r, ebene: scope };
  }
  return null;
}

/**
 * Ein Feld für eine Ebene: Spieler, Datei-Auswahl, Titel, Link, Notiz.
 *
 * Der Upload ist ein gewöhnliches Formular an eine Route und keine
 * Server-Action: 200 MB passen nicht durch deren Serialisierung, und so
 * funktioniert es auch ohne JavaScript.
 */
function Slot({
  scope,
  eintrag,
  etikett,
  geerbtVon,
  geerbtesVideo,
}: {
  scope: string;
  eintrag?: ViewScopeRef;
  etikett: string;
  geerbtVon?: string | null;
  geerbtesVideo?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);

  const eigenesVideo = eintrag?.videoUrl ?? null;
  const zeigt = eigenesVideo ?? geerbtesVideo ?? null;
  const hatEigenes = Boolean(eintrag?.videoPfad || eintrag?.videoLink);

  function feld(patch: Parameters<typeof setChannelReference>[1]): void {
    startTransition(async () => {
      await setChannelReference(scope, patch);
    });
  }

  return (
    <div className={`flex gap-3 flex-wrap ${pending ? "opacity-60" : ""}`}>
      <div className="shrink-0" style={{ width: 108 }}>
        {zeigt ? (
          <video
            src={zeigt}
            controls
            preload="metadata"
            playsInline
            className="w-full rounded-[5px] border border-line bg-black"
            style={{ aspectRatio: "9 / 16", objectFit: "contain", opacity: eigenesVideo ? 1 : 0.6 }}
          />
        ) : (
          <div
            className={`${MONO} w-full rounded-[5px] border border-dashed border-line-strong flex items-center justify-center text-center px-1`}
            style={{ aspectRatio: "9 / 16", color: "var(--fg-4)" }}
          >
            leer
          </div>
        )}

        <form
          action="/admin/referenz-video"
          method="post"
          encType="multipart/form-data"
          className="mt-1"
        >
          <input type="hidden" name="scope" value={scope} />
          <input
            type="file"
            name="datei"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
            aria-label={`Referenzvideo für ${etikett} wählen`}
            className="block w-full text-[9px] file:mr-1 file:py-0.5 file:px-1.5 file:rounded-[3px] file:border file:border-line file:bg-bg file:text-fg file:text-[9px]"
          />
          <div className="flex gap-1 mt-1">
            <button
              type="submit"
              className={`${MONO} px-1.5 py-0.5 rounded-[3px] border border-line-strong`}
              style={{ color: "var(--fg-2)" }}
            >
              hochladen
            </button>
            {eintrag?.videoPfad ? (
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

      <div className="flex-1 min-w-[240px] space-y-1">
        <input
          defaultValue={eintrag?.titel ?? ""}
          placeholder={hatEigenes ? "Titel" : `Titel (optional) — ${etikett}`}
          aria-label={`Titel der Referenz für ${etikett}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (eintrag?.titel ?? "")) feld({ titel: v || null });
          }}
          className={`${FIELD} w-full`}
        />
        <input
          defaultValue={eintrag?.videoLink ?? ""}
          placeholder="oder Link zum Original (TikTok, Drive)"
          aria-label={`Link zur Referenz für ${etikett}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (eintrag?.videoLink ?? "")) feld({ videoLink: v || null });
          }}
          className={`${FIELD} w-full [font-family:var(--font-mono)] text-[11px]`}
        />
        <textarea
          defaultValue={eintrag?.notiz ?? ""}
          placeholder="Notiz: was an diesem Video übernommen wird"
          aria-label={`Notiz zur Referenz für ${etikett}`}
          rows={2}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (eintrag?.notiz ?? "")) feld({ notiz: v || null });
          }}
          className={`${FIELD} w-full h-auto py-1.5 leading-snug resize-y`}
        />
        {geerbtVon && !hatEigenes ? (
          <p className={MONO} style={{ color: "var(--fg-4)" }}>
            zeigt gerade das Video von {geerbtVon}. Hier hochladen überschreibt es nur für {etikett}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
