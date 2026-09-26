# Audit 2, Gruppe E, Teil 2: 0x1EB17 und 0x1F37F

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

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1EB17 (bis 0x1ECDC) | Titelseite "SAISONENDE" über 0x32F2 (Flaggenseite, 50 Ticks), dann Ewigkeitspunkte je Verein 0..63, Merkbits 4238:4BEC[0..3] = 0 | core/src/sim/season.ts:208 `ewigkeitspunkte`; Merkbits server.ts:1181 `r.msgFlags = []` | Rechnung stimmt; Titelseite fehlt: **Befund T2-1** |
| 0x1ECDE (bis 0x1F37E) | Hilfszeile unter der Spielerliste: Spalte/Zeile unter dem Zeiger, Text der Spalte, Zeilenmarkierung; Klick (4238:2EA2 = 1/3) liefert die Zeile | web/src/main.ts:2777 `squadSpalteAt`, :2791 `squadHilfe` (nur Kaderbildschirm) | **Befunde T2-4, T2-5, T2-6**; Spaltengrenzen unklar (U1) |
| 0x1F37F | Listenzeichner (Kader, Vertrag, Markt): Überschrift, Kopfzeile, Zeilen nach Maske und Modus | web/src/main.ts:4581 `drawSquad`, :6347 `drawMarket` | **Befunde T2-2, T2-3, T2-7, T2-8, T2-9** |

## Geprüft und stimmt

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

## Befunde

### T2-1 (A) Titelseite "SAISONENDE" fehlt
Original: 0x1EB24-0x1EB32 `mov -0x61ea,%es; push %es:0x25ba; push %es:0x25b8; lcall $0x310,$0x1f2` - Zeiger 4cb3:25B8 → 4cb3:12CF
"SAISONENDE". 0x32F2 ist die Titelseite (0x31FA Flaggenhintergrund, Text mittig in Schrift 3, dann 50 Ticks warten, wenn 4cb3:05D4 = 0),
dieselbe wie für "DFB-Pokal"/"Relegationsspiel" (anzeigen.md A1/A2). Sie erscheint vor der Ewigkeitspunkte-Rechnung am Saisonende.
Remake: keine solche Seite. `ui.ankuendigung` (texte-manifest) enthält Ligaspiel, DFB-Pokal, Europapokal, Relegationsspiel, Nachholspiele,
Nachholspiel, `ui.winterpause` WINTERPAUSE; "SAISONENDE" (Bildoffset 0x4DDFF) steht in keinem Manifesteintrag; die Sonderseiten des
Servers kennen nur "winter" | "scherz1" | "scherz2" (server.ts:668). Sicher: direkter Aufruf ohne Bedingung am Routinenanfang.

### T2-2 (A) Spalte SP ohne Europapokaleinsätze, TO ohne Europapokaltore
Original 0x1F37F: Spalte 6 (0x1F88C → 0x1F8A6-0x1F8B7, 0x1F9D4-0x1F9DA): `mov %es:0x8(%bx),%al; mov %es:0x7(%bx),%cl; mov %es:0x6(%bx),%dl ... add %cx,%dx; add %dx,%ax`
= Byte 6 + 7 + 8. Spalte 12 (0x1F9BA): Byte 5 + 4 + 3. Byte 8/5 sind die Europapokaleinsätze/-tore (doping.ts:24-25).
Die Spalten stehen in den Masken 0xF0C7 (Kaderbildschirm), 0x3D146 (Vertragsansicht) und 0x90C6 (Markt links).
Remake: main.ts:4662/4664 (Vertrag), 4676/4680 (Kader), 6381/6386 (Markt): `l.leagueApps + l.cupApps` (Bytes 6+7) und
`l.leagueGoals + l.cupGoals` (Bytes 3+4). Wer Europapokal spielt, sieht im Remake weniger Spiele und Tore. Sicher: Sprungtabelle
cs:0x1001 (Bild 0x1FCD1) führt Spalte 6 nach 0x1F88C, Spalte 12 nach 0x1F9BA.

