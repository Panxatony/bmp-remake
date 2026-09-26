# Audit 2, Gruppe F: 0x242CF bis unter 0x2A41E (26.9.2026)

Nur gelesen, im Repo nichts geändert. random = 076B:0CC7(lo,hi) inklusive, hi zuerst gepusht (rand()%(hi-lo+1)+lo, 0x8377); 3A01:1AE6 = lmul, 3A01:1A4C = ldiv (vorzeichenbehaftet).

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x242CF | Verkaufsdialog "Angebot"/"Abl\|se", Abzug Angebot/7·Jahre vom Betrag, Rückgabe Knopf | core sim/transfer.ts `saleOffer`/`decideSale`, web main.ts `drawMarketDialogs` | Rechnung stimmt; Anzeige Befund F10 (Aufrufer 0x22C15: F8, F9) |
| 0x245A8 | Markterneuerung: KI-Spieler entfernen, free=12-kept-random(0,free), Platz random(0,11)/Spieler random(1,150) (≤1500 Würfe), Byte30 random(45,55), Ko/Te random(0,14)+Stärke-10 (+random(12,20) bei random(0,4)=0), 10..99, 0x224A8, Byte33=4, Byte36, Preis 24D4E(…,4) | transfer.ts `refreshMarket` | stimmt (Wurfreihenfolge, Grenzen, Schleifen) |
| 0x2463A | Ligabandsuche (226E/225E/2272, Index 3→2), neuer Verein bis 0310:32B1=0 | `refreshMarket` | stimmt |
| 0x248C4 | Zähler -0xA = 0, Sprung in Bandsuche (Eigenheit T3) | `refreshMarket` | stimmt |
| 0x248E1 | KI nimmt Kaufangebot an: ·random(75,85)/100 > Angebot → nein; ·random(120,130)/100 < Angebot → ja; sonst Angebot·100/Preis > random(80,120) | transfer.ts `aiAccepts` | stimmt (32-Bit-Überlauf s. unklar) |
| 0x249E0 | Vertragsverhandlung | core sim/contracts.ts `contractCheck` | Rechnung stimmt; Befund F1 (Marktwert ohne Wurf), F9-Doku F20 |
| 0x24D4E | Marktwert/Gehaltsbasis (Flags 1/2/4) | core sim/value.ts `playerValue`/`wertAusDatensatz` | stimmt Term für Term; Aufrufer ohne rng: F1 |
| 0x251FF | Vertragsdialog (Absagen, Forderung, "So dumm", Verhandlung, Byte 24) | contracts.ts, server.ts (/api/newcontract, /api/contract, /api/vertragsende, /api/market/contract), main.ts | Befunde F2, F3, F4, F5, F6, F11, F12, F21 |
| 0x262F4 | Schalter AN/AUS aus PIC/33.VGA | main.ts `drawOptionen` | stimmt |
| 0x26376 | Geschwindigkeitsknopf | main.ts `drawOptionen` | nicht nötig (Grafik); Wertebereich F13 |
| 0x264A8 | Einstellungen (15 Schalter 4cb3:05FE, Geschwindigkeit 063A, versteckte Tasten) | main.ts `drawOptionen`, server api/options | Befunde F7, F13 |
| 0x265F8 (in 264A8) | "V2.0 - ENDE: " + (513C<2000 ? Zahl : " NIE.") + " (LEVEL " + (5-4A28) + ")" | main.ts `drawOptionen` | stimmt (513C = 22251 → immer NIE.; Saisonende bewusst entfallen) |
| 0x26D8F | Zahl mit Mindestbreite, 0 → "^@" | main.ts `pad` | stimmt |
| 0x26DE7 | Statistik-Büro | main.ts `drawStatistik`, display.ts `statistics` | stimmt (S1/S2 aus anzeigen.md behoben, nachgeprüft) |
| 0x27BD7 | Ewige Tabelle / Ewige Bilanz | main.ts `drawEwige`, display.ts `allTimeTable`/`allTimeBalance` | stimmt (E1-E5 behoben); Tausenderpunkte unklar |
| 0x284D1 | Tore je Spiel "x.y" / "x.y:x.y" | sim/vereinsinfo.ts `toreJeSpiel`, display.ts | stimmt |
| 0x286D4 | Auswahlrand Werbung | main.ts `drawWerbung` | nicht nötig (Grafik) |
| 0x2877A | Großes Sponsorenlogo | `drawWerbung`/`drawLogo` | nicht nötig (Grafik) |
| 0x287DD | Kleines Trikotlogo | `drawLogo` | nicht nötig (Grafik) |
| 0x28841 | Vertragstext "VERTRAG: n MONAT(E)/JAHR(E)" / "K}NDBAR" + Betrag | `drawWerbung` | Befund F14 |
| 0x28B0F | Sponsorangebot / "KEIN INTERESSE..." | `drawWerbung` | stimmt |
| 0x28C98 | Werbeeinnahmen Trikot/Banden/TV/Ausgaben/Summe | `drawWerbung` | stimmt |
| 0x28ED8 | Werbebildschirm: Trikot-/Bandenvertrag abschließen, Werbeausgaben ±2500 | core sim/werbung.ts `signShirt`/`signBoard`, server.ts /api/werbebudget, /api/werbung, main.ts `drawWerbung` | Spielstand stimmt; Anzeige/Bedienung F15-F18 |
| 0x299DC | MANA.DAT lesen: Logos, Bytes 24..29, Byte 30+d = random(45,55)-(Verein>64?5:0), Byte 23 = random(45,55), Namen, Tabellenreihenfolge 535A | core sim/newgame.ts `createGame`, data/mana.ts `parseMana` | stimmt (Reihenfolge 30,31,32,23 je Verein) |
| 0x29BFE | Managerverlauf "Damals... Ihre Erfolge" | main.ts `drawVerlauf`, records.ts `history` | stimmt; Grafik F19 |

