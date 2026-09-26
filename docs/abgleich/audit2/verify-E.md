# Gegenprüfung Audit 2, Gruppe E (E1-E28)

Stand 26.9.2026, Remake deccf74 (Arbeitsbaum sauber). Im Repo nichts geändert. Die Zeilennummern im
Audit weichen teils um ein paar Zeilen ab (z. B. main.ts 4644 -> 4655); die Stellen selbst stimmen.
Originalbefehle aus all.s selbst nachgelesen. Aufrufe mit `lcall $SEG,$OFF` nachgerechnet
(0x310:0x1F2 = 0x32F2, 0x1ecd:0x37d8 = 0x224A8, 0x1ecd:0x10ee = 0x1FDBE, 0x1ecd:0x3360 = 0x22030,
0x2277:0x25de = 0x24D4E, 0x14a4:0x23da = 0x16E1A).

Die Richtung der Blockkopie 0x35AC:0x304A (erstes Argument = Quelle) ist an drei Stellen dieselbe
und passt überall: 0x225F2 (Einfügen, Platz i -> i+1 absteigend), 0x1FE87 (Entfernen, i+1 -> i
aufsteigend) und 0x2265B (Nullblock -> Platz).

---

### E1 - BESTÄTIGT
Original: 1D757 `lcall $0x112a,$0xa6d` (Finanzen je Manager), direkt danach 1D779 `mov $0x1,%al` /
1D77C `lcall $0xf9d,$0x697` (0x10067(1)). Erst danach kommen 1D797 (079E = 079F, 0x22030), die Züge
(1E0A6) und die Spiele (1D8AF `lcall $0x310,$0x995`). Bei Byte 0 geht es direkt nach 1D917 (1D788),
die Schwankung ist dann aber schon gelaufen.
Remake: `server.ts:1845` `driftClubs(g, 1, r.rng)` steht am Anfang von `advanceDay`. Das läuft erst
beim Schlusspfiff. Die Konferenz holt ihre Matrizen vorher: `live.ts:256` `matrixFor` ->
`matchday.ts:94` `g.clubs.at(club).strengthMatrix` für Rechnervereine. `driftClubs` (ai.ts:79) ändert
Bytes 24-32 aller 64 Vereine. Das Modell `originaltag.ts:95` hat die Reihenfolge des Originals, und
dessen Wurfprotokoll-Tests (TEST4 u. a.) stützen das Audit. In ABWEICHUNGEN steht nichts dazu.
Wirkung: An jedem Spieltag spielen die Rechnervereine mit der Matrix vom Vortag. Auch ein Stand, der
während des Zugs gesichert wird, enthält die Schwankung des Tages noch nicht. Die Zahl der Würfe
stimmt, nur ihre Stelle im Zufallsstrom nicht.
Häufigkeit: jeder Kalendertag mit Spielen.
Korrektur: `driftClubs(g,1)` aus `advanceDay` in einen Tagesbeginn verlegen, der vor
`restoreSystem`/`autoLineupIfEnabled` in `nachTageswechsel` läuft, und zwar für jeden
Kalendereintrag, auch für Tage mit Byte 0 und 9. Am besten zusammen mit E2. Den ersten Tag nach
Neues Spiel bzw. Laden beachten (0x1D6F6 beginnt dort ebenfalls mit Finanzen und Schwankung).
Aufwand: mittel (zusammen mit E2).

