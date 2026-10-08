import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// shadcn-style Button, themed to the /admin tokens (admin/admin.css).
// Since the 2026-10-08 redesign the two pills: `pill` (white, the main
// action) and `pill-dark` (dark with an edge, everything else). Their look
// lives in admin/admin.css (`.klar-pille-*`). `ghost` (the rail toggle) and
// `danger` (confirm a delete) are what is left of the old .btn family; its
// unused members (default, pop, outline, subtle) went with ticket 06.
type Variant = "ghost" | "danger" | "pill" | "pill-dark";
type Size = "default" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  ghost: "bg-surface text-fg-2 border border-line-strong hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white border border-danger hover:opacity-90",
  pill: "klar-pille klar-pille-hell rounded-full font-medium",
  "pill-dark": "klar-pille klar-pille-dunkel rounded-full font-medium",
};
const SIZES: Record<Size, string> = {
  default: "h-9 px-4 text-[13px] gap-2",
  sm: "h-8 px-3 text-xs gap-1.5",
  icon: "h-8 w-8 p-0 justify-center",
};

export function Button({
  className,
  variant = "pill-dark",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] font-semibold cursor-pointer [font-family:var(--font-body)] transition-[opacity,transform,background,box-shadow,color,border-color] duration-150 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)] disabled:opacity-50 disabled:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
