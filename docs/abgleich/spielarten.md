# Spielarten: Endlosspiel, 1-Jahres-Spiel, 3-Jahres-Spiel (Endjahr-Kennung 4238:513C)

Zweigbuch vom 27.9.2026, nur gelesen (all.s, bmmain.bin, Originalstände in den Originalständen). Vorwissen:
Audit 2 B-teil2 T2e, H7; SPIELMECHANIK "Neues Spiel"; newgame.ts `createGame`/`managerSchleife`,
highscore.ts, server.ts `saisonwechselBeginnen`.

Kurz: Die Spielart steckt allein im Wort **4238:513C** (Save-Offset 34063, 2 Bytes, MEMORY-MAP Zeile 56,
dort noch ohne Bedeutung). Daneben setzt derselbe Befehlsblock 4cb3:07E0 (Jahr) und 4238:56F4
(Merker "ohne historischen Start", **nicht** im Spielstand). Alle Leser vergleichen 513C mit festen
Jahreszahlen; es gibt keinen weiteren Merker für die Spielart.

| Spielart | Bits -0x58 | 513C ohne Histor. Start | 513C mit Histor. Start |
|---|---|---|---|
| Endlosspiel | 0 | 0x56EB = 22251 | 0x56CE = 22222 |
| 1-Jahres-Spiel | 1 | 0x07C9 = 1993 | 0x07AC = 1964 |
| 3-Jahres-Spiel | 2 | 0x07CB = 1995 | 0x07AE = 1966 |

Zu "1993" und "1995": Das erste Spieljahr ohne historischen Start ist die Saison **1992/93**
(07E0 = 1992, Kalender ab 29.7.1992; so auch in allen Originalständen: CLAUDE.MAN 2.8.1992 mit
07E0 = A7A0 = 1992, RIED.MAN März 1993 mit 07E0 = 1992, A7A0 = 1993). 513C ist das
**Kalenderjahr am Ende der letzten Saison**: 1993 = Ende 1992/93 (eine Saison), 1995 = Ende 1994/95
(drei Saisons). Mit historischem Start entsprechend 1963/64 bzw. 1963/64 bis 1965/66.

## 1. Setzen der Kennung (Startbildschirm 0x0AD44)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0xAD7A `movb $0x1,-0x58(%bp)` | Vorbelegung: Endlosspiel, Histor. Start aus | nur Endlosspiel | stimmt für Endlos |
| 0xB9A7 `cmpw $0x0,-0x36(%bp)` / `jmp 0xbdbf` | Der Dialog (Level und Spielart) kommt nur beim neuen Spiel (07AB = 0 beim Eintritt), nicht bei der Aufnahme weiterer Manager | Aufnahme ohne Dialog | stimmt |
| 0xBADC-0xBB55 | Vier Zeilen Text 4cb3:4A36+4i bei x 79, y 0x92+18i, Kästchen bei x 181, y 0x86+18i mit Bit i von -0x58 | main.ts: nur Level | **fehlt** |
| 0xBB58-0xBB7D, 0xBBC4-0xBBCF | Die vierte Zeile (Histor. Start) wird nur gezeichnet und angenommen, wenn das Doppelwort 4cb3:224E gleich 4cb3:2252 ist (`cmp %ax,%es:0x2252` ... `mov $0x1,%ax` -> Grenze 3 statt 4); im Abbild sind beide 1 | - | weggelassen (siehe Unklar U1) |
| 0xBBD4-0xBC04 | Klick in Zeile r = (y − 0x86)/18: Zeile 3 `andb $0x7` (Bit 3 neu), Zeilen 0..2 `andb $0x8` (Radiogruppe, die anderen beiden Bits fallen weg); `cmpw $0xcd,-0x34` -> x < 205 setzt das Bit, x ≥ 205 löscht es | - | **fehlt** |
| 0xBD02-0xBD14 | Verlassen nur bei 4238:2EA2 = 3 **und** `testb $0x7,-0x58` ≠ 0: ohne gewählte Spielart geht es nicht weiter | - | **fehlt** |
| 0xBD17-0xBD35 | `movw $0x56ce,%es:0x513c`; Bit 1: `movw $0x7ac`; Bit 2: `movw $0x7ae` | newgame.ts:288 schreibt fest 22251 | **fehlt** (1993/1995) |
| 0xBD3C-0xBD4D | 4238:56F4 = 1 − Bit 3 (`sar %cl,%al; sub $0xff,%al; neg %al; and $0x1,%al`), also 1 = ohne historischen Start | nicht nachgebildet (ABWEICHUNGEN Jugendspieler) | wie entschieden |
| 0xBD51-0xBD63 | ohne Histor. Start: `addw $0x1d,%es:0x513c` (+29 -> 22251/1993/1995) und `movw $0x7c8,%es:0x7e0` (1992); mit: 07E0 bleibt 0x7AB = 1963 aus dem Abbild | 07E0 = 1992 (newgame.ts:392) | stimmt |

