# Gegenprüfung Audit 2, Gruppe B (26.9.2026)

Geprüft: alle Befunde aus audit2-B.md (B1..B23). S-Befunde adversarial, A/D auf Plausibilität.
Disassembly aus all.s (dis.sh/da.sh, ES-Werte aufgelöst). Im Repo nichts geändert.

---

## Hauptmenü 0x0971F

### B1 - BESTÄTIGT

- Original 0x9B88-0x9C0A: `movw $0x0,-0x150(%bp)`, Schleife k = 1..3 (`cmpw $0x4,-0xa8(%bp); jl 0x9b94`)
  mit `mov %es:0x8(%bx),%al` (ES = 4238, also 4238:0008+k) gegen `cmp %cl,%es:0x2374(%bx)`
  (4238:2242 + 778·m + 306 + k), bei Gleichheit -0x150 = 1. Danach `cmpw $0x0,-0x150; je 0x9c0d`,
  `test $0x70,%di; je`, `cmp $0x10,%di; je`, Text 25C8, `movb $0xf,%es:0x56ee`, `jmp 0x9b2d` →
  0x9B31 `movb $0x1,%es:0x513e`. Die Segmentwerte stimmen (-0x65b8 = 4238, -0x661e = 4238).
- Wann erreicht: nur, wenn vorher weder das Ligabit des eigenen Ligabytes (0x9A8D-0x9A91) noch der
  DFB-Zweig (di = 8 und Runde gleich) noch die Relegation (di = 0x10 und Verein = 4238:5369/5370) noch
  "SAISONENDE" (Argument 0xFF oder Datum) greift. An einem Europapokaltag (Kalenderbyte 0x20/0x40/0x60,
  ohne Ligabit) ist das der Normalfall. Ausgeschiedene Vereine behalten ihre alte Runde
  (europa.ts `setManagerRound` nur für Sieger), die Gleichheit trifft also nur die Vereine der laufenden Runde.
- Remake lineup.ts:234-237: `if (calendarFlag(...) !== FLAG_CUP) return false;`. Europapokal fehlt.
  Das ist nicht in ABWEICHUNGEN eingetragen.
- Wirkung heute: im Remake nur über Kauf und Systemwahl (server.ts:3282/3303), den gemerkten Wert
  `sperre513E` (server.ts:1143) und die Kaderanzeige (main.ts:4965). Nach der Korrektur von B2 wirkt
  es an jedem Europapokaltag für Automatik-Manager im laufenden Wettbewerb.
- Häufigkeit: gelegentlich. Nötig sind ein Europapokaltag, der Verein in der laufenden Runde, ein
  gesperrter Spieler, der stark genug für die Aufstellung ist, und Automatik.
  Würfe ändern sich dadurch nicht, weil 0x22030 nicht würfelt (siehe B2). Es ändert sich die Aufstellung,
  und damit die Spielstärke.
- Korrektur: `sperreAusgesetzt` (lineup.ts) um Zweig D erweitern: kein Ligabit der eigenen Liga, nicht
  der DFB-Fall, `flag & 0x70`, `flag !== 0x10`, dazu ein k in 1..3 mit `u8(306+k) === plain[28233+k]`.
  Den Relegationsfall (Verein = 5369/5370 und flag 0x10) und SAISONENDE davor ausschließen. Aufwand klein.

### B2 - BESTÄTIGT

Die zwei offenen Fragen sind geklärt:

1. **Läuft 0x22030 bei jeder Rückkehr aus einem Untermenü?** Ja. Einmal je Zug laufen nur Autosave
   (0x9734-0x974F), `5358 = 304A` und der Tabellenabschluss 0x979B-0x97DA. Der Aufbau beginnt bei 0x97DC.
   Jedes Untermenü kehrt über `jmp 0xa5e1` zurück (a661, a66b, a675, a67c, a68d, a6a3, a6ce, a6d6,
   a718, a73b, a75e, a786, a799, a7d4 usw.). Dieser Weg führt über 0xA643 `lcall $0x310,$0x1190`,
   0xA655 `304A = 5358` und 0xA659 `jmp 0x97dc`. Dazu kommen 0xA077 und 0xA4AC (`jmp 0x97dc`). Zwischen
   0x97DC und 0x9D46 springt kein Befehl über 0x9D46 hinaus (alle Sprungziele geprüft). Der Aufruf
   0x9D46 `lcall $0x1ecd,$0x3360` läuft also bei jedem Neuaufbau, und zwar mit dem gerade bei 0x99FC/0x9B31
   gesetzten 513E dieses Managers.
