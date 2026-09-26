# Audit 2: alle Spielroutinen Zweig für Zweig (26.9.2026)

Der erste Audit (AUDIT.md) prüfte, *ob* jede Anzeige und Funktion des Originals vorhanden ist.
Dieser prüft, *ob sie gleich rechnet*: alle 232 Spielroutinen von BMMAIN.EXE (218 KB Code, ohne
Grafikkern 35ac, Datei/Speicher 3930 und C-Bibliothek 3a01) Zweig für Zweig gegen das Remake -
Bedingungen, Grenzen, Reihenfolge und Grenzen der Zufallswürfe, Rundung, Überläufe, Schreibziele,
Inhalt der Anzeigen.

**Vorgehen:** acht Prüfer je Adressbereich (A bis H), danach je Befund eine Gegenprüfung mit dem
Auftrag, ihn zu widerlegen. Die Berichte stehen in `abgleich/audit2/` (A.md bis H.md, die
Gegenprüfungen in verify-*.md). **Kein spielrelevanter Befund ließ sich widerlegen**; F1 gilt nur
teilweise, G18 ist nur Anzeige.

Klassen: **S** ändert Spielstand oder Zufallsfolge, **A** Anzeige/Bedienung, **D** nur Doku.
Ergebnis: rund 60 S, 55 A und 15 D, einige doppelt gefunden (E18/F8, B2/E22, B13 mit H).

## Was die Prüfer bestätigt haben

Ohne Befund: Zufall 0x8377 und Zahlformat 0x7D31, Mannschaftsstärke 0x0F9D2, Spielnoten, Kaderzahl,
Spielerpool, Chiffre, Highscore-Punkteformel, Markterneuerung, KI-Kaufentscheid, Marktwert Term für
Term, Verhandlungsrechnung 0x249E0, MANA.DAT, Aufstellungsautomatik 0x22030/0x22305, Tabellenbuchung
0x2D143, Zuschauer, Werbeangebote, Kredite. Die Zweigbücher 0F9D2, 10067, 10BB0, 11D0D, kredit,
1B223, 2D144, 20230, 20DBC, restroutinen und transfer.md halten der Stichprobe stand - mit den
unten genannten Ausnahmen.

## Spielrelevante Befunde (S)

### Häufig - jeder Spieltag oder jede Saison

