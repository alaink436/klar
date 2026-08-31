// Seitenkopf: Augenbraue, grosser Titel, optionale Beschreibung.
//
// Bis 2026-08-31 sass das in einer eigenen Karte mit Rahmen und Schatten, und
// die Beschreibung lief in kursiven Serifen. Beides ist weg: ein Titel braucht
// keinen Rahmen, um ein Titel zu sein, und die Redaktionsstimme erklaerte
// jemandem etwas, der die Seite selbst gebaut hat.

import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7">
      {eyebrow ? (
        <div className="mb-2 [font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.24em] text-fg-4">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="m-0 [font-family:var(--font-display)] text-[clamp(36px,5vw,58px)] font-normal leading-[0.92] tracking-[0.015em] text-fg">
        {title}
      </h1>
      {children ? (
        <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-fg-3">
          {children}
        </p>
      ) : null}
    </div>
  );
}