2. **Tut 0x22030 bei manuellem System nichts?** Ja. 0x2204B-0x2206A:
   `mov %es:0x304a,%al; ... mov %es:0x79e(%bx),%al` (4cb3:079E + 2·Manager), `sub $0x2,%al;
   mov %al,-0x2(%bp); inc %al; jne 0x2206d; jmp 0x222ff`. Bei System = 1 (manuell) springt die Routine
   sofort ans Ende, ohne Byte 10 zu löschen. 0x22030 und seine Unteraufrufe 0x22305, 0x0F125 und
   0x2119D würfeln nicht (kein `lcall $0x76b,$0xcc7` bis 0x224A7; der Wurf bei 0x22687 gehört zu 0x224A8).

Folgerung für die Häufigkeit: Nach den Spielen stellt 0x1D817 das System bis zum nächsten Spieltag auf
manuell (lineup.ts `backupSystem`, originaltag.ts:121). Züge gibt es aber nur an Spieltagen
(Kalenderbyte ≠ 0/9) und nach Saisontag 322. An Spieltagen hat der Tagesbeginn 0x1D797 das System
vorher zurückgeholt. Im Zug ist die Automatik also aktiv, und der Aufruf im Menü wirkt an jedem
Spieltag für jeden Automatik-Manager.

- Remake: server.ts:1333-1339 stellt nur am Tagesbeginn auf, mit `r.sperre513E` (dem Wert des letzten
  Managers aus dem letzten Zug, gesetzt in `zugBeenden`, server.ts:1143). Im Zug stellen nur Kauf,
  Systemwahl, Abwerben usw. neu auf (server.ts:869/927/968/2802/3024/3057/3282/3303). originaltag.ts
  bildet das Menü ohne 0x22030 nach. Das ist wurfneutral, der Vergleich mit den DOSBox-Protokollen
  bleibt also gültig.
- Unterschied, konkret:
  - **DFB-Pokaltag, Verein in der Runde:** Im Original ist 513E = 1, gesperrte Spieler dürfen spielen.
    Im Remake gilt das nur, wenn der letzte Manager des vorigen Zugtags 513E = 1 hatte. Das ist praktisch
    nie der Fall, denn der vorige Zugtag ist ein Ligatag.
  - **Ligaspieltag nach einem Pokaltag, an dem der letzte Manager noch dabei war:** `sperre513E` ist true.
    Das Remake stellt dann am Tagesbeginn **alle** Automatik-Manager mit gesperrten Spielern auf, und
    kaderVorbereitung (matchday.ts:311ff.) lässt sie in der Liga spielen. Das Original stellt im Menü mit
    513E = 0 neu auf. Das ist die schwerere Folge: ein gesperrter Spieler spielt in der Bundesliga.
  - Außerdem fehlt die Neuaufstellung nach Zugaktionen ohne eigenen Aufruf.
- Häufigkeit: mehrmals je Saison, an jedem DFB-Tag und am folgenden Ligaspieltag, sobald ein
  Automatik-Manager einen gesperrten Spieler hat, der aufgestellt würde.
- Korrektur: in `startLiveDay` (vor `backupSystem`, server.ts:1858) für jeden Manager
  `autoLineupIfEnabled(g, i, sperreAusgesetzt(g, i))` aufrufen. Das ist gleichwertig mit dem letzten
  Menüaufbau des Originals, weil 0x22030 nicht würfelt und nach dem letzten Untermenü nichts mehr den
  Kader ändert. Danach wird der Tagesbeginn-Wert `sperre513E` nur noch für die Anzeige gebraucht.
  Zusammen mit B1 umsetzen. Aufwand klein.