| ID | Was | Stelle Original | Aufwand |
|---|---|---|---|
| G4 | Stärke aller Manager mit Flag 1 nach dem Schlusspfiff ("Ergebnisse") und am Nachholtag fehlt; die Matrix geht weder zur Halbzeit noch beim Anpfiff in den Vereinssatz, die Zeitung bekommt die Konferenzmatrix | 0x5CE7/0x5C3D -> 0x2B61A -> 0x2C0FC, 0x0FFAD | mittel |
| E1 | Tägliche Schwankung 0x10067 läuft im Server erst nach den Spielen - die Rechnervereine spielen mit dem Stand vom Vortag | 0x1D77C | mittel (mit E2) |
| E2 | Finanzen des Ankunftstags im Server vor dessen Tagesroutine, im Original danach | 0x1D757, 0x1DBFE | mittel |
| B2/E22 | Aufstellungsautomatik bei jedem Aufbau von Hauptmenü und Kader, mit dem eigenen 513E; im Server nur am Tagesbeginn und nach Käufen. Wer mit Automatik einen Starter abgibt, spielt am selben Tag mit einem Mann weniger | 0x9D46, 0x22FBA, 0x24114 | klein - **B2 behoben** |
| C1 | Steuer am Monatsende auf den Stand *nach* den Einnahmen, Kredite erst danach; das Remake bucht Kredite zuerst und rechnet die Steuer ohne Einnahmen | 0x11F1C, 0x174BE, 0x12002 | klein |
| F2 | Kauf: verhandelt wird auf dem neuen Kaderplatz (0x224A8 würfelt vorher), jede Einigung läuft über 0x249E0 (Würfe, 100.000-Grenze) | 0x23E86, 0x26029 | mittel |
| E16 | Kauf und Leihe vergeben keine Rückennummer; das Remake setzt den Neuzugang auf die Bank | 0x224A8 | klein |
| E19 | Setzen auf den Markt und Zurückholen laufen über 0x224A8 und würfeln fünfmal | 0x224A8 | klein |
| E18/F8 | Kaderverkauf an die KI: Verein und Stärkeschnitt werden erst nach dem Entfernen gelesen, also vom Nachrücker (Fehler des Originals) | 0x235DD-0x2361D | klein - **Entscheidung** |
| D9 | Gelb-Rot würfelt die Sperre random(1,1) - der Wurf fehlt | 0x1C0A7 | klein |
| D1 | KI-Torschützen bei mehr als neun Kandidaten: w = 10 -> 9, Remake 8 | 0x16094 | klein |
| G1 | Torrekorde "kassiert heim" (k=3) und "erzielt auswärts" (k=6) gehören ins untere Halbbyte (alle 42 Spielstände bestätigen es) | 0x2D2B9, 0x2DC65 | klein |
| H1 | Bauabschluss: Meldung würfelt random(0,3), und der Bau kommt vor Lager und Bank | 0x30B0A, 0x11D1E | klein |
| H2 | Karriereende am Saisonwechsel: Meldungswurf random(0,3) fehlt | 0x0D55E | klein |
| B13 | Neubelegung am Saisonwechsel: die Positionsart geht an Spieler [bp-0x7C], nicht an den neuen | 0x0D615-0x0D631 | klein bis mittel |
| E4 | System wird an Pokal-, Europapokal- und Relegationstagen nicht gesichert | 0x1D817 | klein |
| E6 | Spieltagzähler 4cb3:225A läuft über den letzten Spieltag hinaus (Stände 35/39/39); wirkt auf Gehaltsforderungen und Relegationszuschauer | matchday.ts:148 | klein bis mittel |
| E3 | Übergang zum Saisonwechsel: Finanztage 324/325 fehlen, dafür eine Schwankung und ein Marktwurf zu viel | 0x1E03D | klein |
| B5 | Neues Spiel mit mehreren Managern: die Kaderwertschleife würfelt N·120 statt 120 Mal | 0xC0A8-0xC1B9 | klein |
| B14 | Rückkehr eines Leihspielers löscht Byte 12/24 im Kader von Manager 0 statt beim Besitzer | 0xD3BC-0xD3E8 | klein |
| G17 | Ausverkauft: Zeitung würfelt erst die Schlagzeilengruppe, dann den Artikel | 0x2FED7 | klein |

### Gelegentlich

| ID | Was | Aufwand |
|---|---|---|
| B1 | Sperrausnahme 513E auch an Europapokaltagen (0x9BD3-0x9C0A) | klein |
| A1 | Laufender Ausbau darf erweitert werden, Bauzeit rechnet Resttage ein; Bauzeit bei jedem Aufruf neu gewürfelt | klein bis mittel |
| A2 | Bau-Rückfrage muss beantwortet werden; Nein sperrt die Art random(15,55) Tage für alle | klein |
| F3 | Verlängerungsangebot des Spielers (Byte 24 = 100+J) lässt sich im Web nicht annehmen | mittel |
| F4 | Spieler mit angekündigtem Karriereende lässt sich verlängern | klein |
| F5 | Vorprüfung "So dumm ..." (mehr Jahre bei weniger als dem bisherigen Gehalt) fehlt | klein |
| F6 | Byte 24 = random(10,18) fehlt an mehreren Ausgängen des Vertragsdialogs | klein |
| F9/E25 | Verkauf eines Spielers mit Karriereende-Bit ist gesperrt | klein |
| E17 | Auswechslung: der Herausgenommene bekommt die kleinste freie Nummer ab 12 | mittel bis groß |
| E21 | Kauf vom Manager und Leihe übernehmen Byte 9 ungefiltert | klein |
| E23 | Sponsor-Zuschuss nur bei Kauf oder Leihe eines KI-Spielers | klein |
| E24 | Abgebrochener Kauf und voller Kader: Ablehnungsbits, Würfe vor dem Dialog | mittel |
| E28 | Zurückholen mit LEIHEN wird zur Leihe (Gehalt ein Drittel) - Trick des Originals | klein bis mittel - **Entscheidung** |
| D6 | Verlängerung im DFB-Pokal: Karten/Verletzungen nur für den Heimmanager (Merker des Gastes landet in 1D94) | klein |
| D2 | Torschützenliste schreibt Kaderbyte 3 in Spielerbyte 34 | klein bis mittel |
| D7 | Mit Zeremonie läuft 0x18DA7 zusätzlich mit der alten Rundennummer (Heimrecht im Halbfinale) | mittel |
| G2, G3 | Rekordbyte bei leerem Rekord; Serienrekorde aller Manager nach jeder Ligabuchung | klein |
| G19 | Abgeschaltete Zeitung würfelt nicht | klein |
| H4 | Automatische Speicherung würfelt viermal | klein |
| B6 | Zwei Manager dürfen nicht denselben Verein wählen | klein |
| B12 | Torschützenkönig vor Auf- und Abstieg | klein |
| B15 | Jahrgangswechsel prüft Platz == 4 statt Manager == 4 | klein |
| B18, B19 | Angebote fremder Vereine und Verlängerungsangebote hängen am Meldungszeiger | klein bis mittel |
| C2 | Chancenzahl im Pokal prüft ein Byte außerhalb der Ergebnistabelle auf 30 | mittel |

