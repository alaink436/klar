"use client";

import { useEffect, useRef } from "react";

// Opens the <details> it sits in when the address ends in `hash`: on load, and
// on a click on a link to it (Next's <Link> jumps on the same page without a
// hashchange event).
export default function OpenOnHash({ hash }: { hash: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const open = () => {
      const details = ref.current?.closest("details");
      if (details) details.open = true;
    };
    if (location.hash === hash) open();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a");
      if (a && a.hash === hash && a.pathname === location.pathname) open();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [hash]);
  return <span ref={ref} hidden />;
}
