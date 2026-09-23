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

Aufruf: tools/kontrollpunkte.py [--spur 12] [--still 2,7] <Testkopie.EXE>   (ändert die Datei)
  --spur: Punkte, ab denen bis zum nächsten Punkt jeder random-Aufruf notiert wird
  --still: Punkte ohne Eintrag (sie schalten nur die Spur aus)
  --ring 1: Protokoll im Kreis (die letzten 160 Einträge bleiben)
  --halt: nach diesen Punkten nichts mehr schreiben; --ohne: Punkte gar nicht einbauen
  --dump P [--dump-von 0x90ca --dump-laenge 462]: an P einen Speicherbereich (Segment 4238)
    nach LOG+0x200 kopieren; 4cb3:xxxx liegt bei 4238:xxxx+0xA7B0
  --dump-einmal 1: nur beim ersten Erreichen kopieren (sonst gilt der letzte Durchlauf - und
    der Folgetag läuft bis zum Speichern oft noch einmal über denselben Punkt)
"""
import os
import subprocess
import sys
import tempfile

HDR = 512
CAVE_ADDR = 0x3260C           # lineare Adresse im Abbild
CAVE_SEG, CAVE_OFF = 0x322B, 0x035C
CAVE_LEN = 0x32AAE - 0x3260C  # bis zum lret der Routine
DGROUP, DATA = 0x4CB3, 0x4238
LOG = 0x8686                  # 4238:8686 = Kaderplatz 75
MAX_EINTRAEGE = 160
# Schalter im Kennungswort des Stummels: SPUR schaltet die random-Spur bis zum nächsten
# Kontrollpunkt ein, STILL schreibt keinen Eintrag (der Punkt schaltet die Spur nur aus)
SPUR, STILL, HALT = 0x4000, 0x2000, 0x1000
RANDOM_CHKSTK = 0x837C        # lcall chkstk in random (0x08377)

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
    (10, 0x1E0F6, 0x076B, 0x0CC7), # Zug: random(0, Manager + 3)
    (11, 0x1E101, 0x2277, 0x1E38), # Markterneuerung 0x245A8
    (12, 0x1E10F, 0x08BC, 0x0B5F), # Hauptmenü eines Zugs 0x0971F
    (13, 0x1D7FF, 0x0F9D, 0x0002), # Spielstärke Flag 1 je Manager 0x0F9D2
    (14, 0x57BD, 0x0F9D, 0x0C3B),  # Torwürfel 0x1060B, Heimchance Liga
    (15, 0x5810, 0x0F9D, 0x0C3B),  # Torwürfel 0x1060B, Gastchance Liga
    (16, 0x108EF, 0x1A58, 0x0CA3), # Chancenhandler 0x1B223 aus dem Torwürfel (Managerspiel)
    (17, 0x10925, 0x1A58, 0x009D), # nach dem Chancenhandler (0x1A61D)
    (18, 0x607E, 0x076B, 0x0CC7),  # Karten/Verletzungen 0x05FE5: Wurf Rot
    (19, 0x611E, 0x076B, 0x0CC7),  # Wurf Gelb
    (20, 0x623C, 0x076B, 0x0CC7),  # Wurf Verletzung
    (21, 0x5BD6, 0x06C7, 0x083C),  # Halbzeitende der Live-Schleife (Rahmen 0x06C7:083C)
    (22, 0x5C68, 0x2A41, 0x2D33),  # nach 90: Tabelle der Liga 0x2D143
    (23, 0x5C74, 0x14A4, 0x1662),  # nach 90: Torschützen der KI-Vereine 0x160A2
    (24, 0x4CC1, 0x2E3A, 0x23AA),  # Noten und Zeitung aller Manager 0x3074A
    (27, 0x1D717, 0x076B, 0x0CF0), # Tagesbeginn vor srand (nur nach seed-patch.py "tag"): Stand am Ende des Vortags
    (28, 0x1D7BA, 0x0F9D, 0x0002), # Tagesbeginn: Anzeigestärke je Manager, gleich nach der Aufstellung 0x22030
]
# Punkte mit Speicherabzug: vor dem Eintrag werden DUMP_LAENGE Bytes ab 4238:DUMP_VON nach
# 4238:LOG+DUMP_ZIEL kopiert (die Spielberichte 4238:90CA, 154 Bytes je Manager)
DUMP_PUNKTE: set = set()
SPUR_MANAGER = None        # --spur-manager M: die Spur nur, solange 4238:304A = M
DUMP_VON, DUMP_LAENGE, DUMP_ZIEL = 0x90CA, 3 * 154, 0x200
DUMP_EINMAL = False
# --ring: das Protokoll läuft im Kreis (älteste Einträge werden überschrieben); die Einträge
# tragen den Zustand, der Leser ordnet sie nach der Wurfzahl
RING = False
# Vorgabe: Spur ab dem Hauptmenü; mit --spur/--still auf der Kommandozeile anders
SPUR_PUNKTE = {12}
STILL_PUNKTE: set = set()
HALT_PUNKTE: set = set()   # nach diesem Punkt (mit Eintrag) schreibt das Protokoll nichts mehr
OHNE_PUNKTE: set = {3, 5}  # gar nicht einbauen (alle 21 Stummel passen nicht in die Lücke)


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
    ring_oder_voll = f"  jb 2f\n  xor si, si\n  mov word ptr es:[{LOG:#x}], si\n2:" if RING else "  jae voll"
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
  cmp byte ptr cs:[halt], 0
  jne voll
  mov ax, cs
  add ax, {(DGROUP - CAVE_SEG) & 0xFFFF:#x}
  mov es, ax
  mov bx, word ptr es:[0x9720]
  mov dx, word ptr es:[0x9722]
  mov ax, cs
  add ax, {(DATA - CAVE_SEG) & 0xFFFF:#x}
  mov es, ax
  mov ax, word ptr cs:[si+4]
  mov byte ptr cs:[spur], 0
  test ax, {SPUR:#x}
  jz 1f
  mov byte ptr cs:[spur], 1
1:
  test ax, {STILL:#x}
  jnz voll
  test ax, {HALT:#x}
  jz 3f
  mov byte ptr cs:[halt], 1
3:
  and ax, 0xfff
  mov si, word ptr es:[{LOG:#x}]
  cmp si, {MAX_EINTRAEGE}
{ring_oder_voll}
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
halt:
  .byte 0
spur:
  .byte 0
"""