26 Einträge (22 Routinen der Rohdatenliste plus die Teilstücke 0x2463A, 0x248C4, 0x265F8).

## Befunde

### F1 (S) Marktwert ohne Würfel in Forderung und Verhandlung
- Original: 0x251FF ruft bei 0x25C2F `call 0x24d4e` (Flags 5), 0x249E0 bei 0x24C66 ebenso. In 0x24D4E: 0x250C6 `testb $0x80,%es:0x9(%bx)`, 0x250CD `cmpb $0x3f,%es:0x16(%bx)`, 0x250F9 `lcall $0x76b,$0xcc7` mit (95,100). Hat ein KI-Verein ein Angebot auf den Spieler (Byte 9 Bit 7) und ist Byte 22 ≤ 63, wird gewürfelt.
- Remake: contracts.ts:48, :55, :79, :93 rufen `playerValue(...)` ohne rng → fester Faktor 97, kein Wurf.
- Folge: Forderung/Schwelle anders, Zufallsfolge verschoben (0x251FF rechnet die Forderung bei jeder Jahreseingabe neu).

### F2 (S) Kauf: Verhandlung auf dem Marktplatz statt auf dem neuen Kaderplatz, ohne 0x249E0
- Original: 0x23E86 `lcall $0x1ecd,$0x37d8` (0x224A8) legt den Kaderplatz an (würfelt Byte 19, Byte 14 = random(35,65), Byte 20), dann 0x23ED8 `call 0x251ff` mit diesem Platz; erst ab 0x23EE5 werden Byte 9/23/13/0/1/2 vom Marktplatz kopiert. Im Dialog ruft NEUER VERTRAG immer 0x249E0 (0x26012/0x26029, -0x6 = 0): random(q-6,q+4), nach Tag 321 zweiter Wurf, Schwelle ≥ 100.000 → nein. Jeder Ausgang außer Zustand 3 setzt Byte 24 = random(10,18) (0x26195).
- Remake: transfer.ts:527 rechnet die Forderung mit dem Marktplatz als `source`; server.ts:3257-3272 ruft `contractCheck` nur bei eigenem Gehalt, eine der vier Forderungen wird ohne Prüfung angenommen; die Würfe von 0x224A8 (completePurchase → addToSquad) kommen erst danach.
- Anders: (a) Wert/Mindestgehalt aus dem Marktplatz (Byte 14, Tore, Einsätze, Karten, Byte 9 Bit 7); (b) Würfe von 0x249E0 und 100.000-Grenze fehlen; (c) Wurfreihenfolge anders, nach Absage/ABBRUCH hat das Original schon 0x224A8 und random(10,18) verbraucht.

