#!/usr/bin/env python3
"""
fonts.py - Bitmap-Schriften aus BMLOADER.EXE extrahieren.

Die Schriften liegen unkomprimiert im Ladeprogramm. Je Glyphe ein Datensatz:
1 Byte Breite (Vorschub in Pixeln), dann `height` Pixelzeilen als Bytes (Bit 7 =
links). Zeichen in ASCII-Reihenfolge ab 0x20, proportional. Die Plätze von
[ \\ ] { | } ~ enthalten Ä Ö Ü ä ö ü ß, genau wie die Texte des Spiels sie benutzen.

Schrift "normal" (8 Zeilen, Überschriften): drei Bereiche, 0x1AC0 für 0x20..0x3F,
direkt anschließend 0x41..0x5D, ab 0x1CED für 0x61..0x7E; ohne @ ^ _ `.
Schrift "micro" (6 Zeilen, Tabellen): 0x177D für 0x20..0x5F, anschließend 0x61..0x7E.

    python3 tools/fonts.py ../bmp/BMLOADER.EXE assets/font
"""
import json
import os
import sys

from PIL import Image

# name: (höhe, [(dateioffset, erstes zeichen, letztes zeichen), ...])
FONTS = {
    "normal": (8, [(0x1AC0, 0x20, 0x3F), (0x1AC0 + 32 * 9, 0x41, 0x5D), (0x1CED, 0x61, 0x7E)]),
    # Tabellenschrift, 4 Pixel breit, 6 Zeilen; ohne das Zeichen `
    "micro": (6, [(0x177D, 0x20, 0x5F), (0x177D + 64 * 7, 0x61, 0x7E)]),
}


# Die großen Datensätze 0x23..0x26 tragen ! " $ % erst weiter hinten, als die Reihenfolge
# erwarten lässt (die ersten drei Datensätze der Schrift stehen im Ladeprogramm überschrieben
# da). Im Original nachgemessen: der Zinssatz der Bank steht als "6%" auf dem Bildschirm und
# benutzt dafür das Prozentzeichen aus dem Platz von &. Das Ausrufezeichen liegt im Platz von #
# (GitLab #31: "Achtung !" im Hinweiskasten der Winterpause, im Original als breiter Strich mit
# Punkt zu sehen; im eigenen Platz 0x21 stehen Zeigerdaten, das gab ein gemustertes Kästchen).
# Ziffern, Buchstaben, Klammern, Punkt und Apostroph stimmen dagegen mit ihrem Platz überein.
SHIFTED = {"normal": {0x21: 0x23, 0x22: 0x24, 0x24: 0x25, 0x25: 0x26}}


def extract(data, height, ranges, name=""):
    """Liefert {zeichen: (breite, [zeilen])}."""
    glyphs = {}
    rec = height + 1
    for start, first, last in ranges:
        for ch in range(first, last + 1):
            off = start + (ch - first) * rec
            w = data[off]
            if w > 8:  # die ersten Datensätze tragen keine brauchbare Breite
                w = 4
            glyphs[ch] = (w, list(data[off + 1:off + rec]))
    for ch, src in SHIFTED.get(name, {}).items():
        if src in glyphs:
            glyphs[ch] = glyphs[src]
    return glyphs


def sheet(glyphs, height, cols=32):
    chars = sorted(glyphs)
    rows = (len(chars) + cols - 1) // cols
    img = Image.new("L", (cols * 8, rows * height), 0)
    for i, ch in enumerate(chars):
        x0, y0 = (i % cols) * 8, (i // cols) * height
        for r, b in enumerate(glyphs[ch][1]):
            for bit in range(8):
                if b & (0x80 >> bit):
                    img.putpixel((x0 + bit, y0 + r), 255)
    return img


def render(glyphs, height, lines, scale=4):
    width = max(sum(glyphs[ord(c)][0] for c in l if ord(c) in glyphs) for l in lines)
    img = Image.new("L", (width + 8, len(lines) * (height + 2)), 0)
    for li, text in enumerate(lines):
        x = 0
        for c in text:
            g = glyphs.get(ord(c))
            if not g:
                continue
            w, rows = g
            for r, b in enumerate(rows):
                for bit in range(8):
                    if b & (0x80 >> bit):
                        img.putpixel((x + bit, li * (height + 2) + r), 255)
            x += w
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


# Schrift 3 (16 Zeilen, Tageszahl im Kalenderblatt) steht nicht im Ladeprogramm, sondern im
# entpackten BMMAIN.EXE: Zeigertabelle ab 0x362B4 für 0x20..0x7E, Glyphen bei 0x35AC0 + Zeiger,
# Datensatz = Breitenbyte und 16 Zeilen zu ceil(Breite/8) Bytes. Zeiger 0x8B2 ist der leere
# Platzhalter für alle Zeichen, die die Schrift nicht hat.
BIG = {"table": 0x362B4, "base": 0x35AC0, "height": 16, "empty": 0x8B2, "bits": 24}


def extract_big(data):
    import struct
    t, base, h = BIG["table"], BIG["base"], BIG["height"]
    widths, glyphs = [], []
    for c in range(0x20, 0x7F):
        off = struct.unpack("<H", data[t + 2 * (c - 0x20):t + 2 * (c - 0x20) + 2])[0]
        p = base + off
        w = data[p]
        bpr = (w + 7) // 8
        rows = []
        for r in range(h):
            v = 0
            for b in range(bpr):
                v = (v << 8) | data[p + 1 + r * bpr + b]
            rows.append(v << (BIG["bits"] - 8 * bpr))
        widths.append(w)
        glyphs.append(rows)
    return {"height": h, "first": 0x20, "bits": BIG["bits"], "widths": widths, "glyphs": glyphs}


def main():
    src, dst = sys.argv[1:3]
    data = open(src, "rb").read()
    os.makedirs(dst, exist_ok=True)
    if len(sys.argv) > 3:
        big = extract_big(open(sys.argv[3], "rb").read())
        json.dump(big, open(os.path.join(dst, "gross.json"), "w"))
        print("gross      %d Zeichen" % len(big["widths"]))
    for name, (height, ranges) in FONTS.items():
        g = extract(data, height, ranges, name)
        first, last = 0x20, 0x7E
        json.dump({"height": height, "first": first,
                   "widths": [g[c][0] if c in g else 0 for c in range(first, last + 1)],
                   "glyphs": [g[c][1] if c in g else [0] * height for c in range(first, last + 1)]},
                  open(os.path.join(dst, name + ".json"), "w"))
        sh = sheet(g, height)
        sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST).save(os.path.join(dst, name + ".png"))
        render(g, height, ["IHRE MANNSCHAFT", "K\\PKE 17 89 97 55", "Gr}ndel B[urle {|}~[]\\"]).save(os.path.join(dst, name + "-probe.png"))
        print(name, "%d Glyphen, %dx%d" % (len(g), 8, height))


if __name__ == "__main__":
    main()
