import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn-style Badge, themed to the admin .tbadge tones (calm tinted pill with
// an optional leading status dot). Tones: neutral / ok / info / warn / danger.
type Tone = "neutral" | "ok" | "info" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "text-fg-3 bg-surface-2 border-line",
  ok: "text-success bg-[color-mix(in_oklab,var(--success)_12%,transparent)] border-[color-mix(in_oklab,var(--success)_26%,transparent)]",
  info: "text-info bg-[color-mix(in_oklab,var(--info)_12%,transparent)] border-[color-mix(in_oklab,var(--info)_26%,transparent)]",
  warn: "text-warning bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] border-[color-mix(in_oklab,var(--warning)_28%,transparent)]",
  danger: "text-danger bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] border-[color-mix(in_oklab,var(--danger)_26%,transparent)]",
};

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1.5 [font-family:var(--font-mono)] text-[10px] font-semibold tracking-[0.06em] uppercase leading-normal whitespace-nowrap px-2.5 py-1 rounded-full border",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  );
}