### B3 (A) - BESTÄTIGT (plausibel)

main.ts:3263 `flag & (8 << cup)` prüft für cup = 1 das Relegationsbit 0x10. `dabei` fragt nach Runde
1..7 statt nach der laufenden Runde. "Relegation" und "SAISONENDE" fehlen. Die Reihenfolge der Zweige
im Original ist 0x9A29 → 0x9A73 → 0x9AE8 → 0x9B3A → 0x9B88 → 0x9C0D, wie beschrieben.

### B4 (A) - BESTÄTIGT (plausibel)

0x9F1B-0x9F2F: `cmpw $0x1,%es:0x7dc; jbe 0x9f63` (4cb3:07DC). Farbe 7 gibt es nur bis Saisontag 1,
sonst die Linie in Farbe 0xB nach (0x3E+si, Byte 268+k + 0x41). Das Remake entscheidet bei main.ts:3224
nach `spiele <= 1`.

## Neues Spiel 0x08FD8 / 0x0AD44

### B5 - BESTÄTIGT

- 0xC0A8 `movw $0x0,-0x48`, 0xC1AB `incw -0x48`, 0xC1AE `cmpw $0x4,-0x48; jge 0xc1bb`. Innen
  0xC188-0xC19B: `push 0; push -0x48; lcall $0x3091,$0x1109` (0x31A19; erstes Argument bp+6 = -0x48,
  zweites 0). 0x31A19 zählt bei Modus 0 die Plätze mit Byte 15 ≠ 0 (`cmpb $0x0,%es:0x7759(%bx)`,
  0x31A64), Grenze 24. Geschrieben wird nach `25·304A + (-0x5a)` (0xC0E8 `imulb %es:0x304a`,
  0xC103 `mov %al,%es:0x775a(%bx)`).
- Der Block liegt in der Schleife je Manager (0xC510 bis 0xC6AC/0xC701 → 0xBF5C → ... → 0xC0A8, weiter
  mit 0xC50B `incb 304A`). Der Pool 0x3260C (0xBDAC `lcall $0x322b,$0x35c`) hat vorher allen Managern
  < 07AB ihre Spieler gegeben (0x327E1-0x3293B). Die Aufstellungen der Nicht-Manager sind im EXE-Abbild
  leer (nachgezählt: Byte 15 = 0 auf allen 4·24 Plätzen), ergeben also 0 Durchläufe.
- Folge: jeder Manager würfelt N·20·6 statt 20·6 Mal. Es bleibt die letzte Runde, und der Leistenspieler
  bekommt deren Werte. Die Verteilung der Werte ändert sich nicht, nur der Zufallsstrom ab dem ersten
  Manager. Damit laufen Gehälter, Trainer, Angebote, Zins, Matrix, Verteilung, Pokal und Markt anders
  als im Original.
- Tests: newgame.test.ts vergleicht mit dem Original nur mit einem Manager (Zeile 103). Der Test mit drei
  Managern (Zeile 16) vergleicht mit keinem Original. Kein Widerspruch.
- Häufigkeit: bei jedem neuen Spiel mit zwei oder mehr Managern, also im Normalfall dieses Projekts.
  Spielerisch neutral, nur nicht bytegleich.
- Korrektur newgame.ts:378-386: äußere Schleife `r = 0..3`, innere über
  `anzahl(r) = belegte Plätze 0..23 von Manager r` (für r ≥ N 0, nicht aus der Vorlage lesen, die von
  einem laufenden Raum stammen kann), Ziel `g.lineups.at(mi*25 + slot)`. Aufwand klein.

### B6 - BESTÄTIGT

