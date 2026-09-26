# Audit 2, Gruppe B: Routinen 0x08BC4 bis unter 0x0F4D7

Stand 26.9.2026. Bereich laut rohdaten-neu.md: 20 Routinen (0x08BC4 ... 0x0F2A6). Geprüft gegen bmp-remake (core/sim, server, web).
Befund-IDs B1..B23; Klasse S = spielrelevant, A = Anzeige, D = nur Doku. Nichts im Repo geändert.

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x08BC4 | Programmstart: Grafikmodus, Ressourcendatei laden, Palette/VGA-Ebenen (Ports 0x3C4/0x3C5) | - | nicht nötig (Grafik/System) |
| 0x08DBB | Historieblock 5012 Bytes = 0, Pokalrunden 306..310 = 30 nur für m < 07AB (07AB ist 0: läuft nie), 2560 Bytes 0xFF, Porträt 29 = m+1 | newgame.ts:257, 314-321 | stimmt (anzeigen.md richtig); SPIELMECHANIK falsch, siehe B10 |
| 0x08EAF | Grafikressourcen je nach Argument (1/2/sonst) freigeben (0x76b:0xdca) | - | nicht nötig (Grafik/System) |
| 0x08F0D | Grafikressourcen 4, 0x17, 3 laden und Zeiger ablegen | - | nicht nötig (Grafik/System) |
| 0x08FD8 | Programmhauptteil: Kommandozeile, Grafik, randomize (0x83A0), Stammdaten 0x299DC, 07AB = 0, 0x8DBB, Mischen 0x3AC5, EP-Teilnehmer 0x18B12, 0x1978D, Europapokal-Auslosung 0x18600(i,0) i=1..3, Startbildschirm 0xAD44(1); bei neuem Spiel danach 0x10067(10), randomize, 225A = 1, 0x1643B, 0x18600(0,0), 0x18600(i,1), 07DC = (int8)4cb3:224C, 0x245A8; dann 0x8F0D, 0x14E59, 0x1D6F6 | newgame.ts:createGame, server.ts `/api/newgame` | stimmt (Reihenfolge und Würfe; randomize entfällt wegen Seed-Rng) |
| 0x094B2 | Mausklicks im Hauptmenü: Klick aufs Kalenderblatt beendet den Zug (Rückgabe 1), versteckter Autoplay-Schalter (0,0)/(1,1) mit 063A = 0x47, Klick in den Kopf (y < 44) zeigt die Credits 0xF749 (Rückgabe 2), Klick in die Mitte ohne offenes Untermenü öffnet die Meldungsliste 0x30ED4 | main.ts: drawMenuHeader, `hit(244,46,70,60)` → finishTurn | stimmt grob (Bedienung). Der Kalenderbereich ist im Original x 243..305, y 50..101, im Remake x 244..313, y 46..105. Autoplay und Credits sind bewusst weggelassen (ABWEICHUNGEN) |
| 0x09623 | Trainer 478 = L·(r(15,20)+40) + ((L·(110-Fans)) & 0xFFFE)·500 (16 Bit), · r(10(L+10), 25(L+4)) / 100; TV 4cb3:0688+36m = 1000·(30L+Fans) | newgame.ts:117-127 | stimmt |
| 0x09623 | Trainergehalt (Byte 478) und Fernsehgeld (4cb3:066C+36m+28) je Manager | newgame.ts:`trainerUndFernsehgeld` (Aufrufe season.ts:456, newgame.ts:404) | stimmt |
| 0x0971F | Hauptmenü, also der Zug eines Managers: Autosave (5256), 5358 = 304A, je Liga Tabellenabschluss 0x2B4F3/0x2D143(L,1,1), Kopfzeile mit Ereignistext, 513E/56EE, Nummern der Bank, **Aufstellung 0x22030 bei jedem Aufbau**, Tabellenkurve, Meldungsmerker 56E2, Kalendermeldungen 0x143ED, Untermenüs mit Sperren (Lager bei Byte 313, Jahr 1964/1993, 4 Manager) | web/main.ts: drawMenu, drawMenuHeader, dayEvent, drawTabellenkurve; server.ts: zugBeenden; core/sim/lineup.ts: sperreAusgesetzt | Befunde B1, B2, B3, B4; der Rest stimmt, ist bewusst (Autosave und Speichern, 56EE immer 15) oder gehört zu U1.1 |
| 0x0A7DD | Rückfrage "Möchten Sie das Spiel wirklich beenden ?" über 0x31D7C, bei Ja exit(99) | main.ts: drawEndeDialog; core/sim/ki.ts | bewusst (ABWEICHUNGEN "Aufhören") |
| 0x0A89D | Kachel/Wappen aus Grafikressource zeichnen | - | nicht nötig (Grafik) |
| 0x0A9B3 | Steht Verein im Europapokal (Maske über Wettbewerbe 1..3, Rundenzahl aus 4238:0009) | fehlt | stimmt im Ergebnis für Endlosspiel (38..57 nie in EP); im 1-Jahres-Spiel Pflichtbedingung (B9) |
| 0x0AA35 | Taste/Klick abwarten | - | nicht nötig |
| 0x0AA56 | Zwei Porträtkacheln im Bild tauschen | - | nicht nötig (Grafik), Logik siehe B7 |
| 0x0AB84 | Zwei Tabellensätze (54 Bytes, 4238:0ECC) tauschen | newgame.ts:365-368 | stimmt |
| 0x0AC21 | Knopf (Level-Ziffer) zeichnen | main.ts `SPIEL-LEVEL` | nicht nötig |
| 0x0AD44 UI (0xAD44-0xB9AD) | Startbildschirm: Wappenleiste (-0x4, 0..63, zyklisch), Vereinsfeld, Porträttausch, Namenseingabe, Laden (0x334BC) | web main.ts:drawStart (~1160-1230) | Befunde B6, B7; Namenslänge unklar (U2.1) |
| 0x0AD44 Dialog (0xB9B0-0xBD02) | Spiel-Level (4a28 = 2·Zeile + Spalte), Radiogruppe Endlosspiel / 1-Jahres-Spiel / 3-Jahres-Spiel (Bits 0..2), Schalter "Histor. Start" (Bit 3) | main.ts: nur Level | Level stimmt; Spielarten siehe B9 |
| 0x0AD44 0xBD17-0xBDBC | 513C = Endjahr-Kennung (0x56CE / 0x7AC / 0x7AE, ohne Histor. Start +29, dann 07E0 = 1992, 56F4 = 1); 4a28 = 5 - 4a28; Pool 0x3260C; 304A = 0 | newgame.ts:285-289 (nur Endlosspiel: 22251) | stimmt für Endlosspiel |
| 0x0AD44 0xBDBF-0xBF39 | Nur beim Aufruf aus dem Spiel (0x971F bei 0xA7B4, 07AB > 0): neue Manager ab altem 07AB: Bytes 267..304 = 10, 306..310 = 30, 62+4i = 0xFF (i < 50), je Gruppe 2/5/8/5 Zufallsspieler random(07A6[g], 07A7[g]) mit Besitzer 5 (höchstens 1000 Versuche), 0x224A8(sp, 1, 0, 15000, 24) | fehlt | Befund B8 |
| 0x0AD44 0xBF3C-0xC0A6, 0xC6AC-0xC731 | Vereinstausch in die Oberliga: kein Tausch, wenn (0x197D5(Verein) >> 1) == 2 und Verein <= 4cb3:2277 (57); sonst random(38,57) (4cb3:226E[2]=38, 225E[2]=20) bis kein früherer Manager dort und 0xA9B3(y,7) = 0; 0x3C24(v,y,0), 0xAB84(v,y) | newgame.ts:356-369 | stimmt |
| 0x0AD44 0xC0A8-0xC1B9 | Kaderwerte: je Wert random(b,b+5), random(40,60), Form = zweiter; Spielertabelle über -0x4 | newgame.ts:378-386 | **Befund B5** (Schleifenzahl bei mehreren Managern) |
| 0x0AD44 0xC1BB-0xC4DC | Gehälter 0x24D4E(slot,1); Bälle 321..325 = 5,4,6,5,6 und 326..329 = 1,3,3,3 (4cb3:0286/028C); Liga 312 = 2; Eintritt 266 = 10; 358/350/366/390/398; 305 = 16; Fans 476 = 10 | newgame.ts:387-403 | stimmt |
| 0x0AD44 0xC4DE-0xC507 | 0x9623, Sponsoren 0x176F4; nur im Spiel (07AB>0 beim Eintritt) 0x22030 und 0xF9D2(m,0) | newgame.ts:404-406 | stimmt (Neues Spiel) |
| 0x0AD44 0xC510-0xC6A8 | Schleife je Manager: 5358 = m; (1-Jahres) Werbewerte; leerer Name Manager 0 -> Verein 11·m; Liga -2 = 2 (Endlos) bzw. 0 (1-/3-Jahres); Konto 1,5 Mio, bei 4a28 = 4 (gespeichert) 1,9 Mio; 492 = 99999; b = 4a28/2 + 27 (+41 Liga 0, +12 1-Jahres) | newgame.ts:371, 407-408 | stimmt für Endlosspiel |
| 0x0AD44 0xC734-0xC74A | 304A zurück; nur neues Spiel: Zinstabelle 0x112AA | newgame.ts:422 | stimmt |
| 0x0CB62 | Saisonende je Manager: Prämien, Werbung beim Aufstieg, Torschützenkönig, Jugend, Aprilscherz, Jahrgangswechsel, Karriereende, Saisonwerte, Anzeigeoptionen, Vertragsenden, dann 0x0F2A6 | seasonEvents.ts:`seasonEvents`, `jahrgangswechsel`, `jugendInKader`, `releaseExpiring`, `optionenImStandAnpassen`; season.ts:`saisonwechselTeil1` (Werbung) | Befunde B11, B12, B13, B14, B15, B17 |
| 0x0DF0D A (DF0D-DF53) | Schwelle 37-[Stufe=5], ganze Routine entfällt ab Saisontag 322 | tagesroutine.ts:43, training.ts `threshold` | stimmt |
| 0x0DF0D B (DF54-E00A) | Markt, nur Manager 0: Frische > 56 um random(3,9) weniger, mit 1/4 fallen die Angebotsbits weg | transfer.ts:239-246 `dailyTransfers` | stimmt (Markt ist lückenlos, `removePlace` rückt nach) |
| 0x0DF0D C (E00B-E057) | Lebensdauer der Meldungen | Server-Meldungen | bewusst (ABWEICHUNGEN: Meldungen) |
| 0x0DF0D D (E058-E1FA) | eigene Spieler auf dem Markt: Ablehnungsbit 1/3, 0x0F6D8, Angebot fremder Vereine bei random(0,180) < Wert und random(0,2) ≠ 0 | transfer.ts:247-265 | stimmt (Zeiger ↔ Bit 0x80 gleichwertig, siehe Unklar U4.2) |
| 0x0DF0D E (E1FB-E443) | Krawallschaden (4·[358] + [350]/2)·random(2,5), auf 1000 abgerundet, Komfort 390 1/3 bzw. 2/3 | finance.ts:241-260 `stadionTag` | Rechnung stimmt; Meldung **Befund B21** |
| 0x0DF0D F (E444-E537) | Komfortabnutzung random(0,442-52·[398]) = 0, > 1, nur Bundesliga | finance.ts:271-276 | Rechnung stimmt; Meldung **Befund B21** |
| 0x0DF0D G (E538-E9D7) | Kaderschleife: Verletzung, Karriereankündigung, Nummer 0, Angebotsbits, Zähler Byte 24, Verlängerungsangebot | tagesroutine.ts:50-59, training.ts:175, contracts.ts:149/192/276, server.ts:1998 | Reihenfolge und Würfel stimmen; **Befund B19**; Meldungsdatum Verletzung **Befund B22** |
| 0x0DF0D H (E9D8-EB33) | Angebote fremder Vereine: random(0,200) < Wert, random(0,450) = 0, Ausland bei Wert > 90 mit 1/13 | transfer.ts:277-296 `kaderAngebote` | **Befund B18** |
| 0x0DF0D I (EB34-EB9C) | Grundgewinn je Linie aus der Matrix 4cb3:0292 und den Bällen, /400 | training.ts:63-64 | stimmt (Matrix byteweise verglichen) |
| 0x0DF0D J (EB9D-EEE2) | Trainingslinie: Gewinn·Faktor/100·B14/50·Positionsbälle/100, Ziel, Frischezuschlag, Richtung, Schritt, Grenzen | training.ts:97-139 | Würfel und Grenzen stimmen; **Befund B20** (16-Bit-Überlauf) |
| 0x0DF0D K (EEE3-EF7C) | Trainingsfaktor Byte 14 / Sonderprogramm Byte 20, abgelaufen → 0x2277A | training.ts:142-156 | stimmt (auch der Unterlauf der Restdauer auf 0xF) |
| 0x0DF0D L (EF7D-F124) | je Platz 0x0F6D8, Frische > 50 um random(3,7) weniger, Intensität im Fenster mindestens 6, Frische ±, 60..150, Faktor 20·Int, Abzug über 135, Torwart +30; am Ende 0x22030 | training.ts:71-92, tagesroutine.ts:62 | stimmt |
| 0x0F125 | Seitentausch: Starter mit \|Spalte(B25) - Vorliebe(Spieler 32)\| > 1 tauscht mit dem Starter derselben Reihe (B26), dessen Vorliebe am besten zur Spalte passt (Start 99, strikt <), wenn das besser ist | lineup.ts:130 `seitenTausch` | stimmt (Abstand 0x319E5 = \|a-b\|, Grenzen, Vergleiche, Tausch geprüft) |
| 0x0F2A6 | Spielerpool der KI-Vereine: Fehlbestand je Liga aus 0x161D8, Kandidaten aus den anderen Ligen versetzen (0x0F4D7), am Ende noch einmal 0x161D8 | pool.ts:`seasonPlayerPool` | stimmt bis auf B16 (praktisch nie) |

