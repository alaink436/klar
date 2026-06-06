"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

// shadcn-style Label on Radix, themed to the admin .login-label (mono caps).
export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "[font-family:var(--font-mono)] text-[10px] font-semibold tracking-[0.14em] uppercase text-fg-3 pl-0.5 select-none",
        className,
      )}
      {...props}
    />
  );
}
