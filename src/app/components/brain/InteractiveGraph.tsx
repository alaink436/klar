"use client";

// Interactive, clickable force-graph for the AI-Brain viewer. Shares the
// canvas drawing approach with the landing-page BrainGraph (bowed edges,
// hub labels, hover-trace) but is data-driven via props, has no growth
// time-lapse, and turns a node click into "open this note". The active
// (currently-open) note gets a persistent ring.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { RawNode, Group } from "@/lib/brainVault";

const META: CSSProperties = {
  fontFamily: "var(--font-body), system-ui, sans-serif",
  fontSize: "11px",
  letterSpacing: "0.02em",
  textTransform: "none",
};

export default function InteractiveGraph({
  nodes,
  edges,
  groups,
  activePath,
  onOpen,
  height = "100%",
}: {
  nodes: RawNode[];
  edges: [number, number][];
  groups: Group[];
  activePath?: string | null;
  onOpen: (path: string) => void;
  height?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ scale: 1, x: 0, y: 0, base: 0, cx: 0, cy: 0 });
  const drag = useRef({ on: false, moved: 0, px: 0, py: 0 });
  const hoverRef = useRef(-1);
  const labelFontRef = useRef("Georgia, 'Times New Roman', serif");
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const N = nodes.length;

  // adjacency for hover-tracing + the active-node index (recomputed when the
  // open note changes)
  const adjRef = useRef<number[][]>([]);
  const hubsRef = useRef<number[]>([]);
  useEffect(() => {
    const adj: number[][] = nodes.map(() => []);
    for (const [a, b] of edges) {
      adj[a]?.push(b);
      adj[b]?.push(a);
    }
    adjRef.current = adj;
    hubsRef.current = [...nodes.keys()].sort((a, b) => nodes[b].r - nodes[a].r).slice(0, 6);
  }, [nodes, edges]);

  const activeRef = useRef(-1);
  useEffect(() => {
    activeRef.current = activePath ? nodes.findIndex((n) => n.p === activePath) : -1;
  }, [activePath, nodes]);

  useEffect(() => {
    const ed = getComputedStyle(document.body).getPropertyValue("--font-editorial").trim();
    if (ed) labelFontRef.current = `${ed}, Georgia, serif`;
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
    const sx = (n: RawNode) => v.cx + n.x * k + v.x;
    const sy = (n: RawNode) => v.cy + n.y * k + v.y;

    const hv = hoverRef.current;
    const act = activeRef.current;
    const adj = adjRef.current;
    const near = new Set<number>();
    if (hv >= 0) {
      near.add(hv);
      for (const nb of adj[hv] ?? []) near.add(nb);
    }

    // bowed edges (wrap around the hollow centre)
    const gcx = v.cx + v.x;
    const gcy = v.cy + v.y;
    const HOLE = 0.34 * k;
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const on = hv >= 0 && (a === hv || b === hv);
      ctx.strokeStyle = on ? "#bfeae3" : "#4a4f60";
      ctx.globalAlpha = hv >= 0 ? (on ? 0.9 : 0.025) : 0.04;
      const ax = sx(nodes[a]);
      const ay = sy(nodes[a]);
      const bx = sx(nodes[b]);
      const by = sy(nodes[b]);
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const sd = (gcx - ax) * nx + (gcy - ay) * ny;
      const clear = Math.max(0, HOLE - Math.abs(sd));
      const bow = (6 + clear * 2.3) * (sd > 0 ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 + nx * bow, (ay + by) / 2 + ny * bow, bx, by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      const X = sx(n);
      const Y = sy(n);
      if (X < -30 || X > W + 30 || Y < -30 || Y > H + 30) continue;
      const col = groups[n.g]?.color || "#9aa0b0";
      const dim = hv >= 0 && !near.has(i);
      const rr = Math.max(1.0, n.r * 0.62 * Math.sqrt(v.scale));
      ctx.globalAlpha = dim ? 0.16 : 1;
      if (n.r > 6) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = i === hv || i === act ? "#ffffff" : col;
      ctx.beginPath();
      ctx.arc(X, Y, rr, 0, 6.2832);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(7,7,9,0.85)";
      ctx.stroke();
      if (i === act || i === hv) {
        ctx.strokeStyle = i === act ? "#74D6C4" : "#fff";
        ctx.globalAlpha = i === act ? 0.95 : 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X, Y, rr + 5, 0, 6.2832);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // hub + hovered + active labels (editorial serif)
    ctx.font = `italic 13px ${labelFontRef.current}`;
    ctx.textBaseline = "middle";
    const labelled = new Set(hubsRef.current);
    if (hv >= 0) labelled.add(hv);
    if (act >= 0) labelled.add(act);
    for (const i of labelled) {
      const n = nodes[i];
      if (!n) continue;
      const X = sx(n);
      const Y = sy(n);
      if (X < 0 || X > W || Y < 0 || Y > H) continue;
      const lx = X + n.r * 0.62 * Math.sqrt(v.scale) + 6;
      ctx.globalAlpha = i === hv || i === act ? 1 : 0.66;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = i === act ? "#74D6C4" : i === hv ? "#fff" : groups[n.g]?.color || "#cfd2dc";
      ctx.fillText(n.l, lx, Y + 1);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }, [nodes, edges, groups, N]);

  const queued = useRef(false);
  const redraw = useCallback(() => {
    if (queued.current) return;
    queued.current = true;
    requestAnimationFrame(() => {
      queued.current = false;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    redraw();
  }, [activePath, redraw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const ro = new ResizeObserver(() => draw());
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
        const dx = v.cx + nodes[i].x * k + v.x - mx;
        const dy = v.cy + nodes[i].y * k + v.y - my;
        const d = dx * dx + dy * dy;
        const rr = Math.max(7, nodes[i].r * Math.sqrt(v.scale) + 4);
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
        const ddx = mx - drag.current.px;
        const ddy = my - drag.current.py;
        drag.current.moved += Math.abs(ddx) + Math.abs(ddy);
        view.current.x += ddx;
        view.current.y += ddy;
        drag.current.px = mx;
        drag.current.py = my;
        redraw();
        return;
      }
      const h = pick(mx, my);
      if (h !== hoverRef.current) {
        hoverRef.current = h;
        setHoverLabel(h >= 0 ? nodes[h].l : null);
        cv.style.cursor = h >= 0 ? "pointer" : "grab";
        redraw();
      }
    };
    const onDown = (e: PointerEvent) => {
      const [px, py] = xy(e);
      drag.current = { on: true, moved: 0, px, py };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = "grabbing";
    };
    const onUp = (e: PointerEvent) => {
      const wasClick = drag.current.on && drag.current.moved < 6;
      drag.current.on = false;
      cv.style.cursor = "grab";
      if (wasClick) {
        const [mx, my] = xy(e);
        const i = pick(mx, my);
        if (i >= 0) onOpen(nodes[i].p);
      }
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
  }, [draw, redraw, nodes, N, onOpen]);

  return (
    <div ref={wrapRef} className="relative w-full h-full" style={{ height }}>
      <canvas ref={canvasRef} className="block touch-pan-y" />
      <div className="absolute bottom-3 left-3 right-3 pointer-events-none truncate" style={{ ...META, color: "var(--fg-3)" }}>
        {hoverLabel ?? "ziehen, scrollen zum zoomen, Node klicken um die Notiz zu öffnen"}
      </div>
    </div>
  );
}
