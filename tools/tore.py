#!/usr/bin/env python3
"""
tore.py - Torszenen aus dem Ordner TORE lesen und als assets/tore/ ablegen.

    python3 tools/tore.py ../bmp

Erzeugt:
  assets/tore/scenes.json  Bildfolgen aller Szenen (Kopfbytes, Bilder, Autor)
  assets/tore/pitch.png    Hintergrund (PIC/26.VGA)
  assets/tore/sprites.png  Spielerfiguren (PIC/27.VGA, Farbe 0 durchsichtig)
  assets/tore/goals.png    Tore (PIC/29.VGA, Farbe 0 durchsichtig)

Aufbau einer Szenendatei (siehe docs/SPIELMECHANIK.md, "Live-Konferenz und Torszenen"):
Kennung "BM-Ed1.3-WK\\0" (12 Byte), vier Kopfbytes mit den Bildnummern für die Klänge
(0xFF = keiner), ein Byte Bildzahl - 1, dann je Bild 164 Byte: ein Kopfwort mit dem
Kameraausschnitt und 27 Sprites zu je drei Wörtern (x, y, Bildnummer). Am Ende steht der
Name des Erbauers, mit einem Längenbyte davor.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KENNUNG = b"BM-Ed1.3-WK\x00"


def szene(daten):
    if not daten.startswith(KENNUNG):
        return None
    p = len(KENNUNG)
    header = list(daten[p:p + 4])
    p += 4
    bilder = daten[p] + 1
    p += 1
    frames = []
    for _ in range(bilder):
        if p + 164 > len(daten):
            break
        kopf = struct.unpack_from("<H", daten, p)[0]
        sprites = []
        for k in range(27):
            x, y, nr = struct.unpack_from("<HHH", daten, p + 2 + 6 * k)
            sprites.append([x, y, nr])
        frames.append([kopf, sprites])
        p += 164
    autor = ""
    if p < len(daten):
        n = daten[p]
        autor = daten[p + 1:p + 1 + n].decode("latin-1").rstrip("\x00")
    return {"header": header, "frames": frames, "author": autor}


def bild(pfad, palpfad, durchsichtig):
    """Ein PIC/*.VGA über tools/vga.py laden (mit oder ohne durchsichtige Farbe 0)."""
    sys.path.insert(0, HERE)
    import vga  # noqa: E402
    from PIL import Image

    breite, hoehe, pixel = vga.decode(pfad)
    pal = vga.palette(palpfad)
    pixel = (pixel + bytes(breite * hoehe))[: breite * hoehe]
    im = Image.new("RGBA", (breite, hoehe))
    im.putdata([
        (0, 0, 0, 0) if durchsichtig and v == 0 else tuple(pal[v * 3: v * 3 + 3]) + (255,)
        for v in pixel
    ])
    return im


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    quelle = sys.argv[1]
    ziel = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "tore")
    os.makedirs(ziel, exist_ok=True)
    ordner = os.path.join(quelle, "TORE")
    szenen = {}
    for name in sorted(os.listdir(ordner)):
        pfad = os.path.join(ordner, name)
        if not os.path.isfile(pfad):
            continue
        s = szene(open(pfad, "rb").read())
        if s:
            szenen[name] = s
    json.dump(szenen, open(os.path.join(ziel, "scenes.json"), "w"), separators=(",", ":"))
    pal = os.path.join(quelle, "PIC", "1.PAL")
    for datei, nummer, durchsichtig in [("pitch.png", 26, True), ("sprites.png", 27, True), ("goals.png", 29, True)]:
        bild(os.path.join(quelle, "PIC", f"{nummer}.VGA"), pal, durchsichtig).save(os.path.join(ziel, datei))
    print(f"{len(szenen)} Torszenen und drei Bilder -> {ziel}")


if __name__ == "__main__":
    main()
