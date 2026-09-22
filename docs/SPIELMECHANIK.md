# Spielmechanik: Funktionskarte aus BMMAIN.EXE

Adressen = Ladeadressen im entpackten `tools/out/bmmain.bin`
(`python3 tools/func.py ADRESSE`). Stand 2026-09-06.

## Hilfsroutinen der Laufzeitbibliothek

Rechenschritte stehen im Original selten als Befehl da, sondern als Aufruf in die
C-Laufzeitbibliothek. Wer eine davon falsch deutet, baut eine Formel nach, die um Zehnerpotenzen
danebenliegt - genau das ist bei der Gehaltsforderung passiert (`>> 3` statt `· 8`). Deshalb die
Liste, bevor eine Formel übernommen wird:

| Aufruf | was sie tut | Aufrufe im Programm |
| --- | --- | --- |
| `0x3a01:0x1bb8` (0x3BBC8) | **32 Bit nach links** schieben, Weite in CL (`shl ax / rcl dx`) | 3 |
| `0x3a01:0x1bc4` (0x3BBD4) | **32 Bit nach rechts** schieben, vorzeichenrichtig (`sar dx / rcr ax`) | 4 |
| `0x3a01:0x1a4c` (0x3BA5C) | 32-Bit-Division mit Vorzeichen; zuerst wird der Divisor auf den Stapel gelegt, dann der Dividend | 151 |
| `0x3a01:0x1ae6` (0x3BAF6) | 32-Bit-Multiplikation | 149 |
| `0x3a01:0x1bf0` (0x3BC00) | 32-Bit-Wert am Zeiger mit einem Faktor multiplizieren | |
| `0x3a01:0x1bd0` (0x3BBE0) | 32-Bit-Wert am Zeiger durch einen Faktor teilen | |
| `0x3091:0x1009` (0x31919) | Wert am Zeiger auf einen Bereich begrenzen (min, max) | |
| `0x76b:0xcc7` | `random(min, max)` des Originals | 266 |
| `0x76b:0x681` | Zahl in Text wandeln (für die Anzeige) | 186 |
| `0x3a01:0xe18` | `strcpy` | 252 |

Die beiden Schieberoutinen liegen direkt hintereinander und unterscheiden sich nur in der
Richtung - eine Verwechslung fällt im Disassemblat nicht auf, im Spiel aber sofort.

## Saisondaten

- **Ergebnistabelle** (Save-Offset 59, 4238:6DDC, 2280 Bytes):
  `[liga 0..2][spieltag 0..37][spiel 0..9][heimtore, gasttore]`, also 3 x 38 x 20.
  Bundesliga nutzt 9 Spiele je Spieltag, die anderen Ligen 10. Heimtore = 30
  markiert ein verlegtes Spiel (Nachholspiel), ungespielte Spieltage stehen auf 0:0.
  Wird von der Tabellenfortschreibung gelesen. Initialisierung in 0x0462F.
- **Nächster Spieltag je Liga** (Save-Offset 28432, DGROUP 0x225A, 3 Bytes, 1-basiert).
- **Paarungen des aktuellen Spieltags** (Save-Offset 27900, 4238:4B5E, 60 Bytes):
  18 Bytes Bundesliga (9 Paare heim, gast), 2 Bytes Trenner, 20 Bytes 2. Liga,
  20 Bytes Oberliga.
- **Aktueller Spieltag je Liga**: DGROUP 0x225A (3 Bytes, 1-basiert),
  Ligagrenzen der Vereinsindizes: DGROUP 0x2262 (obere Grenze je Liga) und
  0x2272/0x2273 (Paare untere/obere Grenze).
- **Spielberichte** (4238:90CA, 4 x 154 Bytes, nicht gespeichert): Grundlage für
  Sportzeitung (0x2F244) und Spielanzeige. Felder 14/15 = Tore.

## Funktionen

| Adresse | Aufgabe |
|---------|---------|
| 0x1D6F7 | Tagesablauf: Datum, Spieltag je Liga, ruft Simulation und Fortschreibung |
| 0x2D144 | Tabellenfortschreibung(liga, flag): liest Ergebnistabelle des Spieltags, schreibt Punkte, Tore, Spiele, Siege, Niederlagen (heim/auswärts), Platz; ruft 0x2DBDF (Serien/Rekorde) und 0x2C304 |
| 0x0F9D2 | Mannschaftsstärke(manager): Summen über die elf Startspieler je Linie (Abwehr, Mittelfeld, Angriff) für Kondition, Technik, Form; Zuschläge aus Frische (Kaderplatz+19)/20, Einsätzen/6, Toren, Zufall 2..6 bei 0x04CD7 > 2, Zufall bei 0x04DD3 > 25 |
| 0x1C633 | Spiel eines Managers: Zuschauer (0x10BB0), Einnahmen auf Kontostand, Rekorde, Kader-Nachbearbeitung (Einsätze, Frische +6+Zufall(2..4)-1, Sperren -1) |
| 0x10BB0 | Zuschauerzahl(manager, heim, gast, wettbewerb, ...) |
| 0x1B224 | Spielanzeige mit Ticker ("Chance für", "Torschütze", "nach Vorlage von") |
| 0x17B0F | Verletzung würfeln (Diagnosetext) |
| 0x063B1 | managerOf(vereinA, vereinB): 1-basierter Managerindex, Bit 7 für Verein B |
| 0x122D9 | Kredit aufnehmen, 0x1222D Schulden summieren |
| 0x2DD9D | Bildschirm "Stärken Bundesliga" |
| 0x1EF4D | Bildschirm "Ihre Mannschaft" (liest Kaderplätze) |

## Kaderplatz (52 Bytes), Stand der Deutung

| Byte | Bedeutung |
|-----:|-----------|
| 1 | gelbe Karten |
| 3, 4 | Tore Liga, Pokal |
| 6, 7 | Einsätze Liga, Pokal (in 0x1C633 hochgezählt) |
| 9 | Flags, Bit 0 wird bei Sperrenabbau geprüft |
| 10 | Rückennummer |
| 11 | Vertragsdauer |
| 13 | Sperre in Spielen, zählt je Ligaspiel herunter |
| 15 | Spielerindex |
| 16, 17, 18 | Kondition, Technik, Form (Anzeige) |
| 19 | Frische 50..150, +6+Zufall(2..4)-[Ko>Te] je Einsatz |
| 26 | Linie/Position auf dem Feld (0..7, Höhe = (7-x)*75/7+5) |
| 28, 30 | 16-Bit-Zähler je Wettbewerb (Minuten?) |
| 40 | Gehalt |

## Spieler (37 Bytes), Ergänzung

Byte 33 = Managerindex des Besitzers (0..3), 5 = kein Manager.

## Offen

