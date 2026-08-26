"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// shadcn-style Dialog on Radix, themed to the admin tokens (frosted overlay +
// surface card). Portal-rendered, so colours resolve via the bridged tokens.
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-[131] bg-[rgba(6,6,8,0.5)] backdrop-blur-md", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * 2026-08-26 ergaenzt. Diese Fassung hat nie ein X in der Ecke gehabt, ihre
   * Dialoge schliessen ueber ihre eigenen Knoepfe. Neuere Registry-Komponenten
   * (CommandDialog) reichen das Prop aber durch, und ohne die Signatur bricht
   * `tsc` in fremdem Code. Der Standard ist `false`, damit kein bestehender
   * Dialog ploetzlich ein Kreuz bekommt; wer eins will, sagt es ausdruecklich.
   */
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-[132] w-[min(560px,94vw)] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 bg-surface border border-line-strong rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] p-7 [font-family:var(--font-body)] focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 text-fg-4 transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Schliessen"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("[font-family:var(--font-display)] font-bold text-xl tracking-[-0.015em] text-fg", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-[13.5px] leading-relaxed text-fg-3", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex justify-end gap-2.5 mt-5", className)} {...props} />;
}
