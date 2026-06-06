"use client";

// The Obsidian-style AI-Brain viewer, redesigned. Three panes:
//   left   — ⌘K search button + collapsible folder tree (built from graph paths)
//   centre — the React Flow graph, or the open note rendered as markdown
//   right  — notes linked to the open note (graph neighbours)
//
// Plus a cmdk command palette (⌘K) to jump to any note. Wikilinks
// ([[Note]] / [[Note|alias]]) and relative .md links resolve against the
// in-memory path index and open in-app. Note bodies are fetched on demand from
// `noteApi` (a server route that holds the GitHub token + re-checks scope).
// Raw HTML in notes is not rendered, so note content can't inject scripts.

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Command } from "cmdk";
import InteractiveGraph, { colorForGroup } from "./InteractiveGraph";
import type { ScopedGraph, RawNode } from "@/lib/brainVault";

const stemOf = (p: string) =>
  (p.split("/").pop() ?? p).replace(/\.md$/i, "").toLowerCase();

type TreeNode = { name: string; path?: string; children: Map<string, TreeNode> };

function buildTree(nodes: RawNode[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  for (const n of nodes) {
    const parts = n.p.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      let child = cur.children.get(part);
      if (!child) {
        child = { name: part, children: new Map() };
        cur.children.set(part, child);
      }
      if (isFile) child.path = n.p;
      cur = child;
    }
  }
  return root;
}

function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aDir = a.path === undefined;
    const bDir = b.path === undefined;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function preprocess(src: string): string {
  let s = src.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  s = s.replace(/\[\[([^\]]+?)\]\]/g, (_m, inner: string) => {
    const [rawTarget, alias] = inner.split("|");
    const target = rawTarget.split("#")[0].trim();
    const label = (alias ?? rawTarget).trim();
    return `[${label}](wiki:${encodeURIComponent(target)})`;
  });
  return s;
}