### E2 - BESTÄTIGT
Original: 1DA83 zählt 07DC hoch, dann läuft 1DADC-1DBEF als do-while: Finanzen (1DAFA) für den
aktuellen 07DC, 07DC++, Sondertage, Abbruch bei `(07DC-224C)%7 = 0` oder `(07DC-4)%7 = 0`
(1DBC9/1DBE6 -> `je 0x1dbf2`). Die Finanzen laufen also für Tag+1 bis A-1. Danach kommt
1DBFE `lcall $0xcb5,$0x13bd` (0x0DF0D) für A, dann 1EB0B 016E++ und `jmp 0x1d714`, und erst dort
1D757 Finanzen(A). Das Modell `originaltag.ts:folgetage` (`d < bisTag`, Finanzen des Ankunftstags
am nächsten Tagesbeginn) ist genau so gebaut und gegen das Original getestet ("Folgetag bis zum Zug").
Remake: `server.ts:2002-2005` `toDay = seasonDay(dayIndex(g))` und `for (d = fromDay+1; d <= toDay)`
buchen Finanzen(A), danach `tagesroutine` (2044). In `nachTageswechsel` stehen keine Finanzen.
Wirkung: Die Reihenfolge von Finanzen(A) und Tagesroutine(A) ist an jedem Kalendertag vertauscht,
im Zufallsstrom (Bau-Meldewurf, Lager, Bankzins 1/61 vor bzw. nach den Würfen der Tagesroutine) und
im Stand. Monatsletzte als Ankunftstage nachgerechnet: 63 = 30.9., 186 = 31.1., 214 = 28.2.,
245 = 31.3. An diesen Tagen bucht der Server die Monatsabrechnung vor Krawall/Komfort und den
Marktverkäufen der Tagesroutine.
Häufigkeit: Die Reihenfolge der Würfe ist jeden Tag anders. Der Stand unterscheidet sich nur
gelegentlich (Monatsende und Kredittermine an Ankunftstagen, Bauabschluss).
Korrektur: Schleife in `advanceDay` auf `d < toDay` ändern. `finanzTag(toDay)` kommt an den Beginn
des nächsten Tages (neuer Tagesbeginn vor der Schwankung, siehe E1). Die Winterpausen-Seite (Schleife
2005ff.) mitziehen. Aufwand: mittel.

