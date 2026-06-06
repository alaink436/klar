"use client";

import * as React from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

// Magic UI NumberTicker — springs from 0 to `value` when scrolled into view.
// Used for the Vault key count / Brain note count etc. de-CH grouping.
export function NumberTicker({
  value,
  decimalPlaces = 0,
  className,
}: {
  value: number;
  decimalPlaces?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: "0px" });

  React.useEffect(() => {
    if (inView) motionValue.set(value);
  }, [motionValue, inView, value]);

  React.useEffect(() => {
    const fmt = new Intl.NumberFormat("de-CH", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
    const unsub = spring.on("change", (latest) => {
      if (ref.current) ref.current.textContent = fmt.format(Number(latest.toFixed(decimalPlaces)));
    });
    return () => unsub();
  }, [spring, decimalPlaces]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