// Token-based styling. Surfaces/lines/text fall back to the marketing tokens
// (--bg-2 …) when the admin STYLE tokens (--surface …) aren't present, so it
// looks right in both /admin/brain and the public /brain viewer. The teal
// --bx-accent keeps the brain's own identity regardless of host theme.
const BX_CSS = `
.bx{--bx-accent:#74D6C4;--bx-surface:var(--surface,var(--bg-2,#111));--bx-surface-2:var(--surface-2,var(--bg-2,#181818));--bx-radius:var(--radius,12px);display:flex;flex-direction:column;height:100%;min-height:0}
.bx-grid{display:grid;grid-template-columns:1fr;gap:14px;flex:1;min-height:0}
@media(min-width:1024px){.bx-grid{grid-template-columns:264px 1fr 248px}}
.bx-pane{border:1px solid var(--line);border-radius:var(--bx-radius);background:var(--bx-surface);min-height:0;display:flex;flex-direction:column;overflow:hidden}
.bx-pane-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);font-family:var(--font-mono),monospace;font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-4)}
.bx-pane-head .bx-count{margin-left:auto;color:var(--fg-4);font-variant-numeric:tabular-nums}
.bx-pane-body{flex:1;min-height:0;overflow-y:auto;padding:8px}

/* ⌘K trigger button in the left pane */
.bx-cmdk-btn{display:flex;align-items:center;gap:8px;width:calc(100% - 16px);margin:8px;padding:9px 12px;background:var(--bx-surface-2);border:1px solid var(--line);border-radius:8px;color:var(--fg-3);font-size:13px;cursor:pointer;transition:border-color .15s,color .15s}
.bx-cmdk-btn:hover{border-color:var(--line-strong);color:var(--fg-2)}
.bx-cmdk-btn .kbd{margin-left:auto;font-family:var(--font-mono),monospace;font-size:10px;border:1px solid var(--line-strong);border-radius:5px;padding:2px 6px;color:var(--fg-4)}

/* folder tree */
.bx-file,.bx-sum{display:block;width:100%;text-align:left;border:0;background:transparent;cursor:pointer;border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit}
.bx-file{padding:5px 9px;font-size:13px;color:var(--fg-2);transition:background .12s,color .12s}
.bx-file:hover{background:var(--bx-surface-2);color:var(--fg)}
.bx-file.on{background:color-mix(in oklab,var(--bx-accent) 16%,transparent);color:var(--fg)}
.bx-sum{padding:5px 9px;font-size:12px;font-weight:600;color:var(--fg-3);list-style:none;font-family:var(--font-mono),monospace;letter-spacing:.02em}
.bx-sum::-webkit-details-marker{display:none}
.bx-sum::before{content:"▸";display:inline-block;width:12px;color:var(--fg-4);transition:transform .12s}
details[open]>.bx-sum::before{transform:rotate(90deg)}

/* centre: tab strip + reader */
.bx-tabs{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
.bx-tab{padding:5px 12px;border-radius:7px;border:1px solid var(--line);background:transparent;color:var(--fg-3);cursor:pointer;font-family:inherit;font-size:12px;display:inline-flex;align-items:center;gap:6px;transition:background .15s,color .15s}
.bx-tab:hover{background:var(--bx-surface-2);color:var(--fg-2)}
.bx-tab.on{background:var(--fg);color:var(--bx-surface);border-color:var(--fg)}
.bx-title{font-family:var(--font-display),sans-serif;font-weight:700;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}
.bx-meta{margin-left:auto;color:var(--fg-4);font-size:11px;font-family:var(--font-mono),monospace;white-space:nowrap}
.bx-reader{height:100%;overflow-y:auto;padding:28px 32px}
.bx-reader-crumb{font-family:var(--font-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-4);margin-bottom:14px}

/* right: linked notes */
.bx-link{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:transparent;border-radius:7px;padding:7px 9px;font-size:13px;color:var(--fg-2);cursor:pointer;transition:background .12s,color .12s}
.bx-link:hover{background:var(--bx-surface-2);color:var(--fg)}
.bx-link .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.bx-link span.l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bx-empty{color:var(--fg-3);font-size:13px;padding:8px 10px;line-height:1.5}

/* mobile pane toggle + responsive pane visibility */
.bx-mtoggle{display:flex;gap:8px;padding:0 0 12px}
.bx-mtoggle button{flex:1;padding:8px 10px;font-size:13px;border-radius:8px;border:1px solid var(--line);background:var(--bx-surface-2);color:var(--fg-2);cursor:pointer;font-family:inherit}
.bx-mtoggle button.on{background:var(--fg);color:var(--bx-surface);border-color:var(--fg)}
@media(min-width:1024px){.bx-mtoggle{display:none}}
@media(max-width:1023px){
  .bx-grid [data-pane="links"]{display:none}
  .bx-grid[data-mobile="files"] [data-pane="main"]{display:none}
  .bx-grid[data-mobile="main"] [data-pane="files"]{display:none}
}

/* cmdk command palette (portals to <body>, so these rules are unscoped) */
[cmdk-overlay]{position:fixed;inset:0;background:rgba(6,6,8,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:120}
[cmdk-dialog]{position:fixed;top:14%;left:50%;transform:translateX(-50%);width:min(580px,92vw);z-index:121}
.bx-cmdk{background:var(--bx-surface);border:1px solid var(--line-strong);border-radius:14px;box-shadow:0 30px 90px -20px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.05) inset;overflow:hidden}
.bx-cmdk [cmdk-input]{width:100%;padding:16px 18px;background:transparent;border:0;border-bottom:1px solid var(--line);color:var(--fg);font-size:15px;font-family:inherit;outline:none}
.bx-cmdk [cmdk-input]::placeholder{color:var(--fg-4)}
.bx-cmdk [cmdk-list]{max-height:360px;overflow:auto;padding:8px;scroll-padding:8px}
.bx-cmdk [cmdk-empty]{padding:20px;text-align:center;color:var(--fg-3);font-size:13px}
.bx-cmdk-item{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:8px;cursor:pointer}
.bx-cmdk-item[data-selected="true"]{background:color-mix(in oklab,var(--bx-accent) 16%,transparent)}
.bx-cmdk-item .l{font-size:14px;color:var(--fg)}
.bx-cmdk-item .p{font-size:11px;color:var(--fg-4);font-family:var(--font-mono),monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* markdown reader */
.brain-md{color:var(--fg-2);font-size:14.5px;line-height:1.72;word-break:break-word;max-width:74ch}
.brain-md h1,.brain-md h2,.brain-md h3,.brain-md h4{color:var(--fg);font-family:var(--font-display),sans-serif;font-weight:700;line-height:1.2;margin:1.6em 0 .5em}
.brain-md h1{font-size:1.8em;margin-top:0;letter-spacing:-.02em}
.brain-md h2{font-size:1.38em}
.brain-md h3{font-size:1.14em}
.brain-md h4{font-size:1em}
.brain-md p{margin:.7em 0}
.brain-md ul,.brain-md ol{margin:.6em 0;padding-left:1.4em}
.brain-md li{margin:.25em 0}
.brain-md a{color:var(--bx-accent,#74D6C4);text-decoration:none;border-bottom:1px solid color-mix(in oklab,#74D6C4,transparent 60%)}
.brain-md a:hover{border-bottom-color:#74D6C4}
.brain-md a.wiki-dead{color:var(--fg-3);border-bottom:1px dashed var(--fg-4);cursor:help}
.brain-md code{font-family:var(--font-mono),monospace;font-size:.86em;background:var(--bx-surface-2);border:1px solid var(--line);border-radius:4px;padding:.1em .35em}
.brain-md pre{background:var(--bx-surface-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow:auto;margin:1em 0}
.brain-md pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.55}
.brain-md blockquote{border-left:2px solid var(--bx-accent);margin:1em 0;padding:.2em 0 .2em 1em;color:var(--fg-3)}
.brain-md hr{border:none;border-top:1px solid var(--line);margin:1.6em 0}
.brain-md table{border-collapse:collapse;margin:1em 0;font-size:.9em;display:block;overflow-x:auto}
.brain-md th,.brain-md td{border:1px solid var(--line);padding:6px 10px;text-align:left}
.brain-md th{background:var(--bx-surface-2);color:var(--fg);font-weight:600}
.brain-md img{max-width:100%;border-radius:8px}
.brain-md input[type=checkbox]{margin-right:.5em}
`;