Zusatz zu 0x0971F (ohne Befund geprüft):

- 0x9755 / 0xA649 / 0xA7C4: 4238:5358 = 304A, nach jedem Untermenü zurück. Im Remake gegenstandslos.
- 0x9A01-0x9A25: 56EE = 15 - 2·(224E = 4). Die historischen Startjahre gibt es im Remake nicht, darum ist 56EE immer 15 (bewusst). Die Umnummerierung der Bank 0x9C53-0x9D44 (16 → 15, alles > 15 → 0) läuft damit im Remake ins Leere, weil keine Nummer über 15 vorkommt.
- 0x9A73-0x9C46, Zweige A, B und C: Ligatag über Bit (Managerbyte 312) im Kalenderbyte 4cb3:2280[016E] mit dem Text "225A[Liga]. Spieltag"; der DFB-Pokal mit di = 8 und Managerbyte 306 = 4238:0008 setzt 513E = 1. Im Remake stimmen `sperreAusgesetzt` und der Spieltagstext (`nextMatchday` = 28432 = 225A).
- 0xA1C5-0xA222 / 0xA349-0xA3A9, gesperrte Knöpfe: das Trainingslager bei Managerbyte 313 ≠ 0 stimmt (main.ts:3417). Knopf 6 der Gruppe 1 ist bei 513C = 1964/1993 gesperrt; das Remake schreibt 513C = 22251, dort also nie gesperrt. "Neues Spiel" bei 07AB = 4 fällt im Mehrspielerbetrieb weg.
- 0x9F97: 56E2[Manager] (gesetzt in 0x30E2F, wenn eine Meldung ohne sofortige Anzeige eingeht) öffnet die Meldungsliste; das Remake zeigt die Meldungen zu Zugbeginn im Hauptmenü (main.ts:3394). Das ist nur Anzeige.
- 0x9FD5: 0x143ED einmal je Zug und nach dem Laden (0xA75A). Das Remake legt die Hinweise je Tag ab (SPIELMECHANIK "Kalendermeldungen"), stimmt.
- 0xA643: 0x4290(0) stellt das Datum aus 07DC wieder her (anzeigen.md, Eigenheit), gegenstandslos.

