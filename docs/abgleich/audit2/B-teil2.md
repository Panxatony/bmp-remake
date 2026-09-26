# Audit 2, Gruppe B, Teil 2: Neues Spiel und Startbildschirm

Routinen: 0x08FD8, 0x08DBB, 0x0AD44 (bis 0xCB62), 0x0A89D, 0x0A9B3, 0x0AA35, 0x0AA56, 0x0AB84, 0x0AC21.
Nebenbei geprüft: 0x09623 (Trainergehalt/Fernsehgeld, gehört eigentlich zum Hauptteil), 0x197D5, 0x31A19, 0x8377.

Hinweis: Der bytegenaue Test "Neues Spiel wie das Original" (test/newgame.test.ts:84) deckt nur **einen**
Manager, Endlosspiel und keine Doppelwahl ab. Die Befunde unten liegen genau außerhalb davon.

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x08FD8 | Programmhauptteil: Kommandozeile, Grafik, randomize (0x83A0), Stammdaten 0x299DC, 07AB = 0, 0x8DBB, Mischen 0x3AC5, EP-Teilnehmer 0x18B12, 0x1978D, Europapokal-Auslosung 0x18600(i,0) i=1..3, Startbildschirm 0xAD44(1); bei neuem Spiel danach 0x10067(10), randomize, 225A = 1, 0x1643B, 0x18600(0,0), 0x18600(i,1), 07DC = (int8)4cb3:224C, 0x245A8; dann 0x8F0D, 0x14E59, 0x1D6F6 | newgame.ts:createGame, server.ts `/api/newgame` | stimmt (Reihenfolge und Würfe; randomize entfällt wegen Seed-Rng) |
| 0x08DBB | Historieblock 5012 Bytes = 0, Pokalrunden 306..310 = 30 nur für m < 07AB (07AB ist 0: läuft nie), 2560 Bytes 0xFF, Porträt 29 = m+1 | newgame.ts:257, 314-321 | stimmt (anzeigen.md richtig); SPIELMECHANIK falsch, siehe T2f |
| 0x0AD44 UI (0xAD44-0xB9AD) | Startbildschirm: Wappenleiste (-0x4, 0..63, zyklisch), Vereinsfeld, Porträttausch, Namenseingabe, Laden (0x334BC) | web main.ts:drawStart (~1160-1230) | Befunde T2b, T2c; Namenslänge unklar (U1) |
| 0x0AD44 Dialog (0xB9B0-0xBD02) | Spiel-Level (4a28 = 2·Zeile + Spalte), Radiogruppe Endlosspiel / 1-Jahres-Spiel / 3-Jahres-Spiel (Bits 0..2), Schalter "Histor. Start" (Bit 3) | main.ts: nur Level | Level stimmt; Spielarten siehe T2e |
| 0x0AD44 0xBD17-0xBDBC | 513C = Endjahr-Kennung (0x56CE / 0x7AC / 0x7AE, ohne Histor. Start +29, dann 07E0 = 1992, 56F4 = 1); 4a28 = 5 - 4a28; Pool 0x3260C; 304A = 0 | newgame.ts:285-289 (nur Endlosspiel: 22251) | stimmt für Endlosspiel |
| 0x0AD44 0xBDBF-0xBF39 | Nur beim Aufruf aus dem Spiel (0x971F bei 0xA7B4, 07AB > 0): neue Manager ab altem 07AB: Bytes 267..304 = 10, 306..310 = 30, 62+4i = 0xFF (i < 50), je Gruppe 2/5/8/5 Zufallsspieler random(07A6[g], 07A7[g]) mit Besitzer 5 (höchstens 1000 Versuche), 0x224A8(sp, 1, 0, 15000, 24) | fehlt | Befund T2d |
| 0x0AD44 0xBF3C-0xC0A6, 0xC6AC-0xC731 | Vereinstausch in die Oberliga: kein Tausch, wenn (0x197D5(Verein) >> 1) == 2 und Verein <= 4cb3:2277 (57); sonst random(38,57) (4cb3:226E[2]=38, 225E[2]=20) bis kein früherer Manager dort und 0xA9B3(y,7) = 0; 0x3C24(v,y,0), 0xAB84(v,y) | newgame.ts:356-369 | stimmt |
| 0x0AD44 0xC0A8-0xC1B9 | Kaderwerte: je Wert random(b,b+5), random(40,60), Form = zweiter; Spielertabelle über -0x4 | newgame.ts:378-386 | **Befund T2a** (Schleifenzahl bei mehreren Managern) |
| 0x0AD44 0xC1BB-0xC4DC | Gehälter 0x24D4E(slot,1); Bälle 321..325 = 5,4,6,5,6 und 326..329 = 1,3,3,3 (4cb3:0286/028C); Liga 312 = 2; Eintritt 266 = 10; 358/350/366/390/398; 305 = 16; Fans 476 = 10 | newgame.ts:387-403 | stimmt |
| 0x0AD44 0xC4DE-0xC507 | 0x9623, Sponsoren 0x176F4; nur im Spiel (07AB>0 beim Eintritt) 0x22030 und 0xF9D2(m,0) | newgame.ts:404-406 | stimmt (Neues Spiel) |
| 0x0AD44 0xC510-0xC6A8 | Schleife je Manager: 5358 = m; (1-Jahres) Werbewerte; leerer Name Manager 0 -> Verein 11·m; Liga -2 = 2 (Endlos) bzw. 0 (1-/3-Jahres); Konto 1,5 Mio, bei 4a28 = 4 (gespeichert) 1,9 Mio; 492 = 99999; b = 4a28/2 + 27 (+41 Liga 0, +12 1-Jahres) | newgame.ts:371, 407-408 | stimmt für Endlosspiel |
| 0x0AD44 0xC734-0xC74A | 304A zurück; nur neues Spiel: Zinstabelle 0x112AA | newgame.ts:422 | stimmt |
| 0x09623 | Trainer 478 = L·(r(15,20)+40) + ((L·(110-Fans)) & 0xFFFE)·500 (16 Bit), · r(10(L+10), 25(L+4)) / 100; TV 4cb3:0688+36m = 1000·(30L+Fans) | newgame.ts:117-127 | stimmt |
| 0x0A89D | Kachel/Wappen aus Grafikressource zeichnen | - | nicht nötig (Grafik) |
| 0x0A9B3 | Steht Verein im Europapokal (Maske über Wettbewerbe 1..3, Rundenzahl aus 4238:0009) | fehlt | stimmt im Ergebnis für Endlosspiel (38..57 nie in EP); im 1-Jahres-Spiel Pflichtbedingung (T2e) |
| 0x0AA35 | Taste/Klick abwarten | - | nicht nötig |
| 0x0AA56 | Zwei Porträtkacheln im Bild tauschen | - | nicht nötig (Grafik), Logik siehe T2c |
| 0x0AB84 | Zwei Tabellensätze (54 Bytes, 4238:0ECC) tauschen | newgame.ts:365-368 | stimmt |
| 0x0AC21 | Knopf (Level-Ziffer) zeichnen | main.ts `SPIEL-LEVEL` | nicht nötig |