export default function BrainExplorer({
  graph,
  noteApi,
  scopeLabel,
}: {
  graph: ScopedGraph;
  noteApi: string;
  scopeLabel?: string;
}) {
  const { nodes, edges, groups, counts } = graph;

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const pathIdx = useMemo(() => {
    const m = new Map<string, number>();
    nodes.forEach((n, i) => m.set(n.p, i));
    return m;
  }, [nodes]);
  const resolveIndex = useMemo(() => {
    const full = new Map<string, string>();
    const stem = new Map<string, string>();
    for (const n of nodes) {
      full.set(n.p.toLowerCase(), n.p);
      full.set(n.p.toLowerCase().replace(/\.md$/, ""), n.p);
      const s = stemOf(n.p);
      if (!stem.has(s)) stem.set(s, n.p);
    }
    return { full, stem };
  }, [nodes]);
  const adjacency = useMemo(() => {
    const adj: number[][] = nodes.map(() => []);
    for (const [a, b] of edges) {
      adj[a]?.push(b);
      adj[b]?.push(a);
    }
    return adj;
  }, [nodes, edges]);

  const [openPath, setOpenPath] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; name: string; loading: boolean; error: string | null }>({
    text: "",
    name: "",
    loading: false,
    error: null,
  });
  const [mobilePane, setMobilePane] = useState<"files" | "main">("main");
  const [cmdOpen, setCmdOpen] = useState(false);

  const openNote = useCallback(
    async (path: string) => {
      setOpenPath(path);
      setMobilePane("main");
      setCmdOpen(false);
      setNote({ text: "", name: path.split("/").pop() ?? path, loading: true, error: null });
      try {
        const res = await fetch(`${noteApi}?path=${encodeURIComponent(path)}`);
        if (!res.ok) {
          setNote({ text: "", name: "", loading: false, error: `Fehler ${res.status}` });
          return;
        }
        const data = (await res.json()) as { text: string; name: string };
        setNote({ text: data.text, name: data.name, loading: false, error: null });
      } catch {
        setNote({ text: "", name: "", loading: false, error: "Netzwerkfehler" });
      }
    },
    [noteApi],
  );

  // ⌘K / Ctrl-K toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const resolveLink = useCallback(
    (target: string): string | null => {
      const t = target.trim().replace(/\\/g, "/");
      const lower = t.toLowerCase();
      return (
        resolveIndex.full.get(lower) ??
        resolveIndex.full.get(lower.replace(/\.md$/, "")) ??
        resolveIndex.stem.get(stemOf(t.endsWith(".md") ? t : t + ".md")) ??
        null
      );
    },
    [resolveIndex],
  );

  const md = useMemo(() => preprocess(note.text), [note.text]);

  const connected = useMemo(() => {
    if (!openPath) return [] as RawNode[];
    const i = pathIdx.get(openPath);
    if (i === undefined) return [];
    return (adjacency[i] ?? []).map((j) => nodes[j]).sort((a, b) => b.r - a.r);
  }, [openPath, pathIdx, adjacency, nodes]);

  const renderTree = (node: TreeNode, depth = 0): React.ReactNode =>
    sortedChildren(node).map((child) => {
      if (child.path) {
        const isActive = child.path === openPath;
        return (
          <button
            key={child.path}
            className={`bx-file${isActive ? " on" : ""}`}
            onClick={() => openNote(child.path!)}
            title={child.path}
            style={{ paddingLeft: 9 + depth * 12 }}
          >
            {stemOf(child.path)}
          </button>
        );
      }
      return (
        <details key={child.name} open={depth === 0}>
          <summary className="bx-sum" style={{ paddingLeft: 9 + depth * 12 }}>
            {child.name}
          </summary>
          {renderTree(child, depth + 1)}
        </details>
      );
    });

  const mdComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      const h = href ?? "";
      if (/^(https?:|mailto:)/i.test(h)) {
        return (
          <a href={h} target="_blank" rel="noreferrer">
            {children}
          </a>
        );
      }
      let target: string | null = null;
      if (h.startsWith("wiki:")) target = decodeURIComponent(h.slice(5));
      else if (h && !h.startsWith("#")) target = h;
      if (target) {
        const path = resolveLink(target);
        if (path) {
          return (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openNote(path);
              }}
            >
              {children}
            </a>
          );
        }
        return (
          <span className="wiki-dead" title="Notiz nicht im Vault gefunden">
            {children}
          </span>
        );
      }
      return <span>{children}</span>;
    },
  };

  return (
    <div className="bx">
      <style dangerouslySetInnerHTML={{ __html: BX_CSS }} />

      {/* command palette */}
      <Command.Dialog open={cmdOpen} onOpenChange={setCmdOpen} label="Notiz suchen" className="bx-cmdk">
        <Command.Input placeholder="Notiz suchen…" autoFocus />
        <Command.List>
          <Command.Empty>Keine Treffer.</Command.Empty>
          {nodes.map((n) => (
            <Command.Item
              key={n.p}
              value={`${n.l} ${n.p}`}
              onSelect={() => openNote(n.p)}
              className="bx-cmdk-item"
            >
              <span className="l">{n.l}</span>
              <span className="p">{n.p}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>

      {/* mobile pane toggle */}
      <div className="bx-mtoggle">
        {(["files", "main"] as const).map((p) => (
          <button key={p} className={mobilePane === p ? "on" : ""} onClick={() => setMobilePane(p)}>
            {p === "files" ? "Dateien" : openPath ? "Notiz" : "Graph"}
          </button>
        ))}
      </div>

      <div className="bx-grid" data-mobile={mobilePane}>
        {/* left: search + tree */}
        <div className="bx-pane" data-pane="files">
          <div className="bx-pane-head">Vault<span className="bx-count">{counts.nodes}</span></div>
          <button className="bx-cmdk-btn" onClick={() => setCmdOpen(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            Notizen suchen…
            <span className="kbd">⌘K</span>
          </button>
          <div className="bx-pane-body">{renderTree(tree)}</div>
        </div>

        {/* centre: graph or note */}
        <div className="bx-pane" data-pane="main">
          <div className="bx-tabs">
            <button className={`bx-tab${openPath === null ? " on" : ""}`} onClick={() => setOpenPath(null)}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2" /><circle cx="19" cy="8" r="2" /><circle cx="12" cy="17" r="2" /><path d="M7 7l3.5 8.5M17 9.5L13 16" /></svg>
              Graph
            </button>
            {openPath && <span className="bx-title">{note.name || openPath.split("/").pop()}</span>}
            <span className="bx-meta">{counts.nodes} Notizen · {counts.edges} Links</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {openPath === null ? (
              <InteractiveGraph nodes={nodes} edges={edges} groups={groups} activePath={openPath} onOpen={openNote} />
            ) : (
              <div className="bx-reader">
                {note.loading ? (
                  <p style={{ color: "var(--fg-3)" }}>Lade…</p>
                ) : note.error ? (
                  <p style={{ color: "var(--danger,#e88)" }}>{note.error}</p>
                ) : (
                  <>
                    <div className="bx-reader-crumb">{openPath}</div>
                    <article className="brain-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {md}
                      </ReactMarkdown>
                    </article>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* right: linked notes */}
        <div className="bx-pane" data-pane="links">
          <div className="bx-pane-head">
            {openPath ? "Verknüpft" : "Verbindungen"}
            {openPath && <span className="bx-count">{connected.length}</span>}
          </div>
          <div className="bx-pane-body">
            {!openPath ? (
              <p className="bx-empty">{scopeLabel ?? "Öffne eine Notiz, um ihre Verbindungen zu sehen."}</p>
            ) : connected.length === 0 ? (
              <p className="bx-empty">Keine Verbindungen.</p>
            ) : (
              connected.map((n) => (
                <button key={n.p} className="bx-link" onClick={() => openNote(n.p)} title={n.p}>
                  <span className="dot" style={{ background: colorForGroup(groups[n.g]) }} />
                  <span className="l">{n.l}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
