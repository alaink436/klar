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

# Vault-Pfad: per BRAIN_VAULT_PATH überschreibbar, damit derselbe Generator
# lokal (Windows-Pfad unten) und im CI (geklontes Repo neben dem Checkout)
# läuft. Der Default bleibt der Arbeitsplatz-Pfad, damit ein Aufruf von Hand
# ohne Env weiterhin funktioniert.
VAULT = Path(os.environ.get("BRAIN_VAULT_PATH") or r"C:\Users\Alain Kessler\AI-Brain")
OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "data" / "brainGraph.json"

if not VAULT.is_dir():
    raise SystemExit(
        f"Vault nicht gefunden: {VAULT}\n"
        "Setze BRAIN_VAULT_PATH auf den Pfad des AI-Brain-Checkouts."
    )

# Folders that must never reach the public/site graph. Secrets + Credentials
# hold keys; excluding them here means their note *names* never ship in
# brainGraph.json (the file is read by the public landing graph too).
SKIP_DIRS = {".git", ".claude", "node_modules", ".obsidian", ".trash", "Secrets", "Credentials"}

# Skills/Archive is bought and imported third-party packages, not Alain's
# knowledge, and it drowned everything else: 834 of 1180 nodes, 70.7 %, while
# the whole Learnings corpus showed up as 6 dots. Excluded 2026-08-20, which
# leaves 346 nodes with Projects at 63 % instead of 19 %. The curated
# 00-Skill-Registry.md stays in, it is hand-written and belongs to him.
# Matched on the relative path, not the folder name, so an "Archive" elsewhere
# is unaffected.
SKIP_PATHS = {"Skills/Archive"}

# top-level folder -> (label, colour). Cool, cohesive palette (aqua/blue/cyan/
# teal/mint, no purple) — kept in sync with GROUP_COLORS in InteractiveGraph.tsx,
# which overrides these at render time. Distinct on dark.
GROUPS = {
    "Projects": ("projects", "#7BE0CD"),
    "Learnings": ("learnings", "#74D6C4"),
    "Skills": ("skills", "#5E93C9"),
    "Design-Systems": ("design", "#56C6E0"),
    "Reflexe": ("reflexe", "#6FD8A6"),
    "Agents": ("agents", "#8AA6C9"),
    "Infrastructure": ("infra", "#6FA8D6"),
    "Research": ("research", "#6FA8D6"),
    "Templates": ("templates", "#8AA6C9"),
    "Studium": ("studium", "#8AA6C9"),
    "_root": ("core", "#BFE3FF"),
}
DEFAULT_COLOR = "#8AA6C9"
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
    here = str(Path(root).relative_to(VAULT)).replace("\\", "/")
    dirs[:] = [
        d for d in dirs
        if (f"{here}/{d}" if here != "." else d) not in SKIP_PATHS
    ]
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

# chronological rank
order_ids = sorted(range(len(ids)), key=lambda i: (notes[ids[i]]["date"], ids[i]))
rank = {i: r for r, i in enumerate(order_ids)}

# ── Hierarchie: der Ordnerbaum ───────────────────────────────────────────
#
# Vorher war das Layout ein Spring-Graph über [[wikilinks]]. Ergebnis am
# 2026-08-20: 192 von 439 Dateien ohne eine einzige Kante, und darunter
# CLAUDE.md, 00-Registry.md, alle 54 Reflexe und das halbe Infrastructure.
# Die sind nicht peripher, sie tragen nur keine Wikilinks. Der Graph mass
# also Verlinkungsdisziplin und nannte das Ergebnis "verwaist".
#
# Ordnerzugehörigkeit dagegen hat jede Datei. Der Baum platziert deshalb
# alle, und er zeigt die Struktur, die wirklich existiert: Vault → Ordner →
# Projekt → Datei. Die Wikilink-Kanten bleiben zusätzlich erhalten, sie sind
# die echten Querverweise; sie werden im Client blasser gezeichnet.
import numpy as np

ORD = "\u00a7"          # Präfix für synthetische Ordnerknoten, kollidiert nie
WURZEL = ORD            # die Vault-Wurzel selbst

def eltern(rid: str):
    """Ordner-Knoten-Id des Elternteils, oder die Wurzel."""
    teile = rid.split("/")
    return (ORD + "/".join(teile[:-1])) if len(teile) > 1 else WURZEL

# alle Ordner sammeln, die auf dem Weg zu einer Datei liegen
ordner = set()
for rid in ids:
    teile = rid.split("/")[:-1]
    for k in range(1, len(teile) + 1):
        ordner.add(ORD + "/".join(teile[:k]))

baum_ids = ids + sorted(ordner) + [WURZEL]
bidx = {r: i for i, r in enumerate(baum_ids)}

kinder = {r: [] for r in baum_ids}
for r in baum_ids:
    if r == WURZEL:
        continue
    e = eltern(r[len(ORD):]) if r.startswith(ORD) else eltern(r)
    kinder.setdefault(e, []).append(r)
for k in kinder:
    # Ordner zuerst, dann Dateien, jeweils alphabetisch: stabil über Läufe
    kinder[k].sort(key=lambda r: (not r.startswith(ORD), r.lower()))

# Blattzahl je Teilbaum bestimmt, wieviel Winkel er bekommt
blaetter = {}
def zaehle(r):
    if r in blaetter:
        return blaetter[r]
    ks = kinder.get(r, [])
    blaetter[r] = 1 if not ks else sum(zaehle(k) for k in ks)
    return blaetter[r]
zaehle(WURZEL)

