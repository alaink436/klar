"use client";

/**
 * BrainGraph — the actual Obsidian graph view, on the site. Every node is a
 * note in the AI-Brain vault, every edge a [[wikilink]]. Layout is force-
 * directed offline (scripts/gen-brain-graph.py -> brainGraph.json), drawn on
 * a canvas. Drag to pan, scroll to zoom, hover a node to trace its links.
 * Static like Obsidian (no idle animation) so it's cheap and visibility-safe.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import graph from "../data/brainGraph.json";

interface GNode {
  x: number;
  y: number;
  r: number;
  g: number;
  t: number;
  l: string;
}
const NODES = graph.nodes as GNode[];
const EDGES = graph.edges as [number, number][];
const GROUPS = graph.groups as {
  key: string;
  label: string;
  tone: number;
  count: number;
}[];
const C = graph.counts as { nodes: number; edges: number; linked: number };

// adjacency for hover-tracing
const ADJ: number[][] = NODES.map(() => []);
for (const [a, b] of EDGES) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}

const TONE_VARS = ["--fg", "--silver", "--fg-3", "--fg-4"];

export default function BrainGraph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ scale: 1, x: 0, y: 0, base: 0, cx: 0, cy: 0 });
  const drag = useRef<{ on: boolean; px: number; py: number }>({
    on: false,
    px: 0,
    py: 0,
  });
  const hoverRef = useRef<number>(-1);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (W === 0 || H === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== W * dpr || cv.height !== H * dpr) {
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + "px";
      cv.style.height = H + "px";
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cs = getComputedStyle(document.documentElement);
    const tone = TONE_VARS.map((v) => cs.getPropertyValue(v).trim() || "#fff");
    const line = cs.getPropertyValue("--line").trim() || "#333";

    const v = view.current;
    if (v.base === 0) {
      v.base = Math.min(W, H) * 0.46;
      v.cx = W / 2;
      v.cy = H / 2;
    }
    const k = v.base * v.scale;
    const sx = (n: GNode) => v.cx + n.x * k + v.x;
    const sy = (n: GNode) => v.cy + n.y * k + v.y;

    const hv = hoverRef.current;
    const near = new Set<number>();
    if (hv >= 0) {
      near.add(hv);
      for (const nb of ADJ[hv]) near.add(nb);
    }

    // edges
    ctx.lineWidth = 1;
    for (const [a, b] of EDGES) {
      const on = hv >= 0 && (a === hv || b === hv);
      ctx.strokeStyle = on ? tone[1] : line;
      ctx.globalAlpha = hv >= 0 ? (on ? 0.7 : 0.06) : 0.22;
      ctx.beginPath();
      ctx.moveTo(sx(NODES[a]), sy(NODES[a]));
      ctx.lineTo(sx(NODES[b]), sy(NODES[b]));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i];
      const X = sx(n);
      const Y = sy(n);
      if (X < -20 || X > W + 20 || Y < -20 || Y > H + 20) continue;
      const dim = hv >= 0 && !near.has(i);
      ctx.globalAlpha = dim ? 0.18 : 1;
      ctx.fillStyle = i === hv ? tone[0] : tone[n.t] || tone[2];
      ctx.beginPath();
      ctx.arc(X, Y, Math.max(1.5, n.r * Math.sqrt(v.scale)), 0, 6.2832);
      ctx.fill();
      if (i === hv) {
        ctx.strokeStyle = tone[0];
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X, Y, n.r * Math.sqrt(v.scale) + 4, 0, 6.2832);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // hover label
    if (hv >= 0) {
      const n = NODES[hv];
      const X = sx(n);
      const Y = sy(n);
      ctx.font =
        "11px ui-monospace, 'JetBrains Mono', monospace";
      const tw = ctx.measureText(n.l).width;
      const bx = Math.min(Math.max(X + 10, 6), W - tw - 14);
      const by = Math.min(Math.max(Y - 26, 6), H - 26);
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.fillRect(bx - 6, by, tw + 12, 20);
      ctx.fillStyle = tone[0];
      ctx.fillText(n.l, bx, by + 14);
    }
  }, []);

  // schedule a redraw (rAF only fires while visible — fine, interactions
  // only happen when visible; resize/open path calls draw() directly)
  const queued = useRef(false);
  const redraw = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    requestAnimationFrame(() => {
      queued.current = false;
      draw();
    });
  }, [draw]);

  const pick = useCallback((mx: number, my: number) => {
    const v = view.current;
    const k = v.base * v.scale;
    let best = -1;
    let bd = 16 * 16;
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i];
      const dx = v.cx + n.x * k + v.x - mx;
      const dy = v.cy + n.y * k + v.y - my;
      const d = dx * dx + dy * dy;
      const rr = Math.max(6, n.r * Math.sqrt(v.scale) + 4);
      if (d < rr * rr && d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;

    const ro = new ResizeObserver(() => {
      view.current.base = 0; // refit on size change
      draw();
    });
    ro.observe(wrap);
    draw();

    const onMove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (drag.current.on) {
        view.current.x += mx - drag.current.px;
        view.current.y += my - drag.current.py;
        drag.current.px = mx;
        drag.current.py = my;
        redraw();
        return;
      }
      const hit = pick(mx, my);
      if (hit !== hoverRef.current) {
        hoverRef.current = hit;
        setHoverLabel(hit >= 0 ? NODES[hit].l : null);
        cv.style.cursor = hit >= 0 ? "pointer" : "grab";
        redraw();
      }
    };
    const onDown = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      drag.current = {
        on: true,
        px: e.clientX - rect.left,
        py: e.clientY - rect.top,
      };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = "grabbing";
    };
    const onUp = () => {
      drag.current.on = false;
      cv.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = view.current;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const ns = Math.min(Math.max(v.scale * f, 0.4), 6);
      // zoom toward cursor
      const k0 = v.base * v.scale;
      const k1 = v.base * ns;
      v.x = mx - ((mx - v.cx - v.x) / k0) * k1 - v.cx;
      v.y = my - ((my - v.cy - v.y) / k0) * k1 - v.cy;
      v.scale = ns;
      redraw();
    };

    const onLeave = () => {
      drag.current.on = false;
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        setHoverLabel(null);
        redraw();
      }
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
    };
  }, [draw, redraw, pick]);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full brut-line bg-[var(--bg-2)] overflow-hidden"
        style={{ height: "clamp(340px, 56vw, 560px)" }}
      >
        <canvas ref={canvasRef} className="block touch-none" />
        {/* legend */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 pointer-events-none">
          <p className="label mb-2">
            {C.nodes.toLocaleString("en-US")} notes · {C.edges.toLocaleString("en-US")} links
          </p>
          <div className="flex flex-col gap-1">
            {GROUPS.slice(0, 6).map((g) => (
              <span
                key={g.key}
                className="label flex items-center gap-2"
                style={{ fontSize: "10px" }}
              >
                <span
                  className="inline-block w-2.5 h-2.5"
                  style={{ background: `var(${TONE_VARS[g.tone]})` }}
                />
                {g.label} · {g.count}
              </span>
            ))}
          </div>
        </div>
        <p className="label absolute bottom-3 right-3 sm:bottom-4 sm:right-4 pointer-events-none">
          {hoverLabel ? hoverLabel : "drag · scroll to zoom · hover a node"}
        </p>
      </div>
      <p className="t-body-lg text-[var(--fg-3)] mt-4 max-w-2xl">
        Every dot is a real note, every line a link I made between them. This
        is the actual graph, not a decoration — {C.linked.toLocaleString("en-US")}{" "}
        of {C.nodes.toLocaleString("en-US")} notes are wired into the web.
      </p>
    </div>
  );
}
