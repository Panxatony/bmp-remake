# Audit 2, Gruppe C: Routinen 0x0F4D7 bis unter 0x15F14

Stand 26.9.2026. Grundlage: all.s (Disassembly), Remake-Stand in dem Repo,
Zweigbücher 0F9D2, 10067, 10BB0, 11D0D, kredit, 05403, 1B223, anzeigen, restroutinen.
Werte aus dem Abbild wurden in tools/out/bmmain.bin nachgelesen (DGROUP = 0x4CB30 + X),
Spielstände unter ../bmp/entschluesselt/*.dec (16 Stände).

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x0F4D7 | Zielverein einer Liga für den Spielerpool: r = random(0,3), bei random(0,1)≠0 random(0,6), bei random(0,5)=0 random(0,12), Basis 4cb3:226E[l], kein Managerverein (0x063B1); ab Liga 3 random(4cb3:2278 = 58, 255) ohne Managerprüfung | pool.ts:`pickPoolClub` | stimmt (Würfelfolge, Tabellen 226E/2272 nachgelesen) |
| 0x0F58B | Stärkeliste der Vereine einer Liga (Summe 24/27/30 über drei Linien / 9, absteigend sortiert) | - | bewusst (ABWEICHUNGEN: "rechnet das Original aus, benutzt sie aber nicht") |
| 0x0F6D8 | Sperre/Verletzung eines Kaderplatzes: Bit 1 und Byte 13 > 0: an Tagen mit (Tageszähler − 4cb3:224C) mod 7 = 0 Byte 13 − 1; Bit 0/1 und Byte 13 = 0: Bits löschen, Aufstellung 0x22030 | training.ts:`injuryCountdown`, `sommertagSperren`; transfer.ts (Markt) | stimmt (Zweigbuch 17B0F) |
| 0x0F749..0x0F9D0 | Credits (Abspann) | - | bewusst (ABWEICHUNGEN "Credits nicht nachgebaut"); schreibt keinen Spielstand |
| 0x0F9D2 (im Block 0x0F749) | Mannschaftsstärke | strength.ts:`teamStrength`, `finish` | stimmt (Zweigbuch 0F9D2, K1-K7 behoben; Abschnitte H-M nachgelesen: Würfel random(10k+5,20k+5), (10,40), (5(k+2),30k+20); Klemmen nur -0x18/-0x16/-0x1E; Korrektur nur bei Mittelfeld < 1; random(7,10) > Abwehr+10 → Mittelfeld −random(3,5); Moral/9 auf −4..4, dann ≥0, + Einsatz, 0..40, nicht bei 100) |
| 0x10067 | Schwankung der Vereinsmatrix | ai.ts:`driftClubs`, `bandOf` | stimmt (Zweigbuch 10067; Band über 0x197D5 >> 1, Grenzen 4cb3:05CE = 70/93, 40/74, 15/45 nachgelesen) |
| 0x102B9 | Chancenzahl einer Paarung je Halbzeit, Minuten (Schalter 1) bzw. 4238:6DBC (Schalter 0) | match.ts:`chanceCounts`, `chanceMinutes`; live.ts | stimmt für die Liga; **Befund C2** (Pokal) |
| 0x1060B | Torwürfel einer Chance, Ergebnisbyte, Chancenhandler 0x1B223, Tormeldung markierter Vereine | match.ts:`goalDice`; live.ts:`chances` | stimmt (inkl. Verlängerung nur mit Markierung ≥ 10, Werte 9 und ≥ 19 ohne Wurf) |
| 0x10AF2 | Summen K/T/Frische der Nummern 1..11 über Plätze 0..Anzahl−1 für die Trainingsbalken | training.ts:`trainingBars` | stimmt (T1 aus anzeigen.md behoben); Frische-Kappung weiter unklar (bekannt) |
| 0x10BB0 | Zuschauer eines Heimspiels | attendance.ts:`attendance` | stimmt (Zweigbuch 10BB0, Z1-Z4 behoben; Abschnitte G-L neu nachgelesen, CUP_BASE 4cb3:02C8 = 4500/2200/1200/600) |
| 0x112AA | Zinstabelle der Bank (Leitwert 4cb3:0630, Sätze 060E) | stadium.ts:`driftInterest` | stimmt |
| 0x11354 | Kaderzahl eines Managers (eigene Plätze + eigene Spieler in fremden Listen und auf dem Markt) | transfer.ts:`kaderZahl` | stimmt (Randnotiz 1) |
| 0x113E5 | Trainingslager-Bildschirm: Preise einmal × Kaderzahl × 2000, Anzeige ×2252/224E, Klick: geschlossen → Meldung, schon gebucht → Meldung, Geld ≥ Preis → abbuchen, 0x119CD | training.ts:`campCost`, server.ts /api/camp | stimmt; Preisbasis bewusst (ABWEICHUNGEN "Preis des Trainingslagers") |
| 0x119CD | Wirkung des Lagers auf den Kader | training.ts:`trainingCamp` | stimmt (Profil 4cb3:527E, Matrix 52A6 nachgelesen; Würfelfolge w/9..w/6, 2L+87..2L+117, 0..20x/30, 0..x, 0..4, 155..300, 0x2277A: 35..65, 1..13, 1..3, 0..1; Sperre random(7,18) in Byte 313) |
| 0x11D0D | Tägliche Finanzen je Manager: Bau, Lagerzeiten, Bankzins 1/61, Kontosumme, Byte 313, Monatsende, Kredite | finance.ts:`dailyFinance`; server.ts:`finanzTag`; originaltag.ts | **Befund C1**; sonst stimmt (Zweigbuch 11D0D) |
| 0x1222D | Schulden bzw. Zinsen des Managers 4238:304A bei einem oder allen (99) Geldgebern | finance.ts:`loanTotal`, `lenderDebt` | stimmt (auch die Eigenheit: 0x17076 zählt die Zinsen jedes anderen Managers an alle Geldgeber) |
| 0x122D9 | Kredit eintragen | stadium.ts:`takeLoan` | stimmt (Zweigbuch kredit) |
| 0x1243B | Kreditliste eines Geldgebers | web main.ts `drawBank` | stimmt (restroutinen, Anzeige) |
| 0x1291F | Bankbildschirm mit Prüfungen (Kontostand des Mitspielers, 1.000.000/4.000.000, Laufzeit ≤ 24, Zins 3..13; Bank: Laufzeit 3·(Zeile+1), Satz 060E[Zeile]) | stadium.ts:`takeLoan`, server.ts /api/loan, main.ts | stimmt (Randnotiz 2) |
| 0x1366B | Bankkasten: Kontostand, Gesamtschulden, Zinsen/Monat | main.ts `drawBank` | stimmt (Anzeige) |
| 0x139EC | Trainingsbildschirm: Regler 319 = clamp(x − 0xD9, 0, 34), Bälle je Bereich/Position über Klickposition, Budget aus 0x22919, Intensität ohne Budget | training.ts:`setTraining`, main.ts:`drawTraining` | stimmt (Randnotiz 3) |
| 0x143ED | Kalendermeldungen: Relegation am 13. Juni, Winterpause 2. Dezember, gesichert/verspielt | messages.ts, server.ts:`finanzTag` | stimmt im Verhalten; **Befund C5** (Doku) |
| 0x14A4A | Credits-Texte entschlüsseln | - | nicht nötig (Grafik) |
| 0x14A93 | Szenenbild zeichnen, Spiegelung bei Angriff nach links | web scene.ts | nicht nötig (Grafik; Spiegelung laut SPIELMECHANIK stimmt) |
| 0x14E59 | TORE\ANZAHL lesen (43/5/2 → 4238:57CE/304C/4BD4) | fest in server/live.ts | stimmt |
| 0x14FB4 | Fehlermeldung Torszenen-Diskette | - | nicht nötig (Datei/System) |
| 0x1502C | Torszene wählen und laden | server/live.ts:`pickScene`, `elfmeterSzene`; originaltag.ts | stimmt (Würfel random(2,57CE), random(0,15/25), random(2,304C) bzw. random(0,400) und random(2,4BD4); bei 4238:549A ≠ 0 Wiederholung ohne Würfel; Neuwurf nur bei fehlender Datei - alle 94 Dateien liegen vor) |
| 0x15346 | Spielerinfo-Tafel | playerinfo.ts:`playerInfo`, main.ts:`drawPlayerInfo` | **Befunde C3, C4** (Anzeige) |

27 Routinen laut Liste (0x0F9D2 steckt im Block 0x0F749 und ist mitgeprüft).

## Befunde

### C1 (S) - Monatsende: Steuer auf den falschen Kontostand, Kredite vor statt nach der Monatsabrechnung

**Original, 0x11D0D:** Am Monatsletzten (0x11DFB: 4cb3:07B8[Monat] = Tag) läuft in dieser Reihenfolge:

```
11f13  lcall $0x14a4,$0x2636          ; 0x17076 Einnahmen
11f1c  add  %ax,%es:0x2432(%si)       ; Kontostand += Einnahmen
11f21  adc  %dx,%es:0x2434(%si)
11f26  lcall $0x14a4,$0x2822          ; 0x17262 Ausgaben - erst jetzt
11f43  sub  %cx,%es:0x2432(%di)       ; Kontostand -= Ausgaben
...
12002  movw $0x0,-0x36(%bp)           ; erst danach die Kreditschleife (Zinsen, Rückzahlung)
```

In 0x17262 hängt die Steuer am aktuellen Kontostand (Byte 496):

```
174be  cmpw $0x1e,%es:0x2434(%bx)     ; Kontostand > 2.000.000 (0x1E8480)
174e1  mov  %es:0x2432(%bx),%ax       ; (Kontostand - 2.000.000) / 500.000 * 30.000 + 20.000
1750f  cmpw $0x3d,-0x14(%bp)          ; ab 4.000.000 mal 3/2
```

Die Steuer rechnet also mit dem Kontostand **nach** Gutschrift der Monatseinnahmen (samt
Guthabenzins aus 0x17076) und **vor** den Zinsen und Rückzahlungen des Tages.

**Remake, packages/core/src/sim/finance.ts:** `dailyFinance` bucht zuerst die Kredite des Tages
(Zeilen 168-196: Zinsen am Termin, Rückzahlung), dann am Monatsletzten
`monthlyIncome` (203), `monthlyExpenses` (204) - die Steuer darin (Zeilen 95-100) liest
`m.i32(496)`, also den Stand **ohne** die Einnahmen und **nach** den Kreditbuchungen - und erst
dann `balance + income - expenses` (212).

**Folge:** Beispiel Kontostand 1,9 Mio, Monatseinnahmen 0,4 Mio: das Original zieht 20.000 DM
Steuer ab (Stand 2,3 Mio), das Remake keine. Ebenso verschiebt eine am Monatsletzten fällige
Rückzahlung oder Zinszahlung die Steuerstufe. Das Zweigbuch 11D0D ("17262 ... Steuer: stimmt")
hat die Reihenfolge nicht geprüft. Betroffen sind nur Manager über rund 2 Mio DM (ohne Oberliga).

### C2 (S, Randfall) - Chancenzahl im Pokal: Prüfung auf "verlegt" liest fremden Speicher

**Original, 0x102B9 (0x102ED-0x10321):** Vor allem Würfeln prüft die Routine das Heimtor-Byte
der Ergebnistabelle auf 30 (verlegtes Spiel) und bricht dann ohne Würfel, ohne Minuten und ohne
4238:21D8/5788 ab:

```
102ff  mov  %es:0x225a(%bx),%al       ; bx = Gruppe
10305  add  %cx,%ax                   ; Gruppe*38 + 4cb3:225A[Gruppe]
1030a  imul %cx                       ; *20
10313  add  %ax,%bx                   ; + Platz
10319  cmpb $0x1e,%es:0x6dc8(%bx)     ; 4238, == 30 -> 0x10605 (Ende)
```

Die Pokalaufrufe (0x0556C) übergeben als Gruppe 10 + Pokal (`addb $0xa` bei 0x05569) und als Platz
0, 2, 4, ... Die Grenztabelle liefert dann statische Werte (4cb3:2264..2267 = 38, 0, 3, 4, nie
beschrieben), die Adresse zeigt aus der Ergebnistabelle heraus:

| Pokal | Adresse 4238: | liegt in | Wirkung |
|---|---|---|---|
| DFB (10), Landesmeister (11) | 0x8E70 + Platz | Aufstellungen 113 (Byte 50) bis 115 | in allen 16 Ständen 0 → nie 30 |
| Pokalsieger (12) | 0x91A4 + Platz | Spielbericht 1 (4238:9164 + 0x40..0x5E): Chancenliste 0x3B (Argument +0xE von 0x305DE, Index 5, 7, ... 19) und Liste 0x4F (Argument +0xA, Index 1, 3, ... 15) | ein Eintrag 30 → diese Paarung bekommt in der Halbzeit keine Chance und keinen Wurf |
| UEFA (13) | 0x94B0 + Platz | Historieblock, Bilanz Manager 0 gegen Verein 37.. (Byte = Gegentore·16 + Tore) | 0x1E hieße 1:14 - praktisch nie |

**Remake:** server/live.ts (`startLive`, `new LiveMatch(..., kind !== "league")`) und
core/sim/live.ts:`beginMinute` (Zeile 85) würfeln `chanceCounts` für jede Pokalpaarung ohne
diese Prüfung; europa.ts:257 und match.ts:234 ebenso.

**Folge:** Nur im Europapokal der Pokalsieger, nur bei mindestens zwei Managern (Bericht von
Manager 1) und nur, wenn dort an der passenden Stelle eine 30 steht (z. B. eine Chance in Minute 30
als 6., 8., ... Eintrag, oder in Liste 0x4F). Der Bericht wird erst in der Spielvorbereitung des
Managers neu angelegt (0x1CE0A), sonst steht noch der Inhalt seines letzten Spiels dort. Dann
fehlen der Paarung die Chancen der Halbzeit, und die Zufallsfolge danach verschiebt sich. Sicher
ist der Befehlsweg; wie oft eine 30 dort steht, hängt vom Spielbericht ab (siehe "unklar").

### C3 (A) - Spielerinfo: Verletzte ohne Zähler

**Original, 0x15346 (0x15642-0x15742):** Nur bei Flag 1 (gesperrt) steht der Zähler:

```
15656  cmpb $0x1,-0x92(%bp)   ; Flag == 1?
1565b  jne  0x156b6           ; sonst ohne "NOCH n SPIELE "
1566b  ... 4cb3:2640 "NOCH ", Byte 13, 4cb3:2644 " SPIELE "
156ba  mov  $0x24f4,%bx ; sub Flag*4  -> Flag 1 "GESPERRT.", Flag 2 "VERLETZT "
156dd  cmpb $0x2,-0x92(%bp) ; Flag 2: "(" + 4cb3:23B4[Byte 23] + ")"
```

Das Original zeigt also "STATUS: NOCH n SPIELE GESPERRT." bzw. "STATUS: VERLETZT (Art)".

**Remake, packages/core/src/sim/playerinfo.ts:52:** `NOCH ${l.u8(13)} SPIELE VERLETZT (...)` -
mit Zähler (und "SPIELE", obwohl Byte 13 bei Verletzungen Wochen zählt). Die Dopingsperre
(Zeile 51) ist Version 2026 und nicht betroffen. docs/SPIELMECHANIK.md:1417 beschreibt die
Verletzungszeile ebenso falsch.

### C4 (A) - Spielerinfo: Europapokalspalte und Gesamtzahlen fehlen

**Original, 0x15346 (0x157FE-0x159A9):** Drei Spalten LIGA, DFB-POKAL, EUROPACUP (Kopf aus
4cb3:25D8, Schleife bis 3 bei 0x157B8), je Zelle "Saison(Gesamt)":

```
1580c  mov %es:0x3(%bx),%cl      ; Tore Saison: Kaderbyte 3 + k
15830  mov $0x531c,%ax           ; "("
15850  mov %es:0x22(%bx),%cx     ; Tore gesamt: Wort 34 + 2k
15872  mov $0x531e,%ax           ; ")"
15901  mov %es:0x6(%bx),%cl      ; Spiele Saison: Byte 6 + k
15945  mov %es:0x1c(%bx),%cx     ; Spiele gesamt: Wort 28 + 2k
```

**Remake:** playerinfo.ts:67-68 liefert nur `goals: [u8(3), u8(4)]`, `apps: [u8(6), u8(7)]`;
main.ts:4924-4933 (`drawPlayerInfo`) zeigt nur LIGA und DFB-POKAL ohne Klammerwert. Die Begründung
in docs/SPIELMECHANIK.md:1422-1423 ("Europacup nicht getrennt geführt") ist überholt: Byte 5/8
(Europapokaltore/-einsätze) führt das Remake seit #88 (doping.ts:25, matchday.ts:271), die
Karrierewörter 28..38 ebenfalls (goals.ts:78, seasonEvents.ts:289); in den Ständen stehen dort
Werte (z. B. RIED-6TE Platz 1: Liga-Spiele gesamt 111, Liga-Tore gesamt 9).

### C5 (D) - Relegationsmeldung ist im Original nicht abgeschaltet

**Original, 0x1442A:**

```
14416  sub  %bh,%bh
1442a  cmp  %bh,%es:0x226a        ; 4cb3:226A - 0
1442f  je   0x14476               ; nur bei 226A == 0 übersprungen
```

4cb3:226A steht im Abbild auf **1** (Tabelle "Relegation je Liga", auch 0x1E4FC liest sie, nie
beschrieben). Die Meldung ist also aktiv: am 13. Juni, wenn 4cb3:225A[Liga] = Spieltage + 1 ist
und der gespeicherte Platz (Managerbyte 265 + 225A[Liga]) 15 (Bundesliga) bzw. 2 (2. Liga) ist.

**Falsche Doku:** docs/ABWEICHUNGEN.md:38 ("Weggelassen: Relegationsmeldung ... im Original über
4cb3:226A abgeschaltet" - dabei zeigt das Remake sie), docs/AUDIT.md:155, docs/SPIELMECHANIK.md:1390
und der Kommentar packages/core/src/sim/messages.ts:93-94. Das Remake (messages.ts:`relegationMessage`,
server.ts:1786) verhält sich wie das Original; der ABWEICHUNGEN-Eintrag sollte gestrichen werden.
Nebenbei (Anzeige, geringfügig): nach der Relegationsmeldung springt das Original ans Ende
(0x144EB `jmp 0x14a45`), die gesichert/verspielt-Meldungen dieses Aufrufs kommen also erst beim
nächsten Hauptmenü; das Remake zeigt sie am selben Tag mit. Die Bedingung "Spieltag = Spieltage + 1"
prüft das Remake nicht (am 13. Juni ohnehin erfüllt, solange kein Nachholspiel offen ist).

## Unklar

- **C2, Häufigkeit:** Ob in Spielbericht 1 an 4238:91A4 + 2k während eines Pokalsieger-Spieltags
  je eine 30 steht, lässt sich statisch nicht sagen (die Bereiche liegen nicht im Spielstand). Zur
  Klärung: Emulatorlauf eines Europapokaltags mit drei Managern und Speicherabzug 4238:9164..91FE
  zu Beginn jeder Halbzeit. Nachbau wäre einfach: vor `chanceCounts` im Pokal das Byte an derselben
  Stelle prüfen (für Gruppe 12 den Bericht von Manager 1 nachbilden, für 10/11 Aufstellung 113..115).
- **0x10AF2 Frische-Kappung** (bekannt aus anzeigen.md): die Routine addiert Byte 19 roh; die
  gemessene Kappung auf 100 stammt nicht aus dem Bereich 0x0F4D7..0x15F14.

## Randnotizen (keine Befunde)

1. **0x11354:** Das Original nimmt fremde Listen l < 4cb3:07AB (`ja` bei 0x113C1), das Remake
   `liste <= managerCount` (transfer.ts:87). Die Liste mit Index = Anzahl ist in allen 16 Ständen
   leer, daher ohne Wirkung.
2. **Bank (0x1291F ab 0x13576):** Laufzeit 3·(Zeile+1) und Satz 4cb3:060E[Zeile] setzt das
   Original selbst; der Server übernimmt `months` und `rate` für die Bank ungeprüft aus der
   Anfrage (server.ts:3495-3514, stadium.ts:`takeLoan` prüft Satz/Laufzeit nur für Mitspieler).
   Der Web-Client schickt die richtigen Werte (main.ts:6110-6111); nur eine selbst gebaute Anfrage
   käme an einen anderen Satz. Die Reihenfolge der Prüfmeldungen (Original: Geldgeberkonto,
   Grenze, Laufzeit, Wucher, Mindestzins) weicht ab, zeigt aber nur eine andere erste Meldung.
3. **0x139EC:** Über die Klickposition sind je Bereich höchstens 10 Bälle ((0xBD − 0x1E) >> 4 + 1)
   und je Position höchstens 5 ((0x120 − 0xD1) >> 4 + 1) möglich; der Client begrenzt ebenso
   (main.ts:750-765), `setTraining` (training.ts:251-252) erlaubt über die API bis 20 bzw. 10.
