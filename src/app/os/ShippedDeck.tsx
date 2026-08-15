"use client";

import { useEffect, useState } from "react";
import { PUBLIC_APPS, type KlarAppMeta } from "@/lib/klarApps";

// The apps this system was built while shipping, as a deck that deals itself.
// Cards sit in depth: the one in front is full size, the ones behind are
// smaller and dimmer but still show their icon, and every few seconds the
// whole stack steps forward. The card that was in front comes at you and
// fades, the way a flashcard leaves the pile.
//
// LIVE only, read from lib/klarApps — the same source the rest of the site
// uses. Nothing here needs touching when Basalt ships: it appears on its own.
const LIVE: KlarAppMeta[] = PUBLIC_APPS.filter((a) => a.status === "LIVE");

const HOLD_MS = 2600;
const VISIBLE = 4; // the front card plus three readable behind it

type Slot = {
  transform: string;
  opacity: number;
  zIndex: number;
  transition: string;
};

const EASE = "transform 760ms cubic-bezier(0.22, 1, 0.36, 1), opacity 760ms ease";

function slotFor(depth: number, count: number, still: boolean): Slot {
  // Frozen (reduced motion, or a single app): fan the stack out and leave it.
  if (still) {
    return {
      transform: `translate3d(0, ${-depth * 14}px, 0) scale(${1 - depth * 0.09})`,
      opacity: depth < VISIBLE ? 1 - depth * 0.2 : 0,
      zIndex: count - depth,
      transition: "none",
    };
  }

  // The card that just left the front: it keeps travelling towards the viewer
  // and dissolves. Same DOM node as the old front card, so the browser
  // animates it out of the stack instead of teleporting it to the back.
  if (depth === count - 1) {
    return {
      transform: "translate3d(0, 46px, 0) scale(1.22)",
      opacity: 0,
      zIndex: count + 10,
      transition: EASE,
    };
  }

  // Parked at the back of the deck with no transition, so re-entering cards
  // do not visibly slide backwards through the stack while invisible.
  if (depth >= VISIBLE) {
    return {
      transform: `translate3d(0, ${-(VISIBLE - 1) * 14}px, 0) scale(${1 - (VISIBLE - 1) * 0.09})`,
      opacity: 0,
      zIndex: 0,
      transition: "none",
    };
  }

  return {
    transform: `translate3d(0, ${-depth * 14}px, 0) scale(${1 - depth * 0.09})`,
    opacity: 1 - depth * 0.2,
    zIndex: count - depth,
    transition: EASE,
  };
}

export default function ShippedDeck() {
  const count = LIVE.length;
  const [front, setFront] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(true); // no motion until the client says otherwise

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches || count < 2);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [count]);

  useEffect(() => {
    if (still || paused) return;
    const t = setInterval(() => setFront((f) => (f + 1) % count), HOLD_MS);
    return () => clearInterval(t);
  }, [still, paused, count]);

  if (count === 0) return null;

  return (
    <div
      className="deck"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ul className="deck-stack">
        {LIVE.map((app, i) => {
          const depth = (i - front + count) % count;
          const slot = slotFor(depth, count, still);
          const isFront = depth === 0;
          return (
            <li
              key={app.slug}
              className={`deck-card${isFront ? " is-front" : ""}`}
              style={{
                transform: slot.transform,
                opacity: slot.opacity,
                zIndex: slot.zIndex,
                transition: slot.transition,
              }}
              // Only the card you can actually read is in the tab order and
              // announced; the ones behind it are decoration until their turn.
              aria-hidden={!isFront}
            >
              <img src={app.icon} alt="" width="44" height="44" />
              <span className="deck-name">{app.name}</span>
              <a
                className="deck-link"
                href={app.appStoreUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={isFront ? 0 : -1}
              >
                App&nbsp;Store <i aria-hidden="true">↗</i>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="deck-cap">
        <b>{count}</b> live in the App Store
      </p>
    </div>
  );
}
