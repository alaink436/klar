"use client";

// The click wheel, in the browser. A cut-down twin of podify's
// src/pod/wheel.tsx: one pointer surface, finger travel around the centre
// becomes ticks (18° each, seam-safe), a still finger lifting is a press
// resolved by where it landed. The display beside it is the app's main menu
// and the Extras list, nothing more; there is no music behind it.

import { useCallback, useRef, useState } from "react";

const SIZE = 280;
const HALF = SIZE / 2;
const CENTRE = 96;
const TICK_DEGREES = 18;
const DEAD_RING = 6;
const G = 22 / 24; // glyphs are 22 px, drawn on a 24-unit grid

const INK = "#FFFFFF";
const MUTED = "#8E8E97";
const FAINT = "#7C7C84";
const EDGE = "#2A2A30";
const GLASS = "rgba(255,255,255,0.07)";
const GLASS_EDGE = "rgba(255,255,255,0.12)";
/** The play triangle: the icon's path. */
const TRIANGLE = "M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5z";

/** previous / next / play-pause on the 24-unit grid, the bars as subpaths. */
const GLYPHS = [
  { x: 22, y: HALF - 11, d: "M19 20L9 12l10-8v16zM4 4h3v16H4z" },
  { x: SIZE - 44, y: HALF - 11, d: "M5 4l10 8-10 8V4zM17 4h3v16h-3z" },
  { x: HALF - 11, y: SIZE - 42, d: "M4 5l9 7-9 7V5zM15 5h2.6v14H15zM19.4 5H22v14h-2.6z" },
];

const MAIN = ["Now Playing", "Tunes", "Playlists", "Search", "Photos", "Videos", "Extras", "Settings"];
const EXTRAS = ["Weather", "Clock", "Calendar", "Contacts", "Maps", "Notes", "Calculator", "Games"];

type Zone = "select" | "menu" | "previous" | "next" | "play";

function zoneAt(x: number, y: number): Zone | null {
  const dx = x - HALF;
  const dy = y - HALF;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r <= CENTRE / 2) return "select";
  if (r > HALF - DEAD_RING) return null;
  const a = Math.atan2(dy, dx);
  if (a >= -0.75 * Math.PI && a < -0.25 * Math.PI) return "menu";
  if (a >= -0.25 * Math.PI && a < 0.25 * Math.PI) return "next";
  if (a >= 0.25 * Math.PI && a < 0.75 * Math.PI) return "play";
  return "previous";
}

