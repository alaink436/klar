"""
Brain-graph generator — the data behind the on-site Obsidian graph.

Scans the AI-Brain vault for notes + [[wikilinks]], reads each note's
creation date from git (first commit that added it), runs a force layout
offline, and writes src/app/data/brainGraph.json. Build-baked like
worklog.json: real structure, no runtime cost.

Run after substantial vault changes:  python scripts/gen-brain-graph.py
"""
import json
import os
import re
import math
import subprocess
from datetime import date
from pathlib import Path

import networkx as nx

VAULT = Path(r"C:\Users\Alain Kessler\AI-Brain")
OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "data" / "brainGraph.json"

SKIP_DIRS = {".git", "node_modules", ".obsidian", ".trash"}

# top-level folder -> (label, colour). Restrained palette, distinct on dark.
GROUPS = {
    "Projects": ("projects", "#F4F1E8"),
    "Learnings": ("learnings", "#74D6C4"),
    "Skills": ("skills", "#8E8FB8"),
    "Design-Systems": ("design", "#C9A6E0"),
    "Agents": ("agents", "#E8A06A"),
    "Infrastructure": ("infra", "#6FA8D6"),
    "Research": ("research", "#6FA8D6"),
    "Templates": ("templates", "#9AA0B0"),
    "Daily-Logs": ("logs", "#9AA0B0"),
    "Studium": ("studium", "#9AA0B0"),
    "_root": ("core", "#F4F1E8"),
}
DEFAULT_COLOR = "#9AA0B0"
GENERIC = {"PROGRESS", "PRD", "README", "SKILL", "CLAUDE", "INDEX", "STATUS"}

WIKILINK = re.compile(r"\[\[([^\]]+?)\]\]")
MDLINK = re.compile(r"\]\(([^)]+?\.md)\)")


def top_group(rel: Path) -> str:
    parts = rel.parts
    return "_root" if len(parts) == 1 else parts[0]


def label_for(rel: Path) -> str:
    stem = rel.stem
    if stem.upper() in GENERIC and len(rel.parts) > 1:
        return f"{rel.parts[-2]} / {stem}"
    return stem


# ── git: first-add date per note ─────────────────────────────────────────
def creation_dates():
    out = subprocess.run(
        ["git", "-C", str(VAULT), "log", "--reverse", "--diff-filter=A",
         "--name-only", "--format=C|%cI"],
        capture_output=True, text=True, encoding="utf-8", errors="ignore",
    ).stdout
    first = {}
    cur = None
    for line in out.splitlines():
        if line.startswith("C|"):
            cur = line[2:12]  # YYYY-MM-DD
        elif line.endswith(".md") and cur and line not in first:
            first[line.replace("\\", "/")] = cur
    return first


