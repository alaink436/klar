import * as React from "react"

import { cn } from "@/lib/utils"

// Texture Card aus cult-ui (cult-ui.com, geholt 2026-10-08 per shadcn-CLI),
// angepasst an Klar. Das Prinzip bleibt: eine mehrlagige Kante, aussen dunkel,
// innen hell und nach unten auslaufend, dazu ein Hauch Glanz oben. Statt fuenf
// verschachtelter div mit je eigener Randfarbe macht das jetzt die Klasse
// `.klar-karte` in admin/admin.css (Schatten aussen, Maskenrand innen), also
// ein Element; Werte und Hover stehen dort. Die Teile darunter stehen in
// Klar-Schrift und -Tokens statt in Tailwind-Grau. `TextureCardStyled` ist
// weggelassen, Klar braucht nur eine Karte.

const TextureCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div ref={ref} data-slot="texture-card" className={cn("klar-karte", className)} {...props}>
    {children}
  </div>
))
TextureCard.displayName = "TextureCard"

const TextureCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pb-4 pt-5", className)}
    {...props}
  />
))
TextureCardHeader.displayName = "TextureCardHeader"

const TextureCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("m-0 text-[15px] font-medium leading-tight tracking-[-0.01em] text-fg", className)}
    {...props}
  />
))
TextureCardTitle.displayName = "TextureCardTitle"

const TextureCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("m-0 text-[13px] leading-relaxed text-fg-3", className)} {...props} />
))
TextureCardDescription.displayName = "TextureCardDescription"

const TextureCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
))
TextureCardContent.displayName = "TextureCardContent"

const TextureCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-between gap-2 px-6 py-4", className)} {...props} />
))
TextureCardFooter.displayName = "TextureCardFooter"

/** Doppelte Linie im selben Prinzip wie die Kante: dunkel oben, hell darunter. */
const TextureSeparator = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn("klar-trenner", className)} />
)

export {
  TextureCard,
  TextureCardHeader,
  TextureCardFooter,
  TextureCardTitle,
  TextureSeparator,
  TextureCardDescription,
  TextureCardContent,
}

export default TextureCard
