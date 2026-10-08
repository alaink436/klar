import * as React from "react";
import { cn } from "@/lib/utils";

// Marke: kleine Pille mit Status-Punkt oder Symbol (Redesign 2026-10-08).
// Bis dahin standen hier die Tremor-Badge-Farben (getoenter Grund je Ton).
// Jetzt ist die Pille monochrom und die Bedeutung steckt nur im Punkt, in den
// gedaempften Status-Farben aus admin/admin.css. Aussehen: `.klar-marke`.
//
// Die Farbe waehlt `tone`. Die Tremor-Namen (`variant`: default, success,
// error, warning) sind mit Ticket 06 weg. Neutral zeigt keinen Punkt, ausser
// `dot` verlangt ihn; ein Symbol kommt einfach als Kind mit.

type Tone = "neutral" | "ok" | "info" | "warn" | "danger";

const PUNKT: Record<Tone, string | null> = {
  neutral: null,
  ok: "var(--success)",
  info: "var(--info)",
  warn: "var(--warning)",
  danger: "var(--danger)",
};

export function Badge({
  className,
  tone = "neutral",
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone; dot?: boolean }) {
  const ton = PUNKT[tone];
  return (
    <span data-slot="badge" className={cn("klar-marke", className)} {...props}>
      {ton || dot ? (
        <span aria-hidden="true" className="klar-punkt" style={ton ? ({ "--ton": ton } as React.CSSProperties) : undefined} />
      ) : null}
      {children}
    </span>
  );
}
