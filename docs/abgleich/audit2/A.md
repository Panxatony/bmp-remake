# Audit 2, Gruppe A: BMMAIN.EXE 0x00000 bis unter 0x08BC4

Stand 26.9.2026. Gelesen: all.s (mit Auflösung der Segmentvariablen über da.sh), Remake
(stadium.ts, postpone.ts, match.ts, incidents.ts, goals.ts, europa.ts, season.ts, calendar.ts,
display.ts, vereinsinfo.ts, finance.ts, server.ts, main.ts), Zweigbücher 20E1, kredit, anzeigen,
restroutinen, 05403, 05FE5, 18E46, 1C632, 2D144, saisonwechsel, ganzstand, 2A41E.
Die Zweigbücher decken 0x0000 (nur Bauzeit, Sperre, Buchung), 0x01A49, 0x020E1, 0x028C4,
0x0310A, 0x033BF, 0x038A2, 0x03BE8, 0x040B6, 0x043D3, 0x043FE, 0x0462E, 0x05403, 0x05FE5,
0x0657F und 0x0666D ab. Nicht abgedeckt waren vor allem der Stadionbildschirm 0x0602 samt
Rückfrage 0x0000, die Verlegungen 0x3563/0x36F1 im Detail, der Treiber 0x46DB, die Stärke
0x4568, die Schützenwahl 0x5D9A und die Segmente 06c7/076b (dort liegt random 0x8377).

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x00000 | Rückfrage Stadionausbau: Geldprüfung, Bauzeit random(20,80)/random(80,120), Kasten, Antwort, Sperre random(15,55) (0x0584), Buchung | stadium.ts:`buildDays`, `extendStadium`, `bauAblehnen`; main.ts:`drawStadiumPick`; server.ts `/api/stadium*` | Rechnung, Würfel, Schreibziele stimmen; **Befund A1, A2, A3** |
| 0x00602 | Stadionbildschirm: Zeilenwahl, Sperrprüfung 0x07E9, Höchstwerte (Kapazität, Kontostand), Regler/Stufenliste, Eintrittspreis | main.ts:`drawStadium`, `pickStadium`, `drawStadiumPick`; stadium.ts:`stadiumState`, `setTicketPrice` | Grenzen und Kosten stimmen; **Befund A1, A4, A5** |
| 0x016E3 | Stadionbild nach Kapazität (14.000/34.000/54.000) und Zustand, Aufsätze | main.ts:`drawStadium`, `drawStadiumAufsaetze` | stimmt (Grafik, #63) |
| 0x01A49 | Stadionübersicht, Kontostandzeile, Restzeit Tage/7+1 | main.ts:`drawStadium`, stadium.ts:`restWochen` | stimmt (anzeigen.md A5 behoben) |
| 0x020E1 | Tägliche Baurunde: Sperre je Art herunter, Resttage herunter, Fertigstellung, Meldung direkt oder über 0x239E | stadium.ts:`dailyConstruction` | stimmt (20E1.md) |
| 0x0239E | Meldungshelfer: freien Platz 0x30910, Meldung 0x30AA0, Ablauf 3 Tage (4238:1D34) | server.ts Meldungen | bewusst (ABWEICHUNGEN: Meldungen, Lebensdauer) |
| 0x0243F | Hinweiszeile unten (Namen, Lager "…, … DM/Woche.") | main.ts Hover-Zeile | nicht nötig (Anzeige, SPIELMECHANIK:766) |
| 0x0272D | Sponsor-Zuschuss nach Kauf: random(0,6)=0, (Preis/100)·random(20,65)/10000·10000 | finance.ts:`sponsorSubsidy`, `acceptSubsidy`; server.ts `/api/market/subsidy` | stimmt |
| 0x02895 | Kalenderindex des n-ten Tages mit Maskenbit | display.ts:`matchdayDate` | stimmt |
| 0x028C4 | Restprogramm (darin 0x0310A Nachholtag-Prüfung, 0x031FA Flaggenhintergrund) | vereinsinfo.ts:`restprogramm`, `restStartRueck` | stimmt (2A41E.md F1, Stichprobe Datum/Ergebnis-Zweig 0x2D11-0x2D8C) |
| 0x032F2 | Titelseite des Spieltags (Flagge, 50 Ticks) | main.ts `drawAnkuendigung` | nicht nötig (Grafik) |
| 0x03361, 0x03390, 0x03A95 | Titel "DFB-Pokal", "Europapokal", "Ligaspiel" | server/live.ts Ankündigung | stimmt (anzeigen.md A1/A2) |
| 0x033BF | Relegationsspiel | europa.ts, server/live.ts | stimmt (anzeigen.md) |
| 0x03563 | Winterverlegungen: n = random(0,k), Auswahl über die Nachholtabelle | postpone.ts:`postponementCount`, `verlegen` | stimmt (Ablauf Zweig für Zweig verglichen) |
| 0x036F1 | Nachholtermin suchen und eintragen | postpone.ts:`replayDay`, `addReplay` | **Befund A7** |
| 0x038A2 | Nachholspiele des Tages | postpone.ts:`replays`, matchday.ts:`playReplays` | stimmt (anzeigen.md) |
| 0x03AC5 | Ligaplätze mischen, 55 Tausche je Liga, random(lo,hi) zweimal | season.ts:`shuffleLeagues` | stimmt (Grenzen und Wurfzahl gleich; Listentausch im Original nach 0x3C24 statt davor, ohne Wirkung) |
| 0x03BE8 | Vereinsindex tauschen (1-basiert) | europa.ts:`titelTraegerTauschen` | stimmt (anzeigen.md) |
| 0x03C24 | Vereinstausch (Tabellen, Titel, Manager) | season.ts:`swapClubs` | stimmt (Saisonwechsel-Ganzstand, restroutinen R4; nur Stichprobe) |
| 0x04044 | Gegner der Vereinsrekorde beim Tausch umschreiben | season.ts | stimmt (saisonwechsel.md) |
| 0x040B6 | Kalenderblatt im Hauptmenü | main.ts:`drawMenuHeader` | stimmt (anzeigen.md) |
| 0x04290 | Datum aus Tagindex: (k>>1)·7 + (k ungerade ? 4 : 4cb3:224C = 0) + 210, Monate aus 4cb3:07B8 ohne Schaltjahr; k = 0 nimmt 07DC, k = 120 → 0 | calendar.ts:`seasonDay`, `dateOfSeasonDay` | stimmt |
| 0x043D3 | Zweite Chancenzahl | match.ts `pick` | stimmt (anzeigen.md) |
| 0x043FE | Chancenminuten (Doppelprüfung nur Liga, 100 Züge) | match.ts:`chanceMinutes` | stimmt (auch Grenzfall 100. Zug) |
| 0x04568 | Aktuelle Stärke: te + 10·min/(-1-te) ≥ 0, + fo + ko, Gewichte 4cb3:008E, + Byte 23 - 44 | match.ts:`strength`, records.ts:`strengthMatrix` | stimmt |
| 0x0462E | 0:2-Ergebnisbytes | matchday.ts, server/live.ts | stimmt (anzeigen.md) |
| 0x046DB | Spieltagstreiber: Zähler 0178/0179/5140/5710/5778 nullen, Vorbereitung 0x1C632 je Paar (Marke 30 überspringen, 0:2-Liste), Live 0x5403 (1-45, 46-90, 91-105, 106-120), 0x18E46, Übersichten, Tabellen | server/live.ts, originaltag.ts, matchday.ts | stimmt (Teile in 1C632/05403/18E46; Nachholtag sortiert nur Liga 0, die übrigen Ligen sortiert 0x971F bei 0x97CE - gleicher Endstand wie `playReplays`) |
| 0x04CD7 | Positionsabstand \|Kaderbyte 25 - Spielerbyte 32\| | goals.ts:`positionFit`, strength.ts | stimmt |
| 0x04D22 | Fußangabe " (L)", " (R)", " (L+R)" | main.ts:2800/4721 | stimmt |
| 0x04DD3 | Linienabstand \|Byte 31 - ((7-Reihe)·75/7 + 5)\| | goals.ts:`lineDist`, strength.ts | stimmt |
| 0x04E45 | Spielerwahl für Karten/Verletzung | incidents.ts:`pickStarter` | stimmt (Obergrenze 200 Züge, im Zweigbuch 05FE5 vermerkt) |
| 0x04EEF | Uhr/Balken der Konferenz | Web | nicht nötig (Grafik) |
| 0x050E7 | Ordinalendung je Sprache (DM-Faktor 1: ".") | - | stimmt (nur Deutsch) |
| 0x05186 | Minutenanzeige, Elfmeter-Schriftzug | playerinfo.ts, Web | stimmt (AUDIT) |
| 0x05403 | Live-Schleife je Halbzeit | sim/live.ts, server/live.ts | stimmt/bewusst (05403.md; Stichprobe Ende 0x5BAE-0x5D96: 0x462E(2), Buchung 0x2D143 und 0x160A2 bei 90) |
| 0x05D9A | Schützen-/Vorlagenwahl: Gewicht, random(0,3500), Torwart random(0,20) | goals.ts:`pickPlayer` | stimmt (Zweig für Zweig) |
| 0x05FE5 | Karten und Verletzungen je Minute | incidents.ts:`minuteIncidents` | stimmt (05FE5.md) |
| 0x0632C | Szenenfeld der Konferenz räumen | Web | nicht nötig (Grafik) |
| 0x063B1 | Managerverein beteiligt (1-basiert, Bit 7 für Gast) | europa.ts `shootout(…, managerInvolved)` | stimmt |
| 0x06414 | Klick auf die Tafeln der Konferenz | Unterbrechung (#16) | stimmt (05403.md G) |
| 0x0657F | Neuauslosung der Chancen | sim/live.ts:`neuAuslosen` | bewusst (ABWEICHUNGEN, #87) |
| 0x0666D | Elfmeterschießen (kurzer/langer Zweig) | europa.ts:`shootout` | stimmt; Ergebnisspeicher bewusst (ABWEICHUNGEN, 18E46 V2) |
| 0x06C72, 0x06D17, 0x071D3, 0x07371, 0x073C3, 0x07445, 0x074AC, 0x074EC, 0x07620, 0x07669 (Seg. 06c7) | Hintergrund sichern/zurück, Bild laden, Text links/mittig, Rechteck, Linie | Canvas | nicht nötig (Grafik) |
| 0x076B6, 0x0770F, 0x07832, 0x078BF, 0x078FB, 0x0792D, 0x07953, 0x07994, 0x079C9, 0x07A06 | Maus, Dateien/Grafik laden | - | nicht nötig (Oberfläche/System) |
| 0x07D31 | Zahl in Text: Tausenderpunkt (4cb3:07B2 = 0; Komma bei 224E = 4), links '^' bis Breite 079C, 0 als '0', negativ ohne Auffüllung mit '-' | `toLocaleString("de-DE")`, `pad()` | stimmt (Auffüllen: anzeigen.md S2) |
| 0x07E87 | Texteingabefeld | Browser-Eingabe | nicht nötig |
| 0x0828B, 0x082FB, 0x08341, 0x083BA, 0x0847A, 0x08507, 0x087FC, 0x08AC6 | Palette, Schriftwahl, Warteschleife, Speicher freigeben, Hinweiskasten, Knöpfe, Bildschirm zeigen | Web | nicht nötig (Oberfläche) |
| 0x08377 | random(min,max) = min + rand() % (max-min+1), 16 Bit, idiv | match.ts:`originalRng` | stimmt (siehe Hinweis H1) |
| 0x083A0 | srand(time()) | server.ts `mulberryRng(Date.now())` | Hinweis H1 |
| 0x08406 | Zeichenprüfung der Texteingabe | - | nicht nötig |

## Befunde

### A1 (S) Laufender Ausbau sperrt im Remake die Ausbauart; der zweite Bau am selben Tag bekäme die alte Bauzeit

- Original: Nach dem Klick auf eine Zeile prüft 0x0602 nur die Sperre nach einer Ablehnung:
  `07e9 cmpb $0x0,%es:0x577f(%bx)` / `07ef je 0x814`, sonst "Im Moment keine Baufirma
  aufzutreiben." (4cb3:4CE0/4CE4). Die Resttage (Managerbyte 404 + 2k) liest 0x0602 nirgends
  (kein Zugriff auf -0xa0+0x38..0x44). 0x0000 rechnet den laufenden Bau ausdrücklich ein:
  `0120 mov %es:0x36(%bx,%si),%cx` (Resttage), `010b lcall random(20,80)`, Produkt / 100, und
  zeigt dann `041b mov -0x76(%bp),%ax / or -0x78(%bp),%ax / jne 0x433` → 4cb3:28A4
  "BAUZEIT: INSGESAMT CA." statt 28A0 "BAUZEIT: CIRKA". Ausbauen während eines laufenden
  Baus ist im Original also vorgesehen; die neue Bauzeit ersetzt die Resttage (`05f6 mov
  %ax,%es:0x36(%bx,%si)`), die Menge kommt zu "im Bau" dazu.
- Remake: main.ts:5953-5963 `pickStadium`: `if (e.days || abgelehnt)` → derselbe Hinweis
  "Im Moment keine Baufirma aufzutreiben." (Kommentar 5952 "läuft dort schon ein Ausbau, weist
  das Original ab" ist falsch). Der Kasten zeigt immer "BAUZEIT: CIRKA" (main.ts:5859). Dazu
  hält der Server die Bauzeit je Manager und Art bis zum Tageswechsel fest (server.ts:3389-3401
  `bauTage`): ein zweiter Bau derselben Art am selben Tag bekäme die Zahl des ersten Kastens,
  während das Original bei jedem Aufruf von 0x0000 neu würfelt (0x010B, 0x014A) und die
  Resttage des ersten Baus einrechnet.
- Wirkung: Spieler können einen laufenden Ausbau nicht erweitern (Plätze, weitere Stufe); das
  verändert Spielstand und Zufallsfolge.

### A2 (S) Rückfrage lässt sich im Remake ohne Antwort schließen - die Sperre random(15,55) entfällt

- Original 0x0000 ab 0x053E: `0553 lcall $0x3091,$0x11cc` (Treffer der beiden Knöpfe),
  `0563 cmpw $0x1,%es:0x2ea2 / jne 0x53e`, `056d … je 0x53e` - die Schleife endet nur mit
  einem Linksklick auf "NA KLAR !" oder "ACH NEE...". Antwort 2 → `0584 random(15,55)` in
  4238:577F + Art (Sperre für alle Manager, 20E1.md B1).
- Remake: main.ts:2682-2684 schließt den Kasten mit Rechtsklick (`this.stadiumAsk = false`),
  ebenso ein Klick auf eine andere Zeile (main.ts:5965) - ohne `api/stadium/decline`. Der
  Spieler sieht Kosten und Bauzeit und geht ohne Sperre heraus; im Original muss er ablehnen
  und sperrt die Art random(15,55) Tage lang für alle.

### A3 (A) Wochenzahl in der Rückfrage: Tage/7 + 1, nicht aufgerundet

- Original 0x0000: `047b mov $0x7,%ax / cwtd / push; push -0x2(%bp); push -0x4(%bp); lcall
  $0x3a01,$0x1a4c` (Bauzeit / 7), `048c add $0x1,%ax / adc $0x0,%dx`, dann " WOCHEN"
  (4cb3:28A8). So steht es auch in SPIELMECHANIK.md:831 ("Tage/7 + 1").
- Remake: stadium.ts:118-120 `buildWeeks = Math.ceil(days / 7)`, benutzt in main.ts:5862 (und im
  Protokoll server.ts:3411). Bei einer durch 7 teilbaren Tagzahl (z. B. 63 Tage) zeigt das
  Remake eine Woche weniger (9 statt 10). Die Messung in stadium.ts (Grundwert 10 → 9 und 10
  Wochen) passt zu beiden Formeln; beim Restzeitwert (A5 in anzeigen.md) war dieselbe
  Verwechslung schon einmal behoben worden.

### A4 (A) "MAX. STATUS:" auch bei Flutlicht und Anzeigetafel

- Original 0x0602: beide Stufenzweige (Größen 0x0FDE ff., Status 0x114E ff.) laufen nach
  `12bb`; dort `12c9 push %es:0x28ca / 12ce push %es:0x28c8` = "MAX. STATUS: " für alle
  Arten 4..7 (für 4/5 mit dem Größennamen aus 4cb3:2858).
- Remake: main.ts:5805 `k.kind <= 5 ? T("ui.stadium", 3)` = "MAX. GR|~E: " für Flutlicht und
  Anzeigetafel. SPIELMECHANIK.md:820 beschreibt es richtig.

### A5 (A) Drei Absagen des Stadionbildschirms fehlen

- Original 0x0602, jeweils Hinweiskasten 0x8507 und zurück zur Übersicht:
  - Arten 1..3: Kontostand/Preis·1000 = 0 (negativ auf 0 gesetzt, 0x0A6E-0x0A84) →
    "Kein Geld f}r / neue Pl{tze da..." (4cb3:4CE8/4CEC, 0x0A86).
  - Arten 4..7: jetzige Stufe = Höchststufe (`0f03 cmp %si,%di / jne 0xf22`) → "Was denn...? /
    NOCH besser ???" (4cb3:4CF0/4CF4).
  - Arten 4..7: Kontostand/Preis ≤ 0 (`0f5d or %dx,%dx / jg 0xf82 …`) → "Da m}ssen Sie erst /
    noch sparen..." (4cb3:4CF8/4CFC).
- Remake: `pickStadium` (main.ts:5953) kennt nur Bau/Sperre; der Kasten öffnet dann mit Regler 0
  bzw. einer ganz gedämpften Stufenliste, ohne Hinweis. Die Texte stehen im Katalog
  (`stadion.absagen` 4..7), benutzt wird davon nur 6/7 als Serverfehler.

### A6 (D) Doku zur Bauzeit in der Rückfrage veraltet

- docs/ABWEICHUNGEN.md:26 ("der Server würfelt beim Bau, der Kasten nennt den Mittelwert") und
  docs/SPIELMECHANIK.md:832-833 ("im Remake würfelt sie der Server, der Kasten nennt deshalb den
  Mittelwert") stimmen nicht mehr: seit #55 würfelt der Server beim Öffnen des Kastens
  (server.ts:3389 `/api/stadium/bauzeit`), der Kasten nennt diese Zahl, der Bau übernimmt sie
  (server.ts:3409). Der Eintrag ist damit keine Abweichung mehr (außer A1/A2). Ebenso veraltet
  der Kommentar main.ts:5872 ("bekommt heute keine Baufirma mehr" - es sind random(15,55) Tage
  für alle Manager).

### A7 (S, Randfall) Nachholtermin darf im Remake auf die Tage 93/94 fallen

- Original 0x36F1: `388f incb -0x6(%bp)` / `3892 cmpb $0x5a,-0x6(%bp)` / `3896 jae 0x389b`
  (Rückgabe 0) - gesucht wird nur bis Kalendertag 89.
- Remake: postpone.ts:41 `for (let d = dayIndex + 1; d < calendar.length; d++)` mit
  `CALENDAR_DAYS = 95` (calendar.ts:12). Die Kalenderbytes der Tage 93 und 94 sind 0
  (4cb3:2280), also frei. Findet sich an den freien Tagen 59..89 kein Termin (alle neun Plätze
  voll oder einer der Vereine spielt dort schon nach), legt das Remake das Spiel auf Saisontag
  326/329 - nach dem letzten Saisontag 322, den der Tageslauf nie überschreitet
  (calendar.ts:23-27). Das Spiel bliebe mit Marke 30 ungespielt. Im Original liefert 0x36F1
  dann 0, und 0x3563 zieht auf dem nächsten freien Platz ein anderes Spiel (`367d je 0x369f`).
  Selten, aber sicher verschieden.

## Unklar / Hinweise

- **H1 Zufallsgenerator im Server:** 0x8377 und `originalRng` stimmen überein (Spanne 16 Bit,
  `idiv` mit Vorzeichen, rand() von Microsoft C). Im Serverbetrieb würfelt aber `mulberryRng`
  (server.ts:1413, 2659): Gleichverteilung über die volle Spanne. Unterschiede zur Verteilung
  des Originals gibt es nur bei Spannen über 32767 (das Original erreicht dort nie Werte über
  min+32767 bzw. rechnet mit negativer Spanne) - in meinem Bereich kommt keine vor; im
  Programm z. B. 0x32C9B (0x8FFF, Speichern). Ob das als bewusste Abweichung gelten soll, steht
  nirgends; zu klären mit der Gruppe, die 0x32AAE prüft.
- **Menge 0 im Regler (Arten 1..3):** 0x0602 ruft 0x0000 auch mit dem Reglerwert 0 auf
  (`0c9e cmp $0xffff,%ax` prüft nur den Abbruch). Bestätigt man dann, werden die Resttage einer
  laufenden Art mit der neuen Würfelzeit überschrieben, ohne dass Plätze dazukommen. Das Remake
  lässt Menge 0 nicht zu. Ob der Regler 0x314B5 die 0 überhaupt zurückgibt, habe ich nicht
  gelesen (liegt außerhalb meines Bereichs).
- **Managerbyte 348 (Eintrittspreis-Kopie):** 0x0602 schreibt beim Ändern nur Byte 266
  (`0eb0 mov %cl,%es:0x234c(%bx)`); einen Schreibzugriff auf 348 finde ich im Programm nicht
  (weder 4238:239E noch -2 vom Stadionzeiger). `setTicketPrice` schreibt beide; SPIELMECHANIK
  nennt 348 eine "Kopie, die erst beim Ändern entsteht" (gemessen). Woher das Original sie
  schreibt, bleibt offen.
- **Kommentar in season.ts:241** ("Vor jedem Tausch tauscht das Original die beiden Einträge"):
  0x3AC5 ruft 0x3C24 zuerst (0x3BA9) und tauscht die Reihenfolgeliste danach (0x3AD9-0x3B10).
  Ohne Wirkung, weil 0x3C24 die Liste nicht anfasst.
