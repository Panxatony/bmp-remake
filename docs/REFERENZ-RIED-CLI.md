# Referenzwerte aus dem Original für RIED-CLI.MAN

Vom Spieler am 2026-09-06 aus dem laufenden Original abgelesen. Dient als
Sollwert für Tests und Felddeutung. Manager NORMI, 1.FC Nürnberg, Saison 1997.

## Ihre Mannschaft (Manager NORMI)

Spalten: Nr, Art, Name, Spiele, Kondition, Technik, Form, Tore, Gelbe Karten,
Rote Karten, Status. Fußzeile "KONDITION,TECHNIK,FORM (80)".

| Nr | Art | Name | SP | Ko | Te | Fo | TO | GK | RK | Status |
|---:|-----|------|---:|---:|---:|---:|---:|---:|---:|--------|
| 1 | TOR | KÖPKE | 17 | 89 | 97 | 55 | 0 | 3 | 0 | IM TEAM |
| 2 | ABW | DITTWAR | 17 | 92 | 76 | 57 | 1 | 0 | 0 | IM TEAM |
| 12 | ABW | FRIEDMANN | 0 | 77 | 71 | 53 | 0 | 0 | 0 | RESERVE |
| 13 | ABW | ZIETSCH | 1 | 65 | 77 | 56 | 2 | 0 | 0 | RESERVE |
| 3 | ABW | KREUZER | 6 | 75 | 90 | 59 | 1 | 0 | 0 | IM TEAM |
| 4 | ABW | OTTEN | 16 | 81 | 88 | 56 | 1 | 0 | 0 | IM TEAM |
| 5 | MIT | BÄURLE | 17 | 72 | 87 | 53 | 5 | 0 | 0 | IM TEAM |
| 14 | MIT | DORFNER | 4 | 63 | 83 | 57 | 0 | 0 | 0 | RESERVE |
| 6 | MIT | L.SCHMIDT | 14 | 97 | 93 | 52 | 2 | 0 | 0 | IM TEAM |
| 7 | MIT | PFLIPSEN | 17 | 96 | 61 | 56 | 3 | 0 | 0 | IM TEAM |
| 8 | MIT | SCHÜTTERLE | 17 | 96 | 56 | 57 | 6 | 0 | 0 | IM TEAM |
| 15 | ANG | ECKSTEIN | 4 | 78 | 72 | 53 | 0 | 0 | 0 | RESERVE |
| 9 | ANG | WIRSCHING | 15 | 58 | 98 | 57 | 3 | 2 | 0 | IM TEAM |
| 10 | ANG | ZARATE | 15 | 68 | 87 | 51 | 3 | 2 | 0 | IM TEAM |
| 11 | ANG | B.WINKLER | 15 | 61 | 92 | 56 | 3 | 1 | 0 | IM TEAM |

Zuordnung (bestätigt): Kaderplatz-Datensatz (52 Bytes) Byte 15 = Spielerindex,
Byte 10 = Nr, Byte 16..18 = Ko/Te/Fo, Byte 1 = GK, SP = Byte 6 + Byte 7,
TO = Byte 3 + Byte 4. (ZIETSCH: TO 0, auf dem zweiten Bild eindeutig lesbar.)
Art aus Spielerdatensatz Byte 31: 0..24 TOR, 25..49 ABW, 50..74 MIT, 75..99 ANG.

## Transfermarkt

| Art | Name | Ko | Te | Fo | Wert |
|-----|------|---:|---:|---:|-----:|
| ABW | SUNDERMANN | 50 | 32 | 47 | 527.000 DM |
| ABW | ANDERBRÜGGE | 79 | 85 | 55 | 866.000 DM |
| ABW | FACH | 36 | 42 | 54 | 466.000 DM |
| MIT | GRÜNDEL | 87 | 99 | 48 | 1.083.000 DM |
| ANG | K.ALLOFS | 21 | 28 | 50 | 323.000 DM |

Kontostand: 973.860 DM (Managerdatensatz Byte 496, i32, bestätigt).
Spielerdatensatz Byte 28..30 = Ko/Te/Fo für Sundermann, Gründel, K.Allofs
bestätigt. Anderbrügge (Spieler des eigenen Vereins auf dem Markt) weicht ab,
Anzeige eigener Marktspieler = Marktwert (0x24D4E), KI-Spieler = gespeicherter Preis (i32 bei 40).
Marktwert-Formel: docs/SPIELMECHANIK.md, "Marktwert".

