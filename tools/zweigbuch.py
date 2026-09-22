#!/usr/bin/env python3
"""
zweigbuch.py - Gerüst für den Zeile-für-Zeile-Abgleich einer Routine (GitLab #82).

    python3 tools/zweigbuch.py ADRESSE            -> Zweigbuch-Gerüst (Markdown) auf stdout
    python3 tools/zweigbuch.py ADRESSE --liste    -> kommentierte Auflistung der ganzen Routine

Die Routine reicht vom Einsprung bis zum nächsten `push %bp; mov %sp,%bp`, also samt aller
Ausgänge (func.py hört beim ersten `lret` auf). Jede bedingte Verzweigung wird eine Zeile
mit dem Vergleich davor; Zugriffe auf Datensätze sind wie in func.py benannt, auch über
geladene Zeiger (`les`), wie in felder.py. Die Spalten "Bedingung" und "Remake" füllt man
beim Lesen von Hand.
"""
import bisect
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from func import BIN, ASM, DGROUP, LIBS, symbol, load_funcs  # noqa: E402

RX = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)\s*(\S+)\s*(.*)$")
BASEN = {0x774A: "squad", 0x8B9A: "markt", 0x57DD: "player", 0x2242: "manager", 0x3066: "club", 0x0ECC: "standing"}
BEDINGT = {
    "je": "==", "jz": "==", "jne": "!=", "jnz": "!=",
    "jl": "<", "jnge": "<", "jle": "<=", "jng": "<=", "jg": ">", "jnle": ">", "jge": ">=", "jnl": ">=",
    "jb": "< (vzl.)", "jnae": "< (vzl.)", "jc": "< (vzl.)", "jbe": "<= (vzl.)", "jna": "<= (vzl.)",
    "ja": "> (vzl.)", "jnbe": "> (vzl.)", "jae": ">= (vzl.)", "jnb": ">= (vzl.)", "jnc": ">= (vzl.)",
    "js": "negativ", "jns": "nicht negativ", "jcxz": "cx == 0",
}


def befehle():
    out = []
    for l in open(ASM):
        m = RX.match(l)
        if m:
            out.append((int(m.group(1), 16), m.group(2).strip(), m.group(3), m.group(4).strip()))
    return out


def routine(alle, start):
    anf = sorted(a for a, b, op, args in alle if b == "55" and op == "push" and args == "%bp")
    i = bisect.bisect_right(anf, start)
    ende = anf[i] if i < len(anf) else start + 0x2000
    adr = [a for a, _, _, _ in alle]
    return alle[bisect.bisect_left(adr, start):bisect.bisect_left(adr, ende)], ende


def kommentiert(body):
    """Liefert je Befehl (adresse, text, notiz)."""
    img = open(BIN, "rb").read()
    funcs = load_funcs()
    es = None
    reg_basis, lokal, bx_ist = {}, {}, None
    out = []
    for a, b, op, args in body:
        notiz = []
        m_add = re.match(r"\$(0x[0-9a-f]+),%(\w+)$", args) if op == "add" else None
        if m_add and int(m_add.group(1), 16) in BASEN:
            reg_basis[m_add.group(2)] = BASEN[int(m_add.group(1), 16)]
        m_sp = re.match(r"%(\w+),(-0x[0-9a-f]+)\(%bp\)$", args) if op == "mov" else None
        if m_sp and m_sp.group(1) in reg_basis:
            lokal[m_sp.group(2)] = reg_basis[m_sp.group(1)]
        if op == "les" and args.endswith(",%bx"):
            # Nach `les` ist bx ein Fernzeiger: der Versatz dahinter ist ein Feld, keine Adresse.
            # Ist der Datensatz nicht bekannt, heißt er schlicht "zeiger".
            m_les = re.match(r"(-0x[0-9a-f]+)\(%bp\),%bx$", args)
            bx_ist = lokal.get(m_les.group(1), "zeiger") if m_les else "zeiger"
            notiz.append("bx -> " + bx_ist)
        elif re.search(r",%bx$", args):
            bx_ist = None
        if op == "mov":
            mm = re.match(r"(-?0x[0-9a-f]+),%es$", args)
            if mm:
                bx_ist = None
                p = DGROUP * 16 + (int(mm.group(1), 16) & 0xFFFF)
                es = struct.unpack("<H", img[p:p + 2])[0] if p + 2 <= len(img) else None
                notiz.append("es=%04x" % es if es is not None else "es=?")
        for mm in re.finditer(r"%es:(-?0x[0-9a-f]+)(\(%bx\))?", args):
            off = int(mm.group(1), 16) & 0xFFFF
            if mm.group(2) and bx_ist:
                notiz.append("%s+%d" % (bx_ist, off))
            elif es is not None:
                s = symbol(es, off)
                if s:
                    notiz.append(s)
        mm = re.search(r"lcall\s+\$0x([0-9a-f]+),\$0x([0-9a-f]+)", args if op == "lcall" else op + " " + args)
        if op == "lcall" and mm:
            key = (int(mm.group(1), 16), int(mm.group(2), 16))
            notiz.append(LIBS.get(key) or funcs.get(key[0] * 16 + key[1], "far %05x" % (key[0] * 16 + key[1])))
        if op == "call":
            m2 = re.match(r"0x([0-9a-f]+)", args)
            if m2:
                t = int(m2.group(1), 16)
                notiz.append(funcs.get(t, "near %05x" % t))
        out.append((a, op, args, ", ".join(notiz)))
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    start = int(sys.argv[1], 16)
    body, ende = routine(befehle(), start)
    zeilen = kommentiert(body)
    if "--liste" in sys.argv:
        for a, op, args, n in zeilen:
            print("%05x  %-7s %-38s %s" % (a, op, args, ("; " + n) if n else ""))
        return
    print("# Zweigbuch %05X\n" % start)
    print("Routine %05x bis %05x, %d Befehle. Erzeugt mit `tools/zweigbuch.py`; Spalten \"Bedingung\"" % (start, ende, len(body)))
    print("und \"Remake\" von Hand. Remake: `datei.ts:zeile`, **fehlt** oder *bewusst anders* mit Grund.\n")
    print("| Adresse | Vergleich | Sprung | Bedingung | Remake |")
    print("|---|---|---|---|---|")
    letzter = None
    for a, op, args, n in zeilen:
        if op in ("cmp", "cmpb", "cmpw", "test", "testb", "testw", "or", "and", "sub", "dec", "inc"):
            letzter = "`%s %s`%s" % (op, args, (" " + n) if n else "")
        if op in BEDINGT:
            print("| %05x | %s | %s → %s | | |" % (a, letzter or "", BEDINGT[op], args))
            letzter = None


if __name__ == "__main__":
    main()
