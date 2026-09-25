# Zweigbuch Anzeigen - die bisher nur als Bildschirm geprüften Routinen

Gelesen am 25.9.2026. Es sind die 23 Routinen, die das Audit nur als Bildschirm geführt hatte
(außer dem Kaderbildschirm 0x20230 und der Vereinsinfo 0x2A41E, die eigene Zweigbücher haben).
Spielrelevante Abweichungen gibt es keine; die Würfel (0x043D3, 0x324DE) und alle
Schreibzugriffe auf den Spielstand stimmen.

## Stand der Befunde

| | Was | Stand |
|---|---|---|
| A1 | Titelseite am Relegationstag "Relegationsspiel" statt "Europapokal" | behoben (server/live.ts) |
| A2 | Titelseite "Nachholspiele" an einem Tag nur mit Nachholspielen | behoben; fallen Liga und Nachholspiele zusammen, folgen beide Seiten nacheinander (#119) |
| A3 | Hauptmenü: "Nachholspiel" statt "Spielfrei", wenn der eigene Verein heute nachholt | behoben |
| A4 | Restprogramm 0x028C4 (aus der Vereinsinfo) | nachgebaut mit F1 (2A41E.md) |
| A5 | Stadion-Restzeit: Resttage / 7 + 1 | behoben (#117): die alte Messung war um einen Tag verschoben - das Original zählt beim Laden jeden Bau um einen Tag herunter; neu gemessen mit sieben Werten, `restWochen` |
| A6 | Credits 0x0F749 | nicht nachgebaut (ABWEICHUNGEN) |
| S1 | Statistik: Hinweise "(NOCH KEINE...)" / "(NOCH KEINER...)" statt 0 vor dem ersten Heimspiel und ohne Rekord | behoben |
| S2 | Statistik: Zahlen links mit '^' auf die Mindestbreite (0x7D31), Monatsbilanz Breite 7, Null als "^0" | behoben |
| E1 | Ewige Bilanz: Titelzahl ohne " x" | behoben |
| E2 | Ewige Tabelle: alle 64 Sätze, Platz = Stelle + 1 | behoben (`allTimeTable(g, true)`) |
| E3 | Ewige Tabelle: Punkte mit Tausenderpunkten | behoben |
| E4 | Ewige Tabelle: Managervereine zählen nur unter den ersten 23, Punktreihe danach | behoben |
| E5 | Ringe der Kränze: Meisterschaft grün nur ohne Merkbit "verspielt", Pokale grün nur in der laufenden Runde | behoben (Server reicht die Merkbits 4238:4BEC durch) |
| T1 | Trainingsbalken über die Plätze 0..Anzahl-1 | behoben; Test |
| Z1 | Zeitung: Umbruch ab Breite > 180 bzw. 295 wie im Core | behoben |

## Teil 1: Restprogramm, Stadion, Relegation, Nachholspiele und Helfer

Werkzeug: Disassembly plus ein Filter, der die Segmentvariablen auflöst (DS:98xx/99xx → 4238 oder 4cb3).

**Spielrelevant ist nichts falsch.** Es gibt fünf belegte Abweichungen, alle in der Anzeige. Dazu kommt eine offene Frage bei der Wochenzahl im Stadion.

**Die Grenzen aus AUDIT-ROHDATEN stimmen dreimal nicht.** Die Bereiche enthalten mehrere Funktionen:
- **0x028C4 (2606 B):** 0x028C4–0x03108 ist das Restprogramm, 0x0310A–0x031F9 die Prüfung „heute Nachholspiel?“, 0x031FA–0x032F1 der Schwarz-Rot-Gold-Hintergrund.
- **0x0F749 (2334 B):** 0x0F749–0x0F9D0 ist der Credits-Bildschirm. 0x0F9D2 ist die Mannschaftsstärke und hat schon ein eigenes Zweigbuch.
- **0x0310A** beginnt mitten in einem Befehl, den objdump falsch zerlegt (3109: `00 55 8B EC`).

### 0x0462E – Ergebnisbytes der 0:2-Spiele setzen (Aufrufer 0x5403 bei 5489 und 5BE9)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 4641-46B9 | Wert = Argument, wenn es 30 ist oder wenn 549C[i] + j = 2 gilt, sonst 0 | `matchday.ts:192`, `server/live.ts:316-321` | stimmt (1 = Heimmanager verliert, also 0:2; 2 = Gastmanager, also 2:0) |
| 464E-468B | Ziel 4238:6DDC + ((4BD0[i]·38 + 57A6[i])·20 + 0170[i] + j) | `spieleEins` schreibt in dasselbe Feld | stimmt |
| 46C2-46D4 | Schleife über i < 4238:2E98. Die Liste baut der Treiber bei 0x4923-0x4981 aus den Rückgaben 1/2 von 0x1C632, nur für Ligapaare | Prüfung `isForfeit` in Managerreihenfolge (`live.ts:302`) | stimmt |
| Aufrufe | 5489: 462E(30) am Anfang jeder Liga-Halbzeit; 5BE9: 462E(2) am Ende | Ergebnis direkt 0:2 bzw. 2:0 | stimmt im Ergebnis. Kein Würfel, Ziel ist die Ergebnistabelle |

### 0x043D3 – Zweite Chancenzahl (Aufrufer 0x102B9: 103D2, 1046A)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 43DD-43F7 | Würfelt random(0,1). Bei ≠ 0 gilt: a zurück, wenn b < a (vorzeichenbehaftete Bytes), sonst b. Bei 0 kommt b zurück | `pick` in `match.ts:91` | stimmt (ein Würfel, gleiche Reihenfolge; a = erster, b = zweiter Wurf aus 0x102B9) |

### 0x03BE8 – Vereinsindex tauschen (1-basiert; Aufrufer 0x3C24, fünfmal)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 3BF2-3C1D | Ist *p - 1 = x, wird *p = y + 1; ist *p - 1 = y, wird *p = x + 1 | `titelTraegerTauschen` (`europa.ts:605`) | stimmt |
| 3CD0-3D46 | Auf 4cb3:07AC..07B0, nur mit Schalter +0xA ≠ 0 | `mitTitel` (`season.ts:64`), Konstanten 2340..2344 | stimmt |

### 0x033BF – Relegationsspiel (Tagesverteiler 1D8D7, nur wenn (Flag & 0x70) = 0x10)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 33CB-33DD | 4238:0009 = 5 (bleibt so stehen); 57DC = 1 | `p[CUP_ROUND+1]=5`; `init` in `afterCupDay` | stimmt |
| 33DF-340A | Titel „Relegationsspiel“ über 0x32F2 (Flaggenseite und 50 Ticks), danach noch einmal 50 Ticks, wenn 4cb3:05D4 = 0 | Ankündigung „Europapokal“ (`live.ts:330`) | **A1** |
| 340C-347A | Sichert und leert 76EA/76EB, 4C9E/4C9F und 21E2/21E3. 21E2 = Hinspiel 2E6E im Rückspiel, sonst 0 | `europa.ts:544-549` | stimmt |
| 347C-34C6 | Rückspiel (1D18 ≠ 0): Heim BL-16. (535A+15), Gast Zweitliga-3. (535A+22); im Hinspiel umgekehrt | `europa.ts:550-553`, `live.ts` (`orderList`) | stimmt |
| 34CA-34D3 | Treiber 0x46DB(0, Art 2, 0, 0) | `playCupMatch` + `afterCupDay(init)` | nicht Teil dieses Abgleichs |
| 34D9-351A | 1D18 danach 0: 4238:3060 = 0x19208(1,0). Sonst 2E6E/2E6F = 21E2/21E3 | `europa.ts:554-555`, `decideTie` | stimmt |
| 351C-3558 | Gesicherte Werte zurück; 57DC = 0 | `europa.ts:556` | stimmt |

Nicht geprüft: 57DC = 1 erzwingt im Treiber die Europapokal-Übersicht, auch wenn die Option 4cb3:0609 aus ist (0x4B98). Das ist reine Anzeige.

### 0x038A2 – Nachholspiele (Tagesverteiler 1D911, wenn Flag & 0x80 und 0x310A(Tag) ≠ 0)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 38AF-38C2 | Titel „Nachholspiele“ über 0x32F2 (Flaggenseite, 50 Ticks) | keine Ankündigung am Tag 0x80 (`live.ts:330`) | **A2** |
| 38C3-3937 | Einträge 5715.. (Tag = Argument, Spieltag ≠ 0) in Platzreihenfolge. 0x2B4F3(Liga, Spieltag) lädt die Paarungen; das Paar (Liga·10 + Nr.)·2 kommt in eine Liste mit höchstens 9 Plätzen | `replays()` in `postpone.ts:57`; Paar aus `fixtures` | stimmt im Ergebnis. Das Remake zählt nur so viele Einträge, wie es Marken 30 gibt (`postpone.ts:65`), und prüft Spieltag ≠ 0 nicht. Gleich, solange keine Alteinträge mit Tag ≠ 0 stehen; laut `season.ts:422` gibt es am Saisonende keine |
| 3943-397A | Liste auf die Bundesliga-Plätze von 4B5E schreiben, Ende-Marke 0x46 | Spiele direkt | stimmt |
| 3980-3987 | Treiber 0x46DB(0,0,0,0), Ligabits 0 | `playReplays` / `nachholtag` (`originaltag.ts:566`) | nicht Teil dieses Abgleichs |
| 398D-3A46 | Zweiter Durchlauf: Ergebnis aus der Bundesliga-Zeile 4cb3:225A (Hilfszeile) in 6DDC[(Liga·38 + Spieltag - 1)·20 + Nr.·2] kopieren; Tag-Byte = 0 | `spieleEins(..., matchday-1, match)`, `removeReplays` (`postpone.ts:96`) | stimmt |
| 3A57-3A7F | Hilfszeile löschen, nur 19 Bytes (0..18) | - | ohne Folge: die Zeile des nächsten Bundesliga-Spieltags ist leer |
| 3A81-3A8A | 4cb3:2280[Tag] = 0, also das ganze Kalenderbyte | `& ~0x80` (`postpone.ts:102`) | stimmt im Ergebnis: `replayDay` wählt nur Tage mit Byte 0 oder 0x80 |
| Stand danach | 4B5E hält die zuletzt geladenen Paarungen; ein Bundesliga-Teil ohne Bundesliga-Eintrag behält die Nachholliste | Paarungsblock unberührt (`matchday.ts:230`) | unklar, ob das im gespeicherten Stand sichtbar wird |

Kein Würfel in 0x38A2 selbst.

### 0x0310A (im Bereich 0x28C4) – Ist heute Nachholtag, ist der Manager dabei?

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 31A9-31D7 | Ist 304A = 30 (Tagesablauf): 1, sobald ein Eintrag den Tag trägt | `faellig.length` (`server.ts:1872`) | stimmt |
| 313C-31A2, 31D9-31F2 | Für einen Manager: Einträge seiner Liga (Byte 312), Paar über 0x2B4F3 laden, Verein (Byte 30) suchen. Danach werden die Paarungen des laufenden Spieltags zurückgeladen | Hauptmenü 0x9C18: bei Flag 0x80 steht „Nachholspiel“ (4cb3:25CC) statt „Spielfrei“ | **A3** |

### 0x028C4 – Restprogramm „Hinspiele/Rückspiele“ (aus der Vereinsinfo 0x2A41E bei 2B2E3)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 28C4-2B1E | Kopf mit Hin- oder Rückrunde (Spieltag 225A + Argument > Spieltage/2), dazu Vereinsname und die Knöpfe REICHT MIR, INFO und Hin/Rück | fehlt | **A4** |
| 2C11-3050 | Je Spieltag der Hälfte: Paarungen über 0x2B4F3 laden. Eintrag (H)/(A) mit Gegner, Platz und Stärke (0x2C128). Datum aus 0x2895 oder, bei verlegtem Spiel, aus dem Tag der Nachholtabelle. Ergebnis aus 6DDC, wenn gespielt und nicht 30 | fehlt | **A4** |
| 2D92 | 0x4290 schreibt das Datum nach 4238:2EBA/2E8E/A7A0, also in die gespeicherten Datumsfelder. Das Hauptmenü stellt sie mit 0x4290(0) wieder her (0xA643) | - | Eigenheit des Originals, im Remake gegenstandslos |
| 3053-3108 | Knöpfe; Hin/Rück schaltet um; zum Schluss 0x2B4F3(Liga, 225A) | - | - |

Kein Würfel. Geschrieben werden nur 4B5E (wird wiederhergestellt) und die Datumsfelder (siehe oben).

0x031FA (Hintergrund der Titelseiten: Flagge in Farbe 0/0x12/0x13, wenn 224E = 2252) ist reine Grafik: `drawAnkuendigung`.

### 0x01A49 – Stadionbildschirm (drei Aufrufe aus 0x0602)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 1A78-1B85 | Kontostand × 2252 / 224E (Faktor 1) mit Tausenderpunkten (07B2 = 0 → 0x7D31), dazu „ DM“ bei (154, 94). Mit Argument ≠ 0 steht nur diese Zeile | `main.ts` bei `drawStadium` (Kontostandzeile) | stimmt |
| 1C40-1CB4 | Zeile 0: jetzt = Art 1 + Art 2. Nach Ausbau zählen die Plätze im Bau dazu, wenn Resttage 1 oder 2 ≠ 0 | `stadiumCapacity` (`stadium.ts:83`) | stimmt |
| 1CB7-1D9A | Zeilen 1-7 = Art 1-7 (Datensatz ab Byte 350, je 8 Byte). Zahlen oder Texte 4cb3:2858 (Größen) und 283C (Noten), „nach“ = Wert + im Bau | `rowText` | stimmt |
| 1D9D-1E90 | Zeile 8: Eintrittspreis Byte 266 (Faktor 1), „ DM“ | `m.ticketPrice DM` | stimmt |
| 1EB9-1F00 | Zeilen 1-3: „nach“ nur, wenn Resttage (Byte 404 + 2k) ≠ 0; Zeilen 4-7: wenn der Wert im Bau ≠ 0 | Remake: immer Wert + im Bau | stimmt im Ergebnis, sofern Bau und Resttage zusammen auf 0 gehen (0x20E1, nicht geprüft) |
| 1F59-1F79 | Ohne Ausbau: „nach“ = „jetzt“ in Farbe 4, sonst Farbe 2 | `a === b ? INK_FAR : INK_MID` | stimmt im Ergebnis |
| 1F88-202B | Restzeit: **Resttage / 7 + 1** Wochen, x = 243 | `buildWeeks` = `Math.ceil(t/7)`, x = 244 (`stadium.ts:110`, `main.ts:5514`) | **A5** |

Kein Würfel, kein Schreibzugriff auf den Spielstand (nur die Anzeigeschalter 079C und 07B2).

### 0x040B6 – Kalenderblatt im Hauptmenü (0x971F bei 9DB6)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 40E5-4150 | Wochentag 4cb3:242C[(07DC + 5) mod 7], die Tabelle beginnt mit Montag | `DAYS[(seasonDay + 6) % 7]`, die Tabelle beginnt mit Sonntag (`main.ts:3087`) | stimmt (gleicher Index) |
| 4153-4283 | Monat 23FC[2E8E], Jahr A7A0 ohne Punkte (07B2 = 1), Tag 2EBA + Endung 0x50E7 (bei Sprache 3 ohne), große Schrift 243..304 | `drawMenuHeader` | stimmt |

Nur Anzeige.

### 0x08DBB – Managervorgaben bei Neues Spiel (0x8FD8 bei 92E2)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 8DC6-8DDA | Historieblock 4238:9336, 5012 Bytes, auf 0 | `newgame.ts:257` | stimmt |
| 8DDD-8E1A | Byte 308..310 der Manager = 30 für m < 07AB. 07AB ist beim Aufruf 0 | Pokalrunden bleiben 0 (`newgame.ts:316-317`) | stimmt: der Code läuft nie |
| 8E22-8EA9 | Die ersten 2560 Bytes (4 × 64 × 5 × 2) = 0xFF; Byte 29 = Platz + 1 für alle vier Plätze | `newgame.ts:314-319` | stimmt |

Kein Würfel.

### 0x0F749 – Credits (Klick im Startbildschirm, 0x94B2 bei 95DA)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| F749-F9D0 | Mit XOR 0xC8 verschlüsselte Namen (4cb3:50A4, 50D8, 50F2, 513A) und „WENN SIE WOLLEN, KÖNNEN SIE JETZT DIE MAUSTASTE DRÜCKEN...“ | fehlt | reine Anzeige, **A6** |

### Befunde

### Spielrelevant
Keine. Die Würfel (0x043D3) und alle Schreibzugriffe auf den Spielstand (0x0462E, 0x03BE8, 0x033BF, 0x038A2, 0x08DBB) stimmen mit dem Remake überein. Eine Einschränkung ist unklar: die Paarungen 4B5E nach einem Nachholtag (siehe 0x038A2, „Stand danach“).

### Anzeige

| | Was | Original | Remake | Folge |
|---|---|---|---|---|
| A1 | Ankündigung am Relegationstag | 0x33DF: „Relegationsspiel“ (4cb3:26AC), 50 + 50 Ticks | `server/live.ts:330`: Flag 0x10 fällt unter `FLAG_EUROPE` | Es steht „Europapokal“ da |
| A2 | Ankündigung am Nachholtag | 0x38AF: „Nachholspiele“ (4cb3:2978), 50 Ticks | `live.ts:330`: bei Flag 0x80 `undefined` | Es kommt keine Titelseite |
| A3 | Kopf des Hauptmenüs | 0x9C18 mit 0x310A: „Nachholspiel“, wenn der eigene Verein heute nachholt | `dayEvent` (`main.ts:3173`) kennt den Fall nicht | Es steht „Spielfrei“ da |
| A4 | Restprogramm 0x028C4 samt Vereinsinfo 0x2A41E | Klick auf einen Verein in Tabelle, Spielplan, Stärken oder Pokalliste | es gibt keine Klicks auf Vereine | Der Bildschirm fehlt; im AUDIT steht er nicht als fehlend |
| A5 | Stadion-Restzeit in Wochen | 0x1FBB: Resttage / 7 + 1, bei x 243 | `Math.ceil(t/7)` bei x 244 | Bei Resttagen, die durch 7 teilbar sind, eine Woche weniger (84 Tage: Original 13, Remake 12) |
| A6 | Credits 0x0F749 | Klick im Startbildschirm | fehlt | nur Anzeige |

**Offene Frage zu A5:** `stadium.test.ts:102` hält „im Original gemessen 84 → 12“ fest. Der Code ergibt 13. Vermutlich wurde die Messung einen Tag versetzt abgelesen, das ist aber nicht belegt. Vor einer Änderung sollte die Messung mit Resttagen genau 84 wiederholt werden.

Zur Doku: Die Zeilen 0x028C4 und 0x0F749 in AUDIT-ROHDATEN fassen mehrere Funktionen zusammen (siehe oben).

## Teil 2: Statistik-Büro, Ewige Tabelle/Bilanz und Kleinroutinen

Geprüft habe ich mit der Disassembly (tools/fpu.py), den Bildschirmfotos `docs/original/buero-statistik.png` und `buero-ewige-tabelle.png` und kleinen Leseskripten im Scratchpad gegen die Spielstände in `~/bmp-spiel/*.MAN`.

**Ergebnis:** Ich habe **keinen neuen spielrelevanten Befund**. Nur 0x324DE würfelt, und es stimmt mit `randomName` überein. Nur 0x30954 schreibt in den Spielstand; diese Abweichung ist schon bekannt. Dazu kommen elf Anzeige-Befunde.

### 0x26DE7 Statistik-Büro (würfelt nicht; schreibt nur die Formatschalter 4cb3:079C und 4cb3:07B2 und die Palette)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 26DF4-26F85 | Kästen; Schulden = -0x1222D(0,99); Palette 19..31 aus 4cb3:5498 | `panel`, `loanTotal(g,m,false)` | stimmt |
| 276C4-277FA | Beschriftungen aus 4cb3:2448, '!' macht eine Überschrift (y+=6, Strich, y+=11). Spalten beginnen bei (8,16), (209,16) und (8,197) | `ueberschrift`/`zeile` | stimmt |
| 26FDB, 27122-27158, 27062-270CC | Serien Zeile 1..7: laufend = 4238:9D33+3·(7·Verein+r)+s, Rekord = 4238:A273+3·(7·Mgr+r)+s, als "pad(lauf)(pad(rek))" mit Mindestbreite 2, bei 0 "^@" (0x26D8F). x = 84+34·s | `seriesCurrent`/`seriesRecord` (Save +2560/+3904), `fmt` | stimmt |
| 26FF3-27048, 0x284D1 | Tore/Gegentore je Spiel: "  " + trunc(10·Tore/Spiele) als "x.y", Spaltencode 4cb3:54B2 = [2,0,1] (G = gesamt, H, A); 0 Spiele → "0.0" | `zehntel`/`per` | stimmt |
| 27160-271C0 | Rekorde über 0x2B31E (Zeile-11), x = 84 (96 nur bei 4cb3:2252 = 3, also nie mit DM 1:1) | `clubRecords`, x 84 | stimmt |
| 271FB-2723F | BESUCHERZAHL: bei Byte 314 = 0 "(NOCH KEINE...)", sonst i32 484 | `rechts(..., dm(a.total))` | **S1** |
| 27242-2727E | SCHNITT/SPIEL: bei 0 Spielen "(NOCH KEINER...)", sonst 484/314 | `average` | **S1** |
| 27280, 0x17555 | BENÖTIGT: (12·Ausgaben − 12·Einnahmen)/(4cb3:225E[Byte 312] − 1)/Byte 266, negativ → 0 | `needed`; die Liga kommt aus der Vereinsnummer statt aus Byte 312 | stimmt, solange Byte 312 zum Verein passt (in allen Spielständen) |
| 27289-27305, 274BE-2756D | ZUSCHAUERREKORD: bei 0 "(NOCH KEINER...)" ohne Zahl, sonst Zahl hinter der Beschriftung und "(Verein)" darunter | `rekord(...)` zeigt immer Zahl und Klammer | **S1** |
| 27308-27381 | MINUSKULISSE: bei 99999 "(NOCH KEINE...)" ohne Zahl, sonst wie oben | `minus: 99999 ? 0` → "0" und "()" | **S1** |
| 27384-2748A, 27410-27494 | KONTOSTAND i32 496 und SCHULDEN, jeweils ·2252/224E (= 1) + " DM", Tausenderpunkte (07B2 = 0), Mindestbreite 2 | `dm()` | stimmt bis auf 0 ("^0 DM" statt "0 DM", **S2**) |
| 27583-27664 | Monatsbilanz 0x17076/0x17262 bei x 148, **Mindestbreite 7** mit '^' | `dm(st.income)` ohne Auffüllen | **S2** |
| 2766A-276BF | Zeilenschritt 8, ab Zuschauer 15, nach MINUSKULISSE +18 | ebenso | stimmt |
| 277FD | "G       H       A" bei (92,20) in Farbe 11 | ebenso | stimmt |
| 2785F-27A5A | Zuschauerbalken: Min/Max über Byte 330.. (Anzahl Byte 314, keine 20er-Kappe), h = (v−min)·11/Spanne+2, Umriss Farbe 0x15, Füllung Farbe 0x11 | `Math.min(20, games)`; der Zähler zählt nur Ligaheimspiele (≤19) | stimmt |
| 27A5D-27B7E | Farbskala: Kontostand − Schulden, Schwelle ab −2.375.000 in 50.000er-Schritten, Stufe alle 7 px bis 12, Randmarken bei ≤ −2.375.000 und > 2.325.000 | ebenso | stimmt |

### 0x27BD7 Ewige Tabelle / Ewige Bilanz (würfelt nicht; schreibt nur 079C/07B2)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 27BED-27C69 | Auswahlsortierung mit sofortigem Tausch über 64 Tabellensätze, u32 +50, tauscht bei größer (vorzeichenlos) | `allTimeTable` | stimmt |
| 27C6B-27E8F | Kästen, Überschriften mittig, Striche, Kränze 36.VGA 21x113 bei (155,22)/(281,22) | `drawEwige` | stimmt |
| 27F33-27FBD | Titel mittig 176..286 bei y 30+23i; Wert mittig 176..281: bei 0 der Text " KOMMT VIELLEICHT NOCH..." (Farbe 1), sonst **nur die Zahl** (Farbe 11) | `` `${n} x` `` | **E1** |
| 27EED-27F27, 27FC0 | Zeilenbeschriftungen bei (148,156+7i), Kopf bei (183,147) | ebenso | stimmt |
| 27FFA-281E7 | Bilanz: PUN. 420/422 : 432/434, TORE 424/426 : 428/430, SIEGE 440/442, NIED. 444/446, UNEN. 448/450. Spalten gesamt/H/A, Mindestbreite 4, "a:b" als eine Zeichenkette bei 169+48k, Einzelwerte bei 179+48k | `allTimeBalance`, `pad(...,4)` | stimmt; Tausenderpunkte siehe **E3** |
| 281EA-2839F | Tabelle: 07B2 = 0, dann für Platz si = 0..63 (auch die Sätze 58..63). Managervereine: gezeigt++ nur bei **si < 23**; angezeigt wird bei si < 23+gezeigt oder bei Managerverein. Punkte = u32 mod 100000 (0x3BC80 ist vorzeichenloses mod), Breite 4 mit Punkten. Die Punktreihe bei x 13 (6 Pixel) kommt, wenn si = gezeigt+22 und 4cb3:07AB ≠ gezeigt | `allTimeTable` filtert c < 58 **vor** dem Nummerieren; gezeigt++ bei i < 23+gezeigt | **E2, E3, E4** |
| 283D9-2847E | Ring um den linken Kranz, Farbe 0xD (grün) oder 0x12 (rot). i = 0: grün, wenn Bit 0 von 4238:4BEC[Mgr] (Meisterschaft verspielt) frei ist und Byte 312 = 0. i ≥ 1: grün, wenn Mgr-Byte 305+i = 4238:0007+i (laufende Runde des Pokals) | i = 0: nur Byte 312 = 0; i ≥ 1: `0 < Byte < 8` | **E5** |

### Kleinroutinen

| Adresse | Was | Remake | Urteil |
|---|---|---|---|
| 0x10AF2 | Trainingsbild: über Kaderplätze **0..Anzahl−1** (0x31A19 Modus 0) mit Nummer 1..11 die Summen von Byte 16, 17 und 19 (roh, ohne Kappung) und Schnitt Byte 19/n (n=0 → 1). Nur Anzeige | `trainingBars` (training.ts:269) über `squadOf` | **T1**; Kappung auf 100 unklar (siehe unten) |
| 0x197D5 | Klasse eines Vereins: < 18 → 1, < 38 → 2, sonst 4 (4cb3:226F/2270). Aufrufer 0x28EE, 0xC6CC, 0x10271, 0x2A6DA, nah 0x1805C, 0x18DB7/18DC5, 0x199B3/199C6 | `clubClass` (europa.ts:96), `bandOf` (ai.ts:66) | stimmt |
| 0x227F1 | Jugendregler: 37.VGA (0,54) 50x41 bei (209,193), Striche y 212/213 von 217 bis 217+Wert, Betrag (Wert+1)·10000>>4 = ·625 mittig 211..261 bei y 223 in Farbe 0x1D | main.ts:770-774 | stimmt; Tausenderpunkte hängen am klebrigen 07B2 (unklar) |
| 0x22995 | Trainingsbälle: Leisten x 5/300, y 177−16k, höchstens 10 sichtbar (Schnitt ≤ 34); Balkenbälle x 31/210 + 16(k−1), y 36+37i bzw. 190. Maske (21,21) 15x15. Modus 0 stellt den Hintergrund wieder her | `drawTraining` (main.ts:707-740) | stimmt (Modus 0 braucht der Canvas nicht) |
| 0x2EA7F | Blocksatz der Zeitung. Modus 1: x/y setzen. Modus 0: Wort anhängen; ist die Probe breiter als maxw, werden reihum ab der ersten Lücke einzeln Leerzeichen eingefügt, **bis Breite ≥ maxw**, dann wird die Zeile gezeichnet und y += 7. Modus 2: ein ',' am Ende weg, letzte Zeile links. Bei maxw = 295 und gesetztem Merker zeichnet 0x2E9AA: bis ':' in Farbe 6, der Rest in Farbe 0xE. Aufrufer: Artikel maxw 180 bei (13,60), Aufstellung maxw 295 bei (13,187) | web `umbruch`/`blocksatz` mit 181/296 und `floor`; core `artikelspalte` mit 180 | Auffüllung gleichwertig; **Z1**; Farben unklar |
| 0x2F0D3 | Satz in Wörter zerlegen (Trenner ' ' und 0xA0, je Trenner ein Zeichen überspringen) und an 0x2EA7F geben; liefert das letzte y | core `artikelspalte` (zeitung.ts:276) | stimmt. Doppelte Leerzeichen gäben ein leeres Wort; das Web filtert es heraus, der Core nicht (unklar, ob so ein Text vorkommt) |
| 0x30954 | Meldung nach Textzeiger löschen: Manager 0..07AB−1 und Plätze < 4cb3:0618[m] (Zeiger 4cb3:5524+(20m+k)·4) durchsuchen, Text freigeben, nachrücken, Zähler 0618[m]−−. Schreibt Spielstand (Save 41 und Meldungsliste), würfelt nicht | eigene Meldungsliste des Servers | bekannt *anders* (0DF0D.md C, contracts.ts:262-265) |
| 0x32480 | Namensliste eines Vereins in MANA (64 Sätze zu 0x21F, strcmp mit dem Vereinsnamen), Ergebnis +0x17+26·idx. Nicht gefunden → liest hinter Satz 63 | `manaListOf` (newgame.ts:95): undefined, dann neuer Wurf | stimmt (Fall "nicht gefunden" kommt nicht vor) |
| 0x324DE | **Würfelt**: Name = random(tab[g], tab[g+1]−1) mit tab 4cb3:9432 = [0,2,8,15,20]; Verein = random(0, 225E−1 = 17), neu, solange es ein Managerverein ist. Leer oder schon unter Spieler 1..150 → alles neu. Bei Platz ≠ 0xFF: Spieler+36 = Verein, danach setzt 0x329C5 wegen 4238:513C (22251) > 2000 wieder 0xFF | `randomName` (newgame.ts:78); +36 = 0xFF | stimmt (Würfelfolge gleich) |

### Befunde

### Spielrelevant
Keine neuen.

### Anzeige
| | Was | Original | Remake | Folge |
|---|---|---|---|---|
| S1 | Leerwerte der Zuschauerspalte fehlen | 0x271FB/0x27242 (Byte 314 = 0), 0x272B1 (Rekord 0), 0x27333 (Minus 99999): Texte 4cb3:4A46 "(NOCH KEINE...)" und 4A56 "(NOCH KEINER...)", dann keine Zahl (0x274C8 ff.) | main.ts:5097-5108, display.ts:300 | Vor dem ersten Heimspiel zeigt das Remake "0", "0 (…)" und "()" statt der Hinweise. Die Texte fehlen auch im Katalog (`ui.statistik`) |
| S2 | Auffüllen mit '^' fehlt | Monatsbilanz mit Mindestbreite 7 (0x27587); Werte 0 mit Breite 2 → "^0" (0x7E1B) | main.ts:5118-5119, `dm()` in gfx.ts:253 | Beträge unter 100.000 DM rücken eine Ziffernbreite nach links; 0 bei Kontostand, Schulden und Benötigt ohne '^' |
| E1 | Titelzahl mit " x" | 0x27F9B: nur `ltoa(n)` | main.ts:5242 | "3 x" statt "3" |
| E2 | Nummer ohne Pseudosätze 58..63 | 0x28256 nummeriert si+1 über alle 64 Sätze | display.ts:330 filtert vor dem Zählen | Die Sätze 58..62 haben Punkte (z. B. 39,83,26,5,24 in TEST4) und stehen dort auf Platz 43-62. Ein Managerverein darunter bekommt im Remake eine bis fünf Plätze weniger |
| E3 | Keine Tausenderpunkte | 0x281F1 setzt 07B2 = 0 → "1.234"; die Bilanz (vor 281F1) hängt am vorherigen 07B2 (unklar) | main.ts:5205 und 5253-5258 `pad()` | Ab 1000 Punkten (Tabelle) "1234" statt "1.234" |
| E4 | Zählung der Managervereine | 0x2822B: gezeigt++ nur bei si < 23 | main.ts:5193-5194: bei i < 23+gezeigt | Liegt ein Managerverein in den Top 23 und ein zweiter auf Platz 24: das Remake zeigt einen fremden Platz 25; das Original zeigt Platz 24 und danach eine Punktreihe ohne Folgezeile |
| E5 | Ringfarbe der Kränze | 0x283F0 (Bit 0 von 4BEC, Meisterschaft verspielt) und 0x28430 (Pokalbyte = laufende Runde 4238:0008..) | main.ts:5229 | Wer im DFB-Pokal ausgeschieden ist, aber nicht auf 30 steht (RIED-3TE: Runde 5, Manager 1/1/2; RIED-5TE), hat im Remake grün, im Original rot. Nach "Meisterschaft verspielt" bleibt der erste Ring grün |
| T1 | Trainingsbalken zählen einen Starter hinter einer Lücke mit | 0x10B22/0x10B8B: Plätze 0..Anzahl−1 (wie K5 in 0F9D2.md) | training.ts:274 `squadOf` | RIED-6TE und RUNA5, Manager 2: Original T/E 17/7 bzw. 17/12, Remake 18/6 bzw. 18/11 (mit Kappung gerechnet) |
| Z1 | Zeilengrenze der Zeitung um eins zu weit | 0x2EFE9 maxw 180, 0x2E407 maxw 295; Umbruch bei Breite > maxw | main.ts:2505 (181), 2512 (296) | Eine Zeile von genau 181 (bzw. 296) Punkten bricht im Original um, im Remake nicht. Dann weicht auch der Umbruch vom Core ab (zeitung.ts:288 nutzt richtig 180). Das Auffüllen ist gleich (ceil bei 180 = floor bei 181) |

### Unklar
- **Frische-Kappung:** 0x10AF2 addiert Byte 19 roh (ah = 0, keine Grenze). Die Kappung auf 100 in training.ts:280 ist gemessen, stammt aber nicht aus dieser Routine; die Quelle ist weiter offen.
- **Tausenderpunkte:** 4cb3:07B2 steht im Abbild auf 1 und wird von vielen Bildschirmen umgestellt (die Statistik lässt 0 zurück, die Ewige Tabelle setzt am Ende 1). Ob Jugendregler (0x227F1) und Ewige Bilanz Punkte zeigen, hängt vom vorher besuchten Bildschirm ab.
- **Farben der Zeitungsaufstellung:** Das Original zeichnet sie über 0x2E9AA in Farbe 6 (bis ':') und 0xE; das Remake zeichnet alles schwarz. Ohne Zeitungsfoto lässt sich nicht sagen, ob das einen sichtbaren Unterschied macht.

### Randnotizen zu den Rohdaten
- 0x2DCA1 enthält ab 0x2E3AE eine eigene Routine, den Aufsteller der Zeitungsaufstellung (Spielbericht 4238:90CA, Schrittweite 0x9A). Daher kommen die meisten nahen Aufrufe von 0x2EA7F.
- 0x2E9AA/0x2ECB9 sind der Blocksatz der Zeitung, nicht der Hilfetexte (restroutinen.md liegt hier falsch).
- 0x30954 hat mehr Aufrufer als in AUDIT-ROHDATEN notiert: zusätzlich 0x1FE52, 0x2356A, 0x23A50 und 0x26182.
- 0x2EFAB würfelt random(0,1) nur, wenn 4cb3:224E ≠ 2252. Bei DM 1:1 kommt das nie vor.
