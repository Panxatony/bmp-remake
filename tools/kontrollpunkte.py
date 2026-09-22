#!/usr/bin/env python3
"""Kontrollpunkte für den bytegenauen Vergleich (GitLab #99).

Baut in eine Testkopie von BMMAIN.EXE (nach tools/seed-patch.py) einen Protokollierer: an
ausgewählten Fernaufrufen schreibt das Original den Zustand seines Zufallsgenerators in ein
Protokoll im Spielstand. Das Remake rechnet daraus die Zahl der Würfe bis zu jedem Punkt
zurück und findet so die erste Stelle, an der beide auseinanderlaufen.

Platz für den Code: Routine 0x3260C (Spielerpool beim neuen Spiel, einziger Aufrufer 0x0BDAC im
Zweig "Neues Spiel") - beim Laden eines Stands läuft sie nie. Segment 0x322B, Offset 0x035C.
(0x09623 ging nicht: der Startbildschirm ruft sie auch beim Laden.)

Protokoll: Kaderplätze von Manager 3 (4238:8686, 1300 Bytes; der Stand muss mit höchstens
drei Managern laufen). Wort 0 = Zahl der Einträge, danach je Eintrag vier Wörter: Kennung
des Kontrollpunkts, Zustand low, Zustand high, frei. Höchstens 160 Einträge.

Jeder umgeleitete Aufruf `lcall seg:off` wird zu `lcall 322b:stummel`; das Segmentwort steht
an derselben Stelle wie vorher (das Programm reloziert sich selbst über diese Stellen). Der
Stummel ist `call protokoll` mit zwei Datenwörtern: Segmentabstand zum Ziel und Ziel-Offset.
Das Ziel wird zur Laufzeit aus CS errechnet - der Code braucht keine eigenen Relokationen.

Aufruf: tools/kontrollpunkte.py <Testkopie.EXE>   (ändert die Datei)
"""
import os
import subprocess
import sys
import tempfile

HDR = 512
CAVE_ADDR = 0x3260C           # lineare Adresse im Abbild
CAVE_SEG, CAVE_OFF = 0x322B, 0x035C
CAVE_LEN = 1100
DGROUP, DATA = 0x4CB3, 0x4238
LOG = 0x8686                  # 4238:8686 = Kaderplatz 75
MAX_EINTRAEGE = 160

# Kennung, lineare Adresse des Fernaufrufs, Zielsegment, Zieloffset
PUNKTE = [
    (1, 0x46F0, 0x08BC, 0x02EF),   # Spieltagstreiber beginnt (nach der Stärkerechnung 0x1D7FF)
    (2, 0x4914, 0x1A58, 0x20B2),   # Spielvorbereitung 0x1C632, Ligapaarung
    (3, 0x4A33, 0x1A58, 0x20B2),   # Spielvorbereitung 0x1C632, Pokalpaarung
    (4, 0x54C2, 0x0F9D, 0x08E9),   # Chancen einer Halbzeit 0x102B9, Liga
    (5, 0x556C, 0x0F9D, 0x08E9),   # Chancen einer Halbzeit 0x102B9, Pokal
    (6, 0x65A8, 0x0F9D, 0x08E9),   # Neuauslosung nach Rot/Verletzung 0x0657F
    (7, 0x1D757, 0x112A, 0x0A6D),  # Finanzen am Tagesbeginn 0x11D0D
    (8, 0x1DAFA, 0x112A, 0x0A6D),  # Finanzen je Saisontag 0x11D0D
    (9, 0x1DBFE, 0x0CB5, 0x13BD),  # Tagesroutine 0x0DF0D
]


def exepack_relokationen(b: bytes) -> set:
    """Positionen der Segmentwörter, die der EXEPACK-Entpacker beim Start anpasst.

    Der Entpacker steht am Ende des Abbilds (Kopf-CS:0); hinter seiner Meldung "Packed file is
    corrupt" folgt die Tabelle: je 64-KB-Block ein Zähler und die Offsets.
    """
    import struct
    cs = struct.unpack("<H", b[0x16:0x18])[0]
    stub = HDR + cs * 16
    i = b.find(b"Packed file is corrupt", stub)
    p = i + len(b"Packed file is corrupt")
    rel = set()
    for block in range(16):
        n = struct.unpack("<H", b[p:p + 2])[0]
        p += 2
        for _ in range(n):
            rel.add(block * 0x10000 + struct.unpack("<H", b[p:p + 2])[0])
            p += 2
    return rel


def luecke(rel: set, von: int, bis: int, laenge: int) -> int:
    """Erste Adresse in [von, bis), ab der `laenge` Bytes kein relokiertes Wort berühren."""
    a = von
    while a + laenge <= bis:
        stoer = [r for r in rel if a - 1 <= r < a + laenge]
        if not stoer:
            return a
        a = max(stoer) + 2
    raise SystemExit("keine relokationsfreie Lücke gefunden")


