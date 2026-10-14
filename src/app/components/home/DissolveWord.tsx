"use client";

import { useEffect, useRef } from "react";

// A word whose tail breaks up into ink particles, after the "Classified" headline
// Alain sent as reference (2026-10-14). The real text stays in the DOM, only
// transparent, so it keeps the line's width, wraps, selects and reads like text.
// A canvas on top draws the same word from its pixels and scatters the tail.

const SCATTER_FROM = 0.7; // where in the word the break-up begins, 0..1
const SPREAD_X = 0.4; // how far right the dust drifts, in word widths
const SPREAD_Y = 0.18; // vertical spread, in font sizes
const INTRO_MS = 1800;
const IDLE_MS = 1000 / 24; // after the intro the dust only breathes, no need for 60 fps
const INK = [14, 14, 16];

type Particle = { x: number; y: number; tx: number; ty: number; a: number; ph: number };

function hash(n: number) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export default function DissolveWord({ children }: { children: string }) {
  const slot = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = slot.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let particles: Particle[] = [];
    let solid: ImageData | null = null;
    let start = 0;

    function build() {
      if (!el || !cv || !ctx) return;
      const cs = getComputedStyle(el);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = parseFloat(cs.fontSize);
      const font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      const box = el.getBoundingClientRect();
      const padX = box.width * SPREAD_X;
      const padY = size * SPREAD_Y * 1.6;
      const w = Math.ceil(box.width + padX);
      const h = Math.ceil(box.height + padY * 2);

      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cv.style.top = `${-padY}px`;

      // Draw the word where the transparent text sits: baseline = half-leading + ascent.
      const off = document.createElement("canvas");
      off.width = cv.width;
      off.height = cv.height;
      const o = off.getContext("2d")!;
      o.scale(dpr, dpr);
      o.font = font;
      o.fillStyle = "#000";
      const m = o.measureText(children);
      const asc = m.fontBoundingBoxAscent ?? size * 0.9;
      const desc = m.fontBoundingBoxDescent ?? size * 0.22;
      const lh = parseFloat(cs.lineHeight) || size;
      const base = padY + (lh - (asc + desc)) / 2 + asc;
      const spacing = parseFloat(cs.letterSpacing) || 0;
      // Safari before 18 has no canvas letterSpacing: set the letters one by one there.
      if ("letterSpacing" in CanvasRenderingContext2D.prototype) {
        o.letterSpacing = `${spacing}px`;
        o.fillText(children, 0, base);
      } else {
        let x = 0;
        for (const ch of children) {
          o.fillText(ch, x, base);
          x += o.measureText(ch).width + spacing;
        }
      }

      const src = o.getImageData(0, 0, off.width, off.height).data;
      solid = ctx.createImageData(off.width, off.height);
      particles = [];
      const wordW = box.width * dpr;
      const fs = size * dpr;

      for (let y = 0; y < off.height; y++) {
        for (let x = 0; x < off.width; x++) {
          const i = (y * off.width + x) * 4;
          const alpha = src[i + 3];
          if (alpha < 40) continue;
          // A ragged edge: the break-up line wanders with height.
          const edge = SCATTER_FROM + (hash(Math.floor(y / 3)) - 0.5) * 0.08;
          const t = x / wordW;
          const r = hash(i + 1);
          const scatter = t > edge && r < Math.min(1, ((t - edge) / (1 - edge)) * 1.35);
          if (!scatter) {
            solid.data[i] = INK[0];
            solid.data[i + 1] = INK[1];
            solid.data[i + 2] = INK[2];
            solid.data[i + 3] = alpha;
            continue;
          }
          if (hash(i + 7) < 0.1) continue; // some of the tail is simply gone
          const k = (t - edge) / (1 - edge);
          const gx = hash(i + 3);
          const gy = hash(i + 5) + hash(i + 11) - 1;
          particles.push({
            x,
            y,
            tx: x + gx * gx * wordW * SPREAD_X * (0.35 + k),
            ty: y + gy * fs * SPREAD_Y * (0.4 + k),
            a: 0.55 + hash(i + 13) * 0.45,
            ph: hash(i + 17) * Math.PI * 2,
          });
        }
      }
      start = performance.now();
    }

    let last = 0;
    function frame(now: number) {
      if (!cv || !ctx || !solid) return;
      const p = still ? 1 : Math.min(1, (now - start) / INTRO_MS);
      if (p === 1 && !still && now - last < IDLE_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;
      const e = 1 - Math.pow(1 - p, 3);
      const img = new ImageData(new Uint8ClampedArray(solid.data), solid.width, solid.height);
      const d = img.data;
      const w = img.width;
      const h = img.height;
      const tick = now / 1600;
      const sway = still ? 0 : 1;
      for (const q of particles) {
        const x = Math.round(q.x + (q.tx - q.x) * e + Math.sin(tick + q.ph) * 0.8 * sway);
        const y = Math.round(q.y + (q.ty - q.y) * e + Math.cos(tick + q.ph) * 0.6 * sway);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        d[i] = INK[0];
        d[i + 1] = INK[1];
        d[i + 2] = INK[2];
        d[i + 3] = Math.max(d[i + 3], q.a * 255);
      }
      ctx.putImageData(img, 0, 0);
      if (!still) raf = requestAnimationFrame(frame);
    }

    let resizeTimer = 0;
    function restart() {
      cancelAnimationFrame(raf);
      build();
      raf = requestAnimationFrame(frame);
    }
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(restart, 150);
    }

    document.fonts.ready.then(restart);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [children]);

  return (
    <span ref={slot} className="relative inline-block" style={{ color: "transparent" }}>
      {children}
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute left-0" />
    </span>
  );
}