## Stärken Bundesliga

| Pl | Verein | Ko | Te | Fo |
|---:|--------|---:|---:|---:|
| 1 | Borussia Dortmund | 91 | 83 | 51 |
| 2 | VfB Stuttgart | 79 | 90 | 52 |
| 3 | 1.FC Nürnberg | 78 | 86 | 54 |
| 4 | FC Bayern München | 79 | 92 | 48 |
| 5 | Mönchengladbach | 80 | 89 | 49 |
| 6 | VfB Oldenburg | 86 | 79 | 52 |
| 7 | FC Schalke 04 | 88 | 81 | 48 |
| 8 | VfL Bochum | 85 | 77 | 51 |
| 9 | BW 90 Berlin | 80 | 83 | 48 |
| 10 | Eintracht Frankfurt | 72 | 85 | 51 |
| 11 | FC St.Pauli | 86 | 74 | 47 |
| 12 | Wattenscheid 09 | 79 | 78 | 49 |
| 13 | SV Werder Bremen | 80 | 75 | 51 |
| 14 | Stuttgarter Kick. | 76 | 78 | 50 |
| 15 | Bayer Leverkusen | 75 | 76 | 51 |
| 16 | SVW Mannheim | 76 | 69 | 50 |
| 17 | Hertha BSC | 72 | 71 | 51 |
| 18 | 1.FC Kaiserslautern | 65 | 73 | 50 |

Nicht direkt in den Vereinsdatensätzen enthalten (Werder: Bytes 23..33 =
48 89 73 83 80 71 79 52 50 52 0), also berechnet. Formel offen.

## Tabelle Gesamt, 15. Spieltag

| Pl | Verein | Bilanz | SP | S | U | N | Punkte | Tore | Diff |
|---:|--------|--------|---:|--:|--:|--:|--------|------|-----:|
| 1 | 1.FC Nürnberg | sUsNsNus | 15 | 8 | 4 | 3 | 20:10 | 23:15 | +8 |
| 2 | VfB Stuttgart | SnSsSsNu | 14 | 7 | 4 | 3 | 18:10 | 22:13 | +9 |
| 3 | FC Bayern München | sSsUnSsS | 15 | 8 | 2 | 5 | 18:12 | 21:16 | +5 |
| 4 | Mönchengladbach | nNUuSuSu | 14 | 6 | 5 | 3 | 17:11 | 17:13 | +4 |
| 5 | SVW Mannheim | UuUUnUUN | 15 | 3 | 10 | 2 | 16:14 | 18:15 | +3 |
| 6 | Borussia Dortmund | SnUUuNsU | 15 | 4 | 8 | 3 | 16:14 | 19:19 | 0 |
| 7 | Hertha BSC | UsNuUsNs | 15 | 4 | 8 | 3 | 16:14 | 16:18 | -2 |
| 8 | FC Schalke 04 | sUsNsUsN | 14 | 5 | 5 | 4 | 15:13 | 15:11 | +4 |
| 9 | Eintracht Frankfurt | SusSuNuU | 14 | 5 | 5 | 4 | 15:13 | 14:12 | +2 |
| 10 | BW 90 Berlin | sNsUnUuN | 15 | 4 | 7 | 4 | 15:15 | 19:17 | +2 |
| 11 | SV Werder Bremen | NsSnSnNs | 15 | 7 | 0 | 8 | 14:16 | 24:29 | -5 |
| 12 | VfB Oldenburg | NuNuuSsN | 14 | 4 | 5 | 5 | 13:15 | 16:17 | -1 |
| 13 | Stuttgarter Kick. | NuUsNnUu | 15 | 4 | 5 | 6 | 13:17 | 14:16 | -2 |
| 14 | Bayer Leverkusen | uNnUsuUs | 15 | 3 | 7 | 5 | 13:17 | 16:21 | -5 |
| 15 | Wattenscheid 09 | UsNsNuUn | 15 | 4 | 4 | 7 | 12:18 | 22:26 | -4 |
| 16 | VfL Bochum | uNuNsUsN | 15 | 3 | 6 | 6 | 12:18 | 14:19 | -5 |
| 17 | 1.FC Kaiserslautern | NnNnUUsN | 15 | 3 | 5 | 7 | 11:19 | 12:19 | -7 |
| 18 | FC St.Pauli | NsNnNuUu | 14 | 2 | 6 | 6 | 10:18 | 14:20 | -6 |