### E3 - BESTÄTIGT
Original ohne Laden, Tag 322: 1DADC-Schleife mit Finanzen(323), 07DC = 324, Prüfung nein;
Finanzen(324), 325 nein; Finanzen(325), 07DC = 326 = 4 + 7·46 -> Abbruch. 0x0DF0D für 326 (tut ab
322 nichts), 1DC52: `add $0x142` (322), `cmp %es:0x7dc,%ax; jb 0x1dc79` -> 1DC79 (Rückstellen,
0x22030, Stärke) -> `jmp 0x1e03d`. 1E03D-1E07A ruft je Manager `lcall $0x8bc,$0xb5f` mit 0xFF ohne
`random(0,n+3)`, 1E080-1E09A springt nach 1DCD8. Eine Schwankung kommt in diesem Weg nicht vor
(1D77C liegt nur am Tagesbeginn).
Remake: `server.ts:1991/2002` `saisonEnde` -> `toDay = fromDay + 1`, also nur Finanzen(323).
2015-2017 `driftClubs` + `rng(0, n+3)` -> `refreshMarket`. Sommer ab 327 (1242-1250). 324/325
werden nirgends gebucht (nachgerechnet: 323 = 17.6., 324 = 18.6., 325 = 19.6., 326 = 20.6.).
Gegenprobe: `originaltag.ts:saisonwechseltag` bildet bewusst den Weg über einen geladenen Stand ab
(PS0: Laden -> 1D714 -> Finanzen, 0x10067, normale Zugschleife mit Wurf). Der Test ("Saisonwechseltag
... wie das Original") gilt nur für diesen Weg. Im durchgehenden Spiel sind 323-325 dagegen schon
vor dem Saisonend-Zug gebucht, und es gibt weder Schwankung noch Markterneuerungswurf. Der Server
mischt beide Wege: Er nimmt Schwankung und Wurf aus dem Ladeweg und lässt 324/325 weg, die in
beiden Wegen gebucht sind.
Häufigkeit: einmal je Saison. Es fehlen zwei Finanztage (Kreditzins am 18./19., zwei Bautage,
Lager, Lagersperre, 2x Bankzinswurf); eine Schwankung und ein Markterneuerungswurf sind zu viel.
Korrektur: `server.ts` im saisonEnde-Zweig `toDay = LETZTER_SAISONTAG + 3` (325) und
`driftClubs`/`refreshMarket`-Wurf streichen. Aufwand: klein. (Offen bleibt U1.2, das Datum im Modell.)

### E4 - BESTÄTIGT
Original: Nach den Zügen springt 1E0BA `jmp 0x1d7ea`, und zwar an jedem Tag mit Byte != 0 (bei 0/9
führt 1D788 an allem vorbei). 1D7FF (Stärke Flag 1), 1D817 `mov %es:0x79e(%bx),%cl` /
`mov %cl,%es:0x79f(%bx)` / 1D821 `movb $0x1,%es:0x79e(%bx)` stehen vor der Verzweigung in
Liga/Pokal/Relegation/Europa/Nachholtag (1D866ff.).
Remake: `systemeSichern` (server.ts:1855) wird nur bei `faellig.length` (1932) und bei Ligabits
(1948) gerufen. Bei Flag 8, 0x10 und 0x70 wird nicht gesichert. `setSystem` (lineup.ts:32) schreibt
nur 079E. `nachTageswechsel` (1335) stellt am nächsten Spieltag 079E = 079F zurück.
Wirkung: (a) Eine Systemänderung im Zug eines Pokal-, Europapokal- oder Relegationstags ist am
nächsten Spieltag wieder weg. (b) Bis dahin bleibt 079E > 1, die Tagesroutine stellt deshalb
automatisch auf. Im Original steht 079E = 1, und die Automatik läuft ins Leere. (b) wird vom
Rückstellen und Aufstellen am nächsten Tagesbeginn meist überdeckt. Das Modell `originaltag.ts:129`
sichert an jedem Tag.
Häufigkeit: etwa 15-20 Tage je Saison (Kalenderbyte, unabhängig von der Teilnahme). Spürbar bei
jedem Systemwechsel an diesen Tagen.
Korrektur: In `advanceDay` `systemeSichern()` einmal unbedingt aufrufen, wenn `flag !== 0 &&
flag !== 9`, vor allen Spielen. Aufwand: klein.

### E5 - BESTÄTIGT (A)
1D042 `cmp $0x1,%si; sbb %cl,%cl; neg %cl; add $0x29,%cl` ergibt 0x2A bei Index 0 (Bild 42). Die
Sonderseiten-Art im Server ist `"winter" | "scherz1" | "scherz2"` (server.ts:668). Weihnachten
kommt nur als `pushMessage` (1802ff.). Aufwand: mittel (eigene Seite mit Bild 42).

### E6 - BESTÄTIGT (durch Originalstände belegt)
Original: 1D917-1D94A `shr %cl,%al; test $0x1,%al; ... incb %es:0x225a(%bx)` ohne Vergleich mit
der Spieltagszahl, auch für Tage ohne Züge (1D788 springt hierher).
Gegenprobe an den echten DOSBox-Ständen (Save-Offset 28432 = 4cb3:225A laut MEMORY-MAP): KP-RELEG1
(Tag 319/322), KP-RELEG2, KP-SAISON-START (Tag 322) haben **35 39 39**. Frühere Stände haben
Werte < 34 (z. B. KP-FINALE 33 37 37). Das Remake schreibt wegen `matchday.ts:148 if (md1 <
LEAGUES[league].matchdays)` höchstens 34/38/38.
Wirkung im Remake mit echten Lesern: `contracts.ts:49/90` (`prog = nextMatchday·-100/Spieltage +
100`, bei 35/34 -2 statt 0 -> Gehaltsforderung/Vertragsprüfung bei Käufen an Tag 319/322 und im
Saisonend-Zug), `attendance.ts:91` (Zuschauer der Relegation), `vereinsinfo.ts:254`, Anzeige
`main.ts:2242/3258`.
Häufigkeit: selten (drei Züge je Saison).
Korrektur: `matchday.ts` den Zähler immer erhöhen, nur `writePairings` begrenzen. Danach die Leser
von `nextMatchday` (pairings, records.ts:639, Web-Anzeigen) auf 35/39 prüfen. Stände des Originals
mit 35 lädt das Remake schon (Tests laufen). Aufwand: klein bis mittel.

### E7 - BESTÄTIGT (A)
1EB24-1EB2E: `push %es:0x25ba; push %es:0x25b8; lcall $0x310,$0x1f2` ohne Bedingung. Im Remake
gibt es keine Seite "SAISONENDE". Aufwand: klein (Titelseite wie WINTERPAUSE).

### E8 - BESTÄTIGT (A)
1F8A6: `mov %es:0x8(%bx),%al; mov %es:0x7(%bx),%cl; mov %es:0x6(%bx),%dl` -> Summe. Das Remake zeigt
`leagueApps + cupApps` an main.ts 4662/4676/6202/6381 (Tore 4664/4680/6207/6386). Aufwand: klein.

### E9 - BESTÄTIGT (A)
1FA2C: `and $0x3` merken, dann zuerst `cmpb $0xb,%es:0xa(%bx); jbe 0x1fa50`, sonst "RESERVE"
(2310). main.ts:4655 prüft das Flag zuerst. Aufwand: klein.

### E10 - BESTÄTIGT (A)
1EF4A `cmpb $0x0,%es:0xc(%bx); je` -> strcat 2798. Im Remake (main.ts:2797) fehlt der Zusatz.
Aufwand: klein.

### E11 - BESTÄTIGT (A)
1F190 `cmpb $0xb,%es:0xa(%bx)` (RESERVE vor dem Flag). main.ts:2804 nimmt Kurzwörter und für
Nummer 0 "". Aufwand: klein bis mittel (Texte).

### E12 - BESTÄTIGT (A)
1F329 `cmpw $0xec,0xe(%bp)`. 20550 `cmpb $0x1,-0xa(%bp)` ... (Rand 236 bzw. 175). Aufwand: klein.

### E13 - BESTÄTIGT (A)
2305F `lcall $0x1ecd,$0xe` (0x1ECDE) im Markt. Im Remake gibt es die Hilfszeile nur im
Kaderbildschirm. Aufwand: mittel.

### E14 - BESTÄTIGT (A)
1F7D5-1F7E7: Modus 1/2 oder -0x5E, `testb $0xc0,%es:0x9(%bx)`. Das Remake färbt die ganze Zeile.
Aufwand: klein bis mittel.

### E15 - BESTÄTIGT (A)
1F695: Modus 3, `cmpb $0x0,0x18` / `cmpb $0x64,0x18; jae` -> Farbe 3 nur für 1..99. Remake
main.ts:4638/4661 wie beschrieben. Aufwand: klein.

### E16 - BESTÄTIGT
Original: 0x224A8 holt mit 0x2256D `lcall $0x3930,$0x10c` (0x34,1) einen genullten Block und
kopiert ihn mit 0x2265B `lcall $0x35ac,$0x304a` auf den Platz (erstes Argument -0xC = Block = Quelle).
Danach schreibt es nur Byte 15 (2267B), 19 (22691), 14 (22695), 0x2277A (14/20), 11 (226A9),
12 (226B0), 16-18, 40 und Spielerbytes 34-36. Byte 10 schreibt es nicht. Eigener grep aller Schreiber
von `%es:0x7754(`: 9CF7, 9D39, 1DA59, 20730, 20B1E, 20C2D, 20EF2, 2125E, 2208B, 2214E, 22226, 222BB,
222ED, 23727. Keiner liegt im Kaufweg 0x23E58-0x24119. Der Kauf ruft danach bei 24114
`lcall $0x1ecd,$0x3360` (0x22030). Das kehrt bei 079E = 1 sofort zurück (22061 `sub $0x2` /
`inc` / `jne` -> 222FF), sonst setzt 2208B zuerst alle Nummern auf 0 und stellt neu auf.
Remake: `transfer.ts:108` `assignNumber` ("0x224A8 vergibt Nummern ab 12"), gerufen in
`completePurchase` (568), `completeLoan` (603), `takeBack` (403).
Gegenprobe: `transfer.test.ts:54` `assert.ok(l.number >= 12)` prüft nur das Remake-Verhalten und ist
keine Messung am Original. Andere Belege aus DOSBox gibt es nicht.
Wirkung: Mit manuellem System steht der Neue im Remake auf der Bank (einwechselbar, zählt als
RESERVE). Im Original hat er keine Nummer. Mit Automatik gleicht `autoLineupIfEnabled` das nur bei
`/api/market/contract` aus, bei Leihe und Zurückholen nicht (siehe E22). Doku falsch:
SPIELMECHANIK.md:1888.
Häufigkeit: jeder Kauf, jede Leihe und jedes Zurückholen eines Managers mit manuellem System.
Korrektur: Die drei `assignNumber`-Aufrufe streichen (Nummer bleibt 0), Test und Doku anpassen.
Die Nummernpflege des Hauptmenüs (0x9C78-0x9D40: 16 -> 15, wenn 15 frei ist, dann > 15 -> 0, dann
0x22030) als eigenen Punkt nachbauen. Aufwand: klein (Nummernpflege mittel).

### E17 - BESTÄTIGT
Original: 20661 `movb $0xc,-0xba(%bp)`. In der Schleife 20689-20809 erhöht 20782-207B1 -0xba,
solange ein Platz diese Nummer trägt, und `-0xae = 0` erzwingt einen weiteren Durchlauf (20802). Das
ergibt die kleinste freie Nummer ab 12 (16 bei voller Bank 12-15). 20B12 `cmpb $0x1,0x6(%bp); sbb;
inc; mulb -0xba(%bp)` -> Byte 10: im Spiel -0xba, sonst 0. Eingewechselter: 20EF2 `movb $0xb`,
danach 0x2119D. Außerhalb des Spiels schreibt die Schleife (207DB-207F0, 206BA-20730) jede Nummer
> 56EE auf die kleinste freie aus 12..15, sonst auf 0. Die Suche beginnt dabei bei Platz 1 (206B6
`incw` vor dem Lesen), Platz 0 zählt nicht mit (Randdetail). Hauptmenü 9CBB-9D39: 16 -> 15 nur,
wenn keine 15 vergeben ist, danach > 15 -> 0.
Remake: `uebernimmNummern` (server.ts) lässt nur eine Vertauschung der bestehenden Nummern zu. Der
Ausgewechselte bekommt die Banknummer des Eingewechselten.
Wirkung: Bei vollem Bank-Viererblock und Wechsel im Spiel hat der erste Ausgewechselte nach dem
nächsten Hauptmenü keine Nummer mehr, die Bank schrumpft. Im Remake bleibt er Ersatzmann. Mit
Automatik wird das am nächsten Tagesbeginn überdeckt, spürbar ist es nur bei manuellem System.
Häufigkeit: jedes Spiel mit Auswechslung bei manuellem System.
Korrektur: `uebernimmNummern`/`applySubstitutions` im Spiel dem Herausgenommenen die kleinste freie
Nummer ab 12 geben, statt zu tauschen, außerhalb des Spiels 0. Dazu die Nummernpflege > 15 (Hauptmenü
und Kaderbildschirm). Aufwand: mittel bis groß (Client und Server, Prüfregel "nur Vertauschen"
anpassen).

### E18 - BESTÄTIGT
Original: 235C4-235CF bucht die Ablöse, 235DD `lcall $0x1ecd,$0x10ee` (0x1FDBE, si, 1, 0x18):
Plätze si+1..24 rücken auf (1FE87, Quelle i+1). Erst danach liest 235E5 `les -0x24(%bp),%bx`
(Zeiger auf Platz si, gesetzt 23474) Byte 0x16, setzt es auf 0 (235F0 `mov %ah,%es:0x16(%bx)`),
schreibt es in Spieler -0x2 Byte 36 (23601), bildet den Schnitt aus 0x10/0x11/0x12 und ruft
23639 `lcall $0x14a4,$0x23da` (0x16E1A, erstes Argument = Verein). Spieler -0x2 wurde bei 234A7
vor dem Entfernen gemerkt, Besitzer 5 (23648) trifft also den richtigen Spieler. Beim Marktspieler
(23A6A ff.) liest das Original Byte 22 vor dem Entfernen.
Remake: `decideSale` (transfer.ts:457-463) liest `avg` und `club` vor `removePlace`.
Wirkung im Original: Der verkaufte Spieler bekommt als Verein Byte 22 des Nachrückers (ohne dessen
Angebot meist 0, also Verein 0). Dieser Verein wird mit den Stärken des Nachrückers gestärkt, und
ein Angebot des Nachrückers verliert seinen Verein. Beim letzten Platz liest das Original die Reste
des leeren Folgeplatzes (0x1FDBE nullt dort nur Byte 15, `removePlace` den ganzen Platz, siehe U3.3).
Häufigkeit: jeder Verkauf eines Kaderspielers an ein KI-Angebot (gelegentlich).
Korrektur: In `decideSale` für `where === "squad"` Byte 22 und Stärken nach `removePlace` vom
selben Platz lesen und dort Byte 22 = 0 setzen. Die Reste leerer Plätze nur dann nachbilden, wenn
`removePlace` wie 0x1FDBE nur Byte 15 löscht. Da es ein offensichtlicher Fehler des Originals ist:
entweder nachbauen oder als entschiedene Abweichung in ABWEICHUNGEN eintragen. Aufwand: klein
(ohne Restbytes), mittel mit.

### E19 - BESTÄTIGT
Original: 236D9 setzt 304A = 4, dann 236F2 `lcall $0x1ecd,$0x37d8` (0x224A8, Grenze 0xC). Darin wird
immer gewürfelt: 22687 `lcall $0x76b,$0xcc7` (erstes Argument 0x50, also random(80,120)), 2269C
0x2277A (4 Würfe), 22703 0x24D4E(Platz, 1). Auf dem genullten Platz ist Byte 9 = 0, dort wird also
nicht gewürfelt (value.ts:76 würfelt nur bei Bit 7). 23727 setzt Nummer 0, 2373D überschreibt den
Marktplatz mit der Kaderkopie. Das Zurückholen geht über 23B1E (-0xA = 1) -> 23E28 -> 23E86 ebenso
durch 0x224A8. Bei vollem Markt (224B8-224FA, Platz 11 belegt) kehrt 0x224A8 vor den Würfen zurück.
Remake: `listPlayer` und `takeBack` bekommen kein `rng`.
Wirkung: nur der Zufallsstrom, fünf Würfe je Aktion. Der Stand ist gleich.
Häufigkeit: jedes "auf den Markt setzen" und jedes Zurückholen.
Korrektur: In `listPlayer`/`takeBack` (bzw. im Server) nach der Vollprüfung `rng(80,120)`,
`rng(35,65)`, `rng(1,13)`, `rng(1,3)`, `rng(0,1)` verbrauchen. `/api/market/list` und `takeback`
geben `room.rng` mit. Aufwand: klein.

### E20 - BESTÄTIGT
Original 23BF0-23C1D: Grenze = Wert·0x8C/100. `cmp -0x4(%bp),%dx; jle 23c16` (sonst ok) /
`jl 23c20` (Fehler) / `cmp -0x6(%bp),%ax; jb 23c20` (Fehler) / sonst ok. Fehler also nur bei
Grenze < Angebot, genau 140 % ist erlaubt. Die untere Grenze (23BE4-23BEE, `jg`/`ja` -> Fehler)
meldet einen Fehler bei 60 % > Angebot, wie im Remake.
Remake: transfer.ts:506 `amount >= div(value * 140, 100)`.
Häufigkeit: praktisch nie (man müsste genau diesen Betrag eingeben, der Wert wird bei Bit 7 sogar
gewürfelt).
Korrektur: `>=` -> `>`. Aufwand: klein.

### E21 - BESTÄTIGT
Original: 23EEE `mov %es:0x9(%bx),%al` -> 23F0F `mov %cl,%es:0x7753(%bx)` ohne Maske (nur bei
-0x78 = 1, Kauf von einem Manager). Bei Leihe und Zurückholen kopiert 23FA8 den ganzen Platz,
danach greift nichts mehr auf Byte 9 zu.
Remake: transfer.ts:559 `market[9] & 0x3f`, 594 `bytes[9] &= 0x3f` (takeBack 401 ist wirkungslos,
wie das Audit sagt).
Wirkung: Ein Marktspieler eines Managers mit offenem KI-Angebot (Bit 7) behält beim Käufer das Bit
bis Saisonende. Das ändert seinen Marktwert (·130/100 bzw. ein Wurf random(95,100)) in Vertrag,
Verkauf und Anzeige. Leihen vom Rechner betrifft es praktisch nicht (Rechnerspieler bekommen kein
Bit 7).
Häufigkeit: selten (Kauf oder Leihe unter Managern eines Spielers mit offenem KI-Angebot).
Korrektur: Maske in `completePurchase` (nur Managerkauf) und `completeLoan` streichen. Aufwand: klein.

### E22 - BESTÄTIGT (Wirkung größer als im Audit)
Original: 22C2F setzt -0x2A = 1 beim Betreten. 22F5A `cmpb $0x0,-0x2a(%bp)` -> Neuzeichnen ->
22FBA `lcall $0x1ecd,$0x3360`. -0x2A = 1 wird wieder gesetzt bei 2364E (Verkauf Kaderspieler),
2375B (auf den Markt), 240AE (jeder Kauf, jede Leihe, jedes Zurückholen). Zusätzlich ruft 24114
0x22030 nach jedem erfolgreichen Abschluss direkt auf.
Remake: `autoLineupIfEnabled` gibt es nur in `/api/market/contract` (server.ts:3282), nicht in
`/api/market/list`, `takeback`, `decide`, `buy` (Leihe "done"), `answer` (Leihe) und nicht beim
Öffnen.
Wirkung: Im Server läuft `nachTageswechsel` (Rückstellen + Automatik) vor dem Zug, die Tagesroutine
erst nach den Spielen. Wer mit Automatik im Zug einen Starter auf den Markt setzt oder verkauft,
spielt deshalb das Spiel desselben Tages mit einem Mann weniger. `matchStrength` zählt nur Nummern
1..11, unter 8 droht die 0:2-Wertung. Im Original füllt 0x22030 die Lücke sofort. Das Audit nennt
nur "bis zur Tagesroutine" und unterschätzt die Folge.
Häufigkeit: jede Abgabe eines Starters bzw. jede Leihe/Zurückholung eines Managers mit Automatik.
Korrektur: In den genannten Endpunkten nach Erfolg `autoLineupIfEnabled(room.game, manager,
sperreAusgesetzt(...))` rufen. Beim Verkauf unter Managern die Automatik auch für den Käufer, sofern
im Original vorhanden (Käuferseite 24114). Aufwand: klein.

### E23 - BESTÄTIGT
Original 240DB-24113: `cmpb $0,-0xa; jne 24114; cmpb $0,-0x78; jne 24114` -> Abbuchung +
2410D `lcall $0x0,$0x272d`. Das gilt für Kauf und Leihe eines Rechnerspielers
(-0x78 = 0; -0x78 = 1 setzt nur 23DE8 nach dem Ja eines Manager-Besitzers). Kauf/Leihe vom Manager:
nur 240B7 (Abbuchung).
Remake: `sponsorSubsidy` nur in `/api/market/contract` (3285). Dort landen Rechnerkäufe **und**
Managerkäufe (`answer` -> `room.purchases`). Leihen (`buy` "done", `answer` Leihe) bekommen nie einen
Zuschuss.
Häufigkeit: Rechnerleihe gelegentlich, Managerkauf selten. Mit 1/7 geht es um echtes Geld
(20-65 % des Preises), außerdem ändern sich die Würfe.
Korrektur: `sponsorSubsidy` nur, wenn der Vorbesitzer der Rechner ist, und zusätzlich nach
`completeLoan` mit Rechnerbesitzer. Aufwand: klein.

### E24 - BESTÄTIGT (a und b); D bestätigt
a) 224FA `mov $0x7f,%al` -> 23EBA `cmp $0x7f,%di; jne` -> 2411C `cmp $0x7f,%di; jne 24124; jmp
241df`: Es gibt nur die Meldung aus 0x224A8, kein Ablehnungsbit. Remake transfer.ts:515-516 und
`answer` (kaderVoll -> `cancelPurchase`) setzen das Bit. Die Doku restroutinen.md:78 (R2) "endet wie
ein abgelehnter" ist falsch.
b) Nach dem Abbruch im Vertragsdialog (23ED8 `call 0x251ff`, 0 -> 2411C -> 24124) entfernt 0x1FDBE
den schon eingefügten Platz. 24143 schreibt Spieler 36 = -0xC zurück, 0x224A8 hatte 34/35 bei
Vereinswechsel genullt (22750-2275B), und die fünf Würfe sind verbraucht. Das Bit setzt nur 24168
`cmpb $0,-0x78; jne 24197` / `cmpb $0,-0x3a; jne` (also nicht nach dem Ja eines Managers, und auch
nicht, wenn -0x3A gesetzt ist). Beim Managerkauf sind 28/29/30 schon bei 23DE8 ff. überschrieben.
Remake: `cancelPurchase` setzt immer das Bit, würfelt nicht, lässt 34/35 und 28-30 stehen. Die Würfe
von 0x224A8 liegen im Remake nach `contractCheck` (`completePurchase` -> `addToSquad`), im Original
davor.
Häufigkeit: a) selten (Kauf mit 24 Mann). b) Die Wurfreihenfolge betrifft jeden Kauf. Ein Abbruch mit
Folgen (Liga-Einsätze/Tore des Spielers weg, Bit) kommt gelegentlich vor.
Korrektur: a) in `buyOffer`/`answer` bei `kaderVoll` kein `cancelPurchase`. b) Die fünf Würfe beim
Kaufangebot vor den Forderungen verbrauchen und Spielerbytes 34/35 bei fremdem Verein schon dort
nullen (oder beim Abbruch nachziehen), beim Abbruch das Bit nur für Rechnerkäufe setzen, beim
Managerkauf 28-30 schon nach dem Ja setzen. Doku R2 korrigieren. Aufwand: mittel.

