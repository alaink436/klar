"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// shadcn-style Tabs on Radix, themed to the admin .seg segmented control look.
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-surface-2 border border-line", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-[calc(var(--radius-sm)-2px)] cursor-pointer transition-colors [font-family:var(--font-mono)] text-[11px] font-semibold tracking-[0.08em] uppercase text-fg-3 hover:text-fg-2 focus-visible:outline-none disabled:opacity-50 data-[state=active]:bg-fg data-[state=active]:text-accent-fg [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("mt-6 focus-visible:outline-none", className)} {...props} />;
}
