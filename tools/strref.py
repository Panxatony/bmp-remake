#!/usr/bin/env python3
"""
strref.py - Code-Stellen finden, die einen Bildschirmtext benutzen.

    python3 tools/strref.py "Chance f]r "

Sucht den Text im entpackten Programm, findet die Far-Pointer-Einträge in
DGROUP, die auf ihn zeigen, und listet die Code-Stellen, die diese Einträge
pushen (push %es:0xNNNN mit es = DGROUP oder direkt).
"""
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
img = open(os.path.join(HERE, "out", "bmmain.bin"), "rb").read()
asm = open(os.path.join(HERE, "out", "bmmain.asm")).read()
DG = 0x4CB30


def refs(text):
    out = []
    pos = -1
    while True:
        pos = img.find(text.encode("latin-1"), pos + 1)
        if pos < 0:
            break
        entries = []
        for i in range(DG, len(img) - 4, 2):
            off, seg = struct.unpack("<HH", img[i:i + 4])
            if seg * 16 + off == pos:
                entries.append(i - DG)
        sites = []
        for o in entries:
            for m in re.finditer(r"\n\s*([0-9a-f]+):[^\n]*push\s+(?:%%es:)?0x%x\b" % o, asm):
                sites.append(int(m.group(1), 16))
            for m in re.finditer(r"\n\s*([0-9a-f]+):[^\n]*mov\s+\$0x%x,%%ax" % o, asm):
                sites.append(int(m.group(1), 16))
        out.append((pos, entries, sorted(set(sites))))
    return out


if __name__ == "__main__":
    for t in sys.argv[1:]:
        for pos, entries, sites in refs(t):
            print("%-40r text=%06x table=%s code=%s" % (t, pos, [hex(e) for e in entries], [hex(s) for s in sites]))