- 0xB659-0xB69D: Schleife j < 4cb3:07AB (`cmp -0xa(%bp),%ax` gegen Byte 30, `movw $0x1,-0x5c`),
  `cmpw $0x0,-0x5c; jne 0xb6dc`: die Wahl wird ignoriert. 07AB wächst im Startbildschirm mit
  (0xB8D4 `mov %al,%es:0x7ab`), die Prüfung greift also.
- Remake: main.ts:1208 ohne Prüfung, main.ts:666 filtert nur leere Plätze, server.ts `/api/newgame`
  übernimmt `club` ungeprüft. In newgame.ts:341-346 bekommen beide denselben Index, `swapClubs` zieht
  beide mit (season.ts:58-61), und der zweite wird nicht mehr getauscht.
- Häufigkeit: selten (Bedienfehler), dann aber schwer: zwei Manager führen denselben Verein.
- Korrektur: den Klick in main.ts:1208 ignorieren, wenn ein anderer Platz den Verein hat. Zusätzlich
  in server.ts `/api/newgame` doppelte `club` mit 400 abweisen. Aufwand klein.

### B7 (A) - BESTÄTIGT (plausibel)

0xB704-0xB74B: `decw -0x2c`, 0xAA56, dann Byte 29 der beiden tauschen (0xB73E/0xB746). Das Remake
schaltet frei weiter (main.ts:1214).

### B8 (S, fehlender Zweig) - BESTÄTIGT

0xA7A7-0xA7B4 `call 0x8eaf(2)`, `call 0xad44(0)`, `call 0x8f0d(2)`. In 0xAD44 gilt -0x36 = 07AB beim
Eintritt (0xAD61/0xAD67), und 0xB9A7 `cmpw $0x0,-0x36; je; jmp 0xbdbf` nimmt den Aufnahmezweig.
0xBECF `movb $0xa,...0x234d` (Bytes 267..304), 0xBEF7 `movb $0x1e,...0x2374` (306..310), 0xBF25
0xFF auf 62+4i, 0xBE37 `cmpw $0x3e8,-0x34`, 0xBE6C 0x224A8(sp, 1, 0, 15000, 24): stimmt.
Das Remake hat keinen Weg dazu, und ABWEICHUNGEN nennt ihn nicht.
- Häufigkeit: nur, wenn jemand in eine laufende Runde einsteigen will.
- Korrektur: in ABWEICHUNGEN unter "Weggelassen" eintragen. Das ist klein. Wer den Zweig nachbauen
  will, braucht einen eigenen Aufnahme-Endpunkt mit diesen Werten; das ist mittlerer Aufwand.

### B9 (D) - BESTÄTIGT

Die Zeiger 4cb3:4A36+4i zeigen auf "Endlosspiel", "1-Jahres-Spiel", "3-Jahres-Spiel" und
"Histor. Start" (aus bmmain.bin gelesen). Dazu 0xBD22-0xBD63 (513C = 0x7AC/0x7AE, +0x1D, 07E0 = 0x7C8).
ABWEICHUNGEN.md:36 nennt es falsch "Startjahre".

### B10 (D) - BESTÄTIGT

0x8E15 `cmp %al,%es:0x7ab; jbe 0x8e22`: bei 07AB = 0 läuft die Schleife nicht. SPIELMECHANIK.md:673
("Byte 306..310 = 30") und :704 beschreiben den Aufnahmezweig.

## Saisonende 0x0CB62, Spielerpool 0x0F2A6

### B11 - BESTÄTIGT (mit Einordnung)

- 0xCEA7-0xCEEE: Der Jugendblock läuft nur, wenn
  `(Jahr 4238:A7A0 > 1966 && 56F4 == 0) || (Jahr > 1995 && 56F4 != 0)`. Sonst geht es nach 0xD10C.
  Der Aprilscherz (0xD161) liegt dahinter und läuft trotzdem.
- 56F4 wird nur bei 0xBD4D geschrieben: `(bits >> 3)`, `sub $0xff`, `neg`, `and $1`, also
  56F4 = !Bit3 ("Histor. Start"). Vorgabe -0x58 = 1 (0xAD7A), also 56F4 = 1. Im EXE-Abbild steht 0.
  Sonst gibt es keinen Zugriff; der Lader setzt es nicht.
