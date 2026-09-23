#!/usr/bin/env python3
"""
drive.py - Das Original in DOSBox (Xvfb :99) zustandsgesteuert bedienen.

    drive.py load NAME          Spielstand laden (Startbildschirm -> Logo -> Datei)
    drive.py day                einen Tag weiterschalten (alle Manager, Live-Spiele, Dialoge)
    drive.py save NAME          Spielstand speichern (danach DOSBox neu starten!)
    drive.py shot DATEI.png     Bildschirm 320x240 sichern
    drive.py replay SRC DST N [START]   N-mal: neu starten, SRC laden, einen Tag spielen, als DST_i speichern (i ab START)

Erkennung über Pixelproben im 320x240-Bild (siehe probe()).

Ablauf eines Spieltags: jeder Manager klickt den Kalender (270,75); danach läuft die
Live-Konferenz. Ein Klick aufs Spielfeld (160,120) öffnet dort den Optionsbildschirm
(Halbzeitstände/Ergebnisse/Tabelle je Liga, Torszenen, Zeitung, Blenden, Tempo);
die Einstellungen gelten nur für die laufende DOSBox-Sitzung und werden deshalb
in jedem Lauf neu gesetzt (set_options). Nach den Spielen: Ergebnistafeln mit
WEITER (290,213), ggf. Zeitung (Klick blättert), zurück im Hauptmenü ist das
Kalenderblatt gewechselt.
"""
import os
import subprocess
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = dict(os.environ, DISPLAY=":99")
SHOT = "/tmp/claude-1000/-home-lhuno-Documents-bmp/cab20d4f-5e4f-422b-ac70-31784bbec86b/scratchpad/drive.png"


