#!/usr/bin/env python3
"""
func.py - Eine Funktion aus dem Disassembly lesbar ausgeben.

    python3 tools/func.py ADRESSE [--lines N] [--raw]

Gibt den Code ab ADRESSE bis zum nächsten `lret` (oder N Zeilen) aus und
kommentiert:
  - Zugriffe auf bekannte Tabellen (Segment 4238/4cb3, siehe SYMBOLS)
  - Far-Pointer-Pushes aus DGROUP-Tabellen mit dem referenzierten Text
  - bekannte Bibliotheksfunktionen (LIBS)
  - Aufrufe naher Funktionen mit Namen aus FUNCS
"""
import argparse
import os
import re
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(HERE, "out", "bmmain.bin")
ASM = os.path.join(HERE, "out", "bmmain.asm")
DGROUP = 0x4CB3
DATA = 0x4238

# (segment, offset, länge, name, datensatz)
SYMBOLS = [
    (DATA, 0x2242, 3112, "manager", 778),
    (DATA, 0x3066, 6800, "club", 34),
    (DATA, 0x0ECC, 3456, "standing", 54),
    (DATA, 0x57DD, 5587, "player", 37),
    (DATA, 0x774A, 6500, "squad", 52),
    (DATA, 0x4B5E, 60, "pairings", 60),
    (DATA, 0x6DDC, 2280, "blk6ddc", 20),
    (DATA, 0x5714, 100, "nachhol", 100),
    (DATA, 0x9336, 5012, "history", 5012),
    (DATA, 0x2EBA, 4, "day", 4),
    (DATA, 0x2E8E, 4, "month", 4),
    (DATA, 0xA7A0, 4, "year", 4),
    (DATA, 0x304A, 1, "curManager", 1),
    (DATA, 0x2E, 320, "money80", 4),
    (DGROUP, 0x66C, 144, "advertising", 36),
    (DGROUP, 0x7AB, 1, "nManagers", 1),
    (DGROUP, 0x618, 4, "msgCount", 1),
    (DGROUP, 0x7DC, 4, "counter105", 4),
    (DGROUP, 0x7B8, 12, "daysInMonth", 1),
]

LIBS = {
    (0x3A01, 0xDD2): "strcat", (0x3A01, 0xE18): "strcpy", (0x3A01, 0xE78): "strlen",
    (0x3A01, 0xEBA): "strncmp?", (0x3A01, 0x2C6): "chkstk", (0x3A01, 0x1AE6): "lmul",
    (0x3A01, 0x1A4C): "ldiv", (0x3930, 0xD6): "write", (0x3930, 0x88): "read",
    (0x3930, 0x23): "open", (0x3930, 0xC): "close", (0x3930, 0x52D): "?", (0x76B, 0xCC7): "random(lo,hi)",
    (0x76B, 0x681): "ltoa/format", (0x76B, 0xE57): "messageBox", (0x76B, 0x1416): "?ui",
    (0x6C7, 0x87C): "drawText(x,y,...)", (0x6C7, 0x83C): "drawBox", (0x6C7, 0x9B0): "?gfx",
    (0x3091, 0x146C): "?", (0x3091, 0xE3A): "?",
}

FUNCS_FILE = os.path.join(HERE, "funcs.txt")


def load_funcs():
    d = {}
    if os.path.exists(FUNCS_FILE):
        for line in open(FUNCS_FILE):
            line = line.strip()
            if line and not line.startswith("#"):
                a, n = line.split(None, 1)
                d[int(a, 16)] = n
    return d


def symbol(seg, off):
    for s, o, ln, name, rec in SYMBOLS:
        if s == seg and o <= off < o + ln:
            d = off - o
            if rec > 1 and ln > rec:
                return "%s[%d]+%d" % (name, d // rec, d % rec) if d >= rec else "%s+%d" % (name, d)
            return "%s+%d" % (name, d) if d else name
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("addr", type=lambda x: int(x, 16))
    ap.add_argument("--lines", type=int, default=400)
    ap.add_argument("--raw", action="store_true")
    a = ap.parse_args()
    img = open(BIN, "rb").read()
    funcs = load_funcs()
    lines = open(ASM).read().splitlines()
    rx = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)\s*(.*)$")
    start = None
    for i, l in enumerate(lines):
        m = rx.match(l)
        if m and int(m.group(1), 16) >= a.addr:
            start = i
            break
    if start is None:
        raise SystemExit("Adresse nicht gefunden")
    es = None
    n = 0
    for l in lines[start:]:
        m = rx.match(l)
        if not m:
            continue
        addr, ins = int(m.group(1), 16), m.group(3).strip()
        if a.raw:
            print(l)
        else:
            note = []
            mm = re.search(r"mov\s+(-?0x[0-9a-f]+),%es", ins)
            if mm:
                off = int(mm.group(1), 16) & 0xFFFF
                p = DGROUP * 16 + off
                es = struct.unpack("<H", img[p:p + 2])[0] if p + 2 <= len(img) else None
                note.append("es=%04x" % es if es is not None else "es=?")
            for mm in re.finditer(r"%es:(-?0x[0-9a-f]+)", ins):
                off = int(mm.group(1), 16) & 0xFFFF
                if es is not None:
                    s = symbol(es, off)
                    if s:
                        note.append(s)
                    elif es == DGROUP and ins.startswith("push"):
                        p = DGROUP * 16 + off
                        if p + 4 <= len(img):
                            o2, s2 = struct.unpack("<HH", img[p:p + 4])
                            q = s2 * 16 + o2
                            end = img.find(b"\0", q, q + 60)
                            txt = img[q:end] if end > 0 else b""
                            if len(txt) >= 2 and all(0x20 <= c < 0x7F for c in txt):
                                note.append('"%s"' % txt.decode("latin-1"))
            mm = re.search(r"lcall\s+\$0x([0-9a-f]+),\$0x([0-9a-f]+)", ins)
            if mm:
                key = (int(mm.group(1), 16), int(mm.group(2), 16))
                if key in LIBS:
                    note.append(LIBS[key])
                else:
                    tgt = key[0] * 16 + key[1]
                    note.append(funcs.get(tgt, "far %05x" % tgt))
            mm = re.search(r"\bcall\s+0x([0-9a-f]+)", ins)
            if mm:
                tgt = int(mm.group(1), 16)
                if tgt in funcs:
                    note.append(funcs[tgt])
            # bare DGROUP-Displacements (Segment ds = 4cb3)
            for mm in re.finditer(r"(?<![$%(])(-?0x[0-9a-f]+)(?=[,)]|$)", ins):
                if "%es:" in ins or ins.startswith(("j", "call", "push $", "lcall")):
                    continue
                off = int(mm.group(1), 16) & 0xFFFF
                s = symbol(DGROUP, off)
                if s:
                    note.append("ds:" + s)
            print("%06x  %-44s %s" % (addr, ins, ("; " + ", ".join(note)) if note else ""))
        n += 1
        if ins.startswith("lret") or n >= a.lines:
            break


if __name__ == "__main__":
    main()