export default function Wheel() {
  const [screen, setScreen] = useState<"main" | "extras">("main");
  const [cursor, setCursor] = useState({ main: 0, extras: 0 });
  const [playing, setPlaying] = useState(false);

  const rows = screen === "main" ? MAIN : EXTRAS;
  const at = cursor[screen];

  const move = useCallback(
    (dir: 1 | -1) => {
      setCursor((c) => {
        const n = (screen === "main" ? MAIN : EXTRAS).length;
        return { ...c, [screen]: Math.min(n - 1, Math.max(0, c[screen] + dir)) };
      });
    },
    [screen],
  );

  const press = useCallback(
    (zone: Zone) => {
      if (zone === "menu") setScreen("main");
      else if (zone === "select" && screen === "main" && MAIN[at] === "Extras") setScreen("extras");
      else if (zone === "play") setPlaying((p) => !p);
      else if (zone === "next") move(1);
      else if (zone === "previous") move(-1);
    },
    [screen, at, move],
  );

  // Pointer state lives in refs: nothing here needs a re-render mid-drag.
  const drag = useRef({ angle: 0, carry: 0, travel: 0, x: 0, y: 0 });

  const local = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = local(e);
    drag.current = { angle: Math.atan2(y - HALF, x - HALF), carry: 0, travel: 0, x, y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const { x, y } = local(e);
    const d = drag.current;
    d.travel = Math.max(d.travel, Math.hypot(x - d.x, y - d.y));
    const angle = Math.atan2(y - HALF, x - HALF);
    let delta = angle - d.angle;
    // Cross the ±π seam without a spurious full turn.
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    d.angle = angle;
    d.carry += (delta * 180) / Math.PI;
    while (d.carry >= TICK_DEGREES) {
      d.carry -= TICK_DEGREES;
      move(1);
    }
    while (d.carry <= -TICK_DEGREES) {
      d.carry += TICK_DEGREES;
      move(-1);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const { x, y } = local(e);
    if (drag.current.travel < 8) {
      const zone = zoneAt(x, y);
      if (zone) press(zone);
    }
  };

  const KEYS: Record<string, () => void> = {
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    ArrowRight: () => press("next"),
    ArrowLeft: () => press("previous"),
    Enter: () => press("select"),
    " ": () => press("play"),
    Escape: () => press("menu"),
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const fn = KEYS[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  };

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-8 sm:gap-10">
      {/* Display: the frosted card with the old status line on top. */}
      <div aria-live="polite" style={card}>
        <div style={status}>
          <span>{screen === "main" ? "MENU" : "EXTRAS"}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ opacity: playing ? 1 : 0 }}>
            <path d={TRIANGLE} fill={INK} />
          </svg>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((title, i) => {
            const on = i === at;
            return (
              <li key={title} aria-current={on ? "true" : undefined} style={{ ...row, background: on ? INK : "transparent", color: on ? "#000000" : INK }}>
                <span>{title}</span>
                <span style={{ fontSize: 20, color: on ? "#000000" : FAINT, marginTop: -2 }}>›</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Wheel */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="click wheel"
        aria-valuenow={at}
        aria-valuemin={0}
        aria-valuemax={rows.length - 1}
        aria-valuetext={rows[at]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={disc}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: "block" }}>
          <defs>
            <radialGradient id="pw-disc" cx="50%" cy="38%" r="70%">
              <Stops list={[["0", "#2C2C31", 1], ["0.55", "#141416", 1], ["1", "#050506", 1]]} />
            </radialGradient>
            <linearGradient id="pw-rim" x1="0" y1="0" x2="0" y2="1">
              <Stops list={[["0", "#FFFFFF", 0.22], ["0.5", "#FFFFFF", 0], ["1", "#000000", 0.55]]} />
            </linearGradient>
            <radialGradient id="pw-spec" cx="50%" cy="34%" r="55%">
              <Stops list={[["0", "#FFFFFF", 0.14], ["0.45", "#FFFFFF", 0.04], ["1", "#FFFFFF", 0]]} />
            </radialGradient>
            <radialGradient id="pw-btn" cx="50%" cy="40%" r="60%">
              <Stops list={[["0", "#FFFFFF", 0.2], ["0.6", "#FFFFFF", 0.08], ["1", "#FFFFFF", 0.04]]} />
            </radialGradient>
            <linearGradient id="pw-tri" x1="0" y1="0" x2="1" y2="1">
              <Stops list={[["0", "#FFFFFF", 0.95], ["1", "#FFFFFF", 0.55]]} />
            </linearGradient>
          </defs>
          {/* Disc, the light on it (rim + specular spot), the hairline edge. */}
          <circle cx={HALF} cy={HALF} r={HALF - 1} fill="url(#pw-disc)" />
          <circle cx={HALF} cy={HALF} r={HALF - 1} fill="url(#pw-rim)" />
          <circle cx={HALF} cy={HALF} r={HALF - 1} fill="url(#pw-spec)" />
          <circle cx={HALF} cy={HALF} r={HALF - 1} fill="none" stroke={EDGE} strokeWidth={1} />
          {/* The glass button with the play triangle, 40 px, same path as the icon. */}
          <circle cx={HALF} cy={HALF} r={CENTRE / 2} fill="url(#pw-btn)" />
          <circle cx={HALF} cy={HALF} r={CENTRE / 2} fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={1} />
          <path transform={`translate(${HALF - 20}, ${HALF - 20}) scale(${40 / 24})`} d={TRIANGLE} fill="url(#pw-tri)" />
          <MenuGlyph x={HALF} y={26} color={MUTED} />
          {GLYPHS.map((g) => (
            <path key={g.d} transform={`translate(${g.x}, ${g.y}) scale(${G})`} d={g.d} fill={MUTED} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function Stops({ list }: { list: [string, string, number][] }) {
  return list.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a} />);
}

const card: React.CSSProperties = { width: SIZE, maxWidth: "100%", background: GLASS, border: `1px solid ${GLASS_EDGE}`, borderRadius: 18, overflow: "hidden", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" };
const status: React.CSSProperties = { height: 36, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${GLASS_EDGE}`, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: MUTED };
const row: React.CSSProperties = { height: 44, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" };
const disc: React.CSSProperties = { width: SIZE, height: SIZE, maxWidth: "100%", borderRadius: "50%", touchAction: "none", userSelect: "none", cursor: "grab", outline: "none", boxShadow: "0 18px 48px rgba(0,0,0,0.8)", flexShrink: 0 };

/** "MENU" drawn as strokes, same hand-set forms as the app. */
function MenuGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  const w = 6;
  const gap = 3;
  const left = x - (4 * w + 3 * gap) / 2;
  const s = (i: number) => left + i * (w + gap);
  const stroke = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <>
      <path d={`M${s(0)} ${y + 8} V${y} L${s(0) + w / 2} ${y + 4} L${s(0) + w} ${y} V${y + 8}`} {...stroke} />
      <path d={`M${s(1) + w} ${y} H${s(1)} V${y + 8} H${s(1) + w} M${s(1)} ${y + 4} H${s(1) + w - 1.5}`} {...stroke} />
      <path d={`M${s(2)} ${y + 8} V${y} L${s(2) + w} ${y + 8} V${y}`} {...stroke} />
      <path d={`M${s(3)} ${y} V${y + 5.5} A${w / 2} 2.5 0 0 0 ${s(3) + w} ${y + 5.5} V${y}`} {...stroke} />
    </>
  );
}
