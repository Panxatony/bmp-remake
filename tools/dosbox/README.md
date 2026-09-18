# Das Original in DOSBox

Die Konfigurationen mounten alle `../../../bmp-work` als Laufwerk C:, also den Ordner
**neben dem Repo**. DOSBox muss deshalb **aus diesem Ordner** gestartet werden:

```
mkdir -p ../../../bmp-work
cp -r /pfad/zur/installation/* ../../../bmp-work/   # BMMAIN.EXE, PIC/, TORE/, SOUND/, *.MAN
cd tools/dosbox
dosbox -conf bmp-spielen.conf -c bmmain
```

Ein anderer Ordner geht auch ohne Konfigurationsdatei:

```
dosbox -c "mount c /pfad/zum/spiel" -c "c:" -c "bmmain"
```

| Datei | wofür |
| --- | --- |
| `bmp-spielen.conf` | zum Spielen: Ton an, doppelte Größe, Maus **nicht** gefangen (gut über RDP und VNC) |
| `bmp.conf` | für die Skripte hier: ohne Ton, ohne Skalierung, Maus frei |
| `bmp-play.conf` | dreifache Größe, Maus frei (zum Anschauen) |
| `bmp-x.conf` | für Bildvergleiche: feste Zyklen, kein Seitenverhältnis-Ausgleich |

## Maus

Alle Konfigurationen hier haben `autolock=false`, DOSBox fängt die Maus also **nicht**. Der
Zeiger des Spiels folgt trotzdem (nachgemessen: Bewegung des Rechnerzeigers bewegt den
Spielzeiger). Das ist wichtig, wenn man über **RDP oder VNC** zusieht: eine gefangene Maus
lässt sich aus der Ferne kaum wieder einfangen.

**STRG+F10** fängt die Maus von Hand und gibt sie wieder frei. Fangen lohnt nur direkt am
Rechner, wenn der Zeiger im Spiel zu träge läuft. Bleibt die Maus einmal gefangen und die
Tastenkombination kommt über die Ferne nicht durch, hilft aus einer zweiten Sitzung:

```
pkill -x dosbox
```

## Auf einem Server ohne Bildschirm

DOSBox braucht eine X-Anzeige. Entweder über die Weiterleitung anmelden (`ssh -X`), oder
auf dem Server eine VNC-Sitzung starten und dort hineinschauen. `start.sh` in diesem Ordner
startet DOSBox gegen ein unsichtbares Xvfb - das ist nur für Schnappschüsse und Skripte
gedacht, zusehen kann man dabei nicht:

```
./start.sh bmmain          # startet Xvfb :99 und DOSBox
./shot.sh /tmp/bild.png    # Schnappschuss
./key.sh click 160 120     # Klick in Spielkoordinaten (320x240)
./key.sh type "LARS"       # Text tippen
```
