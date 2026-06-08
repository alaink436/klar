import * as React from "react";
import { cn } from "@/lib/utils";

// Status badge using Tremor's official badge styling, verbatim from
// tremorlabs/tremor (src/components/Badge/Badge.tsx): rounded-md, inset ring,
// tinted fill per variant, no status dot. We keep Klar's existing `tone` prop as
// an alias onto Tremor's variants so all 7 call-sites keep working unchanged;
// new code can also pass `variant` directly. Klar's @custom-variant maps `dark:`
// onto [data-theme="dark"], so the dark styles below apply in the admin theme.

type Variant = "default" | "neutral" | "success" | "error" | "warning";
type Tone = "neutral" | "ok" | "info" | "warn" | "danger";

// Tremor badgeVariants (colors copied 1:1 from the upstream component).
const VARIANTS: Record<Variant, string> = {
  default: "bg-blue-50 text-blue-900 ring-blue-500/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30",
  neutral: "bg-gray-50 text-gray-900 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20",
  success: "bg-emerald-50 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  error: "bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20",
  warning: "bg-yellow-50 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20",
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
  void dot; // accepted for back-compat; Tremor badges intentionally have no dot
  const v: Variant = variant ?? (tone ? TONE_TO_VARIANT[tone] : "neutral");
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        VARIANTS[v],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