def quelltext_spur(spur: int) -> str:
    """Anfang von random (0x08377): statt chkstk hierher. Ist die Spur an, kommt der Aufruf mit
    seiner Rücksprungadresse ins Protokoll: Kennung 0x8000, dann Offset und Segment (zur
    Laufzeit, also mit Ladesegment) - ohne Zustand, die Reihenfolge genügt. chkstk selbst
    entfällt: random ruft es mit AX = 0, es prüft dann nur den Stapel."""
    ring_oder_voll = f"  jb 2f\n  xor si, si\n  mov word ptr es:[{LOG:#x}], si\n2:" if RING else "  jae voll"
    nur_manager = f"  cmp byte ptr es:[0x304a], {SPUR_MANAGER}\n  jne voll" if SPUR_MANAGER is not None else ""
    return f""".code16
.intel_syntax noprefix
.set spur, {spur:#x}
.text
  cmp byte ptr cs:[spur], 0
  je weiter
  push ax
  push si
  push es
  mov ax, cs
  add ax, {(DATA - CAVE_SEG) & 0xFFFF:#x}
  mov es, ax
{nur_manager}
  mov si, word ptr es:[{LOG:#x}]
  cmp si, {MAX_EINTRAEGE}
{ring_oder_voll}
  inc word ptr es:[{LOG:#x}]
  shl si, 1
  shl si, 1
  shl si, 1
  mov word ptr es:[si+{LOG + 2:#x}], 0x8000
  mov ax, word ptr [bp+2]
  mov word ptr es:[si+{LOG + 4:#x}], ax
  mov ax, word ptr [bp+4]
  mov word ptr es:[si+{LOG + 6:#x}], ax
voll:
  pop es
  pop si
  pop ax
weiter:
  retf
"""


def aktive() -> list:
    return [p for p in PUNKTE if p[0] not in OHNE_PUNKTE]


def kennung(k: int) -> int:
    return k | (SPUR if k in SPUR_PUNKTE else 0) | (STILL if k in STILL_PUNKTE else 0) | (HALT if k in HALT_PUNKTE else 0)


def quelltext_dump(protokoll: int) -> str:
    """Kopiert den Speicherbereich ins Protokoll und springt dann in den Protokollierer."""
    return f""".code16
.intel_syntax noprefix
.set protokoll, {protokoll:#x}
.text
  push si
  push di
  push cx
  push ds
  push es
  push ax
  cmp byte ptr cs:[fertig], 0
  jne 1f
  mov byte ptr cs:[fertig], {1 if DUMP_EINMAL else 0}
  mov ax, cs
  add ax, {(DATA - CAVE_SEG) & 0xFFFF:#x}
  mov ds, ax
  mov es, ax
  mov si, {DUMP_VON:#x}
  mov di, {LOG + DUMP_ZIEL:#x}
  mov cx, {DUMP_LAENGE}
  cld
  rep movsb
1:
  pop ax
  pop es
  pop ds
  pop cx
  pop di
  pop si
  jmp protokoll
fertig:
  .byte 0
"""


def quelltext_stummel(protokoll: int, dump: int = 0) -> str:
    stummel = "\n".join(
        f"stummel{k}:\n  call {'dump' if k in DUMP_PUNKTE else 'protokoll'}\n  .word {(seg - CAVE_SEG) & 0xFFFF:#x}, {off:#x}\n  .word {kennung(k):#x}"
        for k, _, seg, off in aktive())
    return f""".code16
.intel_syntax noprefix
.set protokoll, {protokoll:#x}
.set dump, {dump:#x}
.text
{stummel}
"""


