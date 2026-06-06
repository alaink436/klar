import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn-style Input, themed to the admin .login-input look.
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "w-full px-3.5 py-3 text-sm [font-family:var(--font-body)] text-fg bg-bg border border-line-strong rounded-[var(--radius-sm)] transition-[border-color,box-shadow,background] placeholder:text-fg-4 focus:border-fg focus:bg-surface focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_12%,transparent)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