Die Vereinswahl (Namen, Porträt, Wappenleiste) liegt vor dem Dialog und liest weder -0x58 noch 513C
(-0x58 hat außer den Stellen oben keinen Zugriff in 0xAD44). **Wählbar sind in allen Spielarten
dieselben Vereine**; die Spielart entscheidet nur, wohin der Wunschverein danach getauscht wird
(Abschnitt 2). Auch der Level (4cb3:4A28, Zeilen "Spiel-Level" 4cb3:29D1) ist unabhängig von der
Spielart; er geht aber in den Dateinamen der Bestenliste ein (Abschnitt 6).

Texte (DGROUP, Zeiger in 4cb3:4A2A..4A42):

| Zeiger | Text | Wortlaut |
|---|---|---|
| 4cb3:4A2A | 4cb3:29D1 | `Spiel-Level` |
| 4cb3:4A36 | 4cb3:29DF | `Endlosspiel` |
| 4cb3:4A3A | 4cb3:29EB | `1-Jahres-Spiel` |
| 4cb3:4A3E | 4cb3:29FA | `3-Jahres-Spiel` |
| 4cb3:4A42 | 4cb3:2A09 | `Histor. Start` |

## 2. Managerschleife des Startbildschirms (0xC510-0xC6FE, 0xBF3C-0xC0A6, 0xC0A8-0xC4E4)

Läuft je Manager (4238:304A = m, 4238:5358 = m) beim neuen Spiel **und** bei der Aufnahme
(-0x36 ≠ 0). Managersatz 4238:2242 + 778·m; Byte n = 0x2242 + n.

Ligawahl 0xC5D7-0xC60E (Liga -0x2, Vorgabe 0):

```
c5d7 movw $0x0,-0x2(%bp)
c5e0 cmpw $0x7ae,%es:0x513c / jbe c5f5
c5ed cmpb $0x0,%es:0x56f4   / je c60e      ; 513C > 1966 und 56F4 = 0 -> Liga 2
c5f9 cmpw $0x7cb,%es:0x513c / jbe c613
c606 cmpb $0x0,%es:0x56f4   / je c613      ; 513C > 1995 und 56F4 ≠ 0 -> Liga 2
c60e movw $0x2,-0x2(%bp)
```

Ergebnis beim neuen Spiel: Endlos (22251/56F4=1, 22222/56F4=0) Liga 2 = Oberliga; 1-/3-Jahres-Spiel
(1993/1995 mit 56F4 = 1, 1964/1966 mit 56F4 = 0) Liga 0 = Bundesliga.