- Im Kern ist das eine Regel: "keine Jugend in den ersten drei Saisons". Mit historischem Start
  (1963) gilt Jahr > 1966, beim normalen Start 1992 gilt Jahr > 1995. Sie gilt aber nur im selben
  Programmlauf. Nach einem Laden in einem neuen Lauf ist 56F4 = 0, und dann gilt immer Jahr > 1966.
- Remake seasonEvents.ts:230-235 würfelt immer, entspricht also dem Fall "geladen".
- Häufigkeit: die Saisonenden 1993, 1994 und 1995 jedes neuen Spiels, das im selben Programmlauf
  durchgespielt wird. Je Manager fehlen dann das Abschmelzen des Jugendkontos und ein Wurf.
- Korrektur: entscheiden. Entweder einen Merker im Raumzustand führen (true bei `/api/newgame`,
  dauerhaft gespeichert, sodass ein Serverneustart nicht als "neuer Programmlauf" zählt) und in
  `seasonEvents` den Jugendblock samt Kontoabschmelzen bei `jahr <= 1995 && merker` überspringen.
  Oder den Fall in ABWEICHUNGEN eintragen. Aufwand klein.

### B12 - BESTÄTIGT

- 0x1E199-0x1E1C2: je Manager `304A = m`, `lcall $0x14a4,$0x1ad5` (0x16515) mit Argument 1,
  `mov %al,-0x20(%bp,%si)`. Danach 0x1E1C5 `call 0x1eb17`, dann Auf- und Abstieg und das Mischen
  (0x3C24 über `lcall $0x310,$0xb24` bei 0x1E56B/0x1E5B3). 0x1E930 `lea -0x20(%bp)` →
  0x1E935 `lcall $0xcb5,$0x12` (0xCB62). Zwischen beiden wird -0x20 nicht beschrieben.
  0xCB62 liest das Feld bei 0xD6B6 (`les 0x6(%bp)`), bei 0xCDC7 zeigt es an und bucht.
- 0x16515 nimmt die Liga aus Managerbyte 312 (0x1653A `mov %es:0x237a(%bx)`). Zu diesem Zeitpunkt ist
  das noch die alte Liga.
- Remake: seasonEvents.ts:49-53 `hasTopScorer` nimmt die Liga aus dem neuen `clubIndex` und die Vereine
  nach ihrem neuen Band. Aufgerufen wird es nach `ewigkeitspunkte`, `promoteRelegate` und
  `shuffleLeagues` (season.ts:354/367/386/393) und nach den Karriereenden der vorigen Manager.
- Häufigkeit: selten. Es braucht einen Auf- oder Absteiger, dessen Spieler in der alten oder neuen
  Liga Torschützenkönig wäre. Folge: 250.000 DM zu Unrecht oder gar nicht, und die Meldung.
- Korrektur: in `saisonwechselTeil1` vor `ewigkeitspunkte` je Manager `hasTopScorer` bestimmen (Liga
  aus Byte 312) und die Flags an `seasonEvents` übergeben. Aufwand klein.

### B13 - BESTÄTIGT

- 0xD615-0xD631: `random(0,6)` → `mov $0x25,%ax; imulw -0x7c(%bp); ... mov %cl,%es:0x57fd(%bx)`
  (Spielerbyte 32). Die Nachbarschreibungen gehen über -0x7a bzw. `%si` (0xD5D2, 0xD610, 0xD646).
- -0x7c wird in 0xCB62 nur an drei Stellen gesetzt: 0xCC7F (Bandenschleife beim Aufstieg, endet auf 6),
  0xCF96 (Jugendspieler: random(1,150), bis Byte 33 = 5) und 0xDA47ff (erst nach der Managerschleife).
  Beim ersten Manager ohne Aufstieg und ohne Jugend ist es ein Stapelrest. Mit B11 (keine Jugend in
  den ersten drei Saisons) ist das gar nicht selten.