Tabellendatensatz (54 Bytes, Index = Vereinsindex), bestätigt mit GESAMT und HEIM:
Byte 0/1 Punkte Heim/Auswärts, 4..12 Bilanz-Text (klein = Heim, groß = Auswärts),
22/23 Tore Heim/Auswärts, 26/27 Gegentore Heim/Auswärts, 30/31 Spiele Heim/Auswärts,
38/39 Siege Heim/Auswärts, 42/43 Niederlagen Heim/Auswärts. Jeder Wert doppelt
(2/3, 13..21, 24/25, 28/29, 40, 44), wohl Stand des Vorspieltags. Byte 46 und
50..51 offen (Nürnberg 0 und 154, Werder 10 und 359).
Werder: [10 4 10 4] Text Text [15 9 15 9 14 15 14 15 8 7 0 0 0 0 0 0 5 2 5 0 3 5 3 0 10 0 0 0 103 1 0 0]
Nürnberg: [15 5 15 5] Text Text [15 8 15 8 3 12 3 12 8 7 0 0 0 0 0 0 7 1 7 0 0 3 0 0 0 0 0 0 154 0 0 0]

## Stadion (1.FC Nürnberg)

| | Momentan | Nach Ausbau | Dauer |
|---|---:|---:|---|
| Gesamtkapazität | 24.000 | 26.000 | |
| Sitzplätze | 8.000 | 10.000 | 10 Wochen |
| Stehplätze | 16.000 | 16.000 | |
| Überdachte Plätze | 0 | 2.000 | 7 Wochen |
| Flutlicht | klein | klein | |
| Anzeigetafel | klein | klein | |
| Zustand | befriedigend | befriedigend | |
| Komfort | ausreichend | ausreichend | |
| Eintrittspreis | 19 DM | 19 DM | |

Managerdatensatz: Byte 348 (i16) = Eintrittspreis 19, Byte 350 (i32) =
Sitzplätze 8000, Byte 354 = Ausbau Sitzplätze +2000, Byte 358 = Stehplätze
16000, Byte 362 = Ausbau Stehplätze 0, Byte 366 = überdachte Plätze 0,
Byte 370 = Ausbau überdachte +2000. Gesamtkapazität = Sitz + Steh (berechnet).
Wochen (10, 7), Flutlicht, Anzeigetafel, Zustand, Komfort: offen.

## Sonstiges

Meldung für BLACKY vom 7. November 1997 (BENATELLI, Vertrag 1 auf 2 Jahre).
Block bei Save-Offset 27960 enthält 11, 10, 1997, 105: Tag 11, Monat 10 (0-basiert,
also November), Jahr 1997 (bestätigt über das Hauptmenü: Samstag, 11. November 1997).
105 ist offen (Tag der Saison?). Der Spieltag (15) steht woanders.

## Hauptmenü

Kopf: Titelgrafik, Managerbild, Feld "DFB-Pokal" (nächster Termin) mit
Verlaufsdiagramm, Managername NORMI, Vereinswappen 1. FCN, Kalenderblatt
"Samstag 11. November 1997".
Symbole in 3 Zeilen x 5 Spalten (Spalte 4 ist überall leer, Spinnennetz):
Zeile 1: Schreibtisch (Büro), Kalender mit Kurve (Statistik), Stadion, leer, Pokal.
Zeile 2: Wappen (Vereine/Stärken), aufgeschlagenes Buch (Tabelle), Bank mit Geld (Finanzen), leer, Diskette (Speichern).
Zeile 3: Trikots (Mannschaft), Pokale (Wettbewerbe), Geld und Verträge (Transfermarkt), leer, Gesicht (Manager/Beenden).
Die 38x38-Bilder in PIC/ sind die Vereinswappen.

## Werbung (Manager NORMI)