def sh(cmd):
    subprocess.run(cmd, shell=True, env=ENV, cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def screen():
    sh("./key.sh park")
    time.sleep(0.15)
    sh("./shot.sh " + SHOT)
    im = Image.open(SHOT).convert("RGB")
    # DOSBox-Fenster liegt bei 192,184 (1024x768-Bildschirm, 320x240-Fenster)
    return im.crop((192, 184, 512, 424))


def click(x, y):
    sh("./key.sh click %d %d" % (x, y))


def near(p, ref, tol=40):
    return all(abs(a - b) <= tol for a, b in zip(p, ref))


def probe(im):
    """Liefert einen Zustandsnamen für das Bild."""
    px = im.getpixel
    if near(px((5, 5)), (60, 100, 40), 60) and near(px((315, 5)), (60, 100, 40), 60):
        # Hauptmenü mit Titelleiste. Offene Meldungen erkennt man an den drei weißen Zeichen der
        # Leiste rechts daneben (Pfeil hoch, X, Pfeil runter bei x 253/254). Die Tafel selbst
        # taugt nicht als Merkmal: ihr Grau (97,97,130) ist genau das des Marmors - daran hing
        # das Vorspulen für GitLab #27 zwanzig Minuten auf "Verletzung im Training".
        if all(near(px(p), (243, 243, 243), 20) for p in ((253, 131), (254, 172), (253, 213))):
            return "menu-panel"
        # Roter Hinweiskasten mitten im Hauptmenü mit OKAY, z.B. am 2. Dezember "Achtung ! Dies
        # ist der letzte Spieltag vor der Winterpause." (0x143ED) - erscheint für jeden Manager
        if near(px((212, 134)), (97, 0, 16), 25) and near(px((160, 150)), (97, 0, 16), 25):
            return "menu-hinweis"
        if near(px((212, 134)), (97, 97, 130), 45) or near(px((212, 134)), (130, 130, 162), 30):
            return "menu"
        return "menu-panel"
    # Meldungen beim Managerwechsel: Marmor ohne Titelleiste, drei graue Kästen mit Pfeil hoch,
    # X und Pfeil runter an denselben Stellen wie im Hauptmenü (nach der Winterpause gesehen:
    # "Der Ausbau der Stehplätze ist abgeschlossen.")
    if all(near(px(p), (243, 243, 243), 20) for p in ((253, 131), (254, 172), (253, 213))):
        return "meldung"
    # Optionsbildschirm (dunkelblaue Tafel) und Live-Konferenz (Rasen)
    blue = sum(1 for x in range(20, 300, 10) for y in range(20, 180, 10) if near(px((x, y)), (0, 0, 113), 20))
    if blue >= 200 and near(px((290, 60)), (0, 0, 113), 20) and near(px((160, 8)), (48, 48, 81), 30):
        # Die Pokal- und Europacup-Übersichten (0x198EB) stehen auf derselben blauen Tafel, aber
        # ohne die orangen AN/AUS-Knöpfe der Optionen; sie schließt WEITER unten rechts
        orange = sum(1 for x in range(120, 300, 4) for y in range(35, 140, 4) if near(px((x, y)), (195, 113, 32), 30))
        return "optionen" if orange >= 5 else "weiter"
    olive = sum(1 for x in range(0, 320, 5) for y in range(0, 240, 5) if near(px((x, y)), (97, 130, 48), 12))
    if olive >= 12:
        return "live"
    # Konferenz ohne laufende Szene: kein Rasen, aber die olivgrünen Tafeln der Spiele. Ohne diese
    # Prüfung galt sie als "weiter", und der Klick unten rechts öffnete mitten im Spiel die
    # Einstellungen - das Original lässt danach eine Minute aus (#99)
    tafel = sum(1 for x in range(0, 320, 5) for y in range(0, 240, 5) if near(px((x, y)), (81, 97, 16), 6))
    if tafel >= 40:
        return "live"
    if near(px((160, 118)), (120, 20, 20), 50):
        return "dialog"
    # Frage vor der Pokalauslosung (0x17C26, "An Alle:"): beiger Titel über rotem Kasten mit
    # ABER KLAR / KEIN GEDANKE. Ohne Zeremonie bleibt der Lauf ohne Uhrabhängigkeit
    if near(px((160, 114)), (211, 195, 178), 20) and near(px((160, 140)), (97, 0, 16), 20) and near(px((80, 130)), (97, 0, 16), 20):
        return "auslosung"
    # Schaltfläche WEITER unten rechts: dunkles Feld mit hellem Text
    dark = sum(1 for x in range(278, 306, 3) for y in range(204, 222, 3) if sum(px((x, y))) < 120)
    if dark >= 12:
        return "weiter"
    if near(px((160, 30)), (180, 170, 130), 60):
        return "dialog-title"
    # Zeitung "Sportnachrichten": weißes Papier
    white = sum(1 for x in range(10, 310, 25) for y in (12, 40, 200, 230) if sum(px((x, y))) > 600)
    if white >= 30:
        return "zeitung"
    return "other"


def calendar_sig(im):
    return im.crop((244, 46, 314, 106)).tobytes()


def dismiss_panel():
    click(254, 172)


DEBUG = os.environ.get("DRIVE_DEBUG")


OPTION_CLICKS = [(160, 43), (216, 43), (272, 43), (160, 80), (216, 80), (272, 80), (160, 108), (272, 108), (272, 126), (278, 163)]


def set_options():
    """Im Optionsbildschirm: Halbzeitstände, Tabellen, Torszenen, Zeitung, Blenden aus, Tempo maximal."""
    for x, y in OPTION_CLICKS:
        click(x, y)
        time.sleep(0.7)
    click(290, 213)  # HAUPT MENÜ
    time.sleep(3)


def day(max_steps=200):
    """Einen Tag weiterschalten, bis sich das Kalenderblatt ändert."""
    start = calendar_sig(screen())
    configured = False
    for step in range(max_steps):
        im = screen()
        st = probe(im)
        if DEBUG:
            im.save(os.path.join(DEBUG, "%03d-%s.png" % (step, st)))
        if st == "meldung":
            dismiss_panel()
            time.sleep(1.5)
            continue
        if st == "menu-hinweis":
            click(206, 165)  # OKAY
            time.sleep(1.5)
            continue
        if st in ("menu", "menu-panel") and calendar_sig(im) != start and step > 0:
            print("Tag gewechselt nach %d Schritten" % step)
            return True
        if st == "menu-panel":
            dismiss_panel()
            time.sleep(0.8)
            # Falls das Fenster nur "Keine Nachricht" zeigte, ist es jetzt zu; sonst nochmal
            continue
        if st == "menu":
            click(270, 75)
            time.sleep(2.5)
            continue
        if st == "live":
            # Für den bytegenauen Vergleich (#99) bleiben die Optionen unberührt: der Zeitpunkt des
            # Klicks hängt an der Uhr, und die Torszenen verbrauchen Würfel
            if not configured and not os.environ.get("DRIVE_NO_OPTIONS"):
                click(160, 120)  # Klick aufs Spielfeld öffnet die Optionen
                time.sleep(2.5)
                if probe(screen()) == "optionen":
                    set_options()
                configured = True
                continue
            time.sleep(3)
            continue
        if st == "optionen":
            set_options()
            configured = True
            continue
        if st == "weiter":
            click(120, 220)  # schließt ein evtl. offenes Info-Fenster ("REICHT MIR")
            time.sleep(0.8)
            click(290, 213)
            time.sleep(3)
            continue
        if st == "auslosung":
            click(205, 166)  # KEIN GEDANKE
            time.sleep(3)
            continue
        if st == "dialog":
            click(186, 165)
            time.sleep(3)
            continue
        if st == "zeitung":
            click(160, 120)
            time.sleep(2.5)
            continue
        time.sleep(4)  # Live-Spiel läuft
    print("kein Tageswechsel erkannt")
    return False


def load(name):
    sh("./start.sh bmmain")
    time.sleep(7)
    sh("./key.sh grab")
    time.sleep(0.5)
    click(160, 20)
    time.sleep(2)
    # Datei in der Liste suchen: Einträge stehen in zwei Spalten, wir tippen den Namen
    click(100, 178)
    time.sleep(0.5)
    sh('./key.sh type "%s"' % name)
    time.sleep(0.5)
    sh("./key.sh key Return")
    time.sleep(4)
    return probe(screen()).startswith("menu")


def save(name):
    # Nach einem Tageswechsel stehen oft mehrere Meldungen im Hauptmenü. Sie müssen alle weg,
    # sonst landet der Klick auf "Speichern" im Meldungsfenster und der Spielstand wird nicht
    # geschrieben (beim Krawall-Messen aufgefallen, GitLab #26).
    for _ in range(12):
        st = probe(screen())
        if st == "menu":
            break
        if st == "menu-panel":
            dismiss_panel()
        elif st == "dialog":
            click(186, 165)
        elif st == "weiter":
            click(290, 213)
        else:
            dismiss_panel()
        time.sleep(0.8)
    # Zwischen den Schritten Zeiger parken und Bild holen: ohne diese Pausen ging der
    # Speichervorgang nach einem Spieltag verloren.
    def step(tag):
        im = screen()
        if DEBUG:
            im.save(os.path.join(DEBUG, "%s-%s.png" % (tag, name)))

    click(290, 175)
    time.sleep(2)
    step("save1")
    click(110, 175)
    time.sleep(2)
    step("save2")
    click(100, 178)
    time.sleep(0.8)
    sh('./key.sh type "%s"' % name)
    time.sleep(0.5)
    step("save3")
    sh("./key.sh key Return")
    time.sleep(3)
    # Gibt es die Datei schon, fragt das Original "FILE EXISTIERT BEREITS. ÜBERSCHREIBEN?"
    # mit ACH BITTE ! links und BLOSS NICHT ! rechts. Ohne diesen Klick bleibt der
    # Speicherdialog offen und alles danach läuft ins Leere (beim Messen für #22 aufgefallen).
    if probe(screen()) == "dialog":
        click(116, 166)
        time.sleep(2.5)
    step("save4")


def main():
    cmd = sys.argv[1]
    if cmd == "shot":
        screen().save(sys.argv[2])
    elif cmd == "load":
        print("geladen" if load(sys.argv[2]) else "Laden unklar")
    elif cmd == "day":
        day()
    elif cmd == "save":
        save(sys.argv[2])
    elif cmd == "state":
        print(probe(screen()))
    elif cmd == "replay":
        src, dst, n = sys.argv[2], sys.argv[3], int(sys.argv[4])
        start = int(sys.argv[5]) if len(sys.argv) > 5 else 0
        for i in range(start, start + n):
            if not load(src):
                print("Laden fehlgeschlagen", i)
                continue
            ok = day()
            save("%s%d" % (dst, i))
            print("Lauf", i, "fertig" if ok else "unsicher", time.strftime("%H:%M:%S"))


if __name__ == "__main__":
    main()