# ── collect notes ────────────────────────────────────────────────────────
notes = {}
stem_index = {}
for root, dirs, files in os.walk(VAULT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fn in files:
        if not fn.endswith(".md"):
            continue
        rel = (Path(root) / fn).relative_to(VAULT)
        rid = str(rel).replace("\\", "/")
        notes[rid] = {
            "rel": rel,
            "label": label_for(rel),
            "group": top_group(rel),
            "links": set(),
        }
        stem_index.setdefault(rel.stem.lower(), []).append(rid)

first_add = creation_dates()
fallback = max(first_add.values()) if first_add else date.today().isoformat()
for rid, n in notes.items():
    n["date"] = first_add.get(rid, fallback)

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

# ── graph ────────────────────────────────────────────────────────────────
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
            edges.add((a, b) if a < b else (b, a))
G.add_edges_from(edges)
deg = dict(G.degree())

# layout: spring on linked nodes (clear core), isolated notes in a calm
# outer ring grouped by folder so the centre stays readable
linked = [i for i in range(len(ids)) if deg[i] > 0]
iso = [i for i in range(len(ids)) if deg[i] == 0]
import numpy as np

sub = G.subgraph(linked)
# spring gives the cluster structure...
pos = nx.spring_layout(sub, k=5.5 / math.sqrt(max(len(linked), 1)),
                       iterations=300, seed=7)
pts = np.array([pos[i] for i in linked], dtype=float)
pts -= pts.mean(0)
pts /= (np.abs(pts).max() or 1.0)

# Degree-radial remap: a uniform packing of 353 nodes is unavoidably
# dense in the middle. So keep the *angle* from spring (preserves which
# cluster points where) but set each node's *radius* mostly by degree —
# hubs stay near the centre with room around them, low-degree leaf notes
# fan outward. The centre becomes a readable hub skeleton, not a pile.
n = len(pts)
th = np.arctan2(pts[:, 1], pts[:, 0])
r_s = np.hypot(pts[:, 0], pts[:, 1])
r_s = r_s / (r_s.max() or 1.0)
dg = np.array([deg[linked[k]] for k in range(n)], dtype=float)
dn = np.sqrt(dg) / math.sqrt(dg.max() or 1.0)        # 0..1, hubs -> 1
# spread the high-degree end across a band (don't pin every hub to the
# same inner radius -> hubs + their labels stop clustering in one spot)
r_deg = 0.30 + 0.70 * (1.0 - dn) ** 1.15
r_f = 0.10 * r_s + 0.90 * r_deg
# deterministic radial + angular jitter so equal-degree nodes don't ring
jit = np.array([((hash(ids[linked[k]]) % 1000) / 1000.0 - 0.5)
                for k in range(n)])
jit2 = np.array([((hash(ids[linked[k]] + "r") % 1000) / 1000.0 - 0.5)
                 for k in range(n)])
th = th + jit * 0.26
# hard inner hole: nothing closer than 0.18 to dead centre
r_f = np.clip(r_f + jit2 * 0.07, 0.18, None)
pts = np.stack([r_f * np.cos(th), r_f * np.sin(th)], axis=1)
pts -= pts.mean(0)

# resolve overlaps with a real gap so nodes don't touch (keep passes
# low so the degree-radial spread isn't homogenised away)
MIN_D = 2.1 / math.sqrt(max(n, 1))
for it in range(55):
    diff = pts[:, None, :] - pts[None, :, :]
    d = np.sqrt((diff * diff).sum(-1))
    np.fill_diagonal(d, 1e9)
    close = d < MIN_D
    if not close.any():
        break
    unit = diff / d[..., None]
    force = (np.where(close[..., None], unit * (MIN_D - d)[..., None], 0.0)
             .sum(1))
    pts += force * 0.5 * (1.0 - it / 60.0)
    pts -= pts.mean(0)

# scale so the core fills the view (~1.0); tight halo just outside so
# BrainGraph's fit-to-view doesn't zoom out and re-shrink the core.
pts -= pts.mean(0)  # re-centre before measuring the radius
core_r0 = float(np.hypot(pts[:, 0], pts[:, 1]).max()) or 1.0
sc = 1.0 / core_r0
core_pts = pts * sc
# hard inner hole, applied LAST so no later re-centring can fill it:
# anything inside HOLE is pushed out along its own angle. Empties the
# dead centre -> the hub mass sits in a readable ring, not a blob.
HOLE = 0.30
rr = np.hypot(core_pts[:, 0], core_pts[:, 1])
ang = np.arctan2(core_pts[:, 1], core_pts[:, 0])
rr = np.where(rr < HOLE, HOLE + (HOLE - rr) * 0.5, rr)
core_pts = np.stack([rr * np.cos(ang), rr * np.sin(ang)], axis=1)
P = {i: (float(core_pts[k, 0]), float(core_pts[k, 1]))
     for k, i in enumerate(linked)}

iso.sort(key=lambda i: (notes[ids[i]]["group"], ids[i]))
for j, i in enumerate(iso):
    ang = 2 * math.pi * j / max(len(iso), 1)
    rr = 1.08 + 0.14 * ((j * 7) % 5) / 5.0
    P[i] = (rr * math.cos(ang), rr * math.sin(ang))


def rad(d):
    # smaller dots: clumping is mostly node-diameter vs gap, not layout
    return round(min(1.3 + math.sqrt(d) * 1.5, 10.0), 2)


# chronological rank
order_ids = sorted(range(len(ids)), key=lambda i: (notes[ids[i]]["date"], ids[i]))
rank = {i: r for r, i in enumerate(order_ids)}

present = [g for g in GROUPS if any(notes[r]["group"] == g for r in ids)]
present += sorted({notes[r]["group"] for r in ids} - set(present))
groups_out = []
for g in present:
    cnt = sum(1 for r in ids if notes[r]["group"] == g)
    if cnt:
        lbl, col = GROUPS.get(g, (g.lower()[:10], DEFAULT_COLOR))
        groups_out.append({"key": g, "label": lbl, "color": col, "count": cnt})
groups_out.sort(key=lambda x: -x["count"])
gindex = {g["key"]: k for k, g in enumerate(groups_out)}

nodes_out = []
for i, rid in enumerate(ids):
    x, y = P[i]
    nodes_out.append({
        "x": round(x, 4),
        "y": round(y, 4),
        "r": rad(deg[i]),
        "g": gindex[notes[rid]["group"]],
        "c": rank[i],
        "l": notes[rid]["label"][:48],
    })

order_dates = [notes[ids[i]]["date"] for i in order_ids]
data = {
    "generated": date.today().isoformat(),
    "counts": {
        "nodes": len(ids),
        "edges": len(edges),
        "linked": len(linked),
    },
    "first": order_dates[0],
    "last": order_dates[-1],
    "order": order_dates,
    "groups": groups_out,
    "nodes": nodes_out,
    "edges": [[a, b] for a, b in sorted(edges)],
}
OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
print(
    f"brainGraph.json: {data['counts']['nodes']} nodes "
    f"({data['counts']['linked']} linked), {len(edges)} edges, "
    f"{len(groups_out)} groups, {data['first']}..{data['last']}, "
    f"{OUT.stat().st_size // 1024} KB"
)