Trikotwerbung 279.741 DM, Bandenwerbung 371.425 DM, TV-Übertragung 124.000 DM,
Werbeausgaben 20.000 DM, Summe 755.166 DM. Sponsoren: KBC, Commodore, chemie, Foto Oka.
Bestätigt: Werbetabelle (Save-Offset 33918) je Manager 9 x i32: Trikot, 6 Banden
(Summe = Bandenwerbung), TV, Werbeausgaben.

## Statistik (Manager NORMI)

Serien (aktuell/Rekord) Gesamt, Heim, Auswärts: Gewonnen 1(8) 1(17) -(4);
Verloren -(4) -(2) 2(4); Unentschieden -(3) -(3) -(3); Nicht gewonnen -(7) -(6) 4(6);
Nicht verloren 2(12) 29(29) -(7); Ohne Gegentor 1(5) 1(11) -(2); Ohne Torerfolg -(3) -(1) -(4);
Tore/Spiel 1.5 1.8 1.1; Gegentore/Spiel 1.0 0.3 1.7.
Rekorde: höchster H-Sieg 7:0 (Arminia Bielefeld), höchste H-Niederlage 1:3 (Fortuna
Düsseldorf), erzielte H-Tore 7 (Arminia Bielefeld), kassierte H-Tore 3 (FC Remscheid),
höchster A-Sieg 4:0 (Chemnitzer FC), höchste A-Niederlage 1:8 (VfL Osnabrück),
erzielte A-Tore 4 (Chemnitzer FC), kassierte A-Tore 8 (Wormatia Worms).
Zuschauer: Besucherzahl 171.302, Schnitt 21.412, benötigter Schnitt 10.722,
Rekord 24.000 (BW 90 Berlin), Minuskulisse 12.747 (VfB Stuttgart).
Finanzen: Kontostand 973.860 DM, Schulden 0 DM. Einnahmen/Monat 883.584 DM,
Ausgaben/Monat 1.172.205 DM.
Bestätigt im Managerdatensatz: Byte 484 Besucherzahl, 488 Zuschauerrekord,
492 Minuskulisse, 500 und 504 die Gegnerindizes dazu (13, 12).

## Taktik (Manager NORMI)

Aufstellung 3-4-3: Tor 1; Abwehr 2, 3, 4; Mittelfeld 8, 5, 7, 6 (von links);
Angriff 9, 10, 11. Rechts oben ein Regler "EINSATZ" (Skala grün bis rot) und
ein Symbol für Auswechslungen. Unten drei Formationsvorlagen als Punktmuster.
Die Anordnung auf dem Feld folgt der Art (TOR/ABW/MIT/ANG) der elf Spieler mit
Rückennummer 1 bis 11; Kaderplatz Byte 26 wird im Code mit 75/7 skaliert,
vermutlich die Höhe auf dem Feld.

## Verträge (Manager NORMI)

Spalten: Art, Name, SP, ST (Durchschnitt der drei Stärken), TO, Status, TD,
Vertragsdauer, Gehalt pro Monat. Fußzeile z.B. "KÖPKE, 24 JAHRE ALT, 15 LIGASPIELE",
"NAME: KÖPKE (24 JAHRE) (R)". Weitere Spielerdetails gibt es im Spiel nicht.

| Name | ST | Vertrag | Gehalt |
|------|---:|--------:|-------:|
| KÖPKE | 80 | 2 Jahre | 21.605 DM |
| DITTWAR | 75 | 2 | 7.546 |
| FRIEDMANN | 67 | 4 | 33.078 |
| ZIETSCH | 66 | 2 | 10.010 |
| KREUZER | 74 | 2 | 21.460 |
| OTTEN | 75 | 1 | 26.752 |
| BÄURLE | 70 | 3 | 4.300 |
| DORFNER | 67 | 2 | 11.704 |
| L.SCHMIDT | 80 | 2 | 33.300 |
| PFLIPSEN | 71 | 2 | 13.728 |
| SCHÜTTERLE | 69 | 2 | 11.704 |
| ECKSTEIN | 67 | 1 | 16.640 |
| WIRSCHING | 71 | 2 | 9.086 |
| ZARATE | 68 | 2 | 12.782 |
| B.WINKLER | 69 | 1 | 14.976 |