### F3 (S) Verlängerungsangebot des Spielers (Byte 24 = 100+J) lässt sich nicht annehmen
- Original: 0x255F3 `cmp $0x63,%ax; jle`, 0x255F8 `subw $0x64,-0x6(%bp)`; Dialog öffnet mit den angebotenen Jahren. 0x25FB8-0x25FE4: angenommen nur bei gleichen Jahren und Gehalt ≥ Byte 40, sonst Zustand 2 ohne Meldung; 0x26012 `cmpw $0x0,-0x6(%bp); jne 0x26036` → kein 0x249E0. Ohne Eingabe Gehalt = Byte 40 (0x25F3B). Danach 0x26182 und random(10,18).
- Remake: main.ts:4697 `l.u8(24) > 0 && !(l.u8(24) & 0x80)` → "ist im Moment nicht verhandlungsbereit" auch bei 100+J; `room.offers` (server.ts:2064) liest der Client nie, `/api/contract` wird nicht aufgerufen. Der ungenutzte Pfad weicht ebenfalls ab: `acceptOffer` (contracts.ts:220) setzt salaryDemand statt bisheriges Gehalt, /api/contract (server.ts:2929) würfelt contractCheck.

### F4 (S) Spieler mit angekündigtem Karriereende lässt sich verlängern
- Original: 0x255C9 `testb $0x80,-0x6(%bp)` → "… wird sich mit Ablauf des Vertrages zur Ruhe setzen." (4cb3:4EF4-4EFE), Dialog endet.
- Remake: main.ts:4697 lässt Bit 7 durch; /api/newcontract (server.ts:2866ff) prüft weder Byte 24 noch Byte 12. Eine Einigung setzt Byte 24 = random(10,18) und löscht Bit 7 → Rücktritt entfällt.

### F5 (S) Vorprüfung "So dumm" fehlt
- Original 0x25F4D-0x25FB3: `cmpb $0x1,-0xa4(%bp)` (Zustand 1), Jahre > Byte 11 (0x25F5C ff.) und Gehalt < -0xe (= Byte 40, bisheriges Gehalt, 0x25F6E ff.) → `lcall 3091:0E3A` mit 4cb3:4F1C/4F20/4F24 = "So dumm" / "ist" / "leider nicht..." (im Bild nachgelesen); Zustand 2, kein 0x249E0, danach random(10,18).
- Remake: server.ts:2878 ruft immer `contractCheck` (würfelt, kann annehmen).
- Dazu D: SPIELMECHANIK.md:2084-2086 sagt "weniger Gehalt als gefordert"; verglichen wird mit dem bisherigen Gehalt.

### F6 (S) Byte 24 = random(10,18) fehlt an mehreren Ausgängen
- Original: jeder Ausgang außer Zustand 3 → 0x26165 → 0x26195 random(10,18) → 0x261A8 `mov %al,%es:0x18(%bx)`. Zustand 3 nur ohne Eingabe, ohne Angebot, bis Tag 321 (0x25AA9/0x25EFD).
- Remake fehlt der Wurf: bei "zu lange" (0x25A33 Zustand 2; server.ts:2876 kehrt vorher zurück), bei ABBRUCH nach Eingabe (main.ts:4451 schließt nur), am Saisonende nach Absage und bei KEIN ANGEBOT (server.ts:2880-2884, /api/vertragsende; `vertragsendeFreigeben` würfelt nicht).