## Befunde

### Hauptmenü 0x0971F

#### B1 (S): 513E = 1 auch an Europapokaltagen, das Remake kennt nur den DFB-Pokal

- Original 0x9B88-0x9C0A: Zweig D des Kopftexts, erreicht, wenn weder der Ligazweig noch der DFB-Zweig noch die Relegation greift:
  `movw $0x0,-0x150(%bp)`, Schleife k = 1..3 mit `mov %es:0x8(%bx),%al` (4238:0008+k, die laufende Runde) und `cmp %cl,%es:0x2374(%bx)` (Managerbyte 306+k), bei Gleichheit `movw $0x1,-0x150(%bp)`. Danach `cmpw $0x0,-0x150(%bp); je`, `test $0x70,%di; je`, `cmp $0x10,%di; je` und dann der Text "Europapokal", `movb $0xf,%es:0x56ee` und `jmp 0x9b2d`, also `movb $0x1,%es:0x513e`.
- Remake core/sim/lineup.ts:234-237: `sperreAusgesetzt` gibt nur bei `calendarFlag === FLAG_CUP` (8) und `u8(306) === plain[28233]` true zurück. Europapokaltage (Kalenderbyte 0x70) liefern immer false.
- Folge: An jedem der zehn Europapokaltage stellt die Automatik 0x22305 im Original gesperrte Spieler auf, wenn der Verein in einem der drei Europapokale in der laufenden Runde steht. Im Remake fehlen sie (Kauf und Systemwahl in server.ts:3282/3303, der gemerkte Wert `sperre513E` in server.ts:1143). Auch die Kaderliste im Client (`einsatzFlag`, main.ts:4963) zeigt dann fälschlich "GESP.".
- Sicher, weil die Zweigfolge eindeutig ist: 0x9B37 und 0x9C0A laufen beide über 0x9B2D. 22030.md, Befund A2, beschreibt nur den DFB-Zweig 0x9AE8-0x9B31.

#### B2 (S): Das Hauptmenü stellt bei jedem Aufbau neu auf (0x9D46), das Remake nicht

- Original 0x9D46: `lcall $0x1ecd,$0x3360` (0x22030, die Aufstellungsautomatik) steht ohne Bedingung im Aufbau des Hauptmenüs ab 0x97DC. Dorthin springt das Programm beim Zugbeginn, nach jedem Untermenü (0xA659 `jmp 0x97dc`), bei Rückgabe 2 von 0x94B2 (0xA077, 0xA4AC) und nach "Neues Spiel" (0xA7D4 → 0xA5E1 → 0xA659). Ausgewertet wird dabei der unmittelbar vorher gesetzte 513E dieses Managers (0x99FC, 0x9B31). 0x22030 löscht Byte 10 der Plätze 0..23 und stellt neu auf (22030.md). Die Aufstellung vom Tagesbeginn (0x1D797) wird damit im Zug jedes Managers mit Automatik überschrieben.
- Remake: server.ts:1333-1339 stellt nur am Tagesbeginn auf, mit `r.sperre513E`, dem Wert des letzten Managers vom Vortag. `zugBeenden` (server.ts:1141-1148) und der Zugbeginn stellen nicht neu auf, das tun nur einzelne Aktionen (Kauf, Systemwahl, server.ts:2802/3024/3057/3282/3303). Der Vergleichslauf originaltag.ts:95-122 bildet das Hauptmenü ebenfalls nur mit den Autosave-Würfen nach, ohne 0x22030.
- Folge für Manager mit Automatik (System ≠ manuell):
  - Pokaltag, der Verein ist dabei: im Original spielen gesperrte Spieler (513E = 1). Im Remake nur dann, wenn zufällig der letzte Manager des Vortags 513E = 1 hatte.
  - Ligatag nach einem Pokaltag, an dem der letzte Manager dabei war: `sperre513E` ist true, das Remake stellt am Tagesbeginn gesperrte Spieler auf und behält die Aufstellung für das Ligaspiel. Das Original stellt im Hauptmenü mit 513E = 0 neu auf.
  - Jede andere Änderung im Zug ohne eigenen Aufstellungsaufruf im Remake.
