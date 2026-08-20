"use client";

// Die Referenzvideos anlegen und pflegen — Alains Liste, nicht die der Agenten.
//
// Bis 2026-08-20 kam die Auswahl aus einer erzeugten Datei im Repo
// (`lib/referenceIds.ts`, gefüllt aus dem AI-Brain). Auswählen ging, anlegen
// nicht: eine Referenz, die Alain gerade im FYP sieht, hätte einen Umweg über
// den Vault und einen Deploy gebraucht. Jetzt steht sie in zwei Klicks hier.
//
// Was hier NICHT gepflegt wird, ist die Machart — Länge, Schnittliste,
// Kameraführung. Die misst ein Agent bei 10 fps über den ganzen Clip und
// schreibt sie ins Vault-Manifest. Beides hier zu tippen hiesse, zwei Fassungen
// derselben Sache zu haben, und die zweite wäre immer die schlechtere.
//
// Die **Kennung** ist der Zeiger, den alles andere benutzt: die Richtung eines
// Kanals nennt sie, das Vault-Manifest trägt sie, `KANAELE.md` fügt beides
// zusammen. Deshalb lässt sie sich nach dem Anlegen nicht mehr ändern.

import { useState, useTransition } from "react";
import { FIELD } from "./boardStyles";
import { dropReference, upsertReference } from "./posting-actions";
import type { BoardReference } from "./PostingBoard";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";
const KENNUNG_FORM = /^[a-z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export default function ReferencePanel({
  references,
  benutzt,
}: {
  references: BoardReference[];
  /** Kennungen, auf die gerade eine Richtung zeigt. Die lassen sich nicht löschen. */
  benutzt: Set<string>;
}) {
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [kennung, setKennung] = useState("");
  const [titel, setTitel] = useState("");
  const [herkunft, setHerkunft] = useState("");
  const [notiz, setNotiz] = useState("");

  const aktive = references.filter((r) => r.aktiv);
  const stillgelegt = references.filter((r) => !r.aktiv);

  function anlegen(): void {
    const k = kennung.trim().toLowerCase();
    if (!KENNUNG_FORM.test(k)) {
      setFehler("Kennung muss die Form <projekt>/<id> haben, z. B. basalt/avow-gym-fyp");
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
        notiz: notiz.trim() || null,
        aktiv: true,
      });
      if (!res.ok) {
        setFehler(res.fehler ?? "Speichern fehlgeschlagen");
        return;
      }
      setKennung("");
      setTitel("");
      setHerkunft("");
      setNotiz("");
    });
  }

  function entfernen(k: string): void {
    startTransition(async () => {
      const res = await dropReference(k);
      if (res.ok && res.behalten) {
        setFehler(`„${k}" wird von einem Kanal benutzt und ist nur stillgelegt, nicht gelöscht.`);
      }
    });
  }

  function umschalten(r: BoardReference): void {
    startTransition(async () => {
      await upsertReference(r.kennung, { aktiv: !r.aktiv });
    });
  }

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        className={`${MONO} w-full text-left px-5 py-3 hover:text-fg`}
        style={{ color: "var(--fg-3)" }}
      >
        {offen ? "▾" : "▸"} Referenzvideos ({aktive.length}
        {stillgelegt.length ? ` + ${stillgelegt.length} stillgelegt` : ""})
      </button>

      {offen ? (
        <div className={`px-5 pb-4 ${pending ? "opacity-60" : ""}`}>
          <p className="text-[11.5px] leading-snug mb-3" style={{ color: "var(--fg-3)" }}>
            Was hier steht, kann jeder Kanal als Richtung-Referenz auswählen. Die{" "}
            <strong>Machart</strong> des Videos — Länge, Schnitte, Kameraführung — wird nicht hier
            getippt: die misst ein Agent und schreibt sie ins Manifest im AI-Brain, unter derselben
            Kennung. Die Kennung lässt sich nachträglich nicht ändern, weil Richtung und Manifest
            darauf zeigen.
          </p>

          {fehler ? (
            <div
              className="text-[11.5px] leading-snug mb-3 border border-line-strong rounded-[5px] px-2.5 py-2"
              style={{ color: "var(--fg-2)" }}
              role="status"
            >
              {fehler}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5 mb-4">
            <input
              value={kennung}
              onChange={(e) => setKennung(e.target.value)}
              placeholder="kennung: basalt/avow-gym-fyp"
              aria-label="Kennung der neuen Referenz"
              className={`${FIELD} [font-family:var(--font-mono)]`}
              style={{ minWidth: 240 }}
            />
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Titel"
              aria-label="Titel der neuen Referenz"
              className={FIELD}
              style={{ minWidth: 160 }}
            />
            <input
              value={herkunft}
              onChange={(e) => setHerkunft(e.target.value)}
              placeholder="Herkunft: TikTok-Link, @konto …"
              aria-label="Herkunft der neuen Referenz"
              className={FIELD}
              style={{ minWidth: 200 }}
            />
            <input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") anlegen();
              }}
              placeholder="Notiz (optional)"
              aria-label="Notiz zur neuen Referenz"
              className={`${FIELD} flex-1`}
              style={{ minWidth: 200 }}
            />
            <button
              type="button"
              onClick={anlegen}
              className={`${MONO} px-3 rounded-[4px] bg-fg text-[var(--accent-fg)]`}
            >
              anlegen
            </button>
          </div>

          {references.length === 0 ? (
            <p className={MONO} style={{ color: "var(--fg-4)" }}>
              noch keine Referenz eingetragen
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...aktive, ...stillgelegt].map((r) => (
                <li
                  key={r.kennung}
                  className="flex items-start gap-2 border-b border-line pb-1.5"
                  style={{ opacity: r.aktiv ? 1 : 0.55 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] text-fg">{r.titel}</span>
                      <code className="[font-family:var(--font-mono)] text-[10px]" style={{ color: "var(--fg-4)" }}>
                        {r.kennung}
                      </code>
                      {benutzt.has(r.kennung) ? (
                        <span className={MONO} style={{ color: "var(--fg-3)" }}>
                          in Benutzung
                        </span>
                      ) : null}
                    </div>
                    {r.herkunft || r.notiz ? (
                      <div
                        className="[font-family:var(--font-mono)] text-[10px] leading-snug break-words"
                        style={{ color: "var(--fg-4)" }}
                      >
                        {[r.herkunft, r.notiz].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => umschalten(r)}
                    className={`${MONO} shrink-0 hover:text-fg`}
                    style={{ color: "var(--fg-3)" }}
                    title={r.aktiv ? "Aus der Auswahl nehmen" : "Wieder zur Auswahl hinzufügen"}
                  >
                    {r.aktiv ? "stilllegen" : "aktivieren"}
                  </button>
                  {!benutzt.has(r.kennung) ? (
                    <button
                      type="button"
                      onClick={() => entfernen(r.kennung)}
                      className={`${MONO} shrink-0 hover:text-fg`}
                      style={{ color: "var(--fg-4)" }}
                      title="Endgültig entfernen"
                    >
                      löschen
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
