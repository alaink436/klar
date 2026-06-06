import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

// shadcn-style Button, themed to the /admin tokens (see globals.css bridge).
// Variants mirror the existing admin .btn family: default (solid fg), pop
// (RetroUI tactile offset-shadow CTA), ghost/outline/subtle, danger.
type Variant = "default" | "pop" | "ghost" | "outline" | "subtle" | "danger";
type Size = "default" | "sm" | "icon";

const VARIANTS: Record<Variant, string> = {
  default: "bg-fg text-accent-fg border border-fg hover:opacity-90",
  pop: "bg-fg text-accent-fg border-[1.5px] border-fg shadow-[3px_3px_0_0_var(--fg)] hover:shadow-[4px_4px_0_0_var(--fg)] hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  ghost: "bg-surface text-fg-2 border border-line-strong hover:bg-surface-2 hover:text-fg",
  outline: "bg-transparent text-fg-2 border border-line-strong hover:bg-surface-2 hover:text-fg",
  subtle: "bg-surface-2 text-fg-2 border border-line hover:bg-surface-3 hover:text-fg",
  danger: "bg-danger text-white border border-danger hover:opacity-90",
};
const SIZES: Record<Size, string> = {
  default: "h-9 px-4 text-[13px] gap-2",
  sm: "h-8 px-3 text-xs gap-1.5",
  icon: "h-8 w-8 p-0 justify-center",
};

export function Button({
  className,
  variant = "default",
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