Bestätigt: Kaderplatz Byte 11 = Vertragsdauer, Byte 40..41 (u16) = Gehalt,
Spieler Byte 26 = Alter, Byte 35 = Ligaspiele. ST = (Ko+Te+Fo)/3 abgerundet.

## Tabelle Heim, 15. Spieltag

| Pl | Verein | SP | S | U | N | Punkte | Tore |
|---:|--------|---:|--:|--:|--:|--------|------|
| 1 | 1.FC Nürnberg | 8 | 7 | 1 | 0 | 15:1 | 15:3 |
| 2 | Hertha BSC | 8 | 4 | 4 | 0 | 12:4 | 11:6 |
| 3 | FC Schalke 04 | 7 | 5 | 1 | 1 | 11:3 | 11:2 |
| 4 | FC Bayern München | 7 | 5 | 1 | 1 | 11:3 | 12:5 |
| 5 | Stuttgarter Kick. | 8 | 4 | 3 | 1 | 11:5 | 13:6 |
| 6 | VfB Oldenburg | 7 | 3 | 4 | 0 | 10:4 | 12:5 |
| 7 | VfB Stuttgart | 7 | 4 | 2 | 1 | 10:4 | 12:6 |
| 8 | VfL Bochum | 7 | 3 | 4 | 0 | 10:4 | 9:3 |
| 9 | Eintracht Frankfurt | 7 | 3 | 4 | 0 | 10:4 | 9:4 |
| 10 | SV Werder Bremen | 8 | 5 | 0 | 3 | 10:6 | 15:14 |
| 11 | BW 90 Berlin | 7 | 3 | 3 | 1 | 9:5 | 12:5 |
| 12 | SVW Mannheim | 7 | 2 | 5 | 0 | 9:5 | 12:7 |
| 13 | Mönchengladbach | 7 | 3 | 3 | 1 | 9:5 | 10:7 |
| 14 | Bayer Leverkusen | 8 | 3 | 3 | 2 | 9:7 | 11:9 |
| 15 | Borussia Dortmund | 7 | 3 | 2 | 2 | 8:6 | 6:5 |
| 16 | Wattenscheid 09 | 8 | 3 | 2 | 3 | 8:8 | 15:11 |
| 17 | FC St.Pauli | 7 | 2 | 3 | 2 | 7:7 | 9:7 |
| 18 | 1.FC Kaiserslautern | 7 | 2 | 3 | 2 | 7:7 | 9:8 |

## Tabelle Auswärts, 15. Spieltag

| Pl | Verein | SP | S | U | N | Punkte | Tore |
|---:|--------|---:|--:|--:|--:|--------|------|
| 1 | VfB Stuttgart | 7 | 3 | 2 | 2 | 8:6 | 10:7 |
| 2 | Mönchengladbach | 7 | 3 | 2 | 2 | 8:6 | 7:6 |
| 3 | Borussia Dortmund | 8 | 1 | 6 | 1 | 8:8 | 13:14 |
| 4 | FC Bayern München | 8 | 3 | 1 | 4 | 7:9 | 9:11 |
| 5 | SVW Mannheim | 8 | 1 | 5 | 2 | 7:9 | 6:8 |
| 6 | BW 90 Berlin | 8 | 1 | 4 | 3 | 6:10 | 7:12 |
| 7 | Eintracht Frankfurt | 7 | 2 | 1 | 4 | 5:9 | 5:8 |
| 8 | 1.FC Nürnberg | 7 | 1 | 3 | 3 | 5:9 | 8:12 |
| 9 | FC Schalke 04 | 7 | 0 | 4 | 3 | 4:10 | 4:9 |
| 10 | SV Werder Bremen | 7 | 2 | 0 | 5 | 4:10 | 9:15 |
| 11 | Hertha BSC | 7 | 0 | 4 | 3 | 4:10 | 5:12 |
| 12 | Bayer Leverkusen | 7 | 0 | 4 | 3 | 4:10 | 5:12 |
| 13 | Wattenscheid 09 | 7 | 1 | 2 | 4 | 4:10 | 7:15 |
| 14 | 1.FC Kaiserslautern | 8 | 1 | 2 | 5 | 4:12 | 3:11 |
| 15 | FC St.Pauli | 7 | 0 | 3 | 4 | 3:11 | 5:13 |
| 16 | VfB Oldenburg | 7 | 1 | 1 | 5 | 3:11 | 4:12 |
| 17 | Stuttgarter Kick. | 7 | 0 | 2 | 5 | 2:12 | 1:10 |
| 18 | VfL Bochum | 8 | 0 | 2 | 6 | 2:14 | 5:16 |

