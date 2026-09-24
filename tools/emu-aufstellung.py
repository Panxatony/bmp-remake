#!/usr/bin/env python3
"""Automatik-Aufstellung des Originals (0x22030) im x86-Emulator ausführen (GitLab #103).

Lädt das Abbild tools/out/bmmain.bin (Ladesegment 0, Relokationen damit schon richtig), legt Kader
(4238:774A) und Spieler (4238:57DD) aus entschlüsselten Spielständen in den Speicher, setzt
Manager (4238:304A), System (4cb3:079E/079F) und Bankgröße (4238:56EE) und ruft 1ECD:3360 auf.
Ausgabe: JSON {"Datei|Manager|System|Bank15": [[Nummer, Spalte, Reihe] je Kaderplatz]}.

Braucht das Python-Paket unicorn (pip install unicorn). Die Stände vorher entschlüsseln, etwa mit
SaveFile.decode(...).plain in eine Datei schreiben.

Aufruf: tools/emu-aufstellung.py STAND.plain [...]
"""
import json
import sys
from unicorn import *
from unicorn.x86_const import *
img = open('/home/lhuno/Documents/bmp-remake/tools/out/bmmain.bin','rb').read()
def lauf(plain, M, system, bank15=True):
    mu = Uc(UC_ARCH_X86, UC_MODE_16)
    mu.mem_map(0, 0x110000)
    mu.mem_write(0, img[:0x100000])
    D = 0x42380
    mu.mem_write(D + 0x774a, plain[21400:21400+6500])
    mu.mem_write(D + 0x57dd, plain[15813:15813+5587])
    mu.mem_write(D + 0x304a, bytes([M]))
    mu.mem_write(0x4CB30 + 0x79e + 2*M, bytes([system, system]))
    mu.mem_write(D + 0x513e, bytes([0]))
    mu.mem_write(D + 0x56ee, bytes([15 if bank15 else 13]))
    mu.mem_write(0x500, b'\xf4')
    sp = 0xFFF0 - 4
    mu.mem_write(0x90000 + sp, (0x0500).to_bytes(2,'little') + (0).to_bytes(2,'little'))
    mu.reg_write(UC_X86_REG_SS, 0x9000); mu.reg_write(UC_X86_REG_SP, sp)
    mu.reg_write(UC_X86_REG_DS, 0x4CB3); mu.reg_write(UC_X86_REG_ES, 0x4CB3)
    mu.reg_write(UC_X86_REG_CS, 0x1ECD); mu.reg_write(UC_X86_REG_IP, 0x3360)
    mu.emu_start(0x1ECD*16 + 0x3360, 0x500, count=20_000_000)
    sq = mu.mem_read(D + 0x774a + 25*M*52, 25*52)
    return [[sq[52*p+10], sq[52*p+25], sq[52*p+26]] for p in range(25)]
aus = {}
for f in sys.argv[1:]:
    plain = open(f,'rb').read()
    for M in range(4):
        for system in (2, 3, 4):
            for b in (True, False):
                aus[f"{f}|{M}|{system}|{int(b)}"] = lauf(plain, M, system, b)
print(json.dumps(aus))
