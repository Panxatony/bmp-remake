# Audit 2, Gruppe D: 0x15F14 bis unter 0x1CF86

Stand 26.9.2026. Gelesen: Disassembly (all.s, mit Segmentauflösung), Remake
(`packages/core/src/sim`, `packages/server`, `packages/web/src/main.ts`), Zweigbücher 176F4, 17B0F,
18E46, 18FC2, 192FC, 1B223, 1C632, 0CB62, 11D0D, neuesspiel, restroutinen, transfer, anzeigen.
Nichts im Repo geändert.

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x15F14 | KI-Verein: Einsätze (94 %), Kandidaten, Torschützen je Tor | ai.ts:creditAiGoals | **Befund D1** |
| 0x160A2 | KI-Torschützen eines Ligaspieltags (Heim, dann Gast) | matchday.ts:playMatchday | stimmt |
| 0x1618E | Wert ± random(1,7)-4, 30..99 | pool.ts:poolTargets | stimmt |
| 0x161D8 | Sollzahlen je Liga, Drift, random(5,15) Wechsel, Auslandsrückkehr | pool.ts:poolTargets | stimmt (Platz 24 zählt 0x31A19 nicht, im Remake nie belegt) |
| 0x1643B | Spielbeginn: Verteilung der Spieler ohne Verein | pool.ts:distributePlayers | stimmt (0xF58B würfelt nicht, Ergebnis ungenutzt) |
| 0x16515 | Torschützenliste LIGA/SPIELER; Modus 1: Torschützenkönig | display.ts:leagueScorers/playerScorers, seasonEvents.ts:hasTopScorer, main.ts:drawBestenliste | **Befunde D2, D3, D4, D5** |
| 0x16E1A | KI-Verein nach Kauf stärken | transfer.ts:strengthenClub | bewusst (Näherung, Zweigbuch transfer); Wächter `club > 199` wirkungslos |
| 0x16EFF | Verein für Angebot/Wechsel (Stärke passt zu Wert) | transfer.ts:chooseOfferClub | stimmt |
| 0x16FC8 | Zufriedenheitswert Alter·w/100 | contracts.ts:contractScore | stimmt |
| 0x1704A | Titelbild einer Saisonendphase | - | nicht nötig (Grafik) |
| 0x17076 | Monatseinnahmen (Grundwert, Werbung, Zinsen anderer, Guthabenzins) | finance.ts:monthlyIncome + dailyFinance, display.ts:statistics | stimmt |
| 0x17262 | Monatsausgaben | finance.ts:monthlyExpenses | stimmt (Markt über 0..n-1 der Plätze 0..11 - Markt ist immer lückenlos) |
| 0x17555 | BENÖTIGT (Zuschauerschnitt) | display.ts:statistics | stimmt |
| 0x175FA | Stadionwert | werbung.ts:stadiumValue | stimmt |
| 0x176F4 | Sponsorenangebote | werbung.ts:generateOffers | stimmt (Stichprobe aller Würfe und Formeln) |
| 0x17B0F | Verletzung würfeln | training.ts:injurePlayer | stimmt |
| 0x17C26 (in 0x17B0F) | Auslosungszeremonie: Abfrage, Grafik, 4238:57C8 | server.ts:ceremony | **Befund D8**, sonst Bedienung |
| 0x17F98 | Ziehung eines Namens (Animation) | main.ts (Zeremonie) | nicht nötig (Grafik, keine Würfel) |
| 0x184BA | "TASTE DRÜCKEN", danach Pokalliste | main.ts | nicht nötig (Grafik) |
| 0x18600 | Auslosung erste Runde | europa.ts:initialDraw | stimmt |
| 0x18B12 | Deutsche Europapokalteilnehmer | europa.ts:europeanParticipants | stimmt (07AC/07B0 = 0 prüft das Original nicht; tritt nie ein) |
| 0x18DA7 | Heimrecht für Unterklassige (DFB, Runde < 4) | europa.ts:lowerClassHome | stimmt; Aufrufzeitpunkt siehe **D7** |
| 0x18E07 | Steht Verein in der Teilnehmerliste? | europa.ts (inList) | stimmt |
| 0x18E46 | Verlängerung/Elfmeter anstoßen, Merker 1D14 | originaltag.ts, server/live.ts | **Befund D6** |
| 0x18FC2 | Auslosung Folgerunde | europa.ts:nextRoundDraw | Würfel stimmen; **Befund D7** |
| 0x19208 | Entscheid Hin-/Rückspiel | europa.ts:decideTie/tieBreak | stimmt |
| 0x192FC | Rundenabschluss Pokal | europa.ts:afterCupDay | stimmt |
| 0x1978D | Pokalergebnisse löschen | europa.ts:clearCupResults | stimmt |
| 0x197D5 | Ligaklasse 1/2/4 (Grenzen 18/38) | europa.ts:clubClass, ai.ts:bandOf | stimmt |
| 0x19810 | "Liga GEGEN Liga:" | main.ts:drawCupList | stimmt (Anzeige) |
| 0x198EB | Pokalübersicht | main.ts:drawCupList, display.ts:cupView | **Befunde D11, D12**, D5 (Klick) |
| 0x1A36D | "Deutsche Meisterschaft / gewinnt ..." | messages.ts | bewusst (Meldung an alle, ABWEICHUNGEN) |
| 0x1A58B (in 0x1A36D) | "ENDE" | - | bewusst (ABWEICHUNGEN) |
| 0x1A61D | Spielstand-Ziffern der Konferenztafel | main.ts:drawLivePanel | **Befund D13** |
| 0x1A7CE | Zahlen der Tafel (Gelb, Rot, Verletzt, Spieler, Chancen) | main.ts:drawLivePanel | **Befund D14** |
| 0x1A8D0 | Vereinsname auf der Tafel | main.ts:drawLivePanel | stimmt (R11) |
| 0x1A9AF | Konferenzaufbau (Tafeln, Wappen, Zuschauer) | main.ts:drawLive/drawLivePanel | Anzeige, unklar U1 |
| 0x1B223 | Chance, Tor, Karte, Verletzung | goals.ts, incidents.ts, server/live.ts | **Befunde D9, D10**, Rest stimmt (Zweigbuch) |
| 0x1C4F5 | Kaderbildschirm nach Verletzung im Spiel | server/live.ts (Pause) | stimmt (Bedienung) |
| 0x1C5D1 | 0:2-Strafe 200.000 DM mit Meldung | incidents.ts:bookForfeit | stimmt |
| 0x1C632 | Spielvorbereitung (Kulisse, Einnahmen, Kaderteil, Karten-Budget) | matchday.ts, attendance.ts, incidents.ts | stimmt (Stichprobe Abschnitte M, N; V8 bekannt offen) |

