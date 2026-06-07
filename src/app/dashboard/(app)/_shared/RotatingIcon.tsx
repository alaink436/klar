"use client";

// App icon with a gentle continuous tilt (framer-motion, the codebase's
// animation lib) plus a livelier hover. Respects prefers-reduced-motion: the
// idle wobble is dropped, the hover lift stays. Used for the app badges so the
// dashboard feels a touch more alive without being distracting.

import { motion, useReducedMotion } from "framer-motion";

export function RotatingIcon({
  src,
  size = 22,
  radius = 6,
}: {
  src: string;
  size?: number;
  radius?: number;
}) {
  const reduce = useReducedMotion();
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <motion.img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: radius, display: "block" }}
      animate={reduce ? undefined : { rotate: [0, -5, 5, 0] }}
      transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
      whileHover={{ rotate: 12, scale: 1.1 }}
    />
  );
}
