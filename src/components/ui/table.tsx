import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn-style Table primitives, themed to the admin tokens. Utility classes
// override the global element styles (table/th/td) defined in _shared.ts STYLE.
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn(
          "w-full border-separate border-spacing-0 text-[13.5px] bg-surface border border-line rounded-[var(--radius)] overflow-hidden",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("transition-colors [&:hover>td]:bg-surface-2", className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-left bg-surface-2 border-b border-line px-3.5 py-3 [font-family:var(--font-mono)] text-[9.5px] font-semibold tracking-[0.14em] uppercase text-fg-3",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3.5 py-3 border-b border-line text-fg align-top [font-variant-numeric:tabular-nums] [tr:last-child>&]:border-b-0", className)}
      {...props}
    />
  );
}