### F7 (S) Versteckte Tastenfunktionen der Einstellungen fehlen (Schummeltasten)
- Original 0x26A85-0x26AB4: Taste über `lcall 35ac:3272`, Farbe unter dem Mauszeiger über 3930:043A; nur bei `cmp $0xb,%ax` (Farbe 11) und Taste ≠ 0 weiter nach 0x26ABC:
  - '0'..'5' (0x26C34): `mov $0x35,%al; sub -0x6(%bp),%al; mov %al,%es:0x4a28` → Spielstufe 0..5 (Remake begrenzt in newgame.ts:285 auf 1..4).
  - 'g' (0x26AEE): Geld des aktuellen Managers (4238:2432+778·Mgr) += 200.000 (`addw $0xd40`/`adcw $0x3`).
  - 's'/'a' (0x26B9A): für die 24 Kaderplätze mit Byte 15 ≠ 0: Byte 14 = 0x44, Byte 19 = 0x32; bei 'a' zusätzlich Byte 16..18 = 99 und Geld = 99.999.999.
  - 'd' (0x26B52): 4cb3:05AD = 0, 50 Dwords ab 4238:A6D8 = 0, 05AE = 0. 'p' (0x26C22): 4cb3:05F5 = 1.
- Remake: nichts davon (main.ts `drawOptionen`, server.ts); ABWEICHUNGEN erwähnt es nicht. Wohl als bewusste Abweichung festzuhalten.

### F8 (S) Kaderverkauf: Verein und Stärkeschnitt werden erst nach dem Entfernen gelesen (vom Nachrücker) – Aufrufer 0x22C15, außerhalb von F, gehört zum Dialog 0x242CF
- Original: 0x235DD `lcall $0x1ecd,$0x10ee` (0x1FDBE(Platz,1,0x18)) entfernt den Platz, Nachfolger rücken auf. Danach 0x235E5 `les -0x24(%bp),%bx; mov %es:0x16(%bx),%al; … mov %ah,%es:0x16(%bx)` und 0x23601 `mov %al,%es:0x5801(%bx)` (Spielerbyte 36 des verkauften Spielers, 37·Nr), 0x2360B-0x2361D Bytes 0x10/0x11/0x12 → /3 → `lcall 14a4:23da` (0x16E1A). Alles vom selben Platz, der jetzt den Nachfolger enthält (selbst nachgelesen).
- Folge im Original: Spielerbyte 36 = Byte 22 des Nachfolgers (meist 0), 0x16E1A stärkt diesen Verein mit dessen Schnitt, Byte 22 des Nachfolgers wird genullt. Der Marktpfad (0x23A6A-0x23AEA) liest vorher und ist korrekt.
- Remake transfer.ts:455-456 liest `avg`/`club` vor `removePlace`, in beiden Pfaden vom verkauften Spieler. Nicht in ABWEICHUNGEN/transfer.md.

### F9 (S) Kaderspieler mit Karriereende-Bit und Angebot lässt sich verkaufen – Aufrufer 0x22C15, außerhalb von F
- Original 0x2347A `testb $0x80,%es:0x18(%bx); je 0x234a4`: bei gesetztem Bit Meldung 076B:0E57 ("hört am Saisonende auf"), Ende – vor dem Angebotstest 0x234AE `testb $0x40,%es:0x9(%bx)`.
- Remake: `saleOffer` (transfer.ts:429-436) und `marketSquadClick` (web) prüfen Byte 24 Bit 7 nicht. Erreichbar (Bit 6 bleibt tageweise, `karriereAnkuendigung` contracts.ts:156 setzt Bit 7 täglich möglich).

