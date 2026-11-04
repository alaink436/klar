"use client";

import { useEffect, useState, type RefObject } from "react";

// The hero's WebGL scenes only render while they are on screen.
export default function useOnScreen(ref: RefObject<Element | null>) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref]);
  return on;
}
