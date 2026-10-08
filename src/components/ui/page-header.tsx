// Seitenkopf: Marke als Augenbraue, grosser Titel, optionale Beschreibung.
//
// Bis 2026-08-31 sass das in einer eigenen Karte mit Rahmen und Schatten, und
// die Beschreibung lief in kursiven Serifen. Beides ist weg: ein Titel braucht
// keinen Rahmen, um ein Titel zu sein, und die Redaktionsstimme erklaerte
// jemandem etwas, der die Seite selbst gebaut hat.
//
// Seit dem Redesign (2026-10-08) ist die Augenbraue eine Pille mit Symbol und
// der Titel ein h1, der seinen Verlauf von Weiss nach Grau aus admin.css hat.

import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  icon,
  title,
  children,
}: {
  eyebrow?: string;
  /** Symbol im hellen Kreis vorne in der Augenbraue. */
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <div className="klar-marke mb-4 pl-[3px]">
          <span
            aria-hidden="true"
            className="flex size-4 items-center justify-center rounded-full bg-[linear-gradient(180deg,#fff,#cfcfcf)] text-[#0a0a0a] [&_svg]:size-2.5"
          >
            {icon}
          </span>
          {eyebrow}
        </div>
      ) : null}
      <h1 className="m-0">{title}</h1>
      {children ? (
        <p className="mt-3 max-w-[64ch] text-[13.5px] leading-relaxed text-fg-3">
          {children}
        </p>
      ) : null}
    </div>
  );
}
