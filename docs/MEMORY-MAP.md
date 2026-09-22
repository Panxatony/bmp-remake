# Speicherkarte der Spieldaten

Das Original hält alle Spieldaten in globalen Tabellen. Der Spielstand ist
ein Abbild dieser Tabellen in fester Reihenfolge, daher ist jeder Block des
Spielstands zugleich eine Speicheradresse im laufenden Spiel. Die Adressen
gelten für das entpackte `BMMAIN.EXE` (Ladebasis 0, siehe `tools/unexepack.py`).

Segmente: `4238` = großes Datensegment, `4cb3` = DGROUP (Segment der
statischen Variablen und Stringtabellen).

Spielstand-Offsets gelten für den verschlüsselten wie den entschlüsselten
Spielstand (siehe `bmp/SPIELSTAND-FORMAT.md`).

| Save-Offset | Länge | Adresse | Datensatz | Bedeutung |
|------------:|------:|---------|-----------|-----------|
| 35 | 6 | 4cb3:060e | | Konfiguration |
| 41 | 4 | 4cb3:0618 | 1 | offene Meldungen je Manager |
| 45 | 4 | 4238:5350 | | |
| 49 | 1 | 4238:304a | | aktueller Manager (Index) |
| 50 | 1 | 4238:5358 | | |
| 51 | 8 | 4cb3:079e | | |
| 59 | 2280 | 4238:6ddc | 20? | kleine Zählwerte, Zweck offen |
| 2339 | 1 | 4cb3:07ab | | Anzahl Manager |
| 2340 | 5 | 4cb3:07ac | | DFB-Pokalsieger + 1, Titelverteidiger Landesmeister/Pokalsieger/UEFA + 1, DFB-Finalist + 1 (0 = keiner) |
| 2345 | 3112 | 4238:2242 | 778 | Managertabelle, 4 Einträge |
| 5457 | 100 | 4238:5714 | 5 | Nachholspiele, 20 Einträge: Kennung, Tagindex, Spieltag (1-basiert), Liga, Spielnummer (0x36F1) |
| 5557 | 6800 | 4238:3066 | 34 | Vereinstabelle, 200 Einträge |
| 12357 | 3456 | 4238:0ecc | 54 | Tabellenstände, 64 Einträge |
| 15813 | 5587 | 4238:57dd | 37 | Spielertabelle, 151 Einträge |
| 21400 | 6500 | 4238:774a | 52 | Aufstellungen/Spielzustand, 125 Einträge (5 x 25) |
| 27900 | 60 | 4238:4b5e | | Tabellenreihenfolge: 18 Bundesliga, 20 + 20 Zweite Liga |
| 27960 | 4 | 4238:2eba | | Spieltag |
| 27964 | 4 | 4238:2e8e | | Zähler |
| 27968 | 4 | 4238:a7a0 | | Jahr |
| 27972 | 4 | 4cb3:07dc | | Tag im Jahr |
| 27976 | 2 | 4cb3:07e0 | | Jahr (16 Bit) |
| 27978 | 10 | 4238:56fe | | Liste der deutschen Europapokalteilnehmer (0x18B12) |
| 27988 | 18 | 4238:57aa | | deutsche Startplätze je Europapokal, 3 x 6, 0x80 = frei |
| 28006 | 1 | 4238:56dc | | Prüfsumme 1 (unverschlüsselt) |
| 28007 | 2 | 4238:2e6e | | Hinspielergebnis der Relegation (Gast, Heim) |
| 28009 | 128 | 4238:76ca | | Pokalpaarungen, 4 Bereiche x 32: DFB-Pokal, Landesmeister, Pokalsieger, UEFA |
| 28137 | 96 | 4238:21e2 | | Hinspielergebnisse Europapokal 1..3 (gespiegelt: Gast, Heim), 3 x 32 |
| 28233 | 8 | 4238:0008 | | laufende Runde je Pokal (1-basiert), 4 Bytes genutzt |
| 28241 | 3 | 4238:1d18 | | Europapokal 1..3: 1 = Hinspiel gespielt |
| 28244 | 60 | 4238:535a | | Tabellenreihenfolge je Liga (Platz -> Verein), 18 + 2 + 20 + 20 |
| 28304 | 128 | 4238:4c7e | | Ergebnisse des Pokaltags, 4 x 32 (Heim +10 n.V., +20 n.E.) |
| 28432 | 3 | 4cb3:225a | | |
| 28435 | 5012 | 4238:9336 | | Historieblock: Bilanz je Manager gegen jeden Verein, ab +2560 Serien je Verein, +3904 Serienrekorde je Manager, +3988 Vereinsrekorde, +4500 deren Gegner (docs/SPIELMECHANIK.md "Historieblock") |
| 33447 | 15 | 4cb3:05fe | | |
| 33462 | 8 | 4238:0000 | | Trikotwerbung je Manager: Restmonate, Sponsor |
| 33470 | 48 | 4238:4b9a | | Bandenwerbung je Manager: 6 x (Restmonate, Sponsor) |
| 33518 | 80 | 4238:2ec2 | | Laufzeit der Sponsorenangebote in Jahren je [(Manager*2+Seite)*10+Sponsor] |
| 33598 | 320 | 4238:002e | 4 | Sponsorenangebote in DM je [(Manager*2+Seite)*10+Sponsor], Seite 0 Trikot, 1 Banden |
| 33918 | 144 | 4cb3:066c | 4 | Werbetabelle je Manager: Trikot, 6 Banden, TV, Werbeausgaben |
| 34062 | 1 | 4cb3:4a28 | | Spielstufe, umgekehrt: 5 - Level (Anzeige 0x265F8, Auswahl 0x34468). Geht in Stärke, Zuschauer, Werbung, Training und Ereignisse |
| 34063 | 2 | 4238:513c | | |
| 34065 | 30 | 4238:1d34 | | |
| 34095 | 120 | 4238:5664 | | |
| 34215 | 7 | 4238:5780 | | |
| 34222 | 2 | 4cb3:063a | | |
| 34224 | 2 | 4cb3:07e2 | | |
| 34226 | 1 | 4238:016e | | |
| 34227 | 95 | 4cb3:2280 | | |
| 34322 | 16 | 4cb3:0620 | | |
| 34338 | 1 | 4238:4bce | | |
| 34339 | 28 | diverse | 4 | sieben 32-Bit-Werte |
| 34367 | 1 | 4238:3060 | | Ausgang der Relegation: 1 = Zweitligist steigt auf |
| 34368 | var. | Heap | | Meldungsliste (Zeiger, Länge, Text) |

