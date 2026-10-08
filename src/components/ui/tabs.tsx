"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

// shadcn-style Tabs on Radix, themed to the admin tokens. Since the 2026-10-08
// redesign a dark pill holding the tabs, the active one a white pill.
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("klar-pille-dunkel inline-flex items-center gap-1 rounded-full p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full px-4 cursor-pointer transition-colors text-[13px] font-medium text-fg-3 data-[state=inactive]:hover:text-fg focus-visible:outline-none disabled:opacity-50 data-[state=active]:bg-[linear-gradient(180deg,#ffffff,#dedede)] data-[state=active]:text-[#0a0a0a] data-[state=active]:shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.7)] [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("mt-6 focus-visible:outline-none", className)} {...props} />;
}
