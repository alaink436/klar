"use client";
// How-it-works: the counter's invisible features, animated inside real device
// frames (@sneas/telephone — the same frame the Trubel ads use; it draws its
// own status bar, children land on the screen).
//
// These are NOT screen recordings on purpose. A recording ages with every iOS
// redesign, weighs megabytes and can't be translated; a rebuilt UI in HTML is
// a couple of kilobytes, loops forever, and lies less than it looks — every
// element shown here exists in the shipping app.
//
// The demos run on a shared 4-second heartbeat (one interval, not three) so
// the page never has competing timers, and they pause when scrolled out of
// view via IntersectionObserver — three infinite animations off-screen is
// how a marketing page becomes a hand-warmer.

import { useEffect, useRef, useState } from "react";

const INK = "#1E1A17";
const PAPER = "#FAF6F0";
const LINE = "#EBE0CE";
const MUTE = "#756B62";
const ROSE = "#B84A5C";
const ROSE_SOFT = "#F2DCD8";

/** One shared beat: 0 → 1 → 2 → 3, one step a second, wraps at 4. */
function useHeartbeat(active: boolean) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!active) return;
    const h = setInterval(() => setBeat((b) => (b + 1) % 4), 1000);
    return () => clearInterval(h);
  }, [active]);
  return beat;
}

export default function HowItWorks() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  // The frame package declares `class extends HTMLElement` at module scope,
  // which detonates during SSR (no HTMLElement on the server, "Class extends
  // value false"). Client components still server-render in Next, so the
  // import has to happen at runtime, in the browser, not at module top.
  useEffect(() => {
    import("@sneas/telephone");
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const beat = useHeartbeat(inView);
  // The demo count climbs with the beat and resets with it: 47, 48, 49, 50.
  const count = 47 + beat;

  return (
    <div ref={rootRef} style={{ marginBottom: 56 }}>
      <h2
        style={{
          fontFamily: "var(--ys-display), serif",
          fontSize: 28,
          marginBottom: 8,
        }}
      >
        Counting, even when the app is closed
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: MUTE, maxWidth: 560, marginBottom: 28 }}>
        Four ways to a row: tap the screen, tap the widget, double-tap the back
        of your iPhone, or press the Action Button. And while you knit, the
        count waits on your Lock Screen.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 24,
        }}
      >
        <Demo caption="The widget counts with the app closed">
          <iphone-16-max mode="light">
            <WidgetDemo count={count} pressed={beat % 2 === 1} />
          </iphone-16-max>
        </Demo>

        <Demo caption="Lock your phone, the count stays with you">
          <iphone-16-max mode="dark">
            <LockScreenDemo count={count} />
          </iphone-16-max>
        </Demo>

        <Demo caption="Double-tap the back, mid-episode">
          <iphone-16-max mode="dark">
            <BackTapDemo count={count} tapping={beat === 1 || beat === 2} />
          </iphone-16-max>
        </Demo>
      </div>
    </div>
  );
}

function Demo({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ maxWidth: 260, margin: "0 auto" }}>{children}</div>
      <figcaption
        style={{
          fontFamily: "var(--ys-editorial), serif",
          fontStyle: "italic",
          fontSize: 14,
          color: MUTE,
          textAlign: "center",
          marginTop: 12,
        }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

/** Home screen with the real widget hierarchy: script name, hero count, rose +1. */
function WidgetDemo({ count, pressed }: { count: number; pressed: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(160deg, ${PAPER}, ${LINE})`,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "22%",
      }}
    >
      <div
        style={{
          width: "58%",
          aspectRatio: "1",
          borderRadius: 24,
          background: "#FFFFFF",
          boxShadow: "0 12px 30px rgba(30,26,23,0.16)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10% 8%",
        }}
      >
        <div style={{ fontFamily: "cursive", fontSize: 15, color: ROSE }}>Socken</div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: INK,
            fontVariantNumeric: "tabular-nums",
            transition: "transform 200ms",
            transform: pressed ? "scale(1.12)" : "scale(1)",
          }}
        >
          {count}
        </div>
        <div style={{ fontSize: 10, color: MUTE }}>🧶 Reihen</div>
        <div
          style={{
            background: pressed ? "#9c3c4d" : ROSE,
            color: "#fff",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 16px",
            transition: "transform 150ms, background 150ms",
            transform: pressed ? "scale(0.93)" : "scale(1)",
          }}
        >
          +1 Reihen
        </div>
      </div>
    </div>
  );
}

/** Lock screen: clock above, the Live Activity banner as it really renders. */
function LockScreenDemo({ count }: { count: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(170deg, #17130f, #241c16 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "18%",
        gap: 18,
      }}
    >
      <div style={{ color: "#F2ECE3", fontSize: 13, opacity: 0.75 }}>Donnerstag, 14. August</div>
      <div style={{ color: "#F2ECE3", fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>21:47</div>
      <div
        style={{
          width: "84%",
          borderRadius: 20,
          background: "rgba(30,25,22,0.82)",
          border: "1px solid rgba(242,236,227,0.12)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "cursive", fontSize: 15, color: "#E89AA5" }}>Socken</div>
          <div style={{ fontSize: 10, color: "#A29A91" }}>🧶 Reihen</div>
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "#F2ECE3",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </div>
      </div>
    </div>
  );
}

/** A series playing, two ripples on the frame edge, the confirmation banner. */
function BackTapDemo({ count, tapping }: { count: number; tapping: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* The episode: abstract glow, no borrowed branding. */}
      <div
        style={{
          position: "absolute",
          inset: "30% 0",
          background: "linear-gradient(120deg, #2a1a3a, #0d3b4f, #3a1a22)",
          backgroundSize: "300% 100%",
          animation: "ys-pan 8s linear infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "44%",
          top: "46%",
          width: 0,
          height: 0,
          borderTop: "12px solid transparent",
          borderBottom: "12px solid transparent",
          borderLeft: "20px solid rgba(255,255,255,0.85)",
        }}
      />
      {/* The double tap, visualised as ripples at the frame's edge. */}
      {tapping && (
        <>
          <span style={rippleStyle(0)} />
          <span style={rippleStyle(300)} />
        </>
      )}
      {/* The confirmation banner the intent really shows. */}
      <div
        style={{
          position: "absolute",
          top: tapping ? "6%" : "-20%",
          left: "8%",
          right: "8%",
          transition: "top 350ms ease-out",
          borderRadius: 16,
          background: "rgba(250,246,240,0.96)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>🧶</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{`Reihen ${count}`}</span>
        <span style={{ fontSize: 11, color: MUTE, marginLeft: "auto" }}>My Yarn Stash</span>
      </div>
      <style>{`@keyframes ys-pan { from { background-position: 0% 0; } to { background-position: 100% 0; } }
@keyframes ys-ripple { from { transform: scale(0.4); opacity: 0.9; } to { transform: scale(1.8); opacity: 0; } }`}</style>
    </div>
  );
}

function rippleStyle(delayMs: number): React.CSSProperties {
  return {
    position: "absolute",
    right: "10%",
    bottom: "28%",
    width: 46,
    height: 46,
    borderRadius: "50%",
    border: `3px solid ${ROSE_SOFT}`,
    animation: `ys-ripple 700ms ease-out ${delayMs}ms both`,
    pointerEvents: "none",
  };
}
