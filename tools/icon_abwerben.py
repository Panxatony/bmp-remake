#!/usr/bin/env python3
"""
icon_abwerben.py - Symbol "Abwerben" (Version 2026) im Stil der Symbole aus PIC/3.VGA zeichnen:
ein Angler, der einen Ball an der Leine hat. 32x23 Punkte, Farben aus dem Symbolblatt.

    python3 tools/icon_abwerben.py            -> assets/pic/abwerben.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "eigen", "abwerben.png")

# Farben des Symbolblatts 3.VGA
BG = (0, 0, 112)
SCHWARZ = (0, 0, 0)
WEISS = (240, 240, 240)
HELL = (208, 192, 176)
HAUT = (176, 160, 128)
BRAUN = (144, 112, 80)
DUNKELBRAUN = (112, 64, 16)
GRAU = (160, 160, 192)
BLAUGRAU = (112, 112, 144)
DUNKEL = (48, 48, 80)
ROT = (176, 0, 32)

im = Image.new("RGB", (32, 23), BG)
d = ImageDraw.Draw(im)

# Angelrute: vom Griff in der Hand schräg nach rechts oben
d.line([(12, 13), (27, 2)], fill=DUNKELBRAUN)
d.line([(12, 14), (26, 3)], fill=BRAUN)
# Schnur von der Spitze nach unten
d.line([(27, 2), (29, 9)], fill=GRAU)
d.line([(29, 9), (29, 12)], fill=GRAU)

# Ball am Haken
d.ellipse([(25, 13), (31, 19)], fill=WEISS, outline=SCHWARZ)
d.point((28, 15), fill=DUNKEL)
d.point((27, 17), fill=DUNKEL)
d.point((29, 17), fill=DUNKEL)

# Angler: Kopf mit Haar
d.ellipse([(4, 3), (10, 9)], fill=HAUT, outline=SCHWARZ)
d.line([(5, 3), (9, 3)], fill=DUNKELBRAUN)
d.point((4, 4), fill=DUNKELBRAUN)
d.point((10, 4), fill=DUNKELBRAUN)
d.point((6, 6), fill=SCHWARZ)
d.point((9, 6), fill=SCHWARZ)
d.line([(7, 8), (8, 8)], fill=BRAUN)

# Trikot
d.rectangle([(3, 10), (11, 17)], fill=WEISS, outline=SCHWARZ)
d.line([(7, 11), (7, 16)], fill=ROT)

# Arme: der vordere hält die Rute, der hintere hängt am Körper
d.line([(11, 11), (13, 14)], fill=HAUT)
d.line([(12, 12), (14, 15)], fill=SCHWARZ)
d.line([(2, 11), (2, 15)], fill=HAUT)
d.line([(1, 11), (1, 15)], fill=SCHWARZ)

# Beine und Schuhe
d.rectangle([(4, 18), (6, 21)], fill=DUNKEL, outline=SCHWARZ)
d.rectangle([(8, 18), (10, 21)], fill=DUNKEL, outline=SCHWARZ)
d.line([(3, 22), (6, 22)], fill=SCHWARZ)
d.line([(8, 22), (11, 22)], fill=SCHWARZ)

im.save(os.path.abspath(OUT))
print("geschrieben:", os.path.abspath(OUT))
