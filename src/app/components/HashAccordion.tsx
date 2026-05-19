"use client";

import { useEffect } from "react";

/**
 * Links to a section like #consulting used to land on a *collapsed* <details>
 * accordion — the visitor still had to click "+" to see the form. This opens
 * the targeted accordion (incl. nested ids like #coaching, and cross-page
 * /#consulting) so every link to it actually reveals the content.
 */
export default function HashAccordion() {
  useEffect(() => {
    const resolve = (hash: string): Element | null => {
      if (!hash || hash.length < 2) return null;
      try {
        return document.querySelector(hash);
      } catch {
        return null;
      }
    };

    // Section ids (#consulting) wrap the <details>; nested ids (#coaching)
    // live inside it — cover both directions.
    const detailsFor = (el: Element) =>
      (el.closest("details") ||
        el.querySelector("details")) as HTMLDetailsElement | null;

    const openFromHash = () => {
      const el = resolve(window.location.hash);
      if (!el) return;
      const details = detailsFor(el);
      if (details && !details.open) details.open = true;
      // Double rAF: first frame applies the open, second frame has the
      // expanded layout, so we scroll to the real (post-reflow) position.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          el.scrollIntoView({ behavior: "smooth", block: "start" }),
        ),
      );
    };

    // Synchronously open before the browser scrolls — also covers re-clicking
    // a link whose hash already matches (no hashchange fires then).
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]');
      const href = a?.getAttribute("href");
      if (!href) return;
      const el = resolve(href.slice(href.indexOf("#")));
      const details = el ? detailsFor(el) : null;
      if (details && !details.open) details.open = true;
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
