import * as React from "react";
import { cn } from "@/lib/utils";

// Switch backed by a native checkbox so it still submits inside a plain
// <form method="POST"> (no client state needed). The track + thumb react to the
// peer checkbox state. Wrap it in a <label> with the descriptive text so the
// whole row toggles. Themed to the admin tokens via arbitrary CSS-var values.
// Since the 2026-10-08 redesign: off is a grey thumb on a dark track, on a
// dark thumb on the white track.
export function Switch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span className="h-5 w-9 rounded-full bg-[var(--line-strong)] transition-colors duration-200 peer-checked:bg-[var(--brand)] peer-focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_18%,transparent)]" />
      <span className="pointer-events-none absolute left-0.5 size-4 rounded-full bg-[var(--fg-3)] shadow transition-[transform,background-color] duration-200 peer-checked:translate-x-4 peer-checked:bg-[var(--brand-fg)]" />
    </span>
  );
}