| Adressen | Was | Endlos | 3-Jahres | 1-Jahres | Remake | Urteil |
|---|---|---|---|---|---|---|
| 0xC532-0xC5A7 `cmpw $0x7ac` / `$0x7c9` | Werbetabelle 4cb3:066C + 36·m: +32 Werbeausgaben `movw $0x7530` (30.000), +0 Trikot `$0xbf20:$0x2` (180.000), +4..+24 sechs Banden `$0xafc8` (45.000) | Abbild: 50.000 / 6×6.000 / 5.000 | wie Endlos | 180.000 / 6×45.000 / 30.000 | newgame.ts:277-281 nur Abbildwerte | **fehlt** |
| 0xC5D7-0xC60E | Liga (siehe oben), Byte 312 = Liga bei 0xC267 | 2 | 0 | 0 | `const league = 2` (newgame.ts:420) | **fehlt** |
| 0xC6AC-0xC6FE, 0xC701-0xC731, 0xBF3C-0xBFBC | Tausch des Wunschvereins: Liga 2: bleibt, wenn Klasse (0x17C2:1BB5 >> 1) = 2 und Verein ≤ 4238:2277 (57), sonst Tausch. **Liga 0: immer Tausch** (`cmpw $0x0,-0x2(%bp)` / `je 0xc701`). Ziel -0x2E = random(226E[l], 226E[l]+225E[l]−1), neu gewürfelt, wenn Verein eines früheren Managers (0xBF3C) oder `call 0xa9b3(ziel, 7)` ≠ 0 (steht in einem der drei Europapokale); dann 0x3C24(Verein, Ziel, 0) und 0xAB84 | random(38,57) | random(0,17), in keinem Europapokal | wie 3-Jahres, danach zweiter Tausch | nur Oberliga, ohne 0xA9B3 | **fehlt** für Liga 0 |
| 0xBFBE-0xC0A6 `cmpw $0x7ac` / `$0x7c9`, `cmpw $0x0,-0x36` | Nur 1-Jahres-Spiel und nur beim neuen Spiel: Byte 309 = 1 (`movb $0x1,%es:0x2377(%bx)`, UEFA-Pokal-Runde 1), dann ein zweites Ziel random(0,17), kein Managerverein, **`call 0xa9b3(ziel, 4)` ≠ 0** (steht im UEFA-Pokal), Tausch 0x3C24/0xAB84. Da 0x3C24 die Europapokallisten stehen lässt (SPIELMECHANIK), übernimmt der Wunschverein den UEFA-Pokal-Platz samt Auslosung | - | - | Bundesliga + UEFA-Pokal | - | **fehlt** |
| 0xC613-0xC651 | Konto 1.500.000, bei gespeichertem Level 4 1.900.000 | gleich | gleich | gleich | newgame.ts:486 | stimmt (unabhängig) |
| 0xC672-0xC6A8 | Kaderbasis b = 4A28/2 + 27 (`add $0x1b`); Liga 0: +41 (`add $0x29`); 1-Jahres: +12 (`addw $0xc,-0x60(%bp)`). Kaderwerte random(b, b+5) ab 0xC0D0 | b = s/2 + 27 | s/2 + 68 | s/2 + 80 | `div(level,2)+27` | **fehlt** |
| 0xC270-0xC2B1 | Eintritt Byte 266 = 2·(8 + e1) − 3·Liga, e1 = 1 im 1-Jahres-Spiel (`add $0x8,%al; shl $1,%al`) | 10 | 16 | 18 | `2*8 - 3*league` | **fehlt** |
| 0xC2B6-0xC2E3 | Stehplätze 358 = 4000·(5 − Liga) | 12.000 | 20.000 | 20.000 (+10.000, s.u.) | 4000·(5−league) | stimmt nur Endlos |
| 0xC2E8-0xC309 | Sitzplätze 350 = 3000·(2 − Liga) | 0 | 6.000 | 6.000 (+5.000) | 3000·(2−league) | stimmt nur Endlos |
| 0xC312-0xC34C `cmpw $0x7ac` / `$0x7c9` | 1-Jahres: `addw $0x1388` auf 350 (+5.000), `addw $0x2710` auf 358 (+10.000) | - | - | Sitz 11.000, Steh 30.000 | - | **fehlt** |
| 0xC352-0xC389 | Überdacht 366 = 3500·(2 − Liga) | 0 | 7.000 | 7.000 | 3500·(2−league) | stimmt nur Endlos |
| 0xC392-0xC3D0 | Zustand 390 = 4 + e1 | 4 | 4 | 5 | 4 | **fehlt** (1-Jahres) |
| 0xC3D9-0xC414 | Komfort 398 = 3 + e1 | 3 | 3 | 4 | 3 | **fehlt** (1-Jahres) |
| 0xC41D-0xC4AF `cmpw $0x7d0` / `jb`, `cmpw $0x7ae` / `$0x7cb` | Nur bei 513C < 2000: Anzeigetafel 382 = 3 − 2·e3, Flutlicht 374 = 3 − e3 (e3 = 1 im 3-Jahres-Spiel); im Endlosspiel bleiben beide unberührt | unberührt | Tafel 1, Flutlicht 2 | Tafel 3, Flutlicht 3 | nicht geschrieben | **fehlt** |
| 0xC4CA-0xC4D9 | Einsatzregler 305 = 16; Fanwert 476 = 50 − 20·Liga | 10 | 50 | 50 | 50 − 20·league | stimmt nur Endlos |
| 0xC4DE-0xC4E4 | Trainer/Fernsehgeld 0x9623 und Sponsorenangebote 0x14A4:2CB4 rechnen mit Liga (L = 2 − Liga) | L = 0 | L = 2 | L = 2 | `trainerUndFernsehgeld`, `generateOffers` mit Byte 312 | stimmt, sobald Liga stimmt |

