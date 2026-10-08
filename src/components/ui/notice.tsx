import type { CSSProperties, ReactNode } from "react";
import { TextureCard } from "@/components/ui/texture-card";
import { cn } from "@/lib/utils";

// Hinweis ueber dem Seiteninhalt: gespeichert, fehlgeschlagen, Einrichtung
// fehlt. Seit dem Redesign (2026-10-08) eine Karte mit gedaempftem
// Status-Punkt statt der alten `.flash`-Box mit eingefaerbtem Rand und Text;
// Farbe steckt nur im Punkt.

const TON = {
  info: "var(--fg-3)",
  ok: "var(--success)",
  warn: "var(--warning)",
  danger: "var(--danger)",
} as const;

export function Notice({
  tone = "info",
  className,
  children,
}: {
  tone?: keyof typeof TON;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TextureCard className={cn("mb-6 flex items-start gap-3 px-5 py-3.5 text-[13.5px] leading-relaxed text-fg-2", className)}>
      <span aria-hidden="true" className="klar-punkt mt-2" style={{ "--ton": TON[tone] } as CSSProperties} />
      <div className="min-w-0">{children}</div>
    </TextureCard>
  );
}
