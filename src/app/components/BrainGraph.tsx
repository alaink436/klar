"use client";

/**
 * BrainGraph — the AI-Brain Obsidian vault, on the site. Every node is a
 * note, every edge a [[wikilink]]. Force-laid-out offline
 * (scripts/gen-brain-graph.py -> brainGraph.json).
 *
 * On reveal it plays a "growth" time-lapse: notes pop in by their real
 * git creation date while a date ticks forward, then it settles into the
 * full interactive graph (drag / scroll-zoom / hover-trace). Growth runs
 * on a time-based interval (not rAF — rAF pauses while the tab is hidden).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import graph from "../data/brainGraph.json";

interface GNode {
  x: number;
  y: number;
  r: number;
  g: number;
  c: number;
  l: string;
}
const NODES = graph.nodes as GNode[];
const EDGES = graph.edges as [number, number][];
const GROUPS = graph.groups as {
  key: string;
  label: string;
  color: string;
  count: number;
}[];
const ORDER = graph.order as string[];
const C = graph.counts as { nodes: number; edges: number; linked: number };
const N = NODES.length;
const GROW_MS = 7000;
const FADE = N * 0.05; // per-node fade-in window (in rank units)

// adjacency for hover-tracing
const ADJ: number[][] = NODES.map(() => []);
for (const [a, b] of EDGES) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}
// only the very top hubs get an always-on label (kept few so they
// don't blob up the centre)
const HUBS = [...NODES.keys()]
  .sort((a, b) => NODES[b].r - NODES[a].r)
  .slice(0, 6);

const mon = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  const m = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${m} '${String(d.getUTCFullYear()).slice(2)}`;
};

export default function BrainGraph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ scale: 1, x: 0, y: 0, base: 0, cx: 0, cy: 0 });
  const drag = useRef({ on: false, px: 0, py: 0 });
  const hoverRef = useRef(-1);
  const grownF = useRef(N); // visible rank cutoff (float); N = fully grown
  const [reduce, setReduce] = useState(false);
  const [phase, setPhase] = useState<"idle" | "grow" | "done">("idle");
  const [dateLbl, setDateLbl] = useState(graph.last as string);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
  }, []);

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

    const v = view.current;
    if (v.base === 0) {
      v.base = Math.min(W, H) * 0.46;
      v.cx = W / 2;
      v.cy = H / 2;
    }
    const k = v.base * v.scale;
    const sx = (n: GNode) => v.cx + n.x * k + v.x;
    const sy = (n: GNode) => v.cy + n.y * k + v.y;
    const gf = grownF.current;
    const vis = (i: number) =>
      Math.max(0, Math.min(1, (gf - NODES[i].c) / FADE));

    const hv = hoverRef.current;
    const near = new Set<number>();
    if (hv >= 0) {
      near.add(hv);
      for (const nb of ADJ[hv]) near.add(nb);
    }

    // edges — each one bowed perpendicular, away from the graph centre,
    // by however much it takes to wrap around the hollow middle. Chords
    // that would cut straight through the centre bow the most.
    const gcx = v.cx + v.x;
    const gcy = v.cy + v.y;
    const HOLE = 0.34 * k;
    ctx.lineWidth = 1;
    for (const [a, b] of EDGES) {
      const av = Math.min(vis(a), vis(b));
      if (av <= 0) continue;
      const on = hv >= 0 && (a === hv || b === hv);
      ctx.strokeStyle = on ? "#bfeae3" : "#4a4f60";
      ctx.globalAlpha = (hv >= 0 ? (on ? 0.9 : 0.025) : 0.032) * av;
      const ax = sx(NODES[a]);
      const ay = sy(NODES[a]);
      const bx = sx(NODES[b]);
      const by = sy(NODES[b]);
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      // signed distance of the graph centre from the chord line
      const sd = (gcx - ax) * nx + (gcy - ay) * ny;
      const clear = Math.max(0, HOLE - Math.abs(sd));
      const bow = (6 + clear * 2.3) * (sd > 0 ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(
        (ax + bx) / 2 + nx * bow,
        (ay + by) / 2 + ny * bow,
        bx,
        by
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes
    for (let i = 0; i < N; i++) {
      const a = vis(i);
      if (a <= 0) continue;
      const n = NODES[i];
      const X = sx(n);
      const Y = sy(n);
      if (X < -30 || X > W + 30 || Y < -30 || Y > H + 30) continue;
      const col = GROUPS[n.g]?.color || "#9aa0b0";
      const dim = hv >= 0 && !near.has(i);
      const rr = Math.max(1.0, n.r * 0.62 * Math.sqrt(v.scale));
      ctx.globalAlpha = (dim ? 0.16 : 1) * a;
      if (n.r > 6) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = i === hv ? "#ffffff" : col;
      ctx.beginPath();
      ctx.arc(X, Y, rr, 0, 6.2832);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(7,7,9,0.85)";
      ctx.stroke();
      if (i === hv) {
        ctx.strokeStyle = "#fff";
        ctx.globalAlpha = 0.5 * a;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X, Y, rr + 5, 0, 6.2832);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // always-on hub labels (+ hovered)
    ctx.font = "11px ui-monospace, 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    const labelled = new Set(HUBS);
    if (hv >= 0) labelled.add(hv);
    for (const i of labelled) {
      if (vis(i) < 0.6) continue;
      const n = NODES[i];
      const X = sx(n);
      const Y = sy(n);
      if (X < 0 || X > W || Y < 0 || Y > H) continue;
      const t = n.l;
      const lx = X + n.r * 0.62 * Math.sqrt(v.scale) + 6;
      const ly = Y;
      // soft shadow instead of a solid box, so labels don't form a
      // dark mass in the middle
      ctx.globalAlpha = i === hv ? 1 : 0.66;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = i === hv ? "#fff" : GROUPS[n.g]?.color || "#cfd2dc";
      ctx.fillText(t, lx, ly + 1);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }, []);

  const queued = useRef(false);
  const redraw = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    requestAnimationFrame(() => {
      queued.current = false;
      draw();
    });
  }, [draw]);

  // growth playback (time-based interval)
  useEffect(() => {
    if (phase !== "grow") return;
    if (reduce) {
      grownF.current = N;
      setDateLbl(graph.last as string);
      setPhase("done");
      return;
    }
    grownF.current = 0;
    const start = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min((performance.now() - start) / GROW_MS, 1);
      grownF.current = p * (N + FADE);
      const ri = Math.min(N - 1, Math.floor(p * N));
      setDateLbl(ORDER[ri]);
      draw();
      if (p >= 1) {
        window.clearInterval(id);
        grownF.current = N;
        setPhase("done");
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [phase, reduce, runId, draw]);

  // start growth once the section is on screen (ResizeObserver fires when
  // the collapsible <details> opens; works even while the tab is hidden)
  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    let started = false;
    const ro = new ResizeObserver(() => {
      draw();
      if (!started && wrap.clientWidth > 0) {
        started = true;
        setPhase("grow");
      }
    });
    ro.observe(wrap);
    draw();

    const xy = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const pick = (mx: number, my: number) => {
      const v = view.current;
      const k = v.base * v.scale;
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < N; i++) {
        if (grownF.current < NODES[i].c) continue;
        const dx = v.cx + NODES[i].x * k + v.x - mx;
        const dy = v.cy + NODES[i].y * k + v.y - my;
        const d = dx * dx + dy * dy;
        const rr = Math.max(7, NODES[i].r * Math.sqrt(v.scale) + 4);
        if (d < rr * rr && d < bd) {
          bd = d;
          best = i;
        }
      }
      return best;
    };
    const onMove = (e: PointerEvent) => {
      const [mx, my] = xy(e);
      if (drag.current.on) {
        view.current.x += mx - drag.current.px;
        view.current.y += my - drag.current.py;
        drag.current.px = mx;
        drag.current.py = my;
        redraw();
        return;
      }
      const h = pick(mx, my);
      if (h !== hoverRef.current) {
        hoverRef.current = h;
        setHoverLabel(h >= 0 ? NODES[h].l : null);
        cv.style.cursor = h >= 0 ? "pointer" : "grab";
        redraw();
      }
    };
    const onDown = (e: PointerEvent) => {
      const [px, py] = xy(e);
      drag.current = { on: true, px, py };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = "grabbing";
    };
    const onUp = () => {
      drag.current.on = false;
      cv.style.cursor = "grab";
    };
    const onLeave = () => {
      drag.current.on = false;
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        setHoverLabel(null);
        redraw();
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const v = view.current;
      const ns = Math.min(Math.max(v.scale * (e.deltaY < 0 ? 1.12 : 0.893), 0.4), 7);
      const k0 = v.base * v.scale;
      const k1 = v.base * ns;
      v.x = mx - ((mx - v.cx - v.x) / k0) * k1 - v.cx;
      v.y = my - ((my - v.cy - v.y) / k0) * k1 - v.cy;
      v.scale = ns;
      redraw();
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
  }, [draw, redraw]);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative w-full brut-line bg-[var(--bg-2)] overflow-hidden"
        style={{ height: "clamp(360px, 60vw, 620px)" }}
      >
        <canvas ref={canvasRef} className="block touch-none" />

        {/* legend */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 pointer-events-none">
          <p className="label mb-2">
            {C.nodes.toLocaleString("en-US")} notes ·{" "}
            {C.edges.toLocaleString("en-US")} links
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
                  style={{ background: g.color }}
                />
                {g.label} · {g.count}
              </span>
            ))}
          </div>
        </div>

        {/* growth date + control */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-right pointer-events-none">
          <p className="label">
            {phase === "grow" ? "growing…" : "the brain, today"}
          </p>
          <p
            className="display text-2xl sm:text-3xl tabular-nums leading-none mt-1"
            style={{ color: "var(--fg)" }}
          >
            {mon(dateLbl)}
          </p>
        </div>

        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-3">
          <p className="label pointer-events-none">
            {hoverLabel ?? "drag · scroll to zoom · hover a node"}
          </p>
          {!reduce && phase === "done" && (
            <button
              type="button"
              onClick={() => {
                setRunId((n) => n + 1);
                setPhase("grow");
              }}
              className="label-fg brut-line-thin px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition shrink-0"
            >
              ↻ replay growth
            </button>
          )}
        </div>
      </div>

      <p className="t-body-lg text-[var(--fg-3)] mt-4 max-w-2xl">
        The whole vault, every note and every link I made between them, grown
        back in the order it was actually written. {C.linked.toLocaleString("en-US")}{" "}
        of {C.nodes.toLocaleString("en-US")} notes are wired into the web; the
        loose halo is everything else I keep in here.
      </p>
    </div>
  );
}