Aufnahme weiterer Manager (0xBDBF, -0x36 ≠ 0) in ein 1-/3-Jahres-Spiel: Werbewerte, Stadion,
Kaderbasis richten sich nach 513C; der UEFA-Tausch (0xBFD4) nicht. Die Liga hängt von 56F4 ab, das
nicht gespeichert wird: im selben Programmlauf wie das neue Spiel 56F4 = 1 -> Bundesliga; nach dem
Laden in einem neuen Lauf 56F4 = 0 -> 1993/1995 > 1966 -> **Oberliga**, mit Kaderbasis 27 + s/2
(+12 im 1-Jahres-Spiel) und den Stadionwerten der Liga 2 plus den 1-/3-Jahres-Zusätzen (*Eigenheit*).

## 3. Spielerpool 0x3260C (vor der Managerschleife, 0xBDAC)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0x329C5 `cmpw $0x7d0,%es:0x513c` / `jbe 0x329d8`, 0x329D2 `movb $0xff,%es:0x5801(%si)` | Die namenlosen Poolplätze 1..150 bekommen Name und Byte 36 = Verein aus 0x324DE (random(0,17), kein Managerverein; der Name stammt aus dessen MANA-Liste). Nur bei 513C > 2000 wird Byte 36 wieder 0xFF. Im 1-/3-Jahres-Spiel behalten sie den Bundesligaverein | newgame.ts `randomName` setzt immer 0xFF | **fehlt** |
| 0x1643B (0x164A1-0x164B6) | Vereinsverteilung nach dem Startbildschirm: Spieler mit Byte 36 ≠ 0xFF werden bei Jahr A7A0 = 0 übersprungen. Im 1-/3-Jahres-Spiel verteilt sie die Poolspieler also nicht | `distributePlayers` | Folge von oben, **fehlt** |

## 4. Während des Spiels: Hauptmenü, Transfermarkt, Optionen

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0xA1EC-0xA20B (Zeichnen) `cmpw $0x7ac` / `$0x7c9` | Hauptmenü 0x971F, Gruppe 1 (Büro), Feld 6 = Werbung (Sprungtabelle 0xA5D0: 6. Eintrag 0xA5AE -> 0x8EAF(3), 0x28ED8, 0x8F0D(3)): im 1-Jahres-Spiel mit Bild 0x4029 statt des Symbols gezeichnet | main.ts Büro-Untermenü, Werbung immer offen | **fehlt** |
| 0xA370-0xA38F (Klick) | Derselbe Knopf: Klick springt nach 0xA3AE (übergangen, weiter warten). Der Werbebildschirm ist im 1-Jahres-Spiel nicht erreichbar; es bleibt bei den Werten aus 0xC548 | - | **fehlt** |
| 0x230C0-0x230ED `cmpw $0x7ac` / `$0x7c9` | Transfermarkt 0x22C15, Fläche 0x65 mit y > 109: im 1-Jahres-Spiel kein Umschalten LEIHEN/KAUFEN. -0x8 bleibt 0 (Vorgabe 0x22C5E) = KAUFEN (-0x8 ≠ 0 drittelt den Preis bei 0x23BAC und gibt 0x224A8 die 99 = Leihe bei 0x23E7B) | main.ts:6519-6521 beide Knöpfe immer | **fehlt** |
| 0x265A2-0x265D1 `cmpw $0x7d0` / `jae`; `mov %es:0x513c,%ax` | Optionen: "V2.0 - ENDE: " (4cb3:29BA über 4A20) + (513C < 2000 ? Zahl 513C : " NIE." 4cb3:21C1 über 2960) + " (LEVEL " (4cb3:29C8 über 4A24) + (5 − 4A28) + ")" (4cb3:5452). Anzeige z. B. `V2.0 - ENDE: 1993 (LEVEL 2)` bzw. `V2.0 - ENDE:  NIE. (LEVEL 2)` | `drawOptionen` immer NIE. | **fehlt** |

Die übrigen Menüsperren (Trainingslager bei Byte 313, "Neues Spiel"/Aufnahme bei 07AB = 4) hängen
nicht an 513C. Das 3-Jahres-Spiel sperrt nichts; LEIHEN und Werbung sind dort frei.

