#!/usr/bin/env python3
"""
felder.py - Welche Datensatzfelder berührt eine Routine des Originals, die ihre Portierung
nie anfasst? (Abgleich, GitLab #78, Prüfung 4)

    python3 tools/felder.py ADRESSE DATEI.ts [DATEI.ts ...]

Die Routine reicht vom Einsprung bis zum nächsten `push %bp; mov %sp,%bp` - also samt aller
Ausgänge, nicht nur bis zum ersten `lret` wie in func.py. Gesammelt werden alle Zugriffe auf
die bekannten Datensätze (Manager, Kader, Verein, Spieler, Tabelle), getrennt nach Lesen,
Schreiben und Vergleichen. Für die angegebenen TypeScript-Dateien wird geprüft, ob die
Feldnummer dort überhaupt vorkommt (als `u8(N)`, `i32(N)`, `setU8(N`, `+ N` usw.).

Ein Feld, das das Original in einem **Vergleich** liest und die Portierung nicht kennt, ist der
heißeste Kandidat für einen unportierten Zweig: so hing #80 an Kaderfeld 48.

Ein Treffer ist ein Kandidat, kein Befund - siehe die Regel aus #77: erst prüfen, ob der Zweig
überhaupt erreicht wird.

Grenzen: Die Zeigerverfolgung kennt nur das Muster `add $BASIS` -> lokale Variable -> `les`.
Wird dieselbe lokale Variable später mit einem anderen Datensatz belegt, kann ein Zugriff dem
falschen Satz zugeschrieben werden (in 0x22C15 erscheint Kaderfeld 48 als "manager+48"). Und
die Prüfung sieht nur Zweige, die an einem **unbekannten** Feld hängen - eine andere Bedingung
auf einem bekannten Feld fällt ihr nicht auf.
"""
import bisect
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from func import BIN, ASM, DGROUP, symbol  # noqa: E402

RX = re.compile(r"^\s*([0-9a-f]+):\s+((?:[0-9a-f]{2} )+)\s*(\S+)\s*(.*)$")
VERGLEICH = ("cmp", "cmpb", "cmpw", "test", "testb", "testw")
# Nur lesend, auch wenn das Feld am Ende der Zeile steht
NUR_LESEN = ("push", "pushw")
DATENSAETZE = ("manager", "squad", "club", "player", "standing")


def lies_befehle():
    out = []
    for l in open(ASM):
        m = RX.match(l)
        if m:
            out.append((int(m.group(1), 16), m.group(2).strip(), m.group(3), m.group(4).strip()))
    return out


