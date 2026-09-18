#!/usr/bin/env python3
"""
mess.py - Zuschauermessung im Original (GitLab #23).

    mess.py NAME AUSGABE.png

Startet DOSBox, lädt den Spielstand NAME, schaltet den Tag an bis die Live-Konferenz
läuft, und sichert die Zuschauerfelder der Konferenztafel. Die Zahl steht dort, sobald
angepfiffen ist (im Original in der Spielvorbereitung gezogen, 0x1C632) - der Rest des
Spiels muss dafür nicht laufen, das spart je Messung rund zwanzig Minuten.

Die Zuschauerzahl landet danach auch im Spielstand (Managerbyte 484 als Summe, 330+n als
Reihe in Tausend); wer sie von dort lesen will, spielt den Tag mit drive.py replay zu Ende.
"""
import os
import subprocess
import sys
import time

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive

# Konferenztafel (320x240): je Seite die Zeile mit den Vereinsnamen und darunter das
# Zuschauerfeld. Beide Tafeln oben gehören zu den Spielen der Manager.
FELDER = [(0, 1, 160, 11), (0, 88, 80, 102), (160, 1, 320, 11), (160, 88, 240, 102)]


def istTafel(im):
    """Zeigt das Bild die Konferenztafel? Die Zuschauerfelder sind schwarze Kästen mit heller Schrift."""
    px = im.getpixel
    # Der Zuschauerkasten liegt bei x 10..50, y 93..100: schwarzer Grund, helle Ziffern
    proben = [sum(px((x, y))) for x in range(10, 52, 2) for y in range(93, 101)]
    dunkel = sum(1 for v in proben if v < 120)
    hell = sum(1 for v in proben if v > 450)
    return dunkel >= 100 and hell >= 5


def tafel(versuche=120):
    """Wartet auf ein Bild mit der Konferenztafel (zwischen den Torszenen)."""
    for _ in range(versuche):
        im = drive.screen()
        if istTafel(im):
            return im
        time.sleep(1.0)
    return None


def messen(name, out):
    # drive.ENV wird beim Import festgeschrieben, die Variable muss deshalb dorthin
    drive.ENV["BMP_CONF"] = os.environ.get("BMP_CONF", "bmp-mess.conf")
    if not drive.load(name):
        print("Laden fehlgeschlagen")
        return False
    fertig = [False]
    for _ in range(60):
        im = drive.screen()
        st = drive.probe(im)
        if st == "live":
            # Die Konferenz zeigt abwechselnd Torszenen und die Übersicht der Managerspiele.
            # Gewartet wird auf ein Bild mit der Übersicht; der Optionsbildschirm wird nicht
            # angefasst, ein Klick aufs Spielfeld führt sonst aus der Konferenz heraus.
            im = tafel()
            if im is None:
                print("keine Tafel erwischt")
                return False
            teile = [im.crop(f) for f in FELDER]
            breite = max(t.width for t in teile)
            zus = Image.new("RGB", (breite, sum(t.height for t in teile)))
            y = 0
            for t in teile:
                zus.paste(t, (0, y))
                y += t.height
            zus.resize((breite * 4, y * 4), Image.NEAREST).save(out)
            return True
        if st in ("menu", "menu-panel"):
            drive.dismiss_panel() if st == "menu-panel" else drive.click(270, 75)
            time.sleep(2.0)
            continue
        if st == "dialog":
            drive.click(186, 165)
            time.sleep(2.0)
            continue
        time.sleep(1.5)
    print("keine Konferenz erreicht")
    return False


if __name__ == "__main__":
    ok = messen(sys.argv[1], sys.argv[2])
    subprocess.run("pkill -x dosbox", shell=True)
    sys.exit(0 if ok else 1)