### F10 (A) Verkaufsdialog zeigt unter "Abl|se" den Nettobetrag statt des Abzugs
- Original 0x2441B-0x24449: `push` Jahre, `push 7L`, `push *amount`, `lcall 3A01:1A4C`, `lcall 3A01:1AE6`, `mov %ax,-0x4a(%bp)`, `sub %ax,%es:(%bx); sbb %dx,%es:0x2(%bx)`; 0x24482 `push -0x48(%bp); push -0x4a(%bp)` → 076B:0681 bei y 0x98 zeigt den Abzug Angebot/7·Jahre unter Text 4cb3:1CCA "Abl|se".
- Remake main.ts:6818 `Abl|se: ${dm(sale.fee)} (${sale.years} Jahre Vertrag)` zeigt Angebot − Abzug und den Zusatz "(n Jahre Vertrag)", den das Original nicht hat. Buchung stimmt.

### F11 (A) Absage bei Leihspielern ohne Vereinsnamen
- Original 0x2557D-0x255BE: `3091:0E3A(Name, "ist leider von", 4238:3066+34·(Byte12&0x7F), "nur ausgeliehen.")`.
- Remake main.ts:4694 `[`${name} ${abs[3]}`, abs[4]]` – Verein fehlt.

### F12 (A) Falscher Ablehnungstext nach der Verhandlung
- Original 0x26127-0x26158: Zeiger 4cb3:4F28/4F2C/4F30 = "ist nicht an" / "Ihrem Angebot" / "interessiert." (im Bild nachgelesen).
- Remake main.ts:4471 zeigt bei jedem `!ok` "So dumm ist <Name> leider nicht…" und übergeht die Servermeldung.

### F13 (A + D) Geschwindigkeit reicht im Original 0..70, nicht 0..75
- Original 0x26D1B-0x26D59: x auf [0xCA,0x110] begrenzt (`cmpw $0x110 … movw $0x110`, `cmpw $0xca … movw $0xca`), 4cb3:063A = x-0xCA ≤ 70.
- D: SPIELMECHANIK.md (Einstellungen) "reicht von 0 bis 75 (Vorgabe 40)".
- A: main.ts `drawOptionen` (~7183) `Math.round(((o.tempo - 1) * 75) / 8)` → Knopf bei Stufe 9 fünf Punkte über das Bahnende; richtig ·70/8 (Rückrechnung `(cx-202)*8/70`).

### F14 (A) Werbung: Vertragskasten ohne laufenden Vertrag
- Original: Auswahl Foto/Bandenfeld (0x29540-0x29726) ruft 0x28841 mit Restmonaten und Betrag (066C bzw. 0670+4·(9m+Platz)); bei n = 0 0x28892 `cmpb $0x0,0x6(%bp)` → 0x28972 strcpy(4cb3:4AAC) "K}NDBAR" plus Betrag.
- Remake main.ts:5600-5601: erfundener Text "SPONSOREN ANSEHEN" ohne Betrag.

### F15 (A) Werbung: Sponsorenansicht beginnt bei Sponsor 0
- Original 0x29765-0x2979E: Startsponsor = Sponsor des (letzten) Vertrags (4238:4B9B[2·(6m+Platz)] bzw. 4238:0001[2m]).
- Remake main.ts:5591-5594: immer 0.

### F16 (A) Werbung: Pfeilrichtung und Umlauf
- Original 0x2993A-0x29955: oberer Pfeil (y < 0x53) zählt hoch bis 9 (`cmpb $0x9…; jge; incb`), unterer herunter bis 0 (`cmpb $0x0…; jle; decb`), kein Umlauf.
- Remake main.ts:5616-5617: oben −1, unten +1, modulo 10.

