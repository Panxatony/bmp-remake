#!/usr/bin/env python3
"""
kasten.py - Aufrufstellen des Hinweiskastens 0x3174A (3091:0E3A) samt ihrer Texte auflisten.

Der Kasten bekommt vier Fernzeiger auf Textzeilen. Die Aufrufstelle pusht dafür acht Wörter
aus der DGROUP (Segment 0x4CB3, im entpackten BMMAIN also ab 0x4CB30); jedes Paar ist ein
Fernzeiger (Offset, Segment) auf eine nullterminierte Zeile. Zeilen, die das Spiel zur
Laufzeit zusammensetzt (Name, Betrag), liegen auf dem Stapel und lassen sich hier nicht lesen -
sie erscheinen als "(zur Laufzeit)".

    python3 tools/unexepack.py <bmp>/BMMAIN.EXE tools/out/bmmain
    python3 tools/kasten.py tools/out/bmmain.bin

Texte des Originals gibt dieses Werkzeug nur aus, es speichert nichts davon (siehe README).
"""
import re
import subprocess
import sys

DGROUP = 0x4CB30          # Segment 0x4CB3 des Datenbereichs im entpackten Abbild
KASTEN = 0x3174A          # Hinweisroutine, als Fernaufruf 3091:0E3A
BIN = sys.argv[1] if len(sys.argv) > 1 else "tools/out/bmmain.bin"
ASM = BIN.rsplit(".", 1)[0] + ".asm"

d = open(BIN, "rb").read()


def wort(a):
    return d[a] | d[a + 1] << 8


def zeile(zeiger_offset):
    """Text hinter dem Fernzeiger, der in der DGROUP bei `zeiger_offset` steht."""
    p = DGROUP + zeiger_offset
    if p + 4 > len(d):
        return None
    off, seg = wort(p), wort(p + 2)
    ziel = seg * 16 + off
    if not (0 < ziel < len(d)) or seg == 0:
        return None
    ende = d.find(b"\x00", ziel)
    if ende < 0 or ende - ziel > 60:
        return None
    text = d[ziel:ende].decode("latin1")
    return text if text.isprintable() else None


# Aufrufstellen suchen: lcall auf 0x3174A, davor die Pushes
zeilen = open(ASM, encoding="latin1").read().split("\n")
adr = re.compile(r"\s+([0-9a-f]+):")
aufrufe = []
for i, l in enumerate(zeilen):
    m = re.match(r"\s+([0-9a-f]+):.*\tlcall\s+\$0x([0-9a-f]+),\$0x([0-9a-f]+)", l)
    if not m:
        continue
    if int(m.group(2), 16) * 16 + int(m.group(3), 16) != KASTEN:
        continue
    a = int(m.group(1), 16)
    offs = []
    for vor in zeilen[max(0, i - 20):i]:
        p = re.search(r"push\s+%es:0x([0-9a-f]+)", vor)
        if p:
            offs.append(int(p.group(1), 16))
    # Die Pushes stehen in umgekehrter Reihenfolge; nur die geraden Wörter sind Offsets
    offs = list(reversed(offs))
    aufrufe.append((a, [o for o in offs if o % 2 == 0]))

print(f"{len(aufrufe)} Aufrufstellen des Hinweiskastens\n")
for a, offs in aufrufe:
    texte = []
    for o in offs:
        t = zeile(o)
        if t is not None and t.strip():
            texte.append(t)
    print(f"0x{a:05X}  " + (" / ".join(texte) if texte else "(zur Laufzeit)"))
