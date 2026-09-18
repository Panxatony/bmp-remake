#!/usr/bin/env python3
"""
texte.py - holt die Spieltexte aus der eigenen Installation und schreibt assets/text/spiel.json.

Im Repo steht kein Text des Originals. Das Manifest tools/texte-manifest.json merkt sich nur,
**wo** jeder Text im entpackten BMMAIN.EXE liegt (Fundstelle, Länge, Prüfsumme); dieses Werkzeug
schneidet sie dort heraus.

    python3 tools/texte.py ../bmp/BMMAIN.EXE          -> assets/text/spiel.json
    python3 tools/texte.py ../bmp/BMMAIN.EXE ziel.json

Die EXE ist mit EXEPACK gepackt; das Entpacken erledigt tools/unexepack.py mit.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile

VON_CP437 = {"\x84": "{", "\x81": "}", "\x94": "|", "\xe1": "~", "\x8e": "[", "\x9a": "]", "\x99": "\\"}

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def entpacken(exe):
    """BMMAIN.EXE entpacken (oder die Datei nehmen, wenn sie schon entpackt ist)."""
    roh = open(exe, "rb").read()
    if roh[:2] not in (b"MZ", b"ZM"):
        return roh
    # unexepack.py hängt ".bin" an den zweiten Parameter an
    stamm = os.path.join(tempfile.gettempdir(), "bmmain-entpackt")
    subprocess.run([sys.executable, os.path.join(HERE, "unexepack.py"), exe, stamm], check=True,
                   stdout=subprocess.DEVNULL)
    return open(stamm + ".bin", "rb").read()


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    img = entpacken(sys.argv[1])
    ziel = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "text", "spiel.json")
    manifest = json.load(open(os.path.join(HERE, "texte-manifest.json"), encoding="utf-8"))
    katalog = {}
    fehler = 0
    for gruppe, eintraege in manifest["gruppen"].items():
        texte = []
        for e in eintraege:
            b = img[e["off"]: e["off"] + e["len"]]
            if hashlib.sha1(b).hexdigest()[:8] != e["sum"]:
                print(f"Prüfsumme passt nicht: {gruppe}[{len(texte)}] bei {e['off']}", file=sys.stderr)
                fehler += 1
            t = b.decode("latin-1")
            if e.get("cp437"):
                # Namen, die im Programm in CP437 stehen, in die Kodierung des Spiels bringen
                t = "".join(VON_CP437.get(c, c) for c in t)
            # Kleine Berichtigungen an Tippfehlern des Originals (siehe texte-manifest.py)
            for ein in reversed(e.get("einfuegen", [])):
                t = t[: ein["pos"]] + ein["text"] + t[ein["pos"]:]
            texte.append(t)
        katalog[gruppe] = texte
    if fehler:
        raise SystemExit(f"{fehler} Texte passen nicht - ist das die richtige Fassung von BMMAIN.EXE?")
    os.makedirs(os.path.dirname(ziel), exist_ok=True)
    json.dump(katalog, open(ziel, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{sum(len(v) for v in katalog.values())} Texte in {len(katalog)} Gruppen -> {ziel}")


if __name__ == "__main__":
    main()
