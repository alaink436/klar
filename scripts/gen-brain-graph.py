"""
Brain-graph generator — the data behind the on-site Obsidian-style graph.

Scans the AI-Brain vault for notes + [[wikilinks]], runs a force layout
offline (networkx spring), and writes src/app/data/brainGraph.json. Same
build-baked philosophy as worklog.json: real structure, no runtime cost.

Run after substantial vault changes:  python scripts/gen-brain-graph.py
"""
import json
import os
import re
import math
from pathlib import Path

import networkx as nx

VAULT = Path(r"C:\Users\Alain Kessler\AI-Brain")
OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "data" / "brainGraph.json"

SKIP_DIRS = {".git", "node_modules", ".obsidian", ".trash"}
# top-level folder -> (display label, tone index into the site palette)
GROUPS = {
    "Projects": ("projects", 0),
    "Learnings": ("learnings", 1),
    "Skills": ("skills", 3),
    "Agents": ("agents", 2),
    "Design-Systems": ("design", 3),
    "Infrastructure": ("infra", 2),
    "Research": ("research", 2),
    "Templates": ("templates", 3),
    "Daily-Logs": ("logs", 3),
    "Studium": ("studium", 3),
    "_root": ("core", 0),
}
GENERIC = {"PROGRESS", "PRD", "README", "SKILL", "CLAUDE", "INDEX", "STATUS"}

WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")
MDLINK = re.compile(r"\]\(([^)]+?\.md)\)")


def top_group(rel: Path) -> str:
    parts = rel.parts
    if len(parts) == 1:
        return "_root"
    return parts[0] if parts[0] in GROUPS else parts[0]


def label_for(rel: Path) -> str:
    stem = rel.stem
    if stem.upper() in GENERIC and len(rel.parts) > 1:
        return f"{rel.parts[-2]} / {stem}"
    return stem


# ── collect notes ────────────────────────────────────────────────────────
notes = {}  # relpath(str) -> dict
stem_index = {}  # lowercased stem -> [relpath]
for root, dirs, files in os.walk(VAULT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fn in files:
        if not fn.endswith(".md"):
            continue
        p = Path(root) / fn
        rel = p.relative_to(VAULT)
        rid = str(rel).replace("\\", "/")
        grp = top_group(rel)
        if grp not in GROUPS:
            GROUPS[grp] = (grp.lower()[:10], 3)
        notes[rid] = {
            "rel": rel,
            "label": label_for(rel),
            "group": grp,
            "links": set(),
        }
        stem_index.setdefault(rel.stem.lower(), []).append(rid)

# ── parse links ──────────────────────────────────────────────────────────
for rid, n in notes.items():
    try:
        txt = (VAULT / n["rel"]).read_text(encoding="utf-8", errors="ignore")
    except OSError:
        continue
    targets = set()
    for m in WIKILINK.findall(txt):
        t = m.split("|")[0].split("#")[0].strip()
        if t:
            targets.add(Path(t).stem.lower())
    for m in MDLINK.findall(txt):
        t = Path(m.split("#")[0]).stem.lower()
        if t:
            targets.add(t)
    for t in targets:
        for cand in stem_index.get(t, []):
            if cand != rid:
                n["links"].add(cand)

# ── build graph ──────────────────────────────────────────────────────────
ids = list(notes.keys())
idx = {rid: i for i, rid in enumerate(ids)}
G = nx.Graph()
G.add_nodes_from(range(len(ids)))
edges = set()
for rid, n in notes.items():
    a = idx[rid]
    for tgt in n["links"]:
        b = idx[tgt]
        if a != b:
            e = (a, b) if a < b else (b, a)
            edges.add(e)
G.add_edges_from(edges)

deg = dict(G.degree())
pos = nx.spring_layout(G, k=1.6 / math.sqrt(len(ids)), iterations=90, seed=7)

xs = [pos[i][0] for i in range(len(ids))]
ys = [pos[i][1] for i in range(len(ids))]
minx, maxx = min(xs), max(xs)
miny, maxy = min(ys), max(ys)
sx = 2.0 / (maxx - minx or 1)
sy = 2.0 / (maxy - miny or 1)
s = min(sx, sy)


def rad(d: int) -> float:
    return round(min(2.0 + math.sqrt(d) * 2.4, 16.0), 2)


group_keys = list(GROUPS.keys())
nodes_out = []
for i, rid in enumerate(ids):
    x = round((pos[i][0] - (minx + maxx) / 2) * s, 4)
    y = round((pos[i][1] - (miny + maxy) / 2) * s, 4)
    g = notes[rid]["group"]
    nodes_out.append({
        "x": x,
        "y": y,
        "r": rad(deg[i]),
        "g": group_keys.index(g),
        "t": GROUPS[g][1],
        "l": notes[rid]["label"][:48],
    })

groups_out = []
for k in group_keys:
    cnt = sum(1 for rid in ids if notes[rid]["group"] == k)
    if cnt:
        groups_out.append({"key": k, "label": GROUPS[k][0], "tone": GROUPS[k][1], "count": cnt})

data = {
    "generated": __import__("datetime").date.today().isoformat(),
    "counts": {
        "nodes": len(ids),
        "edges": len(edges),
        "linked": sum(1 for i in range(len(ids)) if deg[i] > 0),
    },
    "groups": sorted(groups_out, key=lambda x: -x["count"]),
    "nodes": nodes_out,
    "edges": [[a, b] for a, b in sorted(edges)],
}
OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
print(
    f"brainGraph.json: {data['counts']['nodes']} nodes, "
    f"{data['counts']['edges']} edges, {data['counts']['linked']} linked, "
    f"{len(groups_out)} groups, {OUT.stat().st_size // 1024} KB"
)
