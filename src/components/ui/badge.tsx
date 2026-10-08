import * as React from "react";
import { cn } from "@/lib/utils";

// Marke: kleine Pille mit Status-Punkt oder Symbol (Redesign 2026-10-08).
// Bis dahin standen hier die Tremor-Badge-Farben (getoenter Grund je Ton).
// Jetzt ist die Pille monochrom und die Bedeutung steckt nur im Punkt, in den
// gedaempften Status-Farben aus admin/admin.css. Aussehen: `.klar-marke`.
//
// `tone` und `variant` bleiben als Namen, damit die Aufrufer unveraendert
// laufen. Neutral zeigt keinen Punkt, ausser `dot` verlangt ihn; ein Symbol
// kommt einfach als Kind mit.

type Variant = "default" | "neutral" | "success" | "error" | "warning";
type Tone = "neutral" | "ok" | "info" | "warn" | "danger";

const PUNKT: Record<Variant, string | null> = {
  default: "var(--info)",
  neutral: null,
  success: "var(--success)",
  error: "var(--danger)",
  warning: "var(--warning)",
};

const TONE_TO_VARIANT: Record<Tone, Variant> = {
  neutral: "neutral",
  ok: "success",
  info: "default",
  warn: "warning",
  danger: "error",
};

export function Badge({
  className,
  variant,
  tone,
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant; tone?: Tone; dot?: boolean }) {
  const v: Variant = variant ?? (tone ? TONE_TO_VARIANT[tone] : "neutral");
  const ton = PUNKT[v];
  return (
    <span data-slot="badge" className={cn("klar-marke", className)} {...props}>
      {ton || dot ? (
        <span aria-hidden="true" className="klar-punkt" style={ton ? ({ "--ton": ton } as React.CSSProperties) : undefined} />
      ) : null}
      {children}
    </span>
  );
}