## 5. Saisonwechsel und Spielende (0x1D6F6, 0x1E6DD-0x1E8C9)

Der Vergleich steht im Saisonblock nach Saisonbilanz, Historieneintrag, Meister, Auf- und Abstieg
(0x1E460), Schwankung 0x10067(10) (0x1E662) und dem Einnahmengrundwert 241E je Manager
(0x1E66B-0x1E6DB), **vor** der gewöhnlichen Bestenliste 0x1E8CA:

```
1e6dd mov -0x61f6,%es        ; 4238
1e6e1 mov %es:0x513c,%ax
1e6e5 sub %dx,%dx
1e6eb cmp %es:-0x5860,%ax    ; 4238:A7A0 (Jahr, 32 Bit)
1e6f0 jne 1e6f9
1e6f2 cmp %es:-0x585e,%dx
1e6f7 je  1e6fc
1e6f9 jmp 1e8ca              ; gewöhnlicher Saisonwechsel
```

A7A0 ist das Kalenderjahr aus 0x4290 (07E0 + Übertrag über 365 Tage ab dem 29.7.); am Saisonende
(Juni) also 07E0 + 1. Das 1-Jahres-Spiel endet damit nach der ersten Saison (1993), das 3-Jahres-Spiel
nach der dritten (1995); das Endlosspiel (22251) praktisch nie.

Spielende-Zweig 0x1E6FC-0x1E8C9 (nur bei Gleichheit):

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0x1E6FC-0x1E72E | `movb $0x61` in je ein Zeichen der Zeichenketten hinter 4cb3:0704, 070C, 0718, 0720 (Tabelle 4cb3:06FC) | - | ohne Wirkung (Programm endet), siehe U2 |
| 0x1E733 `lcall $0x322b,$0x21c4` (0x34474(0)) | Bestenliste HIGH.xy laden (Dateiname Abschnitt 6) | `loadHighscore` | Dateiname **falsch** (Abschnitt 6) |
| 0x1E73C-0x1E8A4 | je Manager (304A = 0..07AB−1): 0x34CDA(m, **1**) -> Eintrag in 4238:4CFE **ohne +300** (0x34E4D `cmpb $0x0,0x8(%bp)` / `jne`); dann eigene Einordnung: gleicher Name (strcmp 1D52+58i gegen 4CFE) und gleicher Verein (1D6C gegen 4D18) ersetzt ohne Punktevergleich, sonst nur Platz 19 bei mehr Punkten (0x1E82E-0x1E848); danach Tausch-Auswahlsortierung absteigend (0x1E749-0x1E7C4) | - | **fehlt** |
| 0x1E8A7 `lcall $0x322b,$0x21c4` mit 1 | Bestenliste zurückschreiben | - | **fehlt** |
| 0x1E8B0 `lcall $0x322b,$0x2366` mit 0 | 0x34616(0): Bestenliste anzeigen (lädt neu, fügt nichts ein: 0x34695 `cmpb $0x0,0x6(%bp)`); zeichnet mit Bild 0x2D (0x346C7) | Bestenliste nur im Menü | **fehlt** |
| 0x1E8B9 `call 0x1a58c` mit 0 | Bildschirm löschen, `ENDE` (4cb3:537E) bei y 115 mittig, warten auf Klick/Taste (0x83BA) | - | **fehlt** |
| 0x1E8C1 `mov $0x63,%al` / `lcall $0x76b,$0x114c` | 0x87FC(0x63): Programmende ohne Fehlermeldung, wie nach "Aufhören" (0xA863) | ABWEICHUNGEN Z. 27: "entfällt" | **fehlt** |

Nicht mehr ausgeführt werden beim Spielende: die gewöhnliche Bestenliste 0x1E8D6 (0x34616(2) je
Manager), 0x14A4:2CB4, Ligaplätze, 07E2++, Sommertage, 07E0++. Gespeichert wird im Zweig nicht; der
letzte Spielstand (manuell oder die Monatssicherung, H4) liegt vor dem Ende. Danach kann der Spieler
nur das Programm neu starten: neues Spiel, oder einen alten Stand laden, der am selben Saisonende
wieder endet (513C kommt aus dem Stand, 0x33C4D). Eine Möglichkeit, weiterzuspielen oder die Spielart
zu ändern, gibt es nicht.

