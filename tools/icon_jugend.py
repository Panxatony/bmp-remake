#!/usr/bin/env python3
"""
icon_jugend.py - Symbol "Jugendarbeit" (Version 2026) im Stil der Symbole aus PIC/3.VGA
zeichnen: ein kleiner Spieler mit Ball auf dem Rasen, daneben ein Pfeil nach oben
(das Talent waechst). 32x23 Punkte, Farben aus dem Symbolblatt.

    python3 tools/icon_jugend.py            -> assets/eigen/jugend.png
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "eigen", "jugend.png")

# Farben des Symbolblatts 3.VGA
BG = (0, 0, 112)
SCHWARZ = (0, 0, 0)
WEISS = (240, 240, 240)
HAUT = (176, 160, 128)
BRAUN = (144, 112, 80)
DUNKELBRAUN = (112, 64, 16)
GRUEN = (0, 112, 32)
HELLGRUEN = (32, 160, 48)
GRAU = (160, 160, 192)
DUNKEL = (48, 48, 80)
ROT = (176, 0, 32)
GELB = (240, 208, 64)

im = Image.new("RGB", (32, 23), BG)
d = ImageDraw.Draw(im)

# Rasen
d.rectangle([(0, 19), (31, 22)], fill=GRUEN)
d.line([(0, 19), (31, 19)], fill=HELLGRUEN)

# Pfeil nach oben rechts im Bild: das Talent waechst
d.polygon([(26, 2), (30, 7), (22, 7)], fill=GELB, outline=SCHWARZ)
d.rectangle([(24, 7), (28, 14)], fill=GELB, outline=SCHWARZ)

# Kleiner Spieler: grosser Kopf, kurze Beine
d.ellipse([(6, 2), (14, 10)], fill=HAUT, outline=SCHWARZ)
d.line([(7, 2), (13, 2)], fill=DUNKELBRAUN)
d.arc([(6, 1), (14, 9)], start=180, end=360, fill=DUNKELBRAUN)
d.point((8, 6), fill=SCHWARZ)
d.point((12, 6), fill=SCHWARZ)
d.line([(9, 8), (11, 8)], fill=BRAUN)

# Trikot
d.rectangle([(6, 11), (14, 16)], fill=WEISS, outline=SCHWARZ)
d.line([(10, 12), (10, 15)], fill=ROT)

# Arme
d.line([(5, 12), (4, 15)], fill=HAUT)
d.line([(4, 12), (3, 15)], fill=SCHWARZ)
d.line([(15, 12), (16, 15)], fill=HAUT)
d.line([(16, 12), (17, 15)], fill=SCHWARZ)

# Beine und Schuhe
d.rectangle([(7, 17), (9, 19)], fill=DUNKEL, outline=SCHWARZ)
d.rectangle([(11, 17), (13, 19)], fill=DUNKEL, outline=SCHWARZ)
d.line([(6, 20), (9, 20)], fill=SCHWARZ)
d.line([(11, 20), (14, 20)], fill=SCHWARZ)

# Ball vor den Fuessen
d.ellipse([(16, 15), (22, 21)], fill=WEISS, outline=SCHWARZ)
d.point((19, 17), fill=DUNKEL)
d.point((18, 19), fill=DUNKEL)
d.point((20, 19), fill=DUNKEL)

im.save(os.path.abspath(OUT))
print("geschrieben:", os.path.abspath(OUT))
