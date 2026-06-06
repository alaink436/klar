import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn-style Card, themed to the /admin tokens. Mirrors the admin .card look
// (surface bg, hairline border, soft shadow) but as composable parts.
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative overflow-hidden bg-surface border border-line rounded-[var(--radius)] shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("[font-family:var(--font-display)] font-bold text-[16px] tracking-[-0.01em] leading-tight text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("[font-family:var(--font-editorial)] italic text-sm leading-relaxed text-fg-3 max-w-[62ch]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center justify-end gap-2.5 p-6 pt-0", className)} {...props} />;
}
