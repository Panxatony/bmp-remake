# Audit 2, Gruppe E: Routinen 0x1CF86 bis unter 0x242CF

Stand 26.9.2026. Gegen das Remake unter dem Repo (Stand deccf74) geprüft. Im Repo wurde nichts geändert.
Die Arbeit ist in vier Teile gegliedert. Die Befund-IDs laufen durchgehend:
- Teil 1: 0x1CF86 und 0x1D6F6, Befunde E1-E6
- Teil 2: 0x1EB17, 0x1ECDE und 0x1F37F, Befunde E7-E15
- Teil 3: 0x1FDBE bis 0x224A8, Befunde E16-E17
- Teil 4: 0x2277A bis 0x22C15, Befunde E18-E28

Offene Punkte heißen U<Teil>.<n>.

Zusätzliche Routine: 0x1EB17 endet schon bei 0x1ECDC. Ab 0x1ECDE beginnt eine eigene Routine, die Hilfszeile unter den Spielerlisten. rohdaten-neu.md zählt sie noch zu 0x1EB17.

Hinweis zur Disassembly: Aufrufe mit push %cs; call im Segment 1ecd bricht all.s falsch als 0x2xxxx um, gemeint ist 0x1xxxx. Deshalb haben 0x1FF36 und 0x1FFFA in rohdaten-neu.md scheinbar keine Aufrufer.

## Querverweise
- E16 (Teil 3) sowie E19, E21 und E24 (Teil 4) betreffen alle die Aufnahme 0x224A8 und den Kauf, aber jeweils einen anderen Punkt:
  - E16: Es wird keine Rückennummer vergeben.
  - E19: 0x224A8 würfelt fünfmal. Das gilt für jede Aufnahme, wirkt aber nur auf die Wege, auf denen das Remake 0x224A8 nicht nachbildet: auf den Markt setzen und Zurückholen.
  - E21: Byte 9 wird ungefiltert übernommen.
  - E24: Es geht um die Reihenfolge der Würfe, den abgebrochenen Kauf und den vollen Kader.
- U3.1 ist dieselbe Frage, die Teil 4 aufwirft: Sortiert 0x224A8 bei Managern nach Spielerindex ein?
- Außerhalb des Bereichs, aber bemerkt:
  - Die Nummernpflege des Hauptmenüs 0x9C78-0x9D40 fehlt im Remake (siehe E16, E17).
  - In finanzTag (0x11D0D/0x20E1) kommt der Bauabschluss nach Lager und Bankzins, und seine Meldung würfelt kein random(0,3) (Teil 1, Nebenbei).

## Teil 1: 0x1CF86 und 0x1D6F6

Geprüft: Disassembly all.s Zeilen 42773-45185 gegen `sim/finance.ts`, `sim/originaltag.ts`,
`sim/season.ts`, `sim/lineup.ts`, `sim/matchday.ts`, `server/server.ts`, `server/live.ts`,
`web/src/main.ts`. Segmenttabelle aufgelöst: 224E/2252/224D/2280/225A/07AB/07DC liegen in 4cb3,
Manager (2242, 0x30A), Kader (774A, 0x34), Tabelle (0ECC, 0x36), 016E, 1D14, 90C6 in 4238.

Wichtig zum Verständnis: 0x1D6F6 ist die **Endlosschleife der Tage** (1EB0B: 016E++ und
`jmp 0x1D714`; nach dem Saisonwechsel 1EB08 `jmp 0x1D714` ohne 016E++). Das Argument (bp+6) gilt
nur beim ersten Eintritt (Fortsetzung eines geladenen Stands beim gespeicherten Manager).

### Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1CF86 | Sondertag-Bildschirm (Index 0 Weihnachten, 1 = 12.11., 2 = 19.4.) | `finance.ts:christmasPresents`, `scherztagWurf`; `server.ts:finanzTag`; `main.ts:drawSonderseite` | siehe Unterzeilen |
| 1CF9A-1CFAC | random(0,3), ungleich 0 -> Ende | `christmasPresents`/`scherztagWurf` `rng(0,3)` | stimmt |
| 1CFAF-1CFD2 | Ende, wenn 4cb3:224E != 2252 und Index != 0 | - | nicht nötig (224E = 2252 = 1 im Abbild, nirgends geschrieben) |
| 1D03B-1D0B8 | Bild 41 (Scherz) bzw. 42 (Weihnachten) bei (136,52), Rahmen Farbe 0x1D | `drawSonderseite` (nur 41) | Scherz stimmt; Weihnachten **Befund E5** |
| 1D0E1-1D1BB | Datumszeile "Wochentag[(07DC+4)%7], T. Monat" - 07DC ist schon +1, das Datum vom Vortag | `drawSonderseite` `DAYS[(saisontag+6)%7]` (Sonntag-basiert = Montag-basiert +5) | stimmt (Eigenheit mit übernommen) |
| 1D1C5-1D228 | Weihnachten: "Frohe Weihnachten !", random(0,1) = 0 -> ohne Pakete | `christmasPresents` | stimmt |
| 1D228-1D23F | Grundbetrag random(15,85)·10000 | `rng(15,85) * 10000` | stimmt |
| 1D242-1D4E5 | 07B2 = 0 (keine Tausenderpunkte), fünf Briefzeilen, "BUNDESLIGA: b DM, 2.LIGA: b/2 DM," / "AMATEUR-OBERLIGA: b/3 DM (INCL. MWST.)"; b·2252/224E (= b) | `server.ts:1802-1804` | stimmt (Text), Seite siehe E5 |
| 1D4E8-1D530 | alle 07AB Manager: Konto (2432 = Byte 496) -= b/(Liga 237A = Byte 312 + 1), ldiv | `christmasPresents` | stimmt |
| 1D598-1D65D | Scherz: acht Briefzeilen, Zeile 3 + "JENS ONNEN" (1) / "WERNER KRAHE" (2), "Oh happy day !!!" | `drawSonderseite` | stimmt |
| 1D54B-1D6EE | Warten: 1080 Ticks; Weihnachten nur per Klick; Scherz per Klick oder Zeitablauf; Klick vor Ablauf -> "Das war keine Minute !"/"Sch{men Sie Sich !", 150 Ticks | `drawSonderseite` | stimmt |
| 0x1D6F6 | Tagesablauf (Endlosschleife) | `originaltag.ts` (Vergleichsmodell), `server.ts:advanceDay`, `nachTageswechsel`, `finanzTag` | siehe Unterzeilen |
| 1D714-1D779 | Datum (0x4290), Kalenderbyte, 9 -> 0; Finanzen 0x11D0D je Manager (für 07DC) | `originaltag` Z. 86-93; Server: `finanzTag` im Vortag | Modell stimmt; Server **Befund E2** |
| 1D77C | Schwankung 0x10067(1) aller Vereine, vor Aufstellung, Zügen und Spielen | `originaltag` Z. 95; Server `server.ts:1845` erst nach den Spielen | Modell stimmt; Server **Befund E1** |
| 1D782-1D7E7 | Byte != 0: je Manager 079E = 079F, 0x22030, 0x0F9D2(m,0) | `nachTageswechsel` 1333-1340, `originaltag` 97-105 | stimmt |
| 1E0A6-1E14C | Züge: je Manager 5358 = m, random(0, n+3) = 0 -> 0x245A8, Hauptmenü 0x971F; danach 07DC > 322 -> Saisonblock | `nachTageswechsel` 1342-1346, `originaltag` 112-123 | stimmt (Gleichzeitigkeit der Züge ist bewusst, ABWEICHUNGEN) |
| 1D7EA-1D85C | nach den Zügen je Manager: 0x0F9D2(m,1), 079F = 079E, 079E = 1, 1D14 = 0, 90C6 = 0 - für **jedes** Byte != 0 | Server `systemeSichern` nur bei Liga-/Nachholtagen | **Befund E4**; Stärke-Flag-1 siehe unklar U1.1 |
| 1D866-1D8B4 | Verlegungen 0x3563: Liga 0 nur mit Bit 0, Ligen 1 und 2 immer; dann Spieltagstreiber 0x3A95 | `live.ts:startLive`, `originaltag` 150-153 | stimmt |
| 1D8BF-1D916 | Bit 8 DFB-Seite, (Byte & 0x70) = 0x10 Relegation, sonst & 0x70 Europapokal, 0x80 Nachholspiele | `server.ts:advanceDay` 1978-1995 | stimmt |
| 1D917-1D94A | 4cb3:225A[i]++ für jedes gesetzte Bit 0..2 des rohen Kalenderbytes, ohne Obergrenze | `matchday.ts:148` nur bis zur Spieltagszahl | **Befund E6** |
| 1D94C-1DA1F | "WINTERPAUSE" (0x32F2), wenn 130 < 07DC < 207 (224D = 0) und die Seite nicht schon steht | `server.ts:2009-2014`, `main.ts:drawSonderseite` | stimmt (einmal je Winter, #120) |
| 1DA1F-1DA81 | je Manager Plätze 0..23: Byte 13 != 0 -> Byte 10 = 0 | `server.ts:1997-2002` | stimmt (Randfall U1.5) |
| 1DA83-1DAD3 | 07DC++, Sondertage für das Datum des **alten** Tags (Tabellen 53D0 = 24,12,19 / 53D4 = 12,11,4) | `server.ts:finanzTag` 1798-1818, `originaltag` 250f. | stimmt (Spieltage sind nie 24.12./12.11./19.4.: Saisontage 148, 106, 264 sind mod 7 nicht 0 oder 4) |
| 1DADC-1DBEF | je Folgetag: Datum, 0x11D0D je Manager, 07DC++, Sondertage; bis (07DC-224C)%7 = 0 oder (07DC-4)%7 = 0 | `originaltag:folgetage`, `advanceDay` 2005 | Modell stimmt; Server E2 |
| 1DB76-1DB9E | Dezember und 4cb3:05DA != 0 -> 0x87FC(0x63) (Programmende) | - | nicht nötig (05DA im Abbild 0, nirgends geschrieben) |
| 1DBF2-1DC50 | Ankunftstag: je Manager 0x0DF0D, bei (07DC-224C)%14 = 0 0x176F4 | `tagesroutine`, `generateOffers` (Server 2034ff., Modell 262-266) | stimmt |
| 1DC52-1DCD5 | 07DC > 322: je Manager 079E = 079F, 0x22030, 0x0F9D2(m,0); weiter bei 1E03D | `tagesendeAufstellen` | stimmt |
| 1E03D-1E09A | Saisonend-Züge: je Manager Hauptmenü 0x971F(0xFF) **ohne** Markterneuerung, danach sein Saisonblock | Server: ein Zug mit Wurf | **Befund E3** |
| 1DCD8-1E031 | je Manager Saisonbilanz (u16 420..450), Zuschauerwerte 484..495/314, Historie (ab 50 verschoben), Meister 0x1A36D | `season.ts:saisonbilanz`, `bookChampion` | stimmt (Formeln nachgerechnet; Zweigbuch saisonwechsel bytegenau) |
| 1E14F-1E311 | Ewigkeitspunkte vorher merken, Bestenliste 0x16515, 0x1EB17, Fans aus dem Zuwachs, Tabellen zurücksetzen (Vorlage 53C7) | `season.ts` | stimmt (Zweigbuch saisonwechsel) |
| 1E319-1E460 | Lizenzentzug: Konto < -2.000.000 (strikt) und Liga < 2 -> Byte 320 = 4, ans Ende der Reihenfolge, Zusatzabsteiger, Liga + 1 | `season.ts:promoteRelegate` 139-155 | stimmt (Zweig für Zweig nachgeprüft) |
| 1E460-1E662 | Auf- und Abstieg, 225A = 1 | `promoteRelegate` | stimmt (Zweigbuch saisonwechsel) |
| 1E662-1E935 | Schwankung(10), Einnahmengrundwert 30/61, Highscore, Sponsoren, Ligaplätze | `season.ts:newSeason`, Server `saisonwechselBeginnen` | stimmt (Zweigbuch saisonwechsel) |
| 1E940-1EA2B | 07E2++, Sommertage 21.6. bis 28.7.: je Manager 0x11D0D, dann 0x0F6D8 je Kaderplatz | `saisonwechselAbschliessen` (Sperren aller Manager vor den Finanzen) | stimmt (0x0F6D8 würfelt nicht, die Finanzen lesen nichts davon) |
| 1EA2E-1EB08 | 016E = 0, 07DC = 224C, 07E0++, Datei, 0x9623 je Manager, Auslosungen, Rücksprung ohne 016E++ | `season.ts` | stimmt (Zweigbuch saisonwechsel) |

### Befunde

### E1 (S) Server: die tägliche Schwankung kommt erst nach den Spielen des Tages

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

### E2 (S) Server: die Finanzen des Ankunftstags laufen vor seiner Tagesroutine

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

### E3 (S) Server: Übergang zum Saisonwechsel - zwei Finanztage fehlen, Schwankung und Markterneuerung zu viel

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

### E4 (S) Server: an Pokal-, Europapokal- und Relegationstagen wird das System nicht gesichert

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

### E5 (A) Weihnachten erscheint nur als Meldung, nicht als Seite

- Original: 0x1CF86 mit Index 0 zeichnet eine eigene Seite: Grund 16, Rand 19, Bild 42.VGA
  (1D042-1D04D `cmp $0x1,%si` / `sbb` / `neg` / `add $0x29,%cl` -> 0x2A bei Index 0) bei (136,52)
  mit Rahmen, Datumszeile, "Frohe Weihnachten !", Briefzeilen und Beträge; sie bleibt bis zum
  Klick stehen (1D65F-1D66C).
- Remake: `server.ts:1802-1805` schiebt eine gewöhnliche Meldung in die Meldungsliste; die
  Sonderseiten von #120 (`main.ts:drawSonderseite`) kennen nur "winter", "scherz1", "scherz2".
  Inhalt der Zeilen stimmt, Bild und Seite fehlen. Nicht in ABWEICHUNGEN.

### E6 (S) Spieltagzähler 225A läuft im Original über den letzten Spieltag hinaus

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

### Unklar

- **U1.1** 1D7FF `lcall $0xf9d,$0x2` mit Flag 1 läuft für **alle** Manager in Managerreihenfolge,
  vor den Verlegungen, und schreibt nach `originaltag.ts:128` die Spielstärke in die
  Vereinsmatrix. Der Server rechnet sie in `live.ts:254` (`matrixFor`) nur für Manager, die
  spielen, in Paarungsreihenfolge und nach dem jeweiligen `verlegen`; in die Vereinsmatrix
  schreibt er sie nicht (`matrixInVerein` kommt im Server nicht vor). Ob ein Leser der
  Managervereinsmatrix zwischen Spiel und nächstem 0x1D7BA liegt (Tagesroutine, KI-Transfers,
  Vereinsinfo), müsste geprüft werden.
- **U1.2** `originaltag.ts:saisonwechseltag` rechnet die Finanzen des "Übergangstags" mit dem Datum
  von Saisontag 323 (`seasonDay(dayIndex)+1`). Wird der Stand PS0 im Saisonend-Zug gespeichert
  (07DC = 326), rechnet 0x4290 beim Neustart das Datum aus 07DC, also 20.6. Das macht nur bei
  Kreditterminen am 17. bzw. 20. einen Unterschied. Zur Klärung braucht man 07DC im Stand PS0.
- **U1.3** Das Vergleichsmodell `originaltag.ts` lässt 1DA23 (Rückennummer 0 bei Sperre/Verletzung)
  aus; der Server hat es (2000). Betrifft nur das Modell.
- **U1.4** Kalenderbyte 9: das Original überspringt die Züge (1D744), zählt aber in 1D917 mit dem
  rohen Byte den Bundesliga-Spieltagzähler hoch. Im Standardkalender (4cb3:2280) kommt 9 nicht
  vor; ob `verlegen` so ein Byte erzeugen kann, ist nicht geprüft.
- **U1.5** 1DA4D-1DA59 prüft jeden der Plätze 0..23 ohne Belegtprüfung; der Server überspringt
  leere Plätze (`!l.isEmpty`). Unterschied nur bei einem leeren Platz mit Byte 13 != 0 und
  liegengebliebener Rückennummer.

### Nebenbei (außerhalb 0x1CF86/0x1D6F6)

- `server.ts:finanzTag` (1749-1760): Bauabschluss steht **nach** Lager und Bankzins, und die
  Meldung würfelt nicht (pushMessage ohne random(0,3)); `originaltag.ts:88` und SPIELMECHANIK
  ("Bau, Lager, Bankzins"; Meldung über 0x30AA0 mit random(0,3)) sagen anders. Gehört zu
  0x11D0D/0x020E1/0x30AA0.

## Teil 2: 0x1EB17 und 0x1F37F

Hinweis zur Routinengrenze: rohdaten-neu.md zählt 0x1EB17 mit 2152 Bytes. Tatsächlich endet 0x1EB17
bei 0x1ECDC (lret). Ab 0x1ECDE (Bytes `55 8b ec`, in all.s als `add %dl,-0x75(%di)` fehlgelesen)
beginnt eine eigene Routine: die Hilfszeile unter den Spielerlisten (Spalte und Zeile unter dem
Mauszeiger). Sie ist 1ECD:000E. Aufrufer: 0x2305F (Transfermarkt, linke Liste), 0x25370
(0x251FF, Vertragsansicht), dazu Nahaufrufe `push %cs; call` aus 0x20230 bei 0x20474 (Rücksetzen
mit x = -1) und 0x20571 (Kaderliste). Auch 0x1F37F hat Nahaufrufer, die all.s nicht zeigt
(Sprungziel falsch umgebrochen als `call 0x2f37f`): 0x20365 und 0x2108C aus 0x20230, beide mit
Maske 0xF0C7, Modus 0. **Die normale Kaderliste des Kaderbildschirms wird also von 0x1F37F
gezeichnet, und ihre Hilfszeile kommt aus 0x1ECDE.**

Aufrufe von 0x1F37F (Argumente x, y, erste Zeile, letzte Zeile, rechter Rand, unterer Strich, Maske, Modus):

| Aufruf | Liste | Maske | Modus |
|---|---|---|---|
| 0x20365, 0x2108C (0x20230) | Kaderbildschirm, normale Ansicht | 0xF0C7: NR ART NAME SP ST[RKEN TO GK/RK STATUS TD | 0 |
| 0x252E3, 0x26225 (0x251FF), 0x0DBC6, 0x0DE45 (0x0CB62) | Vertragsansicht / Saisonende | 0x3D146: ART NAME SP ST TO STATUS TD V.DAUER GEHALT | 3 |
| 0x22F99, 0x235A5 (0x22C15) | Markt, linke Liste "IHRE MANNSCHAFT" | 0x90C6: ART NAME SP ST[RKEN TO TD | 4 (= 0 mit Merker -0x5E = 1) |
| 0x22FF3 (0x22C15) | Markt, rechte Liste "TRANSFERMARKT", Manager 4, Zeilen 0..12 | 0x20086: ART NAME ST[RKEN WERT | 1 (KAUFEN) / 2 (LEIHEN) |

Spaltenbreiten 4cb3:07C4 = 11 18 57 13 12 12 14 36 12 14 12 12 13 27 40 13 25 33.
Farbe je Spalte neu: 4cb3:07B4[Spielerbyte 31 / 25] (21/26/25/24 = die GRUPPENFARBE des Remakes).

### Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1EB17 (bis 0x1ECDC) | Titelseite "SAISONENDE" über 0x32F2 (Flaggenseite, 50 Ticks), dann Ewigkeitspunkte je Verein 0..63, Merkbits 4238:4BEC[0..3] = 0 | core/src/sim/season.ts:208 `ewigkeitspunkte`; Merkbits server.ts:1181 `r.msgFlags = []` | Rechnung stimmt; Titelseite fehlt: **Befund E7** |
| 0x1ECDE (bis 0x1F37E) | Hilfszeile unter der Spielerliste: Spalte/Zeile unter dem Zeiger, Text der Spalte, Zeilenmarkierung; Klick (4238:2EA2 = 1/3) liefert die Zeile | web/src/main.ts:2777 `squadSpalteAt`, :2791 `squadHilfe` (nur Kaderbildschirm) | **Befunde E10, E11, E12**; Spaltengrenzen unklar (U2.1) |
| 0x1F37F | Listenzeichner (Kader, Vertrag, Markt): Überschrift, Kopfzeile, Zeilen nach Maske und Modus | web/src/main.ts:4581 `drawSquad`, :6347 `drawMarket` | **Befunde E8, E9, E13, E14, E15** |

### Geprüft und stimmt

0x1EB17, Ewigkeitspunkte (Zeilen 0x1EB39-0x1ECD4), Konstanten im Bild: 4cb3:226F = 18, 2270 = 38, 2277 = 57.
- v = 25·([si < 38] + [si < 18]) − Byte 46 (0x0EFA, vorzeichenlos) + 19; `cmp si,ax; jge` bei 2277: für si > 57 v = 0. Remake season.ts:213-214 gleich.
- Pokalsieger: di 0..3 liest 4cb3:07AC/07AF/07AE/07AD mit Bonus 20/30/40/50, Bedingung `Wert − si − 1 == 0` (Byte vorzeichenlos). Remake [2340,20],[2343,30],[2342,40],[2341,50] - gleiche Paare (MEMORY-MAP 2340 = 4cb3:07AC).
- Platzbonus: si < 18: Platz 0 → 12, Platz < 5 (`jae` bei 5) → 3; sonst Platz 0 und si ≤ 57 → 3. Remake :216-217 gleich.
- Addition mit `cwtd; add; adc` auf i32 bei Byte 50 - Remake i32 + v, vier Bytes zurück. Gleich.
- 4238:4BEC[0..3] = 0 (Merkbits "Meisterschaft verspielt" usw., nur Speicher): das Remake leert `r.msgFlags` beim Saisonwechsel (server.ts:1181). Gleichwertig.

0x1F37F, was stimmt: NR (Byte 10, 0 leer, > 11 in Farbe 4 = #616181, main.ts:4658), ART (22F0[Gruppe]),
ST[RKEN Bytes 16/17/18, ST = (16+17+18)/3 abgeschnitten, GK = Byte 1, RK = Byte 0, TD = 2314[(Byte 14 − 30)/13] mit Farbe 0x12
(#b20020) bei Byte 19 > 130, GEHALT = i32@40 (Modus 3), WERT (Modus 1/2): Spielerbyte 33 ≠ 4 → 0x24D4E(Platz, 0) mit 304a = 4,
sonst i32@40, bei LEIHEN ldiv 3 (transfer.ts:160, main.ts:6407), Überschriften "IHRE MANNSCHAFT"/"TRANSFERMARKT" (4cb3:27B0/27AC).
STATUS-Text bei Sperre "GESP.(n)" und Sperre ausgesetzt (4238:513E) wie ungesperrt - main.ts:4644/4965 gleich.

0x1ECDE, was stimmt: Spalte NR/SP/TO/GK-RK/V.DAUER/GEHALT Text 4cb3:2330[Spalte] (ui.kaderhilfe 0..17), Spalte 1 Positionsname
2378[Gruppe], NAME "NAME: " Name " (" Alter (Spielerbyte 26) " JAHRE)" + 0x04D22, Spalte 7 Text + "(" Schnitt ")", TD
"TENDENZ DES SPIELERS: " + 24F4[(Byte 14 − 30)/13], ungültige Stelle → Zeile leer.

### Befunde

### E7 (A) Titelseite "SAISONENDE" fehlt
Original: 0x1EB24-0x1EB32 `mov -0x61ea,%es; push %es:0x25ba; push %es:0x25b8; lcall $0x310,$0x1f2` - Zeiger 4cb3:25B8 → 4cb3:12CF
"SAISONENDE". 0x32F2 ist die Titelseite (0x31FA Flaggenhintergrund, Text mittig in Schrift 3, dann 50 Ticks warten, wenn 4cb3:05D4 = 0),
dieselbe wie für "DFB-Pokal"/"Relegationsspiel" (anzeigen.md A1/A2). Sie erscheint vor der Ewigkeitspunkte-Rechnung am Saisonende.
Remake: keine solche Seite. `ui.ankuendigung` (texte-manifest) enthält Ligaspiel, DFB-Pokal, Europapokal, Relegationsspiel, Nachholspiele,
Nachholspiel, `ui.winterpause` WINTERPAUSE; "SAISONENDE" (Bildoffset 0x4DDFF) steht in keinem Manifesteintrag; die Sonderseiten des
Servers kennen nur "winter" | "scherz1" | "scherz2" (server.ts:668). Sicher: direkter Aufruf ohne Bedingung am Routinenanfang.

### E8 (A) Spalte SP ohne Europapokaleinsätze, TO ohne Europapokaltore
Original 0x1F37F: Spalte 6 (0x1F88C → 0x1F8A6-0x1F8B7, 0x1F9D4-0x1F9DA): `mov %es:0x8(%bx),%al; mov %es:0x7(%bx),%cl; mov %es:0x6(%bx),%dl ... add %cx,%dx; add %dx,%ax`
= Byte 6 + 7 + 8. Spalte 12 (0x1F9BA): Byte 5 + 4 + 3. Byte 8/5 sind die Europapokaleinsätze/-tore (doping.ts:24-25).
Die Spalten stehen in den Masken 0xF0C7 (Kaderbildschirm), 0x3D146 (Vertragsansicht) und 0x90C6 (Markt links).
Remake: main.ts:4662/4664 (Vertrag), 4676/4680 (Kader), 6381/6386 (Markt): `l.leagueApps + l.cupApps` (Bytes 6+7) und
`l.leagueGoals + l.cupGoals` (Bytes 3+4). Wer Europapokal spielt, sieht im Remake weniger Spiele und Tore. Sicher: Sprungtabelle
cs:0x1001 (Bild 0x1FCD1) führt Spalte 6 nach 0x1F88C, Spalte 12 nach 0x1F9BA.

### E9 (A) STATUS-Spalte der Liste: RESERVE hat Vorrang vor VERL./GESP.
Original 0x1FA2C-0x1FA4E: zuerst `cmpb $0xb,%es:0xa(%bx); jbe 0x1fa50` - Nummer > 11 → "RESERVE" (4cb3:2310) in Gruppenfarbe;
erst danach Byte 9 & 3 (GESP./VERL. in Farbe 0x12). Ein verletzter oder gesperrter Ersatzmann (Nummer 12..) steht in der vollen
Liste (Kaderbildschirm, Vertragsansicht) als "RESERVE". (Die Einzelzeilen-Auffrischung 0x21E40 prüft umgekehrt zuerst Byte 9 & 3,
0x21EDF - dort hat das Remake recht.)
Remake main.ts:4644: `ef === 3 ? " " : ef === 2 ? "VERL." : ef === 1 ? "GESP.(n)" : ... l.number > 11 ? "RESERVE"` und Farbe `ef ? ROT`
- für beide Ansichten nach 0x21E40.

### E10 (A) Hilfszeile: Spalte ART ohne " (AUSGEL.)"
Original 0x1EF4A-0x1EF67: nach dem Positionsnamen `cmpb $0x0,%es:0xc(%bx); je; push %es:0x279a/0x2798; lcall strcat` - bei Kaderbyte 12 ≠ 0
(Leihspieler) steht "TORWART (AUSGEL.)" usw. Remake main.ts:2798: `if (nr === 18) return hilfe[18 + ...]` ohne Zusatz.

### E11 (A) Hilfszeile: Spalte STATUS mit anderen Texten
Original 0x1F172-0x1F2D8 (Spalte 14): "STATUS: " (4cb3:27A0) und dann
- Nummer > 11 → "RESERVE" (0x1F190, vor dem Flag);
- Byte 9 & 3 = 0 oder (= 1 und 4238:513E ≠ 0): Nummer ≠ 0 → "IM TEAM" (230C), Nummer 0 → "H[NGT HALT SO RUM..." (27A4) (0x1F2AF-0x1F2D8);
- = 1: "NOCH " + Byte 13 + " SPIELE " + "GESPERRT." (2640, 2644, 24F0 = 24F4 − 4·1);
- = 2: "VERLETZT " (24EC) + "(" + Verletzungsname 4cb3:23B4[Byte 23] über 0x3091:105D + ")" (0x1F25D-0x1F2AC);
- = 3: 24E8 ("UEFA-Pokal", so im Bild).
Remake main.ts:2803: `hilfe[22] + (ef & 2 ? "VERL." : ef & 1 ? "GESP." : l.number === 0 ? "" : l.number > 11 ? "RESERVE" : "IM TEAM")`.
Unterschiede: Sperre/Verletzung als Kurzwort statt Satz mit Dauer bzw. Verletzung; Nummer 0 leer statt "H[NGT HALT SO RUM...";
Reihenfolge wie E9. Gilt für Kader- und Vertragsansicht (beide über 0x1ECDE, Aufrufe 0x20571 und 0x25370).

### E12 (A) Hilfszeile: Erschöpfung auch bei offenem Spielfeld
Original 0x1F329: `cmpw $0xec,0xe(%bp); je` - "(ERSCH|PFUNG:" Byte 19 ")" nur bei rechtem Rand 236. Der Kaderbildschirm übergibt
0x20550-0x2055C: `cmpb $0x1,-0xa(%bp); sbb; inc; imul $0xffc3; add $0xec` = 236 − 61·[Merker -0xA], also 175 bei eingeblendetem Spielfeld
(so auch die Listenbreite im Remake, main.ts:2744 `this.pitchOpen ? 180 : 232`). Vertragsansicht (0x2535C: 239 bzw. 164) nie.
Remake main.ts:2808: Zusatz immer außer in der Vertragsansicht, auch mit offenem Spielfeld.

### E13 (A) Hilfszeile im Transfermarkt fehlt
Original 0x22C15 ruft bei 0x2305F 0x1ECDE für die linke Liste (x 2, y 36, rechter Rand 155, Hilfszeile y 190, Maske 0x90C6): Hover-Markierung
und Spaltenhilfe wie im Kaderbildschirm. Remake: `hoverZeile` (main.ts:2744) wertet nur `this.screen === "squad"` aus; `drawMarket` zeigt keine Hilfszeile.

### E14 (A) Farben der Liste im Transfermarkt
Original 0x1F7D5-0x1F813 (Spalte NAME): nur der **Name** in Farbe 0xB (#d2c2b2), wenn (Modus 1/2 oder Merker -0x5E) und Kaderbyte 9 & **0xC0**
und Spielerbyte 33 = 4238:5358 (aktueller Manager, vgl. 0x22FFF). Alle anderen Spalten und alle anderen Zeilen in der Gruppenfarbe
07B4[Gruppe]; eine Farbe für "abgelehnt" gibt es nicht.
Remake main.ts:6376: ganze Zeile `COLORS.highlight` (#ffff70) bei Byte 9 & 0x40; main.ts:6414: eigene Marktspieler ganze Zeile weiß
bzw. gelb, abgelehnte gedämpft (`textDim`).
Dazu ein Punkt: 0x1F75A-0x1F7CA setzt mit 0x3930:0x3CE (Einzelpixel, 0x37F46 schreibt ein Byte) einen Punkt bei (x + 07C5 − 3, y − 2)
hinter ART, wenn Kaderbyte 12 ≠ 0 (Leihspieler, alle Listen) oder in Modus 1/2 der Spieler dem aktuellen Manager gehört. Remake main.ts:6389
ausdrücklich "kein Leih- oder Angebotszeichen".

### E15 (A) Vertragsansicht: Zeilenfarben und V.DAUER
Original Modus 3 (0x1F695-0x1F6C1): Kaderbyte 24 in 1..99 → Farbe 3 (#717191) für die ganze Zeile; Bit 7 (Karriereende) → Farbe 0x11
(#910010). Name in Farbe 0xB, wenn i32@48 (Meldungszeiger) ≠ 0, (Byte 24 & 0x7F) > 99 und Modus 3 (0x1F818-0x1F835). V.DAUER (0x1FB59-0x1FBB8):
Byte 11 + " JAHR", "E" nur wenn das erste Zeichen > '1' - also "0 JAHR", "1 JAHR", "2 JAHRE"; keine eigene Farbe.
Remake main.ts:4638: `stur` = Byte 24 > 0 ohne Bit 7 (also auch 100 + Jahre, liegendes Angebot) → "#5151d3"; Bit 7 → Gruppenfarbe;
main.ts:4661: `jahre === 1 ? "" : "E"` ("0 JAHRE") und 0 Jahre rot.

### Unklar

- U2.1 Spaltengrenzen der Hilfszeile: aus 07C4 gerechnet (xoff = Maus-x − x0, erste Spalte mit Summe > xoff) liegen sie im Kaderbildschirm bei
  NR 6-16, ART 17-34, NAME 35-91, SP 92-105, ST[RKEN 106-141, TO 142-154, GK/RK 155-181, STATUS 182-221, TD 222-234; im Remake (main.ts:2779,
  "am 16.9. im Original ausgemessen") 35-93, 94-106, 107-142, 143-154, 155-179, 180-218, 219-237. Vertrag gerechnet: ART 6-23, NAME 24-80,
  SP 81-94, ST 95-106, TO 107-119, STATUS 120-159, TD 160-172, V.DAUER 173-197, GEHALT 198-230; Remake NAME 24-84, SP 85-89, ... GEHALT 201-237.
  Offen, ob die Mauskoordinate (Wort 2 von *4cb3:6DC0) Versatz hat; zur Klärung in DOSBox den Zeiger an eine gerechnete Grenze setzen.
- U2.2 Zahlformat von GEHALT/WERT: 0x076B:0x0681 nach ·4cb3:2252/·4cb3:224E (beide 1), bei 4cb3:224D ≠ 0 Präfix 4F78 und x + 8; ob Tausenderpunkte
  (4cb3:07B2) greifen, ist offen (schon in anzeigen.md:242 offen). Remake ohne Punkte.
- U2.3 Die Marktliste zeichnet Zeilen 0..12 (Argument 0xC), also Aufstellung 112 mit; das Remake nur 0..11 (MARKET_SIZE). Nur relevant, wenn 112 je belegt wird.
- U2.4 Bedingung "Name in 0xB" in Modus 3 hängt am Meldungszeiger i32@48, den das Remake nicht führt (Zweigbuch 251FF D4); Nachbau bräuchte einen Ersatz.
- Die Saisonende-Listen 0x0DBC6/0x0DE45 (0x0CB62, Modus 3) nicht einzeln gegen die Remake-Oberfläche geprüft; E8/E9/E15 gelten für jede Stelle, die diese Liste nachbildet.

## Teil 3: 0x1FDBE bis 0x224A8

Gelesen am 26.9.2026. Hinweis zur Disassembly: Nahaufrufe `call 0x2xxxx` im Segment 1ecd zeigen auf
0x1xxxx (z. B. `call 0x2ff36` bei 0x20EFC = 0x1FF36). Die Rohdaten nennen deshalb für 0x1FF36 und
0x1FFFA "0 Aufrufer"; tatsächlich ruft 0x20EFC die 0x1FF36 und 0x213A3/0x21552/0x21AEE/0x21BB7/0x21BC8
die 0x1FFFA.

Kaderplatz (52 Bytes, 4238:774A + 52·(25·Manager + Platz)): 0x7754 = Byte 10 (Rückennummer),
0x7759 = Byte 15 (Spieler), 0x7763/0x7764 = Byte 25/26 (Feldzelle). Alle Routinen hier arbeiten
auf der Liste 4238:304A (Manager am Zug, 4 = Markt).

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1FDBE | Kaderplatz entfernen: leerer Platz -> 1; fremder Spieler ohne Flag -> 0; Meldung freigeben; Plätze slot..count-1 bekommen den Nachfolger, Byte 15 von Platz count wird 0 | transfer.ts:removePlace | stimmt (Platz count selbst: Original löscht nur Byte 15, Remake den ganzen Platz; gleich, solange Platz 24/112 leer ist, s. unklar U3.3) |
| 0x1FEC9 | Starter (Byte 10 = 1..11, ohne Prüfung von Byte 15) auf Zelle (Spalte Byte 25, Reihe Byte 26) suchen, sonst 0x7F | lineup.ts:freieZelle (`belegt`), server.ts `/api/position` | stimmt |
| 0x1FF36 | Nur bei Byte 25 = 0xFF: Reihe 7 + 7·Pos/(−100) (idiv), 7 -> 6, erste freie Spalte 0..7, sonst nächste Reihe mit Umlauf | lineup.ts:freieZelle | stimmt |
| 0x1FFFA | Trikot eines Starters zeichnen (x 16·Spalte+0xC2, y 14·Reihe+0x63, Nummer) | web main.ts drawPitch | nicht nötig (Grafik) |
| 0x20105 | Einsatzregler zeichnen (Managerbyte 305) | web main.ts | nicht nötig (Grafik) |
| 0x20197 | Automatik aus: nur bei 079E > 1; Hinweis "Auto-Aufstellung ist deaktiviert !", 079E = 1 | server.ts `/api/position`, `/api/system` (System 1), Web-Client | stimmt (s. U3.4 zur Klickfläche) |
| 0x20230 | Kaderbildschirm (Zweigbuch 20230/20DBC) | Web drawSquad/pickRow, server.ts:uebernimmNummern, live.ts:applySubstitutions | Befund E17; Stichproben K1-K3, W1, W2, R5, R6 bestätigt |
| 0x2119D | Starter (Byte 10 1..11) in Platzreihenfolge 1.. neu nummerieren, ohne Prüfung von Byte 15 | lineup.ts:starterNummern | stimmt |
| 0x21328 | Trikots aller Starter zeichnen | web drawPitch | nicht nötig (Grafik) |
| 0x213B6 | Systemknöpfe zeichnen (079E − i = 2 hervorgehoben) | web | nicht nötig (Grafik) |
| 0x21567 | Zeigertext "ST[RKE:(16+17+18)/3, Alter JAHRE (Fuß 0x04D22)" | web main.ts:4713 | stimmt |
| 0x21696 | Taktikbrett: Systemknöpfe nur mit Arg 0x1A = 0 (außerhalb des Spiels) -> 079E = Knopf+1, 0x22030, 0x2119D; Feld: Spalte (x−0xC2)/16 ≤ 6, Reihe (y−0x63)/14 ≤ 7; aufnehmen/ablegen/tauschen von Byte 25/26; jeder Linksklick aufs Feld -> 0x20197 | server.ts `/api/system`, `/api/position` | stimmt (R6/R7) |
| 0x21E40 | Statusspalte: Flag Byte 9 & 3 (Flag 1 nicht bei 513E) -> 4cb3:22FC[Flag] ("GESP."+"("+Byte 13+")", "VERL.", " "); sonst 22FC[3 + (Nr ≥ 1) + (Nr > 11)] = " ", "IM TEAM", "RESERVE" | web main.ts:4655 | stimmt (Nr 0 und Flag 3 zeigen " ", Remake "" bzw. " " - gleiches Bild) |
| 0x22030 | Aufstellungsautomatik (Zweigbuch 22030, Emulatortest) | lineup.ts:autoLineup/aufstellungKern | stimmt (bewusst: kleine Bank, ABWEICHUNGEN) |
| 0x22305 | Spielerwahl | lineup.ts:selectPlace | stimmt (Zweig für Zweig nachgelesen: Richtung, `any` vor der Gruppenprüfung, erster Torwart mit −1 übersprungen, weitere Stärke 1, Endebedingungen in derselben Reihenfolge) |
| 0x224A8 | Aufnahme in eine Liste: Marktgrenze 12, Kaderzahl > Grenze−1 bei fremdem Verein, Einfügestelle, Platz genullt, Byte 15/19/14/20/11/12/16-18/40, Vereinswechsel (Spieler 34/35 = 0, 36 = Verein) | newgame.ts:addToSquad, transfer.ts:kaderVoll | Befund E16; Reihenfolge unklar U3.1 |

### Befunde

### E16 (S) Neuer Kaderplatz bekommt im Original keine Rückennummer

Original: 0x224A8 holt einen genullten 52-Byte-Block (0x2256D `lcall 0x3930:0x10C` mit 0x34, 1) und
kopiert ihn auf den Einfügeplatz (0x2265B `lcall 0x35AC:0x304A`); danach werden nur Byte 15
(0x2267B), 19 (0x22691), 14 (0x22695), 11/12 (0x226A9/0x226B0), 16-18 und 40 geschrieben. Byte 10
bleibt 0. Im ganzen Programm schreiben nur 0x9CF7/0x9D39 (Hauptmenü), 0x1DA59, 0x20230-Teile,
0x2119D, 0x2208B-0x222ED (Automatik) und 0x23727 (Platz vor dem Listen auf 0 gesetzt) Byte 10
(`grep 'mov .*,%es:0x7754('`). Der Kauf (0x23E86 -> 0x224A8, danach 0x23EEE-0x23F6A Byte 9/23/13/0/1/2,
0x23F7E Leihe: ganzer Marktplatz, dessen Byte 10 seit 0x23727 bzw. 0x224A8 null ist) vergibt also
keine Nummer; eine Nummer kommt nur über die Automatik (0x24114 `lcall 0x1ecd:0x3360`, bei
manuellem System wirkungslos) oder von Hand.

Remake: transfer.ts:403 (`takeBack`), transfer.ts:568 (`completePurchase`), transfer.ts:603
(`completeLoan`) rufen `assignNumber` (transfer.ts:108-116: "0x224A8 vergibt Nummern ab 12"), das
die kleinste freie Nummer ab 12 setzt - bei belegter Bank 16, 17, ...

Folge im Originalmodus bei manuellem System: der Neue steht im Remake als RESERVE (Nummer 12..15 ist
Ersatzbank fürs nächste Spiel, im Spiel einwechselbar, weil `applySubstitutions` nur Nummer 0
abweist - live.ts:700), im Original ohne Nummer ("Spieler ist nicht aufgestellt", 0x208E1).
Auch die Spielerinfo wechselt von "KANN SPIELEN, DARF ABER SCHEINBAR NICHT..." zu "HÜTET DIE
ERSATZBANK". Nummern über 15 räumt das Original zudem im Hauptmenü ab (0x9D07-0x9D39: > 4238:56EE
-> 0, vorher 0x9CBB: 16 -> 15, wenn keine 15 vergeben ist) und beim Kaderbildschirm (s. E17) -
beides fehlt im Remake. Doku falsch: SPIELMECHANIK.md:1888 "(0x224A8, Nummer ab 12)".
(Die 2026-Wege jugend.ts:561, abwerben.ts:189, seasonEvents.ts:80, server.ts:926 sind Version 2026.)

### E17 (S) Auswechslung: der Herausgenommene bekommt im Original die kleinste freie Nummer ab 12

Original: vor jedem Klick in die Liste setzt 0x20661 `movb $0xc,-0xba(%bp)`; die Schleife
0x20689-0x20809 wiederholt sich, solange ein Platz die Nummer -0xba trägt (0x207A3-0x207B1
`incb -0xba`, 0x20802 `jmp 0x20689`) - -0xba ist danach die kleinste nicht vergebene Nummer ≥ 12.
Herausnehmen (0x20B12-0x20B1E): `cmpb $0x1,0x6(%bp); sbb %al,%al; inc %al; mulb -0xba(%bp); mov
%al,%es:0x7754(%bx)` - im Spiel (Arg 6 ≠ 0) diese Nummer, außerhalb 0. Beim ersten Wechsel mit
voller Bank 12..15 bekommt der Ausgewechselte also 16, der Eingewechselte wird 11 (0x20EF2) und
dann neu nummeriert; beim zweiten Wechsel ist 12 frei geworden, der zweite Ausgewechselte bekommt
12. Die 16 räumt das nächste Hauptmenü auf 0 (0x9D07-0x9D39, da 15 vergeben ist). Nach dem Spiel
sitzen damit der zweite Ausgewechselte und die unbenutzten Ersatzleute auf der Bank, der erste
Ausgewechselte hat keine Nummer mehr.

Dieselbe Schleife schreibt außerhalb des Spiels jede Nummer > 4238:56EE (15) auf die kleinste
freie aus 12..15, sonst 0 (0x207DB-0x207F0, 0x206BA-0x20730). Das ist die Zeile "20681-207F5
unklar, nicht nachgebaut" des Zweigbuchs 20230.

Remake: der Kaderbildschirm tauscht nur Nummern (server.ts:1059 `uebernimmNummern`, Web
`pickRow`); der Ausgewechselte erhält die Nummer des Eingewechselten (12..15) und bleibt dauerhaft
auf der Bank. Unterschied für Manager mit manuellem System: nach einem Spiel mit Wechsel hat die
Bank im Original einen Mann weniger (der erste Ausgewechselte ist draußen), im Remake bleibt sie
bei vier und enthält ihn. Sicher, weil die Nummernvergabe allein an -0xba hängt und kein anderer
Schreiber von Byte 10 dazwischen liegt (Liste oben). Das Zweigbuch 20230 bewertete 20ACD-20B55 mit
"stimmt" nur nach erreichbaren Aufstellungen im Spiel, nicht nach dem Stand danach.

### Unklar

- **U3.1 Einfügestelle in 0x224A8.** Der Code fügt in jede Liste (auch die Managerkader) vor dem
  ersten Platz ein, dessen Spieler-Index ≥ dem neuen ist (0x22584 `cmp %al,%es:0x7759(%bx); jae`,
  Abbruch an einem leeren Platz oder bei Platz 24), und schiebt 23..i um eins nach hinten
  (0x225EC-0x2262F). Das Remake macht das nur für den Markt; Managerkader ordnet `sortIntoSquad`
  (lineup.ts:306) nach Mannschaftsteil, der Neue ans Ende seiner Gruppe (Begründung 0CB62.md:45).
  Da die Spielertabelle in den Ständen nach Gruppen geordnet ist, unterscheiden sich beide Regeln
  nur innerhalb einer Gruppe (Einfluss auf Gleichstände in 0x22305, Seitentausch, Nummernfolge).
  Gegen die Codelesung spricht RIED-CLI.MAN (Original) Manager 2: Stürmer 114, 122, 145, **120** -
  mit Index-Einfügung nicht erreichbar, und außer 0x224A8 schreibt nichts Byte 15 (nur
  Blockkopien). Zur Klärung fehlt ein Emulatorlauf von 0x224A8 (tools/emu-routine.py) mit einem
  Kader, in dem ein kleinerer Index nach einem größeren derselben Gruppe kommt, oder die Herkunft
  dieses Kaders.
- **U3.2 Grenze der Aufnahme.** 0x224A8 prüft die Kaderzahl gegen Arg 0x10 − 1; die Aufrufer geben
  0x18, im Jahrgangswechsel 0x19 (0xD306) und im Kauf 0x18 + -0xA(bp) (0x23E72). Das Remake prüft
  immer > 23 (`kaderVoll`) bzw. im Jahrgangswechsel gar nicht (seasonEvents.ts:179), und
  `addToSquad` nimmt nur Plätze 0..23 - das Original kann über die Verschiebung Platz 24 belegen.
  Randfall (25. Spieler), Kaufteil gehört zu 0x22C15.
- **U3.3 1FDBE, letzter Platz.** Nur gleich, solange Platz 24 (Kader) bzw. 112 (Markt) leer ist; nach
  U3.2 kann Platz 24 im Original belegt sein.
- **U3.4 Klickfläche 20638.** Geklärt für das Zweigbuch: jeder Linksklick, der weder eine Zeile
  (si = 0x7F), noch den Regler, noch das Taktikbrett trifft (0x21696 liefert 1 nur nach Ablegen
  oder Systemknopf), ruft 0x20197 und schaltet die Automatik ab. Das Remake kennt so einen Klick
  nicht; reine Bedienung, kein Befund.

Außerhalb des Bereichs bemerkt: die Nummernpflege des Hauptmenüs 0x9C78-0x9D40 (siehe E16/E17)
fehlt im Remake ganz.

## Teil 4: 0x2277A bis unter 0x242CF

Gelesen: all.s Zeilen 50745-53212, zur Klärung außerdem 0x1FDBE (Platz entfernen), 0x224A8
(Aufnahme, nur Rückgabewert und Würfel) und das Knopfpaar von 0x242CF. Remake-Stand: deccf74.

Segmenttabelle (4cb3:9E9C ff.): -0x6162/-0x6164/-0x6144/-0x6148/-0x614a/-0x6140 = 4238,
-0x6166/-0x6168/-0x615x = 4cb3. 4238:304A = Manager am Zug, 4238:2242+m·0x30A = Managersatz,
4238:774A+(m·25+p)·0x34 = Kaderplatz, 4238:8B9A+s·0x34 = Marktplatz, 4238:57DD+i·0x25 = Spieler.

### Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x2277A | Byte 14 = random(35,65), Byte 20 = random(1,13) \| random(1,3)<<4 \| random(0,1)<<7 (Reihenfolge so) | training.ts:149-150, training.ts:406-407, newgame.ts:150-151 (`addToSquad`) | stimmt |
| 0x227F1 | Jugendregler: 37.VGA (0,54) 50x41 bei (209,193), zwei Striche y 212/213 von x 217 bis 217+Wert, Betrag ((Wert+1)·10000>>4)·2252/224E mittig 211..261, y 223, Farbe 0x1D | main.ts:792-797 (`drawTraining`) | stimmt (Tausenderpunkte hängen am klebrigen 07B2, schon als unklar in anzeigen.md) |
| 0x22919 | Freie Bälle: Modus 0 → 20 − Σ Byte 321..324, Modus ≠0 → 10 − Σ Byte 326..329 (8-Bit-Summe), Byte 325 zählt nicht | training.ts:230 (`TRAINING_BUDGET`), main.ts:715-716, `setTraining` | stimmt |
| 0x22995 | Bälle zeichnen/löschen: Zeile 0/1 Leisten x 5/300, y 196−16k−19 (> 15), Zeilen 2..9 Balken x 31/210+16(k−1), y 36+37i, Zeile 8 Intensität x 31 y 190; Modus 0 stellt den Hintergrund aus (2,2) wieder her | main.ts:722-757 (`drawTraining`) | stimmt (Modus 0 braucht der Canvas nicht) |
| 0x22C15 22C15-22D8F | Aufbau: Tafeln, Überschriften, Knöpfe LEIHEN (175,110)/KAUFEN (245,110), Vorgabe KAUFEN (-0x8 = 0) | main.ts `drawMarket` | nicht nötig (Grafik) |
| 22C15 22DA3-22F57 | "Kontostand:" mit Kontostand·2252/224E, Tausenderpunkte (07B2 = 0), " DM" | main.ts `drawMarket`, gfx.ts:253 `dm` | stimmt |
| 22C15 22F5A-22FBA | Neuzeichnen des Kaders (0x1F37F) und **danach immer 0x22030** (Aufstellungsautomatik), auch beim Betreten | server.ts:3282 nur nach Kauf | **Befund E22** |
| 22C15 22FBF-2302F | Marktliste mit Manager 4 (0x1F37F, Modus Leihe+1), einmaliger Hinweis 0x76B:1416 auf 4238:2E70 | main.ts `drawMarket` | Liste: Teil 1F37F (andere Gruppe); Hinweis unklar |
| 22C15 23038-230F1 | Klickverteilung; Klick in Fläche 0x65 mit y > 109 kippt LEIHEN/KAUFEN, außer bei 4238:513C = 1964/1993 | main.ts:6433-6434 | stimmt (513C ist im Remake immer 22251) |
| 22C15 23114-233AC | Überfahren einer Marktzeile: "VON " + Vereinsname (Besitzer 4) **bzw. Managername in Großbuchstaben (0x3196D)** + ", " + Alter (Byte 26) + " J.", mittig 2..155 bei y 190 | main.ts:6447 | **Befund E26** |
| 22C15 23458-234A1 | Kaderspieler: Karriereende (Byte 24 Bit 7) meldet "Dieser Spieler hört am Saisonende auf." - **vor** der Angebotsprüfung | transfer.ts:371 (`listPlayer`); `saleOffer` prüft es nicht | **Befund E25** |
| 22C15 234AE-23652 | Angebot für Kaderspieler (Bit 6): Wert 0x24D4E(Platz,0)·random(85,150)/10000·100, Dialog 0x242CF, Bit 6 wird immer gelöscht, Meldungszeiger frei; VERKAUFEN: Ablöse aufs Konto, Platz entfernen (0x1FDBE, 24), **dann** Byte 22 und Stärken vom Platz lesen | transfer.ts:429-466 (`saleOffer`, `decideSale`) | Betrag stimmt; **Befund E18** |
| 22C15 23655-23797 | Auf den Markt setzen: eigene Marktspieler zählen (≥ 3 → "Schon 3 Spieler auf dem Transfermarkt"), Besitzer ≠ Manager → "Dieser Spieler ist nur ausgeliehen", Aufnahme 0x224A8 mit Manager 4 (Grenze 12), Nummer 0, Platz komplett kopiert, Kaderplatz entfernt | transfer.ts:368-389 (`listPlayer`) | Reihenfolge und Kopie stimmen; **Befund E19** (Würfel), **E27** (Text "Markt voll") |
| 22C15 2379A-23813 | Marktspieler rechts angeklickt: Info 0x15346 nur für eigene Spieler | - | nicht nötig (Bedienung) |
| 22C15 23816-23843 | Byte 3: Bit 0x80 und Bit des Managers → "Angebot wurde bereits abgelehnt" | transfer.ts:500 | stimmt (Bit ohne 0x80 kommt nicht vor, der Tagesverfall kippt nur das Managerbit) |
| 22C15 238AE-2397E | Angebot eingeben (8 Stellen), ·224E/2252 | main.ts `marketClick`/`fragZahl` | stimmt |
| 22C15 23981-23B1E | Eigener Marktspieler mit Angebot (Bit 7): Wert mit Manager 4 · random(67,110)/10000·100, Dialog, Bit 7 gelöscht; VERKAUFEN: Byte 22 **vor** dem Entfernen gelesen, Spieler 36 = Verein, 0x16E1A, Konto, 0x1FDBE(12), Besitzer 5. Ohne Angebot: Zurückholen (-0xA = 1) | transfer.ts:429-466 | stimmt |
| 22C15 23B22-23B5A | Angebot ≠ 0 und Konto ≥ Angebot (32 Bit signed), sonst "Sie haben nicht genug Geld" | transfer.ts:502-503 | stimmt |
| 22C15 23B7D-23C9E | Spieler eines anderen Managers: Wert 0x24D4E mit Manager 4, bei LEIHEN /3; Fehler nur bei Angebot < Wert·60/100 **oder > Wert·140/100** | transfer.ts:504-507 | **Befund E20** |
| 22C15 23CA1-23E23 | Frage an den Besitzer "NEHMEN SIE DAS ANGEBOT (X DM) FÜR Name AN ?" NA GUT./NEIN !; bei Ja Spielerbytes 28/29/30 = Marktplatz 16/17/18 | server.ts:3336-3370, transfer.ts:549-554 | stimmt (Ablauf über den Tageswechsel: SPIELMECHANIK) |
| 22C15 23E28-23E55 | KI-Spieler: 0x248E1 entscheidet | transfer.ts:509-513 | Teil 248E1 (andere Gruppe) |
| 22C15 23E58-23EE2 | Aufnahme 0x224A8 (Grenze 24, beim Zurückholen 25; Byte 12 = 0x63 bei LEIHEN), bei 0x7F Ende ohne Weiteres; Kauf (nicht Leihe, nicht Zurückholen): Vertragsdialog 0x251FF | transfer.ts:514-526, server.ts:3252-3280 | **Befund E23**, **E24** |
| 22C15 23EE5-23F6C | Kauf von einem Manager: Byte 9 (**ungefiltert**), 23, 13, 0, 1, 2 vom Marktplatz | transfer.ts:558-565 | **Befund E21** |
| 22C15 23F6F-23FFA | Zurückholen **oder** LEIHEN: ganzer Marktplatz kopiert (Byte 9 ungefiltert); bei LEIHEN (auch beim Zurückholen!) Byte 11 = 1, Byte 12 = Verein + 0x80, Gehalt aus 0x224A8, Bytes 3..5 = 0 | transfer.ts:392-410 (`takeBack`), 582-609 (`completeLoan`) | **Befund E21**, **E19**, **E28** |
| 22C15 23FFF-240A9 | Marktplatz entfernen (0x1FDBE mit Manager 4, 12); Kauf/Leihe vom Manager: Betrag an den Besitzer, Spieler 36 = Verein des Käufers; Besitzer = Käufer außer bei Leihe | transfer.ts:566-575, 600-608 | stimmt |
| 22C15 240B1-24119 | Abbuchen; **nur bei KI-Kauf und KI-Leihe** Sponsor-Zuschuss 0x0272D; danach 0x22030 über das Neuzeichnen | server.ts:3285 | **Befund E23**, E22 |
| 22C15 2411C-241B5 | Vertrag abgebrochen: Kaderplatz wieder entfernen, Spieler 36 zurück, "Der Transfer findet nicht statt", Ablehnungsbit nur ohne -0x78 (nicht bei Kauf vom Manager); Ablehnung (248E1 = 0 oder NEIN !): "Ihr Angebot wurde abgelehnt", Bit | transfer.ts:532-535, server.ts:3264/3274/3343 | **Befund E24** |
| 22C15 241B7-2429F | Meldungen, Zeilenmarke löschen | - | nicht nötig (Grafik) |
| 22C15 2429F-242CE | Ende (0x66): Bild zurück, 0x0F9D2 (Stärke des Managers) | server.ts:3471 (`/api/verlassen`) | stimmt |

### Befunde

### E18 (S) Verkauf eines Kaderspielers: Verein und Stärkung kommen vom Nachrücker

Original 0x235B0-0x2364E: nach der Gutschrift wird der Platz zuerst entfernt,
`235d4 push 0x18; push 1; push si; lcall 1ecd:10ee` (0x1FDBE: Plätze si..23 rücken auf), und
erst **danach** über den unveränderten Zeiger -0x24 (= Kaderplatz si, gesetzt bei 0x23474)
gelesen: `235e5 les -0x24(%bp),%bx; mov %es:0x16(%bx),%al; mov %ax,%di; mov %ah,%es:0x16(%bx)`,
`235f4 ... mov %al,%es:0x5801(%bx)` (Spieler -0x2 Byte 36 = di), dann Schnitt aus
`%es:0x10/0x11/0x12(%bx)`/3 und `lcall 14a4:23da` (0x16E1A mit Verein di). Auf Platz si steht
zu diesem Zeitpunkt der nachgerückte Spieler (0x1FDBE kopiert Platz i+1 nach i; Richtung an
0x2373D belegt: erstes Argument = Quelle). Also: der verkaufte Spieler bekommt als Verein das
Byte 22 des Nachrückers (ohne dessen Angebot meist 0 oder Rest), dieser Verein wird mit den
Stärken des Nachrückers gestärkt, und ein Angebotsverein des Nachrückers wird auf 0 gesetzt. War
der Verkaufte der letzte, liest das Original den Rest des geleerten Platzes.
Beim Marktspieler (0x23A6A) liest das Original Byte 22 dagegen **vor** 0x1FDBE (0x23AEA) - dort
ist es richtig.
Remake transfer.ts:455-462 (`decideSale`) liest Stärken und Byte 22 vor `removePlace` und
gibt den Spieler an den anbietenden Verein. Andere Vereinszuordnung (Spieler 36), andere
Vereinsstärkung (Vereinsmatrix) und anderes Byte 22 beim Nachrücker.

### E19 (S) Auf den Markt setzen und Zurückholen würfeln im Original fünfmal

Original 0x236F2: `lcall 1ecd:37d8` = 0x224A8 mit Manager 4; Zurückholen 0x23E86 ebenso (Grenze
25). 0x224A8 würfelt immer: `22687 lcall 76b:cc7` mit (0x50,0x78) → Byte 19, dann
`2269c lcall 2277:a` = 0x2277A (random(35,65), random(1,13), random(1,3), random(0,1)), dann
0x24D4E(Platz, 1) (bei Byte 9 = 0 ohne Wurf). Die Werte werden anschließend von der Kopie des
Kader- bzw. Marktplatzes überschrieben (0x2373D, 0x23FA8), die Würfe sind aber verbraucht.
Remake transfer.ts:368-389 (`listPlayer`) und 392-410 (`takeBack`) kopieren ohne `rng`. Die
Zufallsfolge des Raums verschiebt sich um fünf Würfe je Aktion (alle folgenden Würfe desselben
Tages anders). Bei LEIHEN im Zurückholen würfelt 0x24D4E mit Flag 3 ebenfalls nicht mehr (Byte 9 = 0).

### E20 (S) Obergrenze beim Angebot an einen anderen Manager: genau 140 % ist erlaubt

Original 0x23BF0-0x23C1D: Grenze = Wert·140/100 (`mov $0x8c,%ax ... lcall 3a01:1ae6; lcall
3a01:1a4c`), dann `cmp -0x4(%bp),%dx; jle 23c16` / `23c16: jl 23c20` /
`cmp -0x6(%bp),%ax; jb 23c20` / sonst `jmp 23ca1`: Fehler nur, wenn Grenze < Angebot. Untere
Grenze (0x23BE4): Fehler nur, wenn Wert·60/100 > Angebot.
Remake transfer.ts:506: `amount >= div(value * 140, 100)` → Fehler. Ein Angebot von genau
Wert·140/100 lehnt das Remake ab, das Original legt es dem Besitzer vor.

### E21 (S) Byte 9 wird beim Kauf vom Manager und bei der Leihe ungefiltert übernommen

Original 0x23EEE: `mov %es:0x9(%bx),%al` → `mov %cl,%es:0x7753(%bx)` (Kaderplatz Byte 9 =
Marktbyte 9, ohne Maske); Leihe und Zurückholen 0x23FA8: ganzer Platz per `lcall 35ac:304a`,
danach kein Zugriff auf Byte 9.
Remake transfer.ts:559 `n.setU8(9, market[9] & 0x3f)` und transfer.ts:594 `bytes[9] &= 0x3f`
(beim Zurückholen transfer.ts:401 ohne Wirkung, weil dort Bit 7 nie gesetzt ist).
Wirksam, wenn der Marktspieler eines Managers ein offenes KI-Angebot hat (Bit 7, 0x0DF0D): im
Original trägt der Käufer/Entleiher das Bit im Kader weiter. Das Bit ändert den Marktwert
(value.ts:76-79: ·130/100 bei Byte 22 > 63, sonst ·random(95,100)/100 - also auch ein Wurf) bis
zum Löschen am Saisonende (0x0CB62, Byte 9 &= 0x3F).

### E22 (S) Aufstellungsautomatik bei jedem Neuzeichnen des Kaders

Original 0x22F5A-0x22FBA: ist -0x2A gesetzt, zeichnet 0x1F37F den Kader und ruft danach
`22fba lcall 1ecd:3360` (0x22030; bei manuellem System sofort Ende). -0x2A ist beim Betreten
gesetzt (0x22C2F) und nach Verkauf eines Kaderspielers (0x2364E), Aufnahme in den Markt
(0x2375B) sowie jedem Kauf, jeder Leihe und jedem Zurückholen (0x240AE).
Remake: nur nach dem Kauf mit Vertrag (server.ts:3282). `/api/market/list` (3156),
`/api/market/decide` (3186), `/api/market/takeback` (3169), Leihe (`/api/market/buy` "done",
3229 ff.; Leihe unter Managern 3358) und das Öffnen des Bildschirms rufen `autoLineupIfEnabled`
nicht. Nach Abgabe eines Starters fehlt bei eingeschalteter Automatik bis zum nächsten Aufruf
(Tagesroutine) die Nummer, der Neue auf der Leihe bekommt keine.

### E23 (S) Sponsor-Zuschuss 0x0272D: bei KI-Leihe ja, bei Kauf vom Manager nein

Original 0x240DB: `cmpb $0,-0xa; jne 24114; cmpb $0,-0x78; jne 24114` - Abbuchung und
`2410d lcall 0:272d` (random(0,6), ggf. random(20,65)) laufen genau bei Kauf **und Leihe** eines
KI-Spielers (-0x78 = 0); beim Kauf/der Leihe vom Manager (-0x78 = 1) nur Abbuchung bei 0x240B7.
Remake server.ts:3285: `sponsorSubsidy` nur in `/api/market/contract` - also bei jedem Kauf mit
Vertrag, auch vom Manager (über `/api/market/answer` → `room.purchases`), und nie bei einer
KI-Leihe. Folge: Würfe und ggf. Geld an der falschen Stelle.

### E24 (S) Abgebrochener Kauf und voller Kader

a) Kader voll: 0x224A8 liefert 0x7F (`224fa mov $0x7f,%al`), 0x23EBA springt nach 0x2411C und
dort `cmp $0x7f,%di; jne 24124; jmp 241df` - nur die Meldung "Schon 24 Mann im Team" aus 0x224A8,
**kein** Ablehnungsbit, keine zweite Meldung. Remake transfer.ts:515-516 und server.ts:3349-3351
setzen per `cancelPurchase` das Ablehnungsbit (der Spieler ist danach für diesen Manager
gesperrt, bis das Bit mit 1/3 täglich verfällt). **D:** docs/abgleich/restroutinen.md:78 (R2)
behauptet "der Kauf endet wie ein abgelehnter (0x2411C)" - falsch, 0x2411C überspringt bei 0x7F alles.

b) Vertrag abgebrochen (0x251FF = 0): der Spieler steht zu dem Zeitpunkt schon im Kader
(0x224A8 bei 0x23E86 vor dem Dialog). 0x24124 entfernt ihn wieder und setzt Spieler 36 zurück
(`mov -0xc(%bp),%al; mov %al,%es:0x5801(%bx)`), die in 0x224A8 bei Vereinswechsel gelöschten
Spielerbytes 34/35 (0x22750-0x2275B: Ligatore/-einsätze) bleiben gelöscht; die fünf Würfe aus
0x224A8 sind verbraucht; Meldung "Der Transfer findet nicht statt". Das Ablehnungsbit kommt nur
ohne -0x78 (`24168 cmpb $0,-0x78(%bp); jne 24197`), also **nicht** beim Kauf von einem Manager;
bei dem sind außerdem Spielerbytes 28/29/30 schon vom Marktplatz überschrieben (0x23DE8).
Remake: `cancelPurchase` (server.ts:3264, 3274) setzt das Bit immer, würfelt nicht, lässt
34/35 und (beim Managerkauf) 28/29/30 unberührt. Außerdem liegen die Würfe von 0x224A8 im
Original vor dem Vertragsdialog (und damit vor dem Wurf in `contractCheck`), im Remake
(`completePurchase` → `addToSquad`) danach.

### E25 (S, selten) Karriereende sperrt im Original auch das Verkaufsangebot

Original 0x2347A: `testb $0x80,%es:0x18(%bx); je 234a4` → sonst Meldung 4cb3:4D74 "Dieser
Spieler hört / am Saisonende auf." und Ende - vor der Prüfung auf Bit 6 (0x234AE).
Remake main.ts:6390/6496 schickt bei Bit 6 `/api/market/offer`; `saleOffer` (transfer.ts:429)
prüft Byte 24 nicht. Ein Spieler mit Karriereende und noch offenem Angebot (Angebot vor dem
Setzen von Bit 7 entstanden und noch nicht verfallen) ist im Remake verkaufbar, im Original nicht.
Ob der Fall im Spiel entsteht, hängt davon ab, wann Byte 24 Bit 7 gesetzt wird (nicht Teil dieses Bereichs).

### E26 (A) "VON"-Zeile beim Marktspieler eines Managers

Original 0x2325E: nur bei Besitzer 4 der Vereinsname (`add $0x3066` auf 4238, 0x22 je Verein);
sonst `lcall 3091:105d` (0x3196D: Großbuchstaben-Kopie) auf den Managersatz 4238:2242+Besitzer·0x30A
= Managername. Text "VON <MANAGER>, <Alter> J." mittig 2..155 bei y 190 (0x2335E ff.).
Remake main.ts:6447 zeigt immer `clubName(sel.club)` (Spielerbyte 36) bei (163,135); der
Managername steht nur als eigene Zeile darunter (main.ts:6461).

### E27 (A) Meldung bei vollem Markt

Original: 0x224A8 mit Grenze 12 (`224b8 cmpb $0xc,0x10(%bp)`, Platz 11 belegt) meldet
4cb3:4D2C/4D30 "Schon 12 Mann auf / dem Transfermarkt". Remake transfer.ts:377: "Der
Transfermarkt ist voll" (kein Originaltext).

### E28 (S) Zurückholen bei gewähltem LEIHEN wird zur Leihe

Original 0x23F6F-0x23FFA: die Nachbehandlung hängt an `cmpb $0,-0x8(%bp)` (Schalter LEIHEN),
nicht an -0xA: ist beim Zurückholen LEIHEN gewählt, setzt das Original Byte 11 = 1, Byte 12 =
eigener Verein + 0x80 (Leihmarke), Gehalt = Wert aus 0x224A8 mit Flag 3 (0x23E79: `mov $0x63,%al;
imulb -0x8(%bp)` → Byte-12-Argument 0x63 → 0x226EE Flag 3, ein Drittel), Bytes 3..5 = 0; Besitzer
bleibt der Manager (0x24089), kein Geld. Remake transfer.ts:392-410 (`takeBack`) kennt den
Schalter nicht (main.ts:6482 schickt ihn nicht mit) und übernimmt den Platz unverändert.
Folge im Original: Vertrag 1 Jahr, Gehalt gedrittelt, Byte 12 wird am Saisonende gelöscht.

### Unklar

- 0x2300F-0x2302F: beim ersten Aufbau `lcall 76b:1416` mit dem Zeiger 4238:2E70/2E72 (Argument 1).
  Was dort steht (Hinweistext?) und ob das Remake es zeigt, habe ich nicht geklärt; nur Anzeige.
- 0x1FDBE mit Anzahl 24 bzw. 12 kopiert Platz 24 (bzw. Markt 112) nach 23 (111) und löscht von
  Platz 24 (112) nur Byte 15; `removePlace` nullt den ganzen letzten Platz. Nur Restbytes leerer
  Plätze, wirkt aber mit E18 zusammen (der Verkaufte als Letzter liest Byte 22 dieses Rests).
- Außerhalb meines Bereichs aufgefallen (0x224A8, Teil 3): die Aufnahme sortiert auch bei
  Managern nach Spielernummer ein (0x22584: erster Platz mit Nummer ≥ neuer oder leer, Nachschieben
  ab 23), das Remake (`addToSquad` → `sortIntoSquad`) nach Mannschaftsteil. Bitte dort prüfen.
- Bedienung ohne Befund: das Remake fragt vor "auf den Markt setzen" und "zurückholen" nach
  (main.ts:6482, 6497), das Original nicht; Überfahren statt Anklicken für die VON-Zeile.

