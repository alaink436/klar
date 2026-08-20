// Shared server-side access layer for the AI-Brain vault.
//
// One source of truth for: which folders may ever be shown, how a per-user
// folder scope filters the build-baked graph, and how a single note's
// markdown is fetched live from the private GitHub repo. The GitHub token
// lives here and never reaches the client.
//
// Used by both the Supabase-gated /brain viewer (external brain-members)
// and the 2FA-gated /admin/brain view (full admin). Each caller does its
// own auth, then asks this module for scoped data.
//
// Env: BRAIN_GITHUB_TOKEN (fine-grained PAT, repo alaink436/AI-Brain,
// Contents: Read).

import graph from "@/app/data/brainGraph.json";

const REPO = "alaink436/AI-Brain";
const BRANCH = "master";
const TOKEN = process.env.BRAIN_GITHUB_TOKEN ?? "";

// Folders that must NEVER surface on any web surface, regardless of a
// member's scope. brainGraph.json already omits these (gen-brain-graph.py
// SKIP_DIRS), but fetchNote() also refuses them so a hand-crafted path can
// never pull a secret note through the proxy.
export const HIDDEN_FOLDERS = ["Secrets", "Credentials"] as const;

// Synthetic folder key for top-level notes (CLAUDE.md, STATUS.md, ...).
export const ROOT_KEY = "_root";

export type RawNode = {
  x: number;
  y: number;
  r: number;
  g: number;
  c: number;
  l: string;
  p: string;
  /** 1 = Ordnerknoten aus dem Baum, keine Notiz. Nicht oeffenbar. */
  d?: number;
};

/** [a, b] ist ein Wikilink, [a, b, 1] eine Kante des Ordnerbaums. */
export type RawEdge = [number, number] | [number, number, number];
export type Group = { key: string; label: string; color: string; count: number };
export type Counts = { nodes: number; edges: number; linked: number };

export type ScopedGraph = {
  nodes: RawNode[];
  edges: RawEdge[];
  groups: Group[];
  counts: Counts;
};

const ALL_NODES = graph.nodes as RawNode[];
const ALL_EDGES = graph.edges as RawEdge[];
const ALL_GROUPS = graph.groups as Group[];

// Top-level folder a vault path belongs to ("Projects/Klar/PROGRESS.md" ->
// "Projects"; "STATUS.md" -> "_root").
export function topFolder(path: string): string {
  const clean = path.replace(/^\/+/, "");
  const i = clean.indexOf("/");
  return i === -1 ? ROOT_KEY : clean.slice(0, i);
}

function isHidden(path: string): boolean {
  const f = topFolder(path);
  return (HIDDEN_FOLDERS as readonly string[]).includes(f);
}

// Every top-level folder present in the (already secret-free) graph, with
// its display label + colour + note count. Drives the invite folder picker.
export function availableFolders(): Group[] {
  return ALL_GROUPS.slice().sort((a, b) => b.count - a.count);
}

// A sensible default-checked subset for a new brain-only invite.
export const SHOWCASE_FOLDERS = [
  "Projects",
  "Learnings",
  "Design-Systems",
  "Skills",
  "Research",
];

// Filter the build-baked graph down to a member's allowed top-level folders.
// `allowed === null` means full access (all non-secret folders). Node indices
// are renumbered and edges remapped so the client gets a self-consistent
// graph. Group counts are recomputed so the legend matches what's shown.
export function scopeGraph(allowed: string[] | null): ScopedGraph {
  const allow = (path: string) => {
    if (isHidden(path)) return false;
    if (allowed === null) return true;
    return allowed.includes(topFolder(path));
  };

  const oldToNew = new Map<number, number>();
  const nodes: RawNode[] = [];
  ALL_NODES.forEach((n, i) => {
    if (!allow(n.p)) return;
    oldToNew.set(i, nodes.length);
    nodes.push(n);
  });

  const edges: RawEdge[] = [];
  for (const e of ALL_EDGES) {
    const na = oldToNew.get(e[0]);
    const nb = oldToNew.get(e[1]);
    if (na === undefined || nb === undefined) continue;
    // Den Baum-Marker mitnehmen, sonst wird jede Baumkante beim Zuschneiden
    // zu einem Wikilink und der Client zeichnet sie zu kraeftig.
    edges.push(e.length > 2 ? [na, nb, e[2] as number] : [na, nb]);
  }

  // Recompute per-group counts from the surviving nodes, then renumber the
  // nodes' `g` alongside the filtered legend.
  //
  // The previous comment here claimed the g-index stayed stable because nodes
  // keep their original `g`. It does not: .filter() re-indexes, so as soon as
  // one group loses all its nodes, every later group shifts down by one while
  // the nodes still point at the old slot. The consumer indexes straight into
  // it (InteractiveGraph: colorForGroup(groups[n.g])), so a folder-scoped
  // member saw one group painted in another's colour and the last group fell
  // through to the default. Silent: no crash, no warning, and invisible to the
  // admin because scopeGraph(null) keeps all groups and the indices line up.
  const counts = new Array(ALL_GROUPS.length).fill(0);
  for (const n of nodes) counts[n.g] = (counts[n.g] ?? 0) + 1;

  const altZuNeu = new Map<number, number>();
  const groups: Group[] = [];
  ALL_GROUPS.forEach((g, gi) => {
    if (!counts[gi]) return;
    altZuNeu.set(gi, groups.length);
    groups.push({ ...g, count: counts[gi] });
  });
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] = { ...nodes[i], g: altZuNeu.get(nodes[i].g) ?? 0 };
  }

  const deg = new Array(nodes.length).fill(0);
  for (const [a, b] of edges) {
    deg[a]++;
    deg[b]++;
  }
  const linked = deg.filter((d) => d > 0).length;

  return {
    nodes,
    edges,
    groups,
    counts: { nodes: nodes.length, edges: edges.length, linked },
  };
}

export type NoteResult =
  | { ok: true; text: string; name: string }
  | { ok: false; status: number; error: string };

// Fetch a single note's raw markdown from the private repo. Enforces the
// secret-folder guard always, and (when `allowed` is provided) the caller's
// folder scope. Never returns the GitHub token.
export async function fetchNote(
  path: string,
  allowed: string[] | null
): Promise<NoteResult> {
  if (!TOKEN) return { ok: false, status: 503, error: "BRAIN_GITHUB_TOKEN missing" };

  const clean = path.replace(/^\/+|\/+$/g, "");
  if (!clean || !clean.toLowerCase().endsWith(".md")) {
    return { ok: false, status: 400, error: "not a note" };
  }
  if (clean.includes("..")) {
    return { ok: false, status: 400, error: "bad path" };
  }
  if (isHidden(clean)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (allowed !== null && !allowed.includes(topFolder(clean))) {
    return { ok: false, status: 403, error: "out of scope" };
  }

  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURI(clean)}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.statusText };

  const data = await res.json();
  if (Array.isArray(data)) return { ok: false, status: 400, error: "is a directory" };
  const b64 = (data.content ?? "").replace(/\n/g, "");
  const text = b64 ? Buffer.from(b64, "base64").toString("utf-8") : "";
  return { ok: true, text, name: (data.name as string) ?? clean };
}

export function hasToken(): boolean {
  return Boolean(TOKEN);
}
