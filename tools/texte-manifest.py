#!/usr/bin/env python3
"""
texte-manifest.py - erzeugt tools/texte-manifest.json aus den Texten, die im Quelltext stehen.

Einmalwerkzeug je Gruppe: Es sucht jeden Text im entpackten BMMAIN.EXE und merkt sich nur
**Fundstelle, Länge und eine Prüfsumme** - nicht den Text selbst. Damit holt tools/texte.py die
Texte später aus der Installation des Nutzers, ohne dass sie je im Repo stehen.

    python3 tools/unexepack.py ../bmp/BMMAIN.EXE tools/out/bmmain
    python3 tools/texte-manifest.py tools/out/bmmain.bin

Eine Gruppe wandert so in den Katalog:
  1. Eintrag in GRUPPEN aufnehmen (Datei, Anker im Quelltext, Muster, Schlüssel)
  2. dieses Werkzeug laufen lassen, danach tools/texte.py
  3. erst dann die Texte im Quelltext durch texte("<Schlüssel>") ersetzen
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Alle Zeichenketten eines Blocks
ALLE = r'"((?:[^"\\\n]|\\.)*)"'
# Nur das Feld name: "..." (für Listen von Objekten)
NAME = r'name: "((?:[^"\\\n]|\\.)*)"'
LABEL = r'label: "((?:[^"\\\n]|\\.)*)"'

# (Datei, Anker des Blocks, Muster oder None, Schlüssel im Katalog, Endmarke)
GRUPPEN = [
    ("packages/core/src/sim/zeitung.ts", "export const HEADLINES = [", None, "zeitung.schlagzeilen", "\n];"),
    ("packages/core/src/sim/zeitung.ts", "export const ARTICLES = [", None, "zeitung.artikel", "\n];"),
    ("packages/core/src/sim/training.ts", "export const INJURIES:", None, "verletzungen", "\n].map"),
    ("packages/core/src/sim/training.ts", "export const CAMPS = [", NAME, "lager.namen", "\n] as const;"),
    ("packages/core/src/sim/training.ts", "export const CAMP_TRAITS = [", NAME, "lager.eigenschaften", "\n] as const;"),
    ("packages/core/src/sim/stadium.ts", "export const STADIUM_KINDS = [", NAME, "stadion.arten", "\n] as const;"),
    ("packages/core/src/sim/stadium.ts", "export const STADIUM_KINDS = [", LABEL, "stadion.kuerzel", "\n] as const;"),
    ("packages/core/src/sim/stadium.ts", "export const STADIUM_MESSAGES = [", None, "stadion.absagen", "\n];"),
    ("packages/core/src/sim/stadium.ts", "export const SIZE_NAMES = [", None, "stadion.groessen", "];"),
    ("packages/core/src/sim/stadium.ts", "export const STATUS_NAMES = [", None, "stadion.zustand", "];"),
    ("packages/core/src/sim/history.ts", "export const SERIES_ROWS = [", None, "verlauf.serien", "];"),
    ("packages/core/src/sim/history.ts", "export const RECORD_ROWS = [", None, "verlauf.rekorde", "];"),
    ("packages/core/src/sim/messages.ts", "export const WINTER_BREAK_LINES = [", None, "meldungen.winterpause", "];"),
    ("packages/core/src/sim/messages.ts", "export const RELEGATION_LINES = [", None, "meldungen.relegation", "];"),
    ("packages/core/src/sim/playerinfo.ts", "export const AGE_LABELS = [", None, "spielerinfo.alter", "];"),
    ("packages/core/src/sim/playerinfo.ts", "export const SIDE_LABELS = [", None, "spielerinfo.seiten", "];"),
    ("packages/core/src/sim/playerinfo.ts", "export const DATA_LABELS = [", None, "spielerinfo.zeilen", "];"),
    ("packages/core/src/sim/display.ts", "export const STRENGTH_MODES = [", None, "staerken.modi", "] as const;"),
    ("packages/core/src/sim/display.ts", "export const SQUAD_HELP = [", None, "ui.kaderhilfe", "\n];"),
    ("packages/core/src/sim/display.ts", "export const LIVE_TEXTS = [", None, "ui.konferenz", "\n];"),
    ("packages/core/src/sim/display.ts", "export const SHOOTOUT_TEXTS = [", None, "ui.elfmeter", "\n];"),
    ("packages/core/src/sim/display.ts", "export const TENDENCY_WORDS = [", None, "ui.tendenz", "\n];"),
    ("packages/core/src/sim/display.ts", "export const ROUND_NAMES = [", None, "pokal.runden", "];"),
    ("packages/core/src/sim/finance.ts", "export const CHRISTMAS_LINES = [", None, "finanzen.weihnachten", "\n];"),
    ("packages/core/src/sim/contracts.ts", "export const CONTRACT_REFUSALS = [", None, "ui.vertragsabsage", "\n];"),
]


# Umlaute stehen im Programm in der Kodierung des Spiels (siehe savefile.ts toDosText)
SPIEL = {"ä": "{", "ü": "}", "ö": "|", "ß": "~", "Ä": "[", "Ü": "]", "Ö": "\\"}


def spielkodierung(text):
    return "".join(SPIEL.get(c, c) for c in text)


# Manche Namen stehen im Programm in CP437 statt in der Kodierung des Spiels
CP437 = {"{": "\x84", "}": "\x81", "|": "\x94", "~": "\xe1", "[": "\x8e", "]": "\x9a", "\\": "\x99"}


def cp437(text):
    return "".join(CP437.get(c, c) for c in text)


def entwerten(literal):
    """Ein Zeichenkettenliteral aus dem Quelltext in seinen Inhalt umsetzen (\\u..., \\\\, ...)."""
    return json.loads('"' + literal + '"')


def roh(text):
    return text.encode("latin-1")


def eintrag(img, text, wo):
    for art, kandidat in (("gleich", text), ("spiel", spielkodierung(text)), ("cp437", cp437(text)), ("cp437", cp437(spielkodierung(text)))):
        b = roh(kandidat)
        off = img.find(b)
        if off >= 0:
            e = {"off": off, "len": len(b), "sum": hashlib.sha1(b).hexdigest()[:8]}
            # Der Quelltext schreibt teils echte Umlaute, teils die Kodierung des Spiels; das
            # Programm hat je nach Textbereich die Spielkodierung oder CP437
            if art == "cp437" and kandidat != text:
                e["cp437"] = True
            return e
    # Eine Schlagzeile des Originals hat einen Tippfehler: dort steht "%x" ohne die beiden
    # Ziffern, die der Textbaukasten erwartet. Der Quelltext hat sie ergänzt; das Manifest merkt
    # sich die Einfügung, damit im Repo kein Originaltext steht.
    for m in re.finditer(r"%x(\d\d)", text):
        variante = text[: m.start() + 2] + text[m.end():]
        bv = roh(variante)
        off = img.find(bv)
        if off < 0:
            continue
        return {
            "off": off,
            "len": len(bv),
            "sum": hashlib.sha1(bv).hexdigest()[:8],
            "einfuegen": [{"pos": len(roh(text[: m.start() + 2])), "text": m.group(1)}],
        }
    raise SystemExit(f"nicht gefunden in {wo}: {text!r}")


def main():
    img = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out", "bmmain.bin"), "rb").read()
    ziel = os.path.join(HERE, "texte-manifest.json")
    vorhanden = json.load(open(ziel, encoding="utf-8"))["gruppen"] if os.path.exists(ziel) else {}
    for datei, anker, muster, schluessel, ende in GRUPPEN:
        quelle = open(os.path.join(ROOT, datei), encoding="utf-8").read()
        if anker not in quelle:
            if schluessel in vorhanden:
                continue  # schon umgestellt, Manifest bleibt wie es ist
            raise SystemExit(f"Anker nicht gefunden: {anker} in {datei}")
        i = quelle.index(anker)
        block = quelle[i: quelle.index(ende, i)]
        texte = re.findall(muster or ALLE, block)
        if not texte:
            raise SystemExit(f"keine Texte im Block {anker} ({datei})")
        vorhanden[schluessel] = [eintrag(img, entwerten(t), schluessel) for t in texte]
        print(f"{schluessel}: {len(texte)} Texte")
    json.dump({"quelle": "BMMAIN.EXE (entpackt)", "gruppen": vorhanden}, open(ziel, "w"), indent=1)
    print("geschrieben:", ziel)


if __name__ == "__main__":
    main()