39 Routinen der Rohdatenliste, dazu die eingebetteten 0x17C26 und 0x1A58B.

## Befunde

### D1 (S) KI-Torschützen: Gewicht bei mehr als neun Kandidaten um eins zu klein

Original 0x1608B-0x1600E:
```
1608b  cmpb $0x9,-0x2(%bp)      ; Kandidaten > 9 ?
1608f  ja   16094
16091  jmp  15ff8               ; sonst w = 4cb3:5331[n] - 1  (0x15FFD/0x16001 dec)
16094  movb $0xa,-0x9e(%bp)     ; w = 10, OHNE -1
16099  jmp  16007
16007  cmpb $0x2,-0x9e(%bp) / jbe / decb   ; w > 2 → w - 1
```
Bei n ≥ 10 Kandidaten also w = 10 → 9. Die Tabelle 4cb3:5331 ist [0,2,3,4,5,6,7,8,9,10].
Remake `packages/core/src/sim/ai.ts:41`:
`let w = (SCORER_WEIGHT[Math.min(n, 9)] ?? 10) - 1; if (w > 2) w--;` ergibt bei n ≥ 10
10 - 1 - 1 = **8**. Damit ist `rng(0, w)` bei 0x16024 ein anderer Wurf (0..8 statt 0..9): die
Trefferquote je Versuch sinkt, es wird öfter nachgewürfelt, die Würfelfolge verschiebt sich, und
die Torschützen der KI-Vereine (Spielerbyte 34) weichen ab. Für n = 2..9 stimmt es. Bei 94 %
Einsatz und der Schwelle random(5,25) + Byte 31 > random(10,99) haben Vereine mit ~20 Spielern
oft zehn und mehr Kandidaten. Richtig: `n > 9 ? 10 : SCORER_WEIGHT[n] - 1`, dann `if (w > 2) w--`.

