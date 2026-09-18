#!/usr/bin/env python3
"""
audit.py - Alle Routinen von BMMAIN.EXE auflisten und mit den im Remake genannten
Adressen abgleichen.

    python3 tools/audit.py > docs/AUDIT-ROHDATEN.md

Routinen beginnen mit `push %bp; mov %sp,%bp`. Je Routine: Adresse, Größe, Segment (aus
Far-Aufrufen abgeleitet), Aufrufer, random()-Aufrufe, benutzte Bildschirmtexte, Zugriffe
auf bekannte Tabellen. "Abgebildet" = eine in docs/ oder packages/ genannte Adresse liegt in
der Routine.
"""
import os
import re
import struct
import glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
img = open(os.path.join(HERE, "out", "bmmain.bin"), "rb").read()
lines = open(os.path.join(HERE, "out", "bmmain.asm")).read().splitlines()
DG = 0x4CB30
rx = re.compile(r"^\s*([0-9a-f]+):\t([0-9a-f ]+)\t(.*)$")

ins = []
for l in lines:
    m = rx.match(l)
    if m:
        ins.append((int(m.group(1), 16), m.group(3).strip()))
ins.sort()

# Routinen
starts = []
for i, (a, t) in enumerate(ins):
    if t == "push   %bp" and i + 1 < len(ins) and ins[i + 1][1] == "mov    %sp,%bp":
        starts.append(a)
starts = sorted(a for a in set(starts) if a < 0x3D6C0)  # ab 3D6C0 liegen Daten, keine Routinen
ends = starts[1:] + [ins[-1][0] + 1]
funcs = {s: {"start": s, "end": e, "size": e - s} for s, e in zip(starts, ends)}
idx = {s: i for i, s in enumerate(starts)}


def func_of(a):
    lo, hi = 0, len(starts) - 1
    if a < starts[0]:
        return None
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if starts[mid] <= a:
            lo = mid
        else:
            hi = mid - 1
    return starts[lo]


def text_at(off):
    try:
        o, seg = struct.unpack_from("<HH", img, DG + off)
    except struct.error:
        return None
    if seg != 0x4CB3:
        return None
    addr = seg * 16 + o
    if addr >= len(img):
        return None
    e = img.find(b"\0", addr)
    t = img[addr:e]
    if not (2 <= len(t) <= 60) or any(c < 32 or c > 126 for c in t):
        return None
    return t.decode("latin-1")


def ds_text(off):
    addr = DG + off
    if addr >= len(img):
        return None
    e = img.find(b"\0", addr)
    t = img[addr:e]
    if not (3 <= len(t) <= 60) or any(c < 32 or c > 126 for c in t):
        return None
    return t.decode("latin-1")


# Segmente über Far-Aufrufe
seg_of = {}
callers = {s: set() for s in starts}
for f in funcs.values():
    f["calls"] = set()
    f["far"] = set()
    f["random"] = 0
    f["strings"] = []
    f["tables"] = set()
cur = None
prev_ax = None
for a, t in ins:
    fs = func_of(a)
    if fs is None:
        continue
    f = funcs[fs]
    m = re.match(r"lcall\s+\$0x([0-9a-f]+),\$0x([0-9a-f]+)", t)
    if m:
        seg, off = int(m.group(1), 16), int(m.group(2), 16)
        lin = seg * 16 + off
        tgt = func_of(lin)
        if tgt is not None and abs(tgt - lin) < 2:
            seg_of[tgt] = seg
            f["far"].add(tgt)
            callers[tgt].add(fs)
            if (seg, off) == (0x76B, 0xCC7):
                f["random"] += 1
        continue
    m = re.match(r"call\s+0x([0-9a-f]+)$", t)
    if m:
        tgt = func_of(int(m.group(1), 16))
        if tgt is not None and abs(tgt - int(m.group(1), 16)) < 2:
            f["calls"].add(tgt)
            callers[tgt].add(fs)
        continue
    m = re.match(r"push\s+%es:0x([0-9a-f]+)$", t)
    if m:
        s = text_at(int(m.group(1), 16))
        if s and s not in f["strings"]:
            f["strings"].append(s)
    m = re.match(r"mov\s+\$0x([0-9a-f]+),%ax$", t)
    if m:
        prev_ax = int(m.group(1), 16)
    elif t == "push   %ds" and prev_ax is not None:
        s = ds_text(prev_ax)
        if s and s not in f["strings"]:
            f["strings"].append(s)
    elif not t.startswith("push"):
        prev_ax = None
    m = re.search(r"%es:(-?0x[0-9a-f]+)\(", t) or re.search(r"%es:(0x[0-9a-f]+)$", t)
    if m:
        off = int(m.group(1), 16) & 0xFFFF
        for lo, hi, name in [(0x2242, 0x2242 + 3112, "manager"), (0x3066, 0x3066 + 6800, "club"), (0xECC, 0xECC + 3456, "standing"), (0x57DD, 0x57DD + 5587, "player"), (0x774A, 0x774A + 6500, "squad"), (0x9336, 0x9336 + 5012, "history"), (0x6DDC, 0x6DDC + 2280, "results"), (0x4B5E, 0x4B5E + 60, "pairings")]:
            if lo <= off < hi:
                f["tables"].add(name)