## Bekannte Felder

Ermittelt mit `tools/xref.py` (Code-Zugriffe und benachbarte Bildschirmtexte).
Offsets innerhalb eines Datensatzes.

### Verein (34 Bytes, 4238:3066)

| Offset | Typ | Bedeutung |
|-------:|-----|-----------|
| 0 | char[23] | Name, nullterminiert |
| 23 | u8 | |
| 24 | u8 | Stärke (Text "STÄRKE:" in der Nähe) |
| 25 | u8 | |
| 26 | u8 | |
| 27 | u8 | Stärke |
| 28 | u8 | |
| 30 | u8 | Stärke |
| 33 | u8 | Status/Liga (Zugriffe bei "Restprogramm", "Anzeigen") |

### Manager (778 Bytes, 4238:2242)

| Offset | Typ | Bedeutung |
|-------:|-----|-----------|
| 0 | char[29] | Name |
| 29 | u8 | |
| 30 | u8 | Vereinsindex (86 Zugriffe, Pokal, Europapokal, Relegation) |
| 306..309 | u8 | laufende Runde je Pokal (DFB, Landesmeister, Pokalsieger, UEFA), 30 = ausgeschieden |
| 57..61 | u8 | Titel: Meisterschaften, DFB-Pokal, Landesmeister, Pokalsieger, UEFA |
| 62.. | 4 je Saison | Verlauf: Rang, Pokalrunde, Liga, Europapokal (0 = leer) |
| 420..450 | u16 | Ewige Bilanz: 420/422 Punkte H/A, 424/426 Tore H/A, 428/430 Gegentore H/A, 432/434 Gegenpunkte, 440/442 Siege, 444/446 Niederlagen, 448/450 Unentschieden |
| 265..268 | | Relegation, Geldbetrag |
| 305..321 | | Spieltag/Pokalrunde, Saisonende, Stadion-Komfort, Intensität |
| 350..400 | i32 | Geldbeträge (Sachschaden, Komfortbewertung) |
| 420..448 | i16 | 16-Bit-Werte, Saisonstatistik |
| 484 | i32 | Besucherzahl der Saison |
| 488 | i32 | Zuschauerrekord, Gegner in 500 |
| 492 | i32 | Minuskulisse, Gegner in 504 |
| 496 | i32 | Kontostand |
| 508..777 | 15 x 18 | Kredite: 5 Geldgeber x 3 Kredite (Routine 0x122D9) |