- Der am Tagesbeginn gemerkte Wert (#114) wirkt im Original praktisch nie, weil an Zugtagen jeder Manager das Hauptmenü durchläuft.

#### B3 (A): Ereignistext im Kopf des Hauptmenüs weicht ab

- Original 0x9A29-0x9C46, Reihenfolge:
  1. Argument 0xFF (Saisonendschleife 0x1E077 `mov $0xff,%al; push; lcall $0x8bc,$0xb5f`) oder Datum 2EBA = 20 + 224C und Monat 2E8E = 5 ergibt "SAISONENDE" (4cb3:25B8).
  2. Ligabit ergibt "n. Spieltag".
  3. DFB (di = 8, Byte 306 = 4238:0008) ergibt "DFB-Pokal".
  4. Verein = 4238:5369 oder 5370 (Bundesliga Platz 16, 2. Liga Platz 3) und di = 0x10 ergibt "Relegation" (25C4).
  5. Europapokal (Byte 306+k = 4238:0008+k, di & 0x70, di ≠ 0x10) ergibt "Europapokal".
  6. 0x310A und di & 0x80 ergibt "Nachholspiel", sonst "Spielfrei".
- Remake main.ts:3253-3271 `dayEvent`:
  - `dabei(cup)` = Runde 1..7 statt Runde = laufende Runde. Der Verlierer behält aber seine Runde (europa.ts:53, `setManagerRound` nur für Sieger). Ausgeschiedene Manager sehen darum an späteren Pokaltagen "DFB-Pokal" bzw. "Europapokal" statt "Spielfrei".
  - `flag & (8 << 1)` prüft 0x10, also den Relegationstag, als Europapokal 1: wer in der Saison im Landesmeisterpokal war (Byte 307 in 1..7), sieht an den Relegationstagen "Europapokal". "Relegation" für die beiden Relegationsvereine fehlt ganz.
  - "SAISONENDE" fehlt: im Saisonendzug steht "Spielfrei".

#### B4 (A): Flacher Strich der Tabellenkurve unter falscher Bedingung

- Original: 0x9860 `cmpb $0x1,-0x156(%bp); jle` setzt bei höchstens einem Spiel nur den Startpunkt auf y = 0x4A und die Schrittweite auf 116.0 (DS:0x9A2C). Die Schleife zieht dann kein Stück. Ob der flache Strich kommt, entscheidet 0x9F1B-0x9F2F: `cmpw $0x0,%es:0x7de ... cmpw $0x1,%es:0x7dc; jbe 0x9f63`, also nur bei Saisontag 4cb3:07DC ≤ 1 (Farbe 7). Sonst zieht 0x9F31 die Schlusslinie in Farbe 11 von (63, 74) nach (177, Managerbyte 268 + 65).
- Remake main.ts:3224-3227: bei `spiele <= 1` flacher Strich in Farbe 7 (#303051) und Ende.
- Folge: Vor dem zweiten Spiel der Saison zeigt das Original eine schräge Linie in Farbe 11, das Remake einen flachen grauen Strich. Die Beschreibung im Kommentar (main.ts:3169-3170) stimmt insoweit nicht.

### Neues Spiel / Startbildschirm 0x08FD8, 0x0AD44

#### B5 (S) Kaderwerte: die Wurfschleife läuft über die Kader **aller** Manager
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

#### B6 (S) Zwei Manager können denselben Verein wählen
Original 0xB659-0xB69D: der Klick aufs Vereinsfeld setzt Byte 30 nur, wenn kein Manager j < 07AB den Verein
schon hat (`b66c cmp -0xa(%bp),%ax; b671 movw $0x1,-0x5c(%bp)`, `b688 cmpw $0x0,-0x5c(%bp); jne 0xb6dc`).
Remake: web main.ts:1208 `this.hit(x + 12, 110, 40, 40, () => (sl.club = st.selected))` ohne Prüfung,
server.ts:2649 übernimmt `club` ungeprüft, newgame.ts:341-346 findet für beide denselben Index. Nach dem Tausch
für Manager 0 zieht swapClubs (season.ts:58-61) Manager 1 mit (gleicher clubIndex), der dann als Oberligist
stehen bleibt: zwei Manager führen denselben Verein.

#### B7 (A) Porträts werden im Original nur getauscht, im Remake frei gewählt
Original 0xB704-0xB74B: erster Klick merkt den Manager (-0x2c = m+1), zweiter Klick tauscht Byte 29 der beiden
(`b73e mov %al,%es:0x225f(%bx)`, `b746 mov %al,%es:0x225f(%si)`); Start 0x8DBB Byte 29 = m+1, also immer vier
verschiedene Porträts. Remake main.ts:1214 `sl.portrait = (sl.portrait % 4) + 1` erlaubt gleiche Gesichter.
Nur Anzeige.

#### B8 (S, fehlender Zweig) Manager im laufenden Spiel aufnehmen
0x971F ruft bei 0xA7AC-0xA7B4 (Diskettenmenü, 6. Eintrag) 0x8EAF(2), 0xAD44(0), 0x8F0D(2). Mit 07AB > 0 beim
Eintritt (-0x36) nimmt 0xAD44 weitere Manager auf (0xB9AD `jmp 0xbdbf`): Bytes 267..304 = 10 (`becf movb $0xa,%es:0x234d(%bx)`),
306..310 = 30 (`bef7`), Verlauf 62+4i = 0xFF (`bf25`), je Gruppe 2/5/8/5 Spieler random(07A6[g], 07A7[g]) —
also 1..20, 20..64, 64..106, 106..151, Grenzen doppelt und 151 hinter der Tabelle — mit Besitzer 5, bis 1000
Versuche (`be37 cmpw $0x3e8`), 0x224A8(sp, 1, 0, 15000, 24) mit **1** Jahr Vertrag; danach dieselbe Schleife ab
0xC510 mit 0x22030 und 0xF9D2(m,0), ohne Zinstabelle. Das Remake hat keinen Weg, Manager nachträglich
aufzunehmen (keine API, `/api/seat` besetzt nur vorhandene), und ABWEICHUNGEN nennt es nicht.

#### B9 (D) "Historische Startjahre 1964/1966" sind in Wahrheit Spielarten
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

#### B10 (D) SPIELMECHANIK beschreibt Werte des Aufnahme-Zweigs als Neues Spiel
docs/SPIELMECHANIK.md:674 "Manager Byte 306..310 = 30" (0x8DBB-Schleife läuft bei 07AB = 0 nie, 0x8E15) und
:704 "Bytes 267..304 = 10; Historie 62..261 = 0xFF" (nur 0xBDBF-Zweig, B8). Beim neuen Spiel bleiben sie 0, so
wie newgame.ts:409-410 und der Test es haben.

### Saisonende 0x0CB62, Spielerpool 0x0F2A6

#### B11 (S): Jugendkonto und Jugendspieler hängen im Original vom Jahr und von der Startoption 56F4 ab

- Original 0x0CEA7..0x0CEEE: Der ganze Jugendblock (Konto J-J/3 zurückschreiben, Wurf
  random(0,2), Jugendspieler) läuft nur, wenn
  `(Jahr 4238:A7A0 > 1966 && 4238:56F4 == 0) || (Jahr > 1995 && 4238:56F4 != 0)`:
  `cmpw $0x7ae,%es:-0x5860` / `cmpb $0x0,%es:0x56f4` / `je 0xcef0` bzw.
  `cmpw $0x7cb,%es:-0x5860` / `jbe 0xcf48`. Sonst geht es zu 0xD10C: das Konto bleibt unverändert
  und es wird **nicht** gewürfelt.
- 56F4 schreibt nur der Startbildschirm (0x0BD4D: `56F4 = !(Optionsbits >> 3) & 1`). Die Optionen
  beginnen mit `movb $0x1,-0x58(%bp)` (0x0AD7A), Bit 3 ist also aus, 56F4 = 1. Das ist genau der
  Fall, in dem das Original das Jahr 4cb3:07E0 auf 1992 setzt (0x0BD63) - so startet auch das
  Remake (newgame.ts:450). 56F4 steht nicht im Spielstand (MEMORY-MAP, kein Block deckt 4238:56F4
  ab; im Bild ist das Byte 0), nach einem Laden in einem neuen Programmlauf ist es 0.
- Folge im Original: ein im selben Programmlauf gespieltes neues Spiel bekommt an den Saisonenden
  1993, 1994 und 1995 keine Jugend und kein Abschmelzen des Jugendkontos (und einen Wurf weniger
  je Manager); nach einem Laden gilt die Bedingung Jahr > 1966, also immer.
- Remake seasonEvents.ts:230-235 rechnet immer (`let j = ...; j = j + div(j, -3); ... if (j > 30
  && rng(0, 2) === 0 ...`). Es entspricht damit nur dem Fall "geladen". Das Zweigbuch 0CB62 (F)
  nennt die Bedingung und urteilt trotzdem "stimmt"; ABWEICHUNGEN erwähnt sie nicht.
  Entscheiden: nachbauen (Merker im Raumzustand wie die anderen Programmlauf-Werte) oder als
  bewusste Abweichung eintragen.

#### B12 (S): Torschützenkönig wird im Original vor dem Auf- und Abstieg bestimmt, im Remake danach

- Original: das Byte je Manager, das 0x0CB62 bei 0x0D6B6 liest (`les 0x6(%bp),%si; mov
  %es:(%bx,%si),%al`), rechnet der Tagesablauf bei 0x1E1AA/0x1E1B0 aus (`lcall $0x14a4,$0x1ad5` =
  0x16515(1), `mov %al,-0x20(%bp,%si)`), und zwar in der Schleife **vor** 0x1EB17
  (Ewigkeitspunkte), also vor dem Zurücksetzen der Tabellen, dem Auf- und Abstieg, dem Mischen und
  vor allen Karriereenden. 0x1E935 reicht dieses Feld nur durch.
- Remake: seasonEvents.ts:223 `hasTopScorer(g, i)` läuft in der Managerschleife, also nach
  `promoteRelegate`/`shuffleLeagues` (season.ts:370-385) und nach Jugend, Jahrgangswechsel und
  Karriereende der vorherigen Manager. `hasTopScorer` nimmt die Liga aus dem **neuen**
  Vereinsindex (seasonEvents.ts:51) und `leagueScorers` die Vereine nach ihrem neuen Ligaband.
- Folge: Für einen Auf- oder Absteiger vergleicht das Remake mit der Liste der neuen Liga (die
  Mitaufsteiger und die Gebliebenen, nicht mehr die Absteiger). Ein Zweitliga-Torschützenkönig
  eines Aufsteigers bekommt die 250.000 DM nur, wenn er auch die Bundesligaschützen übertrifft;
  umgekehrt kann ein Absteiger sie für die Zweitliga-Liste bekommen. Zusätzlich verschieben
  Rücktritte/Rückkehrer des ersten Managers die Liste für die folgenden.
- Behebung: Flags wie das Original vor `ewigkeitspunkte` in `saisonwechselTeil1` bestimmen und an
  `seasonEvents` übergeben.

#### B13 (S): Neubelegung eines Datensatzes (Karriereende) schreibt die Positionsart in einen anderen Spieler

- Original 0x0D615..0x0D631: `random(0,6)` → `mov $0x25,%ax; imulw -0x7c(%bp); ... mov
  %cl,%es:0x57fd(%bx)`. Index ist **-0x7c**, nicht der Schleifenspieler -0x7a (das Alter
  davor und Byte 28/29 gehen über `%si` = 37·(-0x7a) an den richtigen Spieler, 0x0D5DB/0x0D610/
  0x0D646). -0x7c ist in 0x0CB62 der Zähler der Bandenschleife (0x0CC7F, endet auf 6, nur beim
  Aufstieg) bzw. der Index des Jugendspielers (0x0CF96); beim ersten Manager ohne beides ist er
  uninitialisiert (Stapelrest).
- Folge im Original: der neu belegte Spieler (vereinsloser Alter > random(32,34) oder
  zurückgetretener Kaderspieler) behält seine alte Positionsart (Spielerbyte 32). Den Wurf bekommt
  stattdessen der Jugendspieler dieses Managers (überschreibt dessen random(0,6) von 0x0CFDE; der
  letzte Wurf gewinnt), nach einem Aufstieg ohne Jugend der Spieler 6, sonst der Spieler aus dem
  vorigen Managerdurchgang.
- Remake seasonEvents.ts:210 `p.setU8(32, rng(0, 6))` am neu belegten Spieler. Reihenfolge der
  Würfel stimmt, das Ziel nicht. Auch SPIELMECHANIK.md ("Positionsart random(0,6)" beim
  Neubelegen) ist danach falsch.

#### B14 (S): Rückkehr eines Leihspielers löscht Leihmarke und Vertragsbyte im Kader von Manager 0

- Original 0x0D3BC..0x0D3E8: nach Aufnahme (0x224A8 für den Besitzer, 304A = Besitzer) und Kopie
  des alten Platzes: `mov -0x44(%bp),%al` (= 304A zu Beginn des Durchgangs, 0x0D222; der
  Jahrgangswechsel läuft nur bei 304A == 0, 0x0D27D) `... mov %al,%es:0x304a; mov $0x19,%cl; imul
  %cl; add -0x80(%bp),%ax; ... mov %al,%es:0x7762(%bx); mov %al,%es:0x7756(%bx)`. Gelöscht werden
  Byte 24 und 12 auf Platz 25·**0** + neuer Platz, nicht im Kader des Besitzers. Das läuft auch im
  Zweig Besitzer ≥ 4 (0x0D378 → 0x0D38A), dann mit einem alten -0x80.
- Folge im Original, wenn der Besitzer nicht Manager 0 ist: der Rückkehrer behält Byte 12
  (Leihmarke) und Byte 24 (Vertragsgespräch/Karriereankündigung) des alten Platzes; dafür verliert
  der Spieler von Manager 0 auf diesem Platzindex seine Bytes 12 und 24 (z.B. die
  Karriereankündigung Bit 7, die über das Karriereende entscheidet).
- Remake seasonEvents.ts:181-184 löscht `plain[o + 24]` und `plain[o + 12]` am neuen Platz des
  Besitzers. Stimmt nur für Besitzer 0.

#### B15 (S): Jahrgangswechsel schiebt den alten Platz mit falscher Länge auf, wenn er Platz 4 ist

- Original 0x0D396..0x0D3B4: `cmpb $0x4,-0x68(%bp)` (-0x68 = **Platz**, -0x86 = Halter, siehe
  0x0D34B `25·(-0x86) + (-0x68)`), Länge = (2 - (Platz == 4))·12, dann `lcall $0x1ecd,$0x10ee`
  (0x1FDBE) mit (Platz, 1, Länge). 0x1FDBE kopiert Platz k+1 nach k für k = Platz..Länge-1 und setzt
  nur Byte 15 von Platz Länge auf 0 (0x1FE92..0x1FEBC).
- Folge: Steht ein Leihspieler im Managerkader auf Platz 4, wird nur bis Platz 12 aufgeschoben:
  Platz 12 wird leer (nur Spielernummer 0, Rest bleibt), die Plätze 13..23 bleiben stehen - der
  Kader hat eine Lücke, und alles, was über die Zahl der belegten Plätze sucht (0x31A19/0x320C7,
  auch das Vertragsende 0x0DB40), sieht den letzten Spieler nicht mehr. Bei einem Halter-Kader auf
  einem anderen Platz und beim Markt auf Platz 4 ist das Ergebnis dasselbe wie im Remake; beim
  Markt auf anderen Plätzen schiebt das Original die Plätze 112..124 mit (siehe "Unklar").
- Remake seasonEvents.ts:177 `removePlace(g, basis, wo.place, wo.manager === 4 ? 12 : 25)` - immer
  lückenlos.

#### B16 (S, praktisch nie): Spielerpool zieht höchstens 1001 Mal

- Original 0x0F3EA..0x0F41F: `mov -0x56(%bp),%ax; incw -0x56(%bp); cmp $0x3e8,%ax; jl 0xf3ef` -
  nach 1001 Treffern auf verbrauchte Einträge wird der Eintrag 0xFF genommen, also Spieler 255, und
  `mov %cl,%es:0x5801(%bx)` schreibt hinter die Spielertabelle (4238:7CDC, in den Aufstellungen).
- Remake pool.ts:144-145 `do r = rng(...) while (cand[src][r] < 0)` ohne Grenze. Nur relevant,
  wenn fast alle Kandidaten einer Liga verbraucht sind (Wahrscheinlichkeit etwa (1-1/n)^1001).

#### B17 (D): Beschreibung des Karriereendes in SPIELMECHANIK.md

- SPIELMECHANIK.md "Saisonende je Manager": "Rücktritt (0x0D475): Kaderspieler mit Alter >
  random(32,34) beenden die Karriere". Der Code (0x0D4DE..0x0D51F) und das Remake
  (seasonEvents.ts:262-285) sagen: Kaderspieler gehen, wenn Byte 11 = 0 und Byte 24 Bit 7; neu
  belegt nach Alter > random(32,34) werden nur Spieler, die auf keinem Kader- oder Marktplatz
  stehen. Außerdem zu B13: die Positionsart geht nicht an den neu belegten Spieler.
- SPIELMECHANIK.md (neues Spiel, 0x09623): "((L·(110 - Fans)) & 0xFE)·500". Der Befehl ist `and
  $0xfe,%al` (0x09681), löscht also nur Bit 0 des 16-Bit-Produkts (& 0xFFFE, so auch
  newgame.ts:120). Die Schreibweise & 0xFE ist missverständlich.

### Tagesroutine 0x0DF0D

#### B18 (S): Angebote fremder Vereine trotz eines liegenden Verlängerungsangebots

- Original 0x0EAFA-0x0EB06 (Abschnitt H): Bedingung für das Angebot ist, dass im Kaderplatz **kein
  Meldungszeiger** steht: `mov %es:0x32(%bx),%ax; or %es:0x30(%bx),%ax; je 0xeb0b`, erst danach
  `orb $0x40,%es:0x9(%bx)`.
- Der Zeiger wird auch beim Verlängerungsangebot gesetzt: 0x0E9C1 `lcall $0x3091,$0x190`, dann
  0x0E9CD/0x0E9D1 `mov %ax,%es:0x30(%bx)` / `mov %dx,%es:0x32(%bx)`, zusammen mit Byte 24 = 100 + Jahre
  (0x0E992). Wieder gelöscht wird er nur zusammen mit den Angebotsbits (0x0E5B8, 0x2355A, 0x23A40),
  beim Verfall des Angebots (0x0E621, dort geht Byte 24 auf random(9,17)), im Vertragsdialog (0x2617A)
  und am Saisonende (0x0D43A).
- Remake transfer.ts:286: `... || (l.u8(9) & OFFER_SQUAD) !== 0) return;` prüft nur Bit 0x40.
  Liegt ein Verlängerungsangebot (Byte 24 = 101..104, Bit 0x40 frei), macht das Remake dem Spieler
  trotzdem ein Angebot eines fremden Vereins. Das Original tut das nicht.
- Folgen: Bit 0x40 und Byte 22 werden geschrieben. Dazu kommen Würfe, die das Original nicht macht:
  `rng(0,12)` bei Wert > 90, die Vereinswahl `chooseOfferClub` und der Meldungswurf random(0,3).
  Damit verschiebt sich der Zufallsstrom.
- Dafür bin ich mir sicher: die beiden Würfe davor (random(0,200), random(0,450)) liegen in beiden
  Fassungen gleich, verschieden ist nur die dritte Bedingung. Ein liegendes Verlängerungsangebot
  hat immer einen Zeiger, weil 0x0E9CD ihn gleich nach der Meldung setzt.

#### B19 (S): Verlängerungsangebot trotz eines Angebots eines fremden Vereins

- Original 0x0E93C-0x0E956 (Abschnitt G): nach random(0,N) = 0 und random(0,3) = 0 gelten drei
  Bedingungen:
  - kein Meldungszeiger: `mov %es:0x32(%bx),%ax; or %es:0x30(%bx),%ax; jne 0xe958`
  - Bit 7 von Byte 24 frei: `testb $0x80,%es:0x18(%bx)`
  - Byte 11 = 1: `cmpb $0x1,%es:0xb(%bx); je 0xe95b`
  
  Byte 24 ≥ 100 prüft das Original nicht.
- Der Zeiger steht auch nach einem Angebot eines fremden Vereins (0x0EA6D/0x0EA71 nach
  `orb $0x40,%es:0x9(%bx)` bei 0x0EB0B).
- Remake contracts.ts:209: `if (b24 & 0x80 || b24 >= 100 || l.u8(11) !== 1) return null;`. Das Remake
  ersetzt die Zeigerprüfung durch `b24 >= 100` und prüft Bit 0x40 von Byte 9 nicht. Ein Spieler im
  letzten Vertragsjahr mit einem Angebot eines fremden Vereins (Bit 0x40 gesetzt, Byte 24 < 100)
  bietet im Remake eine Verlängerung an, im Original nicht.
- Folgen: Byte 24 = 100 + Jahre. Dazu kommen die Zusatzwürfe `rng(0,100)` und der Meldungswurf.
  Der Zufallsstrom verschiebt sich.
- Die Umkehrung (Byte 24 ≥ 100 ohne Zeiger) kann nur nach dem Saisonende entstehen, siehe Unklar U4.1.

#### B20 (S, Randfall): 16-Bit-Überlauf beim Trainingsgewinn fehlt

- Original 0x0EE0C-0x0EEA3: alle drei Schritte rechnen `imul` und dann `cwtd; idiv`. Geteilt wird
  also nur das untere Wort des Produkts, mit Vorzeichen:
  - `imulw -0x8(%bp)` … `cwtd; idiv %cx(100)`
  - `imul %cx(B14)` … `cwtd; idiv %cx(50)`
  - `imulw -0x10(%bp)` … `cwtd; idiv %cx(100)`
- Remake training.ts:99-102: `div(gain * posBalls, 100)` usw. rechnet ohne Kürzung auf 16 Bit.
- Erreichbar im dritten Schritt, wenn Gewinn₂ · Positionsbälle ≥ 32768 ist. Ein Beispiel:
  - Bälle: alle 20 auf Kondition, dann ist der Grundgewinn 80.
  - Intensität 10 bei Frische ≤ 135 ergibt Faktor 200.
  - Mit B14 ≥ 59 wird Gewinn₂ ≥ 188.
  - 10 Positionsbälle auf die Gruppe des Spielers ergeben 172..175.
  
  Beim Torwart (Faktor 230) reicht schon B14 ≥ 52, und auch die Technik-Linie (Grundgewinn 65)
  kann überlaufen.
- Im Original wird der Gewinn dann negativ (z.B. 37324 → -28212 → -282). Die Linie sinkt mit
  random(2,3) statt zu steigen. Die Würfe bleiben dieselben, das Ergebnis ist aber anders
  (Spielerwerte).

#### B21 (A): Randale- und Komfortmeldung anders umbrochen, Betrag ohne Tausenderpunkte

- Original 0x0E21A-0x0E3A5 und 0x0E4A6-0x0E4F6: drei feste Zeilen gehen an 0x0239E.
  - Randale: 4cb3:1B23 „Randalierer im Stadion“, 1B3A „richteten einen Sachschaden“, dann
    „von “ + Betrag + „ DM an.“. Der Betrag wird über 0x7D31 formatiert (0x0E375), also mit
    Tausenderpunkten (0x7D64: 07B2 = 0 → '.').
  - Komfort: 1B5B „In der neuen Komfortbewertung“, 1B79 „wird ihr Stadion um eine Note“,
    1B97 „schlechter beurteilt.“.
- Remake finance.ts:248 und :275 fügt die Zeilen zu einem Text zusammen (`${damage}` ohne Punkte).
  server.ts:2049 (und :1771) bricht ihn mit `wrap(…, 24)` neu um. Heraus kommen z.B. „Randalierer im
  Stadion / richteten einen / Sachschaden von 123000 / DM an.“ statt der drei Originalzeilen.

#### B22 (A): Meldung „Verletzung im Training“ ohne Rückdatierung

- Original 0x0E762 `lcall $0x0,$0x239e` → 0x30AA0. Wie jede Meldung wird sie um random(0,3) Tage
  zurückdatiert. Das Remake würfelt das auch (tagesroutine.ts:52 `verletzt.push({ place, zurueck: meldung() })`).
- server.ts:2078 benutzt `t.verletzt` aber nicht. Es erkennt die Verletzung am Bitvergleich und ruft
  `pushMessage` ohne Datum auf, also mit dem heutigen Tag. Randale, Transfer, Karriere und
  Verlängerung übergeben dagegen `datum(ev.zurueck)`. Datum und Reihenfolge in der Meldungsliste
  weichen deshalb ab.

#### B23 (D): Zweigbuch 0DF0D, Abschnitt G Punkt 5

- Dort steht „Byte 24 über 99: mit 1/6 zurück auf random(9,17), sonst herunterzählen“.
- Das Original zählt über 99 nicht herunter: 0x0E5F8 `or %ax,%ax; jne 0xe650` überspringt, und das
  Herunterzählen 0x0E63E-0x0E64C erreicht nur ≤ 99.
- Außerdem gilt der Rücksprung nur mit Meldungszeiger (0x0E5FC). Code und Kommentar in
  contracts.ts:256-275 sind richtig.

## Unklar

### Hauptmenü 0x0971F

- U1.1: Tabellenabschluss 0x979B-0x97DA. Für jede Liga mit 225A[L] < 2262[L] ruft das Hauptmenü 0x2B4F3(L, 225A) und 0x2D143(L, 1, 1) auf. Mit Argument 2 = 1 kopiert 0x2D143 je gespieltem Paar die laufenden Tabellenbytes in den Spiegel (0x2C304(Verein, 0, 2): Bytes 0/1 → 2/3, 22/23 → 24/25 usw., Formstring) und sortiert neu (Platz, Managerbyte 267+Spieltag). Die Buchung (Argument 2 = 0) holt vorher den Spiegel zurück (0x2C304(Verein, 2, 0)) und bucht darauf. Das Remake spiegelt in `applyResult` sofort (standings.ts:35-56), die Buchung addiert auf den laufenden Stand. Gleich ist das, solange ein Verein zwischen zwei Hauptmenüs nur einmal gebucht wird. Zur Klärung fehlt, ob an einem Tag ein Nachholspiel (Buchung 0x5C09/0x5C68) und ein regulärer Spieltag denselben Verein buchen können. Dann würde das Original das erste Ergebnis beim zweiten Zurückholen verwerfen. Das gehört zum Bereich 0x2D143/0x5403.
- Die Schrittweite der Kurve rechnet das Original in float32 (fdivr, fstp dword), das Remake in double. An Grenzfällen kann ein Knick ein Pixel versetzt sein. Nicht nachgemessen.

### Neues Spiel / Startbildschirm 0x08FD8, 0x0AD44

- U2.1 (A): Namenseingabe 0x7E87 begrenzt über die Pixelbreite 0x28 = 40 (Argument bp+0x12, Prüfung 0x8104-0x812A),
  nicht über eine Zeichenzahl; Großschreibung per `and $0xdf` nur für A..Z. Das Remake schneidet auf 12 Zeichen
  (server.ts:2649, main.ts:1217). Wie viele Zeichen 40 Punkte in dieser Schrift sind, habe ich nicht gemessen.

### Saisonende 0x0CB62, Spielerpool 0x0F2A6

- Plätze 112..124 der Aufstellungstabelle: Ist ein Marktspieler mit fremdem Besitzer auf einem
  Platz ≠ 4 betroffen (B15), schiebt das Original mit Länge 24 auch diese Plätze nach unten. Sind
  sie immer 0 (in den Originalständen prüfen), ist das Ergebnis gleich.
- Aprilscherz 0x0D161: gewürfelt wird nur, wenn 4cb3:224E/2250 == 2252/2254. Das Remake würfelt
  immer (seasonEvents.ts:257, Kommentar "im Original stets"). Richtig, falls beide Werte nie
  auseinandergehen (0x0DD1E rechnet mit ihnen den Betrag der Abgangsmeldung um, eine
  Währungsoption?). Nicht nachgeprüft, wo 224E/2252 geschrieben werden.
- Karriereende 0x0D50E: ist ein vereinsloser Spieler nicht älter als der Wurf, liest das Original
  Byte 11 und 24 über den Nullzeiger (0000:000B, 0000:0018 = Interrupttabelle). Mit üblichen
  BIOS-Vektoren (Segment F000) folgt "überspringen" wie im Remake.
- Karriereende im Remake `if (p.isEmpty) continue;` (seasonEvents.ts:269) vor dem Wurf
  random(32,34); das Original würfelt für alle 150. Wirkt nur, wenn ein Spielerdatensatz 1..150
  keinen Namen hat.
- Aufnahme fehlgeschlagen (0x224A8 gibt 0x7F zurück): das Original schreibt dann in Platz 0x7F
  weiter (Jugend 0x0D0C3, Rückkehr 0x0D335); das Remake bricht ab bzw. macht den Spieler frei.
  Mit den vorgeschalteten Prüfungen (Kaderzahl < 23; Rückkehrer mit Grenze 25) nicht erreichbar.

### Tagesroutine 0x0DF0D

- **U4.1** Saisonende: 0x0D42D-0x0D457 löscht Zeiger und Bits 0x40/0x80, lässt Byte 24 aber stehen
  (außer 4cb3:05D4 ≠ 0 → 0x0D2B8 Byte 24 = 0). Bleibt ein Verlängerungsangebot (101..104) über das
  Saisonende stehen, verfällt es im Original nie mehr (0x0E5FC braucht den Zeiger), und der Spieler
  darf neu anbieten (kein Zeiger). Im Remake verfällt es mit 1/6, und es blockiert
  (`b24 >= 100`). Ob der Fall vorkommt, hängt am Saisonende 0x0CB62 (Vertragsjahr 1 → 0, Abgang?).
  Das gehört zum anderen Teil.
- **U4.2** Markt: 0x0E16E prüft den Meldungszeiger des Marktplatzes, das Remake Bit 0x80. Das ist
  gleichwertig, solange der Zeiger nur aus Abschnitt D kommt. Setzt der Manager einen Spieler mit
  liegendem Verlängerungsangebot auf den Markt (0x23655 kopiert den Platz; ob mit Zeiger, habe ich
  nicht geprüft), bekäme er im Original nie ein Marktangebot. Das Remake prüft das nicht.
- **U4.3** Karriereankündigung ohne freien Meldungsplatz (0x0E800 `cmp $0x7f,%di` → 0x0E573 gibt
  die Meldung sofort frei): im Original erscheint dann keine Meldung, das Remake zeigt sie immer.
  Gewürfelt wird gleich. Das gehört vermutlich zur bewussten Meldungsabweichung.