## Befunde

### T2a (S) Kaderwerte: die Wurfschleife läuft über die Kader **aller** Manager
Original 0xC0A8-0xC1B9: äußere Schleife `-0x48` = 0..3 (`c1ab incw -0x48(%bp)`, `c1ae cmpw $0x4,-0x48(%bp)`),
innere Grenze `c188 push 0; push -0x48; lcall $0x3091,$0x1109` = 0x31A19(-0x48, 0) = Zahl der besetzten
Kaderplätze (Byte 15 != 0, `31a64 cmpb $0x0,%es:0x7759(%bx)`) des Managers **-0x48**, geschrieben wird aber
immer in den Kader von 4238:304A (`c0e8 imulb %es:0x304a` … `c103 mov %al,%es:0x775a(%bx)`, Platz -0x5a = -0x4a).
Der Pool 0x3260C hat vorher allen Managern ihre 20 Spieler gegeben (0x328f5 in der Schleife über 304A < 07AB).
Folge: bei N Managern würfelt jeder Manager N·20·6 statt 20·6 Mal (Plätze 0..19 N-mal überschrieben, die letzte
Runde bleibt; auch der Leistenspieler -0x4 bekommt die Werte der letzten Runde).
Remake newgame.ts:379-386 würfelt nur `g.squadOf(mi)` einmal. Ab zwei Managern laufen Zufallsstrom und damit
Kaderwerte, Gehälter, Trainer, Angebote, Zinsen, Matrix, Verteilung, Pokal und Markt auseinander. Der Test mit
einem Manager kann es nicht sehen (dort ist 0x31A19(1..3) = 0).

### T2b (S) Zwei Manager können denselben Verein wählen
Original 0xB659-0xB69D: der Klick aufs Vereinsfeld setzt Byte 30 nur, wenn kein Manager j < 07AB den Verein
schon hat (`b66c cmp -0xa(%bp),%ax; b671 movw $0x1,-0x5c(%bp)`, `b688 cmpw $0x0,-0x5c(%bp); jne 0xb6dc`).
Remake: web main.ts:1208 `this.hit(x + 12, 110, 40, 40, () => (sl.club = st.selected))` ohne Prüfung,
server.ts:2649 übernimmt `club` ungeprüft, newgame.ts:341-346 findet für beide denselben Index. Nach dem Tausch
für Manager 0 zieht swapClubs (season.ts:58-61) Manager 1 mit (gleicher clubIndex), der dann als Oberligist
stehen bleibt: zwei Manager führen denselben Verein.