### E25 - BESTÄTIGT
Original 2347A `testb $0x80,%es:0x18(%bx); je 234a4`, sonst Meldung 4D74 und `jmp 2429f`, vor
234AE (Bit 6). Remake: `saleOffer` (transfer.ts:429) prüft Byte 24 nicht, `/api/market/offer` auch
nicht. Neue Angebote entstehen im Remake (und laut Code im Original) nicht bei Bit 7
(`kaderAngebote`: `l.u8(24) & 0x80 -> return`). Der Fall entsteht also nur, wenn das Karriereende
nach dem Angebot kommt und das Bit noch nicht verfallen ist (1/4 je Tag).
Häufigkeit: selten.
Korrektur: In `saleOffer` für `where === "squad"` bei Byte 24 & 0x80 abbrechen (Meldung
`ui.hoertauf`). Aufwand: klein.

### E26 - BESTÄTIGT (A)
2325E `cmpb $0x4,%es:0x57fe(%bx)` -> Verein bzw. Managername über 0x3196D. Aufwand: klein.

### E27 - BESTÄTIGT (A)
224B8 `cmpb $0xc,0x10(%bp)`, Platz 11 belegt (0x7995 = 0x774A + 0x514·4 + 11·52 + 15) -> Text
4D2C/4D30. Remake transfer.ts:377 "Der Transfermarkt ist voll". Aufwand: klein.