- Remake seasonEvents.ts:210 schreibt am neu belegten Spieler.
- Häufigkeit: an jedem Saisonende, bei jeder Neubelegung (vereinslose Alte). Es betrifft Byte 32,
  die Seitenvorliebe, die der Seitentausch 0x0F125 benutzt. Die Würfe sind gleich, die Ziele nicht.
- Korrektur: in `seasonEvents` eine über die Manager durchlaufende Variable `stapel7c` führen:
  6 nach der Bandenschleife (Aufstieg), der Index des Jugendspielers nach dessen Wahl.
  `neuBelegen` schreibt den Wurf dann an `g.players.at(stapel7c)`, oder schreibt nichts, solange die
  Variable unbestimmt ist; den Stapelrest kann man nicht nachbilden. SPIELMECHANIK.md anpassen.
  Aufwand klein bis mittel.

### B14 - BESTÄTIGT

- 0xD222 `mov %al,-0x44(%bp)` (304A beim Eintritt), 0xD27D: der Jahrgangswechsel läuft nur bei
  304A = 0, also ist -0x44 = 0. 0xD3BC-0xD3E8: `mov -0x44,%al; mov %al,%es:0x304a; imul 25;
  add -0x80; ... mov %al,%es:0x7762(%bx); mov %al,%es:0x7756(%bx)`. Das löscht Byte 24 und 12 auf
  Platz 0·25 + neuer Platz. Auch der Zweig Besitzer ≥ 4 (0xD378 → 0xD38A → 0xD3BC) läuft mit einem
  alten -0x80 hindurch.
- Remake seasonEvents.ts:181-183 löscht am neuen Platz des Besitzers.
- Wer ist betroffen? Die Marktspieler der KI haben Byte 33 = 4 (transfer.ts:355) und laufen nicht hier
  durch. Betroffen sind eigene Spieler von Manager 1..3 auf der Transferliste und Leihspieler bei
  einem anderen Manager.
- Häufigkeit: mäßig. Es genügt, dass ein Manager 1..3 zum Saisonende einen Spieler gelistet oder
  verliehen hat. Dann behält der Rückkehrer Leihmarke und Byte 24, und der Spieler von Manager 0 auf
  demselben Platzindex verliert beide. Das kann seine Karriereankündigung (Bit 7) löschen, und das
  Karriereende von Manager 0 läuft direkt danach.
- Korrektur: in `jahrgangswechsel` `plain[o+24]`/`plain[o+12]` am Platz `0*25 + neu` löschen statt am
  Platz des Besitzers. Für Besitzer ≥ 4 mit dem letzten `neu` (Anfangswert unbestimmt, dann nichts tun).
  Aufwand klein.

### B15 - BESTÄTIGT

- 0xD396 `cmpb $0x4,-0x68(%bp)`. -0x68 ist der **Platz** (0xD345/0xD34B: `25·(-0x86) + (-0x68)`),
  Länge = (2 - (Platz == 4))·12, dann 0x1FDBE(Platz, 1, Länge) mit 304A = Halter (0xD38A).
  0x1FDBE (0x1FE59-0x1FEBC) kopiert k+1 → k für k = Platz..Länge-1 und setzt nur Byte 15 von Platz
  Länge auf 0.
- Remake seasonEvents.ts:177 `removePlace(..., wo.manager === 4 ? 12 : 25)` arbeitet immer lückenlos.
  Für einen Managerkader auf Platz ≠ 4 kommt dasselbe heraus, ebenso für den Markt auf Platz 4. Den
  Markt auf Platz ≠ 4 behandelt der Punkt "Unklar" im Audit.
- Häufigkeit: selten. Es braucht einen Leihspieler (Halter < 4, fremder Besitzer), der genau auf
  Platz 4 steht.
- Korrektur: in `jahrgangswechsel` für `wo.manager < 4 && wo.place === 4` nur bis Platz 12 aufschieben
  und bei Platz 12 nur Byte 15 = 0 setzen. Aufwand klein.

### B16 - BESTÄTIGT (praktisch nie)

