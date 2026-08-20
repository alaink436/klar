"use client";

// Dateifeld, in das man Dateien auch hineinziehen kann.
//
// Ein `<input type="file">` allein nimmt keine gezogenen Dateien an — der
// Browser oeffnet sie stattdessen im Tab und die halb ausgefuellte Seite ist
// weg. Diese Huelle faengt das ab und legt die gezogenen Dateien in dasselbe
// Feld, das der Dateidialog auch fuellt. Damit bleibt das Formular ein
// gewoehnliches `multipart/form-data` an eine Route: es funktioniert weiter
// ohne JavaScript, und 200 MB passen durch.
//
// `multiple`, weil eine Slideshow zwei bis zehn Bilder ist. Die Reihenfolge der
// Auswahl ist die Reihenfolge der Slides.

import { useRef, useState } from "react";

const MONO = "[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.08em]";

export default function FileDrop({
  name,
  accept,
  ariaLabel,
  klein,
}: {
  name: string;
  accept: string;
  ariaLabel: string;
  /** In der Kanalzeile eng, in der App-Leiste etwas luftiger. */
  klein?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [ueber, setUeber] = useState(false);
  const [namen, setNamen] = useState<string[]>([]);

  function uebernehmen(liste: FileList | null): void {
    if (!liste || !liste.length) return;
    // `input.files` laesst sich nur mit einem DataTransfer setzen, nicht mit
    // einem Array — das ist der einzige Weg, gezogene Dateien so abzulegen,
    // dass sie beim Absenden mitgehen.
    const dt = new DataTransfer();
    for (const f of Array.from(liste)) dt.items.add(f);
    if (ref.current) ref.current.files = dt.files;
    setNamen(Array.from(liste).map((f) => f.name));
  }

  return (
    <div
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
      onClick={() => ref.current?.click()}
      className={`rounded-[4px] border border-dashed cursor-pointer text-center ${
        klein ? "px-1 py-1.5" : "px-2 py-2.5"
      }`}
      style={{
        borderColor: ueber ? "var(--fg)" : "var(--line-strong)",
        background: ueber ? "var(--surface)" : "transparent",
      }}
    >
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        multiple
        aria-label={ariaLabel}
        onChange={(e) => setNamen(Array.from(e.target.files ?? []).map((f) => f.name))}
        className="hidden"
      />
      <div className={MONO} style={{ color: ueber ? "var(--fg-2)" : "var(--fg-4)" }}>
        {namen.length === 0
          ? "ziehen oder wählen"
          : namen.length === 1
            ? namen[0].slice(0, 22)
            : `${namen.length} Dateien`}
      </div>
    </div>
  );
}