def asm(src: str, org: int) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        s, o, e, b = (os.path.join(d, n) for n in ("k.s", "k.o", "k.elf", "k.bin"))
        open(s, "w").write(src)
        subprocess.run(["as", "--32", s, "-o", o], check=True)
        subprocess.run(["ld", "-m", "elf_i386", f"-Ttext={org:#x}", "-e", "0", o, "-o", e], check=True)
        subprocess.run(["objcopy", "-O", "binary", "-j", ".text", e, b], check=True)
        return open(b, "rb").read()


def quelltext_protokoll() -> str:
    return f""".code16
.intel_syntax noprefix
.text
protokoll:
  push bp
  mov bp, sp
  push ax
  push bx
  push si
  push dx
  push es
  mov si, word ptr [bp+2]
  mov ax, word ptr cs:[si+2]
  mov word ptr cs:[ziel], ax
  mov ax, cs
  add ax, word ptr cs:[si]
  mov word ptr cs:[ziel+2], ax
  mov ax, cs
  add ax, {(DGROUP - CAVE_SEG) & 0xFFFF:#x}
  mov es, ax
  mov bx, word ptr es:[0x9720]
  mov dx, word ptr es:[0x9722]
  mov ax, cs
  add ax, {(DATA - CAVE_SEG) & 0xFFFF:#x}
  mov es, ax
  mov ax, word ptr cs:[si+4]
  mov si, word ptr es:[{LOG:#x}]
  cmp si, {MAX_EINTRAEGE}
  jae voll
  inc word ptr es:[{LOG:#x}]
  shl si, 1
  shl si, 1
  shl si, 1
  mov word ptr es:[si+{LOG + 2:#x}], ax
  mov word ptr es:[si+{LOG + 4:#x}], bx
  mov word ptr es:[si+{LOG + 6:#x}], dx
voll:
  pop es
  pop dx
  pop si
  pop bx
  pop ax
  pop bp
  add sp, 2
  jmp dword ptr cs:[ziel]
ziel:
  .word 0, 0
"""


def quelltext_stummel(protokoll: int) -> str:
    stummel = "\n".join(
        f"stummel{k}:\n  call protokoll\n  .word {(seg - CAVE_SEG) & 0xFFFF:#x}, {off:#x}\n  .word {k}"
        for k, _, seg, off in PUNKTE)
    return f""".code16
.intel_syntax noprefix
.set protokoll, {protokoll:#x}
.text
{stummel}
"""


def main() -> None:
    pfad = sys.argv[1]
    b = bytearray(open(pfad, "rb").read())
    rel = exepack_relokationen(bytes(b))
    for k, addr, seg, off in PUNKTE:
        if addr + 3 not in rel:
            raise SystemExit(f"Segmentwort bei {addr + 3:#x} wird nicht reloziert")
    # Der Entpacker addiert beim Start das Ladesegment auf jedes Wort seiner Liste - darauf darf
    # kein Byte des eigenen Codes liegen. Protokollierer und Stummel in getrennte Lücken.
    ende = CAVE_ADDR + CAVE_LEN
    p_len = len(asm(quelltext_protokoll(), CAVE_OFF))
    p_start = luecke(rel, CAVE_ADDR, ende, p_len)
    p_org = CAVE_OFF + (p_start - CAVE_ADDR)
    p_code = asm(quelltext_protokoll(), p_org)
    s_len = len(asm(quelltext_stummel(p_org), CAVE_OFF))
    belegt = set(range(p_start - 1, p_start + p_len))
    s_start = CAVE_ADDR
    while True:
        s_start = luecke(rel, s_start, ende, s_len)
        if not belegt & set(range(s_start, s_start + s_len)):
            break
        s_start = p_start + p_len
    s_org = CAVE_OFF + (s_start - CAVE_ADDR)
    s_code = asm(quelltext_stummel(p_org), s_org)
    stummel = {}
    for k, _, seg, off in PUNKTE:
        muster = ((seg - CAVE_SEG) & 0xFFFF).to_bytes(2, "little") + off.to_bytes(2, "little") + k.to_bytes(2, "little")
        i = s_code.find(muster)
        if i < 3 or s_code[i - 3] != 0xE8:
            raise SystemExit(f"Stummel {k} nicht gefunden")
        stummel[k] = s_org + i - 3
    b[HDR + p_start:HDR + p_start + len(p_code)] = p_code
    b[HDR + s_start:HDR + s_start + len(s_code)] = s_code
    code = p_code + s_code
    org = p_org
    for k, addr, seg, off in PUNKTE:
        o = HDR + addr
        alt = bytes([0x9A]) + off.to_bytes(2, "little") + seg.to_bytes(2, "little")
        if bytes(b[o:o + 5]) != alt:
            raise SystemExit(f"unerwartete Bytes bei {addr:#x}: {b[o:o + 5].hex()}")
        b[o:o + 5] = bytes([0x9A]) + stummel[k].to_bytes(2, "little") + CAVE_SEG.to_bytes(2, "little")
    open(pfad, "wb").write(b)
    print(f"{pfad}: {len(PUNKTE)} Kontrollpunkte, Protokollierer {len(p_code)} Bytes bei {CAVE_SEG:04x}:{p_org:04x}, Stummel {len(s_code)} Bytes bei {CAVE_SEG:04x}:{s_org:04x}")


if __name__ == "__main__":
    main()