Bestätigt die Zuordnung der Auswärtsfelder (Nürnberg, Dortmund, Werder geprüft).

## Info über SV Werder Bremen (aus der Tabelle)

11. Platz in der Bundesliga, Stärke 68 (= Durchschnitt von 80, 75, 51).
Heimbilanz 5 Siege, 0 Unent., 3 Nied.; Auswärtsbilanz 2, 0, 5. Letzte Spiele
"NsSnSnNs". Tore pro Spiel (gesamt) 1.6:1.9. Serien: keine bemerkenswerte.
Höchster Sieg 5:0 (Hallescher FC) (H), höchste Niederlage 0:4 (VfB Stuttgart) (A),
erzielte Tore 5 (Hallescher FC) (H), kassierte Tore 5 (Eintracht Frankfurt) (A).
Historische Ergebnisse gegen 1.FC Nürnberg: H: noch keine, A: 1:2.
Punkte in der ewigen Tabelle: 359. Schaltflächen: Reicht mir, Restprogramm, Anzeigen.

Bestätigt: Tabellendatensatz Byte 50..53 (i32) = Punkte ewige Tabelle.
Block bei Save-Offset 28435: die ersten 2560 Bytes sind historische Ergebnisse,
je Byte Heimtore im hohen und Gästetore im niedrigen Halbbyte, 0xFF = kein Spiel
(erstes Byte 0x12 = das 1:2). Zeilen-/Spaltenordnung noch offen. Ab +2560
folgen Serien ("Spiele in Folge") und Rekorde der KI-Vereine, Aufbau offen
(Kandidat für Werder bei +1942 mit Gegnerindizes 57, 12, 7).

## Bank

Kredite: 3 Mon. 7 %, 6 Mon. 5 %, 9 Mon. 3 %, 12 Mon. 2 %, 15 Mon. 2 %, 18 Mon. 2 %.
Liste laufender Kredite (leer). Kontostand 973.860 DM, Gesamtschulden 0 DM,
Zinsen/Monat 0 DM. Rechts zwei Gesichter (Bankberater) und das Bankgebäude.

## Managerverlauf (Manager NORMI)

| Saison | Pl. | Liga | DFB-Pokal | Europapokal |
|---|---|---|---|---|
| 1991 | 6. | Am.-Oberliga | Achtelfinale | nicht im Wettbewerb |
| 1992 | 2. | Am.-Oberliga | Achtelfinale | nicht im Wettbewerb |
| 1993 | 9. | Zweite Liga | 1. Runde | nicht im Wettbewerb |
| 1994 | 6. | Zweite Liga | 1. Runde | nicht im Wettbewerb |
| 1995 | 1. | Zweite Liga | 1. Runde | nicht im Wettbewerb |

Darunter Balkendiagramm "Gesamtentwicklung". Bestätigt: Managerdatensatz ab Byte 62
je Saison 4 Bytes: Gesamtrang (Oberliga = 38 + Platz, Zweite Liga = 18 + Platz),
Pokalrunde (2 = Achtelfinale, 1 = 1. Runde), Ligastufe (3, 2), Europapokal (0).

## Hauptmenü mit Meldungen (Manager BLACKY, Hannover 96)

Nächster Termin "Spielfrei". Meldungsfenster in der Mitte mit Pfeil hoch, X
(löschen) und Pfeil runter: "7. November 1997 / BENATELLI bietet an, / von 1 auf 2 /
Jahre zu verlängern." Bestätigt die Meldungsliste am Dateiende (Manager 2,
Zeilenumbruch '^'). Sichtbar bleiben links Büro, Wappen, Trikots und rechts
Pokal, Diskette, Manager. Das Verlaufsdiagramm oben zeigt den Tabellenplatz.