### T2-3 (A) STATUS-Spalte der Liste: RESERVE hat Vorrang vor VERL./GESP.
Original 0x1FA2C-0x1FA4E: zuerst `cmpb $0xb,%es:0xa(%bx); jbe 0x1fa50` - Nummer > 11 → "RESERVE" (4cb3:2310) in Gruppenfarbe;
erst danach Byte 9 & 3 (GESP./VERL. in Farbe 0x12). Ein verletzter oder gesperrter Ersatzmann (Nummer 12..) steht in der vollen
Liste (Kaderbildschirm, Vertragsansicht) als "RESERVE". (Die Einzelzeilen-Auffrischung 0x21E40 prüft umgekehrt zuerst Byte 9 & 3,
0x21EDF - dort hat das Remake recht.)
Remake main.ts:4644: `ef === 3 ? " " : ef === 2 ? "VERL." : ef === 1 ? "GESP.(n)" : ... l.number > 11 ? "RESERVE"` und Farbe `ef ? ROT`
- für beide Ansichten nach 0x21E40.

### T2-4 (A) Hilfszeile: Spalte ART ohne " (AUSGEL.)"
Original 0x1EF4A-0x1EF67: nach dem Positionsnamen `cmpb $0x0,%es:0xc(%bx); je; push %es:0x279a/0x2798; lcall strcat` - bei Kaderbyte 12 ≠ 0
(Leihspieler) steht "TORWART (AUSGEL.)" usw. Remake main.ts:2798: `if (nr === 18) return hilfe[18 + ...]` ohne Zusatz.

### T2-5 (A) Hilfszeile: Spalte STATUS mit anderen Texten
Original 0x1F172-0x1F2D8 (Spalte 14): "STATUS: " (4cb3:27A0) und dann
- Nummer > 11 → "RESERVE" (0x1F190, vor dem Flag);
- Byte 9 & 3 = 0 oder (= 1 und 4238:513E ≠ 0): Nummer ≠ 0 → "IM TEAM" (230C), Nummer 0 → "H[NGT HALT SO RUM..." (27A4) (0x1F2AF-0x1F2D8);
- = 1: "NOCH " + Byte 13 + " SPIELE " + "GESPERRT." (2640, 2644, 24F0 = 24F4 − 4·1);
- = 2: "VERLETZT " (24EC) + "(" + Verletzungsname 4cb3:23B4[Byte 23] über 0x3091:105D + ")" (0x1F25D-0x1F2AC);
- = 3: 24E8 ("UEFA-Pokal", so im Bild).
Remake main.ts:2803: `hilfe[22] + (ef & 2 ? "VERL." : ef & 1 ? "GESP." : l.number === 0 ? "" : l.number > 11 ? "RESERVE" : "IM TEAM")`.
Unterschiede: Sperre/Verletzung als Kurzwort statt Satz mit Dauer bzw. Verletzung; Nummer 0 leer statt "H[NGT HALT SO RUM...";
Reihenfolge wie T2-3. Gilt für Kader- und Vertragsansicht (beide über 0x1ECDE, Aufrufe 0x20571 und 0x25370).

### T2-6 (A) Hilfszeile: Erschöpfung auch bei offenem Spielfeld
Original 0x1F329: `cmpw $0xec,0xe(%bp); je` - "(ERSCH|PFUNG:" Byte 19 ")" nur bei rechtem Rand 236. Der Kaderbildschirm übergibt
0x20550-0x2055C: `cmpb $0x1,-0xa(%bp); sbb; inc; imul $0xffc3; add $0xec` = 236 − 61·[Merker -0xA], also 175 bei eingeblendetem Spielfeld
(so auch die Listenbreite im Remake, main.ts:2744 `this.pitchOpen ? 180 : 232`). Vertragsansicht (0x2535C: 239 bzw. 164) nie.
Remake main.ts:2808: Zusatz immer außer in der Vertragsansicht, auch mit offenem Spielfeld.

### T2-7 (A) Hilfszeile im Transfermarkt fehlt
Original 0x22C15 ruft bei 0x2305F 0x1ECDE für die linke Liste (x 2, y 36, rechter Rand 155, Hilfszeile y 190, Maske 0x90C6): Hover-Markierung
und Spaltenhilfe wie im Kaderbildschirm. Remake: `hoverZeile` (main.ts:2744) wertet nur `this.screen === "squad"` aus; `drawMarket` zeigt keine Hilfszeile.