0xF3EA-0xF41F: `mov -0x56,%ax; incw -0x56; cmp $0x3e8,%ax; jl 0xf3ef`. Nach 1001 Würfen auf
verbrauchte Einträge (0xFF) wird der Eintrag 0xFF genommen. Remake pool.ts:144-145 hat keine Grenze.
Die Wahrscheinlichkeit liegt bei etwa (1-1/n)^1001 je Zug aus einer fast leeren Quelle, bei n ≈ 100
also bei 4·10⁻⁵. Korrektur: Zähler mit Grenze 1000, danach Spieler 255 behandeln wie das Original
(Schreiben hinter die Tabelle, nicht nachbildbar) oder abbrechen und in ABWEICHUNGEN eintragen.
Aufwand klein.

### B17 (D) - BESTÄTIGT

SPIELMECHANIK.md:1943 "Kaderspieler mit Alter > random(32,34)" ist falsch; Code und Remake gehen nach
Byte 11 = 0 und Bit 7. Bei 0x09681 steht `and $0xfe,%al` nach einem 16-Bit-`mul`, also & 0xFFFE.
SPIELMECHANIK.md:701 schreibt "& 0xFE".

## Tagesroutine 0x0DF0D

### B18 - BESTÄTIGT

- 0xEAFA-0xEB06: `mov %es:0x32(%bx),%ax; or %es:0x30(%bx),%ax; je 0xeb0b`, erst dann
  `orb $0x40,%es:0x9(%bx)`. Das Verlängerungsangebot setzt den Zeiger bei 0xE9C1-0xE9D1 zusammen mit
  Byte 24 = 100 + Jahre (0xE992). Der Zeiger übersteht das Laden: 0x33E4E trägt die Zeiger beim Laden um,
  statt sie zu löschen.
- Remake transfer.ts:286 prüft nur Bit 0x40. Bei liegendem Verlängerungsangebot (Byte 24 101..104)
  fehlt die Sperre. Dazu kommen Zusatzwürfe (rng(0,12), `chooseOfferClub`, Meldungswurf).
- Häufigkeit: selten. Die Chance auf ein Angebot liegt bei etwa v/200 · 1/451 je Spieler und Tag, und
  nur solange ein Verlängerungsangebot unbeantwortet liegt.
- Korrektur transfer.ts `kaderAngebote`: zusätzlich `|| l.u8(24) >= 100` (Byte 24 ≥ 100 ohne Bit 7 steht
  für den Zeiger des Verlängerungsangebots), besser einen Merker "Meldungszeiger" nachführen, der auch
  B19 und U4.1/U4.2 abdeckt. Aufwand klein bzw. mittel.

### B19 - BESTÄTIGT

- 0xE93C-0xE956: Zeiger = 0, `testb $0x80,0x18`, `cmpb $0x1,0xb`. Byte 24 ≥ 100 wird nicht geprüft.
  Den Zeiger setzt auch das fremde Angebot (0xEA6D/0xEA71). Gelöscht wird er zusammen mit den Bits nur
  über 0xE5B8 (1/4, bei Byte 9 > 0x1F und Zeiger) und die Dialoge.
- Remake contracts.ts:209 prüft `b24 >= 100` statt des Zeigers und übersieht dabei Bit 0x40.
- Häufigkeit: selten. Ein Spieler im letzten Vertragsjahr hat ein fremdes Angebot, und die Würfe
  random(0,n) = 0 und random(0,3) = 0 fallen.
- Korrektur contracts.ts:209: `|| (l.u8(9) & OFFER_SQUAD) !== 0` ergänzen, oder den Zeiger-Merker wie
  bei B18. Aufwand klein.

### B20 - BESTÄTIGT (Randfall)

- 0xEE0C `imulw -0x8; cwtd; idiv 100`, 0xEE2B `imul %cx(B14); cwtd; idiv 50`,
  0xEE9A `imulw -0x10; cwtd; idiv 100`. Jedes Mal wird nur AX vorzeichenbehaftet geteilt.