### D2 (S) Torschützenliste schreibt die Kadertore in die Spielertabelle - das Remake nicht

Original 0x16543-0x165A5, bei **jedem** Aufruf (Menü 0xA6ED mit Argument 0 und Saisonende 0x1E1AA):
```
16562  mov %es:0x774d(%bx),%al      ; Kaderplatz Byte 3 (Ligatore)
1656f  mulb %es:0x7759(%bx)         ; Spieler = Byte 15
1657a  mov %cl,%es:0x57ff(%bx)      ; Spielerbyte 34 := Kaderbyte 3
```
für alle Manager und Plätze 0..Kaderzahl-1. Remake `packages/core/src/sim/display.ts:140`
(`saisonTore`) liest die Kadertore nur für die Anzeige ("Hier ohne Schreiben - der Saisonwechsel
löscht Byte 34 ohnehin"). Die Begründung trägt nicht: Wer im Lauf der Saison von einem KI-Verein
kam, hat im Kader Byte 3 = 0 (0x224A8), in der Spielertabelle aber seine alten Tore. Hat ein
Manager die Liste einmal angesehen, steht im Original danach die kleinere Zahl in Byte 34 - auch
wenn der Spieler später zu einem KI-Verein geht. Im Remake bleibt die große Zahl. Folgen:
anderer Spielstand (Save-Offset 15813 + 37·i + 34), andere Torschützenliste und im Grenzfall ein
anderer Torschützenkönig (0x0CB62, 250.000 DM) am Saisonende. Die Schreibstelle hängt an einer
Bedienhandlung (Menü "Bestenliste"); im Remake wäre sie beim Öffnen des Bildschirms auf dem
Server nachzubilden.

### D3 (A) Bestenliste SPIELER: bis zu 20 Managerspieler aus der ganzen Liste, nicht aus den ersten 20

Original 0x16A5A-0x16A7A und 0x16C47: der Zeilenzähler -0x12C (höchstens 20) zählt nur
**gezeichnete** Zeilen; in SPIELER (-0x2 ≠ 0) werden Nicht-Managervereine übersprungen
(`cmpb $0x0,-0x130(%bp)` → 0x16CB0), bevor gezählt wird. Die Platzziffer -0x90 läuft für alle
Einträge der Liga mit. Es erscheinen also bis zu 20 Spieler der Managervereine mit ≥ 2 Toren,
gleich auf welchem Ligaplatz. Remake `packages/core/src/sim/display.ts:188`:
`leagueScorers(g, league).filter(...)` - `leagueScorers` bricht nach 20 Ligaplätzen ab, danach wird
gefiltert: ein Managerspieler auf Ligaplatz 21 oder tiefer fehlt.

### D4 (A) Bestenliste LIGA: Lücke mit Punktlinie hinter dem Eintrag mit Sortierplatz 12

Original 0x16C50-0x16CAE (nur Modus 0, Ansicht LIGA):
```
16c50  cmpb $0x0,-0x2(%bp)   ; LIGA
16c56  cmp  $0xc,%si         ; si = Index in der GESAMT-Sortierung 1..150
16c5b  addw $0xe,-0x132(%bp) ; y += 14
16c77  lcall 3930:04fd (Farbe 1); 16c9b lcall 3930:03ce (Punkt bei x=45, y-18..y-8, Schritt 2)
```
Steht der zwölfte Spieler der Gesamtsortierung in der gezeigten Liga, folgt hinter ihm eine
14 Punkte hohe Lücke mit senkrechter Punktlinie; alle weiteren Zeilen rücken nach unten. Remake
`packages/web/src/main.ts:6976` (`drawBestenliste`) zeichnet gleichmäßig `y = 30 + 7·i`.

### D5 (A, Bedienung) Klicks in Bestenliste und Pokalübersicht fehlen

- 0x16968-0x16D6F: Klick auf eine Zeile der Bestenliste (y > 29, Zeile (y-30)/7 < 20) sucht den
  Spieler (-0x22[Zeile]) in den Kadern der Manager und ruft die Spielerinfo 0x15346 mit Manager
  am Zug = Besitzer.
- 0x1A298-0x1A302: Klick auf eine Paarung der Pokalübersicht öffnet die Vereinsinfo 0x2A41E
  (x ≤ 130 Heim, sonst Gast).
Remake `main.ts:6976` und `main.ts:7038` setzen keine `hit()`-Flächen für Zeilen.

### D6 (S) Verlängerung im DFB-Pokal: Karten/Verletzungen nur für den Heimmanager

Original 0x18F76-0x18F95:
```
18f6a  mov %es:0x76cb(%bx),%al ; push  (Gast = zweites Argument)
18f70  mov %es:0x76ca(%bx),%al ; push  (Heim = erstes Argument)
18f76  lcall 0x310:0x32b1      ; 0x63B1: Manager+1 für Heim, 0x81+Manager für Gast
18f87  mov %al,%bl
18f8f  movb $0x1,%es:0x1d13(%bx)
```
Für einen Gastmanager ist AL = 0x81..0x84: der Merker landet in 4238:1D94..1D97, nicht in
1D14..1D17. 0x62C8 (`cmp %ah,%es:0x1d14(%si)`) würfelt in der Verlängerung also nur für einen
Manager, dessen Verein **Heim** ist - und 0x63B1 bricht beim ersten Treffer in Managerreihenfolge
ab: spielen Manager 0 (Gast) und Manager 1 (Heim) gegeneinander, bekommt keiner den Merker.
Remake: `packages/core/src/sim/originaltag.ts:366`
(`vorfaelleInVerlaengerung = new Set(verlaengert.filter((s) => s.cup === 0))`, dann beide
`s.seiten`) und `packages/server/live.ts:443` (`vorfaelle = ... e.cup === 0` für beide Seiten)
würfeln für Heim- und Gastmanager. Das Zweigbuch 18E46 (V1: "1D14 dieses Managers wieder 1")
hat den Gastfall übersehen. Folge: zusätzliche Würfe (Rot, Gelb, Verletzung) und Vorfälle für
Gastmanager in der DFB-Verlängerung. Nebenwirkung im Original: 4238:1D94..1D97 liegt im
Highscore-Speicher (20 × 58 Bytes ab 4238:1D52, 0x34616), Eintrag 2 Bytes 8..11 werden 1 -
ob das sichtbar wird, ist nicht geprüft.

### D7 (S) DFB-Halbfinale: mit Zeremonie Heimrecht für Unterklassige

Original 0x18FC2: 0x19039 fragt (0x17C26) **vor** der Auslosung, 0x19047 erhöht die Runde.
Mit Zeremonie (4238:57C8 ≠ 0):
```
19111  decb %es:0x8(%bx)       ; Runde wieder r
19185  cmpb $0x0,0x6(%bp) → 191a7 call 0x18da7 für alle Plätze  ; prüft 4238:0008 < 4 mit r
191c2  incb %es:0x8(%bx)       ; r+1
191d0  ... 191f2 call 0x18da7  ; noch einmal mit r+1
```
Ohne Zeremonie nur der zweite Durchlauf. Bei r = 3 (vier Sieger, Auslosung des Halbfinales)
tauscht der erste Durchlauf einen Oberligisten auf einem Gastplatz nach vorn (3 < 4), der zweite
nicht (4). Wer die Auslosung ansieht ("ABER KLAR"), gibt dem Unterklassigen im Halbfinale
Heimrecht; ohne Zeremonie nicht. Remake `packages/core/src/sim/europa.ts:197`
(`nextRoundDraw`, nur mit der neuen Runde) und `server.ts:1969` (die Abfrage kommt erst nach der
Auslosung) kennt nur den Fall ohne Zeremonie. Das Zweigbuch 18FC2 wertet den Zeremoniezweig als
"Anzeige - keine Würfel": Würfel stimmt, aber 0x18DA7 schreibt die Paarungen.

### D8 (A) Auslosung des DFB-Finales ohne Abfrage

0x17C77-0x17C83: `cmpb $0x0,0x6(%bp)` (DFB) und `cmpb $0x4,-0x12(%bp)` (Paare der laufenden
Runde aus 4cb3:07D6 < 4) → 0x17F89 `movb $0x1,%es:0x57c8`: vor der Auslosung des Finales fragt
das Original nicht, die Zeremonie ist an (sofern Option 4cb3:0608 an). Remake
`server.ts` (`zeremonieAnsetzen`, Phase `vote`) fragt bei jedem Wettbewerb.

### D9 (S) Gelb-Rot: der Wurf random(1,1) für die Sperre fehlt

Original 0x1C0A7-0x1C0C1, gemeinsamer Weg für Rot und Gelb-Rot (0x1B223 Modus 2, Merker +0x18
= 1 bei Gelb-Rot, gesetzt von 0x61C0/0x620E: `3 - zweiteGelbe`):
```
1c0a7  mov $0x6,%al ; mulb 0x18(%bp) ; sub $0x7,%ax ; neg %ax   ; 7 - 6·GelbRot
1c0b1  push %ax ; mov $0x1,%ax ; push %ax
1c0b6  lcall 0x76b:0xcc7      ; random(1, 1) bei Gelb-Rot - rand() läuft trotzdem (0x8389)
1c0c1  mov %al,%es:0xd(%bx)
```
Remake `packages/core/src/sim/incidents.ts:164`: `l.setU8(13, 1)` ohne `rng`. Nach jedem
Gelb-Rot eines Managerspielers ist die Würfelfolge um einen Wurf verschoben (alle folgenden
Chancen, Karten, Ergebnisse des Tages). Das Zweigbuch 1B223 (K) hat "stimmt".
Richtig: `l.setU8(13, rng(1, 1))`.

### D10 (A) Spielbewertung (Kaderbyte 21) läuft im Original über, das Remake kappt

Original: alle Änderungen sind Byte-Additionen ohne Grenze - 0x1BB53 `addb $0xf`, 0x1BB79
`subb $0xa`, 0x1BD03 `addb $0xa`, 0x1BE0C `subb $0x5`, 0x1BE2F `addb $0x8`, 0x1BE3A `subb $0x3`,
0x1BE98 `subb $0x8`, 0x1C0C5/0x1C1AC `subb $0xa`. Remake `packages/core/src/sim/goals.ts:58`
(`addRating`: `Math.max(-128, Math.min(127, v + delta))`); die Kartenstellen in incidents.ts
rechnen dagegen mit `& 0xff` wie das Original. Ein Torwart mit 16 gehaltenen Chancen (+8)
steht im Original bei -128, im Remake bei 127; ein Stürmer mit 13 vergebenen Chancen (-10)
im Original bei +126. Gelesen wird Byte 21 nur von Zeitung/Anzeige (0x2F657, 0x307CD) - daher A.

### D11 (A) Pokalübersicht Europapokal: alle deutschen Vereine hervorgehoben

0x19DD9 (Heim) und 0x19EF1 (Gast): im Europapokal `cmpb $0x40,...; jae` → Farbe 0x0B für jeden
Verein < 64; nur im DFB-Pokal (0x19DAC/0x19EB9) die Vereine der Manager. Remake
`packages/web/src/main.ts:7093` (`mine.has(club)`) färbt in allen Wettbewerben nur Managervereine.

### D12 (A) Pokalübersicht: "n.V." / "n.E." hinter dem Ergebnis fehlt

0x19F3E-0x1A031: Heimwert > 9 → -10 und Marke 1, nochmals > 9 → -10 und Marke 2; hinter
"(h:a)" hängt das Original bei Marke 2 den Text 4cb3:26B4 = "n.E.", bei Marke 1 4cb3:26B8 =
"n.V." an. Der Gastwert wird unverändert gezeigt. Remake `display.ts:228` (`% 10`) und
`main.ts:7098` zeigen nur "(h:a)" ohne Zusatz. (Das Remake legt nach dem Elfmeterschießen andere
Werte in den Speicher - ABWEICHUNGEN, V2 -, der Zusatz bleibt davon unberührt.)

### D13 (A) Konferenztafel: ab zehn Toren nur die Einerstelle

0x1A69F-0x1A6AC bzw. 0x1A76F-0x1A77C: `subb $0xa` solange > 9, dann **eine** Ziffer
(14 Punkte breit, 0x3930:0x991). Remake `packages/web/src/main.ts:1632` (`score`) zeichnet ab 10
zwei Ziffern. Selten, aber das Original zeigt z. B. bei 11 Toren "1".

### D14 (A) Konferenztafel Manager gegen Manager: Zahlen des Gastmanagers

0x1B075-0x1B0C9: 0x1A7CE wird für den Heimmanager (Merker 0) und danach für den Gastmanager
(Merker 1, Chancen aus 4238:5145+6m statt 5144) auf dieselbe Stelle gezeichnet - sichtbar bleiben
die Zahlen des Gastes. Remake `packages/web/src/main.ts:1661` zeigt dem Betrachter seine eigene
Seite. Für den Mehrspielerbetrieb vermutlich gewollt, in ABWEICHUNGEN aber nicht vermerkt.

### D15 (D) Dokumentation

- `docs/SPIELMECHANIK.md:1111`: "LIGA zeigt ... Spieler ... mit mindestens 0,4 Toren je Spiel" -
  0x16515 kennt keine solche Grenze; gefiltert wird nur Liga (4cb3:2272/2273 nach Byte 312) und
  ≥ 2 Tore (0x16845). Der erste Kommentarblock in `display.ts:117-125` ("dann Toren je Spiel
  absteigend") widerspricht dem zweiten (Einsätze aufsteigend) und dem Original (0x165F4-0x1660D).
- `docs/MEMORY-MAP.md`: 27960 (4238:2EBA) heißt "Spieltag", 27964 (4238:2E8E) "Zähler" - es sind
  Tag im Monat und Monat (0x17221 teilt die Kontosumme durch 2EBA; records.ts: `day`,
  `monthIndex`). 27972 (4cb3:07DC) "Tag im Jahr" ist der Saisontag (0x19275 vergleicht mit 315).
- `docs/abgleich/18E46.md` V1, `18FC2.md` (Zeremonie "keine Würfel" - aber Schreibzugriff) und
  `1B223.md` K ("stimmt") - siehe D6, D7, D9.

## Unklar

- **U1** 0x1A9AF, Zuschauerfeld der Tafel: ist nur der Gast ein Manager, holt das Original die
  Zahl aus **dessen** Spielbericht (0x1AF41: 0x63B1(Gast, 0xFE), 4238:90C6 + 154·(m+1)),
  zieht über 200.000 noch 200.000 ab und färbt rot, wenn sie der Kapazität (350 + 358) **dieses
  Gastmanagers** gleicht; bei 0 "(AUSW.)". Remake `main.ts` nimmt die Kapazität nur vom
  Heimmanager. Was im Spielbericht des Gastmanagers an +150 steht (und wofür die 200.000-Marke
  steht), müsste an 0x1C632 Q geklärt werden, bevor man es einen Befund nennt.
- 0x16515: `leagueScorers` überspringt zusätzlich Spieler mit Besitzer 5 und leerem Namen - das
  Original nicht. Ob es solche Spieler mit ≥ 2 Toren je gibt, ist nicht geprüft.