### T2-8 (A) Farben der Liste im Transfermarkt
Original 0x1F7D5-0x1F813 (Spalte NAME): nur der **Name** in Farbe 0xB (#d2c2b2), wenn (Modus 1/2 oder Merker -0x5E) und Kaderbyte 9 & **0xC0**
und Spielerbyte 33 = 4238:5358 (aktueller Manager, vgl. 0x22FFF). Alle anderen Spalten und alle anderen Zeilen in der Gruppenfarbe
07B4[Gruppe]; eine Farbe für "abgelehnt" gibt es nicht.
Remake main.ts:6376: ganze Zeile `COLORS.highlight` (#ffff70) bei Byte 9 & 0x40; main.ts:6414: eigene Marktspieler ganze Zeile weiß
bzw. gelb, abgelehnte gedämpft (`textDim`).
Dazu ein Punkt: 0x1F75A-0x1F7CA setzt mit 0x3930:0x3CE (Einzelpixel, 0x37F46 schreibt ein Byte) einen Punkt bei (x + 07C5 − 3, y − 2)
hinter ART, wenn Kaderbyte 12 ≠ 0 (Leihspieler, alle Listen) oder in Modus 1/2 der Spieler dem aktuellen Manager gehört. Remake main.ts:6389
ausdrücklich "kein Leih- oder Angebotszeichen".

### T2-9 (A) Vertragsansicht: Zeilenfarben und V.DAUER
Original Modus 3 (0x1F695-0x1F6C1): Kaderbyte 24 in 1..99 → Farbe 3 (#717191) für die ganze Zeile; Bit 7 (Karriereende) → Farbe 0x11
(#910010). Name in Farbe 0xB, wenn i32@48 (Meldungszeiger) ≠ 0, (Byte 24 & 0x7F) > 99 und Modus 3 (0x1F818-0x1F835). V.DAUER (0x1FB59-0x1FBB8):
Byte 11 + " JAHR", "E" nur wenn das erste Zeichen > '1' - also "0 JAHR", "1 JAHR", "2 JAHRE"; keine eigene Farbe.
Remake main.ts:4638: `stur` = Byte 24 > 0 ohne Bit 7 (also auch 100 + Jahre, liegendes Angebot) → "#5151d3"; Bit 7 → Gruppenfarbe;
main.ts:4661: `jahre === 1 ? "" : "E"` ("0 JAHRE") und 0 Jahre rot.

## Unklar

- U1 Spaltengrenzen der Hilfszeile: aus 07C4 gerechnet (xoff = Maus-x − x0, erste Spalte mit Summe > xoff) liegen sie im Kaderbildschirm bei
  NR 6-16, ART 17-34, NAME 35-91, SP 92-105, ST[RKEN 106-141, TO 142-154, GK/RK 155-181, STATUS 182-221, TD 222-234; im Remake (main.ts:2779,
  "am 16.9. im Original ausgemessen") 35-93, 94-106, 107-142, 143-154, 155-179, 180-218, 219-237. Vertrag gerechnet: ART 6-23, NAME 24-80,
  SP 81-94, ST 95-106, TO 107-119, STATUS 120-159, TD 160-172, V.DAUER 173-197, GEHALT 198-230; Remake NAME 24-84, SP 85-89, ... GEHALT 201-237.
  Offen, ob die Mauskoordinate (Wort 2 von *4cb3:6DC0) Versatz hat; zur Klärung in DOSBox den Zeiger an eine gerechnete Grenze setzen.
- U2 Zahlformat von GEHALT/WERT: 0x076B:0x0681 nach ·4cb3:2252/·4cb3:224E (beide 1), bei 4cb3:224D ≠ 0 Präfix 4F78 und x + 8; ob Tausenderpunkte
  (4cb3:07B2) greifen, ist offen (schon in anzeigen.md:242 offen). Remake ohne Punkte.
- U3 Die Marktliste zeichnet Zeilen 0..12 (Argument 0xC), also Aufstellung 112 mit; das Remake nur 0..11 (MARKET_SIZE). Nur relevant, wenn 112 je belegt wird.
- U4 Bedingung "Name in 0xB" in Modus 3 hängt am Meldungszeiger i32@48, den das Remake nicht führt (Zweigbuch 251FF D4); Nachbau bräuchte einen Ersatz.
- Die Saisonende-Listen 0x0DBC6/0x0DE45 (0x0CB62, Modus 3) nicht einzeln gegen die Remake-Oberfläche geprüft; T2-2/T2-3/T2-9 gelten für jede Stelle, die diese Liste nachbildet.
