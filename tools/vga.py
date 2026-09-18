#!/usr/bin/env python3
"""
vga.py - Prototyp zum Dekodieren der Bilder in PIC/*.VGA.

Kopf: u16 Breite, u16 Höhe, u16 Länge der Bilddaten. Danach Lauflängen-
kodierte Pixel (8 Bit Palettenindex), Regel aus der Zeichenroutine in
BMMAIN.EXE (Ladeadresse 0x38BE0):

    Byte b < 0x80: die folgenden b + 1 Bytes sind Pixel (wörtlich kopieren)
    Byte b >= 0x80: (b & 0x7F) + 1 Pixel in der Farbe des Folgebytes
    Byte 0x80: Ende

Palette PIC/1.PAL: 256 x 3 Bytes, 6-Bit-VGA-Werte.

    python3 tools/vga.py PIC/26.VGA PIC/1.PAL out.png [SKALIERUNG]
    python3 tools/vga.py --all PIC/ ausgabe/          # alle Bilder als PNG
"""
import struct
import sys

from PIL import Image


def decode(path):
    d = open(path, "rb").read()
    w, h, size = struct.unpack("<HHH", d[:6])
    data = d[6:6 + size]
    px = bytearray()
    i = 0
    while i < len(data):
        b = data[i]
        i += 1
        if b & 0x80:
            n = b & 0x7F
            if n == 0:
                break
            px += bytes([data[i]]) * (n + 1)
            i += 1
        else:
            px += data[i:i + b + 1]
            i += b + 1
    return w, h, px


def palette(path):
    pal = open(path, "rb").read()
    out = []
    for i in range(256):
        r, g, b = pal[i * 3:i * 3 + 3]
        # 6-Bit-VGA auf 8 Bit wie die Grafikkarte: die oberen zwei Bits wandern nach unten
        # nach ((v << 2) | (v >> 4)). Mit dem früheren v * 4 waren alle Bilder um bis zu drei
        # Stufen zu dunkel, und kein Bildvergleich gegen DOSBox ging sauber auf (GitLab #56).
        out += [(r << 2) | (r >> 4), (g << 2) | (g >> 4), (b << 2) | (b >> 4)]
    return out


def save_png(src, pal, dst, scale):
    w, h, px = decode(src)
    if len(px) != w * h:
        print("Warnung: %s hat %d Pixel, erwartet %d" % (src, len(px), w * h))
    px = (px + bytes(w * h))[:w * h]
    img = Image.new("P", (w, h))
    img.putdata(bytes(px))
    img.putpalette(pal)
    img.convert("RGB").resize((w * scale, h * scale), Image.NEAREST).save(dst)
    return w, h


# Bilder, die das Spiel mit Farbe 0 durchsichtig blittet (Maskenblitter 0x76b:0x2e4). Farbe 31
# ist ebenfalls schwarz und muss deckend bleiben, darum ein zweites PNG mit Alphakanal.
# 40.VGA hält die Aufsätze des Stadionbilds (Flutlichtmasten und Anzeigetafeln, je drei Größen
# mal drei Zustandsfarben); sie werden über das Grundbild geblittet, Farbe 0 bleibt frei.
MASKED = ["1.VGA", "3.VGA", "43.VGA", "40.VGA"]

# Die Sportzeitung schaltet auf eine eigene 16-stufige Graupalette um (siehe
# docs/SPIELMECHANIK.md, "Sportzeitung"). Kopf und Fotos müssen damit umgesetzt werden, sonst
# sind sie bunt. Die Palette ist keine Wertetabelle, sondern eine Regel: der Grauwert von Farbe i
# ist das **spiegelverkehrte Halbbyte** von i, mal vier - Farbe 1 (0001) wird 1000 = 8 und damit
# 32 von 63, Farbe 8 (1000) wird 0001 = 1 und damit 4. So läuft die Helligkeit über die Farben
# gestreut statt der Reihe nach. Vorher standen hier aus DOSBox-Aufnahmen abgelesene Werte; zwei
# davon waren um einen Schritt daneben (GitLab #56).
def _grauwert(i):
    """Halbbyte spiegeln, mal vier - und wie die Grafikkarte auf acht Bit spreizen."""
    v = int("{:04b}".format(i)[::-1], 2) * 4
    return (v << 2) | (v >> 4)


GRAU = [_grauwert(i) for i in range(16)]
GRAU_BILDER = ["44.VGA"] + ["%d.VGA" % n for n in range(200, 230)]


def graupalette():
    pal = [0] * 768
    for i, wert in enumerate(GRAU):
        pal[i * 3: i * 3 + 3] = [wert, wert, wert]
    return pal


def save_rgba(src, pal, dst):
    w, h, px = decode(src)
    px = (px + bytes(w * h))[:w * h]
    img = Image.new("RGBA", (w, h))
    img.putdata([(0, 0, 0, 0) if v == 0 else tuple(pal[v * 3:v * 3 + 3]) + (255,) for v in px])
    img.save(dst)


def main():
    if sys.argv[1] == "--all":
        import os
        srcdir, dstdir = sys.argv[2:4]
        os.makedirs(dstdir, exist_ok=True)
        pal = palette(os.path.join(srcdir, "1.PAL"))
        grau = graupalette()
        for f in sorted(os.listdir(srcdir)):
            if f.upper().endswith((".VGA", ".CP")):
                p = grau if f in GRAU_BILDER else pal
                w, h = save_png(os.path.join(srcdir, f), p, os.path.join(dstdir, f + ".png"), 1)
                if f in MASKED:
                    save_rgba(os.path.join(srcdir, f), pal, os.path.join(dstdir, f + ".a.png"))
                print("%-10s %4dx%-4d" % (f, w, h))
        return
    src, palfile, dst = sys.argv[1:4]
    scale = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    w, h = save_png(src, palette(palfile), dst, scale)
    print("%s: %dx%d -> %s" % (src, w, h, dst))


if __name__ == "__main__":
    main()
