# Audit 2, Gruppe E, Teil 1: 0x1CF86 und 0x1D6F6

Geprüft: Disassembly all.s Zeilen 42773-45185 gegen `sim/finance.ts`, `sim/originaltag.ts`,
`sim/season.ts`, `sim/lineup.ts`, `sim/matchday.ts`, `server/server.ts`, `server/live.ts`,
`web/src/main.ts`. Segmenttabelle aufgelöst: 224E/2252/224D/2280/225A/07AB/07DC liegen in 4cb3,
Manager (2242, 0x30A), Kader (774A, 0x34), Tabelle (0ECC, 0x36), 016E, 1D14, 90C6 in 4238.

Wichtig zum Verständnis: 0x1D6F6 ist die **Endlosschleife der Tage** (1EB0B: 016E++ und
`jmp 0x1D714`; nach dem Saisonwechsel 1EB08 `jmp 0x1D714` ohne 016E++). Das Argument (bp+6) gilt
nur beim ersten Eintritt (Fortsetzung eines geladenen Stands beim gespeicherten Manager).

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1CF86 | Sondertag-Bildschirm (Index 0 Weihnachten, 1 = 12.11., 2 = 19.4.) | `finance.ts:christmasPresents`, `scherztagWurf`; `server.ts:finanzTag`; `main.ts:drawSonderseite` | siehe Unterzeilen |
| 1CF9A-1CFAC | random(0,3), ungleich 0 -> Ende | `christmasPresents`/`scherztagWurf` `rng(0,3)` | stimmt |
| 1CFAF-1CFD2 | Ende, wenn 4cb3:224E != 2252 und Index != 0 | - | nicht nötig (224E = 2252 = 1 im Abbild, nirgends geschrieben) |
| 1D03B-1D0B8 | Bild 41 (Scherz) bzw. 42 (Weihnachten) bei (136,52), Rahmen Farbe 0x1D | `drawSonderseite` (nur 41) | Scherz stimmt; Weihnachten **Befund T1-5** |
| 1D0E1-1D1BB | Datumszeile "Wochentag[(07DC+4)%7], T. Monat" - 07DC ist schon +1, das Datum vom Vortag | `drawSonderseite` `DAYS[(saisontag+6)%7]` (Sonntag-basiert = Montag-basiert +5) | stimmt (Eigenheit mit übernommen) |
| 1D1C5-1D228 | Weihnachten: "Frohe Weihnachten !", random(0,1) = 0 -> ohne Pakete | `christmasPresents` | stimmt |
| 1D228-1D23F | Grundbetrag random(15,85)·10000 | `rng(15,85) * 10000` | stimmt |
| 1D242-1D4E5 | 07B2 = 0 (keine Tausenderpunkte), fünf Briefzeilen, "BUNDESLIGA: b DM, 2.LIGA: b/2 DM," / "AMATEUR-OBERLIGA: b/3 DM (INCL. MWST.)"; b·2252/224E (= b) | `server.ts:1802-1804` | stimmt (Text), Seite siehe T1-5 |
| 1D4E8-1D530 | alle 07AB Manager: Konto (2432 = Byte 496) -= b/(Liga 237A = Byte 312 + 1), ldiv | `christmasPresents` | stimmt |
| 1D598-1D65D | Scherz: acht Briefzeilen, Zeile 3 + "JENS ONNEN" (1) / "WERNER KRAHE" (2), "Oh happy day !!!" | `drawSonderseite` | stimmt |
| 1D54B-1D6EE | Warten: 1080 Ticks; Weihnachten nur per Klick; Scherz per Klick oder Zeitablauf; Klick vor Ablauf -> "Das war keine Minute !"/"Sch{men Sie Sich !", 150 Ticks | `drawSonderseite` | stimmt |
| 0x1D6F6 | Tagesablauf (Endlosschleife) | `originaltag.ts` (Vergleichsmodell), `server.ts:advanceDay`, `nachTageswechsel`, `finanzTag` | siehe Unterzeilen |
| 1D714-1D779 | Datum (0x4290), Kalenderbyte, 9 -> 0; Finanzen 0x11D0D je Manager (für 07DC) | `originaltag` Z. 86-93; Server: `finanzTag` im Vortag | Modell stimmt; Server **Befund T1-2** |
| 1D77C | Schwankung 0x10067(1) aller Vereine, vor Aufstellung, Zügen und Spielen | `originaltag` Z. 95; Server `server.ts:1845` erst nach den Spielen | Modell stimmt; Server **Befund T1-1** |
| 1D782-1D7E7 | Byte != 0: je Manager 079E = 079F, 0x22030, 0x0F9D2(m,0) | `nachTageswechsel` 1333-1340, `originaltag` 97-105 | stimmt |
| 1E0A6-1E14C | Züge: je Manager 5358 = m, random(0, n+3) = 0 -> 0x245A8, Hauptmenü 0x971F; danach 07DC > 322 -> Saisonblock | `nachTageswechsel` 1342-1346, `originaltag` 112-123 | stimmt (Gleichzeitigkeit der Züge ist bewusst, ABWEICHUNGEN) |
| 1D7EA-1D85C | nach den Zügen je Manager: 0x0F9D2(m,1), 079F = 079E, 079E = 1, 1D14 = 0, 90C6 = 0 - für **jedes** Byte != 0 | Server `systemeSichern` nur bei Liga-/Nachholtagen | **Befund T1-4**; Stärke-Flag-1 siehe unklar U1 |
| 1D866-1D8B4 | Verlegungen 0x3563: Liga 0 nur mit Bit 0, Ligen 1 und 2 immer; dann Spieltagstreiber 0x3A95 | `live.ts:startLive`, `originaltag` 150-153 | stimmt |
| 1D8BF-1D916 | Bit 8 DFB-Seite, (Byte & 0x70) = 0x10 Relegation, sonst & 0x70 Europapokal, 0x80 Nachholspiele | `server.ts:advanceDay` 1978-1995 | stimmt |
| 1D917-1D94A | 4cb3:225A[i]++ für jedes gesetzte Bit 0..2 des rohen Kalenderbytes, ohne Obergrenze | `matchday.ts:148` nur bis zur Spieltagszahl | **Befund T1-6** |
| 1D94C-1DA1F | "WINTERPAUSE" (0x32F2), wenn 130 < 07DC < 207 (224D = 0) und die Seite nicht schon steht | `server.ts:2009-2014`, `main.ts:drawSonderseite` | stimmt (einmal je Winter, #120) |
| 1DA1F-1DA81 | je Manager Plätze 0..23: Byte 13 != 0 -> Byte 10 = 0 | `server.ts:1997-2002` | stimmt (Randfall U5) |
| 1DA83-1DAD3 | 07DC++, Sondertage für das Datum des **alten** Tags (Tabellen 53D0 = 24,12,19 / 53D4 = 12,11,4) | `server.ts:finanzTag` 1798-1818, `originaltag` 250f. | stimmt (Spieltage sind nie 24.12./12.11./19.4.: Saisontage 148, 106, 264 sind mod 7 nicht 0 oder 4) |
| 1DADC-1DBEF | je Folgetag: Datum, 0x11D0D je Manager, 07DC++, Sondertage; bis (07DC-224C)%7 = 0 oder (07DC-4)%7 = 0 | `originaltag:folgetage`, `advanceDay` 2005 | Modell stimmt; Server T1-2 |
| 1DB76-1DB9E | Dezember und 4cb3:05DA != 0 -> 0x87FC(0x63) (Programmende) | - | nicht nötig (05DA im Abbild 0, nirgends geschrieben) |
| 1DBF2-1DC50 | Ankunftstag: je Manager 0x0DF0D, bei (07DC-224C)%14 = 0 0x176F4 | `tagesroutine`, `generateOffers` (Server 2034ff., Modell 262-266) | stimmt |
| 1DC52-1DCD5 | 07DC > 322: je Manager 079E = 079F, 0x22030, 0x0F9D2(m,0); weiter bei 1E03D | `tagesendeAufstellen` | stimmt |
| 1E03D-1E09A | Saisonend-Züge: je Manager Hauptmenü 0x971F(0xFF) **ohne** Markterneuerung, danach sein Saisonblock | Server: ein Zug mit Wurf | **Befund T1-3** |
| 1DCD8-1E031 | je Manager Saisonbilanz (u16 420..450), Zuschauerwerte 484..495/314, Historie (ab 50 verschoben), Meister 0x1A36D | `season.ts:saisonbilanz`, `bookChampion` | stimmt (Formeln nachgerechnet; Zweigbuch saisonwechsel bytegenau) |
| 1E14F-1E311 | Ewigkeitspunkte vorher merken, Bestenliste 0x16515, 0x1EB17, Fans aus dem Zuwachs, Tabellen zurücksetzen (Vorlage 53C7) | `season.ts` | stimmt (Zweigbuch saisonwechsel) |
| 1E319-1E460 | Lizenzentzug: Konto < -2.000.000 (strikt) und Liga < 2 -> Byte 320 = 4, ans Ende der Reihenfolge, Zusatzabsteiger, Liga + 1 | `season.ts:promoteRelegate` 139-155 | stimmt (Zweig für Zweig nachgeprüft) |
| 1E460-1E662 | Auf- und Abstieg, 225A = 1 | `promoteRelegate` | stimmt (Zweigbuch saisonwechsel) |
| 1E662-1E935 | Schwankung(10), Einnahmengrundwert 30/61, Highscore, Sponsoren, Ligaplätze | `season.ts:newSeason`, Server `saisonwechselBeginnen` | stimmt (Zweigbuch saisonwechsel) |
| 1E940-1EA2B | 07E2++, Sommertage 21.6. bis 28.7.: je Manager 0x11D0D, dann 0x0F6D8 je Kaderplatz | `saisonwechselAbschliessen` (Sperren aller Manager vor den Finanzen) | stimmt (0x0F6D8 würfelt nicht, die Finanzen lesen nichts davon) |
| 1EA2E-1EB08 | 016E = 0, 07DC = 224C, 07E0++, Datei, 0x9623 je Manager, Auslosungen, Rücksprung ohne 016E++ | `season.ts` | stimmt (Zweigbuch saisonwechsel) |

## Befunde

### T1-1 (S) Server: die tägliche Schwankung kommt erst nach den Spielen des Tages

- Original: 1D779 `mov $0x1,%al` / 1D77C `lcall $0xf9d,$0x697` (0x10067 mit 1, alle 64 Vereine)
  steht am Tagesbeginn vor der Aufstellung (1D797), den Zügen (1E0A6) und dem Spieltagstreiber
  (1D8AF `lcall $0x310,$0x995`).
- Remake: `server.ts:1845` `driftClubs(g, 1, r.rng)` steht am Anfang von `advanceDay`. Diese
  Funktion läuft erst nach der Konferenz (`startLiveDay`, Schlusspfiff -> `advanceDay`). Die
  Konferenz baut ihre Spiele vorher in `live.ts:254` mit `matrixFor` -> `g.clubs.at(club).strengthMatrix`
  für die Vereine des Rechners.
- Folge: Rechnervereine spielen am Tag k mit der Matrix ohne die Schwankung von Tag k; im Original
  mit ihr. Während des Zugs sieht man die Matrix ebenfalls einen Schritt zurück. Zahl der
  Schwankungen je Tag stimmt; nur die Lage relativ zu Zug und Spielen ist verschoben.
  `originaltag.ts:95` hat die richtige Reihenfolge. Das ist sicher: `driftClubs` wird im Server
  nur in `advanceDay` (1845) und im Saisonende-Zweig (2016) aufgerufen.

### T1-2 (S) Server: die Finanzen des Ankunftstags laufen vor seiner Tagesroutine

- Original: in der Folgetagsschleife 1DADC-1DBEF wird 0x11D0D (1DAFA) nur für Tage **vor** dem
  Ankunftstag A gerufen. Ist 07DC = A erreicht, kommt zuerst die Tagesroutine 0x0DF0D (1DBFE
  `lcall $0xcb5,$0x13bd`), dann 016E++ (1EB0F) und erst beim nächsten Durchlauf 1D757
  `lcall $0x112a,$0xa6d` die Finanzen für A, dann die Schwankung.
- Remake: `server.ts:2005` `for (let d = fromDay + 1; d <= toDay; d++) finanzTag(...)` mit
  `toDay = seasonDay(dayIndex(g))` = A, danach erst `tagesroutine` (2044). Am nächsten Tag ruft
  der Server keine Finanzen mehr am Anfang.
- Folge: Reihenfolge Finanzen(A) / Tagesroutine(A) ist vertauscht, im Zufallsstrom und im Stand.
  Monatsletzte, die Ankunftstage sind (Saisontag mod 7 = 0 oder 4): 30.9. (63), 31.1. (186),
  28.2. (214), 31.3. (245). Dort bucht der Server die Monatsabrechnung (Tagesmittel des Kontos,
  Guthabenzins, Gehälter) vor dem Krawallschaden/Komfort (`stadionTag`) und den Marktverkäufen
  der Tagesroutine; das Original danach. Ebenso Bauabschluss und Lagersperre von A. Das Modell
  `originaltag.ts:folgetage` (239-266) hat die richtige Reihenfolge.

### T1-3 (S) Server: Übergang zum Saisonwechsel - zwei Finanztage fehlen, Schwankung und Markterneuerung zu viel

- Original ohne Laden: Tag D = 322 (Kalender 92, Relegation). Danach 1DADC-Schleife: Finanzen 323,
  324, 325; 07DC = 326 ist Ankunftstag ((326-4) % 7 = 0), 0x0DF0D (entfällt intern ab 322),
  1DC52 `cmp %es:0x7dc,%ax` / `jb 0x1dc79` (326 > 322) -> Aufstellung, dann 1E03D-1E07A: je Manager
  `lcall $0x8bc,$0xb5f` mit 0xFF **ohne** `random(0, n+3)`, danach Saisonblock ab 1DCD8, dessen
  Sommerschleife mit 1E949 07DC++ bei 327 (21.6.) beginnt. Also: Finanzen für 323, 324, 325; für
  326 keine; keine Schwankung und kein Markterneuerungswurf.
- Remake: `server.ts:2004` `const toDay = saisonEnde ? fromDay + 1 : ...` -> nur `finanzTag(323)`;
  `server.ts:2015-2018` danach `driftClubs(g, 1, ...)` und `rng(0, n+3)` -> `refreshMarket`;
  Sommer 327..364 (`server.ts:1238-1248`).
- Folge: 324 und 325 (18./19.6.) fehlen: Kreditzins mit Termin am 18. oder 19., zwei Tage Bau,
  Lager-Öffnungszeiten, Lagersperre, zweimal der Bankzinswurf 1/61. Dafür gibt es eine
  Schwankung und einen Markterneuerungswurf, die es im Original nur nach Laden eines Stands aus
  dem Saisonend-Zug gibt (dann beginnt 0x1D6F6 bei 1D714 von vorn: Finanzen für 07DC, 0x10067,
  normale Zugschleife mit Wurf). Nach dieser Ladesituation ist `originaltag.ts:saisonwechseltag`
  gebaut (Stand PS0); der Server übernimmt sie auch fürs durchgehende Spiel, lässt aber zusätzlich
  324/325 weg, die auch vor so einem Speichern schon gebucht wären.

### T1-4 (S) Server: an Pokal-, Europapokal- und Relegationstagen wird das System nicht gesichert

- Original: 1D7EA-1D85C läuft nach den Zügen an **jedem** Tag mit Kalenderbyte != 0 (Sprung
  1E0BA `jmp 0x1d7ea`): 1D817 `mov %es:0x79e(%bx),%cl` / `mov %cl,%es:0x79f(%bx)` /
  1D821 `movb $0x1,%es:0x79e(%bx)`.
- Remake: `server.ts:1855-1859` `systemeSichern` wird nur in `server.ts:1932` (Nachholtag) und
  `1948` (Ligabits) gerufen. An Tagen mit Byte 8, 0x10 oder 0x70 (DFB-Pokal, Relegation,
  Europapokal) bleibt 079E stehen, 079F wird nicht nachgezogen. `setSystem` (lineup.ts:32)
  schreibt nur 079E.
- Folge: (a) Stellt ein Spieler im Zug eines Pokaltags das System um, holt der nächste Spieltag
  mit `restoreSystem` (server.ts:1335) den alten Wert aus 079F zurück - die Änderung ist weg.
  Im Original wandert sie über 079F weiter. (b) Die Tagesroutine nach dem Pokaltag stellt im
  Server automatisch auf (`tagesroutine` -> `autoLineupIfEnabled`), im Original nicht (079E = 1).
  `originaltag.ts:129` sichert an jedem Spieltag, dort stimmt es.

### T1-5 (A) Weihnachten erscheint nur als Meldung, nicht als Seite

- Original: 0x1CF86 mit Index 0 zeichnet eine eigene Seite: Grund 16, Rand 19, Bild 42.VGA
  (1D042-1D04D `cmp $0x1,%si` / `sbb` / `neg` / `add $0x29,%cl` -> 0x2A bei Index 0) bei (136,52)
  mit Rahmen, Datumszeile, "Frohe Weihnachten !", Briefzeilen und Beträge; sie bleibt bis zum
  Klick stehen (1D65F-1D66C).
- Remake: `server.ts:1802-1805` schiebt eine gewöhnliche Meldung in die Meldungsliste; die
  Sonderseiten von #120 (`main.ts:drawSonderseite`) kennen nur "winter", "scherz1", "scherz2".
  Inhalt der Zeilen stimmt, Bild und Seite fehlen. Nicht in ABWEICHUNGEN.

### T1-6 (S) Spieltagzähler 225A läuft im Original über den letzten Spieltag hinaus

- Original: 1D917-1D94A `incb %es:0x225a(%bx)` für jedes gesetzte Bit 0..2 des Kalenderbytes,
  ohne Vergleich mit der Spieltagszahl. Nach dem letzten Ligatag (Kalender 90) steht 4cb3:225A
  also auf 35/39/39, bis 1E47B im Saisonwechsel 1 schreibt. Die Leser rechnen damit: das
  Hauptmenü vergleicht 97AA `cmp %al,%es:0x225a(%si)` mit 4cb3:2262 (34/38/38) und schreibt die
  nächste Paarung nur darunter.
- Remake: `matchday.ts:148` `if (md1 < LEAGUES[league].matchdays)` - der Zähler (Save-Offset
  28432) bleibt auf 34/38/38.
- Folge: an den beiden Relegationstagen (Saisontag 319, 322) und im Saisonend-Zug steht im
  Spielstand ein anderer Wert. Er wird z. B. in 0x1A36D (1A64C, 1A71C: Ergebniszeile
  `(38·Liga + 225A)·20`) gelesen - was dort daraus folgt, gehört zu dieser Routine (andere Gruppe).
  Sicher ist die Byte-Abweichung im Stand.

## Unklar

- **U1** 1D7FF `lcall $0xf9d,$0x2` mit Flag 1 läuft für **alle** Manager in Managerreihenfolge,
  vor den Verlegungen, und schreibt nach `originaltag.ts:128` die Spielstärke in die
  Vereinsmatrix. Der Server rechnet sie in `live.ts:254` (`matrixFor`) nur für Manager, die
  spielen, in Paarungsreihenfolge und nach dem jeweiligen `verlegen`; in die Vereinsmatrix
  schreibt er sie nicht (`matrixInVerein` kommt im Server nicht vor). Ob ein Leser der
  Managervereinsmatrix zwischen Spiel und nächstem 0x1D7BA liegt (Tagesroutine, KI-Transfers,
  Vereinsinfo), müsste geprüft werden.
- **U2** `originaltag.ts:saisonwechseltag` rechnet die Finanzen des "Übergangstags" mit dem Datum
  von Saisontag 323 (`seasonDay(dayIndex)+1`). Wird der Stand PS0 im Saisonend-Zug gespeichert
  (07DC = 326), rechnet 0x4290 beim Neustart das Datum aus 07DC, also 20.6. Das macht nur bei
  Kreditterminen am 17. bzw. 20. einen Unterschied. Zur Klärung braucht man 07DC im Stand PS0.
- **U3** Das Vergleichsmodell `originaltag.ts` lässt 1DA23 (Rückennummer 0 bei Sperre/Verletzung)
  aus; der Server hat es (2000). Betrifft nur das Modell.
- **U4** Kalenderbyte 9: das Original überspringt die Züge (1D744), zählt aber in 1D917 mit dem
  rohen Byte den Bundesliga-Spieltagzähler hoch. Im Standardkalender (4cb3:2280) kommt 9 nicht
  vor; ob `verlegen` so ein Byte erzeugen kann, ist nicht geprüft.
- **U5** 1DA4D-1DA59 prüft jeden der Plätze 0..23 ohne Belegtprüfung; der Server überspringt
  leere Plätze (`!l.isEmpty`). Unterschied nur bei einem leeren Platz mit Byte 13 != 0 und
  liegengebliebener Rückennummer.

## Nebenbei (außerhalb 0x1CF86/0x1D6F6)

- `server.ts:finanzTag` (1749-1760): Bauabschluss steht **nach** Lager und Bankzins, und die
  Meldung würfelt nicht (pushMessage ohne random(0,3)); `originaltag.ts:88` und SPIELMECHANIK
  ("Bau, Lager, Bankzins"; Meldung über 0x30AA0 mit random(0,3)) sagen anders. Gehört zu
  0x11D0D/0x020E1/0x30AA0.
