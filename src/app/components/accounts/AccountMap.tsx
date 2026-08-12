"use client";

// The social-account landscape as a graph, on the same React Flow mechanics the
// AI-Brain viewer uses (@xyflow/react: pan/zoom, minimap, controls, follows the
// admin light/dark theme).
//
// Layout is a deliberate radial bloom rather than a force simulation: the shape
// here is known — studio → app → accounts — so a solved layout reads cleaner and
// stays stable between renders. Apps sit on a ring around the hub; each app's
// accounts fan out along its own radial, spread across the arc it owns.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  APPS,
  ROLE_LABEL,
  PLATFORM_LABEL,
  accountKey,
  type SocialAccount,
  type AppMeta,
} from "@/lib/socialAccounts";

const APP_RING = 470; // hub → app distance
// The ring is drawn as an ellipse, not a circle: a square graph in a wide,
// short panel forces the fit to zoom out until the cards are unreadable.
// Only the app centres are stretched — the account clusters keep their own
// spacing, so nothing inside a cluster is squashed.
const X_STRETCH = 1.55;
const Y_STRETCH = 0.82;
const ACCT_RING = 250; // app → first account row
const ACCT_PITCH = 226; // sideways step between two accounts in the same row
// Rows step outward along the app's radial, so on a diagonal arm the step is
// split across x and y and neither axis gets the full distance. Two boxes only
// overlap when they overlap on BOTH axes, so this has to clear the card *width*
// on a near-horizontal arm — the harder of the two constraints.
const ROW_PITCH = 255;
const MAX_COLS = 3; // wider than this and neighbouring apps start to collide
const CARD_W = 214;
const CARD_H = 108;

const fmt = new Intl.NumberFormat("de-CH");
const compact = (n: number): string =>
  n >= 1000 ? new Intl.NumberFormat("de-CH", { notation: "compact", maximumFractionDigits: 1 }).format(n) : fmt.format(n);

type HubData = { label: string; sub: string };
type AppData = { app: AppMeta; count: number; followers: number };
type AcctData = { acct: SocialAccount; color: string; active: boolean };

function HubNode({ data }: NodeProps) {
  const d = data as HubData;
  return (
    <div className="am-hub">
      <Handle type="source" position={Position.Bottom} className="am-handle" />
      <div className="am-hub-label">{d.label}</div>
      <div className="am-hub-sub">{d.sub}</div>
    </div>
  );
}

function AppNode({ data }: NodeProps) {
  const d = data as AppData;
  return (
    <div className="am-app" style={{ borderColor: d.app.color, color: d.app.color }}>
      <Handle type="target" position={Position.Top} className="am-handle" />
      <Handle type="source" position={Position.Bottom} className="am-handle" />
      <div className="am-app-name">{d.app.name}</div>
      <div className="am-app-meta">
        {d.count} {d.count === 1 ? "Account" : "Accounts"} · {compact(d.followers)} Follower
      </div>
    </div>
  );
}