Stand 17.9.2026 (GitLab #30). Die Punkte, die hier früher standen, sind erledigt:

- Torberechnung aus den Stärken (Teil 2 von 0x0F9D2, Aufrufer 0x1D6F7): `sim/match.ts`, an 171
  Spielen aus DOSBox geprüft (siehe `docs/PLAN.md`, M2).
- Aufstellung der KI-Vereine: die KI-Vereine spielen mit ihrer Vereinsmatrix; ihre Tore verteilt
  0x15F14 nach dem Spieltag auf die Spieler (`sim/ai.ts`, Abschnitt "KI-Vereine").
- Zuschauerformel 0x10BB0: `sim/attendance.ts`, am Original nachgemessen (GitLab #23).
- Marktwert: `sim/value.ts`, Abschnitt "Marktwert".

Offen ist die vollständige Benennung aller Felder der Datensätze (`docs/MEMORY-MAP.md`).

## Training und Jugend (bestätigt über Trainingsbildschirm in DOSBox)

Manager Byte 319 = Intensitätsregler 0..34 (linke Leiste), 321..324 = Bälle für
Kondition, Spiel, Schuss, Taktik, 325 = Bälle Intensität, 326..329 = Bälle für
Tor, Abwehr, Mittelfeld, Angriff. Matrix DGROUP 0x292 (Bereich x Ko/Te/Fo):
Kondition 80/5/15, Spiel 30/40/30, Schuss 20/25/55, Taktik 5/65/30.
Zuwachs je Eigenschaft = Summe(Matrix * Bälle) / 20, je Spieler mal Intensität,
mal Kaderplatz Byte 14 / 50, mal (10 * Bälle der Positionsgruppe + 75 - Zufall 0..3) / 100
(Wochenfunktion 0x0DF0E). Jugend: Manager Byte 482 (u16) sammelt die Ausgaben;
am Saisonende (0x0CB63) J = Wert/12, danach 2/3 behalten; bei J > 30 mit
Wahrscheinlichkeit 1/3 und Kader < 23 kommt ein Jugendspieler, J wird halbiert.

## Spieltag-Vergleich TEST1 -> TEST2 (DFB-Pokal-Tag, 11. -> 15. November 1997)

Erzeugt mit DOSBox-Automation (tools/dosbox). Nürnberg gewann 2:1 gegen VfB
Stuttgart vor 24.000 Zuschauern. Geänderte Bereiche:
- Manager NORMI: Byte 306 3->4 (Pokalrunde), 313 4->0, 406 66->61, 410 42->37,
  Kontostand 973.860 -> 1.201.860 (+228.000).
- Vereine: bei fast allen Vereinen ändern sich die Stärkebytes 24..32 um
  wenige Punkte (wöchentliche Schwankung aller Vereine).
- Kaderplätze der Nürnberger: Byte 7 (Pokaleinsätze) +1, Byte 14 +1, Bytes 19..21.
- Datum 11 -> 15, Saisontag 105 -> 109, Termin-Index 30 -> 31.
- Block 28009 (128 Bytes, 4238:76CA) = DFB-Pokal-Paarungen, 4 Runden x 32 Bytes.
- Block 34322 (16 Bytes, 4cb3:0620) = acht 16-Bit-Werte, ändern sich täglich.

## Winterliche Spielverlegungen (0x03563)

Aufruf je Spieltag mit dem Tagindex `d` (Kalenderposition) und der Liga.
Nur für `d` in 25..69: `k = 9 - |d - 44| / 3`; ist `k > 0` und `random(0,1) != 0`,
dann `k -= 1`; verlegt werden `n = random(0, k)` Spiele (höchstens 8), die
Hilfsfunktion 0x36F1 wählt die Paarungen aus. Verlegte Spiele erhalten im
Ergebnisfeld die Marke 30 (Heimtore) und werden am Nachholtermin (z.B. "28.2.(N)")
gespielt; Tabelle, Einsätze und Einnahmen bleiben bis dahin unverändert.
Beobachtet in RUN0 (Tagindex 32): vier von neun Bundesligaspielen verlegt.

Die Nachholtermine stehen im Spielstand ab **Byte 5458**, je Eintrag fünf Bytes:
`[Nachholtag, Spieltag, Liga, Spiel, 0]`. Im Original liegt dieselbe Tabelle bei DGROUP 0x5715
und wird bei der Terminsuche (0x36F1 ab 0x3742) durchgegangen: ein Tag kommt nur in Frage, wenn
sein Kalenderbyte 0 oder 0x80 ist, dort noch keine neun Nachholspiele liegen und keiner der
beiden Vereine an dem Tag schon spielt; der gewählte Tag bekommt im Kalender die Marke 0x80.
Geprüft an TEST1 (7 verlegte Spiele, 7 Einträge mit Tag 33), RIED-4TE (20) und RIED (2).

Im Remake umgesetzt (sim/postpone.ts, sim/matchday.ts, Server und Konferenz): nach einem
Spieltag legt `scheduleReplays` die verlegten Spiele auf Termine, trägt sie in die Tabelle ein
und setzt die Kalendermarke; am Nachholtag trägt `playReplays` sie aus - mit der Paarung aus
`fixtures(Liga, Spieltag)`, also dem Spielplan des damaligen Spieltags, und ohne den laufenden
Spieltag der Liga weiterzurücken. Die Konferenz nimmt sie als eigene Einträge auf und zeigt sie
auf der Seite "NACHHOLSPIELE" (Titel aus 4cb3:4B88; im Original zeichnet dieselbe Routine wie
die Ligaseiten, 0x2B61A mit dem letzten Argument 0), die der Schalter Nachholspiele einblendet.

Dass `fixtures()` auch für alte Spieltage die richtige Paarung liefert, ist geprüft: für den
jeweils laufenden Spieltag stimmt es in CLAUDE4, TEST1 und RIED-4TE mit dem Paarungsblock
(4238:4B5E) überein, und im Original füllt 0x2B4F3 genau diesen Block aus denselben
Buchstabentabellen mit `Verein = Ligabasis + Buchstabe`.

## Spielvorbereitung (0x1C632, Kaderteil ab 0x1CBB9; Zweigbuch docs/abgleich/1C632.md)

Läuft im Original **vor** dem Anpfiff (Spieltagstreiber 0x46DB ruft sie bei 0x4914 für die
Liga und 0x4A33 für die Pokalbereiche, danach erst die Live-Schleife); die Anfangsstärke steht
da schon fest (Tagesablauf 0x1D7FF). Der Kaderteil läuft auch im Remake beim Anpfiff
(`kaderVorbereitung` aus `startLive`, GitLab #89 V10): Frischebonus und Einsätze wirken bei
Neuberechnungen im Spiel, Byte 21 trägt nach dem Spiel die Bewertungen; die Dopingprüfung
vergleicht deshalb mit den Einsätzen von vor dem Anpfiff. Ohne Konferenz (Tests) läuft er als
`afterMatch` nach dem Spiel. Die Einnahmen stehen in `bookGate`/`bookAttendance`/`pokalZuschlag`
(attendance.ts). Je Paarung geht
sie die Manager der Reihe nach durch:

- **0:2-Prüfung** (Byte 317 = 100, weniger als acht einsatzfähige Starter): außer ab dem
  10. Juni Strafe 200.000 DM (0x1C5D1) und **sofortige Rückkehr** - der Manager selbst und alle
  nach ihm bekommen keine Einnahmen und keinen Kaderteil. In der Liga wertet der Treiber das
  Spiel 0:2; bei Pokalspielen wirft er den Rückgabewert weg (0x4A33).
- **Einnahmen:** Liga siehe "Zuschauer"; Pokal siehe "Einnahmen im Pokal". Zuschauerhistorie
  (330 + Zähler 314), Summe 484 und Rekorde 488/492 nur im Ligaheimspiel; die gleiche Zahl
  löst einen Rekord ab (TEST4 -> RUNA0: 24000, Gegner 0 -> 3).
- **Kaderteil:** in der Liga zählen gesperrte eigene Spieler auf den Marktplätzen 0..11 ihre
  Sperre herunter. Je Kaderplatz: Liga-Sperre (Flag-Bit 0, Byte 13) herunter; Byte 21
  (Spielbewertung) gelöscht; Starter: Frische += 6 + random(2,4) - [Kondition > Technik],
  Liga Spieler Byte 35 ++, Einsatz in Byte 6/7/8 und 16-Bit-Zähler 28/30/32 für
  Liga/DFB-Pokal/Europapokal und Relegation; Frische auf 50..150. Danach je Manager
  Foulbudget 4238:0178 = 6 und Platzverweis 0179 = 1 **nur im Ligaspiel mit mindestens sechs
  Kaderspielern**, sonst beide 0; Auswechselzähler 5396/5397 = 1/2; Gelbliste 1D1C geleert;
  beim Heimmanager die Randale (siehe Finanzen). Die Einwechselroutine (0x20DBC) gibt dem
  Eingewechselten Frische += 4 + random(2,4) und einen Einsatz.

## Training je Kalendertag (0x0DF0D; portiert als dailyTraining, sim/training.ts)

Je Kaderplatz nach der Frische (unten): Faktor = 20·Intensitätsbälle, bei Frische > 135
minus random(70 - 13·Level, 90 - 5·Level), mindestens 10, Torhüter +30. Je Linie l:
gewinn = (Σ_k Matrix[k][l]·20·Bälle[k] / 400) · Faktor / 100 · Byte14 / 50 ·
(10·Positionsbälle + 75 - random(0,3)) / 100. Schwelle = 37 (36 bei Level 5) mit Zufall
±2 (random(0,4) == 4 und Fenster/Level verschieben sie); liegt der Gewinn mehr als 8
unter/über der Schwelle, sinkt/steigt der Anzeigewert (Byte 16+l) mit 50 % Chance und
nochmals 1/4 Chance um random(1, min(3, (|Differenz| + 8)/11)); Ko/Te in 1..99, Form 45..55.
Danach Trainingsfaktor Byte 14 (30..68): mit 3/4 Chance ± Stärke aus Byte 20 (Bits 4..6,
Richtung Bit 7); Byte 20 zählt täglich herunter (Bits 0..3); bei 0 neu: Byte 14 =
random(35,65), Byte 20 = random(1,13) | random(1,3) << 4 | random(0,1) << 7 (0x2277A).
Bestätigt an TEST3 -> RUN0 (alle 15 Kaderplätze). Verletzungen (Flag-Bit 1) zählen in
Byte 13 wöchentlich herunter (0x0F6D8), Sperren (Bit 0) je Ligaspiel.

### Trainingsverletzungen (Teil derselben Funktion, ab 0xE668; portiert als trainingInjuries)

Je gesundem Kaderplatz (Byte 9 = 0, Byte 13 = 0) Wahrscheinlichkeit 1 / (30·Level + d + 81)
mit d = max(40, 2·(160 - Frische + 25·[Kalendertag ohne Ereignis])). Verletzung (0x17B0F):
Grundform des Spielers (Byte 30) über 20 sinkt um random(12,19); Art random(0,17) aus 18
Arten (Namen DGROUP 0x23B4, Wochen DGROUP 0x5BC: 1,2,1,2,2,4,2,1,1,6,12,5,7,10,11,9,20,14),
mit 50 % Chance neu gewürfelt, wenn Wochen > random(2,4); Dauer = Wochen + random(0,
Wochen/4 + 1) in Byte 13, Flag-Bit 1, Art in Byte 23, Nummer 0. Danach folgt im Original
die Vertragsverhandlung (0x16FC8, Byte 24), portiert in `sim/contracts.ts` (Abschnitt
"Vertragsangebote der Spieler").

### Frische (Teil derselben Schleife)

Der Tagesablauf ruft die Trainingsfunktion bei 0x1DBFE an jedem Kalendertag (Saisontag
0 oder 4 mod 7). Die Funktion hat keine Argumente: 4cb3:304A ist der Manager, der gerade dran
ist. Je Kaderplatz (Aufstellung 25·Manager + Platz, Zeiger ab 0xEFA1), in dieser Reihenfolge:

1. **0xEFD4** Frische > 50: -= random(3,7).
2. **0xF006** intens = Manager Byte 325 (Bälle Intensität); im **Winterfenster**
   (Saisontag > 130 + 7·endlos **und** < 207 - 14·endlos) mindestens 6.
3. **0xF04D** Frische += 2·(intens - 5), als Byte gerechnet.
4. **0xF051** Frische über 130 und intens < 6: -= random(1,3).
5. **0xF088 / 0xF098** Grenzen 60..150.
6. Trainingsgewinn je Linie (siehe oben) mit dem Faktor 20·intens, bei Frische > 135
   vermindert um random(70 - 13·level, 90 - 5·level), mindestens 10, Torhüter +30.
7. In jeder der drei Linien, **nach** der Begrenzung: im Winterfenster oder nach Saisontag 322
   ein Zuschlag random(0,2) - bei Level über 2 an **0xEC50**, bei Level unter 2 an **0xECEB**,
   Level 2 bekommt keinen. Über den Tag also bis zu +6; begrenzt wird erst am nächsten Tag.

4cb3:4A28 (Save-Offset 34062) ist der Spiel-Level aus dem Einstellungsbildschirm
("Spiel-Level", "Endlosspiel" bei 0xAD44), nicht der Einsatzregler; 4cb3:224D ist das
Endlosspiel-Flag.

**Das Training rechnet für den Tag, an dem der Zug ankommt.** Der Tagesablauf spielt erst die
Spiele des aktuellen Kalendertags, zählt dann den Saisontag hoch (0x1DA87, in der Winterpause
über viele Tage) und ruft 0x0DF0D für den neuen Kalendertag auf (0x1DBFE). Ein gespeicherter
Stand enthält das Training seines Tages also schon. Über die Winterpause am Original gemessen
(docs/REFERENZ-TRAINING.md, zweite Messung); bis GitLab #27 trainierte das Remake vor den Spielen
für den alten Tag.

Das Winterfenster umfasst ohne Endlosspiel die Saisontage 131 bis 206, also die Winterpause:
die Spieler erholen sich, und niemand trainiert unter Intensität 6. Bis GitLab #27 stand der
zweite Vergleich hier und im Code verkehrt herum ("< 130 und > 207", eine Bedingung, die nie
zutrifft; der Zuschlag galt dadurch nur nach Saisontag 207). Der Code vergleicht aber
`207 - 14·endlos` mit dem Saisontag und springt mit `ja` - der Tag muss also darunter liegen.

Vor den Kaderplätzen läuft, nur wenn Manager 0 dran ist, eine Schleife über die
Transfermarktspieler (Aufstellung 100 + Platz): **0xDF8F** Frische über **56** verliert
random(3,9). Portiert in `dailyTransfers` (sim/transfer.ts).

## Frische-Stellen: Zuordnung (GitLab #27)

Das Audit vom 17.9.2026 führte sechs Stellen als "nicht portiert". Beim Lesen des Codes stellte
sich heraus, dass die meisten schon da waren - aber an zwei Stellen falsch:

| Adresse | Was sie tut | Stand vor #27 | nach #27 |
| --- | --- | --- | --- |
| 0xDF8F | Marktspieler über 56: -random(3,9) | portiert (transfer.ts) | unverändert |
| 0xEFD4 / 0xEFEE | Kaderplatz über **50**: -random(3,7) | als 56 gerechnet | 50 |
| 0xF006..0xF03D | Mindestintensität 6 im Winterfenster | Bedingung nie wahr | berichtigt |
| 0xF04D | Frische += 2·(intens - 5) | portiert | unverändert |
| 0xF088 / 0xF098 | Grenzen 60..150 | portiert | unverändert |
| 0xEC50 / 0xECEB | Zuschlag random(0,2) je Linie | in #24 gestrichen | zurück, mit richtigem Fenster |
| 0x119CD | Wirkung des Trainingslagers, Grenzen 60..150 | portiert (trainingCamp) | unverändert |

Der Fehler in #24: die Messung am Saisontag 249 zeigte keinen Zuschlag, unsere Fassung aber rund
+3 je Tag. Daraus wurde geschlossen, den Zuschlag gebe es nicht. Tatsächlich gibt es ihn am
Saisontag 249 auch im Original nicht - weil der Tag außerhalb des Fensters liegt, das bei uns
verkehrt herum stand. Und die 56 aus 0xDF8F gehört zur Marktschleife, nicht zum Kader.

## Torschütze und Bewertung (0x1B223, Wahl 0x05D9A; portiert in sim/goals.ts)

Bei Tor oder Chance eines Managervereins wird ein Starter gewählt: Kandidat zufällig
aus dem Kader, nur Nummern 1..11; Gewicht w = 3·Te/(5 - 3·mode) + Ko/5 + Fo/5 (bei
mode 0 und Chance: random(120,170)) + Positionsgruppe·(6 - mode)·7 + 46·Ligatore +
300·[mode = 0] + (7 - |y|)·200 (+1200 bei y < 2; y = Kaderbyte 26) + 5·(|x - 3| -
2·[mode = 0]) (x = Kaderbyte 25; bis GitLab #99 stand hier [mode ≥ 1] und Byte 19) + (Tor: 5·(5 - positionFit) + 35 - abstandZurLinie; Chance: 5·positionFit
+ abstandZurLinie); angenommen, wenn random(0,3500) < w; Torhüter nur mit 1/21.
Schütze: mode 0, Vorlage: mode 1 (bis ungleich Schütze). Tor: Spieler Byte 34 ++ (Liga),
Kaderplatz Byte 3 (Liga) / 4 (Pokal) ++, 16-Bit-Zähler bei 34/36 ++, Bewertung Byte 21
+15; vergebene Chance: Bewertung -10. Verteidigender Managerverein: Gegentor Torwart -8,
Feldspieler -5; abgewehrte Chance Torwart +8, Feldspieler -3. Byte 21 wird vor dem
Spiel gelöscht (Nachbereitung) und ist damit die Spielbewertung.

## Zuschauer (0x10BB0, Buchung 0x1C798; portiert in sim/attendance.ts)

Eingaben: Tabellenplätze beider Vereine (Byte 46, 0-basiert; Bundesliga-Heimplatz
höchstens 14), sH/sA = 2·(Abwehr + Mittelfeld + Angriff der Stärkefunktion bei Minute 0)/15
aus dem Vereinssatz - bei Managervereinen steht dort die **Spielmatrix**, weil die
Stärkerechnung vor dem Spiel (0x1D7FF, Flag 1) sie hineinschreibt; Preis =
Manager Byte 266, Liga = Byte 312 (mult = 4/2/1). Gleitkomma-Basis:
((1 - 0,02·(posA-1))·sA + (1 - 0,02·(posH-1))·sH)·1150/4,3, minus random((Preis-10)·1050,
1550·Preis - 14400), plus 1000. Danach mit q = (sA+sH)·100/180: + random(5q,9q)·Komfort398
- 20q; + random(4q,12q)·Komfort390 - 31q; + (10·Komfort374 - 8)·q; + (10·Komfort382 - 5)·q;
+ (überdacht366/1000 - 8)·q; Fanwert u16 476 > 50: + 30·Fanwert - 1500; - 2000·Liga;
Level > 0: + 1200; Sitzplätze + 2000 > Stehplätze: + random(400,700). Bedeutung
(0..3, Oberliga 0, bei sA < 90 um 1 gesenkt): Preis < 22: att = att·(Bedeutung+2)/3.
Letzte fünf Spieltage (Spieltag + 5 > Spieltage) bei Preis < 22: letzter Spieltag
ausverkauft, sonst + Kapazität/4 bei Heimplatz unter 7 (2. Liga: 5) und **nur dann** noch
+ Kapazität/5 bei Gastplatz unter 7; + Kapazität/4 im Abstiegskampf. Fanwert-Term mit 16 Bit
(überläuft erst ab 2185, der Fanwert endet bei 95). Preis > 10: + 900·(10 - Preis). Deckel: att·Preis ≤ (2·mult - [mult = 4])
·100000 (Bundesliga 700000 DM), Schritte von 1000; mindestens 501; höchstens Kapazität
(Sitz + Steh; bei Argument +0x10 = 1 stattdessen random(K - K/3, K + K/3)·10 mit
K = 4500/2200/1200/600 je Ligaband - das gilt nur für Heimvereine des Rechners, siehe
Pokaleinnahmen. Argument +0x12 setzt den Eintrittspreis an die Stelle von Byte 266).
Buchung: Historie Byte 330 + Zähler 314 (in Tausend), gesamt 484, Rekord 488 mit Gegner
500, Minuskulisse 492 mit Gegner 504. Geprüft: Nürnberg - Schalke 24000 (ausverkauft) in
allen zehn Läufen, Buchung byte-genau gegen RUNA0. Bedeutungswert (0x1C737): Liga und DFB-Pokal 1, Europapokal 2, bei 4cb3:0009 > 4
auch 3. Offen: Pokalzuschlag gegen unterklassige Gegner (0x1C858).

## Monatsabrechnung (Einnahmen 0x17076, Ausgaben 0x17262, Zinsen 0x1222D; sim/finance.ts)

Einnahmen: Grundwert q = 5·(Σ Vereins-Kondition + Technik über die drei Linien)·Kadergröße
+ Fanwert(u16 476)/5 + 25 (wird nach Manager u16 480 geschrieben) + Trikot, sechs Banden
und TV (Werbetabelle 33918) + Zinsen, die die anderen Manager zahlen (Kredittabelle
ab Byte 508: 5 Geldgeber × 3 Plätze × 18 Bytes, Zins je Monat bei +4) [+ Zuschuss
4cb3:0644/Tag/75, nicht im Spielstand]. Ausgaben: 150000 + Gehälter aller Kaderplätze
(i32 bei 40) + Gehälter eigener Spieler auf dem Transfermarkt (Kaderplätze 100..124)
+ ((((3 - Liga)·43750 + 1375·(Komfort374 + Komfort382) + 3000·Komfort398 + Sitzplätze)·2
+ Stehplätze)·2 + Überdacht) + u16 478 (Trainer) + 10000·(Jugendregler 319 + 1)/16
+ Werbeausgaben + eigene Zinsen + Steuer bei Kontostand über 2 Mio (30000 je angefangene
500000 + 20000, ab 4 Mio ×1,5; nicht in der Oberliga). Geprüft an RIED-CLI: Ausgaben
1.172.205 DM exakt; Einnahmen 883.584 DM bis auf die wöchentlich schwankende Matrix.
Der Server bucht Einnahmen minus Ausgaben beim Monatswechsel.

## Tägliche Finanzroutine (0x11D0D; portiert als dailyFinance in sim/finance.ts)

Je Manager und Kalendertag: Krawall (Byte 318 Bit 0, gesetzt nach einem Heimspiel in
0x1CEA7 mit Wahrscheinlichkeit 1/(4x+16), x = 30 - clamp((Steh - Sitz)/1000, 0, 30)):
Schaden = (Steh·4 + Sitz/2)·random(2,5), auf Tausender abgerundet, "Randalierer im
Stadion richteten einen Sachschaden von … DM an."
(**am Original nachgemessen**, GitLab #26, 17.9.2026: Spielstand mit gesetztem Merker geladen
und je einen Tag weitergeschaltet, Betrag aus der Meldung abgelesen. Bei 20.000 Steh- und
10.000 Sitzplätzen kamen 170.000, 340.000 und 425.000 DM, bei 30.000/5.000 zweimal 245.000 und
einmal 367.000 DM - sechs Läufe, sechs Treffer auf einem der vier möglichen Würfe. Der Wert
367.000 belegt alle drei Teile auf einmal: 122.500·3 = 367.500, abgerundet 367.000; mit
Stehplätzen allein wären es 360.000, ohne Abrundung 367.500). Kredite (Byte 508, 5 Geldgeber × 3
Plätze × 18 Bytes; Geldgeber 4 = Bank, 0..3 = Manager): am Fälligkeitstag (Byte 9,
höchstens Monatslänge) werden die Monatszinsen (i32 bei 4) abgebucht; stimmt zusätzlich
Fälligkeitsjahr (u16 bei 16) und -monat (Byte 11), wird die Summe zurückgezahlt, einem
Manager-Geldgeber gutgeschrieben und der Kredit gelöscht ("Ihr Kredit von … wurde heute
fällig."). Täglich wird der Kontostand in 4cb3:0644 aufsummiert (der Server führt diese Summe je
Manager mit); am Monatsende (Tag = Monatslänge aus 4cb3:07B8) gilt: Jugendkonto (u16 482) += 4·Jugendregler (319), Einnahmen
+ Durchschnittskontostand/75 bei Guthaben, Ausgaben + Durchschnittskontostand/10 bei
Überziehung, Werbeverträge zählen herunter (Trikot 4238:0000, Banden 4238:4B9A, nicht im
Spielstand), Fanwert (u16 476) unter 95 steigt um random(1,3), wenn random(0,22) <
Werbeausgaben/2500. Der Server läuft alle übersprungenen Kalendertage einzeln durch.

Reihenfolge der Würfe in 0x11D0D (bytegenauer Vergleich, GitLab #99): Bau (0x020E1, ohne
Würfel), Öffnungszeiten der acht Lager (random(20,70) für jedes Lager, das dabei auf 0 kommt -
auch für eines, das schon auf 0 stand), erst dann der Bankzins mit random(0,60) = 0. Am
Monatsletzten mit Monat % 4 = 0 (0-basiert: Ende Januar, Mai, September) setzt 0x11E3D die
Marke 4cb3:5256; das nächste Hauptmenü speichert dann als AUTOSAVE (0x9744 -> 0x32AAE). Jedes
Speichern würfelt im Spielstrom mit: eine Kennung aus zwei random(0, 0x8FFF) und zwei
Schlüsselbytes random(0,255). Der Server speichert selbst und bildet das nicht nach; im
Vergleichslauf `originaltag` steht es drin.

## Pokale: DFB-Pokal und Europapokale (Auslosung 0x18600/0x18FC2, Rundenabschluss 0x192FC, Entscheid 0x19208, Verlängerung 0x18E46; sim/europa.ts, sim/cup.ts)

Die 128-Byte-Tabelle bei 28009 hat vier Bereiche zu 32 Bytes: Bereich 0 = DFB-Pokal,
1 = Landesmeister, 2 = Pokalsieger, 3 = UEFA-Pokal (Vereinsindizes ab 64 sind
Auslandsvereine). Je Pokal steht die laufende Runde 1-basiert in 28233 + Pokal, die
Rundengrößen sind 16, 8, 4, 2, 1 Paare (4cb3:07D6); die Paare liegen vorne im Bereich,
erster Verein Heim, der Rest ist Altdaten. Ergebnisse eines Pokaltags stehen in 28304
(zwei Bytes je Paar, Heimwert +10 nach Verlängerung, +20 nach Elfmeterschießen, die
Elfmetertreffer zählen zu den Toren) und werden nach dem Rundenabschluss gelöscht, außer
nach dem Finale.

Auslosung erste Runde (0x18600): DFB-Pokal: jeder Managerverein bekommt einen zufälligen
der 32 Plätze, die übrigen Plätze random(0, 58) ohne Doppelte und ohne Managervereine
(Index 58 = Chemnitzer FC ist im Original enthalten); danach spielt auf ungeraden Plätzen
ein Unterklassiger (Index ≥ 38) gegen einen Erst-/Zweitligisten zu Hause, solange die
Runde < 4 ist (0x18DA8). Europapokale: 32 Auslandsvereine random(64, 199) ohne Doppelte
über alle drei Europabereiche, dann ersetzen die deutschen Teilnehmer (27988, sechs Plätze
je Pokal, 0x80 = frei) zufällige Plätze 1..31, die einen Auslandsverein tragen. Manager
Byte 306 + Pokal = 1 für Teilnehmer, sonst 30. Folgerunden (0x18FC2): die Sieger stehen
nach dem Rundenabschluss auf den geraden Plätzen, werden zusammengeschoben, mit zwanzig
Zufallstauschen random(1,n)-1 gemischt und paarweise gelesen; DFB-Pokal wieder mit
Heimrecht für Unterklassige.

Spielablauf: 1..45, 46..90. In der Verlängerung geht der Heimwert mit der Markierung +10 in
den Torwürfel: das Original liest dort das Ergebnisbyte, in dem sie schon steht. DFB-Pokal:
bei Gleichstand Verlängerung 91..105 und 106..120, danach Elfmeterschießen (0x666D: ohne
Managerbeteiligung beide Seiten random(2,5) Treffer, neu gewürfelt bis ungleich; mit
Managerbeteiligung random(0,1) beginnt, fünf Schützen je Seite, Abbruch sobald entschieden,
sonst abwechselnd). **Getroffen wird bei random(0,2) ungleich 0**, also in zwei von drei
Fällen: 0x6999 wirft die Zahl, 0x69A3 macht aus der 2 eine 1, und 0x6A04 zählt jede 1 als
Tor (bis GitLab #72 stand hier die Gegenprobe - nur die 2 -, das war ein Drittel).
Mit Managerbeteiligung zeigt das Original das Schießen auf einer eigenen Tafel (0x6733): die
Tafel in Schwarz-Rot-Gold wie vor dem Anpfiff, darauf "Elfmeterschiessen" bei y=50, der
Heimverein bei 100, "gegen" bei 128 und der Gast bei 156. Jeder Schuss läuft danach über
dieselbe Szenenausgabe wie eine Chance der Konferenz (0x1B223, Text "Elfmeter für ") und
wird mit 0x632C wieder abgeräumt; die Anordnung der Schüsse ist nicht nachgemessen.
Europapokal: Hin- und Rückspiel an den Kalendertagen mit Flag 0x70 (1/5, 15/19, 31/35,
63/67, 77/81, auch das Finale). Nach dem Hinspiel (Flag 28241 + Pokal - 1 = 0) speichert
der Rundenabschluss das Ergebnis gespiegelt in 28137 (Gast, Heim) und tauscht die Paare.
Im Rückspiel entscheidet 0x19208: mehr Gesamttore, sonst mehr Auswärtstore, sonst "offen"
(30): Verlängerung, dann Elfmeterschießen; nach Saisontag 315 zählt nur das eine Spiel.
Sieger nach vorn, Manager Byte 306 + Pokal = Runde + 1, Verlierer bleiben auf 30. Nach dem
Finale: DFB-Pokalsieger + 1 nach 2340 und Finalist + 1 nach 2344, Europapokalsieger + 1
(nur deutsche Vereine, sonst 0) nach 2341..2343 als Titelverteidiger. Zuschauer im eigenen
Stadion mit Bedeutung 1 (DFB) bzw. 2 (Europapokal, 3 im Finale); Torschützen und Einsätze
zählen im DFB-Pokal als Pokal (Byte 4/7), im Europapokal und in der Relegation in Byte 5/8
(Karrieresummen Wort 38/32).

Einnahmen im Pokal (Buchungsschleife 0x1C632 über alle Manager, Teiler 2 ab 0x1C655 nur für
Pokalspiele). **DFB-Pokalfinale** (Rundenbyte 28233 > 4, 0x1CB65): Kulisse fest 76.000
(4cb3:2256), statt Eintritt bekommt jeder beteiligte Manager 532.000 DM (0x1C8F5, 0x1CAA2).
**Pokalzuschlag** im Heimspiel eines Managers gegen einen höherklassigen Gast (0x1C858):
d = Liga des Managers (Byte 312) - Ligaband des Gastes > 0: Kulisse += random(Kulisse/(8-3d),
Kulisse) mit 16-Bit-Grenzen, höchstens bis zur Stadiongröße (350 + 358). Sonst: der Heimverein bekommt Kulisse · eigener Preis (Byte 266) / 2 bei 0x1C93A, der
Gast dieselbe Kulisse · den Preis **des Heimvereins** / 2 bei 0x1C9DC (Satzindex -0x1e). In
der Liga entfällt der Gastanteil, weil der Teiler dort 1 ist (0x1C9AD). Gehört der
Heimverein dem Rechner, würfelt 0x1CA12 einen Ersatz aus: Preis = 16/14/10/8 je Ligaband
(DGROUP 0x5390) + random(0,1), Kulisse aus 0x10BB0 mit dem Satz des Gastes, aber der
ausgewürfelten Kapazität random(K - K/3, K + K/3)·10 mit K = 4500/2200/1200/600 (DGROUP
0x2C8, Argument +0x10). Diese Ersatzkapazität gilt **nur** dann - im eigenen Heimspiel zählt
auch im Pokal das gebaute Stadion, denn 0x1C781 übergibt +0x10 = 0. Zuschauerhistorie,
Rekorde und Randale hängen am Heimspiel und bleiben beim Gast aus. Original-Eigenheit, nicht
nachgebaut: steht der Gastmanager in der Managerliste **vor** dem Heimmanager, ist die
Kulisse beim Gastanteil noch 0 und er bekommt den ausgewürfelten Ersatz statt der echten
Zahl (GitLab #75).

Europapokalteilnehmer am Saisonende (0x18B12, aus der Tabellenreihenfolge 28244): Meister
und, wenn vorhanden, der Titelverteidiger des Landesmeisterpokals (ist er der Meister, der
Vizemeister) in den Landesmeisterpokal; DFB-Pokalsieger (ist er schon dabei, der
Finalist) und der Titelverteidiger des Pokalsiegerpokals (ersatzweise der Finalist) in den
Pokalsiegerpokal; Titelverteidiger des UEFA-Pokals und die nächsten vier Tabellenplätze
(4cb3:226D = 4; ist der Titelverteidiger schon dabei, fünf) in den UEFA-Pokal. Liste aller
Teilnehmer in 27978.

## Relegation (0x33C0, Kalendertage 91 und 92 mit genau Flag 0x10)

Der Tagesverteiler 0x1D8D1 ruft für Flag 0x10 ohne 0x20/0x40 die Relegation: Bundesliga-
16. (28244 + 15) gegen Zweitliga-3. (28244 + 22), Hinspiel beim Zweitligisten, Rückspiel
beim Bundesligisten, gespielt über Bereich 1 Platz 0 im Initialisierungsmodus (4238:57DC:
keine Managerbytes, keine Titelverteidiger, kein Löschen, keine Auslosung); Bereich, Ergebnis
und Hinspiel werden vorher gesichert und danach zurückgeschrieben. Das Hinspielergebnis
steht in 28007, der Ausgang nach dem Rückspiel (0x19208 mit Verlängerung und
Elfmeterschießen) in 34367: 1 = der Zweitligist steigt auf. Der Saisonwechsel liest diesen
Wert.

## Werbung (Angebote 0x176F4 mit Stadionwert 0x175FA, Abschluss 0x291CD/0x29242, Monat 0x11E42, Saisonende nach Aufstieg 0x0CC00; sim/werbung.ts)

Tabellen: 33462 je Manager Restmonate und Sponsor des Trikotvertrags, 33470 je Manager sechs
Banden (Restmonate, Sponsor), 33518 Laufzeit in Jahren 1..3 je [(Manager·2 + Seite)·10 +
Sponsor], 33598 Angebot in DM (i32) im selben Raster (0 = "KEIN INTERESSE..."), 33918
Werbetabelle (Trikot, sechs Banden, TV, Werbeausgaben). Seite 0 = Trikot, 1 = Banden.

Angebote (am Saisonende und bei Spielbeginn, je Seite zehn Sponsoren):
```
stadionwert = min(Sitze + Steh + Überdacht/2, 80000) + 1900·Komfort382 + 1500·Komfort374
              + 1000·(2·Komfort398 + Komfort390), höchstens 100000, dann /1000
basis = stadionwert ; basis < 50 und Fanwert > 29: basis += 20
r = random(15,20) ; halb = basis/2 + 50 ; grenze = halb + r - 50
k = halb/5 + 2·sponsor ; betrag = random(11k + 58, 12k + 62)
Trikot: halb ·= 5
t = 10·sponsor + random(3,20) ; t >= grenze und random(0, 3·(7·sponsor/10 + 3)) != 0: kein Angebot
betrag = betrag · halb · random(Fanwert/7 + 100, Fanwert/5 + 100) / 100
jahre = random(0,2) + 1 ; L = 2 - Liga ; L == 1: betrag ·= 107/100
betrag = betrag · random(10·(jahre + 8), 15·(jahre - 1) + 92) / 100
betrag = betrag · random(20·(L + 5), 23·L + 102) / 100
betrag += Spiel-Level·800 + 16500 ; Trikot: betrag += Spiel-Level·2000 - 11000
```
Abschluss: nur ohne laufenden Vertrag ("Sie stehen noch unter Vertrag"); Restmonate =
12·Jahre, der Betrag geht in die Werbetabelle (Trikot Platz 0, Bande Platz 1 + i); ein
Bandenangebot erlischt, ein Trikotangebot bleibt stehen. Monatsende: Restmonate - 1, bei 0
sinkt der Betrag auf ein Zehntel. Sponsorennamen liegen nicht im Programm (der Client zeigt
"Sponsor 1..10").

**Saisonende, nur nach einem Aufstieg** (0x0CC00 bis 0x0CCED): ohne Aufstieg springt das
Original über den ganzen Block (0x0D924 -> 0x0CCF1) - die Verträge laufen dann einfach weiter.
Nach einem Aufstieg endet jeder laufende Vertrag (Restmonate auf 0), **der Betrag in der
Werbetabelle bleibt aber stehen**; war ein Vertrag schon abgelaufen (Restmonate 0), sinkt sein
Betrag noch einmal auf ein Zehntel (0x3BA18 teilt den Eintrag durch 10, zusätzlich zum Zehntel
des Monatsablaufs). Die Einnahmen fließen also weiter, und weil alle Plätze frei sind, lassen
sich in der höheren Liga sofort neue, bessere Verträge abschließen. Lief der Trikotvertrag noch,
erklärt das der Hinweiskasten (0x0CC77):

> Ihre Werbepartner erlauben / es, die Verträge jederzeit / zu kündigen. Die Einnahmen /
> bleiben solange erhalten.

Eine eigene Kündigungsfunktion hat das Original **nicht**: die Restmonate werden nur an drei
Stellen geschrieben - Abschluss (0x292AC), Monatsablauf (0x11EC0) und dieses Saisonende
(0x0CC45 Trikot, 0x0CCDE Banden).

## Live-Konferenz und Torszenen (Live-Schleife 0x05404, Chancenhandler 0x1B223, Szenenlader 0x1502C, Wiedergabe 0x0C7C4; server/live.ts, web/scene.ts)

Ablauf im Original: alle Spiele des Tages laufen minutenweise gleichzeitig; zu Beginn jeder
Halbzeit werden die Chancenminuten gewürfelt (0x102BA), in der Chancenminute entscheidet der
Torwürfel (0x1060C) mit den aktuellen Stärken. Ist ein Managerverein beteiligt, zeigt das
Spiel "Chance für ..." und eine Torszene; der Schütze wird sofort gebucht (0x1B223). Ein
Klick auf ein Vereinslogo der Tafeln (0x6414, Rechtecke aus 4cb3:0632/063C: Tafeln bei
(0,0), (161,0), (0,115), (161,115)) unterbricht und öffnet den Kaderbildschirm des
Managers (0x1C4F5); beim Verlassen wird die Stärke mit dem Spielweg neu berechnet
(0x21190). Auswechslungen je Spiel: ein Torwart, zwei Feldspieler (Zähler 4238:5396/5397,
"Keine Auswechslung mehr möglich"); der Eingewechselte bekommt einen Einsatz.

Reihenfolge je Spiel und Minute (0x05404): erst Karten und Verletzungen (0x05FE5), dann die
Chancen dieser Minute (0x1060B), Heim vor Gast. Gibt es glatt Rot oder eine Verletzung - nicht
bei Gelb oder Gelb-Rot -, lost 0x0657F die Chancen des Spiels für den Rest der Halbzeit neu aus:
0x102BA würfelt mit den neuen Stärken die Chancenzahl der ganzen Halbzeit (ohne Minuten), je
Seite wird verrechnet `rest = alt - gespielt + neu'` mit `neu' = neu - alt`, wenn `neu >= alt`,
sonst `neu' = neu` (*Eigenheit*: die geschwächte Seite bekommt so eher mehr Chancen); `alt` ist
die Zahl vom Halbzeitbeginn bzw. der letzten Neuauslosung dieses Managers (4238:21DA),
`gespielt` zählt die Chancen seit Halbzeitbeginn (4238:5710 Heim, 5778 Gast). Die Minuten
werden ab der laufenden Minute bis zum Halbzeitende neu verteilt (0x043FF); die alten
verfallen, und eine neue Chance in der laufenden Minute kommt sofort dran. Trifft es in
derselben Minute mehrere Manager, gilt der letzte in Managerreihenfolge. Im Pokal
(Wettbewerb 10 und darüber, auch Relegation) zieht 0x043FF die Minuten ohne Doppelprüfung.

Vor dem Anpfiff zeigt das Original eine ganze Seite in Schwarz-Rot-Gold (0x31FA): Bildschirm in
Palettenfarbe 11, darauf drei Kästen von x 1 bis 318 - schwarz y 1..79, rot (18) y 80..160, gold
(19) y 161..238 -, und darüber in der großen Schrift 3 mittig zwischen x 0 und 319 mit Grundlinie
y 128 in Weiß die Art des Spieltags (0x32F2), danach 50 Ticks Standzeit. Der Text kommt aus
0x1D866: sind Ligabits gesetzt "Ligaspiel", sonst beim Pokalbit "DFB-Pokal", sonst bei den
Europabits "Europapokal"; das Original spielt die drei nacheinander ab.

Bildschirm: je Managerspiel eine Tafel aus PIC/38.VGA (153×113: punktierter Kopf mit den
Vereinsnamen in Gelb, großen Ziffern aus der Ziffernzeile derselben Grafik ab Zeile 113,
Wappen auf Weiß, unten "Zuschauer" mit roter Zahl und die Liste Gelbe Karten/Rote
Karten/Verletzt/Spieler/Chancen) an den Plätzen (0,0), (161,0), (0,115), (161,115); mit
einem oder zwei Managern bleibt die untere Hälfte schwarz und zeigt "N.Minute", während einer
Szene erscheint dort die Torszene. Die Zuschauerzahl eines Heimspiels wird beim Start der
Konferenz berechnet und bei der Tagesbuchung übernommen. Zur Halbzeit und nach Schluss
erscheinen die Stände der Liga (Optionen "Halbzeitstände"/"Ergebnisse" des Originals).

Umsetzung: sobald alle Manager fertig sind, startet der Server die Konferenz (LiveMatch je
Spiel, Takt BMP_TEMPO_MS je Spielminute, Standard 900 ms) und schickt jeden Stand per SSE;
die Uhr hält während einer Szene, drei Sekunden zur Halbzeit und bei einer Unterbrechung.
Unterbrechen darf jeder gesetzte Manager, fortsetzen der Unterbrecher; in der Pause sind
Aufstellungsänderungen erlaubt (Auswechselgrenzen wie oben, Stärke wird neu berechnet). Nach
der 90. Minute bucht der Server den Tag mit den live gespielten Ergebnissen (Tore und
Chancen sind schon gebucht); Verlängerung und Elfmeterschießen der Pokalspiele werden im
Anschluss sofort berechnet.

Torszenen (Ordner TORE, 94 Dateien, ANZAHL = "MAXSZENE:43|5|2"; die drei Zahlen sind laut
Editor-Handbuch die Zahl der Feldtorszenen, der Elfmeter und der Gag-Szenen, und jede Szene muss
einmal als Tor und einmal als vergebene Chance vorliegen): Kennung "BM-Ed1.3-WK\0",
vier Kopfbytes (Bildnummern für Töne, 0xFF = keiner), Bildzahl - 1, dann je Bild 164 Bytes:
ein Kopfwort (Kameraausschnitt x 0..137 im niedrigen, y 0..16 im hohen Byte) und 27 Sprites
zu drei Wörtern (x, y, Bildnummer), am Ende ein längenpräfixierter Autorname. Sprites
kommen aus 27.VGA (Zellen 12x11, 24 je Zeile, Nummer = Zeile·24 + Spalte; ab Nummer 142
vier Pixel breit ab Spalte 4 der Zelle), Nummern 1000 (linkes Tor, 29.VGA Spalte 0) und 1024 (rechtes Tor, Spalte 24) sind die Tore an
festen Plätzen (0,54) und (296,54), gezeichnet an ihrer Stelle in der Sprite-Reihenfolge; Hintergrund 26.VGA (320x112), Sprites bei y + 35. Der
Bildschirm zeigt den Ausschnitt 182x96 an (69,118). Bei Angriff nach links wird gespiegelt
(0x14A93): x' = 320 - x - 14 (Spieler) bzw. - 6 (Ball), Bildnummern 0..58 <-> 59..117 über
117 - n (Ausnahme 25..32 <-> 84..91 über ± 59), 118..139 über 257 - n, Kamera 137 - x.
Auswahl (0x1502C): Nummer random(2, 43), Endung .T (Tor) oder .V (vorbei); mit 1/15 (Tor)
bzw. 1/25 (vorbei) eine Elfmeterszene (.TE/.VE, Nummer random(2,5)), mit 1/400 die Jubelszene
(.TJ/.VJ). Die Szenen liegen als assets/tore/scenes.json vor (tools: siehe Erzeugung in der
Sitzung), Bildwechsel alle 70 ms.

## Eigene Torszenen (tore/szene.ts, tools/szene.mjs, tools/szene.py; GitLab #6)

Eine Szene ist eine Folge von Bildern zu je einem Kameraausschnitt und höchstens 27 Einträgen
aus x, y und Sprite-Nummer. Bild für Bild zu setzen ist Handarbeit - deshalb gibt es eine
**Beschreibung**, aus der `baueSzene()` die Bilder rechnet. Das ist dasselbe, was der
Amiga-Editor mit seinen Animationsphasen gemacht hat, nur lesbar und versionierbar.

    node tools/szene.mjs pruefen tore-eigen/konter.json
    node tools/szene.mjs bauen   tore-eigen/konter.json     -> assets/eigen/tore/konter.T.json (+ .V)
    python3 tools/szene.py vorschau assets/eigen/tore/konter.T.json bilder/
    python3 tools/szene.py export   assets/eigen/tore/konter.T.json KONTER.T

Die Beschreibung nennt Figuren mit einer **Bahn** aus Abschnitten:

| Abschnitt | Wirkung |
| --- | --- |
| `halt` | stehen bleiben bis Bild `bis` |
| `lauf` | geradlinig nach `nach`; `phasen` sind die Sprite-Nummern der Laufanimation, `takt` die Bilder je Phase (Vorgabe 2) |
| `flug` | Wurfparabel nach `nach` mit Scheitelhöhe `hoehe`; `schatten` setzt zusätzlich einen Schatten auf die Bodenbahn |
| `folgt` | an einer anderen Figur hängen, mit `versatz` |

Dazu die Kamera (`fest` oder `folgt` einer Figur, mit `ab`), bis zu vier Klangbilder und die
beiden Tore (`tore: false` lässt sie weg). Eine `chance`-Angabe leitet die **zweite Fassung**
ab: bis `ab` bleibt alles gleich, danach gelten die dort genannten Bahnen - im Original liegt
jede Szene einmal als Tor (`.T`) und einmal als vergebene Chance (`.V`) vor.

Die Laufanimationen des Originals sind Dreierschleifen; Sprite 3/4/5 und 112/113/114 sind
dieselbe Bewegung in beide Richtungen (die Spiegelregel 117 - n führt sie ineinander über). Der
Ball ist Sprite 142, sein Schatten 145.

Geprüft werden beim Bauen die Grenzen des Formats: höchstens 27 Einträge je Bild (die beiden
Tore zählen mit), 2 bis 256 Bilder, Sprite-Nummern 0 bis 145, x 0..319, y 0..76, Kamera x 0..137
und y 0..16. Beim Ausgeben im Format des Originals werden freie Plätze mit einem Eintrag
unterhalb des Rasens aufgefüllt (y 77), damit sie unsichtbar bleiben. `tools/tore.py` liest die
so geschriebene Datei wieder ein - das Ergebnis stimmt Bild für Bild mit der Vorlage überein.

Als Beispiel liegt `tore-eigen/konter.json` bei: ein Konter über 48 Bilder mit Torfassung und
abgeleiteter Chancenfassung.

### Der Editor im Spielbild (Stufe 2)

Im Untermenü Diskette steht "SZENEN" (nur im Mehrspielerbetrieb, weil der Server speichert).
Der Editor zeigt oben das **ganze Spielfeld** statt des Kameraausschnitts, darunter Zeitleiste
und Schalter:

- **Zeitleiste** mit den Schlüsselbildern der gewählten Figur; ein Klick springt zum Bild.
- **Figur wählen** und ins Feld klicken: das setzt ein Schlüsselbild an dieser Stelle, also
  einen `lauf`-Abschnitt bis zum aktuellen Bild. Was danach kommt, bleibt stehen - dazwischen
  rechnet der Übersetzer.
- **Zwiebelhaut** legt das vorige Bild blass darunter.
- **Abspielen** im Takt des Spiels (70 ms je Bild, dieselbe Konstante wie die Konferenz), Bild
  vor und zurück, Anfang und Ende; am Ende läuft die Szene von vorn los.
- **WIE IM SPIEL** schaltet auf die Wiedergabe der Konferenz um: statt des ganzen Feldes nur der
  Kameraausschnitt (182x96, `Scenes.malen`), dazu die Klänge an den vier Kopfbytes der gebauten
  Szene (digi1..digi4 wie 0x0C7C4). Gesetzt wird in dieser Ansicht nicht - die Koordinaten des
  Ausschnitts stimmen nicht mit denen des Feldes überein.
- **NEU** fängt eine frische Szene an, **SZENE >** holt der Reihe nach die auf dem Server
  abgelegten. Angefangen wird immer mit der Vorlage: vorher lud der Editor die zuletzt abgelegte
  Szene, und solange es nur das Beispiel gab, kam damit jedes Mal "konter".
- **Figur anklicken** wählt sie aus; die gewählte trägt ihren Namen über dem Rahmen. Die
  Hinweiszeile sagt jederzeit, was der nächste Klick tut ("KLICK INS FELD: TORWART STEHT BEI
  BILD 13 DORT").
- AUSSEHEN wechselt das Sprite (mit Vorschau daneben), LÄNGE ändert die Bildzahl, MARKE WEG
  nimmt das Schlüsselbild dieses Bildes zurück, + FIGUR und - FIGUR legen Figuren an und weg.
- **HILFE** legt ein Blatt über den Editor, das den Gedanken dahinter erklärt: man setzt nur
  Schlüsselbilder, den Weg dazwischen rechnet das Spiel. Beim ersten Öffnen einer Sitzung liegt
  es von selbst oben - ohne Erklärung ist der Editor nicht zu erraten.
- **Speichern** legt die Beschreibung in `tore-eigen/` und beide Fassungen in
  `assets/eigen/tore/` ab, schreibt das Verzeichnis fort und lädt den Katalog neu - die Szene
  läuft danach sofort in der Konferenz mit (POST /api/szene).

Der Editor arbeitet immer auf der Beschreibung, nicht auf den fertigen Bildern; gespeichert
wird beides. Eine im Editor gebaute Szene lässt sich also weiter mit der Hand nachbessern und
umgekehrt.

## Neues Spiel (0x08FD8, Stammdaten 0x299DC, Startbildschirm 0x0AD44, Spielerpool 0x3260C, Kaderplatz 0x224A8, Finanzen 0x09623, Transfermarkt 0x245A8; sim/newgame.ts, data/mana.ts)

MANA.DAT: 64 Logo-Bytes ((Byte + 0x30) & 0x7F = Vereinsbyte 33), 600 Bytes Stärke (je Verein 0..199
drei Bytes, die als Kondition und Technik je Linie übernommen werden; Form = random(45,55), bei
Auslandsvereinen ab 65 minus 5; Grundwert 23 = random(45,55)), 320 übersprungene Bytes, dann je
Verein 23 Bytes Name und bei den 64 deutschen Vereinen 20 Spielernamen zu 26 Bytes (2 Torhüter,
5 Abwehr, 8 Mittelfeld, 5 Angriff). Spielerwerte stehen nicht in der Datei, sie werden gewürfelt.

Ablauf: Tabellenreihenfolge 28244 und Plätze = Identität; Historieblock 28435 gelöscht, die
Bilanzen gegen jeden Verein (4 x 640 Bytes) auf 0xFF; Manager Byte 306..310 = 30, Porträt 29 =
Platz + 1; Ligaplätze mischen (0x3AC5); Europapokalteilnehmer und Auslosung der Europapokale.
Im Startbildschirm wählt jeder Manager Name, Porträt (1..4) und Wunschverein aus der Logoleiste,
dazu Spiel-Level (Anzeige 1..4, gespeichert 5 - Anzeige in 34062) und Startjahr; das Standardspiel
speichert 22251 in 34063 und 1992 in 27976 (Saison 1993/94, Kalender 29. Juli 1993).

Spielerpool (0x3260C): Plätze 1..150 mit Gruppen Torhüter 1..19, Abwehr 20..63, Mittelfeld
64..105, Angriff 106..150 (4cb3:07A6). Jeder Platz: Alter random(18,33), t = random(30,89) (unter
45 mit 1/2 neu), Technik = t - random(0,20) + 10, Form = random(45,55), Kondition = t -
random(0,20) + 10, Byte 27 = Mittel, Positionsart random(0,6), Manager 5 (frei). Je Manager
werden die 20 Namen seines Vereins in Listenreihenfolge auf die nächsten freien Gruppenplätze
gesetzt (fehlende Namen aus einem zufälligen Bundesligaverein), Alter random(19,31), Kaderplatz
mit Vertrag 2 Jahre; danach bekommen alle leeren Plätze Namen aus Bundesligavereinen (ohne
Doppelte) und sind vereinslos (0xFF). Positionswert 31: 1..20 = 0, 21..63 = 25 + random(0,16),
64..105 = 50 + random(0,16), 106..150 = 75 + random(0,16). Kaderplatz (0x224A8/0x2277A): erster
freier Platz, Frische random(80,120), Trainingsfaktor random(35,65), Sonderprogramm random(1,13) |
random(1,3) << 4 | random(0,1) << 7, Stärken vom Spieler, Gehalt = Marktwert Variante 1.

Managerschleife: das Original startet jeden Manager in der Oberliga: ist der Wunschverein kein
Oberligist, wird er mit einem zufälligen freien Oberligaplatz random(38,57) getauscht (0x3C24, Name
und Logo wandern mit). Kaderwerte: b = Level/2 + 27, Kondition und Technik random(b, b+5), Form
random(40,60); Gehälter neu; Trainingsbälle 321.. = 5,4,6,5,6 und 326.. = 1,3,3,3; Liga 2;
Eintritt 2·8 - 3·Liga = 10 DM; Stehplätze 4000·(5 - Liga) = 12000, Sitze 3000·(2 - Liga) = 0,
Überdacht 3500·(2 - Liga) = 0, Komfort 390 = 4, 398 = 3; Einsatzregler 305 = 16; Fanwert 50 -
20·Liga = 10; Trainer (0x09623) = L·(random(15,20) + 40) + ((L·(110 - Fans)) & 0xFE)·500 mit
L = 2 - Liga, danach mal random(10·(L+10), 25·(L+4))/100; Fernsehgeld 1000·(30·L + Fans);
Sponsorenangebote; Kontostand 1.500.000 DM (Level 4 gespeichert: 1.900.000), Zuschauerminimum
99999; Bytes 267..304 = 10; Historie 62..261 = 0xFF. Danach Spieltag 1 aller Ligen, DFB-Pokal-
Auslosung mit gesetzten Managervereinen, Transfermarkt (0x245A8: bis zu zwölf Spieler aus zufälligen
Vereinen, Kondition/Technik aus der Vereinsstärke ± random(0,14) - 10, mit 1/5 plus random(12,20)).
Abweichungen: Standardaufstellung (Nummern 1..11 nach Gruppen) wird vergeben, die zehn
KI-Wochenläufe (0x10067) und die Vereinszuordnung der Marktspieler (0x1643B) sind inzwischen umgesetzt (sim/ai.ts, sim/pool.ts); historische
Startjahre (1964/1966 mit Zuschlägen) sind nicht angeboten.

Europapokal im neuen Spiel: die Auslosung erfolgt erst nach dem Tausch der Managervereine in
die Oberliga; die Plätze der Vortabelle gehen an die nachgerückten Vereine, Managervereine
spielen in der ersten Saison nicht in Europa. Fremde Vereine (Index ab 64) haben kein Wappen,
die Tafel zeigt den Pokal des Wettbewerbs (145..147.VGA).

## Training, Trainingslager, Stadion, Bank (Bildschirme 0x139EC, 0x113E5, 0x0602, 0x1291F; sim/training.ts, sim/stadium.ts)

Trainingsbildschirm: Bälle für Kondition, Spiel, Schuss, Taktik (Byte 321..324, zusammen
höchstens 20, 0x22919), Bälle Intensität (325), Bälle Tor, Abwehr, Mittelfeld, Angriff (326..329,
zusammen höchstens 10), linker Regler 0..34 (Byte 319, wirkt als Trainingsintensität und
Jugendarbeit: Jugendkonto 482 += 4·Regler je Monat).

Trainingslager (0x113E5): acht Lager, Namen aus 4cb3:2394, Grundwerte des Preises aus 4cb3:5244
ab Index 5 (5, 6, 7, 10 | 11, 10, 13, 15) und Wirkungsprofil 4cb3:527E. Der Wochenpreis entsteht
beim ersten Öffnen des Bildschirms (0x11477): Grundwert · Kadergröße · 2000, im Original einmal je
Programmlauf mit dem Kader des ziehenden Managers; das Remake rechnet ihn für den, der hinsieht.
Ob ein Lager überhaupt offen hat, steht in 4cb3:0620 (acht Werte, nur im Speicher, nicht im
Spielstand): über 0 heißt geschlossen (Spinnwebe PIC/43.VGA, Klick meldet "... hat nicht
geöffnet..."), der Betrag läuft je Kalendertag um 1 auf 0 zu und wird dort mit umgekehrtem
Vorzeichen auf random(20,70) gesetzt (0x11D2D). Beim Start stehen die vier billigen Lager offen
(-80, -50, -100, -60), die vier teuren nicht (80, 50, 70, 60). Nach einem Lager sperrt Managerbyte
313 den Menüpunkt für random(7,18) Kalendertage (0x11CD1, Spinnwebe über dem Symbol 0x0A1E4,
Countdown 0x11DEE); ein zweiter Versuch meldet "Einmal pro Woche reicht doch...", zu wenig Geld
"Keine finanzielle Möglichkeit gegeben...". Wirkung 0x119CD mit Profil 4cb3:527E (fünf Werte je
Lager) und Matrix 4cb3:52A6 (4×3: 20/20/40, 60/10/20, 20/50/20, 10/40/30): s[k] = Σ
Profil[d]·Matrix[d][k] / 5; je Kaderplatz Frische += random(w/9, w/6) mit w = max(80, -(s0+s1+s2)/3
+ 2·(s0 - s2 + 10) + s1), begrenzt 60..150; je Eigenschaft x = (random(2·Level+87, 2·Level+117) +
s[k] - 100)/10, x += random(0,x) - random(0, 20x/30), Wert += x/4 (höchstens 99); Trainingsfaktor
(14) und Sonderprogramm (20) werden wie beim Kaderplatz neu gewürfelt (0x2277A).

**Abnutzung des Stadionkomforts** (0x0E444 im Tagesblock, GitLab #57): Je Kalendertag und
Manager würfelt das Original `random(0, 442 - 52·Komfort)`; bei 0 und einer Note über 1 fällt die
Komfortnote (Managerfeld 398, Ausbauart 7) um eins (0x0E50D) und der Manager bekommt die Meldung
"In der neuen Komfortbewertung wird ihr Stadion um eine Note schlechter beurteilt." (0x4E68B über
den Meldungshelfer 0x0239E). Je besser das Stadion, desto schneller altert es: Note 3 heißt 1/286
je Tag, Note 6 schon 1/130 - über eine Saison fällt der Komfort also ein- bis zweimal. Die Note
wirkt auf die Zuschauerzahl (0x10BB0), die Monatskosten (3000 DM je Punkt) und den Stadionwert
für die Sponsorenangebote.

**Was der Manager davon sieht** (GitLab #42, am 17.9.2026 in DOSBox nachgesehen): Das Original
zeigt nach dem Klick auf eine Kachel keinen Zahlenbericht, sondern **einen Kasten mit einem Kopf**
in der Bildmitte - PIC/28.VGA (55x56), Rahmen bei (132,78) über 57x58 Punkte (0x119E4 lädt das
Bild, 0x11A1E zeichnet es) - rechnet dahinter und wartet kurz (0x11CFD), bevor der Bildschirm
zurückkommt. Am Spielstand von lhuno gemessen (Fitnesscenter Krone, 20 Spieler): Kondition +1,95,
Technik +1,40, Form +1,50 im Schnitt - das Remake rechnet mit +1,93 / +1,67 / +1,33 dieselbe
Größenordnung. Ein Lager bringt also wirklich nur ein bis zwei Punkte je Eigenschaft.

Darstellung des Trainingslagers: PIC/5.VGA ist ein Bogen aus 2x4 Kacheln zu 130x39 (Balkentafel
und Foto); Kachel i steht bei (Spalte·132 + 4, Zeile·52 + 7), die Spinnwebe bei (Spalte·86 + 52,
Zeile·52 + 9). Unter jeder Kachel stehen in kleiner Schrift die Kennbuchstaben E F P R V bei
x = Rand + 8·k + 8 (Rand 0 bzw. 217) in den Farben 24, 1, 15, 19, 18 und der Name (großgeschrieben
mit 0x3196D: a..z, ä ö ü zu Ä Ö Ü, ß bleibt) mittig zwischen Spalte·86 + 47 und + 141; unterste
Zeile ist Zeile·52 + 51. Anklickbar sind die Fotos (x 52..130 bzw. 137..216, y Zeile·52 + 9..41),
die Tafeln (x 6..44 bzw. 223..261) zeigen nur den Hinweis. Die Hinweiszeile (0x0243F) steht in
großer Schrift mittig zwischen 0 und 266 bei y 225 und lautet entweder der Kennwert
("Erholungswert", "Fitnessausrüstung", "Platz-Qualität", "Raumausstattung", "Verpflegung") oder
"<Lager>, <Preis> DM/Woche.".

Schriften: 0x08341 wählt die Schrift (1 = große, 2 = kleine), 0x074EC setzt Text mittig zwischen
zwei x-Werten (x = x1 + (x2-x1)/2 - Breite/2) mit dem Schatten ein Pixel weiter rechts, 0x07445
setzt ihn linksbündig. Der übergebene y-Wert ist die unterste Zeile; die Schrift beginnt bei
Höhe - 2 darüber. Das Leerzeichen ist in der kleinen Schrift 2 Pixel breit, in der großen 4.

Stadion: Arten 1 Sitzplätze, 2 Stehplätze, 3 überdachte Plätze (je 1000 Plätze: 150000, 100000,
160000 DM), 4 Flutlicht, 5 Anzeigetafel (Stufen IS NICH/KLEIN/MITTEL/GROSS: 380000, 440000 DM je
Punkt), 6 Zustand, 7 Komfort (Stufen bis SEHR GUT: 550000, 650000 DM je Punkt); Felder je Art
Bestand i32 350 + 8(k-1), im Bau 354 + 8(k-1), Restbautage u16 404 + 2k. Höchstgröße: Plätze bis
130000 Gesamtkapazität, Überdachung bis Sitz + Steh - überdacht. Bauzeit (0x0000) in Tagen =
random(80,120)·(7·Basis + Resttage·random(20,80)/100)/100 mit Basis 15,15,20,10,10,8,4;
Fertigstellung täglich (0x20E1) mit Meldung "Der Ausbau ... ist abgeschlossen". Eintrittspreis
(Byte 266 und i16 348) 5..25 DM.

**Am Original nachgemessen** (lhuno, 16.9.2026, neues Spiel; GitLab #21): die Preise stimmen
genau - 150.000 / 100.000 / 160.000 DM je 1000 Plätze, 380.000 Flutlicht, 440.000 Anzeigetafel,
550.000 Zustand, 650.000 Komfort je Punkt. Die gemessenen Bauzeiten liegen alle im Band der
Formel: Komfort eine Stufe 4 Wochen (Band 3,2-4,8), Zustand eine Stufe 8 (6,4-9,6), Anzeigetafel
zwei Stufen 9 (8-12), Flutlicht eine Stufe 10 (8-12), 2000 überdachte Plätze 23 (16-24), 3000
Stehplätze 15 (12-18). Die Menge geht nicht in die Bauzeit ein, nur die Art.

Wer ein Angebot ablehnt, bekommt am selben Tag **keine Baufirma mehr für diese Ausbauart**
(0x7E9 prüft einen Merker je Art, Meldung "Im Moment keine Baufirma aufzutreiben." in einem
roten Kasten). Im Remake steht der Merker als Laufzeitdatum im Raum und verfällt mit dem
Tageswechsel.

Stadionbildschirm (0x0602; packages/web drawStadium): drei Rahmen bei (6,15) 139x82 mit dem
Stadionbild, (150,15) 139x82 für die Angaben und (6,104) 283x82 für die Übersicht; HAUPTMENÜ bei
(268,193): kein beschrifteter Knopf, sondern das Symbol aus PIC/3.VGA (Zeile 5, Spalte 5) mit
"HAUPT MENU" und dem Pfeil darunter, 32x23 bei (277,202), umgeben von einem schwarzen Rand und
zwei dünnen Linienrahmen - genau wie die übrigen Symbole am rechten Rand. Das Stadionbild richtet sich nach der Kapazität (0x16E3): PIC/9.VGA, je eine Nummer
mehr über 14.000, 34.000 und 54.000 Plätzen. Übersicht: neun Zeilen ab y 114 im Abstand 8
(Zeile 0 Gesamtkapazität, 1..8 die Ausbauarten), Bezeichner ab x 9, MOMENTAN ab x 117, NACH
AUSBAU ab x 190; eine Preisspalte gibt es nicht. Fährt die Maus über eine Zeile, steht ihr Name
unten groß im Bild, und der Kasten rechts zeigt Titel (y 22), Trennlinien (24 und 66),
"KOSTET ... DM PRO 1000" bzw. "... DM PRO PUNKT" (73), "MAX. GR|~E: ..." (80), " KOSTEN: ..."
(87) und "IHR KONTOSTAND:..." (94). MAX. GRÖSSE ist der kleinere Wert aus baulicher Grenze und
dem, was der Kontostand hergibt.

Nach dem Anklicken zeigt der Kasten bei Sitz-, Steh- und überdachten Plätzen den Regler bei
(184,27), 70x34: eine Raute mit dem Wert in einem
dunklen Balken. Die obere Hälfte erhöht, die untere senkt - im Original sind das die Pfeile über
und unter dem Betrag; die Menge beginnt bei 0. Beim Eintrittspreis ist der Regler alles, was der
Kasten zeigt (dazu nur "IHR KONTOSTAND:..."), und jeder Klick ändert den Preis sofort um 1 DM.
Bei den Ausbauarten holt ein Rechtsklick in den Kasten die Rückfrage; eine Schaltfläche dafür
gibt es nicht. Die Zeilenangaben in der Routine sind Grundlinien, der Text steht vier Pixel
darüber.

Flutlicht, Anzeigetafel, Zustand und Komfort haben keinen Regler, sondern eine Liste der Stufen
(0x0FDE für Größen, 0x114E für Status): Name bei x 154, Betrag rechtsbündig bis x 268, Zeile di
bei y 7·di + 25 (Größen, di 1..3) bzw. 7·di + 18 (Status, di 2..6). Der Betrag ist
(di - jetzige Stufe)·Preis und steht nur über der jetzigen Stufe. Erreichbare Stufen stehen
hell, alles andere gedämpft; erreichbar ist, was Kontostand und Höchstgrenze zulassen
(0x0F82: min(Höchststufe, jetzige + min(Höchststufe, Kontostand/Preis))). Die Angaben darunter
heißen dann "MAX. STATUS: ..." und "(KOSTEN: ... DM)" statt "MAX. GR|~E: ..." und
" KOSTEN: ... DM.".

Farben des Bildschirms (1.PAL): Überschriften und Angaben #a2a2c3, Tabellentext #8282a2, Spalte
NACH AUSBAU #616182, gedämpfte Stufen #717192, Hintergrund der Kästen #000071. Die Rückfrage (0x0000) füllt den Kasten (151,27) bis (288,95): "AUSBAU UM n AUF " (37),
Menge und Bezeichner (46), "KOSTEN: ... DM" (55), "BAUZEIT: CIRKA" (64), "... WOCHEN" (73,
Tage/7 + 1) sowie "NA KLAR !" (158,81) und "ACH NEE..." (227,81), beide 57 breit und in der
kleinen Schrift. Die Bauzeit würfelt das Original schon vor der Rückfrage; im Remake würfelt sie
der Server, der Kasten nennt deshalb den Mittelwert. Die Statusstufen stehen im
Original ab 1 (1 UNGENUEGEND bis 6 SEHR GUT), die Größen ab 0 (IS NICH, KLEIN, MITTEL, GROSS).
Der Eintrittspreis steht in Byte 266; i16 348 ist eine Kopie, die erst beim Ändern entsteht.

Bank (0x1291F, Kredit 0x122D9): bis zu drei Kredite je Geldgeber; die Grenze zählt die Schulden
beim selben Geldgeber plus die neue Summe, Bank höchstens 4 Mio DM ("Sie können nur maxmimal 4 Mio.
DM Kredit von der Bank aufnehmen.", Schreibfehler im Original), Mitspieler höchstens 1 Mio DM. Beim
Mitspieler prüft das Original zuerst dessen Kontostand ("So viel Geld besitzt <Name> gar nicht..."),
fragt dann Laufzeit (höchstens 24 Monate) und Zinssatz ab; unter 3 % "lächerliche minimale 3
Prozent.", über 13 % "Wegen Wucher werden Sie mit einer Disziplinarstrafe von 1.000.000 DM belegt." –
gefolgt von "War nur ein Scherz... Das war aber trotzdem kein fairer Zug...", der Kredit kommt nicht
zustande. Die Summe wandert vom Konto des Mitspielers auf das eigene.

Bildschirm (alle Maße im Original nachgemessen, Pixeldiff 0): vier Fenster bei (6,15) 139x82,
(150,15) 109x82, (6,104) 139x82 und (150,104) 109x82, Füllung Farbe 7. Links oben das Bankbild
PIC/7.VGA (138x81 nach (7,16)), links unten die Kreditliste mit der Rollspalte aus demselben Bild
(ab x 139, 14x81 nach (131,105)). Rechts stehen die Geldgeber als Symbolknöpfe ab (268,15) im
Abstand 45 – erst alle Mitspieler mit ihrem Bild aus PIC/0.VGA (32x23 ab Spalte Nr.·41 + 5, Zeile
8), zuletzt die Bank mit dem Bild aus 7.VGA ab Spalte 155; der gewählte Knopf steht gedrückt
(25.VGA statt 24.VGA). Zinstafel: "Dauer  Zinssatz" (Schrift 1, Farbe 1) mit Grundlinie y 24 ab
x 160, sechs Zeilen mit Grundlinie y 37 + 11·i in Farbe 2, Laufzeit ab x 160 (zweistellig 157),
Satz ab x 223, Trennstriche (Farbe 6) bei y 39 + 11·i von x 151 bis 258. Kreditliste: Trennstriche
bei y 132 und 159 von x 7 bis 130, je Kredit drei Zeilen der Schrift 2 mit Grundlinie y 112, 139
bzw. 168 und Abstand 8: "<Aufnahmedatum>: <Summe> DM (<Satz>%)", "FÄLLIG AM <Datum>" und "ZINSEN
PRO MONAT: <Summe> DM". Ein Klick auf die Mitte der Rollspalte (x 132..145, y 132..159) zeigt
stattdessen "SCHULDEN HIER" und "ZINSEN HIER" für den gewählten Geldgeber (y 143 und 152), die
Pfeile darüber und darunter tun nichts. Rechts unten stehen mittig zwischen x 151 und 259
"Kontostand:", "Gesamtschulden:" und "Zinsen/Monat:" bei y 114, 141 und 168 mit dem Betrag
12 Pixel darunter; der zentrierte Text (0x6C7:0x87C) setzt den Schatten in dieselbe Zeile bei x+1.
Fährt die Maus über eine Zeile der Zinstafel (x 161..258, y 31..92), steht unten "Kredit zu <Satz>%
aufnehmen." bzw. "Kredit von <Name> aufnehmen."; ein Klick fragt "Wie hoch soll der Kredit sein ?",
beim Mitspieler danach "Laufzeit des Kredites (Mon.) ?" und "Prozentsatz des Kredites ?".

Bankkredit: Laufzeiten 3, 6, 9, 12, 15, 18 Monate mit Zinssatz je
Monat aus den Konfigurationsbytes 35..40 (DGROUP 0x60E, EXE-Vorgabe 7, 6, 5, 4, 3, 2 %); Zins je
Monat = Summe·Satz/100, fällig am Aufnahmetag jedes Monats, Rückzahlung im Fälligkeitsmonat
(sim/finance.ts). Zinstabelle (0x112AA, zu Spielbeginn 0xAD44 und am Monatsende 0x11D0D vor der
Abrechnung; sim/stadium.ts driftInterest): Leitwert (DGROUP 0x630, nur im Speicher, Programmstart 5)
+= random(0, L + 2) + L - 1 mit L = 1 bei Spiel-Level > 2 (sonst 0), begrenzt auf 2..7; dann je
Laufzeit Satz = Leitwert, Leitwert += Schritt (Start 5 - Leitwert, über 1 je Laufzeit um 1 kleiner),
begrenzt auf 2..7: Leitwert 7 ergibt 7/5/3/2/2/2, 5 ergibt 5/5/5/5/5/5, 4 ergibt 4/5/6/7/7/7. Da der
Leitwert nicht gespeichert wird, nimmt das Remake Byte 35 (nach jedem Lauf gleich dem Leitwert).

## Einstellungen (Bildschirm 0x264A8)

Im Original nachgemessen (Pixeldiff 2, das ist der Mauszeiger): Kasten (13,13) 294x169 in
Palettenfarbe 8, Kopfzeile "V2.0 - ENDE:  NIE. (LEVEL n)" in der kleinen Schrift mit Grundlinie
y 23 ab x 16 in Farbe 3, Trennstriche von x 16 bis 304 bei y 17 (Farbe 1) sowie y 98 und y 180
(weiss). Die Ligaköpfe "1.Liga", "2.Liga", "3.Liga" stehen in der grossen Schrift mit Grundlinie
y 29 ab x 125, 184 und 242 in Farbe 1. Die Beschriftungen stehen mittig - links zwischen x 22 und
121 (Halbzeitstände y 46, Ergebnisse 64, Tabelle 83, Torszenen 111, DfB-Pokal 130, Europapokale
148, Nachholspiele 168), rechts zwischen 172 und 237 (Zeitung 111, Blenden 130) - in Weiss mit
schwarzem Schatten in derselben Zeile bei x+1. "Spielgeschwindigkeit" steht mittig zwischen 182
und 300 bei y 150.

Fünfzehn Schalter, ihre Werte im Original in DGROUP 0x5FE ff.: 0..2 Halbzeitstände, Ergebnisse
und Tabelle der 1. Liga, 3..5 der zweiten, 6..8 der dritten, 9 Torszenen, 10 DfB-Pokal,
11 Europapokale, 12 Nachholspiele, 13 Zeitung, 14 Blenden (als einziges aus). Ihre Plätze stehen
in zwei Tabellen (x 4cb3:5454, y 4cb3:5464): x 122 für die erste Spalte, 180 und 238 für die
Ligaspalten zwei und drei bzw. die rechte Spalte, y 35/54/73 oben und 100/119/138/157 unten. AN
sitzt bei (x,y), AUS 26 Punkte weiter rechts; beide sind 24x17 aus PIC/33.VGA - AN hell ab
Spalte 100, AUS hell ab 124, AN gedrückt ab 148, AUS gedrückt ab 172.

Darunter der Geschwindigkeitsregler (0x26376): die Leiste 100x19 aus derselben Grafik bei
(190,155), die Bahn davon x 202..277 wird mit Farbe 5 freigeräumt, der Knopf ist 6x7 bei
(202 + Wert, 161) - Füllung 18, links und oben 17 mit Farbe 16 in der Ecke, rechts und unten 19.
Der Wert steht im Original in DGROUP 0x63A und reicht von 0 bis 75 (Vorgabe 40).

Die Schalter stehen **nicht im Spielstand**: in vierzig .MAN-Dateien gibt es kein Fenster von
fünfzehn Bytes, das nur Nullen und Einsen enthält und dabei mindestens zehn Einsen hat, und
geschrieben wird DGROUP 0x5FE nur vom Einstellungsbildschirm selbst (0xDAB0/0xDAD3) - kein
Ladevorgang fasst den Bereich an. Sie leben also nur im Speicher und stehen nach jedem
Programmstart wieder auf der Vorgabe des EXE-Abbilds (alles an, Blenden aus). Das Remake hält
sie deshalb ebenso im Raumzustand des Servers.

Wirkung der Schalter (aus den Leseorten im Original): am Ende einer Halbzeit entscheidet
Halbzeitstände[Liga] (0x5C93), nach dem Schlusspfiff Ergebnisse[Liga] (0x5CB4), ob die Seite
dieser Liga kommt; Tabelle[Liga] (0x4C75) schaltet die Tabellenseite, DfB-Pokal (0x5D2F) und
Europapokale (0x5D41) die Pokalseiten, Nachholspiele (0x5C1E) die Seite der verlegten Spiele.
Nach jedem Spieltag gleicht 0xDA40 die Schalter noch mit den Ligen ab, die überhaupt spielen.
Die Seite der Halbzeitstände ist nicht nur Anzeige: die Übersicht 0x2B61A rechnet an ihrem Ende
die Spielstärke aller Manager mit Flag 1 neu (0x2C10C), mit neuen Fehlbesetzungswürfen und neuer
Moral, und die Matrix gilt in der zweiten Halbzeit - einmal je angezeigter Liga (GitLab #99).

## Tagesablauf und Züge (0x1D6F6; GitLab #32, #33)

Ein Kalendertag im Original, im Code nachgelesen:

1. **Tagesbeginn** (0x1D714): Datum, tägliche Finanzen für diesen Tag, KI-Schwankung. Dann das
   Kalenderbyte (0x1D73C); **9 zählt wie 0** (0x1D744).
2. **Byte ungleich 0:** automatische Aufstellung aller Manager, dann die **Züge** (Managerschleife
   ab 0x1E0A6). Vor jedem Zug würfelt die Schleife die **Markterneuerung** mit
   Zufall(0, Manager + 3) = 0 (0x1E0E9 -> 0x245A8), danach das Hauptmenü des Managers (0x971F).
   Anschließend die Spiele des Tages.
3. **Byte 0:** keine Aufstellung, **kein Zug**, keine Markterneuerung - weiter bei 0x1D917.
4. **Weiterrechnen:** Saisontag einzeln hochzählen (0x1DA87), für jeden Tag Sondertage und
   tägliche Finanzen (0x11D0D mit Baufortschritt 0x20E1, Lagersperre, Lager-Öffnungszeiten), bis
   der nächste Kalendertag erreicht ist (Saisontag mod 7 = 0 oder 4).
5. **Tagesroutine 0x0DF0D** für den neuen Kalendertag (0x1DBFE): Marktteile (Frische der
   Marktspieler, Angebote), Verletzungen, Vertragsangebote, Training, Aufstellung.
6. Bis Saisontag 322: Kalenderzeiger hochzählen (0x1EB0B) und zurück zu 1. Danach die
   Schlussrunde der Saison, dort mit Zügen auch an Tagen ohne Spiele.

**Folgen:** Tage ohne Spiele sind kein Zug. Die Winterpause (Kalendertage 37 bis 58) läuft in
einem Tageswechsel vom 2.12. bis zum 21.2. durch - am Original gemessen -, ebenso jeder einzelne
spielfreie Tag zwischen zwei Spieltagen. Ein Stand mit Byte 0x80 (Nachholspiele) ist dagegen ein
Zug (TEST3 -> RUN0 hielt am 22.11. an). Die Marktteile laufen einmal je Kalendertag, die
Markterneuerung je Manager nur an Tagen mit Zug.

### Aufrufkarte des Tagesablaufs (GitLab #34)

Jeder Aufruf im Tagesablauf mit seinem Takt, aus dem Disassemblat gelesen. Der Takt ist die
zweite Hälfte der Wahrheit: eine richtig portierte Routine am falschen Takt ergibt ein anderes
Spiel.

| Adresse | Routine | Takt im Original | im Remake |
| --- | --- | --- | --- |
| 0x4290 | Datum aus dem Saisontag | je Kalendertag und je Saisontag | `dateOfSeasonDay` |
| 0x11D0D | tägliche Finanzen (mit Bau 0x20E1, Lagersperre, Lageröffnung) | je Saisontag **je Manager** | Schleife über die Saisontage |
| 0x112AA | Zinstabelle der Bank | in 0x11D0D mit **1/61**, also je Manager und Saisontag | ✔ seit #34 (vorher: am Monatsende) |
| 4cb3:0620 | Öffnungszeiten der Trainingslager | in 0x11D0D, **je Manager** | ✔ seit #34 (vorher: einmal je Saisontag) |
| 0x10067(1) | Schwankung der Vereinsmatrix | **je Kalendertag**, am Tagesbeginn | ✔ seit #35 (vorher: am Monatsende) |
| 0x22030 | automatische Aufstellung | vor den Zügen (Tag mit Zug) und in 0x0DF0D | einmal je Kalendertag |
| 0x3563 | winterliche Spielverlegungen | je Tag mit Spielen, je Liga | `startLive` |
| 0x1DA23 | Rückennummer 0 bei Sperre oder Verletzung | **je Kalendertag**, nach den Spielen | ✔ seit #34 (vorher: nur bei der Verletzung) |
| 0x1CF86 | Sondertage, Weihnachten | je Saisontag | Schleife über die Saisontage |
| 0x0DF0D | Training, Frische, Verletzungen, Vertragsangebote, Marktteile | je Kalendertag, für den **Ankunftstag** | ✔ seit #27 und #33 |
| 0x176F4 | Sponsorenangebote neu | **alle 14 Saisontage**, je Manager | ✔ seit #34 (vorher: nur beim neuen Spiel und am Saisonende) |
| 0x245A8 | Markterneuerung | vor jedem Zug eines Managers mit 1/(Manager + 4) | ✔ seit #33 |
| 0x971F | Hauptmenü (der Zug) | je Manager, nur an Tagen mit Spielen | Zugabschluss je Manager |
| 0x84D7 | Bildschirm beim Managerwechsel | vor jedem Zug und vor den Spielen | Meldungen im Hauptmenü |
| 0x16515, 0x34616, 0x0CB62, 0x18600, 0x3AC5, ... | Bestenliste, Highscore, Saisonende, Auslosung | einmal je Saison | `sim/season.ts` |

Der Block 0x1D9B0..0x1DA17 zeigt während der Winterpause einen eigenen Bildschirm
("WINTERPAUSE", Text im Programm); das Remake hat ihn nicht (GitLab #36).

**Im Remake bis #32/#33:** jeder Kalendertag war ein Zug (die Winterpause 22 leere Züge),
`dailyTransfers` lief in der Schleife über jeden Saisontag (drei- bis viermal je Zug) und die
Markterneuerung je Saisontag. Der Server rechnet jetzt nach `advanceDay` in `nachTageswechsel`
weiter, solange der neue Tag keinen Zug hat, und würfelt die Erneuerung bei Zugbeginn.
Angebote fremder Vereine, die an einem übersprungenen Tag entstehen, können am nächsten
übersprungenen Tag wieder verfallen, bevor jemand sie sieht - wie im Original.

## Saisonwechsel (Tagesablauf ab 0x1E4A0 bis 0x1EA3B; sim/season.ts)

Reihenfolge im Original: Relegation und Auf-/Abstieg (Tausch 0x3C24: Vereins- und
Tabellendatensatz, Spielerzugehörigkeit Byte 36, Managerverein, Historieblöcke 4238:9336/
9D36/A2CA/A4CA), Ligaplätze mischen (0x3AC5: je Liga 55 Zufallstausche mit der
Tabellenreihenfolge 28244), Pokalauslosung erste Runde (0x18B12), Managerereignisse
(0x0CB62: Prämien 800000/1600000 DM Aufstieg, 250000 DM Torschützenkönig, Lizenzentzug,
Jugendspieler, "älter und schwächer", Abgänge bei Vertragsende, Ablösen; Spieler ein
Jahr älter, Vertragsjahre -1), Datum aus Tagindex (0x4290: Saisontag = 7·(k/2) + 4·(k mod 2)
+ 210 Tage im Jahr, Jahr aus 4cb3:07E0), am 28. Juli Tagindex 0. Der Kalender ist über
alle Spielstände hinweg gleich (nur Nachholmarken 0x80 kommen dazu) und liegt als
CALENDAR_TEMPLATE vor. Portiert: Historie, Auf- und Abstieg nach den Tabellen 4cb3:2266 (Abstiegsplätze 3/4/4) und
4cb3:226A (Relegation nur Bundesliga): 17./18. direkt, 16. im Relegationsspiel gegen den
Zweitliga-Dritten (Hin- und Rückspiel an den Kalendertagen 91/92, Ausgang in 34367), 2. Liga zwei auf und vier ab,
Oberliga vier auf; Lizenzentzug bei Kontostand unter -2.000.000 DM (0x1E3DA, Flag 4), Mischen, Tabellen (Ewigkeitspunkte bleiben), Ergebnisse,
Spieltage, Paarungen, Nachholspiele, Kalender, Datum, Alter, Vertragsjahre,
Saisonstatistiken, Europapokalteilnehmer (0x18B12), Ergebnistabelle löschen, Auslosung aller vier
Pokale (0x18600, Abschnitt "Pokale"), Werbeverträge und neue Sponsorenangebote (Abschnitt "Werbung"). Beim Tausch werden auch die Historieblöcke mitgetauscht (28435: je Manager 640 Bytes
Bilanz gegen jeden Verein zu 10 Bytes, ab +2560 21 Bytes je Verein, ab +3988 und +4500
je 8 Bytes je Verein). Beim Tausch werden Pokal-, Europa- und Reihenfolgetabellen mitgeführt (remapCupClubs).

## Hauptmenü und Anzeigen (Bildschirmfotos docs/original/menu-*.png, buero-*, wappen-*, trikots-*, pokal-*, diskette-*; sim/display.ts)

Das Hauptmenü zeigt links Büro/Wappen/Trikots und rechts Pokal/Diskette/Manager; ein Klick
öffnet das Untermenü in den mittleren neun Feldern (leere Felder tragen das Spinnennetz).
Symbole liegen in PIC/3.VGA (6 Spalten × 7 Zeilen, 33×24 Raster).

Meldungen zum Zugbeginn (Verletzungen, Randale, Vertragswünsche) zeigt das Original im Hauptmenü
anstelle der neun Untermenüfelder: drei Kästen bei (57, 112 + 41·i), 187x41, grau (Farbe 4) mit
dunklem Rahmen und hellem Rand oben und links; der dunkle Deckel gehört nur zum ersten Kasten,
die übrigen schließen an den Boden des vorherigen an. Darin bis zu vier Zeilen mittig bei x 151:
das Datum bei y + 4 in Farbe 25, die Meldung ab y + 14 im Abstand 8 in Farbe 24, beide mit
schwarzem Schatten ein Pixel rechts. Rechts daneben bei x 244 drei Knöpfe zu 19x41: Pfeil hoch,
X (schließt die Meldungen) und Pfeil runter. Die Verletzungsmeldung hat drei Zeilen
("Verletzung im Training:", Name, Art in Klammern), das Datum kommt davor.

Maße (am Original vermessen): das Titelbild PIC/4.VGA steht bei (0,-3), die Tafel PIC/23.VGA bei
(0,41). Die Knöpfe zeichnet 0x06D17 als Bild PIC/24.VGA (50x41), der offene Menüpunkt bekommt
statt dessen das eingedrückte PIC/25.VGA; das Symbol liegt im schwarzen Innenfeld (8,8)..(41,32).
Die Außenspalten stehen bei x 5 und 266 mit y 110 + 43·Zeile, die neun Felder des Untermenüs bei
x 82 + 54·Spalte und y 112 + 42·Zeile. Der Tagestermin steht mittig zwischen 74 und 165 (unterste
Zeile 58), der Managername zwischen 62 und 178 (Zeile 98), beide schwarz mit einem Schatten in
Farbe 4 ein Pixel rechts. Im Kalenderblatt stehen Wochentag (Zeile 60), Monat (90) und Jahr (100)
mittig zwischen 237 und 312 in Farbe 4 mit Schatten 7; die Tageszahl steht in der großen Schrift 3
(16 Zeilen) mittig zwischen 243 und 304 (Zeile 79) in Farbe 6 mit Schatten 8. Den Wochentag nimmt
das Original nicht aus dem Kalender, sondern aus dem Saisontag: Index (Saisontag + 6) mod 7.

Schriften: 0x08341 stellt die Schrift ein (1 große, 2 kleine, 3 die 16 Zeilen hohe Zahlenschrift).
Schrift 3 liegt nicht im Ladeprogramm, sondern im entpackten BMMAIN.EXE: Zeigertabelle ab 0x362B4
für 0x20..0x7E, Glyphen bei 0x35AC0 + Zeiger, Datensatz Breitenbyte und 16 Zeilen zu ceil(Breite/8)
Bytes; Zeiger 0x8B2 ist der leere Platzhalter. Großschreiben besorgt 0x3196D (a..z, ä ö ü zu Ä Ö Ü,
ß bleibt).

Tabellenverlauf im oberen Feld (0x09857 bis 0x09F72): nach jedem Spieltag merkt sich das Original
den Tabellenplatz des Managervereins in Managerbyte 267 + Spieltag (geschrieben beim Sortieren der
Tabelle, 0x2DBC5). Gezeichnet wird ein Linienzug in Farbe 11 von (63, Byte 267 + 64) bis
(177, letzter Platz + 65); die Zwischenpunkte liegen 116/(gespielte Spiele - 1) Pixel auseinander
(Zähler mit Fließkomma, Spiele aus Tabellenbytes 30 + 31). Bei höchstens einem Spiel steht statt
dessen ein flacher Strich in Farbe 7 von (63,74) bis (177,74).

| Untermenü | Spalte 1 | Spalte 2 |
|---|---|---|
| Büro | Statistik (Serien, Rekorde, Zuschauer, Finanzen), Ewige Tabelle/Bilanz, Verlauf (Saisons, Gesamtentwicklung) | Stadion, Bank, Werbung |
| Wappen | Tabelle Bundesliga / 2. Liga / Am.-Oberliga | Spiele je Liga (Spieltag mit Platz, Stärke, Ergebnis, Pfeile für andere Spieltage) und Stärken je Liga (Kondition/Technik/Form) |
| Trikots | Mannschaft (Aufstellung), Verträge, Transfermarkt | Training, Trainingslager, Bestenliste (LIGA/SPIELER) |
| Pokal | DFB-Pokal, Landesmeister, Pokalsieger | UEFA-Cup |
| Diskette | Laden, Speichern, Highscore | Optionen, Neu |

Der Manager-Knopf öffnet die Meldungen. Stärketabelle (0x2DCA1): Kasten (61,17) bis (248,195),
Trennstriche bei y 35 und y 178 von x 63 bis 246, Überschrift in großer Schrift mittig zwischen
61 und 248 (unterste Zeile 25, Farbe 1 mit Schatten 7), Kopfzeile und Zeilen in kleiner Schrift
bei x 65 (Platz und Verein) und x 162 (die drei Werte, dazwischen je 12 Leerzeichen); Zeile i
steht bei y = (i + 6)·7, Managervereine in Farbe 11 statt 1. Zahlen füllt der Formatierer
(0x7D31) links mit '^' auf die in 4cb3:079C eingestellte Stellenzahl auf - in der kleinen Schrift
ist '^' ein leeres Zeichen von Ziffernbreite, die Spalten stehen damit bündig. Unter dem Strich
wechselt eine Schaltfläche (133,181) bis (189,192) reihum zwischen GESAMT, ABWEHR, MITTELFELD und
STURM (4cb3:4BB0): GESAMT mittelt die drei Linien der Vereinsmatrix (Bytes 24..26 Kondition,
27..29 Technik, 30..32 Form), die übrigen zeigen nur ihre Linie (Abwehr 0, Mittelfeld 1,
Sturm 2); sortiert wird absteigend nach Kondition + Technik + Form der gewählten Linien, Werte
auf 0..99 begrenzt. Die Anzeige des Originals weicht um ±2 von einem frisch geladenen Spielstand
ab (Wochenschwankung 0x10067 beim Laden).

Schaltflächen (0x31B4D): schwarzes Feld von (x,y) bis (x+56, y+11), heller Rand links (Farbe 1)
und oben (2), dunkler rechts (7) und unten (6); die Beschriftung steht in kleiner Schrift bei
x + 1 + (57 - Breite)/2 und y + 4, gewählt in Farbe 0x12, sonst 1. Die blauen Fenster haben einen
Pixel Rand in den Farben 1 links, 2 oben, 7 rechts und 6 unten und zwei Pixel schwarzen Schatten. Spiele: Paarungen aus dem
Spielplan (fixtures) mit Tabellenplatz und "STÄRKE (Ko+Te+Fo)/3 (Ko,Te,Fo)", Ergebnis aus der
Ergebnistabelle. Bestenliste (0x16515): das Original überträgt zuerst die Ligatore der Managerkader (Kaderplatz
Byte 3) in die Spielerdatensätze (Byte 34) und sortiert dann alle Spieler 1..150 absteigend nach
Toren, bei Gleichstand nach weniger Einsätzen; gezeigt werden Spieler mit mindestens zwei Toren.
LIGA zeigt davon die Spieler der eigenen Liga (Byte 36 Verein) mit mindestens 0,4 Toren je Spiel
(TEST4: Gaber, Schlünz, Breitenreiter, Eckel wie im Original), SPIELER alle. Darstellung:
Kasten (35,8) bis (285,189), Überschrift "Die Besten der Liga" bzw. "... der Spieler" mittig
zwischen 35 und 285 (unterste Zeile 16, Farbe 1 mit Schatten 7), Kopfzeilen bei x 38 und x 210
(Zeile 24), darunter ein Strich bei y 26 von 36 bis 284; Einträge bei y = 34 + 7·i mit den
Spalten 38 (Platz und Name), 114 (Verein), 212 (Tore) und 252 (Tore je Spiel als 10·Tore/Spiele
mit einer Nachkommastelle), Vereine der Manager in Farbe 11. Unten die Schaltflächen LIGA (54,175)
und SPIELER (212,175), die gewählte in Farbe 17, die andere in Farbe 10. Pokal: laufende Runde (Rundenbyte → 32/16/8/4/2/1
Paare = 1. Runde, 2. Runde, Achtelfinale, Viertelfinale, Halbfinale, Finale) mit Ergebnis
(0:0 vor dem Spiel) und im Europapokal dem Hinspiel. Statistik und Ewige Tabelle/Bilanz siehe Abschnitt "Historieblock". Optionen (Diskette):
alle fünfzehn Schalter und die Spielgeschwindigkeit (Millisekunden je Spielminute
2000 - 180·Stufe) gelten für alle Mitspieler und wirken alle: Halbzeitstände, Ergebnisse und
Tabelle je Liga, Torszenen, DfB-Pokal, Europapokale, Nachholspiele und Zeitung schalten die
jeweiligen Seiten der Konferenz (Highscore über die Diskette); "Blenden" schaltet die
Überblendung beim Bildschirmwechsel (`blende()`: das Original blendet über die Palette, im
Browser klart eine schwarze Fläche auf).

## Historieblock und Statistik (28435, 4238:9336; Fortschreibung 0x2D182/0x2DBDF, Anzeige 0x26F88/0x2B31E, Ewige Tabelle 0x27C98, Ewige Bilanz 0x27DC9; sim/history.ts, sim/display.ts)

Der Historieblock (5012 Bytes) enthält: 0..2559 die Bilanz je Manager gegen jeden Verein
([(Manager·64 + Verein)·5 + k]·2, ungerades Byte Heimspiel, gerades Auswärtsspiel, Byte =
eigene Tore·16 + Gegentore, 0xff leer, k = die letzten fünf Spiele); ab 2560 die laufenden
Serien je Verein (21 Bytes: gewonnen, verloren, unentschieden, nicht gewonnen, nicht
verloren, ohne Gegentor, ohne Torerfolg × gesamt/heim/auswärts); ab 3904 die Serienrekorde
je Manager (21 Bytes); ab 3988 die Vereinsrekorde (8 Bytes: höchster Heimsieg, höchste
Heimniederlage, erzielte/kassierte Heimtore, dasselbe auswärts; Byte = Heimtore·16 +
Gasttore, Auswärtseinträge werden als Gast:Heim angezeigt) und ab 4500 die Gegner der
Rekorde. Nach jedem Ligaspiel werden Serien beider Vereine fortgeschrieben (Sieg: gewonnen
und nicht verloren +1, verloren/unentschieden/nicht gewonnen 0; Niederlage und Remis
entsprechend; ohne Gegentor/Torerfolg +1 oder 0), Serienrekorde der Manager als Maximum,
Vereinsrekorde bei neuem Höchstwert (Tore auf 15 begrenzt) mit Gegner, und die Bilanz der
Manager gegen den Gegner. TEST4 stimmt mit dem Bildschirmfoto docs/original/buero-statistik.png
überein (Test history.test.ts).

Statistikbildschirm: Serien "laufend(Rekord)", Tore/Gegentore je Spiel aus dem
Tabellendatensatz, Rekorde, Zuschauer (Manager i32 484 gesamt, Byte 314 Spiele, Rekord 488 mit
Gegner 500, Minuskulisse 492 mit Gegner 504, Balken aus Bytes 330.. in Tausend), benötigter
Schnitt = (12·Ausgaben - 12·Einnahmen)/(Vereine - 1)/Eintrittspreis (0x17555), Finanzen und
die Monatsbilanz aus den Routinen 0x17076/0x17262. Ewige Tabelle: Tabellendatensatz u16 bei 50
(Punkte über alle Saisons), Ewige Bilanz: Manager Bytes 57..61 Titel (Meisterschaften, DFB,
Landesmeister, Pokalsieger, UEFA), u16 420/422 Punkte heim/auswärts, 432/434 Gegenpunkte,
424..430 Tore für/gegen, 440..450 Siege/Niederlagen/Unentschieden je heim/auswärts. Verlauf:
Managerhistorie ab Byte 62 (Rang, Pokalrunde, Liga, Europapokal) mit Rundennamen 0x24C8
(1.Runde, Achtelfinale, Viertelfinale, Halbfinale, Endspiel) und Balkendiagramm.


Verlauf "Erfolge/Gesamtentwicklung" (0x29C30): oben der Kasten (5,8) bis (313,151) mit der
Kopfzeile "Sais. Pl.   Liga       DfB-Pokal       Europapokal" bei x 10 (unterste Zeile 17) in
Farbe 11 und einem Strich bei y 19 von x 5 bis 312; die Saisonzeilen stehen darunter mit der
Jahreszahl bei x 12 und dem Platz bei x 42 (ohne Platz ein "-"). Ohne abgeschlossene Saison steht
statt dessen in kleiner Schrift mittig über die ganze Bildbreite (Zeile 29, Farbe 1 mit Schatten 7)
"NOCH HABEN SIE KEINE HISTORISCH SONDERLICH WICHTIGEN ERFOLGE ERZIELT...". Unten der schwarz
gefüllte Kasten (5,157) bis (263,230) mit der Überschrift "Gesamtentwicklung" mittig zwischen 6
und 262 (Zeile 165) und einem Strich bei y 167.

Ewige Tabelle und Ewige Bilanz (0x27C98): links der Kasten (5,8) 136x223 mit der Überschrift
mittig zwischen 5 und 140 (unterste Zeile 17, Farbe 11), Strich bei y 19, Einträge ab Zeile 27 im
Abstand 7 - Platz und Name bei x 9, die ewigen Punkte (Tabellensatz i32 bei 50, angezeigt modulo
100000) bei x 111, beide links mit '^' aufgefüllt (2 bzw. 4 Stellen). Sortiert wird absteigend
über alle 58 Vereine, angezeigt werden die ersten 23; die Vereine der Manager stehen unabhängig
davon mit ihrem echten Platz darunter, abgetrennt durch sechs Punkte übereinander bei x 13.
Managervereine stehen in Farbe 11, die übrigen in Farbe 1.

Rechts der Kasten (145,8) 169x181: Kränze aus PIC/36.VGA (21x113) bei (155,22) und (281,22), um
den linken je ein Kreis mit Halbmesser 11 um (165, 32 + 23·i) - grün (Farbe 13), solange der Titel
noch erreichbar ist (Meisterschaft: Verein in der Bundesliga; Pokale: Managerbyte 305 + i zwischen
1 und 7), sonst rot (Farbe 18). Dazu je Titel eine Zeile in kleiner Schrift mittig zwischen 176
und 286 (Zeile 30 + 23·i) und darunter der Wert zwischen 176 und 281 (Zeile 38 + 23·i), entweder
"n x" in Farbe 11 oder " KOMMT VIELLEICHT NOCH..." in Farbe 1. Die Bilanz darunter: Kopfzeile bei
x 183 (Zeile 147), Zeilen ab 156 im Abstand 7 mit dem Bezeichner bei x 148; Punkte und Tore als
zwei Zahlen bei x 169 + 48·k (mit Doppelpunkt) und 192 + 48·k, Siege, Niederlagen und
Unentschieden einzeln bei 179 + 48·k, alle auf vier Stellen mit '^' aufgefüllt.

## Karten, Verletzungen und 0:2-Wertung im Spiel (Minutenschleife 0x05FE5, Chancenhandler 0x1B223 ab 0x1BF6D, Spielerwahl 0x04E45, Spielvorbereitung 0x1C632/0x1C5D1; sim/incidents.ts)

Je Spielminute und Managerverein mit x = 40 - Moral (Managerbyte 317, 0..40; die Stärkerechnung setzt sie vor dem Spiel aus Einsatzregler und Stärkeverhältnis, 0x0FFA8) und
L = Level (Spielstand 34062): Rote Karte höchstens einmal je Spiel bei random(0, 70x +
50(L+5)) = 0; Gelbe Karte aus einem Foulbudget von sechs je Spiel bei random(0, 5L + 2x +
37) = 0; Verletzung bei random(0, 55x + 60L + 200) = 0. Spielerwahl 0x04E45: zufälliger
Kaderplatz, nur Starter (Nummer 1..11) ohne Sperre oder Verletzung; mit d = Technik -
Kondition wird der Spieler bei d > 0 angenommen, wenn d > random(0,3), sonst mit 1/11.
Rote Karte: Kaderplatz Byte 0 + 1 (Gelb-Rot: Byte 2 + 1 und Byte 1 - 1), Nummer 0, Flag-Bit 0,
Sperre Byte 13 = random(1,7) Spiele (Gelb-Rot: 1), Bewertung Byte 21 - 10, danach Stärke
neu (0x0F9D2). Gelbe Karte: Byte 1 + 1; die zweite Gelbe im selben Spiel ist Gelb-Rot. Eine
Sperre aus gelben Karten kennt das Original nicht (Byte 1 wird nur angezeigt). Verletzung
wie im Training (0x17B0F): Form - random(12,19), Art random(0,17), Dauer nach Art plus
random(0, Wochen/4 + 1), Flag-Bit 1, Nummer 0. Die Konferenztafel zeigt Gelbe/Rote Karten,
Verletzte und Spieler (11 minus Rote und Verletzte) der eigenen Mannschaft; ohne Konferenz
werden die Ereignisse nach dem Spiel in derselben Häufigkeit gewürfelt.

0:2-Wertung: die Stärkeberechnung 0x0F9D2 setzt Managerbyte 317 = 100, wenn weniger als
acht Spieler eine Nummer 1..11 tragen (Sperre und Verletzung zählen dort nicht); die Spielvorbereitung wertet das Spiel dann 0:2 und zieht
200.000 DM Strafe ab ("Ihr Spiel wird mit 0:2 gewertet. Sie zahlen 200.000 DM Strafe"). In der
Konferenz zählt der Stand beim Anpfiff, Karten und Verletzungen im Spiel lösen keine Wertung
mehr aus. Ausnahme des Originals: ab dem 10. Juni (Monat 5, Tag >= 10, also in der Relegation)
keine Wertung; nicht übernommen, Prüfung im Original in GitLab #90.

## KI-Vereine: Torschützen, Grundzuschlag und Matrixschwankung (0x160A2/0x15F14, 0x2C3FC, 0x10067; sim/ai.ts)

Am Ende jedes Spieltags (0x160A2) werden die Tore der KI-Vereine auf ihre Spieler verteilt
(0x15F14): jeder Spieler des Vereins (Spielerbyte 36) bekommt mit 94 % einen Einsatz (Byte
35); Kandidaten für Tore sind Spieler mit random(5,25) + Positionswert (Byte 31) >
random(10,99). Je Tor mit 4/5 ein Kandidat: mit w/(w+1) (w = Tabelle 4cb3:5331[n] - 1,
ab 3 noch - 1) sofort einer der n Kandidaten (Byte 34 + 1), sonst neuer Versuch, solange
random(0,1) + 2 < n. Vereine der Manager sind ausgenommen (ihre Tore werden live gebucht).
Bei 0 Toren passiert nichts, auch keine Einsätze.

Nach jedem Spiel (0x2D143 -> 0x2C3FC) ändert sich der Grundzuschlag beider Vereine (Byte 23)
um random(0, 2·|Tordifferenz|) in Richtung des Ergebnisses, begrenzt auf 47..53.

An **jedem Kalendertag** (0x1D77C, gleich nach der täglichen Finanzroutine; bis GitLab #35 stand
hier "am Monatsende"), zu Spielbeginn (0x942A)
und zum Saisonbeginn (0x1E665, jeweils mit 10) schwankt die Matrix aller Vereine 0..63: je
Verein a = random(0, 2·mode), k = 1 bei mode 1 und 3 sonst (für alle drei Linien gleich -
0x1007B setzt k ohne Linienzähler; bis GitLab #99 stand hier 2i + 1); je Linie Kondition +=
random(0, 2(k + a)) - k - mode, Technik ebenso (mit mode 1 nur bei random(0,2) = 0), Form +=
random(0,6) - 3 (45..55). Mit mode 1 werden Kondition/Technik auf 1..99 begrenzt; mit mode 10
würfelt nur das a des ersten Vereins mit 10, danach gilt mode 3 (Eigenheit des Originals) und die Bänder der Ligaklasse
(4cb3:05CE: Bundesliga 70..93, 2. Liga 40..74, Oberliga 15..45); dabei wird Bit 7 von Byte 33
gelöscht.

## Spielerpool der KI-Vereine (0x0F2A6, 0x161D8, 0x0F4D7, 0x0F58B, 0x1643B; sim/pool.ts)

Die 150 Spieler des Pools tragen in Byte 36 ihren Verein; Ligabereiche der Vereinsindizes
(DGROUP 0x2272): 0..17, 18..37, 38..57 und 58..255 (Ausland), Ligabasis (DGROUP 0x226E) 0, 18,
38. Die Hilfsroutinen 0x3A01:1AE6 und 0x3A01:1A4C sind 32-Bit-Multiplikation und -Division.

**Sollzahlen (0x161D8)**: je Liga K[l] = Summe der Kaderplätze (Platzbyte 15 <> 0) aller
Manager der Liga, X = Summe aller K. Zuerst driften Kondition (Byte 28) und Technik (Byte 29)
aller 150 Spieler um random(1,7) - 4, begrenzt auf 30..99. Stehen mehr als vier Spieler bei
fremden Vereinen (64..254), gehen überzählige beim Ziehen zurück zu deutschen Vereinen. Dann
wechseln random(5,15) zufällig gezogene Spieler, die nicht bei einem Managerverein stehen, zu
einem Verein passender Stärke (0x16EFF mit Marktwert/10000; das Original übergibt dabei den
Spielerindex als Aufstellungsplatz, der Wert stammt also vom gleichnamigen Kaderplatz).
Danach X += verbliebene Auslandsspieler (0 -> 1) und Soll[l] = (K[l]·100/X)·(150 - X)/100.
Mit TEST4 (Kader 15/12/15 in den Ligen 0/1/1): Soll = 37/69/0 bei tatsächlich 37/61/43
Spielern je Liga.

**Zielverein (0x0F4D7)**: r = random(0,3), mit 1/2 stattdessen random(0,6), davon mit 1/6
random(0,12); Verein = Ligabasis + r, kein Managerverein (sonst neu). Ab Liga 3 random(58,255).
Die Stärkeliste je Liga (0x0F58B: Σ(Ko+Te+Fo der drei Linien)/9, absteigend sortiert) wird
berechnet, aber vom Zielverein nicht benutzt; das Remake lässt sie weg.

**Saisonende (0x0DB40 -> 0x0F2A6, nach den Vertragsdialogen)**: Fehlbestand je Liga = Soll
minus vorhandene Spieler im Ligabereich (nicht unter 0). Kandidaten sind Spieler, die keinem
Manager gehören (Byte 33 > 3). Je Liga mit Fehlbestand werden aus den anderen Ligen in
Ligareihenfolge (0, 1, 2, 3) zufällige Kandidaten zu einem Zielverein der Liga versetzt, bis
der Fehlbestand oder die Quelle erschöpft ist; ein versetzter Spieler wird nicht erneut
gezogen. Zum Schluss läuft 0x161D8 ein zweites Mal (zweite Drift, weitere random(5,15)
Wechsel). Vereinsbyte 36 der Managerspieler bleibt unberührt.

**Spielbeginn (0x942A -> 0x1643B)**: Sollzahlen wie oben; jeder Spieler ohne Verein (Byte 36 =
255), bei einem neuen Spiel (Spielzähler 4238:A7A0 = 0) jeder Spieler außerhalb der
Managervereine, erhält nacheinander für jede Liga mit Restbedarf einen Zielverein - die letzte
Liga mit Bedarf gewinnt, alle drei Zähler sinken (Eigenheit des Originals). So landen die
freien Spieler in den Ligen der Manager.

## Sponsor-Zuschuss und Sondertage (0x0272D, 0x1CF86; sim/finance.ts)

Nach einem Kauf auf dem Transfermarkt (0x22C15 -> 0x0272D) bietet mit random(0,6) = 0 ein
Sponsor einen Zuschuss von random(20,65) % des Kaufpreises, auf 10.000 DM abgerundet
("NEHMEN SIE EINEN SPONSOR-ZUSCHUSS VON … DM AN ?", ABER IMMER! / LIEBER NICHT.); bei Annahme
wird der Betrag dem Konto gutgeschrieben. Im Remake erscheint der Dialog im Marktbildschirm
des Käufers (Zustand market.subsidies, Endpunkt /api/market/subsidy).

Sondertage (Tagesroutine 0x1D6F6, Tabellen 4cb3:53D0 Tag / 53D4 Monat): 24.12., 12.11. und
19.4. rufen 0x1CF86(Index); der Bildschirm erscheint nur mit random(0,3) = 0. Index 0
(Weihnachten): "Frohe Weihnachten !", darin mit random(0,1) <> 0 die Weihnachtspakete:
Grundbetrag b = random(15,85)·10000 DM, angezeigt als "BUNDESLIGA: b DM, 2.LIGA: b/2 DM,
AMATEUR-OBERLIGA: b/3 DM (INCL. MWST.)" mit fünf Zeilen Text ("Ihre Spieler sind überwältigt
und zu Tränen gerührt …"); jeder Manager zahlt b/(Liga+1). Die beiden anderen Tage sind
Scherzbildschirme (Geburtstag eines Programmierers mit Schweigeminute, "Das war keine
Minute ! Schämen Sie Sich !") und werden nicht portiert.

## Automatische Aufstellung (0x22030, Spielerwahl 0x22305, Feldpositionen 0x0F125; sim/lineup.ts)

System je Manager in Save-Offset 51 + 2·Manager (4cb3:079E): 1 = manuell, 2..4 = 1-4-4-2,
1-3-5-2, 1-3-4-3 (Tabelle 4cb3:541C). Gewählt wird es im Kaderbildschirm (0x21776, sofort mit
Aufstellung 0x217B8); eine Handänderung der Nummern setzt es auf manuell (0x20226). Vor dem
Spieltag sichert das Original den Wert nach 079F und setzt 1, nach den Spielen stellt es ihn
wieder her und stellt neu auf (0x1D797); außerdem läuft die Aufstellung nach Verletzungen und
Sperren (0x0DF0D, 0x0F6D8), nach einem Kauf (0x22FBA) und zu Spielbeginn (0x9D46 mit 1-4-4-2).

Ablauf: alle Nummern löschen; je Gruppe (Tor, Abwehr, Mittelfeld, Angriff = Positionswert
Byte 31 / 25) so viele Spieler wie das System vorsieht mit der Spielerwahl: bester noch
nummernloser, einsatzfähiger Spieler (Byte 9 Bits 0/1 = 0; Gesperrte nur mit Flag 4238:513E)
nach Stärke (Ko+Te+Fo)/3 des Kaderplatzes, bei Gleichstand der spätere Platz. Ist die Gruppe
leer, wird in Nachbargruppen weitergesucht (Angriff sowie Mittelfeld bei System < 4 abwärts,
sonst aufwärts, mit Umlauf); Torhüter werden nie im Feld aufgestellt, ohne Torwart darf ein
Feldspieler ins Tor. Nummern 1..11 in Gruppenreihenfolge; Feldposition Byte 26 = Reihe (Tor 7,
Abwehr 6, Mittelfeld 3, Angriff 0) und Byte 25 = x aus Restzahl (Tabelle 4cb3:5428: 0,3,2,1,0,0)
+ 2 je gesetztem Spieler (bei fünf Mittelfeldspielern enger), bei 1-4-4-2 rücken Nummer 2 und 5
eine Reihe vor. Bank: zu Spielbeginn (Kadergröße 4238:56EE = 15) je Gruppe ein Spieler 12..15,
sonst Nummer 12 an den ersten gefundenen (meist der zweite Torwart) und 13 an den stärksten
übrigen Feldspieler. 0x0F125 tauscht danach x-Positionen innerhalb einer Reihe nach der
Seitenvorliebe (Spielerbyte 32); das Remake nutzt die Feldpositionen nicht und lässt das aus.

## Hinweiskasten mit OKAY (0x3174A, aufgerufen als 3091:0E3A; GitLab #31)

Die allgemeine Hinweisroutine des Originals, an 25 Stellen aufgerufen - unter anderem für die
Absagen am Transfermarkt (0x255BE ff.) und die Kalendermeldungen aus 0x143ED. Sie bekommt vier
Zeiger auf Textzeilen. Im Code nachgelesen:

- Fenster über 0x6D17 (Stil 1) bei **(60,110), 185x65**, gefüllt mit **Farbe 16** (#610010),
  Rand wie die blauen Fenster (links 1, oben 2, rechts 7, unten 6, zwei Pixel schwarzer Schatten)
- Schrift 1 (groß); die vier Zeilen **mittig zwischen 60 und 245**, unterste Zeilen **123, 133,
  143 und 153**, **Farbe 10** (#b1a282), ohne Schatten
- Schaltfläche 0x31B4D **OKAY bei (178,160)**, Beschriftung in **Farbe 26** (#826141)
- der Mauszeiger springt auf den Knopf und nach dem Schließen zurück (0x35AC:1971)
- geschlossen wird mit einem Klick auf OKAY oder mit einer Taste

Die Farben stimmen mit einem Bildschirmfoto aus DOSBox überein (Kasten 97,0,16; OKAY 143,107,72).
Das Remake zeichnet ihn in `drawHinweis`; den Mauszeiger kann eine Webseite nicht versetzen.

**Was im Remake durch den Kasten geht** (GitLab #36): Absagen des Servers (vorher Statuszeile),
die Absagen am Transfermarkt, der Erbauer der Torszene (#28), die Kalendermeldungen (#31), der
fällige Kredit und das Vertragsende am Saisonende. Eingaben - Kredit, Gebote, Managername,
Dateiname - laufen im Eingabekasten des Spiels; Browserfenster gibt es keine mehr.

**Alle 26 Aufrufstellen** listet `tools/kasten.py` mit ihren Texten auf. Die Zeigertabellen liegen
in der DGROUP (Segment 0x4CB3, im entpackten Abbild ab 0x4CB30): die Aufrufstelle pusht acht
Wörter, je zwei davon sind ein Fernzeiger (Offset, Segment) auf eine Zeile. Zeilen, die das Spiel
zur Laufzeit zusammensetzt, liegen auf dem Stapel und lassen sich statisch nicht lesen.

| Aufruf | Meldung | im Remake |
| --- | --- | --- |
| 0x05669 | Erbauer der Torszene | ✔ Rechtsklick in der Konferenz (#28) |
| 0x0CC77 | Werbeverträge jederzeit kündbar | ✔ seit #38 (Saisonende des Aufsteigers, wenn der Trikotvertrag noch lief) |
| 0x0D1C1, 0x0D1F5 | Scherz "älter und schwächer" samt Auflösung | offen: Auslöser ist ein Vergleich zweier 32-Bit-Werte (0x0D172) und 1/5 |
| 0x0DC99, 0x0DDA1 | Vertragsende, Ablösesumme | ✔ Hinweiskasten (#36) |
| 0x0DDF0 | "bleibt Ihnen auch die nächste Saison erhalten" | ✔ seit #39 (Verhandlungsrunde im ersten Zug der neuen Saison) |
| 0x12076 | fälliger Kredit | ✔ Hinweiskasten (#36) |
| 0x132AE, 0x13349, 0x134F9, 0x1352D | Geld reicht nicht, Kreditgrenzen, Wucher samt Auflösung | ✔ Absagen des Servers im Kasten |
| 0x1356A | "Mindest-Prozentsatz: minimale 3 Prozent." | ✔ beim Kredit unter dem Mindestzins (#36) |
| 0x144E3, 0x1458E, 0x1474C, 0x14963 | Relegation, Winterpause, gesichert/verspielt | ✔ Kalendermeldungen (#31) |
| 0x1500B, 0x322EE | Diskettenfehler | entfällt |
| 0x1C614 | 0:2-Wertung mit 200.000 DM Strafe | ✔ Hinweiskasten (#36) |
| 0x255BE, 0x25633, 0x25A2B, 0x25FAB, 0x26158 | Leihspieler, nicht verhandlungsbereit, zu lange Laufzeit, "So dumm ist ... nicht", kein Interesse | ✔ Absagen im Kasten |
| 0x33649 | "Kein Bundesliga Manager Prof. Spielstand." | ✔ Fehler beim Hochladen im Kasten |

**Noch offen:** der Bildschirm "WINTERPAUSE" (0x1D9B0..0x1DA17), den das Original beim
Durchlaufen der Pause zeigt, sowie die drei Scherzmeldungen (Tierschutzverein, Club der Sadisten,
"älter und schwächer"), deren Auslöser an Laufzeitwerten hängen.

**Kalendermeldungen:** das Hauptmenü (0x971F) ruft 0x143ED bei 0x9FD5 nur beim ersten Durchlauf
auf (Merker bei bp-0x56), also **einmal je Manager und Zug**, nicht bei jeder Rückkehr aus einem
Untermenü. Über den Kasten laufen die Relegation (0x144E3), die Winterpause (0x1458E) und die
Tabellenmeldungen gesichert/verspielt (0x1474C, 0x14963). Im Remake legt der Server sie je Tag in
`hinweise` ab (nicht in die Meldungsliste, nicht in den Spielstand), der Client zeigt sie im
Hauptmenü, OKAY streicht sie (POST /api/hinweis).

**Schrift:** das Ausrufezeichen der großen Schrift steht nicht in seinem Platz 0x21 - dort liegen
Zeigerdaten, die ein gemustertes Kästchen ergaben -, sondern im Platz von # (0x23), wie schon
" $ % gegenüber ihren Plätzen verschoben sind (tools/fonts.py, SHIFTED).

## Kalendermeldungen und Abschlussbild (0x143ED, 0x1A36D; sim/messages.ts)

Beim Öffnen des Hauptmenüs (0x971F) prüft 0x143ED je Manager: am 13. Juni nach der letzten Runde
die Relegationsmeldung ("Ihre Mannschaft bestreitet das Relegationsspiel. Viel Glück.", Byte 265
= 15 in der Bundesliga bzw. 2 in der 2. Liga) - im Original durch die Konstante 4cb3:226A = 1
abgeschaltet, im Remake nicht umgesetzt; nach dem 13. Juni nichts mehr; am 2. Dezember "Achtung !
Dies ist der letzte Spieltag vor der Winterpause."; dann für die Zielplätze Meisterschaft (1.),
UEFA-Cup-Platz (Bundesliga 5.) bzw. Aufstieg (2. Liga 2., Oberliga 4.) und Klassenerhalt
(Bundesliga 15., sonst 16.): "gesichert", wenn keine Mannschaft unterhalb des Zielplatzes mit
Punkten + 2·(Spieltage - Spiele) die eigenen Punkte erreicht (Punkte = Tabellenbytes 0 + 1,
Spiele = Bytes 30 + 31, 2 Punkte je Sieg aus 4cb3:2271); "verspielt", wenn die Mannschaft auf
dem Zielplatz mehr Punkte hat als der Manager noch erreichen kann. Texte "<Verein> hat die
MEISTERSCHAFT / den UEFA-CUP-PLATZ / den AUFSTIEG / den KLASSENERHALT auf jeden Fall gesichert."
und "<Verein> hat die letzte Chance verspielt, MEISTER zu werden. / den UEFA-CUP zu erreichen. /
AUFZUSTEIGEN. / DIE KLASSE ZU ERHALTEN."; Merkbits in 4238:4BEC (nicht im Spielstand; Remake:
Laufzeitdaten des Servers), Meisterschaft nur in der Bundesliga. Das Remake erzeugt die
Meldungen in der Tagesroutine.

Abschlussbild 0x1A36D (Vereinsname mit Wappen, "gewinnt die Deutsche Meisterschaft" bzw.
"gewinnt den <Pokal>"): am Saisonende für den Managerverein auf Platz 1 der Bundesliga (Titel
Byte 57 + 1, 0x1DE87) und nach einem gewonnenen Endspiel (0x192FC, Titel Byte 58 + Pokal). Das
Remake schickt die Meldung an alle Manager und zählt die Titel; das "ENDE" nach der eingestellten
Saisonzahl entfällt im Mehrspielerbetrieb.

## Spielerinfo und Elfmeter-Schriftzug (0x15346, 0x05186; sim/playerinfo.ts)

Spielerinfo-Tafel (aus Kader, Markt und Vertragsliste): "Info über <Name>", "AHA !", "<NAME> IST
n JAHRE ALT, " + Alterslabel (Tabelle 4cb3:2608 nach (Alter - 18)/5, höchstens 3: GRÜNSCHNABEL,
NOCH GANZ FRISCH, MITTELALTER, FAST AM ENDE); "STATUS: " je nach Nummer und Byte 9: Nummer
1..11 "IST FÜR'S NÄCHSTE SPIEL EINGEPLANT (NR. n)", ab 12 "HÜTET DIE ERSATZBANK", ohne Nummer
"KANN SPIELEN, DARF ABER SCHEINBAR NICHT...", gesperrt "NOCH n SPIELE GESPERRT.", verletzt
"NOCH n SPIELE VERLETZT (<Verletzung 4cb3:23B4>)" (n = Byte 13). Dann TORE:/SPIELE: je LIGA,
DFB-POKAL, EUROPACUP und DATEN: KONDITION, TECHNIK, FORM (Bytes 16..18), ROTE/GELBE/GELB-ROTE
KARTEN (Bytes 0..2), SEITE(N) aus Spielerbyte 32 (bis 1 LINKS, bis 4 MITTE, sonst RECHTS),
GEHALT/M. (i32 bei 40), VERTRAGSDAUER (Byte 11, "JAHR"/"JAHRE"); Balken TENDENZ =
(Byte 14 - 30)·100/38 und ERSCHÖPFUNG = (Byte 19 - 50)·94/100 (je höchstens 94, acht Kästchen
zu 12). Im Remake: Schaltfläche INFO im Kaderbildschirm für den markierten Spieler; die
Europacup-Spalte entfällt (nicht getrennt geführt).

Elfmeter (0x05186): bei einer Elfmeterszene (Szenendateien 2..5 mit Kennung E) steht statt
"n.Minute" der Schriftzug "ELFMETER" unter der Szene; der Ton entfällt.

## Sportzeitung (0x2F243, Platzhalter 0x2ED04/0x2F15A, Gruppenwahl 0x3058F, Artikel 0x2EFAB, Spielbericht 0x305DE; sim/zeitung.ts)

Nach dem Spieltag zeigt das Original je Manager (Option "Zeitung") eine Seite "Sportnachrichten"
(Kopf 44.VGA, Foto PIC 200 + random(0,29)): zweizeilige Schlagzeile, Artikelspalte, darunter
Aufstellung "Verein: Name(Nr), …", "TORE: 1:0 Name (12.MIN), …" (Torschützen nur der eigenen
Mannschaft) sowie "GELBE KARTEN:" / "ROTE KARTEN:" (KEINE). Grundlage ist der Spielbericht
4238:90CA (154 Bytes je Manager), den die Live-Schleife je Chance über 0x305DE füllt: Bytes 4/5
Tore eigen/Gegner, 9 Differenz, 0xA größter Rückstand mit Stand in 0/1, 0xB größte Führung mit
Stand in 2/3, 0x11 Ergebnis (0 Remis, 1 Sieg, 2 Niederlage), 6 Zahl der Chancen, 0x12
ausverkauft, 0x94 Karten, 0x96 Zuschauer (nur Heimspiel), Listen der Tore (0x13 Minute, 0x27
Seite) und Chancen (0x3B, 0x4F), 0xC/0xD bester/schwächster Feldspieler (Kaderbewertung Byte 21
über 25 bzw. unter -15).

Vorlagen: 69 Schlagzeilen (DGROUP 0x4F90, 23 Gruppen 4cb3:9322: 4,2,3,4,2,3,1,2,4,3,2,2,7,4,5,
3,3,3,3,3,2,2,2) und 110 Artikelsätze (DGROUP 0x90D2, Gruppen 4cb3:9350: 8,5,4,8,5,7,4,7,8,10,
4,4,7,6,6,5,1,1,2,7). Platzhalter: %0:%1 Endstand, %2:%3 Stand beim größten Rückstand, %4:%5
Stand bei der größten Führung, %9 Zuschauer, %a eigener Verein, %b Gegner, %c/%d bester/
schwächster Spieler, %t Manager, %e Zeilenumbruch, %x<s><n>A#B#…#% Auswahl mit s = 0 Zufall
random(1,n), 1 Heim (Zuschauer > 0)/Auswärts, 2 Spielklasse 1..4 aus (clamp(Chancen,3,10)-3)/2 +
Sieg + 1, 3 Ergebnis (1 Remis, 2 Sieg, 3 Niederlage), 4 Zufriedenheit (2 bei Sieg oder Remis
gegen den stärkeren Gegner, Stärke 0x04568 über drei Teile ·2/15), 5 Spielverlauf (1 = eigene
Chancen überwiegen, Kurve mit Gewichten 3,4,5,7,9,10,9,7,5,4,3 je Ereignis; bei Gleichstand
Münzwurf). Flags in 4238:579C..57A0.

Schlagzeile: die 23 Gruppen werden der Reihe nach geprüft (Tordifferenz > 3 / = 1 / 1..3 /
< -3 / = -1 / -3..-1 / 0 mit Priorität 5,5,5,5,5,5,2; ausverkauft 3; Rückstand aufgeholt und
gewonnen 5; Führung verspielt und verloren 5; Rückstand ≥ 2 bei Remis 4; Führung ≥ 2 bei Remis 4;
bester Spieler bei Sieg 4; über 7 Chancen und ausgeglichen 3; unter 4 Chancen und ausgeglichen
3; schwächster Spieler bei Niederlage 4; Verlauf eigen und verloren 4; Verlauf Gegner und
gewonnen 4; Verlauf eigen und gewonnen 3; Verlauf Gegner und verloren 3; ausgeglichen und Remis
4; Verlauf Gegner und Remis 3; Verlauf eigen und Remis 3). Die erste passende Gruppe wird genommen,
jede weitere ersetzt die Wahl mit random(1, Priorität) > 1 (0x3058F); innerhalb der Gruppe
zufällig. Die Gruppen 10/11 (Rückstand/Führung bei Remis) sind im Original gegenüber den
Texten vertauscht; das Remake übernimmt das.

Artikel (Liste 4238:2E7E in dieser Reihenfolge): Gruppe 0 immer; 1 (Heim) oder 2 (Auswärts);
mit 1/2 bei über 2 Karten Gruppe 3, bei 0 Karten Gruppe 4; bester Spieler bei Sieg 10;
schwächster bei Niederlage 11; Gruppe 5 (Managerzitat) immer; später Treffer nach der 80.
Minute bei knappem Stand 18; über 3 vergebene eigene Chancen bei Differenz < 2 Gruppe 12; frühe
Chance vor der 8. Minute 16, frühes Tor 17; unter 2 vergebene Chancen bei Sieg 13; Niederlage
19; Sieg 7; ausverkauft 6; Rückstand ohne Niederlage 14; Führung ohne Sieg 15; Verlauf eigen
und Sieg 8; Verlauf Gegner und Niederlage 9. Die Spalte endet, wenn der Platz voll ist.

Die Seite nutzt eine eigene 16-stufige Graupalette (Index bitverkehrt: 0, 130, 65, 195, 32,
162, 97, 227, 16, 146, 81, 211, 48, 178, 113, 243; aus DOSBox-Aufnahmen abgeleitet), mit der
44.VGA und 200..229.VGA in assets/pic konvertiert sind.

Remake: Erzeugung nach jedem Ligaspieltag für beteiligte Manager (Server, Laufzeitdaten
`zeitung`), Anzeige über ZEITUNG in der Ergebnistafel, Option "Zeitung" in den Einstellungen.

## Highscore (0x34616, Punkte 0x34CDA/0x34B14, Datei 0x34474; sim/highscore.ts)

Beim Saisonwechsel (0x1E871) wird je Manager ein Eintrag gebildet und in die Datei HIGH.0x
eingeordnet (Startjahr 1964/1993: HIGH.00, 1966/1995: HIGH.01, sonst HIGH.02; 20 Einträge zu 58
Bytes: 0..25 Managername, 26..48 Vereinsname, 49 Meisterschaften, 50 DFB-Pokale, 51
Europapokale, 52..53 Punkte). Platzierungspunkte (0x34B14): (57 - Tabellenplatz - Ligabasis)/2,
nicht unter 0, + 2·Runde je laufendem Pokal (Runden 1..6); je Saison im Verlauf (Byte 62 + 4i):
(58 - Rang)/2 + 2·(Ligabyte & 7) bzw. +20 bei Bit 7, bei Ligabyte-Bits über 3 zusätzlich 25
(Europabyte Bit 7) oder 3·(Europabyte & 7); Summe durch (Saisons + 1), mal 10. Punkte (0x34CDA)
= Platzierungspunkte + (Marktwerte des Kaders + 135000·Stadionwert - Kredite + Kontostand)/80000
+ 40·Meisterschaften + 20·DFB-Pokale + 60·Europapokale - 500 (+300 beim Spielende), mindestens 1.
Einordnung: gleicher Name und Verein wird bei höheren Punkten ersetzt, sonst Aufnahme, solange
Platz ist oder der letzte Eintrag unterboten wird; Liste absteigend. Anzeige über die Diskette
("PUNKTE:" und "(X/X/X)" = Titel). Das Remake liest und schreibt die Datei im Spielstandordner;
die vorhandene HIGH.02 des Originals wird byteidentisch zurückgeschrieben (Test).

## Auslosung als Zeremonie (0x17C26, Tafel 0x184BA; packages/web drawAuslosung)

Vor der Auslosung fragt das Original "MÖCHTEN SIE DEM UNÜBERTROFFENEM SCHAUSPIEL EINER
DFB-POKAL-AUSLOSUNG BEIWOHNEN ?" (ABER KLAR / KEIN GEDANKE, Parameter 0 = DFB-Pokal, 1 =
Europapokal). Bei "ABER KLAR" lädt 0x17C26 die Tafel PIC/47.VGA (283x204, gezeichnet bei 19,26)
und die Lostrommel und setzt das Flag 4238:57C8; 0x184BA füllt die Tafel und wartet auf "TASTE
DRÜCKEN". Bei "KEIN GEDANKE" zeigt dieselbe Routine die fertige Liste sofort.

Die Wahl ändert den Spielstand nicht: beide Zweige ziehen keine Zufallszahl, die Paarungen
stehen aus der Auslosung (0x18600) schon fest. Tafel: 16 Zeilen im Abstand von 10 Pixeln, erste
Zeile bei y = 12 (Bildschirm 38), Namensfelder links x 18..130 (Bildschirm 37..149) und rechts
x 148..260 (Bildschirm 167..279), je 7 Pixel hoch.

Tafel im Original vermessen: Bild bei (16,7), 16 Zeilen ab y = 19 im Abstand 10, Namensschilder
links x 34 und rechts x 163, je 112 breit und 7 hoch, beige (211,195,178). Der gezogene Verein
steht erst auf der Lostrommel (Text mittig bei y = 193), dann auf der Tafel; hinter dem Namen
steht die Liga in Klammern (1 Bundesliga, 2 Zweite Liga, 3 Am.-Oberliga), die Schriftfarbe folgt
der Liga: schwarz, dunkelblau (48,48,81), braun (130,97,65). Sind alle gezogen, steht auf der
Trommel "TASTE DRÜCKEN". Takt im Original gemessen (DOSBox-X mit 12000 Zyklen): rund 1,6
Sekunden je Name. Ablauf je Name: das Schild steigt rund eine Sekunde lang hinter der Trommel
hervor (Oberkante der Trommel bei y 192, Schild x 104, Breite 112) und wandert dann schräg auf
seinen Platz, mit gleichbleibender Geschwindigkeit von 12 Bildpunkten je Achse und 100 ms. Weite
Wege dauern also länger: zur obersten Zeile rund 1,4 Sekunden, zu den unteren nur 0,3. Die
Trommel selbst bewegt sich nicht. Nach "TASTE DRÜCKEN" folgt die Spielübersicht dieses
Wettbewerbs, danach fragt das Original für die Europapokale erneut (0x17C26 mit 1); die drei
Europapokale laufen dann ohne weitere Abfrage nacheinander.

Danach zeigt 0x198EB die Spielübersicht: je Paarung bildet das Original den Wert
(Ligabit Heim << 3) | Ligabit Gast (Bundesliga 1, Zweite Liga 2, Am.-Oberliga 4, Grenzen aus
4cb3:226F/2270) und ordnet ihn über die Tabellen 4cb3:0654 und 4cb3:065C (je 9, 10/17, 12/33,
18, 34/20, 36) sechs Gruppen in dieser Reihenfolge zu: Bundesliga gegen Bundesliga, gegen Zweite
Liga, gegen Am.-Oberliga, Zweite gegen Zweite, Zweite gegen Am.-Oberliga, Am.-Oberliga gegen
Am.-Oberliga. Jede Gruppe hat eine Überschrift "X GEGEN Y:". Spalten: Heim mittig bei 62, GEGEN
bei 136, Gast bei 201, Ergebnis rechtsbündig bei 282, Zeilen ab y = 9 im Abstand 7,
Überschriften mittig bei 145. Der Titel nennt Runde, Wettbewerb und den Spieltag, ohne Klammern
und durch Leerzeichen getrennt ("1.Runde DfB-Pokal   26.8."); das Datum ist der nächste
Kalendertag mit dem Flag des Wettbewerbs (DFB-Pokal 8, Europapokale 0x70).

Remake: Nach einem neuen Spiel läuft die Zeremonie für alle gemeinsam (Serverzustand
`ceremony`, Endpunkt /api/ceremony). Je Wettbewerb gibt es drei Phasen, und jede geht erst
weiter, wenn alle besetzten Manager bestätigt haben:

1. `vote`: sobald jeder Manager einen Spieler hat, bekommt jeder die Abfrage ABER KLAR /
   KEIN GEDANKE. Wählen alle KEIN GEDANKE, entfallen Tafel und Übersicht dieses Wettbewerbs
   ganz (wie im Original); sonst startet die Tafel bei allen gleichzeitig ab derselben Startzeit.
   Die Abfrage kommt vor jedem der vier Wettbewerbe neu.
2. `draw`: die Tafel mit den fliegenden Namensschildern, am Ende "TASTE DRÜCKEN" je Spieler.
3. `list`: die Spielübersicht dieses Wettbewerbs mit WEITER je Spieler.

Danach folgt der nächste Wettbewerb, und zwar mit einer neuen Abfrage: das Original ruft die
Zeremonie 0x17C26 für jeden Wettbewerb einzeln auf (0x09448 zuerst mit dem DFB-Pokal, dann in
einer Schleife mit den drei Europapokalen) und stellt dort jedes Mal dieselbe Frage; nur die
zweite Zeile wechselt zwischen "SCHAUSPIEL EINER DFB-POKAL-" und "SCHAUSPIEL EINER
EUROPA-POKAL-". "KEIN GEDANKE" überspringt deshalb immer nur diesen einen Wettbewerb samt seiner
Übersichtsseite (0x17DBF setzt 0x57C8 auf 0, 0x18A71 lässt die Übersicht dann aus); beim
nächsten wird wieder gefragt. Es gibt also vier Abfragen. Ist alles bestätigt,
geht es ins Hauptmenü. Außerdem gibt es die
Schaltfläche AUSLOSUNG im Pokalbildschirm, mit der sich jeder die Zeremonie noch einmal ansehen
kann.

## Frisches Spiel: Abgleich mit TEST-LAS

`TEST-LAS.MAN` ist ein im Original angelegtes Spiel (zwei Manager, Amateur-Oberliga, Stufe 3,
Kennung 22251) und dient als Prüfstein für `createGame`. Daraus stammen diese Korrekturen:

* Datum 29.7.**1992** (DGROUP 0x7E0 steht auf 1963 und wird beim Start in der aktuellen Saison
  auf 1992 gesetzt, 0x0BD1B), nicht 1993.
* Manager: Verlauf (Bytes 62..261) und die Zuschauerreihe (267..304) sind leer; Byte 266 = 10,
  Byte 305 = 16, Byte 306 = 1 (erste Runde DFB-Pokal), die Europapokale 307..309 stehen auf 0,
  nicht auf 30 (30 heißt "ausgeschieden" und entsteht erst im Spiel).
* Unbesetzte Managerplätze tragen Porträt m+1 und Verein 100.
* Werbeblock wie oben: 50.000 / 6 x 6.000 / Fernsehgeld / 5.000.
* Der Spielverlauf (0x6F13, 2560 Bytes) ist mit 0xFF gefüllt, der Rest mit 0.

## Nach Halbzeit und Schlusspfiff

Zur Halbzeit zeigt das Original je Liga eine ganze Seite mit Paarung, Ergebnis und je Verein
einer Zeile "n. PLATZ, ST[RKE t (ko,te,fo)" (t ist das Mittel der drei Werte). Eintrag i steht
mit der Paarung bei y 3 + 17·i und den Angaben bei y 12 + 17·i, Heimname ab x 3, Gastname ab
x 133, Ergebnis rechtsbündig bis x 305, die Angaben rechtsbündig bis x 123 bzw. x 266. Weiter
geht es mit dem Symbol WEITER (PIC/3.VGA Zeile 6, Spalte 0) unten rechts.

Nach dem Schlusspfiff kommen erst die Übersichten aller Ligen und danach deren Tabellen. Maße der
Tabelle (10.9.2026 vermessen): Panel ab y 7, Titel "Tabelle GESAMT   n.SPIELTAG" bei y 9 (heller
Text mit Schatten #303051 einen Pixel darunter), Spaltenkopf bei y 18, Trennlinie bei y 25,
Zeilen ab y 28 im Abstand 7, Trennlinie bei y 169, die Knöpfe HEIM/GESAMT/AUSW[RTS bei y 175 an
x 31, 133 und 235 (je 55 breit, 13 hoch, kleine Schrift, der gewählte in Rot #920010), darunter
die Beschriftung "Tabelle Bundesliga" bei y 212 und rechts das Symbol WEITER. Aller Text ist
#a2a2c3. Die Reihenfolge der Gesamttabelle steht im Spielstand (Standing-Byte 46) und wird nach
jedem Spieltag fortgeschrieben; sie darf nicht neu sortiert werden, weil gleichauf liegende
Vereine sonst anders stehen als im Original (CLAUDE.MAN, 1. Spieltag: Stuttgart, Köln,
Frankfurt, Rostock alle 2:0 Punkte und 2:0 Tore). Heim- und Auswärtstabelle rechnet das
Original eigens; das Remake sortiert dort nach Punkten, Tordifferenz, Toren und zuletzt nach
dem Tabellenplatz. Der Platz bekommt einen Kasten bei x 9, 11 breit und 8 hoch, in drei Farben: helles Grün
(#71a241) für den Meister bzw. die direkten Aufsteiger, Oliv (#516110) für die weiteren Chancen
und Rot (#920010) für die Abstiegsplätze. Bundesliga 1 hell, 2..5 oliv (Europa), 16..18 rot
(16. mit Relegation); 2. Liga 1..2 hell, 3 oliv (Relegation), 17..20 rot; Oberliga 1..4 hell,
keine roten.

Zum Schluss folgen nach den Tabellen noch die Zeitungen, eine je Manager in der Reihenfolge der
Managerplätze.

Im Remake wartet der Server an beiden Stellen, bis alle besetzten Manager bestätigt haben
(`pausedBy` = HALBZEIT bzw. SCHLUSS). Der Tag wird beim Schlusspfiff sofort gebucht, damit
Tabellen und Zeitungen schon den neuen Stand zeigen; die Konferenz bleibt danach nur noch als
Anzeige stehen, bis alle die Seiten durchgeklickt haben.

## Pokaltag ohne eigenes Spiel

Die Spielminuten laufen im Original nur, wenn ein Mensch an diesem Tag selbst spielt. Sonst
steht sofort der Halbzeitstand da und nach WEITER der Endstand. Angezeigt wird je Wettbewerb
eine Seite (10.9.2026 vermessen): Kasten (4,33) bis (315,162), Titel bei y 36 mit Runde und
Wettbewerb mittig bei x 123 und der Minute mittig bei x 265 in #d3c3b2, Trennlinie bei y 44,
16 Zeilen ab y 48 im Abstand 7. Je Zeile Heim mittig bei x 65, "GEGEN" bei x 140, Gast bei
x 205, danach die beiden Spielstände bei x 258 und x 294 - erst das Hin-, dann das Rückspiel.
Der Wettbewerb heißt hier kurz "DfB-Pokal", "Pokal der Landesmeister", "Pokal der Pokalsieger"
bzw. "UEFA-Pokal" (DGROUP 0x24DC), nicht mit dem Zusatz "Europapokal".

Von der Übersicht nach 90 Minuten (bzw. nach der Verlängerung) geht es direkt ins Hauptmenü.
Eine Liste aller Spiele des Tages, wie sie das Remake zwischendurch zeigte, gibt es im Original
nicht.

## Konferenz: Fortschritt der Halbzeiten

Links und rechts neben der Spielminute steht je ein Balken für die erste und die zweite
Halbzeit: links bei x 32, 92 breit, rechts bei x 192, 94 breit, beide 4 Pixel hoch und vier
Pixel unter dem Kopf der Minutenzeile. Oben und links ist der Rand hell (#a2a2c3), unten und
rechts dunkel (#303051), der leere Teil #616182. Der gefüllte Teil ist in der oberen Innenzeile
gelb (#f3f300) und in der unteren weiß (#f3f3f3). Im Code (0x5186, 0x5B16): je Minute setzt das
Original eine 2 Pixel breite Marke, links ab x 36 nach rechts, **rechts ab x 285 nach links** -
0x55BD kehrt die Richtung je Hälfte um, die Startpunkte stehen in DGROUP 0x8A. Zu Beginn jeder
Hälfte leert 0x4EEF beide Balken und zeichnet die abgeschlossene linke Hälfte nach: in der
zweiten Halbzeit voll, ab der 106. Minute bis x 64. Die Verlängerung läuft als zwei weitere
Hälften derselben Live-Schleife (Aufrufe bei 0x4B0E mit 91..105 und 0x4B31 mit 106..120) und
füllt je Balken also nur 30 Pixel. Eine Übersichtsseite gibt es nur am Ende der Minuten 45
und 90 (0x5C7E, 0x5C9F), nicht nach 105; nach 120 folgt die Pokalübersicht (0x198EB).

## Konferenztafel: Zuschauerzahl

Die Zahl steht im schwarzen Feld der Tafel ((6,93) bis (48,100) in PIC/38.VGA). Im Original ist
sie bei ausverkauftem Haus rot (#920010), sonst hell (#a2a2c3) - im Vergleichsbild vom
10.9.2026 stand bei Hannover 96 die volle Kulisse von 12.000 in Rot, bei Fortuna Düsseldorf
7.684 in Hell. Ausverkauft heißt: Zuschauer erreichen Sitz- plus Stehplätze.

Ein Rechtsklick während der Konferenz zeigt im Original "Der Erbauer der letzten gespielten
Torszene war: ..." (0x562A): Maustaste 3 und ein nicht leerer Urheber im Puffer 4cb3:4BD8, den
der Szenenlader füllt, dann der Hinweiskasten 0x3174A mit den drei Zeilen aus dem Programm und dem
Namen als vierter Zeile. Vor der ersten Szene passiert nichts. Die Urheber stehen im
Szenenkatalog (60 Szenen von JÜRGEN KRAHE, 28 von M.BERGMANN, einzelne von WERNER KRAHE,
W.+J.KRAHE und FORD PREFECT); eigene Szenen tragen den Namen aus dem Editor. Im Remake seit
GitLab #28 (`onRightClick`, Texte `live.erbauer`); die Konferenz läuft dabei für die anderen weiter.

## Kaderbildschirm "Ihre Mannschaft"

Die Liste steht in der gespeicherten Reihenfolge der Kaderplätze, nicht nach Rückennummern
sortiert (mit CLAUDE.MAN Zeile für Zeile geprüft): Torhüter, Abwehr, Mittelfeld, Angriff, und
innerhalb davon so, wie die Plätze belegt sind. Spieler ohne Nummer stehen deshalb mitten
zwischen den Nummerierten.

Maße (am Original mit und ohne eingeblendetes Spielfeld nachgemessen, Pixeldiff 0): Kasten
(2,7) 239x182, Überschrift Grundlinie y 10 in Palettenfarbe 11 mit Schatten in Farbe 7 bei x+1,
Kopfzeile y 20 in Farbe 11 ohne Schatten, Trennstriche y 26 und y 176 von x 6 bis 236, zwanzig
Zeilen ab y 30 im Abstand 6, ebenfalls ohne Schatten. Spalten: NR rechtsbündig 16 (Kopf ab 6),
ART 17, NAME 35, SP rechtsbündig 102 (Kopf ab 94), die drei Stärken rechtsbündig 116, 128 und
140 (Kopf "STÄRKEN" ab 107), TO rechtsbündig 152 (Kopf 143), GK 165 (155), RK 177 (167), STATUS
ab 182 (180) und TD ab 222 (219). Die Zeilenfarbe richtet sich nach dem Mannschaftsteil und wird
nach hinten heller: Tor #714110, Abwehr #826141, Mittelfeld #928251, Angriff #b2a271. Die Nummer
eines Ersatzspielers (12..15) steht gedämpft in #616182, VERLETZT/GESPERRT in #b20020. Die
Tendenz TD kommt aus Kaderbyte 14 (0x1FB33): (Wert - 30) / 13 wählt aus "-", "O", "+"; über
Kaderbyte 19 = 130 steht sie rot. Unter dem zweiten Strich steht nichts, solange kein Spieler
gewählt ist.

Rechts stehen fünf Felder: oben der Regler EINSATZ (Grafik PIC/37.VGA, oberer Teil, 50x31 bei
(267,5), darüber der weiße Balken bei (275,25), 2 Zeilen hoch und Byte 305 + 1 breit), darunter
vier Symbole in Rahmen ab y 44 im Abstand 45 (die Rahmenbilder also bei (268, 41 + 45i), die
schwarzen Innenfelder bei y 49, 94, 139 und 184, x 276). Das Symbol des gezeigten Bildschirms
steht gedrückt (25.VGA statt 24.VGA) - in der Kaderliste ist das immer das oberste. Von oben: das Symbol mit dem Fragezeichen zurück zur
Kaderliste, das Spielfeld für die Taktik, die Vertragsakte für die Ansicht mit Vertragsdauer und
Gehalt und zuletzt das Hauptmenü. Die Vertragsansicht bleibt im selben Untermenü, nur die
Tabelle wechselt: ART (x 6), NAME (24), SP (rechtsbündig 85), ST (99), TO (111), STATUS (114),
TD (154), V.DAUER (167) und GEHALT (rechtsbündig 239); die Kopfzeile steht bei 6, 24, 77, 90,
103, 115, 154, 164 und 201. ST ist das Mittel aus Kondition, Technik und Form. Farben, Schatten
und Zeilenraster sind dieselben wie in der Kaderliste, und das Symbol der Vertragsakte steht
dabei gedrückt (im Original nachgemessen, Pixeldiff 0).

Ein Klick auf einen Spieler öffnet in dieser Ansicht nicht die Spielerinfo, sondern die
Vertragsverlängerung: unter der Liste steht "NAME: ... (n JAHRE) (Fuß)", darunter ein Kasten von
(4,197) bis (250,232) mit Name, Alter und Ligaspielen (y 203), Trennlinie, "VERTRAGSDAUER (IN
SAISONS)" (213) und "GEHALT PRO MONAT (IN DM)" (221) mit den Werten hinter einem Doppelpunkt bei
x 130. Rechts die Schaltflächen NEUER VERTRAG (184,202) in Rot und ABBRUCH (184,216), je 62x13.
Das Angebot prüft 0x249E0 (sim/contracts.ts contractCheck); lehnt der Spieler ab, bekommt er
Byte 24 = random(10,18). Aus dem Hauptmenü führt die Vertragsakte direkt in diese Ansicht. Ist
das Spielfeld eingeblendet, verdeckt es die unteren drei Symbole bis auf ihre beiden rechten
Spalten; gezeichnet werden sie trotzdem.

Spielfeld (Taktik): Kasten (181,86) 133x133, darin das Feldbild 120x120 aus PIC/6.VGA bei
(188,93). Die Spielermarken 13x13 (6.VGA ab (0,121)) stehen im Raster (194 + 16·Spalte,
99 + 14·Reihe), die Rückennummer mittig einen Punkt rechts der Markenmitte in Farbe 11 ohne
Schatten. Darunter die drei Systeme als Symbolknöpfe: Rahmen bei (4 + 60i, 192), Symbol 32x23
aus 6.VGA (Spalte 121, Zeile 24i) bei (13 + 60i, 201); das eingestellte System steht gedrückt.
Einen Knopf für die Systemwahl gibt es hier nicht - die Systeme stehen als Symbole unter dem
Spielfeld. Der Einsatz steht im Managerbyte 305 und reicht von 0 bis 34 (Vorgabe 16); bestimmt
durch den Vergleich von CLAUDE.MAN und EINSATY.MAN, in dem nur dieses Byte von 16 auf 34
wechselte. Die Simulation nutzt den Wert bereits: höherer Einsatz heißt mehr Stärke, aber auch
mehr Karten und Verletzungen (sim/incidents.ts: x = 40 - Byte 317, und Byte 317 kommt vor dem Spiel aus Byte 305 plus einem Zuschlag aus Technik minus Kondition).

Das Symbol blendet das Spielfeld ein (PIC/6.VGA): Feld 118x120 bei (189,94), die drei
Systemsymbole 32x23 (im Bild bei y 0, 24 und 48) unten links in Rahmen von 48x36 bei
(5 + 60·i, 193), das schwarze Innenfeld 34x25 bei (12 + 60·i, 199). Die Spielermarke ist 13x13 ab
(0,121) im Bild und hat Schwarz als Maskenfarbe - ohne Maske steht ein schwarzer Kasten um die
Nummer. Solange das Feld zu sehen ist, endet die
Kaderliste höher und rechts unten bleibt kein Platz für das Hauptmenü.

In der Liste bleibt bei Spielern ohne Nummer das Feld NR leer und der Status ebenfalls; RESERVE
steht nur bei den Ersatzleuten mit den Nummern 12 bis 15. Die Bank ist immer vier Mann stark,
auch wenn die Aufstellung im laufenden Spiel neu gezogen wird (CLAUDE.MAN nach dem 1. Spieltag).

Die Position eines Spielers steht in den Kaderbytes 25 (Spalte 0..6) und 26 (Reihe 0..7); Reihe
0 liegt vorn beim gegnerischen Tor, Reihe 7 am eigenen. Die Plätze für 1-4-4-2 stammen aus einem
frischen Spiel des Originals: Torhüter (3,7), Abwehr (5,5) (1,5) (4,6) (2,6), Mittelfeld (6,3)
(2,3) (0,3) (4,3), Angriff (4,0) (2,0). Welcher Spieler welchen Platz bekommt, richtet sich im
Original nach seiner Seitenvorliebe - bei zwei Managern desselben Spielstands sind die Plätze
dieselben, nur anders verteilt. Für 1-3-5-2 (CLAUDE3.MAN, Manager 0): Torhüter (3,7), Abwehr (3,6) (5,6) (1,6), Mittelfeld
(3,3) (4,3) (0,3) (6,3) (2,3), Angriff (4,0) (2,0). Für 1-3-4-3 (derselbe Stand, Manager 1):
Torhüter (3,7), Abwehr (5,6) (3,6) (1,6), Mittelfeld (2,3) (4,3) (6,3) (0,3), Angriff (5,0)
(1,0) (3,0). Die Marke sitzt bei
(189 + 19 + 14·Spalte, 94 + 12 + 14·Reihe). Bestimmt durch den Vergleich zweier Spielstände, in
denen nur die Nummer 5 nach vorn links versetzt wurde: Kaderplatz 5, Byte 25 von 2 auf 0 und
Byte 26 von 6 auf 0. Ein Klick wählt einen Spieler, der zweite setzt ihn auf das Feld; steht
dort schon jemand, tauschen die beiden.

Fährt der Zeiger über eine Spielernummer, steht der Spieler gelb in der Liste (Balken #f3f300,
Schrift #414161 und ohne Schatten) und darunter
seine Angaben (0x21567 mit 0x04D22): "ST[RKE:36, 25 JAHRE (L+R)" - Stärke ist das Mittel aus
Kondition, Technik und Form, das Alter kommt aus Spielerbyte 26 und der Fuß aus Byte 32: unter 5
heißt links, über 1 rechts, dazwischen beides. Unter dem Zeiger steht außerdem ein leerer Ring - die fünfte Marke im Bild (x 52) - auf dem
Feld, das der Zeiger gerade trifft; er wird nach den Spielermarken gezeichnet und bleibt
deshalb auch über einer Nummer sichtbar. Der große Kreis in der Mitte ist dagegen der Anstoßkreis der
Grafik.

## Kalendertage

Der Kalendertag k liegt auf dem Saisontag (7·k + 1)/2 ab dem 29. Juli: k 0 = 29.7., 1 = 2.8.,
2 = 5.8., 3 = 9.8., 4 = 12.8. und so fort. Zwischen zwei Spieltagen liegt also meist ein
spielfreier Tag; im Spielstand CLAUDE3.MAN ist der 9.8. so einer (Flag 0), der 12.8. trägt den
3. Spieltag.

## Kalenderblatt: Ereignis des Tages

Das Tagesflag (34227 + Zeiger 34226) hat Bit 0..2 für die drei Ligen, Bit 3 für den DFB-Pokal
und Bit 4..6 für die drei Europapokale. Ein Pokaltag zählt aber nur, wenn der Manager dort noch
dabei ist: die Managerbytes 306..309 halten je Wettbewerb die Runde (1..7), 0 heißt "nicht
dabei", 30 "ausgeschieden". Ein Verein der Amateur-Oberliga sieht am Europapokaltag deshalb
"Spielfrei" - im Spielstand CLAUDE.MAN ist der 2.8.1992 ein solcher Tag (Flag 0x70).

## Speichern

Im Original ist nach dem Speichern Schluss: der Zug lässt sich danach nicht fortsetzen, das
Kalenderblatt nimmt keinen Klick mehr an, man muss den Stand neu laden. Das Remake macht das
nicht nach - dort ist Speichern nur eine Aufnahme des Serverstands, gespielt wird weiter.

## Werbebildschirm (0x28ED8; packages/web drawWerbung)

Der Bildschirm lädt drei Bilder (Lader 0x076B:0356 mit der Nummer als erstem Argument):
PIC/31.VGA (Pfeile, OK und NEIN), PIC/32.VGA (zehn Sponsorenlogos) und PIC/46.CP (Hintergrund
mit Foto, Beschriftungen und den schwarzen Wertefeldern).

Sponsorenlogos (PIC/32.VGA, 198x101): groß 38x30, Spaltenbreite 39, Sponsor 0..4 bei y 1,
5..9 bei y 34 (Blitter 0x2877A); klein 26x16, Spaltenbreite 28, Reihen bei y 67 und y 85
(0x287DD).

Maße aus dem Original:

* Bandenfeld i (0x28CE6/0x28D40): das Logo des Sponsors steht 38x30 bei (52·i + 8, 19). Ohne
  Vertrag füllt eine Fläche in Farbe 9 den Kasten (52·i + 8, 19) bis (52·i + 46, 49).
* Auswahlrand (0x286D4): das Original zeichnet nur die untere und die rechte Kante nach, also
  y = 50 von x = 52·i + 5 bis 52·i + 54 und x = 52·i + 54 von y = 19 bis 50. Farbe 29 für das
  gewählte Feld, sonst 28.
* Foto: Rahmen (5,59) bis (110,229) in denselben Farben. Der Trikotsponsor sitzt als kleines
  Logo 26x16 bei (51,110) auf dem Trikot des Spielers und wird nur bei laufendem Vertrag
  gezeichnet.
* Vertragskasten: schwarzes Feld (217,60) bis (313,90) (0x28B0F). Darin das Logo 38x30 bei
  (127,67), die Zeile "VERTRAG: ..." bei y 62 und der Betrag bei y 74, jeweils mittig zwischen
  x 217 und x 313 (0x28841).
* Pfeile 30x23 aus PIC/31.VGA (0,0) und (0,23) bei (181,60) und (181,84); OK und NEIN 48x16 aus
  (0,47) und (0,63) bei (217,91) und (265,91). Ohne Angebot nimmt das Original die leeren
  Schaltflächen bei x 96.
* Wertefelder für Trikotwerbung (y 128), Bandenwerbung (142), TV-Übertragung (156),
  Werbeausgaben (185) und Summe (210), jeweils rechtsbündig bis x 308.

Texte (0x28841): ein laufender Vertrag steht in Monaten ("VERTRAG: 36 MONATE"), ein Angebot in
Jahren ("VERTRAG: 3 JAHRE"), bei 0 steht dort "K}NDBAR". Ohne Angebot steht "KEIN INTERESSE..."
bei y 78. Nach dem Abschluss zeichnet das Original nur die Felder und die Einnahmen neu, der
Kasten behält bis zur nächsten Auswahl den Text des Angebots - deshalb steht dort direkt nach
der Unterschrift noch die Jahresform.

Bedienung wie im Original: ein Klick auf das Foto wählt den Trikotsponsor, ein Klick auf ein
Bandenfeld den jeweiligen Platz. Ein Klick auf den Logokasten öffnet die Sponsorenansicht; die
beiden Pfeile daneben blättern durch alle zehn Sponsoren. OK schließt den Vertrag ab, NEIN
schließt die Ansicht.

Einnahmen (0x28C98): Trikotwerbung ist der erste Eintrag des Werbeblocks, Bandenwerbung die
Summe der Einträge 1..6, TV-Übertragung Eintrag 7, Werbeausgaben Eintrag 8; die Summe ist
Trikot + Banden + TV - Ausgaben.

Der Werbeblock beginnt nicht bei 0: die Werte stehen als vorbelegte Daten im Datensegment von
BMMAIN.EXE (4cb3:066C) und lauten je Manager Trikot 50.000, jede der sechs Banden 6.000,
Fernsehgeld 0 und Werbeausgaben 5.000. Deshalb hat ein Verein ohne jeden Bandenvertrag
36.000 DM Bandeneinnahmen, und nach dem ersten Vertrag stehen dort fünf mal 6.000 plus der
neue Betrag. Ein neues Spiel überschreibt davon nur das Fernsehgeld (0x09623). Beim Start in
den Jahren 1964 bzw. 1993 setzt das Original zusätzlich Trikot 180.000, jede Bande 45.000 und
Werbeausgaben 30.000 (0x0C548); bei der aktuellen Saison (Kennung 22222 bzw. 22251, siehe
0x0BD1B) bleibt es bei den Vorgaben.

Die Werbeausgaben ändert ein Klick um 2500 DM (0x29455 addiert 2500 bzw. -5000 + 2500);
übersteigt der Wert 50.000, springt er auf 2.500 zurück, unter 2.500 auf 50.000. Der Wert steht
im Werbeblock als neunter Eintrag (ADV_OFFSET + Manager·36 + 32).

Aus einem Untermenü und aus solchen Bildschirmen kommt man im Original mit der rechten
Maustaste; eine Schaltfläche "Hauptmenü" gibt es dort nicht.

## Marktwert (0x24D4E; sim/value.ts)

Koeffizienten K (DGROUP 0x543E): Ablösewert [58,4,4,5,4,25], Gehaltsbasis [70,8,7,5,8,2].
v = (Ko16+Te17)/2·K0/100 + K1·g·5/100 + (m/2)·K2/100 + K3·Byte14/100 + K4·z·5/100 +
(100a/27)·K5/100 mit g = clamp((30·(Tore3+Tore4) + 40·Byte5)/100, 0, 20), m =
clamp((20·u16@30 + 30·u16@32 + 50·u16@28)/100, 0, 200), z = clamp(6·Byte0 + Byte1, 0, 20),
a = clamp(45 - Alter, 0, 27). Ablösewert: v·10000, über 110000 minus 100000. Gehaltsbasis:
v³/1000, bei Ko+Te > 100 Zuschlag (t = 100 + (Ko+Te-100)/2, über 135: ·(t-35)/100),
mindestens 2, ·85. Flag 2 (Leihe): /3. Flag-Bit 7 von Byte 9: Byte 22 > 63: ·130/100, sonst
·random(95,100)/100. Danach immer ·5/3. Flag 4 (Marktpreis, nur Ablösewert): v +=
random(v/20, v/10) - v/15, wobei random 16-Bit-Argumente erhält: ab 327.670 DM läuft v/10
über und das Ergebnis liegt meist bei v·0,87..0,93 (in 92 Marktpreisen aus Originalspielständen
bestätigt, Test transfer.test.ts). Flag 2 beim Ablösewert zusätzlich ·random(75,95)/100. Zum
Schluss Abrunden auf 1000 DM (Ablösewert) bzw. 100 DM (Gehaltsbasis).

## Transfermarkt (Bildschirm 0x22C15, Dialog 0x242CF, KI-Entscheid 0x248E1, Vereinswahl 0x16EFF, Vereinsstärkung 0x16E1A, Platz entfernen 0x1FDBE, Erneuerung 0x245A8, Tagesroutine 0x0DF0D; sim/transfer.ts)

Marktplätze sind die Aufstellungsplätze 100..111 (Manager 4, Spielerbyte 33 = 4; 5 = frei).
Je Platz: Byte 3 Ablehnungsbits (1 << Manager, dazu 0x80), Byte 9 Bit 6 Angebot eines
KI-Vereins für einen Kaderspieler, Bit 7 für einen eigenen Spieler auf dem Markt, Byte 12
Leihe (Verein | 0x80), Byte 22 anbietender Verein, i32 bei 40 Marktpreis (KI-Spieler:
Marktwert mit Flag 4 bei der Aufnahme; eigene Spieler tragen dort ihr Gehalt, angezeigt wird
der Marktwert), i32 bei 48 im Original der Meldungszeiger.

Bildschirm: links der Kader (ART NAME SP STÄRKEN TO TD), rechts der Markt (ART NAME STÄRKEN
WERT) mit LEIHEN/KAUFEN (Vorgabe KAUFEN), darunter "Ihr Angebot:" und Kontostand. Die Spalte
WERT hängt am Schalter (Listenzeichner 0x1F37F ab 0x1FBCE): angezeigt wird der Marktpreis
(i32@40 bei Marktspielern, sonst der Marktwert), bei LEIHEN durch 3 geteilt; Klick auf einen Marktspieler
zeigt "VON Verein, Alter J.". Eigener Kaderspieler anklicken: mit Angebot (Bit 6) Dialog
"Angebot: X DM / Ablöse: Y DM." BEHALTEN/VERKAUFEN, sonst auf den Markt setzen (höchstens
drei: "Schon 3 Spieler auf dem Transfermarkt"; Leihspieler: "Dieser Spieler ist nur
ausgeliehen"; Karriereende: "Dieser Spieler hört am Saisonende auf."). Der Platz wird komplett
kopiert (Nummer 0), der Kaderplatz entfernt (0x1FDBE: Nachfolger rücken auf). Eigener
Marktspieler: mit Angebot (Bit 7) derselbe Dialog, sonst zurück in den Kader.

Angebote der KI (beim Anklicken gewürfelt): Kaderspieler Marktwert·random(85,150)/100,
Marktspieler Marktwert·random(67,110)/100, auf 100 DM abgerundet; Ablöse = Angebot -
Angebot/7·Vertragsjahre wird gutgeschrieben. VERKAUFEN: Spieler an den Verein aus Byte 22
(Spielerbyte 36, Besitzer 5), der Verein stärkt sich (0x16E1A: s = Σ Matrix 24..29/6,
d = clamp((Schnitt Ko/Te/Fo - s + 10)/3, 1, 10), eine zufällige Linie Ko und Te +
random(d-1, d+1)). BEHALTEN löscht nur das Angebot.

Kauf: Angebot muss gedeckt sein ("Sie haben nicht genug Geld"); bereits abgelehnt ("Angebot
wurde bereits abgelehnt") blockiert. KI-Spieler (0x248E1, Preis = i32@40, Leihe /3): unter
Preis·random(75,85)/100 abgelehnt, ab Preis·random(120,130)/100 angenommen, sonst angenommen
wenn Angebot·100/Preis > random(80,120). Ablehnung setzt Byte 3 |= (1 << Manager) | 0x80
("Ihr Angebot wurde abgelehnt"); täglich verfällt das Bit mit 1/3, wenn nur dieser Manager
abgelehnt hat. Annahme: neuer Kaderplatz (0x224A8, Nummer ab 12), Flags/Verletzung/Karten vom
Marktplatz, dann Vertragsdialog 0x251FF (Forderung wie bei Verlängerungen, mindestens die
Gehaltsbasis; Abbruch setzt das Ablehnungsbit), Kaufpreis vom Konto, Spieler gehört dem Käufer
(Byte 33) und trägt seinen Verein. Leihe: Platz kopiert, Vertrag 1 Jahr, Byte 12 = Verein |
0x80, Gehalt aus der Kaderaufnahme, Tore/Karten 0, Besitzer bleibt der Markt; am Saisonende
löscht das Original Byte 12 (0x2F617). Spieler anderer Manager: Angebot zwischen 60 % und
140 % des Marktwerts ("Dieser Betrag liegt außerhalb des Erlaubten !"), der Besitzer
beantwortet "NEHMEN SIE DAS ANGEBOT (X DM) FÜR Name AN ?" mit NA GUT./NEIN ! (Remake:
Angebot bleibt bis zum Tageswechsel offen, Antwort im Marktbildschirm; nach NA GUT. verhandelt
der Käufer den Vertrag wie beim Kauf vom Markt). Der Käufer zahlt, der Besitzer erhält den Betrag.

Tagesroutine je Manager und Kalendertag: beim ersten Manager verliert jeder Marktspieler mit
Frische > 56 random(3,9) Frische, und mit 1/4 erlischt ein KI-Angebot. Eigene Marktspieler:
v = Marktwert/10000, bei random(0,180) < v und random(0,2) != 0 Angebot (Bit 7, Verein per
0x16EFF: zufälliger Verein 0..63 ohne Managervereine mit Stärke s = (Σ Ko + Σ Te + 150)/9,
angenommen wenn s - 2 < v < s + 20, nach 500 Versuchen beliebig). Kaderspieler bis Saisontag
321 (nicht geliehen, kein Karriereende): random(0,200) < v und random(0,450) = 0 → Bit 6,
bei v > 90 mit 1/13 ein ausländischer Verein 64..199. Meldung "Verein interessiert sich für
Name". Kaderangebote erlöschen täglich mit 1/4.

Erneuerung 0x245A8 (je Kalendertag mit 1/(Manager + 4)): über die Plätze 0..11 wird jeder
KI-Spieler entfernt (Nachrücker werden übersprungen, Spieler frei), dann free = 12 - eigene
Spieler, free -= random(0, free); je neuem Spieler: zufälliger Platz random(0,11), dort ein
KI-Spieler wird entfernt, freier Spielerdatensatz (random(1,150), Besitzer 5), Form
random(45,55), Verein = alter Verein des Datensatzes (Managerverein oder ungültig: zufälliger
Verein der Liga), Ko = clamp(random(0,14) + Verein25 - 10, 10, 99), Te = random(0,14) +
Verein28 - 10 (1/5: + random(12,20)), Aufnahme (0x224A8), Preis = Marktwert Flag 4.

## Saisonende je Manager (0x0CB62; sim/seasonEvents.ts; Zweigbuch docs/abgleich/0CB62.md)

Ablauf (GitLab #94): je Manager der Reihe nach Prämien, Torschützenkönig, Jugend und
Karriereende; **beim ersten Manager** zwischen Jugend und Karriereende einmal für alle 150
Spieler der Jahrgangswechsel (0x0D288..0x0D472): Alter + 1, auf Kader- und Marktplätzen
Angebotsmarken (Byte 9 Bits 6/7) weg und Vertragsjahr - 1; wer nicht dem gehört, bei dem er
steht (Spielerbyte 33 - Leihspieler, eigene Spieler auf der Transferliste), geht zurück: zum
Manager über die Aufnahme 0x224A8 mit dem ganzen alten Kaderplatz, ohne Leihmarke (12) und
Vertragsgespräch (24); gehörte er dem Markt, ist er frei. Nach der Schleife werden in den
Managerkadern (Plätze 0..23) die Saisonwerte Byte 0..8 gelöscht - die Karrieresummen 28..38
bleiben (in RIED-2TE bis RIED-6TE wachsen sie über jeden Saisonwechsel) -, dann die
Vertragsenden. Torschützenkönig: Platz 1 der Torschützenliste der eigenen Liga (0x16515:
mindestens zwei Tore, bei Gleichstand weniger Spiele vorn, bei Managerspielern zählen die Tore
des Kaderplatzes). Jugendspieler über 0x224A8 (Frische random(80,120), Trainingsfaktor, keine
Rückennummer), danach halbes Gehalt und random(2,3) Jahre; der Positionswert (Spielerbyte 31)
des wiederverwendeten Datensatzes bleibt stehen. Ablöse beim Vertragsende: halber Marktwert,
auf Tausend abgerundet. Im Modus "Spiele automatisch" (4cb3:05D4) würfelt das Original die
Alter neu statt Verträge abzuziehen - den Modus gibt es hier nicht.

Byte 320 (vom Tagesablauf gesetzt): Bit 0 Aufstieg (800.000 DM in die 2. Liga, 1.600.000
DM in die Bundesliga), Bit 1 "Ihr Abstieg erschüttert Millionen Fans", Bit 2 "DFB
verweigert die Lizenz", Bit 3 "Sie beginnen neu mit 500.000 DM". Torschützenkönig aus dem
eigenen Team (0x16515): 250.000 DM. Europapokal-Qualifikation (0x18E07, offen). Jugend:
J = Jugendkonto(482)/12, Konto = (J - J/3)·12; bei J > 30, random(0,2) = 0 und weniger als 23
Spielern: J halbiert, freier Spielerdatensatz (Manager 5) mit Positionsart random(0,6),
Alter random(17,19), Form random(45,55), Te und Ko random(J-3, J+3) im Bereich 10..90,
Aufnahme in den Kader (0x224A8) mit Gehalt = Gehaltsbasis·50/100 und Vertrag random(2,3). Alle Spieler ein Jahr älter, Vertragsjahre -1 (0x0D3ED).
Rücktritt (0x0D475): Kaderspieler mit Alter > random(32,34) beenden die Karriere; die Meldung
dazu steht in der Vorlage 0x4E0AE ("$ hängt den^Fußballjob im Alter von^# Jahren an den Nagel.^",
Aufruf 0x0D55E) und nennt das Alter beim Rücktritt. Der
Datensatz wird als neuer Marktspieler belegt (Alter random(18,25), J = random(30,92), Ko
und Te random(J-5, J+5), Positionsart random(0,6)). Vertragsende (0x0DB40): ohne
Verlängerung (0x251FF, Dialog) geht der Spieler ("kehrt Ihrem Verein den Rücken"), Ablöse =
halber Marktwert. Werbeverträge (0x0CC00): nur beim Aufsteiger, siehe Abschnitt "Werbung".
Der 1. April bringt nur den Scherz "älter und schwächer". Offen: Zuschlag der Ablöse bei
Endlosspiel, Trainermeldungen.

**Auslaufende Verträge (0x0DB40)**: Das Original hält den Saisonwechsel an und geht den Kader
Platz für Platz durch; bei jedem Spieler mit 0 Vertragsjahren öffnet es den Vertragsdialog
0x251FF (dieselbe Verhandlung wie im Kaderbildschirm). Danach zeigt der Hinweiskasten eines von
zwei Ergebnissen: bei einer Einigung "<Name> bleibt Ihnen auch die nächste Saison erhalten."
(0x0DDF0), ohne Angebot "<Name> kehrt Ihrem Verein den Rücken..." samt Ablöse (0x0DC99/0x0DDA1,
Ablöse = halber Marktwert, 0x0DCA1). Der Kader wird beim Abgang aufgeschoben (0x1FDBE), hat also
keine Lücken.

Im Remake kann der Saisonwechsel nicht warten, weil drei Manager an drei Rechnern sitzen. Die
Spieler bleiben deshalb mit 0 Vertragsjahren im Kader (rot in der Vertragsansicht), und der
Server führt eine Warteschlange (`Room.vertragsende`, gemerkt wird der Spieler, nicht der Platz).
Im ersten Zug der neuen Saison öffnet der Client die Vertragsansicht beim ersten dieser Spieler
und arbeitet sie nacheinander ab: "NEUER VERTRAG" verhandelt wie im Original - mit **einem**
Versuch: lehnt der Spieler ab, geht er (0x0DC66, GitLab #95) -, "KEIN ANGEBOT" lässt den
Spieler gehen. In der Version 2026 ist er danach ablösefrei; bieten dürfen nur die anderen
Manager, die davon eine Meldung bekommen. Wer am Zugende noch in der Warteschlange steht, verlässt den Verein -
genau das "kein Angebot" des Originals. Spieler der KI-Manager gehen sofort beim Saisonwechsel.

## Meldungen (Meldungsliste ab 34368; SaveFile.withMessages/addMessage/clearMessages)

Je Manager (Zähler bei Offset 41..44) Einträge aus 4 Byte Zeiger (Laufzeit), Längenbyte
und Text "Tag. Monat Jahr^Zeile^...^" mit Nullabschluss (Länge zählt ihn mit). Meldungen
bleiben stehen, bis der Manager sie schließt (Knopf "Gelesen" im Remake, POST
/api/messages/clear). Der Server erzeugt Meldungen für Trainingsverletzungen, Krawall,
fertige Stadionausbauten, DFB-Pokalspiele des eigenen Vereins und die Saisonende-Ereignisse
und hängt sie am Ende des Tageswechsels an.

**Wie wortkarg das Original ist** (GitLab #41): Die Meldungsroutine 0x30AA0 wird an genau
**sieben** Stellen aufgerufen (0x022E2, 0x023F3, 0x0D55E, 0x0E1CD, 0x0E7F0, 0x0E9C1, 0x0EA61).
Alles andere erfährt der Manager über Bildschirme oder den Hinweiskasten. Geld zum Beispiel
bleibt still: die Fanerhöhung am Monatsende (0x11F76: unter 95 Fans, Zufall(0,22) <=
Werbeausgaben/2500, dann +Zufall(1,3)) schreibt nichts, und Einnahmen und Ausgaben stehen im
Finanzbildschirm. Der fällige Kredit kommt in den Hinweiskasten (0x12076), die Randale
dagegen als Meldung (0x0E21A baut die drei Zeilen, 0x0239E gibt sie weiter).

### Der Meldungsbestand des Originals (GitLab #54)

Die Routine 0x30AA0 hat sieben Aufrufstellen, dazu der Helfer 0x0239E mit drei eigenen
Aufrufern - zusammen **acht** Meldungen. Mehr schreibt das Original nicht:

| Meldung | Fundstelle | im Remake |
| --- | --- | --- |
| Randalierer im Stadion, Sachschaden | 0x0E21A | ✔ |
| Komfortbewertung eine Note schlechter | 0x0E470 | ✔ seit #57 |
| Verletzung im Training | 0x0E6A0 | ✔ |
| Der Ausbau der ... ist abgeschlossen | 0x022E2 | ✔ |
| ... hängt den Fußballjob an den Nagel | 0x0D55E | ✔ seit #58 |
| ... bietet an, von # auf # Jahre zu verlängern | 0x0E1CD | ✔ |
| ... ist an ... interessiert | 0x0EA61 | ✔ |
| ... kündigt an, dass er seinen Vertrag nicht mehr verlängern wird | 0x0E9C1 | ✔ seit #59 |

**Was das Original bewusst nicht meldet**, weil die Sache auf einem Bildschirm steht - das
Remake hält sich daran:

| Sache | wo sie stattdessen steht |
| --- | --- |
| Meisterschaft, gewonnenes Pokalendspiel | Abschlussbild 0x1A36D (Fahne, Pokal, Titel) |
| Karte oder Verletzung einer Spielminute | Konferenz unter der Szene (0x05FE5), Spielbericht der Zeitung |
| Ergebnis des Relegationsspiels | Konferenz, Spielplan, Verlauf |
| Einnahmen, Ausgaben, Fanwachstum | Finanz- und Statistikbildschirm |
| fälliger Kredit | Hinweiskasten 0x12076 |

**Eigene Meldungen des Remakes** brauchen einen Grund. Erlaubt sind sie, wenn es den
Bildschirm des Originals nicht gibt (auslaufende Verträge, Saisonende-Ereignisse, Übergabe
eines Vereins an den Rechner) oder wenn die Mechanik neu ist: die rund 35 Meldungen der
Version 2026 (Bietgefecht, ablösefrei, Abwerben, Jugend, Derby, Doping, Arzt, Kredite unter
Mitspielern, Überschuldung) gehören dazu. Alles andere gehört auf einen Bildschirm.

## Karriereankündigung und Vertragsangebote (0x0DF0D, 0x16FC8, 0x30AA0; sim/contracts.ts)

Zeile für Zeile belegt in `docs/abgleich/0DF0D.md`. **Bis GitLab #81 stand hier die
Deutung vertauscht.**

**Karriereankündigung** (ab 0xE76F): täglich je Kaderplatz wird random(32,45) gegen den Wert
Alter·w/100 mit w = 100 - 15·[Torwart] - max(0, Te - Ko)/2 gewürfelt; liegt der Wurf
darunter und ist Byte 24 frei (kein Bit 7, unter 100), setzt das Original Bit 7 und meldet mit
Vorlage 4 "$ kündigt an,^daß er seinen Vertrag nicht^mehr verlängern wird." (Lebensdauer der
Meldung 3 Tage, 0xE835). Keine Verhandlung. Läuft der Vertrag am Saisonende aus, hängt er
die Schuhe an den Nagel (0x0D511, Vorlage 3). In allen Originalspielständen sind die Spieler
mit Bit 7 zwischen 33 und 35.

**Verlängerungsangebot** (ab 0xE83E, nicht für Leihspieler): im letzten Vertragsjahr bei
random(0,N) = 0 und random(0,3) = 0 mit N = N₀ - N₀·T/10, N₀ = (40·A + 60·S)/100,
A = 100 - 100·min(8, |25 - Alter|)/8, S = (Ko+Te+Fo)/3, T = min(5, (Einsätze 28 + 30 + 32)/36).
Jahre 2/3/4 (random(0,100) über 70 bzw. 90), Byte 24 = 100 + Jahre, Meldung Vorlage 0
"$ bietet an,^von # auf #^Jahre zu verlängern." Ohne Antwort verfällt das Angebot mit 1/6 je
Tag (0xE5DC: Byte 24 auf random(9,17), danach täglich herunter).
Die Verhandlung läuft im Vertragsdialog 0x251FF: Angebot unter der Forderung → "So dumm
ist $ leider nicht", sonst "Ihr Angebot wurde angenommen". **Jeder** Ausgang des Dialogs -
Einigung wie Absage oder Abbruch - setzt Byte 24 = random(10,18) (0x26195) und räumt die
Meldung des Spielers weg; danach zählt der Wert täglich herunter (GitLab #95). Am Saisonende
ist nach einer Absage Schluss: der Dialog kehrt zurück, und der Spieler geht (0x0DC66). Forderung (0x25C27): v =
Marktwert mit Flags 5 (also die Gehaltsbasis), prog = 100 - 100·nächster Spieltag/Spieltage
der Liga, t = 100·(Jahre - 1) + prog (0x25C90 ff.), q = ((t/6 + 122)·8)/10, Forderung =
v·(q + 4)/100, nach Saisontag 321 zusätzlich ·(152 - Alter)/100, mindestens das bisherige
Gehalt (0x25D98 vergleicht mit i32 bei 40 desselben Kaderplatzes). Die Hilfsroutine 0x3BBC8
schiebt **nach links** (·8), die danebenliegende 0x3BBD4 nach rechts.

Am ersten Spieltag ergibt das 114 % der Gehaltsbasis für ein Jahr, 128 % für zwei, 140 % für
drei und 154 % für vier. Im Original nachgemessen (DOSBox, 1. Spieltag): Basis 1.800 DM ->
2.052 / 2.304 / 2.520 / 2.772 DM, Basis 2.100 DM -> 3.234 DM für vier Jahre.

Beim Kauf ist der Mindestwert die Gehaltsbasis selbst: das Original nimmt den Spieler erst in
den Kader auf (0x23E86 -> 0x224A8 schreibt sie nach Byte 40) und verhandelt erst danach
(0x23ED8 ruft 0x251FF mit dem neuen Kaderplatz). Daraus folgt eine Eigenheit des Originals:
schwache Marktspieler sind teuer zu kaufen und fast umsonst zu bezahlen, denn die
Gehaltsbasis wächst mit der dritten Potenz von (Kondition + Technik)/2, während der
Ablösewert linear mit Faktor 10.000 rechnet. Aus RIED-CLI.MAN: K.ALLOFS, Kondition und
Technik 21/28, kostet 323.000 DM bei einer Gehaltsbasis von 700 DM; GRÜNDEL, 87/99, kostet
1.083.000 DM bei einer Basis von 50.100 DM. Im Remake
wird das Angebot des Spielers zur Forderung für Jahre + 1 angenommen oder abgelehnt
(Ablehnen setzt Byte 24 = 100, kein weiteres Angebot). Offene Angebote sind
Laufzeitdaten des Servers (POST /api/contract).

Eigenes Angebot (Dialog 0x251FF mit "VERTRAGSDAUER (IN SAISONS)" und "GEHALT PRO MONAT (IN
DM)", Prüfung 0x249E0; sim/contracts.ts contractCheck): mehr als 4 Saisons → "Wer wird sich
denn SO lange verpflichten ? (Mal abgesehen von Bundi's)". Gleiche Laufzeit: mehr Gehalt als
bisher wird angenommen, weniger abgelehnt. Kürzere Laufzeit: über 120 % des bisherigen Gehalts
angenommen, bis 105 % abgelehnt. Sonst Schwelle v = Marktwert(Flags 5)·random(q-6, q+4)/100 mit
q = ((((Jahre-1)·100 + prog)/6 + 110)·8)/10 (prog wie oben; die Forderung rechnet mit +122,
liegt also über der Schwelle), nach Saisontag 321 zusätzlich ·random(132-Alter, 152-Alter)/100;
Schwellen ab 100.000 DM werden immer abgelehnt, sonst wird ein Angebot über der Schwelle
angenommen ("Ihr Angebot wurde angenommen !", sonst "… ist nicht an Ihrem Angebot
interessiert."; bei Verlängerungen erscheint vorab "So dumm ist … leider nicht...", wenn
mehr Jahre bei weniger Gehalt als gefordert geboten werden). Da q nur 1 oder 2 ist, liegt die
Schwelle bei längerer Laufzeit zwischen -5 % und +6 % des Marktwerts (Flags 5): auch kleine
Angebote werden dort oft angenommen. Nach einer Ablehnung erlischt das Angebot, Byte 24 =
random(10,18) (0x2616F). Beim Kauf gelten die Daten des Marktplatzes, bisheriges Gehalt ist die
Gehaltsbasis; eine Ablehnung wirkt wie ABBRUCH (Ablehnungsbit, Spieler bleibt auf dem Markt).
Im Remake: Schaltflächen EIGENES ANGEBOT (Kaufdialog) und ANGEB. (Verlängerungsangebote).

**Absage im letzten Vertragsjahr** (0x0E8B1 bis 0x0E9C1, GitLab #59): Steht ein Kaderplatz im
letzten Vertragsjahr (Byte 11 = 1), ohne offenes Angebot und mit Byte 24 unter 100, würfelt das
Original täglich, ob der Spieler ankündigt, nicht zu verlängern:

```
L = min(8, |25 - Alter|)        (Absolutbetrag über 0x319E5)
A = 100 - 100·L/8
S = (Kondition + Technik + Form)/3
N = (40·A + 60·S)/100
random(0, N) = 0 und random(0, 3) = 0 -> Ankündigung
Stufe: random(0,100) über 90 -> 4, über 70 -> 3, sonst 2; Byte 24 = 100 + Stufe
```

Je näher an 25 und je stärker der Spieler, desto größer N - und desto seltener die Absage. Danach
verhandelt er nicht mehr, weil die Angebotsroutine nur unter Byte 24 = 100 arbeitet. Die Meldung
steht in der Vorlage 0x4E0EA ("$ kündigt an,^daß er seinen Vertrag nicht^mehr verlängern wird.^").
Ein dritter Summand der Schwelle (0x0E900, aus den Kaderbytes 28/30/32) ist noch nicht
entschlüsselt und fehlt im Nachbau.

## Ton: Klänge und Titelmusik

**Klänge (SOUND/DIGI.VOC)** Die Datei enthält fünf aneinandergehängte Creative-Voice-Dateien
(Offsets 0, 7018, 23098, 52182, 74513; 10/10/10/20/20 kHz; 0,70/1,60/2,90/1,11/0,79 s), im
Remake als `assets/sound/digi0..digi4.wav`. Das Original wählt einen Klang über
`lcall $0x76b,$0x182` (Index), spielt ihn mit `$0x76b,$0x24b` und `$0x76b,$0x27d`. Die Indizes
sind einsbasiert, Index *n* ist also `digi(n-1)`:

| Fundstelle | Index | Datei | Anlass |
| --- | --- | --- | --- |
| 0x055DF (Halbzeit 0x5403) | 1 | digi0 | Anpfiff zu Beginn jeder Halbzeit |
| 0x0CA3F | 2 | digi1 | Torszene, Kopfbyte 0: **Jubelsound** |
| 0x0CA5F | 3 | digi2 | Torszene, Kopfbyte 1: **Schiedsrichterpfiff** |
| 0x0CA7F | 4 | digi3 | Torszene, Kopfbyte 2: **Buh-Rufe** |
| 0x0CA9F | 5 | digi4 | Torszene, Kopfbyte 3: **Raunen im Stadion** |
| 0x1BA40 (Art 1, Ausgang Tor) | 2 | digi1 | nach der Szene über "TOR!" |
| 0x1BA40 (Art 1, kein Tor) | 5 | digi4 | nach der Szene über "KEIN TOR" |
| 0x1B718 (Art 2 und 3) | 3 | digi2 | Rote Karte, Gelb-Rot, Gelbe Karte (Pfiff) |
| 0x1B718 (Art 4) | 4 | digi3 | Verletzung (Buh-Rufe) |

Die Namen der vier Klänge stehen im Handbuch der Editor-Diskette (TorEd, Punkte 3.Q, 3.R, 3.S
und 3.Y): Jubelsound, Schiedsrichterpfiff, Buh-Rufe und Raunen im Stadion, jeder höchstens
einmal je Szene und ab einem frei gewählten Bild. Die Reihenfolge bestätigen die Daten: Kopfbyte
0 ist nur in den Torszenen gesetzt (Jubel), Kopfbyte 1 in **allen acht** Elfmeterszenen (Pfiff),
Kopfbyte 3 in fast jeder vergebenen Chance (Raunen) - und dazu passt, dass der Chancenhandler
Karten mit Klang 3 (Pfiff) und Verletzungen mit Klang 4 (Buh-Rufe) meldet.

Die vier Kopfbytes der Szenendatei stehen während der Wiedergabe in DGROUP 0x52CC..0x52CF; in
jedem Bild vergleicht 0x0C7C4 die laufende Bildnummer mit allen vieren und wirft bei Gleichheit
den zugehörigen Klang an (0xFF trifft nie). Das passt zum Befund in `assets/tore/scenes.json`:
Kopfbyte 0 ist nur in den Torszenen (`*.T`) gesetzt, und zwar kurz vor dem letzten Bild - der
Torjubel; die Kopfbytes 2 und 3 liegen in der Mitte der Szene. Treffen mehrere Kopfbytes
dasselbe Bild, gewinnt der letzte, weil jede Auswahl die laufende Ausgabe ablöst (der Sound
Blaster gibt nur eine Aufnahme gleichzeitig aus). Am Szenenende bricht das Original den Klang
ab (0x0CB40) und spielt gleich darauf den Ausgangsklang; der Jubel läuft also erst kurz an,
wird abgeschnitten und beginnt zur Anzeige "TOR!" von vorn.

Der Chancenhandler 0x1B223 bekommt die Art des Ereignisses als erstes Argument: 1 Chance/Tor
(Szene, Klang wie oben, aber nur wenn die Torszenen eingeschaltet sind, DGROUP 0x607 = Schalter
9), 2 Rote Karte oder Gelb-Rot, 3 Gelbe Karte, 4 Verletzung (Aufrufe aus der Minutenschleife
0x60E7, 0x6214, 0x629B).

Im Remake: `App.szeneTon` spielt die Szenen- und Ausgangsklänge, der Anpfiff und die Klänge zu
Karten und Verletzungen stehen in `drawLive`, `Sounds.spiele` löst wie der Sound Blaster den
laufenden Klang ab.

**Titelmusik (SOUND/BM2TITLE.CMF)** Eine Creative Music File v1.1: Instrumentenblock ab 0x28
(12 Instrumente zu 16 Byte), Musikblock ab 0xE8, 96 Ticks pro Sekunde, Spieldauer 3:17. Das
Original gibt sie über Creatives SBFMDRV auf dem OPL2 (AdLib/Sound Blaster) aus. Für das
Remake wandelt `tools/cmf/cmf2wav.c` die Datei offline in Ton um: Der CMF-Strom ist eine
MIDI-Spur (Laufzeitstatus, Steuerbefehle 0x63 AM/VIB, 0x67 Rhythmusmodus, 0x68/0x69
Transponierung), die Register des OPL werden an den Emulator Nuked-OPL3 gegeben und dessen
Ausgabe als WAV geschrieben; daraus entsteht `assets/sound/titel.mp3`. Die Abspiellogik und die
Frequenztabellen des Creative-Treibers stammen aus AdPlug (`src/cmf.cpp`, GPL-2+), der
Emulator aus Nuked-OPL3 (MIT) - beides nur im Werkzeug, nicht im Spiel selbst. Im Remake läuft
die Musik in einer Schleife, solange Titelbild, Spielauswahl oder Platzwahl stehen, und endet,
sobald ein Spiel geöffnet ist (`Sounds.musik` / `App.musikPflegen`).

## Regelwerk: Original und Version 2026 (sim/regeln.ts)

Alles bisher Beschriebene sind die Regeln des Originals von 1993. Beim neuen Spiel lässt sich
stattdessen **Version 2026** wählen: dieselben Vereine, Spieler, Wappen und Abläufe, aber die
heute gültigen Regeln. Die Wahl steht im Spielstand an Byte 34099 (0 Original, 1 Version 2026)
und gilt für den ganzen Spielstand. Die Stelle gehört zu keiner bekannten Tabelle und ist in
allen 40 vorliegenden Ständen des Originals 0 - ein Spielstand des Originals wird deshalb immer
als Original gelesen. Auf dem Einstellungsbildschirm steht das Regelwerk rechts in der Kopfzeile,
sobald es nicht das Original ist.

| Regel | Original (1993) | Version 2026 |
| --- | --- | --- |
| Punkte je Sieg | 2 (Tabelle zeigt Punkte:Minuspunkte) | 3 (Tabelle zeigt nur die Punkte) |
| Auswechslungen je Spiel | 1 Torwart + 2 Feldspieler | 5, unabhängig von der Position |

Die Punktzahlen stehen weiter in den Tabellenbytes 0 und 1 (Heim- und Auswärtspunkte); bei 38
Spieltagen und drei Punkten passt die Summe weiter in ein Byte. Unentschieden bleibt in beiden
Regelwerken ein Punkt. Die ewige Tabelle addiert die Saisonpunkte unverändert weiter - in einem
Spielstand der Version 2026 wachsen die Ewigkeitspunkte also schneller.

### Abwerben (sim/abwerben.ts, Bildschirm `drawAbwerben`, POST /api/poach)

Im Original kommt man an die Spieler eines Mitspielers nur heran, wenn dieser sie selbst auf den
Transfermarkt setzt. In der Version 2026 lässt sich ein Spieler direkt abwerben - gefragt wird
nicht der Besitzer, sondern der Spieler:

- **Ablöse** ist der Marktwert des Kaderplatzes (`playerValue` mit Variante 0, derselbe Wert, den
  der Transfermarkt für einen gelisteten Spieler eines Managers anzeigt). Darauf darf der
  Werbende **bis zu 15 %** aufschlagen, abgerundet auf volle 1000 DM; mehr nimmt niemand entgegen.
- **Zustimmung** in Prozent: 30 als Grundbereitschaft, + 2 je Prozent Aufschlag (also bis zu 30),
  + 10 je Liga, die der werbende Verein höher spielt (und ebenso viel Abzug nach unten),
  + 15 im letzten Vertragsjahr (sonst - 5 je weiterem Jahr), + 10, wenn der Spieler gerade keine
  Rückennummer hat. Begrenzt auf 5 bis 90. Gewürfelt wird `random(0,99) < Zustimmung`.
- Sagt der Spieler zu, ist der Wechsel **bindend**: der Werbende zahlt, der Besitzer bekommt das
  Geld, ablehnen kann keiner von beiden. Sagt er ab, fließt nichts.
- Der Spieler wechselt **mit seinem laufenden Vertrag** (Restjahre und Gehalt bleiben stehen) und
  bekommt beim neuen Verein eine freie Rückennummer ab 12. Eine Vertragsverhandlung wie beim Kauf
  vom Markt gibt es nicht.
- Nicht abwerben lassen sich Leihspieler und Spieler vor dem Karriereende; dem Besitzer müssen
  zwölf Spieler bleiben, der Werbende braucht einen freien Kaderplatz und das Geld auf dem Konto.
- Jeder Spieler lässt sich **einmal je Spieltag** ansprechen (Laufzeitdaten des Servers wie die
  Vertragsangebote). Beide Manager bekommen eine Meldung ins Postfach, der Besitzer auch dann,
  wenn sein Spieler geblieben ist.
- Gewildert wird nur **nach oben**: der Besitzer muss in einer höheren Liga oder in derselben
  Liga auf einem besseren Tabellenplatz stehen (Standing-Byte 46, `poachAllowedFrom`). Der
  Tabellenletzte darf damit bei allen, der Erste bei niemandem - sonst nimmt der wohlhabende
  Spitzenreiter dem Schlusslicht auch noch die besten Spieler weg (GitLab #1, Entscheidung
  vom 16.9.2026).
- Demselben Manager lässt sich **je Saison nur ein Spieler** abwerben (lhunos Entscheidung vom
  16.9.2026; vorher zwei). Gezählt wird nur,
  was geglückt ist; ein abgelehnter Versuch zählt nicht. Die 16 Zähler (Werber · 4 + Besitzer)
  stehen im Spielstand ab Byte 34100 - im selben ungenutzten Bereich wie das Regelbyte - und
  werden zum Saisonwechsel geleert (`resetPoachCounts` in `newSeason`).

Der Bildschirm steht im Untermenü Trikots (rechte Spalte oben, mit einem eigenen Symbol: ein
Angler mit einem Ball an der Leine, tools/icon_abwerben.py) und zeigt je Mitspieler dessen Kader mit Ablöse und
Zustimmungswahrscheinlichkeit zum eingestellten Aufschlag.

### Überschuldung (sim/schulden.ts)

An den Tagen, an denen das Original die Monatsabrechnung bucht (Kalendertag = letzter Tag des
Monats, in einer Saison viermal), prüft der Server jedes Managerkonto: unter **-1.000.000 DM** gibt es **drei
Punkte Abzug** in der Tabelle und einen Monat **Kaufsperre** (keine Käufe, Leihen, Abwerbungen,
keine Gebote auf ablösefreie Spieler). Die Punkte gehen vom Heimkonto der Tabelle ab (nie unter
null), die Reihenfolge wird sofort neu geschrieben, und alle Manager bekommen eine Meldung. Die
Sperre steht als Bitmaske in Byte 34117 und wird bei der nächsten Monatsprüfung neu gesetzt -
wer sein Konto ausgleicht, ist sie nach einem Monat los.

### Derby-Einsatz (sim/derby.ts)

Treffen zwei Managervereine aufeinander, geht es um Geld. Jeder stellt vorher seinen Einsatz
ein (50.000, 100.000, 250.000 oder 500.000 DM, Byte 34118 + Manager), ohne den des anderen zu
kennen; gespielt wird um den **kleineren** der beiden Beträge, begrenzt auf das, was beide auf
dem Konto haben. Der Sieger bekommt ihn, bei einem Unentschieden passiert nichts. Wer hoch
pokert, gewinnt also nur, wenn der andere mitgeht - aussteigen kann niemand, 50.000 DM sind der
Mindesteinsatz (Entscheidung vom 16.9.2026; vorher war "kein Einsatz" möglich, und dann lief das
Derby ins Leere, weil es der kleinere Betrag ist).

### Bietgefecht um Marktspieler (sim/auktion.ts)

Ein Gebot auf einen Spieler ohne Manager wird nicht mehr sofort entschieden: es steht bis zum
nächsten Tageswechsel, und jeder darf nachlegen (ein Gebot je Manager, das letzte zählt). Beim
Tageswechsel bekommt das höchste Gebot den Zuschlag, sofern der abgebende Verein es überhaupt
annimmt (dieselbe Prüfung wie im Original, `aiAccepts`); bei gleichen Geboten gewinnt der
schlechtere Tabellenplatz. Der Vertrag läuft dann ohne Verhandlung über zwei Jahre zur üblichen
Forderung - es ist eine Versteigerung, kein Gespräch. Alle Bieter bekommen eine Meldung, im
Transfermarkt steht statt des Werts das laufende Höchstgebot. Spieler, die einem Mitspieler
gehören, laufen weiter über das Angebot an ihn (0x22C15).

### Gegenwehr beim Abwerben (sim/abwerben.ts)

Der Abwerbeversuch entscheidet sich nicht mehr sofort: der Besitzer erfährt davon und darf mit
einer **Gehaltserhöhung von bis zu 50 %** antworten, die die Zustimmung um ebenso viele Punkte
drückt. Die Erhöhung bleibt stehen, auch wenn der Spieler trotzdem geht - sie kostet also in
jedem Fall. Antwortet der Besitzer nicht, entscheidet der Spieler beim Tageswechsel ohne
Gegenwehr. Gegen einen vom Rechner geführten Verein (sim/ki.ts) fällt die Entscheidung sofort.

### Ablösefrei am Saisonende (sim/abloesefrei.ts)

Läuft der Vertrag eines Spielers aus, bekommt der Verein im Original den halben Marktwert
(0x0DB40). In der Version 2026 bekommt er **nichts**: der Spieler ist ablösefrei und steht allen
Managern offen. Jeder darf ein Monatsgehalt bieten, den Zuschlag bekommt das beste Angebot -
wobei ein höher spielender Verein zählt, als hätte er zehn Prozent mehr geboten, und bei
Gleichstand der schlechtere Tabellenplatz gewinnt. Entschieden wird beim nächsten Tageswechsel,
der Vertrag läuft über zwei Jahre zum gebotenen Gehalt. Wer keinen Abnehmer findet, geht ins
Ausland.

### Kredit nur mit Zustimmung (sim/stadium.ts, sim/regeln.ts)

Im Original nimmt man sich das Geld eines Mitspielers einfach: der Kreditbildschirm fragt nur
den Borger nach Summe, Laufzeit und Zins, der Geldgeber erfährt davon erst hinterher. Zu dritt
ist das der schärfste Hebel im Spiel. In der Version 2026 stellt der Borger nur noch eine
**Anfrage über die Summe**; der Geldgeber bekommt sie ins Hauptmenü und setzt Laufzeit und Zins
oder lehnt ab (`loanRequestCheck`, POST /api/loan und /api/loan/answer). Unbeantwortete Anfragen
verfallen mit dem Tag. Kredite bei der Bank laufen unverändert sofort.

### Zinsen zu einem festen Termin (sim/finance.ts)

Im Original hängt der Zinstermin eines Kredits am Tag der Aufnahme, und die Kalendertage sind
ungleich über den Monat verteilt: je nach Aufnahmetag wird ein Kredit in einer Saison einmal
oder fünfmal mit Zinsen belastet. Die Version 2026 bucht die Zinsen aller Kredite zum selben
Termin wie die Monatsabrechnung - gleicher Takt für alle, kein Vorteil aus der Kalenderkenntnis.

### Marktpreise ohne Überlauf (sim/value.ts)

Den Zufallsaufschlag des Transfermarkts rechnet das Original in 16 Bit; oberhalb von 327.670 DM
läuft er über und liefert unsinnige, oft negative Preise. Die Version 2026 rechnet ihn sauber -
teure Spieler kosten damit immer plausibel viel.

### Guthabenzins mit Obergrenze (sim/finance.ts)

Die Monatsabrechnung verzinst den Durchschnittsstand des Kontos. In der Version 2026 zählt davon
höchstens `INTEREST_CAP` (2.000.000 DM) mit - genau die Schwelle, ab der das Original ohnehin
die Vermögenssteuer erhebt. Geld horten hört damit auf, eine Strategie zu sein.

### Verdecktes Bietgefecht (sim/auktion.ts)

Die Gebote der anderen sind nicht mehr zu sehen: im Transfermarkt steht nur das eigene Gebot und
wie viele Gebote insgesamt vorliegen. Wer mehr Geld hat, muss trotzdem raten.

Gebote, Abwerbeanfragen, Kreditanfragen und die Liste der ablösefreien Spieler sind Laufzeitdaten des Servers
wie die Vertragsangebote des Originals; ein Neustart des Servers verwirft sie.

Kaufsperre, Derby-Einsatz und die ablösefreien Spieler stehen zusammen auf dem Bildschirm
"Regeln 2026" (`drawExtra2026`), der im Untermenü Diskette neben den Einstellungen steht -
beschriftet statt bebildert, weil es im Original kein Symbol dafür gibt. Handel gibt es wie im
Original an jedem Spieltag; ein Transferfenster kennt auch die Version 2026 nicht.

Weitere Regeln der Version 2026 kommen später dazu; alle neuen Regeln hängen an
`ruleSet(g)` und lassen das Original unberührt.

### Medizinische Versorgung (sim/medizin.ts, Bildschirm `drawMedizin`, POST /api/medizin)

Im Original liegt ein verletzter Spieler genau so lange flach, wie die Verletzung dauert. In der
Version 2026 wählt der Manager je verletztem Spieler eine **Behandlungsstufe** (GitLab #2):

| Stufe | Behandlung | Kosten je Woche | trifft mit | nimmt von der Restzeit |
| --- | --- | --- | --- | --- |
| 0 | Vereinsarzt | - | - | nichts; mit 5 % dauert es eine Woche **länger** |
| 1 | Facharzt | 20.000 | 8 % | 10 bis 18 % |
| 2 | Spezialklinik | 60.000 | 15 % | 15 bis 25 % |
| 3 | Sportklinik am See | 150.000 | 25 % | 20 bis 33 % |

Die Zahlen sind bewusst zurückhaltend (lhunos Vorgabe vom 17.9.2026): eine Verletzung soll eine
Herausforderung bleiben, gerade für kleine Kader, und sich nicht wegkaufen lassen. Über eine
Verletzung von zwanzig Wochen gerechnet spart die teuerste Stufe im Schnitt **4,3 Wochen für
rund 770.000 DM**, die mittlere 2,5 Wochen für 405.000 und der Facharzt 1,0 Woche für 161.000;
mit Glück sind die vollen zehn Wochen drin. Bei einem Muskelriß von sechs Wochen bleiben es
0,2 Wochen für 150.000 - der Arzt lohnt sich also gerade bei den langen Ausfällen, und niemand
kauft sich aus einer Verletzung frei.

- Gerechnet wird an denselben Tagen, an denen die Verletzung herunterzählt (Saisontag durch 7
  teilbar), und zwar **nach** dem Training: die reguläre Woche ist dann schon ab.
- Die Verkürzung ist ein **Anteil der Restzeit**, keine feste Woche. Dieselbe Behandlung wirkt
  damit beim Leistenbruch (20 Wochen) stark und bei der Platzwunde (1 Woche) kaum.
- **Mindestens eine Woche**, wenn die Behandlung anschlägt. Die Untergrenze hängt an der
  Grunddauer der Verletzungsart (`INJURY_WEEKS`, aufgerundet, mindestens 1): **über zehn Wochen
  reicht die Behandlung bis zur Hälfte**, darunter bis zwei Drittel. Bei einem Leistenbruch
  (20 Wochen) sind also höchstens zehn Wochen herauszuholen, bei einem Muskelriß (6 Wochen)
  zwei, bei einer Platzwunde gar nichts.
  Auch der beste Arzt macht aus dem Kreuzbandriß keine Zerrung.
- Steht die Restzeit schon auf dieser Untergrenze, kostet die Woche nichts - sonst liefe Geld
  ohne jede Wirkung ab.
- Reicht das Konto für die Woche nicht, fällt die Stufe auf 0 zurück, und der Manager bekommt
  eine Meldung.
- Die Stufe steht in den **oberen zwei Bits von Lineup-Byte 23**, das die Art der Verletzung
  hält (Werte 0..17, also fünf Bits). Ein Spielstand des Originals liest sich damit unverändert:
  Stufe 0. Wer die Art der Verletzung liest, muss `injuryKind()` nehmen, nicht das rohe Byte.

Der Bildschirm steht im Untermenü Trikots (rechte Spalte, unter dem Abwerben-Symbol; eigenes
Symbol: ein Sanitätskoffer mit rotem Kreuz, `tools/icon_arzt.py`) und zeigt alle verletzten Spieler
mit Art, Restwochen, Stufe und Wochenkosten; ein Klick auf die Zeile schaltet die Stufe weiter.

### Jugendarbeit (sim/jugend.ts, Bildschirm `drawJugend`, POST /api/jugend; GitLab #4)

Im Original ist die Jugend eine Zahl im Etat (Managerbyte 319) und gelegentlich ein Talent, das
im Kader steht (0x0CE84). In der Version 2026 hat jeder Manager **drei Mannschaften** mit je
zwölf Plätzen: C-Jugend (13/14), B-Jugend (15/16), A-Jugend (16/17).

**Zwei Hebel je Spieler** (lhunos Vorgabe vom 17.9.2026): **Geld** bezahlt die Betreuung
(2.000 DM je Spieler und Monat, gebucht mit der Monatsabrechnung), **Training** treibt an
(KEINS, NORMAL, VIEL, HART). Ein Trainer schafft nicht zwölf: **höchstens vier Spieler je
Mannschaft** stehen gleichzeitig in der Förderung (`JUGEND_MAX_FOERDERUNG`, lhunos Vorgabe vom
17.9.2026) - wer die Wahl hat, muss sie treffen, die übrigen acht entwickeln sich mit der
Grundchance weiter. Als gefördert gilt, bei wem einer der beiden Hebel steht; wer beides
abstellt, macht den Platz wieder frei. Die beiden Hebel greifen ineinander:

| Hebel | Entwicklungschance | Risiko aufzugeben | Chance auf den Sprung |
| --- | --- | --- | --- |
| Grundwert | 35 % | - | - |
| Geld | + 35 | dämpft das Trainingsrisiko um ein Drittel | Bedingung |
| Training NORMAL | + 8 | 3 % | 18 % |
| Training VIEL | + 16 | 9 % | 30 % |
| Training HART | + 24 | 20 % | 40 % |

- **Entwicklung:** zum Saisonwechsel wird jeder ein Jahr älter. Schlägt die Entwicklung an,
  rücken Kondition und Technik ein Stück Richtung Potenzial (ein Drittel bis zwei Drittel der
  Lücke). Die Förderung erhöht also nicht das Können, sondern die Wahrscheinlichkeit, dass ein
  Spieler sein Potenzial überhaupt erreicht; wer nicht gefördert wird, versandet öfter.
- **Der Sprung:** nur wer **Geld und Training zusammen** bekommt, kann über sein ursprüngliches
  Potenzial hinauswachsen (+4 bis +10, gedeckelt bei `JUGEND_SPITZE` 75). Damit kann aus der
  richtigen Mischung ein sehr guter Jugendspieler werden - und genau dieser Weg trägt das
  Risiko, ihn unterwegs zu verlieren. Gemessen über 20 Saatwerte und alle Mannschaften:

  | Förderung | Schnitt | bester | ab Stärke 55 | aufgegeben |
  | --- | --- | --- | --- | --- |
  | nichts | 42,1 | 49 | 0 % | 0 % |
  | nur Geld | 43,7 | 49 | 0 % | 0 % |
  | nur Training HART | 42,5 | 49 | 0 % | 21 % |
  | Geld + NORMAL | 45,4 | 58 | 1 % | 5 % |
  | Geld + VIEL | 46,2 | 59 | 4 % | 13 % |
  | Geld + HART | 47,0 | 61 | 9 % | 29 % |

- **Potenzial** hängt am Jugendregler (Byte 319): `Zufall(18,30) + Regler/2`, begrenzt auf
  15..60. Damit trifft die Jugend das Niveau, das im Original gemessen wurde (GitLab #4): bei
  vollem Regler kommt die A-Jugend ohne Sprung auf eine Stärke um die **40 bis 46** - brauchbar
  für die Oberliga, für die Bundesliga zu schwach. Der Gewinn liegt im niedrigen Gehalt, im
  Potenzial und darin, die Entwicklung selbst gesehen zu haben.
- **Aufstieg:** höchstens **zwei je Mannschaft und Saison**, die Stärksten zuerst; wer zu alt
  ist und nicht aufsteigt, geht. Woher einer kommt, bleibt an ihm hängen: in der Liste steht das
  Kürzel der alten Mannschaft hinter dem Namen, also "NAME (C)" in der B-Jugend und "NAME (B)"
  in der A-Jugend (Bits 6..7 von Byte 18; ein Neuzugang trägt nichts).
- Die C-Jugend füllt sich jede Saison wieder auf.

**Stufe 2: der Übergang in die Männermannschaft.**

- Wer aus der A-Jugend herauswächst, steht ein Jahr lang als **reif** in der Liste. Der Manager
  holt ihn mit `AUFRÜCKEN` in den Kader - mit seinen erspielten Werten, einem Vertrag über zwei
  bis drei Jahre und **der halben Gehaltsbasis**, wie der Jugendspieler des Originals (0x0CE84).
  Wer nach der zweiten Saison immer noch dasteht, geht.
- **Höchstens fünf Aufrücker je Manager und Saison** (Zähler im Spielstand ab Byte 34122).
- **Frisch Aufgerückte darf ein Mitspieler abwerben**, und zwar **einmal je Saison** (eigene
  Grenze, Zähler ab 34126; lhunos Entscheidung vom 17.9.2026). Ablöse und Zustimmung rechnen wie
  beim Abwerben aus dem Kader, aber **ohne Richtungsregel**: wer jahrelang ausgebildet hat, muss
  auch nach unten aufpassen. Die Liste der frisch Aufgerückten ist Laufzeitdatum des Servers und
  gilt bis zum nächsten Tageswechsel.

Der Bildschirm steht im Untermenü Büro (eigenes Symbol: ein Junge am Ball, `tools/icon_jugend.py`)
und zeigt je Mannschaft die Spieler **nach Positionsgruppe sortiert** (Tor, Abwehr, Mittelfeld,
Sturm, darin nach Stärke), mit Alter, Position, Stärke, dem Verlauf der letzten vier Saisons und
den beiden Hebeln samt dem Risiko, das sie erzeugen.

**Speicherung.** Drei Mannschaften je Manager passen in keine Tabelle des Originals (Kader 25
Plätze, Spielertabelle 151 Einträge). Sie stehen deshalb in einem **Anhang hinter dem
Dateiende**, den nur das Remake liest:

    Kennung "BMP2026-JUGEND\0"   15 Bytes
    Fassung                        1 Byte
    Manager                        1 Byte
    je Manager 3 Mannschaften zu 12 Plätzen zu 24 Bytes:
      0..11  Name (Kodierung des Spiels, mit Null gefüllt; leerer Name = freier Platz)
      12 Alter   13 Positionsart 0..6   14 Kondition   15 Technik   16 Form
      17 Potenzial (verdeckt)   18 Förderung   19 Jahre im Verein
      20..23 Verlauf: Gesamtstärke der letzten vier Saisons

**Das Original lädt einen Stand mit Anhang unverändert** - in DOSBox geprüft; es überschreibt
ihn nur beim Speichern. `SaveFile` reicht ihn durch: `decode` hebt ihn auf, `encode` hängt ihn
wieder an, ein Stand ohne Anhang bleibt Byte für Byte derselbe. Die Namen der Jugendspieler
stammen aus einer eigenen Liste im Quelltext, nicht aus dem Original.

### Doping (sim/doping.ts, Bildschirm `drawDoping`, POST /api/doping)

Der schmutzige Gegenpol zur medizinischen Versorgung (GitLab #3). Ein gedopter Spieler bekommt
einen Aufschlag von **12 Punkten** auf Kondition, Technik und Form und **20** auf die Frische -
mehr, als Training je erreicht. Dafür wird nach **jedem Einsatz** gewürfelt, ob er auffliegt:
**20 % beim ersten Einsatz, je weiterem Einsatz 15 Punkte mehr, höchstens 95 %**. Über mehrere
Spieltage fliegt Doping damit praktisch sicher auf, für ein einzelnes wichtiges Spiel ist es
eine Wette.

Wer auffliegt:

- **12 bis 24 Wochen gesperrt** (drei bis sechs Monate), gezählt wie eine Verletzung.
- **Geldstrafe 50.000 DM plus 5 % des Vermögens**; gezählt wird nur ein positiver Kontostand, ein
  Minus senkt die Strafe also nicht. Einen Ligafaktor gibt es nicht mehr - die Liga wirkt über das
  Vermögen (GitLab #48).
- Die Werte fallen auf den Stand ohne Doping zurück, die Form bekommt zusätzlich 10 Punkte Malus,
  und der Spieler fliegt aus der Aufstellung.
- **Alle Manager** bekommen eine Meldung - das gehört öffentlich gemacht.

Außerdem gilt eine Grenze: **höchstens drei Kuren gleichzeitig** je Manager (`DOPING_MAX_CURES`).
Der Bildschirm zeigt den Stand als "2/3 KUREN LAUFEN" und nennt die Strafe in DM, wie sie beim
aktuellen Kontostand ausfiele.

**Speicherung.** Die Sperre des Originals zählt in Spielen (Byte 13 mit Flag-Bit 0), die
Verletzung in Wochen (dasselbe Byte, Flag-Bit 1). Eine Dopingsperre zählt in Wochen und macht
den Spieler genauso unverfügbar, benutzt deshalb dieselbe Mechanik und wird nur durch zwei
eigene Bytes des Kaderplatzes unterschieden:

| Byte | Bits | Inhalt |
| --- | --- | --- |
| 5 | 0..1 | Zustand: 0 nichts, 1 Kur, 2 Dopingsperre |
| 5 | 2..5 | Einsätze unter Doping |
| 8 | 0..3 | gewährter Aufschlag auf Kondition, Technik, Form |
| 8 | 4..7 | gewährter Aufschlag auf die Frische, in Zweierschritten |

Beide Bytes sind in **allen 40 vorliegenden Spielständen über alle 1879 belegten Kaderplätze 0**
und gehören zu keinem mehrbyteigen Feld (4 Pokaltore, 6/7 Einsätze, 9 Flags). Ein Stand des
Originals liest sich damit als "niemand gedopt". Weil die Angaben im Kaderplatz stehen, wandern
sie beim Transfer mit - eine Sperre nimmt der Spieler zum neuen Verein mit.

Der Aufschlag wird so bemessen, dass **kein Wert an die Obergrenze stößt** (99 bzw. 150).
Dadurch lässt er sich später auf den Punkt genau abziehen, ohne die Werte vorher zu merken.

Eine Dopingsperre ist **kein Fall für den Arzt**: sie taucht im Arztbildschirm nicht auf und
lässt sich nicht verkürzen. Im Kaderbildschirm stehen gedopte Spieler grün, gesperrte mit dem
Status "DOPING"; die Spielerinfo nennt "NOCH n WOCHEN GESPERRT (DOPING)".

## Aufhören: der Rechner übernimmt (0x0A7DD; sim/ki.ts)

Im Hauptmenü öffnet ein Klick mit der **rechten Maustaste** auf das Managersymbol rechts unten
die Rückfrage, ob man das Spiel wirklich beenden will (0x0A7DD, aufgerufen aus der Menüschleife
bei 0xA051 und 0xA3D5, wenn die Trefferabfrage 0x6c7:0x2 mit der rechten Taste das letzte
Rechteck meldet). Bestätigt man, beendet das Original das Programm (`exit 99` über 0x76b:0x114c).

Der Kasten, am Original vermessen: Fenster (75,110) 156x66 in Palettenfarbe 16, darin der
Managername in der normalen Schrift mittig (x 154) mit Oberkante y 113 in Farbe 11,
Trennstriche in derselben Farbe bei y 121 und y 155 von x 77 über 152 Punkte, darunter drei
Zeilen in der kleinen Schrift ab y 127 im Abstand 8, mittig, in Palettenfarbe 10 (#b2a282):
"M|CHTEN SIE", "DAS SPIEL WIRKLICH", "BEENDEN ?". Die beiden Knöpfe (57x12 wie überall) sitzen
bei (89,160) "LEIDER JA" in Farbe 17 und (159,160) "KEIN GEDANKE" in Farbe 1. Kein Text hat
einen Schatten. Nachgebaut ist der Kasten bis auf den Mauszeiger Punkt für Punkt gleich.

Im Remake spielen mehrere Menschen denselben Spielstand, ein `exit` wäre also falsch: Wer
bestätigt, steigt selbst aus - sein Platz wird frei und **der Rechner führt seinen Verein
weiter**. Der Verein bleibt ein Managerverein mit Kader, Konto, Stadion und Terminen, nur
bedient ihn niemand mehr: der Server meldet ihn an jedem Spieltag sofort fertig, und die
Aufstellung macht die automatische Aufstellung (ohne eigenes System wird 1-4-4-2 gesetzt). Die
Mitspieler bekommen eine Meldung. Wer will, kann den Verein später auf dem Platzwahlbildschirm
wieder übernehmen - dann endet die Rechnerführung.

Gespeichert steht das als Bitmaske in Byte 34116 (Bit je Manager), im selben ungenutzten
Bereich wie das Regelbyte. Das gilt für beide Regelwerke, Original wie Version 2026.


## Texte, Bilder und Klänge kommen aus der eigenen Installation

Im Repo liegt keine Datei des Originals. Alles, was aus ihm stammt, entsteht beim Einrichten mit
`npm run assets -- /pfad/zur/installation` (siehe README): Bilder (`tools/vga.py`, mit der
16-stufigen Graupalette für Zeitungskopf und -fotos), Schriften (`tools/fonts.py`), die fünf
Klänge aus `SOUND/DIGI.VOC` (`tools/digi.py`), die Titelmusik (`tools/cmf/cmf2wav.c`), die
Torszenen samt Sprite-Blättern (`tools/tore.py`) und der **Textkatalog** (`tools/texte.py`).

Der Textkatalog ersetzt die Texte, die früher im Quelltext standen - die Schlagzeilen und
Artikelsätze der Sportzeitung, die Meldungen, die Namen der Verletzungen, Trainingslager und
Ausbauarten, die Beschriftungen der Bildschirme. `tools/texte-manifest.json` merkt sich zu jedem
Text nur **Fundstelle, Länge und Prüfsumme** im entpackten `BMMAIN.EXE`, dazu bei Bedarf die
Kodierung (das Programm hält manche Namen in CP437 statt in der Kodierung des Spiels) und eine
Berichtigung für einen Tippfehler des Originals. Der Spielkern liest die Texte über
`texte(gruppe)` bzw. `text(gruppe, i)` aus `packages/core/src/data/texte.ts`; Server und Browser
laden die Datei beim Start. Fehlt sie, bricht der erste Zugriff mit einem Hinweis ab.

Einzelne Wörter und Spaltenköpfe stehen weiterhin im Quelltext - sie sind Bezeichnungen, keine
Formulierungen des Originals. Dass sonst nichts im Quelltext liegt, prüft
`tools/eigenetexte.py`: es nimmt jede Zeichenkette aus `packages/**/*.ts` (auch aus den Tests
und aus den Bausteinen zwischen den Platzhaltern einer Schablone), sucht den längsten Anfang, der
wörtlich im entpackten `BMMAIN.EXE` steht, und meldet ihn mit Datei, Zeile und Fundstelle. Ab
einer Mindestlänge von 12 Zeichen ist der Lauf leer; kürzer werden nur noch Wortfolgen gemeldet,
die zufällig mit einer Zeile des Originals beginnen ("Sie haben", "Der Ausbau"). Der Befehl endet
mit Rückgabewert 1, solange es Funde gibt. Die drei Knöpfe der Meldungsliste (`assets/eigen/menu-scroll.png`)
und die Symbole fürs Abwerben und den Arzt sind eigene Zeichnungen (`tools/icon_scroll.py`,
`tools/icon_abwerben.py`, `tools/icon_arzt.py`).
