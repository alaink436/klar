"use client";

// The Obsidian-style AI-Brain viewer. Three panes:
//   left   — search + collapsible folder tree (built from the graph paths)
//   centre — the interactive graph, or the open note rendered as markdown
//   right  — notes linked to the open note (graph neighbours)
//
// Wikilinks ([[Note]] / [[Note|alias]]) and relative .md links are resolved
// against the in-memory path index and open in-app. Note bodies are fetched
// on demand from `noteApi` (a server route that holds the GitHub token and
// re-checks folder scope). Raw HTML in notes is NOT rendered (react-markdown
// default), so note content can't inject scripts.

import { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import InteractiveGraph from "./InteractiveGraph";
import type { ScopedGraph, RawNode } from "@/lib/brainVault";

const stemOf = (p: string) =>
  (p.split("/").pop() ?? p).replace(/\.md$/i, "").toLowerCase();

type TreeNode = {
  name: string;
  path?: string;
  children: Map<string, TreeNode>;
};

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

const MD_CSS = `
.brain-md{color:var(--fg-2);font-size:14px;line-height:1.7;word-break:break-word}
.brain-md h1,.brain-md h2,.brain-md h3,.brain-md h4{color:var(--fg);font-family:var(--font-display),sans-serif;font-weight:700;line-height:1.2;margin:1.6em 0 .5em}
.brain-md h1{font-size:1.7em;margin-top:0}
.brain-md h2{font-size:1.35em}
.brain-md h3{font-size:1.12em}
.brain-md h4{font-size:1em}
.brain-md p{margin:.7em 0}
.brain-md ul,.brain-md ol{margin:.6em 0;padding-left:1.4em}
.brain-md li{margin:.25em 0}
.brain-md a{color:#74D6C4;text-decoration:none;border-bottom:1px solid color-mix(in oklab,#74D6C4,transparent 60%)}
.brain-md a:hover{border-bottom-color:#74D6C4}
.brain-md a.wiki-dead{color:var(--fg-3);border-bottom:1px dashed var(--fg-4);cursor:help}
.brain-md code{font-family:var(--font-mono),monospace;font-size:.88em;background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:.1em .35em}
.brain-md pre{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow:auto;margin:1em 0}
.brain-md pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.55}
.brain-md blockquote{border-left:2px solid var(--line-strong);margin:1em 0;padding:.2em 0 .2em 1em;color:var(--fg-3)}
.brain-md hr{border:none;border-top:1px solid var(--line);margin:1.6em 0}
.brain-md table{border-collapse:collapse;margin:1em 0;font-size:.9em;display:block;overflow-x:auto}
.brain-md th,.brain-md td{border:1px solid var(--line);padding:6px 10px;text-align:left}
.brain-md th{background:var(--bg-2);color:var(--fg);font-weight:600}
.brain-md img{max-width:100%;border-radius:8px}
.brain-md input[type=checkbox]{margin-right:.5em}
`;

function preprocess(src: string): string {
  // strip a leading YAML frontmatter block
  let s = src.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  // [[target|alias]] / [[target]]  ->  [alias](wiki:target)
  s = s.replace(/\[\[([^\]]+?)\]\]/g, (_m, inner: string) => {
    const [rawTarget, alias] = inner.split("|");
    const target = rawTarget.split("#")[0].trim();
    const label = (alias ?? rawTarget).trim();
    return `[${label}](wiki:${encodeURIComponent(target)})`;
  });
  return s;
}

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
    // lowercased full-path (with + without .md) and bare-stem lookups
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
  const [note, setNote] = useState<{
    text: string;
    name: string;
    loading: boolean;
    error: string | null;
  }>({ text: "", name: "", loading: false, error: null });
  const [query, setQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"files" | "main">("main");

  const openNote = useCallback(
    async (path: string) => {
      setOpenPath(path);
      setMobilePane("main");
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
    [noteApi]
  );

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
    [resolveIndex]
  );

  const md = useMemo(() => preprocess(note.text), [note.text]);

  const connected = useMemo(() => {
    if (!openPath) return [] as RawNode[];
    const i = pathIdx.get(openPath);
    if (i === undefined) return [];
    return (adjacency[i] ?? [])
      .map((j) => nodes[j])
      .sort((a, b) => b.r - a.r);
  }, [openPath, pathIdx, adjacency, nodes]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as RawNode[];
    return nodes
      .filter((n) => n.l.toLowerCase().includes(q) || n.p.toLowerCase().includes(q))
      .slice(0, 60);
  }, [query, nodes]);

  const renderTree = (node: TreeNode, depth = 0): React.ReactNode =>
    sortedChildren(node).map((child) => {
      if (child.path) {
        const isActive = child.path === openPath;
        return (
          <button
            key={child.path}
            onClick={() => openNote(child.path!)}
            title={child.path}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "4px 8px",
              paddingLeft: 8 + depth * 12,
              fontSize: 13,
              color: isActive ? "var(--fg)" : "var(--fg-2)",
              background: isActive ? "color-mix(in oklab, var(--fg), transparent 90%)" : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {stemOf(child.path)}
          </button>
        );
      }
      return (
        <details key={child.name} open={depth === 0}>
          <summary
            style={{
              padding: "4px 8px",
              paddingLeft: 8 + depth * 12,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fg-3)",
              cursor: "pointer",
              listStyle: "none",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.02em",
            }}
          >
            {child.name}
          </summary>
          {renderTree(child, depth + 1)}
        </details>
      );
    });

  const FileNav = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Notizen suchen…"
        style={{
          width: "100%",
          padding: "9px 12px",
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          color: "var(--fg)",
          fontSize: 13,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {query.trim() ? (
          results.length === 0 ? (
            <p style={{ color: "var(--fg-3)", fontSize: 13, padding: "6px 8px" }}>Keine Treffer.</p>
          ) : (
            results.map((n) => (
              <button
                key={n.p}
                onClick={() => openNote(n.p)}
                title={n.p}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  fontSize: 13,
                  color: n.p === openPath ? "var(--fg)" : "var(--fg-2)",
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.l}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.p}
                </span>
              </button>
            ))
          )
        ) : (
          renderTree(tree)
        )}
      </div>
    </div>
  );

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: MD_CSS }} />

      {/* mobile pane toggle */}
      <div className="flex lg:hidden" style={{ gap: 8, padding: "0 0 10px" }}>
        {(["files", "main"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            style={{
              flex: 1,
              padding: "8px 10px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: mobilePane === p ? "var(--fg)" : "var(--bg-2)",
              color: mobilePane === p ? "var(--bg)" : "var(--fg-2)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {p === "files" ? "Dateien" : openPath ? "Notiz" : "Graph"}
          </button>
        ))}
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px]"
        style={{ gap: 16, flex: 1, minHeight: 0 }}
      >
        {/* left: files */}
        <div
          className={mobilePane === "files" ? "block" : "hidden lg:block"}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 12,
            background: "color-mix(in oklab, var(--fg), transparent 97%)",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            maxHeight: "100%",
          }}
        >
          {FileNav}
        </div>

        {/* centre: graph or note */}
        <div
          className={mobilePane === "main" ? "block" : "hidden lg:block"}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "var(--bg-2)",
            overflow: "hidden",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* tab strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
            }}
          >
            <button
              onClick={() => setOpenPath(null)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: openPath === null ? "var(--fg)" : "transparent",
                color: openPath === null ? "var(--bg)" : "var(--fg-2)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
              }}
            >
              Graph
            </button>
            {openPath && (
              <span style={{ color: "var(--fg)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {note.name || openPath.split("/").pop()}
              </span>
            )}
            <span style={{ marginLeft: "auto", color: "var(--fg-4)", fontSize: 11, fontFamily: "var(--font-mono), monospace" }}>
              {counts.nodes} Notizen · {counts.edges} Links
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {openPath === null ? (
              <InteractiveGraph
                nodes={nodes}
                edges={edges}
                groups={groups}
                activePath={openPath}
                onOpen={openNote}
              />
            ) : (
              <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
                {note.loading ? (
                  <p style={{ color: "var(--fg-3)" }}>Lade…</p>
                ) : note.error ? (
                  <p style={{ color: "#e88" }}>{note.error}</p>
                ) : (
                  <article className="brain-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {md}
                    </ReactMarkdown>
                  </article>
                )}
              </div>
            )}
          </div>
        </div>

        {/* right: linked notes */}
        <div
          className="hidden lg:flex"
          style={{
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: 12,
            background: "color-mix(in oklab, var(--fg), transparent 97%)",
            flexDirection: "column",
            gap: 8,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: "var(--fg-4)",
              fontFamily: "var(--font-mono), monospace",
              padding: "2px 4px",
            }}
          >
            {openPath ? `Verknüpft (${connected.length})` : "Verknüpfte Notizen"}
          </div>
          <div style={{ overflowY: "auto", minHeight: 0 }}>
            {!openPath ? (
              <p style={{ color: "var(--fg-3)", fontSize: 13, padding: "4px" }}>
                {scopeLabel ?? "Öffne eine Notiz, um ihre Verbindungen zu sehen."}
              </p>
            ) : connected.length === 0 ? (
              <p style={{ color: "var(--fg-3)", fontSize: 13, padding: "4px" }}>Keine Verbindungen.</p>
            ) : (
              connected.map((n) => (
                <button
                  key={n.p}
                  onClick={() => openNote(n.p)}
                  title={n.p}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    fontSize: 13,
                    color: "var(--fg-2)",
                    background: "transparent",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 8, flexShrink: 0, background: groups[n.g]?.color ?? "#9aa0b0" }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.l}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
