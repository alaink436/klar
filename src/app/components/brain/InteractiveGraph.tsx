"use client";

// Interactive AI-Brain graph, rebuilt on React Flow (@xyflow/react) instead of
// the hand-rolled canvas. Same props/contract as before so BrainExplorer is
// unchanged: data-driven nodes/edges/groups, click a node to open its note,
// the active note keeps a ring. Adds real pan/zoom, a minimap and controls,
// and follows the admin light/dark theme.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { RawNode, Group } from "@/lib/brainVault";

// Normalised node coords (~ -1..1) spread out into React Flow's pixel space.
const SPREAD = 1300;

type DotData = {
  label: string;
  color: string;
  size: number;
  path: string;
  hub: boolean;
  active: boolean;
};

function DotNode({ data }: NodeProps) {
  const d = data as DotData;
  return (
    <div
      className={`brain-dot${d.active ? " active" : ""}${d.hub ? " hub" : ""}`}
      title={d.label}
      style={{ width: d.size, height: d.size, background: d.color }}
    >
      <Handle type="target" position={Position.Top} className="brain-handle" />
      <Handle type="source" position={Position.Bottom} className="brain-handle" />
      <span className="brain-dot-label">{d.label}</span>
    </div>
  );
}

const nodeTypes = { dot: DotNode };

const CSS = `
.brain-rf{width:100%;height:100%;position:relative}
.brain-rf .react-flow__attribution{display:none}
.brain-dot{border-radius:50%;position:relative;display:block;border:1px solid rgba(0,0,0,.45);box-shadow:0 0 6px rgba(0,0,0,.35);cursor:pointer;transition:transform .1s ease}
.brain-dot:hover{transform:scale(1.45);z-index:20}
.brain-dot.active{box-shadow:0 0 0 3px var(--accent),0 0 10px rgba(0,0,0,.4)}
.brain-handle{opacity:0;pointer-events:none;width:1px;height:1px;min-width:1px;min-height:1px;border:0;background:transparent}
.brain-dot-label{position:absolute;left:calc(100% + 7px);top:50%;transform:translateY(-50%);white-space:nowrap;font-family:var(--font-editorial,Georgia,serif);font-style:italic;font-size:12px;line-height:1;color:var(--fg-2);opacity:0;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.85)}
.brain-dot:hover .brain-dot-label,.brain-dot.hub .brain-dot-label,.brain-dot.active .brain-dot-label{opacity:1}
.brain-dot.active .brain-dot-label{color:var(--accent)}
.brain-rf .react-flow__controls{box-shadow:var(--shadow-sm);border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden}
.brain-rf .react-flow__controls-button{background:var(--surface);border-bottom:1px solid var(--line);color:var(--fg-2)}
.brain-rf .react-flow__controls-button:hover{background:var(--surface-2)}
.brain-rf .react-flow__controls-button svg{fill:currentColor}
.brain-rf .react-flow__minimap{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-sm)}
.brain-rf-hint{position:absolute;bottom:10px;left:12px;right:12px;pointer-events:none;font-family:var(--font-body),system-ui,sans-serif;font-size:11px;letter-spacing:.02em;color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:5}
`;

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
  // Follow the admin theme (data-theme on <html>) so React Flow's chrome
  // (controls, minimap, background) matches light/dark.
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

  // Top hubs (by radius) keep their label visible always for orientation.
  const hubPaths = useMemo(() => {
    return new Set(
      [...nodes].sort((a, b) => b.r - a.r).slice(0, 8).map((n) => n.p),
    );
  }, [nodes]);

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n, i) => {
        const size = Math.max(8, Math.min(42, n.r * 1.15));
        return {
        id: String(i),
        type: "dot",
        position: { x: n.x * SPREAD, y: n.y * SPREAD },
        draggable: false,
        width: size,
        height: size,
        data: {
          label: n.l,
          color: groups[n.g]?.color ?? "#9aa0b0",
          size,
          path: n.p,
          hub: hubPaths.has(n.p),
          active: activePath != null && n.p === activePath,
        } satisfies DotData,
        };
      }),
    [nodes, groups, hubPaths, activePath],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map(([a, b]) => ({
        id: `e${a}-${b}`,
        source: String(a),
        target: String(b),
      })),
    [edges],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const p = (node.data as DotData)?.path;
      if (p) onOpen(p);
    },
    [onOpen],
  );

  return (
    <div className="brain-rf" style={{ height }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        colorMode={mode}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.12}
        maxZoom={3.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "straight",
          style: { stroke: "var(--line-strong)", strokeWidth: 0.6, opacity: 0.16 },
        }}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, n) => setHover((n.data as DotData)?.label ?? null)}
        onNodeMouseLeave={() => setHover(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="var(--line)" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.data as DotData)?.color ?? "#9aa0b0"}
          nodeStrokeWidth={0}
          maskColor="color-mix(in oklab, var(--bg) 70%, transparent)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="brain-rf-hint">
        {hover ?? "ziehen, scrollen zum Zoomen, Node klicken um die Notiz zu öffnen"}
      </div>
    </div>
  );
}