### T2c (A) Porträts werden im Original nur getauscht, im Remake frei gewählt
Original 0xB704-0xB74B: erster Klick merkt den Manager (-0x2c = m+1), zweiter Klick tauscht Byte 29 der beiden
(`b73e mov %al,%es:0x225f(%bx)`, `b746 mov %al,%es:0x225f(%si)`); Start 0x8DBB Byte 29 = m+1, also immer vier
verschiedene Porträts. Remake main.ts:1214 `sl.portrait = (sl.portrait % 4) + 1` erlaubt gleiche Gesichter.
Nur Anzeige.

### T2d (S, fehlender Zweig) Manager im laufenden Spiel aufnehmen
0x971F ruft bei 0xA7AC-0xA7B4 (Diskettenmenü, 6. Eintrag) 0x8EAF(2), 0xAD44(0), 0x8F0D(2). Mit 07AB > 0 beim
Eintritt (-0x36) nimmt 0xAD44 weitere Manager auf (0xB9AD `jmp 0xbdbf`): Bytes 267..304 = 10 (`becf movb $0xa,%es:0x234d(%bx)`),
306..310 = 30 (`bef7`), Verlauf 62+4i = 0xFF (`bf25`), je Gruppe 2/5/8/5 Spieler random(07A6[g], 07A7[g]) —
also 1..20, 20..64, 64..106, 106..151, Grenzen doppelt und 151 hinter der Tabelle — mit Besitzer 5, bis 1000
Versuche (`be37 cmpw $0x3e8`), 0x224A8(sp, 1, 0, 15000, 24) mit **1** Jahr Vertrag; danach dieselbe Schleife ab
0xC510 mit 0x22030 und 0xF9D2(m,0), ohne Zinstabelle. Das Remake hat keinen Weg, Manager nachträglich
aufzunehmen (keine API, `/api/seat` besetzt nur vorhandene), und ABWEICHUNGEN nennt es nicht.

### T2e (D) "Historische Startjahre 1964/1966" sind in Wahrheit Spielarten
Die Dialogtexte 4cb3:4A36+4i sind "Endlosspiel", "1-Jahres-Spiel", "3-Jahres-Spiel", "Histor. Start"
(Bits 0..3 von -0x58; 0xBBE3-0xBC04: Bits 0..2 Radiogruppe, Bit 3 einzeln). 4238:513C (Save 34063) ist die
Endjahr-Kennung: 0x56CE (endlos), 0x7AC = 1964, 0x7AE = 1966; ohne "Histor. Start" +29 (0xBD59) -> 22251,
1993, 1995, und 07E0 = 1992 (0xBD63), sonst bleibt 07E0 = 1963 aus dem Abbild. 1964/1966 sind also die Endjahre
des 1-/3-Jahres-Spiels mit historischem Start. Die 1-/3-Jahres-Spiele (auch ohne historischen Start) beginnen in
der Bundesliga (-0x2 bleibt 0, 0xC5DC-0xC60E), das 1-Jahres-Spiel mit einem zufälligen Bundesligisten, der im
UEFA-Pokal steht (0xBFDD-0xC0A6, 0xA9B3 Maske 4), mit Byte 309 = 1, Werbetabelle Trikot 180.000, Banden je 45.000, Werbeausgaben 30.000 (0xC548-0xC5A7),
Stadionwerte 350 +5.000 und 358 +10.000 (0xC338), +12 auf die Kaderwerte (0xC6A8). docs/ABWEICHUNGEN.md:36 und SPIELMECHANIK.md:677, 710-711, 1499 nennen es
"Startjahre"; dass das Remake 1-/3-Jahres-Spiel gar nicht anbietet, steht nirgends (ABWEICHUNGEN.md:23 betrifft
das Ende nach 07E2).

### T2f (D) SPIELMECHANIK beschreibt Werte des Aufnahme-Zweigs als Neues Spiel
docs/SPIELMECHANIK.md:674 "Manager Byte 306..310 = 30" (0x8DBB-Schleife läuft bei 07AB = 0 nie, 0x8E15) und
:704 "Bytes 267..304 = 10; Historie 62..261 = 0xFF" (nur 0xBDBF-Zweig, T2d). Beim neuen Spiel bleiben sie 0, so
wie newgame.ts:409-410 und der Test es haben.

## Unklar

- U1 (A): Namenseingabe 0x7E87 begrenzt über die Pixelbreite 0x28 = 40 (Argument bp+0x12, Prüfung 0x8104-0x812A),
  nicht über eine Zeichenzahl; Großschreibung per `and $0xdf` nur für A..Z. Das Remake schneidet auf 12 Zeichen
  (server.ts:2649, main.ts:1217). Wie viele Zeichen 40 Punkte in dieser Schrift sind, habe ich nicht gemessen.