In den Saisonwechseln **vor** dem Ende (3-Jahres-Spiel nach 1992/93 und 1993/94) läuft der gewöhnliche
Weg 0x1E8D6: 0x34616(2) -> 0x34474(0) liefert die Spielart-Ziffer (1/3) -> `push %ax` ->
0x34CDA(m, 1 bzw. 3): auch dort **kein +300** (nur bei Rückgabe 0 = Endlosspiel).

## 6. Bestenliste 0x34474 (Dateiname)

```
3449d mov $0x35,%al / sub %es:0x4a28,%al / mov %al,0x94a2   ; Level-Ziffer '0' + angezeigter Level
344af cmpw $0x7ac / 344b8 cmpw $0x7c9 -> movb $0x1,-0x58    ; 1-Jahres
344c5 cmpw $0x7ae / 344ce cmpw $0x7cb -> movb $0x3,-0x58    ; 3-Jahres
344db add $0x30,%al / mov %al,0x94a1                        ; Spielart-Ziffer
```

Datei 4cb3:949C `HIGH.00` -> `HIGH.0L` (Endlos), `HIGH.1L` (1-Jahres), `HIGH.3L` (3-Jahres), L =
angezeigter Level 1..4. Rückgabe -0x58 = 0/1/3 (steuert das +300). Fehlt die Datei, prüft 0x34474
über `mana.dat` (4cb3:93D6), ob die Spieldiskette da ist, und legt eine leere Liste an.

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0x3449D-0x344E0 | Name aus Spielart und Level | highscore.ts `highscoreFile(seasonStartYear(g))`: 1993 -> HIGH.00, 1995 -> HIGH.01, sonst HIGH.02 | **falsch** (auch für Endlos, siehe N1) |
| 0x34E4D | +300 nur bei Spielart 0 | `bonus = highscoreFile(...) === "HIGH.02"` | **falsch** (N1) |

## 7. Speichern und Laden

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0x3319D `mov $0x513c,%cx` (0x322F7, 2 Bytes, nach 4A28 und vor 1D34) | Speichern | Save-Offset 34063 | stimmt |
| 0x33C4D `mov $0x513c,%cx` (0x323EF) | Laden | wird geladen, aber außer newgame.ts nirgends gelesen: ein Original-1-Jahres-Stand läuft im Remake endlos | **fehlt** |

Andere Zugriffe auf 513C gibt es nicht: gesucht nach dem Operanden 0x513c (auch `mov $0x513c` für
Blockroutinen) und nach indizierten Zugriffen 0x5000..0x513F. `0x513e`, `0x513e(%si)` (4238, 6-Byte-Feld
ab 513E) und `add $0x513a` (0xF903, Segment 4cb3) sind andere Variablen.

## Nachbau: nur ohne historischen Start

| Spielart | Unterschiede zum Endlosspiel |
|---|---|
| Endlosspiel (22251) | Oberliga (Wunschverein bleibt, wenn Oberligist ≤ 57); Poolspieler vereinslos; Optionen "NIE."; Bestenliste HIGH.0L mit +300 je Saisonende; kein Spielende |
| 3-Jahres-Spiel (1995) | Bundesliga (Wunschverein immer auf einen Platz random(0,17) ohne Europapokal); Kaderbasis s/2 + 68; Eintritt 16; Sitz 6.000, Steh 20.000, überdacht 7.000, Flutlicht 2, Anzeigetafel 1, Zustand 4, Komfort 3; Fanwert 50, Trainer/Fernsehgeld/Sponsoren mit L = 2; Poolspieler behalten einen Bundesligaverein (keine Verteilung); Optionen "1995"; Bestenliste HIGH.3L ohne +300; Ende nach der Saison 1994/95 |
| 1-Jahres-Spiel (1993) | wie 3-Jahres, dazu: Wunschverein übernimmt den Platz eines UEFA-Pokal-Teilnehmers, Byte 309 = 1; Kaderbasis s/2 + 80; Eintritt 18; Sitz 11.000, Steh 30.000; Flutlicht 3, Anzeigetafel 3, Zustand 5, Komfort 4; Werbung Trikot 180.000, Banden 6×45.000, Werbeausgaben 30.000; Werbebildschirm gesperrt; Markt nur KAUFEN; Optionen "1993"; HIGH.1L; Ende nach der Saison 1992/93 |