def felder(befehle, start):
    img = open(BIN, "rb").read()
    anfaenge = sorted(a for a, b, op, args in befehle if b == "55" and op == "push" and args == "%bp")
    i = bisect.bisect_right(anfaenge, start)
    ende = anfaenge[i] if i < len(anfaenge) else start + 0x2000
    es = None
    fund = {}
    # Zeiger auf Datensätze in lokalen Variablen: `add $BASIS,%reg` und danach
    # `mov %reg,-0xNN(%bp)`; ein späteres `les -0xNN(%bp),%bx` macht %bx zum Zeiger in den
    # Datensatz, und `%es:0xFF(%bx)` ist dann Feld FF (so liegt z.B. Kaderbyte 24 bei 0x0E5DC).
    BASEN = {0x774A: "squad", 0x57DD: "player", 0x2242: "manager", 0x3066: "club", 0x0ECC: "standing"}
    reg_basis = {}
    lokal = {}
    bx_ist = None
    for a, b, op, args in befehle:
        if a < start:
            continue
        if a >= ende:
            break
        m_add = re.match(r"\$(0x[0-9a-f]+),%(\w+)$", args) if op == "add" else None
        if m_add and int(m_add.group(1), 16) in BASEN:
            reg_basis[m_add.group(2)] = BASEN[int(m_add.group(1), 16)]
        m_sp = re.match(r"%(\w+),(-0x[0-9a-f]+)\(%bp\)$", args) if op == "mov" else None
        if m_sp and m_sp.group(1) in reg_basis:
            lokal[m_sp.group(2)] = reg_basis[m_sp.group(1)]
        if op == "les":
            m_les = re.match(r"(-0x[0-9a-f]+)\(%bp\),%bx$", args)
            bx_ist = lokal.get(m_les.group(1)) if m_les else None
        elif re.search(r",%bx$", args) and op not in VERGLEICH:
            bx_ist = None
        if bx_ist:
            for mm in re.finditer(r"%es:(0x[0-9a-f]+)\(%bx\)", args):
                feld = int(mm.group(1), 16)
                if op in VERGLEICH:
                    art = "vergleicht"
                elif op in NUR_LESEN:
                    art = "liest"
                elif args.rstrip().endswith(mm.group(0)):
                    art = "schreibt"
                else:
                    art = "liest"
                fund.setdefault((bx_ist, feld), {}).setdefault(art, []).append(a)
        if op == "mov":
            mm = re.match(r"(-?0x[0-9a-f]+),%es$", args)
            if mm:
                bx_ist = None  # neues Segment: der Datensatzzeiger aus `les` gilt nicht mehr
                p = DGROUP * 16 + (int(mm.group(1), 16) & 0xFFFF)
                es = struct.unpack("<H", img[p:p + 2])[0] if p + 2 <= len(img) else None
                continue
        for mm in re.finditer(r"%es:(-?0x[0-9a-f]+)", args):
            if es is None:
                continue
            s = symbol(es, int(mm.group(1), 16) & 0xFFFF)
            if not s:
                continue
            m2 = re.match(r"(\w+)(?:\[\d+\])?\+?(\d*)", s)
            if not m2 or m2.group(1) not in DATENSAETZE:
                continue
            name, feld = m2.group(1), int(m2.group(2) or 0)
            # Absolute Zugriffe mit fest eingerechnetem Satz (squad+1636 = Satz 31, Feld 24)
            feld %= {"manager": 778, "squad": 52, "club": 34, "player": 37, "standing": 54}[name]
            if op in VERGLEICH:
                art = "vergleicht"
            elif op in NUR_LESEN:
                art = "liest"
            elif args.rstrip().endswith(mm.group(0) + "(%bx)") or args.rstrip().endswith(mm.group(0) + "(%si)") \
                    or args.rstrip().endswith(mm.group(0) + "(%di)") or args.rstrip().endswith(mm.group(0)):
                art = "schreibt"
            else:
                art = "liest"
            fund.setdefault((name, feld), {}).setdefault(art, []).append(a)
    return fund, ende


# Felder, die die Portierung über Getter oder Hilfsfunktionen anspricht statt über die Nummer
# (records.ts, transfer.ts, attendance.ts)
DECKNAMEN = {
    30: ("clubIndex",),
    496: ("balance", "addBalance"),
    15: ("playerIndex",),
    10: ("number",),
    11: ("contractYears",),
    19: ("freshness",),
    26: ("fieldLine",),
    40: ("salary",),
}


def bekannt(feld, quelle):
    for f in range(feld, max(-1, feld - 4), -1):
        for name in DECKNAMEN.get(f, ()):
            if re.search(r"\b%s\b" % name, quelle):
                return True
        # Schreibhelfer wie `w(484, ...)` in attendance.ts
        if re.search(r"\bw\(\s*%d\b" % f, quelle):
            return True
    return _bekannt_nummer(feld, quelle)


def _bekannt_nummer(feld, quelle):
    # 32-Bit-Felder liest die Portierung als i32 ab dem Anfang: Feld 352 ist das hohe Wort von
    # i32(350). Deshalb zählen auch feld-1..feld-3 als bekannt.
    for f in range(feld, max(-1, feld - 4), -1):
        muster = re.compile(r"(?:u8|u16|i32|setU8|setU16|setI32|i16|writeI32)\((?:[^()]*,\s*)?%d\b|\+\s*%d\b|\b%d\s*\+|\[%d\]" % (f, f, f, f))
        if muster.search(quelle):
            return True
    return False


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    start = int(sys.argv[1], 16)
    quelle = "".join(open(f, encoding="utf-8").read() for f in sys.argv[2:])
    fund, ende = felder(lies_befehle(), start)
    print("Routine %05x bis %05x: %d Felder berührt" % (start, ende, len(fund)))
    fehlend = [(k, v) for k, v in sorted(fund.items()) if not bekannt(k[1], quelle)]
    for (name, feld), arten in fehlend:
        was = ", ".join("%s bei %s" % (art, " ".join("%05x" % a for a in adr[:3])) for art, adr in sorted(arten.items()))
        heiss = " <-- Vergleich" if "vergleicht" in arten else ""
        print("  %s+%d: %s%s" % (name, feld, was, heiss))
    if not fehlend:
        print("  alle Felder sind in der Portierung bekannt")


if __name__ == "__main__":
    main()