### Praktisch nie

A7 (Nachholtermin nur bis Tag 89), B16 (Pool zieht höchstens 1001 Mal), B20 (Trainingsgewinn
16 Bit), E20 (Angebot genau Wert·140/100), F1 (Marktwertwurf bei Byte 9 Bit 7 auf dem Kaderplatz).

### Entschieden (lhuno, 26.9.2026)

| ID | Entscheidung |
|---|---|
| E18/F8 | Fehler des Originals, nicht nachgebaut - in ABWEICHUNGEN |
| E28 | Trick des Originals, nicht nachgebaut - in ABWEICHUNGEN |
| B8 | Manager im laufenden Spiel aufnehmen: nachbauen (#132) |
| B9 | 1- und 3-Jahres-Spiel: nachbauen (#133) |
| B11 | Keine Jugend an den Saisonenden 1993-1995: nachbauen (#134) |
| F7 | Schummeltasten der Einstellungen: nachbauen (#135) |

## Work Items

| # | Inhalt |
|---|---|
| 121 | Tagesablauf im Server wie das Original: E1-E4, H1, H4 |
| 122 | Stärke nach Schlusspfiff und Nachholtag, Matrix in den Vereinssatz: G4 |
| 123 | Aufstellungsautomatik bei jedem Kaderaufbau, 513E an Europapokaltagen: E22, B1 (B2 behoben in 99fec9e) |
| 124 | Steuer am Monatsende: C1 |
| 125 | Kauf vom Markt: F2, E16, E19, E21, E23, E24, F1 |
| 126 | Vertragsdialog: F3-F6, B18, B19 |
| 127 | Zufallswürfe im Spiel: D9, D1, D6, G17, G19, C2 |
| 128 | Saisonwechsel und Rekorde: G1-G3, B12-B16, H2, D2, E6 |
| 129 | Neues Spiel mit mehreren Managern: B5, B6 |
| 130 | Stadion: A1, A2, A7 |
| 131 | Verkauf, Auswechslung, Pokalauslosung: F9/E25, E20, E17, D7, B20 |
| 132-135 | Nachbauten B8, B9, B11, F7 |
| 136-138 | Anzeige |
| 139 | Doku |

## Anzeige (A) und Doku (D)

Die 55 Anzeigebefunde betreffen vor allem den Transfermarkt (Hilfszeile, Farben, VON-Zeile),
Verkaufs- und Vertragsdialog (Texte), Werbung (Startsponsor, Pfeile, Klickflächen), Spielerinfo
(Europapokal-Spalte, Verletzt-Text), Bestenliste, Pokalübersicht (n.V./n.E., Klicks zur Info),
Zeitungsaufstellung, Weihnachtsseite 42.VGA und die Titelseite SAISONENDE. Die Doku-Befunde
betreffen SPIELMECHANIK, MEMORY-MAP, ABWEICHUNGEN und die Zweigbücher 0CB62 (J), 0DF0D (G5),
18E46 (V1), 18FC2, 1B223 (K), 251FF und restroutinen (R2). Einzelheiten in `abgleich/audit2/`.
