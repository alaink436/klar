"use client";
import { useRef, useState } from "react";

// The real vault, as a living map. Every node is an actual file or folder in
// the seller's ai-brain repo; edges are the references the rituals create.
// Drag nodes, hover to trace connections, click for what each piece does.

const NODES = [
  { id: "claude", label: "CLAUDE.md", x: 360, y: 92, r: 34, kind: "hub", info: "The rule set. Loaded by the agent at the start of every session; every word costs context, so it stays lean." },
  { id: "status", label: "STATUS.md", x: 208, y: 190, r: 30, kind: "hub", info: "One dashboard row per project, hard-capped at 200 characters. First thing read in the lookup ritual." },
  { id: "index", label: "Learnings/INDEX.md", x: 520, y: 196, r: 30, kind: "hub", info: "254 entries. Grepped BEFORE any trial-and-error, so past mistakes become rules instead of repeats." },
  { id: "registry", label: "00-Registry.md", x: 116, y: 300, r: 22, kind: "hub", info: "Project ↔ code path ↔ repo. How the agent knows where anything lives." },
  { id: "trubel", label: "app 01", x: 96, y: 402, r: 17, kind: "app", info: "A shipped iOS app. Its PRD and PROGRESS live here: 80 lines maximum, compressed on every update." },
  { id: "kelva", label: "app 02", x: 186, y: 428, r: 17, kind: "app", info: "Same convention for every project: PRD for what it is, PROGRESS for where it stands." },
  { id: "myloo", label: "app 03", x: 278, y: 442, r: 17, kind: "app", info: "Every substantial session ends with this project's dashboard row touched." },
  { id: "yarn", label: "app 04", x: 372, y: 438, r: 17, kind: "app", info: "One of 40 projects tracked in the vault." },
  { id: "anime", label: "app 05", x: 462, y: 420, r: 17, kind: "app", info: "A shipped app whose content pipeline runs fully automatically, planned from inside the vault." },
  { id: "promillio", label: "app 06", x: 544, y: 390, r: 17, kind: "app", info: "Seven of these made it to the App Store, all run by one person." },
  { id: "moto", label: "app 07", x: 610, y: 344, r: 17, kind: "app", info: "Same folder skeleton as every other project." },
  { id: "tech", label: "tech-stack.md", x: 456, y: 288, r: 19, kind: "cat", info: "Learnings category: framework and platform scars. Written FIRST, indexed second, never the other way." },
  { id: "tooling", label: "tooling.md", x: 588, y: 260, r: 19, kind: "cat", info: "Learnings category: CLI traps, silent failures, encoding disasters." },
  { id: "workflow", label: "workflow.md", x: 560, y: 130, r: 19, kind: "cat", info: "Learnings category: how sessions, agents and rituals actually behave." },
  { id: "council", label: "llm-council", x: 236, y: 96, r: 21, kind: "skill", info: "The adversarial 5-advisor review. Loaded on demand, never auto: skills in auto-load folders tax every session." },
  { id: "proxy", label: "vault-proxy", x: 462, y: 60, r: 21, kind: "skill", info: "The use-but-don't-see secrets setup. Agents call APIs through it without ever reading a key. Try it below." },
];

// The three edges marked `ritual` are the lookup order every session follows:
// rules to dashboard, dashboard to registry, registry to the learnings index.
// They pulse on a loop so the graph shows a habit, not just a structure.
const EDGES = [
  ["claude", "status", "ritual"], ["status", "registry", "ritual r2"], ["registry", "index", "ritual r3"],
  ["claude", "index"], ["claude", "council"], ["claude", "proxy"],
  ["status", "trubel"], ["status", "kelva"], ["status", "myloo"],
  ["status", "yarn"], ["status", "anime"], ["status", "promillio"], ["status", "moto"],
  ["registry", "trubel"], ["registry", "kelva"],
  ["index", "tech"], ["index", "tooling"], ["index", "workflow"],
  ["trubel", "index"], ["myloo", "index"], ["anime", "index"], ["yarn", "tech"],
  ["kelva", "tech"], ["promillio", "tooling"], ["moto", "tooling"],
  ["council", "status"], ["proxy", "index"], ["claude", "workflow"],
];

export default function BrainGraph({ compact = false }) {
  const [pos, setPos] = useState(() => Object.fromEntries(NODES.map((n) => [n.id, { x: n.x, y: n.y }])));
  const [active, setActive] = useState(null); // hovered or dragged node id
  const [pinned, setPinned] = useState("claude"); // clicked node -> info card
  const drag = useRef(null);
  const svgRef = useRef(null);

  const toSvg = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 720,
      y: ((e.clientY - rect.top) / rect.height) * 500,
    };
  };

  const onDown = (id) => (e) => {
    e.preventDefault();
    const p = toSvg(e);
    drag.current = { id, dx: pos[id].x - p.x, dy: pos[id].y - p.y };
    setActive(id);
    setPinned(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = toSvg(e);
    const { id, dx, dy } = drag.current;
    setPos((prev) => ({
      ...prev,
      [id]: {
        x: Math.max(30, Math.min(690, p.x + dx)),
        y: Math.max(30, Math.min(470, p.y + dy)),
      },
    }));
  };
  const onUp = () => { drag.current = null; };

  const neighbors = (id) =>
    new Set(EDGES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])));
  const activeSet = active ? neighbors(active) : null;
  const info = NODES.find((n) => n.id === pinned);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 720 500"
        className="graph"
        onPointerMove={compact ? undefined : onMove}
        onPointerUp={compact ? undefined : onUp}
        onPointerLeave={compact ? undefined : onUp}
        style={compact ? { pointerEvents: "none" } : undefined}
        role="img"
        aria-label="Interactive map of the vault: rules, dashboard, learnings index, projects and skills, all connected"
      >
        {EDGES.map(([a, b, kind], i) => {
          const dim = active && active !== a && active !== b;
          const hot = active && (active === a || active === b);
          return (
            <line
              key={i}
              x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y}
              className={`gedge${kind ? " " + kind : ""}${hot ? " hot" : ""}${dim ? " dim" : ""}`}
            />
          );
        })}
        {NODES.map((n) => {
          const p = pos[n.id];
          const dim = active && active !== n.id && !activeSet?.has(n.id);
          return (
            <g
              key={n.id}
              className={`gnode k-${n.kind}${dim ? " dim" : ""}${pinned === n.id ? " pinned" : ""}`}
              transform={`translate(${p.x} ${p.y})`}
              onPointerDown={compact ? undefined : onDown(n.id)}
              onPointerEnter={compact ? undefined : () => !drag.current && setActive(n.id)}
              onPointerLeave={compact ? undefined : () => !drag.current && setActive(null)}
            >
              <circle r={n.r} />
              <text y={n.r + 15}>{n.label}</text>
            </g>
          );
        })}
      </svg>
      {compact ? null : (
      <>
      <div className="ginfo">
        <b>{info.label}</b>
        <span>{info.info}</span>
      </div>
      <div className="ginfo" style={{ display: "block" }}>
        <div className="gkey">
          <span><i className="hub" />rules and indexes</span>
          <span><i className="app" />projects</span>
          <span><i className="cat" />learning categories</span>
          <span><i className="skill" />skills, loaded on demand</span>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
