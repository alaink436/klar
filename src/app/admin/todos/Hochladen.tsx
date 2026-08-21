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

/**
 * Der Bucket nimmt genau diese Typen an, sonst antwortet er 400 — **mit leerem
 * Body**, also ohne jeden Hinweis. Und `File.type` ist oft leer: Windows kennt
 * `.mov` und `.heic` nicht immer, und was per Drag-and-drop aus manchen Apps
 * kommt, hat gar keinen Typ. Vorher ging dann `application/octet-stream` raus,
 * der Bucket wies ab, und in der Zeile stand nur „fehlgeschlagen (400)".
 * Am 2026-08-21 nachgemessen: `application/octet-stream` und leer → 400,
 * `video/quicktime` und `image/heic` → 200.
 *
 * Deshalb entscheidet die Endung, nicht der Browser.
 */
const TYP_JE_ENDUNG: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

const ERLAUBT = new Set(Object.values(TYP_JE_ENDUNG));

/**
 * Womit die Datei in den Bucket geht.
 *
 * Die Endung gewinnt vor `File.type`: sie steht am Dateinamen, den der Server
 * ohnehin uebernimmt, und ist damit die Angabe, die zum abgelegten Objekt passt.
 * Nur wenn die Endung unbekannt ist, zaehlt der Browser — und auch dann nur,
 * wenn der Bucket den Typ ueberhaupt annimmt.
 */
function inhaltsTyp(datei: File): string | null {
  const endung = datei.name.toLowerCase().split(".").pop() ?? "";
  const ausEndung = TYP_JE_ENDUNG[endung];
  if (ausEndung) return ausEndung;
  const ausBrowser = (datei.type || "").toLowerCase().split(";")[0].trim();
  return ERLAUBT.has(ausBrowser) ? ausBrowser : null;
}

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
    // Beim Auswaehlen sagen, nicht erst nach dem Hochladen: sonst laeuft eine
    // 80-MB-Datei durch und wird am Ende abgewiesen.
    const fremd = gewaehlt.find((f) => !inhaltsTyp(f));
    if (fremd) {
      setStand(`${fremd.name}: Endung wird nicht angenommen (mp4, mov, webm, jpg, png, heic)`);
      return;
    }
    setStand(null);
    setDateien(gewaehlt);
    // **Bei einer Referenz direkt hochladen.** Vorher wartete das Feld auf einen
    // zweiten Klick auf „hoch". Am 2026-08-21 hat Alain zwei Slides gewaehlt,
    // das Feld sagte „2 Dateien", und dort blieb es stehen: wer Dateien
    // auswaehlt, hat in seinem Kopf hochgeladen, nicht vorbereitet.
    //
    // Bei einem Post nicht: dort gehoeren Notiz und Ergebnis zur selben Zeile
    // und werden erst beim Absenden gelesen. Losschicken, bevor sie getippt
    // sind, wuerde sie leer festschreiben. Deshalb bleibt dort der Knopf.
    if (art === "referenz") void hoch(gewaehlt);
  }

  /**
   * Die Liste kommt als Parameter, nicht aus dem State: `setDateien` wirkt erst
   * beim naechsten Rendern, und der Aufruf steht direkt dahinter.
   */
  async function hoch(liste?: File[]): Promise<void> {
    const zuTun = liste ?? dateien;
    if (!zuTun.length || laeuft) return;
    setLaeuft(true);
    setStand("bereite vor …");
    try {
      const vor = await uploadVorbereiten(scope, zuTun.map((d) => d.name), art);
      if (!vor.ok || !vor.ziele) {
        setStand(vor.fehler ?? "Vorbereiten fehlgeschlagen");
        return;
      }
      const pfade: string[] = [];
      for (let i = 0; i < zuTun.length; i++) {
        setStand(`lade ${i + 1} von ${zuTun.length} …`);
        const ziel = vor.ziele[i];
        const typ = inhaltsTyp(zuTun[i]);
        if (!typ) {
          setStand(`${zuTun[i].name}: Endung wird nicht angenommen`);
          return;
        }
        const res = await fetch(ziel.url, {
          method: "PUT",
          headers: { "Content-Type": typ },
          body: zuTun[i],
        });
        if (!res.ok) {
          // Der Bucket antwortet bei einem abgewiesenen Typ mit leerem Body.
          // Eine nackte Zahl hat Alain schon einmal einen Abend gekostet, also
          // steht hier notfalls die Vermutung statt gar nichts.
          const grund = await res.text().catch(() => "");
          setStand(
            `${zuTun[i].name}: Bucket antwortete ${res.status}` +
              (grund.trim()
                ? ` — ${grund.slice(0, 120)}`
                : res.status === 400
                  ? ` — Typ ${typ} abgewiesen`
                  : ""),
          );
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
          {laeuft
            ? "lädt …"
            : dateien.length === 0
              ? (knopf ?? "ziehen oder wählen, lädt sofort")
              : dateien.length === 1
                ? dateien[0].name.slice(0, 22)
                : `${dateien.length} Dateien`}
        </span>
      </label>

      {/* Kein Knopf mehr, der den Upload erst startet — das Auswaehlen tut es.
          Was hier steht, ist der Stand, und nur wenn etwas liegen geblieben ist
          eine Wiederholung. */}
      <div className="flex gap-1 mt-1 items-center flex-wrap">
        {stand ? (
          <span className={MONO} style={{ color: "var(--fg-3)" }} role="status">
            {stand}
          </span>
        ) : null}
        {dateien.length > 0 && !laeuft ? (
          <button
            type="button"
            onClick={() => hoch()}
            className={`${MONO} px-1.5 py-0.5 rounded-[3px] border border-line-strong`}
            style={{ color: "var(--fg-2)" }}
          >
            {art === "referenz" ? "nochmal" : "absenden"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
