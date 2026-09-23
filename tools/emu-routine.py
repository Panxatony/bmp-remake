#!/usr/bin/env python3
"""Eine Routine des Originals im x86-Emulator auf einem Spielstand ausführen (GitLab #99).

Lädt das Abbild tools/out/bmmain.bin (Ladesegment 0), legt alle Blöcke eines entschlüsselten
Spielstands nach docs/MEMORY-MAP.md an ihre Adressen, setzt den Zustand des Zufallsgenerators
(4cb3:9720) und ruft SEG:OFF mit den angegebenen Wortargumenten auf. Jeder Aufruf von
random (0x08377) wird mit Grenzen und Ergebnis protokolliert.

Ausgabe (JSON): {"wuerfe": [[lo, hi, wert], ...], "ax": .., "dx": .., "plain": "<Hex des Stands nach der Routine>"}

Aufruf: tools/emu-routine.py STAND.plain ZUSTAND SEG:OFF [--zeiger] [WORT ...]
  --zeiger: als erstes Argument einen Fernzeiger auf einen leeren Puffer übergeben
  --einstieg=ADR: bei jedem Erreichen der linearen Adresse ADR (hex) die vier Wörter nach der
    Rücksprungadresse festhalten (Argumente eines Fernaufrufs; bei Nahaufrufen um eins versetzt)
"""
import json
import re
import sys
from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_SS, UC_X86_REG_SP, UC_X86_REG_DS, UC_X86_REG_ES, UC_X86_REG_CS, UC_X86_REG_IP, UC_X86_REG_AX

ROOT = __file__.rsplit("/tools/", 1)[0]
IMG = open(f"{ROOT}/tools/out/bmmain.bin", "rb").read()
RANDOM = 0x8377
DGROUP, DATA = 0x4CB3, 0x4238


def bloecke():
    """Save-Offset, Länge, lineare Adresse aus der Speicherkarte."""
    out = []
    for zeile in open(f"{ROOT}/docs/MEMORY-MAP.md", encoding="utf8"):
        m = re.match(r"\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([0-9a-f]{4}):([0-9a-f]{4})", zeile)
        if m:
            seg, off = int(m.group(3), 16), int(m.group(4), 16)
            out.append((int(m.group(1)), int(m.group(2)), seg * 16 + off))
    return out


def main():
    args = sys.argv[1:]
    plain = open(args[0], "rb").read()
    zustand = int(args[1], 0)
    seg, off = (int(x, 16) for x in args[2].split(":"))
    zeiger = "--zeiger" in args
    worte = [int(a, 0) for a in args[3:] if a != "--zeiger" and not a.startswith("--")]
    mu = Uc(UC_ARCH_X86, UC_MODE_16)
    mu.mem_map(0, 0x110000)
    mu.mem_write(0, IMG[:0x100000])
    for s, n, lin in bloecke():
        mu.mem_write(lin, plain[s:s + n])
    mu.mem_write(DGROUP * 16 + 0x9720, zustand.to_bytes(4, "little"))
    wuerfe = []
    offen = []

    beobachtet = [int(a.split("=")[1], 16) for a in sys.argv if a.startswith("--einstieg=")]
    einstiege = []

    def hook(uc, addr, size, _):
        if addr in beobachtet:
            ss = uc.reg_read(UC_X86_REG_SS)
            sp = uc.reg_read(UC_X86_REG_SP)
            st = uc.mem_read(ss * 16 + sp, 12)
            einstiege.append([addr, len(wuerfe)] + [int.from_bytes(st[i:i + 2], "little") for i in range(4, 12, 2)])
        if addr == RANDOM:
            ss = uc.reg_read(UC_X86_REG_SS)
            sp = uc.reg_read(UC_X86_REG_SP)
            st = uc.mem_read(ss * 16 + sp, 8)
            lo = int.from_bytes(st[4:6], "little", signed=True)
            hi = int.from_bytes(st[6:8], "little", signed=True)
            ret = int.from_bytes(st[2:4], "little") * 16 + int.from_bytes(st[0:2], "little")
            offen.append((ret, lo, hi))
        elif offen and addr == offen[-1][0]:
            ret, lo, hi = offen.pop()
            ax = uc.reg_read(UC_X86_REG_AX)
            wuerfe.append([lo, hi, ax - 0x10000 if ax & 0x8000 else ax])

    mu.hook_add(UC_HOOK_CODE, hook)
    mu.mem_write(0x500, b"\xf4")
    sp = 0xFFF0
    stapel = b""
    for w in reversed(worte):
        stapel = w.to_bytes(2, "little") + stapel
    if zeiger:
        stapel = (0x0600).to_bytes(2, "little") + (0).to_bytes(2, "little") + stapel
    stapel = (0x0500).to_bytes(2, "little") + (0).to_bytes(2, "little") + stapel
    sp -= len(stapel)
    mu.mem_write(0x90000 + sp, stapel)
    mu.reg_write(UC_X86_REG_SS, 0x9000)
    mu.reg_write(UC_X86_REG_SP, sp)
    mu.reg_write(UC_X86_REG_DS, DGROUP)
    mu.reg_write(UC_X86_REG_ES, DGROUP)
    mu.reg_write(UC_X86_REG_CS, seg)
    mu.reg_write(UC_X86_REG_IP, off)
    mu.emu_start(seg * 16 + off, 0x500, count=200_000_000)
    neu = bytearray(plain)
    for s, n, lin in bloecke():
        neu[s:s + n] = mu.mem_read(lin, n)
    from unicorn.x86_const import UC_X86_REG_DX
    ax, dx = mu.reg_read(UC_X86_REG_AX), mu.reg_read(UC_X86_REG_DX)
    print(json.dumps({"wuerfe": wuerfe, "ax": ax, "dx": dx, "einstiege": einstiege, "plain": neu.hex()}))


if __name__ == "__main__":
    main()