# Radius je Tiefe. Die Schritte werden nach aussen kleiner, sonst zerreisst
# es tiefe Zweige (Projects/<Projekt>/<Unterordner>/Datei).
RADIUS = [0.0, 0.34, 0.66, 0.90, 1.08, 1.22, 1.33]
def radius(tiefe: int) -> float:
    return RADIUS[tiefe] if tiefe < len(RADIUS) else RADIUS[-1] + 0.09 * (tiefe - len(RADIUS) + 1)

P = {}
def platziere(r, tiefe, a0, a1):
    mitte = (a0 + a1) / 2.0
    rr = radius(tiefe)
    P[bidx[r]] = (rr * math.cos(mitte), rr * math.sin(mitte))
    ks = kinder.get(r, [])
    if not ks:
        return
    gesamt = sum(blaetter[k] for k in ks) or 1
    a = a0
    for k in ks:
        anteil = (a1 - a0) * blaetter[k] / gesamt
        platziere(k, tiefe + 1, a, a + anteil)
        a += anteil

platziere(WURZEL, 0, -math.pi, math.pi)

# Baumkanten. Der dritte Wert markiert sie, damit der Client sie blasser
# zeichnen kann; ein Client, der nur [a, b] liest, ignoriert ihn.
# Wieviele Dateien tragen ueberhaupt einen Wikilink? Die Zahl bleibt im
# Zaehler, weil sie etwas ueber die Verlinkungsdisziplin sagt, nicht mehr
# ueber die Platzierung: platziert werden jetzt alle.
linked = [i for i in range(len(ids)) if deg[i] > 0]

baumkanten = []
for r, ks in kinder.items():
    for k in ks:
        baumkanten.append((bidx[r], bidx[k]))

# Grad, Rang und Gruppe für die Ordnerknoten ableiten
def blattnachfahren(r):
    ks = kinder.get(r, [])
    if not ks:
        return [r] if not r.startswith(ORD) else []
    out = []
    for k in ks:
        out += blattnachfahren(k)
    return out

ordner_info = {}
for r in baum_ids:
    if not r.startswith(ORD):
        continue
    nachfahren = blattnachfahren(r)
    raenge = [rank[idx[d]] for d in nachfahren if d in idx]
    pfad = r[len(ORD):]
    ordner_info[r] = {
        "label": (pfad.split("/")[-1] if pfad else "AI-Brain"),
        "group": (pfad.split("/")[0] if pfad else "_root"),
        "deg": len(kinder.get(r, [])),
        # Ein Ordner entsteht mit seiner ersten Datei, nicht später
        "rank": min(raenge) if raenge else 0,
        "files": len(nachfahren),
    }


def rad(d):
    # smaller dots: clumping is mostly node-diameter vs gap, not layout
    return round(min(1.3 + math.sqrt(d) * 1.5, 10.0), 2)



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
    x, y = P[bidx[rid]]
    nodes_out.append({
        "x": round(x, 4),
        "y": round(y, 4),
        "r": rad(deg[i]),
        "g": gindex[notes[rid]["group"]],
        "c": rank[i],
        "l": notes[rid]["label"][:48],
        "p": rid,  # vault-relative path, lets the viewer open the note on click
    })

# Ordnerknoten dahinter. Sie tragen keinen oeffenbaren Pfad ("p": ""), der
# Viewer laesst sie deshalb beim Klick in Ruhe. Ihr Radius waechst mit der
# Zahl der Dateien darunter, damit ein grosser Ordner auch gross aussieht.
ordner_index = {}
for r in baum_ids:
    if not r.startswith(ORD):
        continue
    info = ordner_info[r]
    x, y = P[bidx[r]]
    ordner_index[r] = len(nodes_out)
    nodes_out.append({
        "x": round(x, 4),
        "y": round(y, 4),
        "r": round(min(3.0 + math.sqrt(info["files"]) * 1.4, 13.0), 2),
        "g": gindex.get(info["group"], gindex.get("_root", 0)),
        "c": info["rank"],
        "l": info["label"][:48],
        # Ordnerpfad, NICHT zum Oeffnen: scopeGraph() liest daraus die
        # Top-Ebene, damit ein Ordner im selben Scope landet wie sein Inhalt.
        "p": r[len(ORD):],
        "d": 1,          # Ordner, keine Notiz
    })

# Der Baum indiziert ids + Ordner + Wurzel, die Ausgabe zuerst alle Dateien
# und danach die Ordner. Diese Abbildung bringt beide zusammen.
def baum_zu_aus(i):
    r = baum_ids[i] if i < len(baum_ids) else None
    if r is None:
        return 0
    return ordner_index[r] if r.startswith(ORD) else idx[r]

order_dates = [notes[ids[i]]["date"] for i in order_ids]
data = {
    "generated": date.today().isoformat(),
    "counts": {
        "nodes": len(ids),          # Notizen, ohne die Ordnerknoten
        "edges": len(edges),        # Wikilinks, ohne die Baumkanten
        "linked": len(linked),      # Notizen mit mindestens einem Wikilink
        "folders": len(ordner_index),
        "tree": len(baumkanten),
    },
    "first": order_dates[0],
    "last": order_dates[-1],
    "order": order_dates,
    "groups": groups_out,
    "nodes": nodes_out,
    # Wikilink-Kanten zuerst, danach die Baumkanten mit Marker 1. Ein Client,
    # der nur [a, b] destrukturiert, ignoriert den dritten Wert.
    "edges": (
        [[baum_zu_aus(a), baum_zu_aus(b)] for a, b in sorted(edges)]
        + [[baum_zu_aus(a), baum_zu_aus(b), 1] for a, b in baumkanten]
    ),
}
OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
print(
    f"brainGraph.json: {data['counts']['nodes']} nodes "
    f"({data['counts']['linked']} linked), {len(edges)} edges, "
    f"{len(groups_out)} groups, {data['first']}..{data['last']}, "
    f"{OUT.stat().st_size // 1024} KB"
)