Kredit (18 Bytes): 0 i32 Summe, 4 i32 Zinsen/Monat (= Summe x Prozent / 100),
8 u8 Aufnahmetag, 9 u8 Fälligkeitstag, 10 u8 Aufnahmemonat (0-basiert),
11 u8 Fälligkeitsmonat, 12 u8 Prozentsatz, 14 u16 Aufnahmejahr, 16 u16 Fälligkeitsjahr.
Maximal 3 Kredite je Geldgeber ("Schon 3 Kredite"). Gesamtschulden und
Zinsen/Monat summiert Funktion 0x1222D über alle Geldgeber.

### Spieler (37 Bytes, 4238:57dd)

| Offset | Typ | Bedeutung |
|-------:|-----|-----------|
| 0 | char[?] | Name, nullterminiert |
| 26 | u8 | Alter ("JAHRE ALT") |
| 28..29 | u8 | Verhandlung ("NEIN !", "NA GUT.") |
| 31 | u8 | Aufstellungsstatus ("nicht aufgestellt", "ausgewechselt") |
| 33 | u8 | Besitzer: Manager 0..3, 4 Transfermarkt, 5 frei |
| 34 | u8 | Tore ("Torschütze", "TORE/SPIEL") |
| 35 | u8 | Torschützenliste |
| 36 | u8 | Verein (0..199) |

### Tabellenstand (54 Bytes, 4238:0ecc)

u16 bei 50 = Punkte der Ewigen Tabelle (über alle Saisons).

Zugriffe bei "AUFZUSTEIGEN", "DIE KLASSE ZU ERHALTEN", "PLATZ, STÄRKE",
"SAISONENDE". Felder bei 0, 1, 22, 23, 26, 27, 30, 31, 38, 39, 42, 43, 46, 50, 52,
also überwiegend 16-Bit-Werte.

### Aufstellung (52 Bytes, 4238:774a)

Plätze 100..111 sind der Transfermarkt (Manager 4). Dort: Byte 3 Ablehnungsbits je Manager
(1 << Manager) + 0x80, Byte 9 Bit 6/7 Angebot eines KI-Vereins (Kader/Markt), Byte 12
Leihe (Verein | 0x80), Byte 22 anbietender Verein, i32 bei 40 Marktpreis, i32 bei 48
Meldungszeiger (Laufzeit). Siehe docs/SPIELMECHANIK.md, "Transfermarkt".

Zugriffe bei "Spieler einsetzen", "Auto-Aufstellung", "nach Vorlage von",
"Reservespieler", "Keine Auswechslung mehr möglich". Felder bei 9, 10, 11, 15,
21, 25, 26, 40, 42.