### E28 - BESTÄTIGT
Original: Beim Zurückholen setzt 23B1E -0xA = 1, weiter über 23B7A -> 23E28 -> 23E58. -0x8 (Schalter
LEIHEN, 230E7-230EA) wird dabei nicht zurückgesetzt. 23E79 `mov $0x63,%al; imulb -0x8(%bp)` ->
Byte-12-Argument 0x63 -> 226EE Flag 3 (Gehalt ein Drittel). 23F6F: -0xA gesetzt -> 23F7E ganze
Kopie. 23FB0 `cmpb $0,-0x8; je` -> sonst Byte 11 = 1, Byte 12 = -0xC + 0x80 (Verein des Spielers
= eigener), Gehalt -0x28, Bytes 3..5 = 0. 24083/24089: Besitzer bleibt der Manager. 240DB: kein
Geld.
Remake: `takeBack` kennt den Schalter nicht, `main.ts:6482` schickt ihn nicht mit.
Wirkung: Im Original gibt es damit einen Trick (Gehalt gedrittelt, Vertrag 1 Jahr, Leihmarke).
Häufigkeit: selten (nur mit gewähltem LEIHEN).
Korrektur: `loan` im Client mitsenden, in `takeBack` bei `loan` Byte 11 = 1, Byte 12 = Verein|0x80,
Gehalt = Wert(Flag 3) setzen und 3..5 nullen. Oder als entschiedene Abweichung eintragen. Aufwand:
klein bis mittel.