### F17 (A, Bedienung) Werbung: Angebote bei laufendem Vertrag nicht durchblätterbar
- Original 0x29737-0x2975B prüft nur Seite gewählt (-0x4 ≠ 100) und Ansicht zu; OK meldet dann "unter Vertrag".
- Remake main.ts:5595: im Zweig `cur.months > 0` keine Sponsorenansicht. Spielstand gleich.

### F18 (A, Bedienung) Werbung: Klickfläche der Werbeausgaben
- Original 0x29420-0x29450: x 217..308, y 186..196, links von x 263 senken (`cmpw $0x107,-0x24(%bp); jge`).
- Remake main.ts:5635-5636: 199..253 senken, 254..308 erhöhen → Klick bei x 254..262 erhöht statt senkt.

### F19 (A, Grafik) Managerverlauf: Trennstrich nach jeder 16. Zeile
- Original 0x2A2CF `testb $0xf,-0x2(%bp); je` lässt ihn aus; Remake `drawVerlauf` zieht ihn immer.

### F20 (D) Aussage "q nur 1 oder 2" falsch
- contracts.ts:32-33, :68-69, SPIELMECHANIK.md:2086. q = ((t/6+110)·8)/10 liegt bei etwa 88..140 (Schwelle ≈ 82..144 % der Gehaltsbasis). Code rechnet richtig.

### F21 (D) Zweigbuch docs/abgleich/251FF.md urteilt falsch
- Zeile "25F4D-25FE4 … mehr als vier Jahre / Verschlechterung → Absage | MAX_CONTRACT_YEARS | stimmt": 0x25F4D ist die "So dumm"-Vorprüfung (F5), im Remake nicht vorhanden.
- Zeile "26127-26160 'So dumm ist $ leider nicht', Zustand 2 | rejectOffer | stimmt": 0x26127 zeigt "ist nicht an Ihrem Angebot interessiert." (F12); "So dumm" steht bei 0x25F7E.

## Unklar
- 0x248E1: Preis·random und Angebot·100 (0x249A9) in 32 Bit; ab Angebot > 21.474.836 DM bzw. Preis > ~16,5 Mio. läuft das Original über, `aiAccepts` nicht. Offen, ob solche Beträge vorkommen.
- Kaderverkauf: `saleOffer` verlangt p.u8(33) === manager, das Original prüft den Besitzer im Kaderpfad nicht; vermutlich ohne Wirkung (Leihspieler bekommen kein Angebotsbit).
- value.ts:48 nimmt bei Spielernummern > 150 Alter 0; das Original liest ohne Grenze 4238:57DD+37·idx+26 (0x24F4D-0x24F59). Erreichbar vielleicht über poolValue (#99); es fehlt ein Stand mit Byte 15 > 150 in einem fremden Datensatz.
- 0x25651: nach "nicht verhandlungsbereit" wird das Dword *(4cb3:6DC0) geprüft (vermutlich Maus); bei 0 ginge der Dialog weiter.
- 0x24D4E: Einsatzwert -0x14 bei 0x24E4F auf 16 Bit gekürzt und signed begrenzt (wirkt erst > 32767), random mit n = 0 teilt durch 0 – praktisch unerreichbar.
- Gehaltsanzeige über Faktor 4cb3:2252/224E: als 1 angenommen, nicht geprüft.
- 0x299DC: Namensreste nach NUL und Byte 33 der Vereine 64..199 bleiben im Original stehen, das Remake schreibt 0 (newgame.ts:295-296). Offen, ob 0x08FD8 vorher löscht und ob das je gelesen wird.
- Ewige Bilanz: Tausenderpunkte hängen am mitgebrachten 4cb3:07B2 (E3 in anzeigen.md); Gesamtspalte 16-Bit-Addition (0x28071) – praktisch ohne Wirkung.
- Einstellungen: Trefferflächen der Schalter (Original AN x<X+26, AUS bis X+49, Höhe 18) leicht anders – nur Bedienung.
- Managerverlauf: Blättern (Original links weiter, rechts Ende; Remake im Kreis) – nur Bedienung.
