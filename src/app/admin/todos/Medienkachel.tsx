"use client";

// Eine hochgeladene Datei anzeigen — Video, Bild oder Verweis.
//
// Eigene Datei, weil Referenz und gelaufener Post dieselbe Entscheidung
// treffen und sie zweimal zu schreiben hiesse, sie beim ersten Anpassen
// auseinanderlaufen zu lassen.
//
// Drei Fälle, und der dritte ist der, den man leicht vergisst:
//
//   video  spielt im <video>-Tag
//   bild   gehört in ein <img>. Ein JPEG in einem <video> bleibt schwarz, und
//          genau das war der Fehler, bis Alain am 2026-08-20 fragte, ob er auch
//          Fotos hochladen kann.
//   roh    HEIC vom iPhone. Kein Browser kann es dekodieren, also steht hier
//          ein Verweis zum Öffnen statt einer schwarzen Fläche — die Datei ist
//          da, sie lässt sich nur nicht in der Zeile ansehen.

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

export interface Medium {
  url: string;
  art: "video" | "bild" | "roh";
}

export default function Medienkachel({
  medium,
  alt,
  gedimmt,
}: {
  medium: Medium;
  alt: string;
  /** Geerbtes Material steht blasser da als eigenes. */
  gedimmt?: boolean;
}) {
  const rahmen = "w-full rounded-[4px] border border-line bg-black";
  const mass = {
    aspectRatio: "9 / 16",
    objectFit: "contain" as const,
    opacity: gedimmt ? 0.65 : 1,
  };

  if (medium.art === "video") {
    return <video src={medium.url} controls preload="metadata" playsInline className={rahmen} style={mass} />;
  }

  if (medium.art === "bild") {
    // Signierte Supabase-URL mit Ablauf; next/image würde sie zwischenspeichern
    // und nach einer Stunde ein totes Bild ausliefern.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={medium.url} alt={alt} className={rahmen} style={mass} />;
  }

  return (
    <a
      href={medium.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${MONO} w-full rounded-[4px] border border-line-strong flex items-center justify-center text-center px-1 underline decoration-dotted`}
      style={{ aspectRatio: "9 / 16", color: "var(--fg-3)" }}
    >
      HEIC — öffnen
    </a>
  );
}