---

## Übersicht

| ID | Urteil | Häufigkeit | Aufwand |
|---|---|---|---|
| E1 | bestätigt | jeder Spieltag | mittel (mit E2) |
| E2 | bestätigt | Wurfreihenfolge täglich, Stand gelegentlich | mittel |
| E3 | bestätigt | 1x je Saison | klein |
| E4 | bestätigt | ca. 15-20 Tage je Saison | klein |
| E5 (A) | bestätigt | 1/4 je Weihnachten | mittel |
| E6 | bestätigt (Originalstände 35/39/39) | 3 Züge je Saison | klein bis mittel |
| E7 (A) | bestätigt | 1x je Saison | klein |
| E8 (A) | bestätigt | immer (Europapokal-Teilnehmer) | klein |
| E9 (A) | bestätigt | selten | klein |
| E10 (A) | bestätigt | bei Leihspielern | klein |
| E11 (A) | bestätigt | immer | klein bis mittel |
| E12 (A) | bestätigt | immer | klein |
| E13 (A) | bestätigt | immer | mittel |
| E14 (A) | bestätigt | immer | klein bis mittel |
| E15 (A) | bestätigt | Vertragsansicht | klein |
| E16 | bestätigt | jeder Kauf/Leihe/Rückholung mit manuellem System | klein (+ Hauptmenü-Pflege mittel) |
| E17 | bestätigt | jedes Spiel mit Wechsel, manuelles System | mittel bis groß |
| E18 | bestätigt | jeder Verkauf eines Kaderspielers an die KI | klein bis mittel |
| E19 | bestätigt | jedes Setzen/Zurückholen (nur Zufallsstrom) | klein |
| E20 | bestätigt | praktisch nie | klein |
| E21 | bestätigt | selten | klein |
| E22 | bestätigt (folgenreicher: Spiel am selben Tag mit Lücke) | jede Abgabe eines Starters mit Automatik | klein |
| E23 | bestätigt | Rechnerleihe gelegentlich, Managerkauf selten | klein |
| E24 | bestätigt (a, b; Doku R2 falsch) | a selten, b Würfe bei jedem Kauf | mittel |
| E25 | bestätigt | selten | klein |
| E26 (A) | bestätigt | Marktspieler von Managern | klein |
| E27 (A) | bestätigt | bei vollem Markt | klein |
| E28 | bestätigt | selten | klein bis mittel |
