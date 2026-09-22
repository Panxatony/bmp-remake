#!/usr/bin/env python3
"""Testkopie von BMMAIN.EXE mit festem Zufall am Tagesbeginn (GitLab #99).

Nur für den bytegenauen Vergleich Original gegen Remake - das Original bleibt unangetastet.

Umbau:
- 0x083A0 (randomize) setzt srand(K) statt srand(time(0)) und springt danach in die
  Datumsroutine 0x04290 weiter.
- 0x1D717 im Tagesablauf ruft statt 0x04290 die umgebaute Routine: jeder Tag beginnt mit
  demselben Zufallsstand K.
- Die beiden alten Aufrufe von randomize (Programmstart 0x092D2, neues Spiel 0x09430) werden
  übersprungen.

Neue Segmentwörter stehen nur dort, wo vorher schon welche standen (das Programm reloziert
sich selbst über diese Stellen).

Aufruf: tools/seed-patch.py <BMMAIN.EXE> <Ziel.EXE> [K] [tag|spiel]

Ort "tag" (Vorgabe): am Tagesbeginn (0x1D717, weiter nach 0x04290).
Ort "spiel": am Anfang des Spieltagstreibers (0x046F0, weiter nach 0x08EAF) - jeder Aufruf des
Treibers (Liga, Pokal, Europapokal) beginnt dann mit demselben Zufall.
Ort "zug": nach den Zügen aller Manager (0x1D7EA, weiter nach 0x08E27), vor der Stärkerechnung
0x1D7FF und den Spielen. Ein geladener Stand steht mitten in den Zügen - nur dieser Ort
erfasst den ganzen Rest des Tages.
"""
import sys

HDR = 512  # Kopfgröße der EXE (32 Paragraphen)


def patch(src: str, dst: str, k: int, ort: str = "tag") -> None:
    b = bytearray(open(src, "rb").read())

    def put(addr: int, data: bytes, expect: bytes) -> None:
        o = HDR + addr
        if bytes(b[o:o + len(expect)]) != expect:
            raise SystemExit(f"unerwartete Bytes bei {addr:#x}: {b[o:o + len(expect)].hex()}")
        b[o:o + len(data)] = data

    if ort == "tag":
        stelle, ziel = 0x1D717, bytes([0x90, 0x11, 0x10, 0x03])  # lcall 0310:1190 (Datum)
    elif ort == "spiel":
        stelle, ziel = 0x46F0, bytes([0xEF, 0x02, 0xBC, 0x08])  # lcall 08bc:02ef
    else:
        stelle, ziel = 0x1D7EA, bytes([0x27, 0x0E, 0x6B, 0x07])  # lcall 076b:0e27
    # randomize: ab 0x083A7 (hinter chkstk) neu
    put(0x83A7,
        bytes([0xB8, k & 0xFF, k >> 8,           # mov ax,K
               0x50,                              # push ax
               0x9A, 0xAC, 0x17, 0x01, 0x3A,      # lcall 3a01:17ac (srand), Segment bei 0x83AE wie vorher
               0x5B,                              # pop bx
               0x90, 0x90,                        # nop nop
               0xEA] + list(ziel)),               # jmp far zum ursprünglichen Ziel, Segment bei 0x83B6 wie vorher
        bytes.fromhex("2bc050509a8413013a5b5b509aac17013a"))
    # Aufrufstelle: der ursprüngliche Fernaufruf geht jetzt über randomize
    put(stelle, bytes([0x9A, 0xF0, 0x0C, 0x6B, 0x07]), bytes([0x9A]) + ziel)
    # Programmstart und neues Spiel: randomize überspringen (jmp short +3, Segmentwort bleibt Füllung)
    put(0x92D2, bytes([0xEB, 0x03]), bytes.fromhex("9af0"))
    put(0x9430, bytes([0xEB, 0x03]), bytes.fromhex("9af0"))
    open(dst, "wb").write(b)


if __name__ == "__main__":
    k = int(sys.argv[3], 0) if len(sys.argv) > 3 else 0x1234
    ort = sys.argv[4] if len(sys.argv) > 4 else "tag"
    patch(sys.argv[1], sys.argv[2], k, ort)
    print(f"{sys.argv[2]}: Zufall fest auf {k:#06x} ab {ort}")
