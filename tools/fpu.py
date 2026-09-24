#!/usr/bin/env python3
"""Gleitkomma-Emulator von Microsoft C in BMMAIN lesbar machen (GitLab #102).

BMMAIN rechnet Gleitkomma über den Emulator der C-Laufzeit: statt der x87-Befehle stehen
Software-Interrupts im Code, die die Laufzeit beim ersten Durchlauf ausführt (und bei
vorhandener FPU in echte Befehle umschreibt). objdump zeigt sie als int 0x34 ... und liest die
Folgebytes als Unsinn. Die Kodierung:

    CD 34..3B  mm ...   = FWAIT + ESC D8..DF mm ...   (Opcode = 0xD8 + Nummer - 0x34)
    CD 3C  ss  mm ...   = FWAIT + Segmentpräfix + ESC  (ss: Bit 7-6 Segment 00 DS, 01 SS,
                                                        10 CS, 11 ES; Bit 2-0 Opcode D8..DF)
    CD 3D               = FWAIT

Jede Folge wird in gleich langen Maschinencode übersetzt (CD 3x -> 9B Dx, CD 3C ss -> 9B pp Dx,
CD 3D -> 9B 90). Die Adressen bleiben also gleich.

Aufruf:
  tools/fpu.py                      schreibt tools/out/bmmain-fpu.bin (ganzes Abbild)
  tools/fpu.py VON BIS              zeigt den Bereich (hex, lineare Adressen) disassembliert
"""
import os
import subprocess
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
QUELLE = os.path.join(HIER, "out", "bmmain.bin")
ZIEL = os.path.join(HIER, "out", "bmmain-fpu.bin")
PRAEFIX = {0: 0x3E, 1: 0x36, 2: 0x2E, 3: 0x26}  # DS, SS, CS, ES


def uebersetzen(b: bytes) -> tuple[bytearray, int]:
    """Alle Emulatorfolgen ersetzen; liefert das neue Abbild und die Zahl der Ersetzungen.

    Die Suche läuft über das ganze Abbild, auch über Daten - für eine Anzeige reicht das, zum
    Ausführen nur die Bereiche verwenden, die wirklich Code sind.
    """
    out = bytearray(b)
    n = 0
    i = 0
    while i < len(out) - 2:
        if out[i] == 0xCD and 0x34 <= out[i + 1] <= 0x3B:
            out[i] = 0x9B
            out[i + 1] = 0xD8 + out[i + 1] - 0x34
            n += 1
            i += 2
        elif out[i] == 0xCD and out[i + 1] == 0x3C:
            ss = out[i + 2]
            out[i] = 0x9B
            out[i + 1] = PRAEFIX[ss >> 6]
            out[i + 2] = 0xD8 | (ss & 7)
            n += 1
            i += 3
        elif out[i] == 0xCD and out[i + 1] == 0x3D:
            out[i] = 0x9B
            out[i + 1] = 0x90
            n += 1
            i += 2
        else:
            i += 1
    return out, n


def main() -> None:
    b = open(QUELLE, "rb").read()
    neu, n = uebersetzen(b)
    open(ZIEL, "wb").write(neu)
    if len(sys.argv) < 3:
        print(f"{ZIEL}: {n} Emulatorfolgen übersetzt")
        return
    von, bis = int(sys.argv[1], 16), int(sys.argv[2], 16)
    aus = subprocess.run(["objdump", "-D", "-b", "binary", "-m", "i8086", f"--start-address={von:#x}", f"--stop-address={bis:#x}", ZIEL],
                         capture_output=True, text=True).stdout
    for z in aus.splitlines():
        if ":\t" in z:
            print(z)


if __name__ == "__main__":
    main()
