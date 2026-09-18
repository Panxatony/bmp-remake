#!/usr/bin/env python3
"""
eigenetexte.py - Zeichenketten im Quelltext finden, die wörtlich aus dem Original stammen.

Für die Veröffentlichung (GitLab #5) darf kein Text des Originals im Repo stehen; er gehört
über tools/texte-manifest.json in den Katalog. Dieses Werkzeug vergleicht jede Zeichenkette
im Quelltext mit dem entpackten BMMAIN.EXE - in beiden Kodierungen (Umlaute als ä ö ü ß und
in der Belegung des Spiels { | } ~).

    python3 tools/unexepack.py <bmp>/BMMAIN.EXE tools/out/bmmain
    python3 tools/eigenetexte.py tools/out/bmmain.bin [MINDESTLÄNGE]
"""
import os
import re
import sys

BIN = sys.argv[1] if len(sys.argv) > 1 else "tools/out/bmmain.bin"
MIN = int(sys.argv[2]) if len(sys.argv) > 2 else 10
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

d = open(BIN, "rb").read()
SPIEL = {"ä": "{", "ö": "|", "ü": "}", "ß": "~", "Ä": "[", "Ö": "\\", "Ü": "]"}


def wortweise(text):
    """Text, dann immer kürzere Wortfolgen vom Anfang - das Original bricht Sätze in Zeilen."""
    worte = text.split()
    for n in range(len(worte), 1, -1):
        teil = " ".join(worte[:n])
        if len(teil) >= MIN:
            yield teil


def im_original(text):
    """Längster Anfang des Texts, der wörtlich im Programm steht: (Fundstelle, Text) oder None."""
    for teil in wortweise(text):
        for fassung in (teil, "".join(SPIEL.get(c, c) for c in teil)):
            i = d.find(fassung.encode("latin1", "ignore"))
            if i >= 0:
                return i, teil
    return None


# Zeichenketten aus dem Quelltext: "..." und `...`; in Schablonen zählt jeder Baustein zwischen
# den Platzhaltern für sich (dort stecken die Formulierungen des Originals, z.B. `${name} kehrt
# Ihrem Verein den Rücken.`)
# Der Name des Spiels ist keine Anzeige aus dem Original, sondern benennt, was hier läuft.
ERLAUBT = {"Bundesliga Manager Server: http://localhost:"}

LITERAL = re.compile(r'"((?:[^"\\\n]|\\.)*)"|`([^`\n]*)`')


def bausteine(text):
    for teil in re.split(r"\$\{[^}]*\}", text):
        teil = teil.strip()
        if len(teil) >= MIN:
            yield teil
treffer = []
for dp, _, fs in os.walk(os.path.join(ROOT, "packages")):
    if "node_modules" in dp:
        continue
    for f in fs:
        if not f.endswith(".ts"):
            continue
        p = os.path.join(dp, f)
        for nr, zeile in enumerate(open(p, encoding="utf-8"), 1):
            if zeile.lstrip().startswith(("*", "//", "/*")):
                continue
            for m in LITERAL.finditer(zeile):
                roh = (m.group(1) if m.group(1) is not None else m.group(2) or "").replace('\\"', '"')
                for text in bausteine(roh):
                    if not re.search(r"[A-Za-zÄÖÜäöü]{3}\s+\S", text):
                        continue  # nur Formulierungen, keine Einzelwörter (siehe README)
                    if text in ERLAUBT:
                        continue
                    fund = im_original(text)
                    if fund is not None:
                        treffer.append((os.path.relpath(p, ROOT), nr, fund[0], fund[1]))

print(f"{len(treffer)} Zeichenketten aus dem Original im Quelltext (Mindestlänge {MIN})\n")
for pfad, nr, stelle, text in sorted(treffer):
    print(f"{pfad}:{nr}  0x{stelle:05X}  {text}")
sys.exit(1 if treffer else 0)
