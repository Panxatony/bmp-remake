#!/usr/bin/env python3
"""
icon_scroll.py - die drei Knöpfe der Meldungsliste im Hauptmenü zeichnen (Pfeil hoch, X,
Pfeil runter), 19x123 in den Farben des Spiels.

    python3 tools/icon_scroll.py            -> assets/eigen/menu-scroll.png

Eigene Zeichnung nach den am Original abgelesenen Maßen: je Knopf 19x41, außen ein Rahmen aus
Palettenfarbe 1 (oben/links) und 7 (unten/rechts), darin ein eingelassenes Feld in Farbe 4, und
darauf das Zeichen in Weiß mit einem Schatten in Farbe 6.
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "eigen", "menu-scroll.png")

HELL = (162, 162, 195)     # Palette 1
GRAU = (97, 97, 130)       # Palette 4
DUNKEL = (48, 48, 81)      # Palette 7
SCHATTEN = (65, 65, 97)    # Palette 6
WEISS = (243, 243, 243)    # Palette 29
SCHWARZ = (0, 0, 0)

B, H = 19, 41


def knopf(d, oy, zeichen):
    # Rahmen: zwei Stufen hell nach innen, rechts und unten dunkel
    d.rectangle([0, oy, B - 1, oy + H - 1], fill=GRAU)
    d.line([(0, oy), (B - 1, oy)], fill=DUNKEL)
    d.line([(1, oy + 1), (B - 2, oy + 1)], fill=HELL)
    d.point((1, oy + 1), fill=WEISS)
    d.line([(2, oy + 2), (B - 3, oy + 2)], fill=HELL)
    d.point((2, oy + 2), fill=WEISS)
    d.line([(1, oy + 1), (1, oy + H - 2)], fill=HELL)
    d.line([(2, oy + 2), (2, oy + H - 3)], fill=HELL)
    d.line([(B - 1, oy + 2), (B - 1, oy + H - 1)], fill=DUNKEL)
    d.line([(B - 2, oy + 3), (B - 2, oy + H - 2)], fill=DUNKEL)
    d.line([(3, oy + H - 2), (B - 1, oy + H - 2)], fill=DUNKEL)
    d.line([(2, oy + H - 1), (B - 1, oy + H - 1)], fill=DUNKEL)
    # eingelassenes Feld
    d.line([(4, oy + 4), (14, oy + 4)], fill=WEISS)
    d.line([(5, oy + 4), (14, oy + 4)], fill=HELL)
    d.point((4, oy + 4), fill=WEISS)
    d.line([(4, oy + 5), (4, oy + 36)], fill=HELL)
    d.line([(15, oy + 5), (15, oy + 36)], fill=DUNKEL)
    d.line([(5, oy + 37), (15, oy + 37)], fill=DUNKEL)
    if zeichen in ("hoch", "runter"):
        pfeil(d, oy, zeichen == "runter")
    else:
        kreuz(d, oy)


def pfeil(d, oy, runter):
    def y(v):
        return oy + (43 - v if runter else v)
    # Spitze und Schaft
    for i, breite in enumerate(range(1, 8, 2)):
        links = 9 - i
        d.line([(links, y(9 + 2 * i)), (links + breite - 1, y(9 + 2 * i))], fill=WEISS)
        d.line([(links, y(10 + 2 * i)), (links + breite - 1, y(10 + 2 * i))], fill=WEISS)
        d.point((links + breite, y(10 + 2 * i)), fill=SCHATTEN)
        d.point((links - 1, y(9 + 2 * i)), fill=SCHWARZ)
    oben, unten = sorted((y(22), y(33)))
    d.rectangle([8, oben, 10, unten], fill=WEISS)
    a, b = sorted((y(22), y(34)))
    d.line([(11, a), (11, b)], fill=SCHATTEN)


def kreuz(d, oy):
    for i in range(8):
        d.point((6 + i, oy + 13 + i), fill=WEISS)
        d.point((7 + i, oy + 13 + i), fill=WEISS)
        d.point((13 - i, oy + 13 + i), fill=WEISS)
        d.point((12 - i, oy + 13 + i), fill=WEISS)


def main():
    im = Image.new("RGB", (B, 3 * H), GRAU)
    d = ImageDraw.Draw(im)
    for i, zeichen in enumerate(("hoch", "kreuz", "runter")):
        knopf(d, i * H, zeichen)
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    im.save(os.path.abspath(OUT))
    print("geschrieben:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