- Das Beispiel ist erreichbar. Die Matrix hat [0][0] = 80 (training.ts:13), B14 liegt zwischen 30 und
  68 (training.ts:153, Neuwurf 35..65), die Positionsbälle ergeben höchstens 10·10 + 75 = 175. Nötig
  ist Frische ≤ 135, sonst sinkt der Faktor um 70-13L..90-5L. Die ersten zwei Produkte bleiben unter
  32768 (höchstens 80·230 = 18400 und 184·68 = 12512), überlaufen kann nur das dritte.
- Häufigkeit: sehr selten. Es braucht extreme Trainingseinstellungen: alle Bälle auf eine Linie,
  Intensität 10, alle Positionsbälle auf eine Gruppe, frische Spieler.
- Korrektur training.ts:102: `gain = div(((gain * posBalls) << 16) >> 16, 100)` (auch die anderen
  zwei Schritte der Form halber). Aufwand klein.

### B21 (A) - BESTÄTIGT (plausibel)

finance.ts:248 `${damage}` ohne Tausenderpunkte; der Text wird zusammengefügt und neu umbrochen.

### B22 (A) - BESTÄTIGT

server.ts:2076-2079 ruft `pushMessage` ohne Datum auf; `t.verletzt[].zurueck` wird nicht benutzt.
0xE762 `lcall $0x0,$0x239e` stimmt.

### B23 (D) - BESTÄTIGT

0xE5DC-0xE650: über 99 springt `jne 0xe650` am Herunterzählen vorbei, der Rücksprung gilt nur mit
Zeiger (0xE5FC). Zweigbuch 0DF0D.md:46 ist falsch, contracts.ts:281-286 ist richtig.

---

## Übersicht

| ID | Urteil | Häufigkeit | Aufwand |
|---|---|---|---|
| B1 | BESTÄTIGT | gelegentlich (Europapokaltage, gesperrter Spieler, Automatik) | klein |
| B2 | BESTÄTIGT | mehrmals je Saison (DFB-Tag und folgender Ligatag) | klein |
| B3 (A) | BESTÄTIGT | an Pokal-, Relegations- und Saisonendtagen | klein |
| B4 (A) | BESTÄTIGT | vor dem 2. Spiel jeder Saison | klein |
| B5 | BESTÄTIGT | jedes neue Spiel mit ≥ 2 Managern (nur der Zufallsstrom) | klein |
| B6 | BESTÄTIGT | selten (Bedienfehler), dann schwer | klein |
| B7 (A) | BESTÄTIGT | bei jeder Porträtwahl | klein |
| B8 | BESTÄTIGT (fehlt) | nur beim Nachträglich-Einsteigen | klein (ABWEICHUNGEN) / mittel (Nachbau) |
| B9 (D) | BESTÄTIGT | - | klein |
| B10 (D) | BESTÄTIGT | - | klein |
| B11 | BESTÄTIGT | Saisonenden 1993-1995 (ein Programmlauf) | klein |
| B12 | BESTÄTIGT | selten (Auf-/Absteiger mit Torschützenkönig) | klein |
| B13 | BESTÄTIGT | jedes Saisonende (Byte 32 falscher Spieler) | klein-mittel |
| B14 | BESTÄTIGT | mäßig (Manager 1..3 mit gelistetem/verliehenem Spieler) | klein |
| B15 | BESTÄTIGT | selten (Leihspieler auf Platz 4) | klein |
| B16 | BESTÄTIGT | praktisch nie | klein |
| B17 (D) | BESTÄTIGT | - | klein |
| B18 | BESTÄTIGT | selten | klein/mittel |
| B19 | BESTÄTIGT | selten | klein |
| B20 | BESTÄTIGT | sehr selten (Extremtraining) | klein |
| B21 (A) | BESTÄTIGT | jede Randale-/Komfortmeldung | klein |
| B22 (A) | BESTÄTIGT | jede Trainingsverletzung | klein |
| B23 (D) | BESTÄTIGT | - | klein |
