"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

// shadcn-style DropdownMenu on Radix, themed to the admin tokens.
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[130] min-w-[190px] bg-surface border border-line-strong rounded-[var(--radius)] shadow-[var(--shadow-lg)] p-1.5 [font-family:var(--font-body)]",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { danger?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-[13px] cursor-pointer outline-none select-none transition-colors text-fg-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg [&_svg]:size-3.5",
        danger &&
          "text-danger data-[highlighted]:bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] data-[highlighted]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("h-px bg-line my-1.5 mx-0.5", className)} {...props} />;
}