def main() -> None:
    global SPUR_PUNKTE, STILL_PUNKTE, RING, HALT_PUNKTE, OHNE_PUNKTE, DUMP_PUNKTE, DUMP_VON, DUMP_LAENGE, SPUR_MANAGER, DUMP_EINMAL
    args = sys.argv[1:]
    liste = lambda v: {int(x) for x in v.split(",") if x}
    while len(args) > 1 and args[0].startswith("--"):
        if args[0] == "--spur":
            SPUR_PUNKTE = liste(args[1])
        elif args[0] == "--still":
            STILL_PUNKTE = liste(args[1])
        elif args[0] == "--spur-manager":
            SPUR_MANAGER = int(args[1])
        elif args[0] == "--dump":
            DUMP_PUNKTE = liste(args[1])
        elif args[0] == "--dump-von":
            DUMP_VON = int(args[1], 0)
        elif args[0] == "--dump-laenge":
            DUMP_LAENGE = int(args[1], 0)
        elif args[0] == "--dump-einmal":
            DUMP_EINMAL = args[1] == "1"
        elif args[0] == "--halt":
            HALT_PUNKTE = liste(args[1])
        elif args[0] == "--ohne":
            OHNE_PUNKTE = liste(args[1])
        elif args[0] == "--ring":
            RING = args[1] == "1"
        else:
            raise SystemExit(f"unbekannt: {args[0]}")
        args = args[2:]
    pfad = args[0]
    b = bytearray(open(pfad, "rb").read())
    rel = exepack_relokationen(bytes(b))
    for k, addr, seg, off in aktive():
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
    belegt |= set(range(s_start - 1, s_start + s_len))
    spur = p_org + p_len - 1
    r_len = len(asm(quelltext_spur(spur), CAVE_OFF))
    r_start = CAVE_ADDR
    while True:
        r_start = luecke(rel, r_start, ende, r_len)
        if not belegt & set(range(r_start, r_start + r_len)):
            break
        r_start += 1
    r_org = CAVE_OFF + (r_start - CAVE_ADDR)
    r_code = asm(quelltext_spur(spur), r_org)
    b[HDR + r_start:HDR + r_start + len(r_code)] = r_code
    o = HDR + RANDOM_CHKSTK
    if bytes(b[o:o + 5]) != bytes.fromhex("9ac602013a") or RANDOM_CHKSTK + 3 not in rel:
        raise SystemExit("random sieht anders aus")
    b[o:o + 5] = bytes([0x9A]) + r_org.to_bytes(2, "little") + CAVE_SEG.to_bytes(2, "little")
    belegt |= set(range(r_start - 1, r_start + r_len))
    d_org = 0
    if DUMP_PUNKTE & {k for k, *_ in aktive()}:
        d_len = len(asm(quelltext_dump(p_org), CAVE_OFF))
        d_start = CAVE_ADDR
        while True:
            d_start = luecke(rel, d_start, ende, d_len)
            if not belegt & set(range(d_start, d_start + d_len)):
                break
            d_start += 1
        d_org = CAVE_OFF + (d_start - CAVE_ADDR)
        d_code = asm(quelltext_dump(p_org), d_org)
        b[HDR + d_start:HDR + d_start + len(d_code)] = d_code
    s_code = asm(quelltext_stummel(p_org, d_org), s_org)
    stummel = {}
    for k, _, seg, off in aktive():
        muster = ((seg - CAVE_SEG) & 0xFFFF).to_bytes(2, "little") + off.to_bytes(2, "little") + kennung(k).to_bytes(2, "little")
        i = s_code.find(muster)
        if i < 3 or s_code[i - 3] != 0xE8:
            raise SystemExit(f"Stummel {k} nicht gefunden")
        stummel[k] = s_org + i - 3
    b[HDR + p_start:HDR + p_start + len(p_code)] = p_code
    b[HDR + s_start:HDR + s_start + len(s_code)] = s_code
    code = p_code + s_code
    org = p_org
    for k, addr, seg, off in aktive():
        o = HDR + addr
        alt = bytes([0x9A]) + off.to_bytes(2, "little") + seg.to_bytes(2, "little")
        if bytes(b[o:o + 5]) != alt:
            raise SystemExit(f"unerwartete Bytes bei {addr:#x}: {b[o:o + 5].hex()}")
        b[o:o + 5] = bytes([0x9A]) + stummel[k].to_bytes(2, "little") + CAVE_SEG.to_bytes(2, "little")
    open(pfad, "wb").write(b)
    print(f"{pfad}: {len(aktive())} Kontrollpunkte, Protokollierer {len(p_code)} Bytes bei {CAVE_SEG:04x}:{p_org:04x}, Stummel {len(s_code)} Bytes bei {CAVE_SEG:04x}:{s_org:04x}, Spur {len(r_code)} Bytes bei {CAVE_SEG:04x}:{r_org:04x}" + (f", Abzug bei {CAVE_SEG:04x}:{d_org:04x}" if d_org else ""))


if __name__ == "__main__":
    main()