## Weggelassen: nur mit historischem Start

- 513C = 22222 / 1964 / 1966, 07E0 bleibt 1963 (erste Saison 1963/64), 56F4 = 0. Alle Leser oben prüfen
  beide Jahreszahlen, verhalten sich also gleich; Ende 1964 bzw. 1966.
- 56F4 = 0: Jugendblock 0xCEA7 schon ab Jahr > 1966 (ABWEICHUNGEN "Jugendspieler").
- Der Schalter ist nur sichtbar, wenn 4cb3:224E = 4cb3:2252 (U1).
- 07E0 wird nur von 0x4314 (Datum) gelesen und bei 0x1EA5C erhöht: ein historischer Start ändert nur das
  Kalenderjahr, nicht Vereine oder Spieler.

## Unklar

- **U1:** 4cb3:224E und 4cb3:2252 (je 32 Bit, im Abbild beide 1) - im Code keine Schreibstelle gefunden
  (weder direkt noch als `$0x224e`). Ob Lader oder Kopierschutz sie ändern, ist offen; nur davon hängt ab,
  ob "Histor. Start" angeboten wird.
- **U2:** 0x1E6FC-0x1E72E und 0x348D0-0x348F3 (nur 0x34616 mit Argument 0, also nur beim Spielende)
  überschreiben Zeichen der 18-Buchstaben-Folgen der Tabelle 4cb3:06FC mit 'a'. 0x2B60B liest dieselbe
  Tabelle für den Spielplan. Zweck unklar; ohne Folge, weil das Programm danach endet.
- **U3:** Bedeutung von 4238:2EA2 = 3 als Bestätigung des Dialogs (Maustastenwert?) nicht verfolgt.
- **U4:** Folgen der Poolspieler mit Byte 36 = Bundesligaverein (Abschnitt 3) für Markt 0x245A8 und
  Anzeigen nicht verfolgt.
- **U5:** Dass A7A0 unmittelbar vor 0x1E6E1 das Jahr des aktuellen Tages hält, schließe ich aus 0x4290
  und den Originalständen (A7A0 = 07E0 + 1 im Frühjahr); die letzte Aufrufstelle vor dem Saisonblock habe
  ich nicht einzeln belegt.
- 4cb3:05DA (Abbild 0, keine Schreibstelle gefunden) beendet bei 0x1DB8A im Monat 11 ebenfalls das
  Programm (0x87FC(0x63)); hängt nicht an 513C.

## Nebenbefunde

- **N1 (S, Remake):** `highscoreFile(seasonStartYear(g))` nimmt das Startjahr der **laufenden** Saison,
  nicht die Spielart. Da das Remake 1992/93 beginnt (07E0 = A7A0 = 1992, newgame.ts:391-393), schreibt
  `saisonwechselBeginnen` (server.ts:1199-1208) am Ende von 1993/94 nach HIGH.00 und am Ende von 1995/96
  nach HIGH.01, jeweils **ohne +300**. Aus dem Code gelesen, nicht ausgeführt. Richtig: Spielart-Ziffer aus
  513C, Level-Ziffer aus 34062 (siehe auch H7).
- **D1:** SPIELMECHANIK.md:702 ("Saison 1993/94, Kalender 29. Juli 1993") und ABWEICHUNGEN.md
  ("das Remake beginnt immer 1993/94") stimmen nicht: erste Saison 1992/93 (Originalstände CLAUDE*.MAN,
  RIED.MAN). SPIELMECHANIK.md:740-743 und T2e nennen den 1-Jahres-Verein "einen zufälligen Bundesligisten";
  genauer übernimmt der Wunschverein dessen Platz (0x3C24 tauscht die Vereinsdaten, der Manager behält den
  Verein).
- **D2:** 4cb3:224D heißt in SPIELMECHANIK.md:249-250 und training.ts:27 "Endlosspiel-Flag". Es wird im Code
  nirgends geschrieben (Abbild 0) und hat mit 513C nichts zu tun.
- **D3:** ABWEICHUNGEN nennt 4cb3:56F4; 0xBD49 lädt das Segment aus 4cb3:9A78 = 4238, es ist 4238:56F4.
- **D4:** ABWEICHUNGEN.md:27 ("Ende nach der eingestellten Saisonzahl ... entfällt") ist das Spielende oben;
  die Zeile muss beim Nachbau fallen.
