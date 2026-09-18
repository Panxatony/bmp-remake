#!/usr/bin/env python3
"""
digi.py - die Klänge aus SOUND/DIGI.VOC als WAV nach assets/sound/ schreiben.

    python3 tools/digi.py ../bmp

Die Datei enthält mehrere aneinandergehängte Creative Voice Files. Jede beginnt mit der Kennung
"Creative Voice File\\x1a", danach folgen Blöcke aus einem Typbyte und drei Byte Länge; Typ 1 ist
Tondatenblock (erstes Byte Zeitkonstante, zweites Packverfahren), Typ 0 beendet die Datei. Die
Abtastrate ergibt sich aus der Zeitkonstante: 1000000 / (256 - Konstante).

Welcher Klang wozu gehört, steht in docs/SPIELMECHANIK.md ("Ton: Klänge und Titelmusik"):
digi0 Anpfiff, digi1 Jubel, digi2 Schiedsrichterpfiff, digi3 Buh-Rufe, digi4 Raunen.
"""
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KENNUNG = b"Creative Voice File\x1a"


def voc_bloecke(daten, start):
    """Tondaten und Abtastrate einer eingebetteten VOC-Datei ab `start`."""
    kopf = struct.unpack_from("<H", daten, start + 20)[0]
    p = start + kopf
    ton = bytearray()
    rate = 11025
    while p < len(daten):
        typ = daten[p]
        if typ == 0:
            p += 1
            break
        laenge = daten[p + 1] | (daten[p + 2] << 8) | (daten[p + 3] << 16)
        inhalt = daten[p + 4: p + 4 + laenge]
        if typ == 1:
            rate = int(1000000 / (256 - inhalt[0]))
            ton += inhalt[2:]
        p += 4 + laenge
    return ton, rate, p


def wav(pfad, ton, rate):
    with open(pfad, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(ton)) + b"WAVEfmt ")
        f.write(struct.pack("<IHHIIHH", 16, 1, 1, rate, rate, 1, 8))
        f.write(b"data" + struct.pack("<I", len(ton)) + bytes(ton))


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    quelle = sys.argv[1]
    ziel = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "assets", "sound")
    os.makedirs(ziel, exist_ok=True)
    daten = open(os.path.join(quelle, "SOUND", "DIGI.VOC"), "rb").read()
    stellen = []
    i = daten.find(KENNUNG)
    while i >= 0:
        stellen.append(i)
        i = daten.find(KENNUNG, i + 1)
    for n, start in enumerate(stellen):
        ton, rate, _ = voc_bloecke(daten, start)
        wav(os.path.join(ziel, f"digi{n}.wav"), ton, rate)
        print(f"digi{n}.wav: {len(ton)} Bytes, {rate} Hz, {len(ton) / rate:.2f} s")


if __name__ == "__main__":
    main()
