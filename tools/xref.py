#!/usr/bin/env python3
"""
xref.py - Querverweise vom Disassembly von BMMAIN.EXE auf Datenadressen.

Das Spiel greift auf seine globalen Tabellen mit festen Adressen zu
(Segment 0x4238 = großes Datensegment, Segment 0x4cb3 = DGROUP). Die
Spielstand-Blöcke liegen genau an solchen Adressen (siehe docs/MEMORY-MAP.md).
Dieses Werkzeug listet alle Code-Stellen, die einen Adressbereich anfassen,
und zeigt dazu die in der Nähe referenzierten Texte (Bildschirmbeschriftungen),
was die Bedeutung der Felder verrät.

    python3 tools/xref.py SEG START LEN [--summary] [--context N]

Beispiel: Vereinstabelle
    python3 tools/xref.py 0x4238 0x3066 6800 --summary

Voraussetzung: tools/out/bmmain.bin und tools/out/bmmain.asm
(erzeugt mit tools/unexepack.py und objdump -D -b binary -m i8086).
"""
import argparse
import os
import re
import struct
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(HERE, "out", "bmmain.bin")
ASM = os.path.join(HERE, "out", "bmmain.asm")
DGROUP = 0x4CB3
DATASEG = 0x4238

LINE_RE = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)\s*(.*)$")
ES_OP_RE = re.compile(r"%es:(-?0x[0-9a-f]+)(\([^)]*\))?")
SEGVAR_RE = re.compile(r"mov\s+(-?0x[0-9a-f]+),%es")
PUSH_ES_RE = re.compile(r"push\s+%es:(0x[0-9a-f]+)$")
BARE_OP_RE = re.compile(r"(?<![$%(])(-?0x[0-9a-f]+)(?![(\w])")


def load():
    image = open(BIN, "rb").read()
    lines = []
    for raw in open(ASM):
        m = LINE_RE.match(raw)
        if not m:
            continue
        lines.append((int(m.group(1), 16), m.group(3).strip()))
    return image, lines


def norm(off):
    return off & 0xFFFF


def segvar_value(image, ds_off):
    addr = DGROUP * 16 + norm(ds_off)
    if addr + 2 > len(image):
        return None
    return struct.unpack("<H", image[addr:addr + 2])[0]


def far_string(image, seg, off, maxlen=80):
    addr = seg * 16 + off
    if addr >= len(image):
        return None
    end = image.find(b"\x00", addr, addr + maxlen)
    if end < 0:
        return None
    s = image[addr:end]
    if len(s) < 3 or any(c < 0x20 or c > 0x7E for c in s):
        return None
    return s.decode("latin-1")


def string_at_table(image, ds_off):
    """Far-Pointer-Tabelle in DGROUP: liest seg:off bei 4cb3:ds_off."""
    addr = DGROUP * 16 + norm(ds_off)
    if addr + 4 > len(image):
        return None
    off, seg = struct.unpack("<HH", image[addr:addr + 4])
    return far_string(image, seg, off)


def analyse(image, lines, seg, start, length, context):
    end = start + length
    hits = []
    es_now = None
    es_hist = []  # (index, seg)
    strings_at = []  # (index, text)
    for i, (addr, ins) in enumerate(lines):
        m = SEGVAR_RE.search(ins)
        if m:
            es_now = segvar_value(image, int(m.group(1), 16))
            es_hist.append((i, es_now))
        m = PUSH_ES_RE.match(ins)
        if m and es_now == DGROUP:
            s = string_at_table(image, int(m.group(1), 16))
            if s:
                strings_at.append((i, s))
        if ins.startswith("push") or ins.startswith("j") or ins.startswith("call") or ins.startswith("lcall"):
            pass
        found = None
        for m in ES_OP_RE.finditer(ins):
            off = norm(int(m.group(1), 16))
            if start <= off < end and es_now == seg:
                found = (off, m.group(2) or "")
        if found is None and seg == DGROUP:
            for m in BARE_OP_RE.finditer(ins):
                if ins.startswith("push") and "%" not in ins:
                    continue
                off = norm(int(m.group(1), 16))
                if start <= off < end and ("(%b" in ins or "," in ins):
                    # nur Speicheroperanden, keine Sprungziele/Immediates
                    if not ins.startswith("j") and "call" not in ins and "$" + m.group(1) not in ins:
                        found = (off, "")
        if found:
            hits.append((i, addr, found[0], found[1], ins))
    # Texte in der Nähe zuordnen
    result = []
    for i, addr, off, idx, ins in hits:
        near = [s for j, s in strings_at if abs(j - i) <= context]
        result.append((addr, off, idx, ins, near))
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("seg", type=lambda x: int(x, 0))
    ap.add_argument("start", type=lambda x: int(x, 0))
    ap.add_argument("length", type=lambda x: int(x, 0))
    ap.add_argument("--summary", action="store_true")
    ap.add_argument("--context", type=int, default=40)
    ap.add_argument("--record", type=int, default=0, help="Datensatzgröße: Feldoffset modulo Datensatz")
    a = ap.parse_args()
    image, lines = load()
    res = analyse(image, lines, a.seg, a.start, a.length, a.context)
    if a.summary:
        byfield = defaultdict(list)
        for addr, off, idx, ins, near in res:
            f = off - a.start
            if a.record:
                f %= a.record
            byfield[f].append((addr, ins, near))
        for f in sorted(byfield):
            items = byfield[f]
            texts = defaultdict(int)
            for _, _, near in items:
                for s in near:
                    texts[s] += 1
            top = sorted(texts.items(), key=lambda x: -x[1])[:6]
            print("+%-5d %3d Zugriffe  %s" % (f, len(items), " | ".join(t for t, _ in top)))
    else:
        for addr, off, idx, ins, near in res:
            print("%06x  +%-5d %-40s %s" % (addr, off - a.start, ins + idx, " | ".join(near[:4])))


if __name__ == "__main__":
    main()
