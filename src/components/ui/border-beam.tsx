"use client";

import * as React from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

// Magic UI BorderBeam — a light travels along the element's border. Drop into
// any `position: relative; overflow: hidden` container (e.g. a Card). Colours
// default to the admin fg tokens so it reads in both light + dark admin themes.
export function BorderBeam({
  size = 60,
  duration = 8,
  delay = 0,
  colorFrom = "var(--fg-3)",
  colorTo = "var(--fg)",
  className,
}: {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent] [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]">
      <motion.div
        className={cn(
          "absolute aspect-square bg-gradient-to-l from-[var(--beam-from)] via-[var(--beam-to)] to-transparent",
          className,
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--beam-from": colorFrom,
            "--beam-to": colorTo,
          } as React.CSSProperties
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={
          {
            repeat: Infinity,
            ease: "linear",
            duration,
            delay: -delay,
          } as Transition
        }
      />
    </div>
  );
}
