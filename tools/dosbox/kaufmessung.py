#!/usr/bin/env python3
"""
Messung der KI-Kaufentscheidung (GitLab #22).

Je Versuch: Spielstand laden, **sofort wieder speichern** und den Wert des obersten
Marktspielers aus diesem Stand lesen - das Original erneuert den Transfermarkt beim Laden
teilweise, ein fester Betrag würde sich sonst auf einen unbekannten Wert beziehen. Danach
Transfermarkt öffnen, den obersten Spieler anklicken, den Betrag tippen und die Antwort lesen:
geht der Vertragskasten auf, ist angenommen, sonst abgelehnt.

    kaufmessung.py PROZENT ANZAHL
"""
import os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive

drive.ENV["BMP_CONF"] = "bmp-mess.conf"
S = os.environ.get("BMP_SHOTS", "/tmp")
W = os.environ.get("BMP_WORK", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "bmp-work"))
prozent, anzahl = int(sys.argv[1]), int(sys.argv[2])

def angenommen(im):
    """Der Vertragskasten füllt die untere linke Ecke mit blauem Feld und heller Schrift."""
    px = im.getpixel
    return sum(1 for x in range(10, 240, 6) for y in range(196, 232, 4) if px((x, y))[2] > 60 and px((x, y))[0] < 60) > 40

ja = 0
versuche = 0
for i in range(anzahl):
    if not drive.load("KA"):
        print("Laden fehlgeschlagen", i, flush=True)
        continue
    time.sleep(1)
    # Die Datei vorher wegräumen, sonst fragt das Original nach dem Überschreiben
    try:
        os.remove(f"{W}/KX.MAN")
    except FileNotFoundError:
        pass
    drive.save("KX")
    time.sleep(1)
    zeile = subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "marktwert.mjs"), f"{W}/KX.MAN"], capture_output=True, text=True).stdout.strip()
    name, wert = zeile.split("\t")
    wert = int(wert)
    if wert <= 0:
        print("kein Marktspieler", i, flush=True)
        continue
    betrag = round(wert * prozent / 100)
    for _ in range(6):
        if drive.probe(drive.screen()) == "menu":
            break
        drive.dismiss_panel(); time.sleep(0.8)
    drive.click(30, 217); time.sleep(1.5)
    drive.click(107, 217); time.sleep(2.5)
    drive.click(240, 38); time.sleep(1.0)
    drive.click(240, 38); time.sleep(1.5)
    drive.sh('./key.sh type "%d"' % betrag)
    time.sleep(0.6)
    drive.sh("./key.sh key Return")
    time.sleep(2.2)
    im = drive.screen()
    ok = angenommen(im)
    im.save(f"{S}/kauf-{prozent}-{i}.png")
    versuche += 1
    ja += 1 if ok else 0
    print(f"Versuch {i}: {name} Wert {wert}, Angebot {betrag} ({prozent}%) -> {'ANGENOMMEN' if ok else 'abgelehnt'}", flush=True)
print(f"ERGEBNIS {prozent}%: {ja} von {versuche} angenommen", flush=True)