function AcctNode({ data }: NodeProps) {
  const d = data as AcctData;
  const a = d.acct;
  const worst = a.flags?.some((f) => f.level === "crit") ? "crit" : a.flags?.length ? "warn" : null;
  return (
    <div className={`am-acct${d.active ? " active" : ""}${worst ? ` flag-${worst}` : ""}`}>
      <Handle type="target" position={Position.Top} className="am-handle" />
      <div className="am-acct-top">
        <span className="am-handle-txt" style={{ color: d.color }}>
          {a.handle ? `@${a.handle}` : "Handle offen"}
        </span>
        <span className="am-role">{ROLE_LABEL[a.role]}</span>
      </div>
      <div className="am-nums">
        <span>
          <b>{a.followers === undefined ? "—" : compact(a.followers)}</b> Follower
        </span>
        <span>
          <b>{a.likes === undefined ? "—" : compact(a.likes)}</b> Likes
        </span>
      </div>
      <div className="am-chips">
        <span className="am-chip">{PLATFORM_LABEL[a.platform]}</span>
        {a.blotatoId ? (
          <span className="am-chip linked">Blotato {a.blotatoId}</span>
        ) : (
          <span className="am-chip unlinked">nur manuell</span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { hub: HubNode, app: AppNode, acct: AcctNode };

const CSS = `
.am-rf{width:100%;height:100%;position:relative}
.am-rf .react-flow__attribution{display:none}
.am-handle{opacity:0;pointer-events:none;width:1px;height:1px;min-width:1px;min-height:1px;border:0;background:transparent}

.am-hub{width:190px;height:190px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--surface);border:1px solid var(--line-strong,var(--line));box-shadow:0 0 0 10px color-mix(in oklab,var(--surface) 60%,transparent),var(--shadow-sm)}
.am-hub-label{font-family:var(--font-display,var(--font-body));font-size:19px;font-weight:700;letter-spacing:-.01em;color:var(--fg)}
.am-hub-sub{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--fg-4)}

.am-app{width:224px;padding:12px 14px;border-radius:var(--radius-sm,8px);background:var(--surface);border:1px solid;border-left-width:3px;box-shadow:var(--shadow-sm)}
.am-app-name{font-size:16px;font-weight:650;letter-spacing:-.01em;color:var(--fg)}
.am-app-meta{font-family:var(--font-mono);font-size:10px;color:var(--fg-4);margin-top:4px;font-variant-numeric:tabular-nums}

.am-acct{width:${CARD_W}px;box-sizing:border-box;padding:9px 11px;border-radius:var(--radius-sm,8px);background:var(--surface-2,var(--surface));border:1px solid var(--line);display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.am-acct:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm);border-color:var(--line-strong,var(--line))}
.am-acct.active{border-color:var(--bx-accent,#74D6C4);box-shadow:0 0 0 2px color-mix(in oklab,var(--bx-accent,#74D6C4) 40%,transparent)}
.am-acct.flag-warn{border-left:3px solid #d9a45f}
.am-acct.flag-crit{border-left:3px solid #e8827c}
.am-acct-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.am-handle-txt{font-family:var(--font-mono);font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.am-role{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--fg-4);flex-shrink:0}
.am-nums{display:flex;gap:12px;font-size:9px;color:var(--fg-4);font-variant-numeric:tabular-nums;text-transform:uppercase;letter-spacing:.08em}
.am-nums b{display:block;font-size:14px;font-weight:650;color:var(--fg);letter-spacing:-.02em;text-transform:none}
.am-chips{display:flex;flex-wrap:wrap;gap:4px}
.am-chip{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:var(--surface);border:1px solid var(--line);color:var(--fg-3)}
.am-chip.linked{color:#3fa06a;border-color:color-mix(in oklab,#3fa06a 40%,transparent)}
.am-chip.unlinked{color:var(--fg-4)}

.am-rf-hint{position:absolute;bottom:10px;left:12px;right:12px;pointer-events:none;font-family:var(--font-body),system-ui,sans-serif;font-size:11px;letter-spacing:.02em;color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:5}
`;

type MapProps = {
  accounts: SocialAccount[];
  onSelect?: (a: SocialAccount) => void;
  activeKey?: string | null;
  height?: string;
};

export default function AccountMap(props: MapProps) {
  // Provider so the inner component can reach the instance via useReactFlow;
  // also isolates this graph if a second React Flow ever lands on the page.
  return (
    <ReactFlowProvider>
      <AccountMapInner {...props} />
    </ReactFlowProvider>
  );
}

function AccountMapInner({ accounts, onSelect, activeKey, height = "100%" }: MapProps) {
  const [mode, setMode] = useState<ColorMode>("dark");
  useEffect(() => {
    const read = () =>
      setMode(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const framedRef = useRef(false);
  const { setViewport } = useReactFlow();

  const { nodes, edges, bounds } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];

    const grouped = APPS.map((app) => ({
      app,
      list: accounts.filter((a) => a.app === app.key),
    })).filter((g) => g.list.length > 0);

    const totalFollowers = accounts.reduce((s, a) => s + (a.followers ?? 0), 0);

    ns.push({
      id: "hub",
      type: "hub",
      position: { x: -95, y: -95 },
      draggable: false,
      width: 190,
      height: 190,
      data: { label: "Klar Studios", sub: `${accounts.length} Accounts` } satisfies HubData,
    });

    grouped.forEach((g, i) => {
      // Apps sit evenly on the ring, first one at the top.
      const theta = -Math.PI / 2 + (i * 2 * Math.PI) / grouped.length;
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      // Unit vector along the arc, for spreading an app's accounts sideways.
      const tx = -uy;
      const ty = ux;

      const appX = ux * APP_RING * X_STRETCH;
      const appY = uy * APP_RING * Y_STRETCH;
      const appId = `app:${g.app.key}`;

      ns.push({
        id: appId,
        type: "app",
        position: { x: appX - 112, y: appY - 30 },
        draggable: false,
        width: 224,
        height: 60,
        data: {
          app: g.app,
          count: g.list.length,
          followers: g.list.reduce((s, a) => s + (a.followers ?? 0), 0),
        } satisfies AppData,
      });

      es.push({
        id: `e:hub-${g.app.key}`,
        source: "hub",
        target: appId,
        type: "straight",
        style: { stroke: g.app.color, strokeWidth: 1.4, opacity: 0.42 },
      });

      // Accounts sit in rows of at most MAX_COLS, stacked outward. A single long
      // row would run into the neighbouring app's arc as soon as one app has
      // more than three accounts — MyLoo has six.
      const m = g.list.length;
      const cols = Math.min(MAX_COLS, m);
      const rows = Math.ceil(m / cols);

      g.list.forEach((a, j) => {
        const row = Math.floor(j / cols);
        const col = j % cols;
        // The last row is usually short; centre it under the ones above.
        const inThisRow = row === rows - 1 ? m - row * cols : cols;
        const along = ACCT_RING + row * ROW_PITCH;
        const offset = (col - (inThisRow - 1) / 2) * ACCT_PITCH;
        const cx = appX + ux * along + tx * offset;
        const cy = appY + uy * along + ty * offset;
        const id = `acct:${accountKey(a)}`;

        ns.push({
          id,
          type: "acct",
          position: { x: cx - CARD_W / 2, y: cy - CARD_H / 2 },
          draggable: false,
          width: CARD_W,
          height: CARD_H,
          data: {
            acct: a,
            color: g.app.color,
            active: activeKey === accountKey(a),
          } satisfies AcctData,
        });

        es.push({
          id: `e:${g.app.key}-${id}`,
          source: appId,
          target: id,
          type: "straight",
          style: {
            stroke: g.app.color,
            strokeWidth: 0.9,
            opacity: a.blotatoId ? 0.4 : 0.16,
            strokeDasharray: a.blotatoId ? undefined : "4 4",
          },
        });
      });
    });

    void totalFollowers;

    // Bounding box of the laid-out graph. We compute the view from this rather
    // than calling fitView, so the framing never depends on when React Flow
    // happens to measure things.
    const box = ns.reduce(
      (b, n) => ({
        minX: Math.min(b.minX, n.position.x),
        minY: Math.min(b.minY, n.position.y),
        maxX: Math.max(b.maxX, n.position.x + (n.width ?? 0)),
        maxY: Math.max(b.maxY, n.position.y + (n.height ?? 0)),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    return { nodes: ns, edges: es, bounds: box };
  }, [accounts, activeKey]);

  // Frame the graph ourselves. React Flow's own `fitView` never fired here —
  // on the first paint the wrapper measures 0×0, the fit runs against an empty
  // box, and the transform is silently left at identity. The graph then sits
  // off-screen, which reads as "nothing is clickable" because every click lands
  // on empty pane. Runs once, so a later window resize does not yank the view
  // back from wherever the reader panned to.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const frame = () => {
      if (framedRef.current) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const bw = bounds.maxX - bounds.minX;
      const bh = bounds.maxY - bounds.minY;
      if (!w || !h || !Number.isFinite(bw) || !Number.isFinite(bh) || bw <= 0 || bh <= 0) return;

      const pad = 40;
      const zoom = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 1.1);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      setViewport({ x: w / 2 - cx * zoom, y: h / 2 - cy * zoom, zoom });
      framedRef.current = true;
    };

    frame();
    const ro = new ResizeObserver(frame);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bounds, setViewport]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const d = node.data as Partial<AcctData>;
      if (d?.acct && onSelect) onSelect(d.acct);
    },
    [onSelect],
  );

  return (
    <div className="am-rf" style={{ height }} ref={wrapRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={mode}
        minZoom={0.1}
        maxZoom={2.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, n) => {
          const d = n.data as Partial<AcctData & AppData>;
          setHover(d?.acct ? (d.acct.handle ? `@${d.acct.handle}` : "Handle offen") : (d?.app?.content ?? null));
        }}
        onNodeMouseLeave={() => setHover(null)}
      >
        <Background id="am-grid-lines" variant={BackgroundVariant.Lines} gap={120} lineWidth={0.5} color="rgba(116,214,196,0.06)" />
        <Background id="am-grid-dots" variant={BackgroundVariant.Dots} gap={30} size={1.2} color="rgba(116,214,196,0.22)" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.data as Partial<AcctData>)?.color ?? "#8AA6C9"}
          nodeStrokeWidth={0}
          maskColor="color-mix(in oklab, var(--bg) 70%, transparent)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="am-rf-hint">
        {hover ?? "ziehen, scrollen zum Zoomen, Account klicken für Details"}
      </div>
    </div>
  );
}