# Segmente propagieren (near calls = gleiches Segment)
changed = True
while changed:
    changed = False
    for s, f in funcs.items():
        if s in seg_of:
            for t in f["calls"]:
                if t not in seg_of:
                    seg_of[t] = seg_of[s]
                    changed = True
        else:
            for t in f["calls"]:
                if t in seg_of:
                    seg_of[s] = seg_of[t]
                    changed = True
                    break
# Rest: Segment des vorigen bekannten
last = 0
for s in starts:
    if s in seg_of:
        last = seg_of[s]
    else:
        seg_of[s] = last

LIB_SEGS = {0x3A01: "C-Bibliothek", 0x3930: "Datei/Speicher", 0x35AC: "Grafikkern", 0x6C7: "Zeichnen", 0x76B: "Oberfläche"}

# Abgebildete Adressen aus Doku und Code
refs = set()
for pat in ["docs/*.md", "docs/routines/*.md", "packages/core/src/*.ts", "packages/core/src/sim/*.ts", "packages/core/src/data/*.ts", "packages/server/*.ts", "packages/web/src/*.ts", "tools/func.py", "tools/funcs.txt"]:
    for fn in glob.glob(os.path.join(ROOT, pat)):
        for m in re.finditer(r"0x([0-9A-Fa-f]{4,5})\b", open(fn, errors="ignore").read()):
            refs.add(int(m.group(1), 16))
ported = {}
for r in refs:
    fs = func_of(r)
    if fs is not None and r < funcs[fs]["end"]:
        ported.setdefault(fs, set()).add(r)

print("# Audit der Routinen von BMMAIN.EXE (Rohdaten)\n")
print("Erzeugt von tools/audit.py. Routinen = `push %%bp; mov %%sp,%%bp`. %d Routinen, davon %d mit genannter Adresse.\n" % (len(starts), len(ported)))
by_seg = {}
for s in starts:
    by_seg.setdefault(seg_of[s], []).append(s)
print("## Segmente\n")
print("| Segment | Routinen | Bytes | abgebildet | Art |")
print("|---|---:|---:|---:|---|")
for seg in sorted(by_seg):
    fl = by_seg[seg]
    print("| %04x | %d | %d | %d | %s |" % (seg, len(fl), sum(funcs[s]["size"] for s in fl), sum(1 for s in fl if s in ported), LIB_SEGS.get(seg, "Spiel")))
print("\n## Routinen (ohne Bibliotheken)\n")
print("| Adresse | Größe | Seg | Aufrufer | random | Tabellen | Texte | Status |")
print("|---|---:|---|---:|---:|---|---|---|")
for s in starts:
    seg = seg_of[s]
    if seg in LIB_SEGS:
        continue
    f = funcs[s]
    st = "abgebildet (%s)" % ", ".join("0x%X" % r for r in sorted(ported[s])) if s in ported else ""
    strs = "; ".join(x.replace("|", "/") for x in f["strings"][:4])
    print("| 0x%05X | %d | %04x | %d | %d | %s | %s | %s |" % (s, f["size"], seg, len(callers[s]), f["random"], ",".join(sorted(f["tables"])), strs, st))
print("\n## Nicht abgebildete Routinen ab 100 Bytes (nach Größe)\n")
print("| Adresse | Größe | Seg | Aufrufer | random | Tabellen | Texte |")
print("|---|---:|---|---:|---:|---|---|")
miss = [s for s in starts if seg_of[s] not in LIB_SEGS and s not in ported and funcs[s]["size"] >= 60]
for s in sorted(miss, key=lambda x: -funcs[x]["size"]):
    f = funcs[s]
    print("| 0x%05X | %d | %04x | %s | %d | %s | %s |" % (s, f["size"], seg_of[s], ",".join("0x%X" % c for c in sorted(callers[s])[:4]), f["random"], ",".join(sorted(f["tables"])), "; ".join(x.replace("|", "/") for x in f["strings"][:6])))
