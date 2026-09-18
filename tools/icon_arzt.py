#!/usr/bin/env python3
"""
icon_arzt.py - Symbol "Arzt" (Version 2026) im Stil der Symbole aus PIC/3.VGA zeichnen:
ein Sanitätskoffer mit rotem Kreuz. 32x23 Punkte, Farben aus dem Symbolblatt.

    python3 tools/icon_arzt.py            -> assets/eigen/arzt.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "eigen", "arzt.png")

# Farben des Symbolblatts 3.VGA
BG = (0, 0, 112)
SCHWARZ = (0, 0, 0)
WEISS = (240, 240, 240)
HELL = (208, 192, 176)
GRAU = (160, 160, 192)
DUNKELGRAU = (112, 112, 144)
DUNKEL = (48, 48, 80)
ROT = (176, 0, 32)
HELLROT = (224, 32, 48)

im = Image.new("RGB", (32, 23), BG)
d = ImageDraw.Draw(im)

# Griff über dem Koffer
d.arc([(12, 1), (20, 9)], start=180, end=360, fill=DUNKELGRAU)
d.arc([(13, 2), (19, 8)], start=180, end=360, fill=GRAU)

# Koffer: Deckel etwas heller als der Korpus, schwarze Umrandung
d.rectangle([(4, 6), (27, 20)], fill=HELL, outline=SCHWARZ)
d.rectangle([(4, 6), (27, 9)], fill=WEISS, outline=SCHWARZ)
# Kante zwischen Deckel und Korpus
d.line([(5, 10), (26, 10)], fill=GRAU)
# Schatten an der unteren und rechten Innenkante
d.line([(5, 19), (26, 19)], fill=GRAU)
d.line([(26, 11), (26, 19)], fill=GRAU)

# Verschluss in der Mitte des Deckels
d.rectangle([(14, 8), (17, 11)], fill=DUNKELGRAU, outline=SCHWARZ)

# Rotes Kreuz auf dem Korpus
d.rectangle([(14, 12), (17, 18)], fill=ROT)
d.rectangle([(12, 14), (19, 16)], fill=ROT)
# Glanzkante des Kreuzes
d.line([(14, 12), (17, 12)], fill=HELLROT)
d.line([(12, 14), (19, 14)], fill=HELLROT)

# Standschatten
d.line([(5, 21), (26, 21)], fill=DUNKEL)

im.save(os.path.abspath(OUT))
print("geschrieben:", os.path.abspath(OUT))
