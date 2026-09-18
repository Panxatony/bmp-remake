#!/usr/bin/env python3
"""
szene.py - Vorschau und Ausgabe eigener Torszenen (GitLab #6, Stufe 1).

    python3 tools/szene.py vorschau szene.json ordner/      Bildfolge als PNG
    python3 tools/szene.py export   szene.json ziel.T       im Format des Originals

Die Vorschau zeichnet wie das Spiel: Rasen aus assets/tore/pitch.png, Sprites aus sprites.png
bei y + 35, Tore aus goals.png an ihren festen Plätzen, danach der Kameraausschnitt 182x96.
"""
import json
import os
import struct
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TORE = os.path.join(HERE, "..", "assets", "tore")
KENNUNG = b"BM-Ed1.3-WK\0"
SICHT = (182, 96)


def zeichne(szene, nr, blatt, rasen, tore):
    kopf, sprites = szene["frames"][nr]
    bild = rasen.copy()
    for x, y, id0 in sprites:
        if id0 >= 1000:
            if id0 == 1000:
                bild.alpha_composite(tore.crop((0, 0, 24, 20)), (0, 54))
            else:
                bild.alpha_composite(tore.crop((24, 0, 46, 20)), (296, 54))
            continue
        klein = id0 >= 142
        breite = 4 if klein else 12
        spalte, zeile = id0 % 24, id0 // 24
        links = spalte * 12 + (4 if klein else 0)
        zelle = blatt.crop((links, zeile * 11, links + breite, zeile * 11 + 11))
        bild.alpha_composite(zelle, (x, y + 35))
    kx, ky = kopf & 0xFF, min(16, kopf >> 8)
    return bild.crop((kx, ky, kx + SICHT[0], ky + SICHT[1]))


def vorschau(pfad, ordner):
    szene = json.load(open(pfad, encoding="utf-8"))
    blatt = Image.open(os.path.join(TORE, "sprites.png")).convert("RGBA")
    rasen = Image.open(os.path.join(TORE, "pitch.png")).convert("RGBA")
    tore = Image.open(os.path.join(TORE, "goals.png")).convert("RGBA")
    os.makedirs(ordner, exist_ok=True)
    for nr in range(len(szene["frames"])):
        zeichne(szene, nr, blatt, rasen, tore).save(os.path.join(ordner, "%03d.png" % nr))
    print("geschrieben:", len(szene["frames"]), "Bilder nach", ordner)


def export(pfad, ziel):
    """Im Format des Originals schreiben: Kennung, vier Klangbilder, Bildzahl - 1, je Bild 164 Bytes."""
    szene = json.load(open(pfad, encoding="utf-8"))
    frames = szene["frames"]
    if not 1 <= len(frames) <= 256:
        raise SystemExit("Bildzahl %d passt nicht in ein Byte" % len(frames))
    out = bytearray(KENNUNG)
    kopf = (szene.get("header") or [255, 255, 255, 255])[:4]
    kopf += [255] * (4 - len(kopf))
    out += bytes(255 if k is None else k & 0xFF for k in kopf)
    out.append(len(frames) - 1)
    for kw, sprites in frames:
        if len(sprites) > 27:
            raise SystemExit("Bild mit %d Einträgen, erlaubt sind 27" % len(sprites))
        out += struct.pack("<H", kw & 0xFFFF)
        voll = list(sprites) + [[0, 77, 0]] * (27 - len(sprites))
        for x, y, nr in voll:
            out += struct.pack("<HHH", x & 0xFFFF, y & 0xFFFF, nr & 0xFFFF)
    autor = (szene.get("author") or "REMAKE").encode("latin-1", "replace")[:255]
    out.append(len(autor))
    out += autor
    open(ziel, "wb").write(bytes(out))
    print("geschrieben:", ziel, len(out), "Bytes")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    if sys.argv[1] == "vorschau":
        vorschau(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "export":
        export(sys.argv[2], sys.argv[3])
    else:
        raise SystemExit("Unbekannter Befehl: " + sys.argv[1])
