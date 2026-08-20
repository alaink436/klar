"use client";

// Dateien auswählen oder hineinziehen — und direkt in den Bucket schicken.
//
// Warum nicht mehr über ein Formular an eine Route: eine Vercel-Funktion nimmt
// nur **4,5 MB** Body an. Die Oberfläche verspricht 200 MB, ein Handyvideo
// reisst das Limit sofort, und der Fehler kam vorher nicht einmal sichtbar
// zurück. Hier holt der Server nur ein signiertes Ziel je Datei, und die Datei
// selbst geht vom Browser direkt in den Bucket. Vercel sieht sie nie.
//
// Der Preis: ohne JavaScript geht es nicht mehr. Das ist es wert — vorher ging
// es mit JavaScript auch nicht.
//
// **Ein `<label>`, kein div mit onClick.** Die erste Fassung rief
// `input.click()` aus dem Elternelement heraus auf, in dem der Input steckte;
// dieser Klick blubbert zurück und löst ihn erneut aus. Dazu war der Input
// `display:none`, wofür Safari gar keinen Dialog öffnet. Am 2026-08-20 kam
// deshalb bei acht Anläufen keine einzige Datei an. Ein Label aktiviert sein
// Feld nativ: kein JavaScript, keine Rekursion, in jedem Browser.

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dateienUebernehmen, uploadVorbereiten } from "./posting-actions";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";
const ACCEPT =
  "video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";
/** Dasselbe Limit wie am Bucket. Ein Referenzclip ist 10 bis 30 Sekunden. */
const MAX_BYTES = 209_715_200;

export default function Hochladen({
  scope,
  art,
  etikett,
  klein,
  extra,
  knopf,
}: {
  scope: string;
  art: "referenz" | "post";
  etikett: string;
  klein?: boolean;
  /** Bei einem Post: Notiz und Ergebnis, erst beim Absenden gelesen. */
  extra?: () => { notiz?: string; ergebnis?: string };
  knopf?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [ueber, setUeber] = useState(false);
  const [dateien, setDateien] = useState<File[]>([]);
  const [stand, setStand] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const router = useRouter();

  function uebernehmen(liste: FileList | null): void {
    if (!liste || !liste.length) return;
    const gewaehlt = Array.from(liste);
    const zuGross = gewaehlt.find((f) => f.size > MAX_BYTES);
    if (zuGross) {
      setStand(`${zuGross.name} ist ${Math.round(zuGross.size / 1_048_576)} MB, erlaubt sind 200`);
      return;
    }
    setStand(null);
    setDateien(gewaehlt);
  }

  async function hoch(): Promise<void> {
    if (!dateien.length || laeuft) return;
    setLaeuft(true);
    setStand("bereite vor …");
    try {
      const vor = await uploadVorbereiten(scope, dateien.map((d) => d.name), art);
      if (!vor.ok || !vor.ziele) {
        setStand(vor.fehler ?? "Vorbereiten fehlgeschlagen");
        return;
      }
      const pfade: string[] = [];
      for (let i = 0; i < dateien.length; i++) {
        setStand(`lade ${i + 1} von ${dateien.length} …`);
        const ziel = vor.ziele[i];
        const res = await fetch(ziel.url, {
          method: "PUT",
          headers: { "Content-Type": dateien[i].type || "application/octet-stream" },
          body: dateien[i],
        });
        if (!res.ok) {
          setStand(`Upload von ${dateien[i].name} fehlgeschlagen (${res.status})`);
          return;
        }
        pfade.push(ziel.pfad);
      }
      setStand("speichere …");
      const fertig = await dateienUebernehmen(scope, pfade, art, extra?.() ?? {});
      if (!fertig.ok) {
        setStand(fertig.fehler ?? "Speichern fehlgeschlagen");
        return;
      }
      setDateien([]);
      setStand(`${pfade.length === 1 ? "Datei" : `${pfade.length} Dateien`} übernommen`);
      if (ref.current) ref.current.value = "";
      // Ohne das bleibt die neue Datei unsichtbar, bis jemand von Hand neu laedt.
      router.refresh();
    } catch {
      setStand("Upload fehlgeschlagen");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setUeber(true);
        }}
        onDragLeave={() => setUeber(false)}
        onDrop={(e) => {
          e.preventDefault();
          setUeber(false);
          uebernehmen(e.dataTransfer.files);
        }}
        className={`block rounded-[4px] border border-dashed cursor-pointer text-center ${
          klein ? "px-1 py-1.5" : "px-2 py-2.5"
        }`}
        style={{
          borderColor: ueber ? "var(--fg)" : "var(--line-strong)",
          background: ueber ? "var(--surface)" : "transparent",
        }}
      >
        <input
          id={id}
          ref={ref}
          type="file"
          accept={ACCEPT}
          multiple
          aria-label={`Dateien für ${etikett} wählen`}
          onChange={(e) => uebernehmen(e.target.files)}
          // Nicht `display:none`: so bleibt das Feld fokussierbar, und Safari
          // öffnet den Dialog zuverlässig.
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
        <span className={MONO} style={{ color: ueber ? "var(--fg-2)" : "var(--fg-4)" }}>
          {dateien.length === 0
            ? "ziehen oder wählen"
            : dateien.length === 1
              ? dateien[0].name.slice(0, 22)
              : `${dateien.length} Dateien`}
        </span>
      </label>

      <div className="flex gap-1 mt-1 items-center flex-wrap">
        <button
          type="button"
          onClick={hoch}
          disabled={!dateien.length || laeuft}
          className={`${MONO} px-1.5 py-0.5 rounded-[3px] border border-line-strong`}
          style={{ color: dateien.length && !laeuft ? "var(--fg-2)" : "var(--fg-4)" }}
        >
          {knopf ?? "hoch"}
        </button>
        {stand ? (
          <span className={MONO} style={{ color: "var(--fg-3)" }} role="status">
            {stand}
          </span>
        ) : null}
      </div>
    </div>
  );
}
