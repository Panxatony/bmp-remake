# Audit 2, Gruppe E, Teil 4: 0x2277A bis unter 0x242CF

Gelesen: all.s Zeilen 50745-53212, zur Klärung außerdem 0x1FDBE (Platz entfernen), 0x224A8
(Aufnahme, nur Rückgabewert und Würfel) und das Knopfpaar von 0x242CF. Remake-Stand: deccf74.

Segmenttabelle (4cb3:9E9C ff.): -0x6162/-0x6164/-0x6144/-0x6148/-0x614a/-0x6140 = 4238,
-0x6166/-0x6168/-0x615x = 4cb3. 4238:304A = Manager am Zug, 4238:2242+m·0x30A = Managersatz,
4238:774A+(m·25+p)·0x34 = Kaderplatz, 4238:8B9A+s·0x34 = Marktplatz, 4238:57DD+i·0x25 = Spieler.

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x2277A | Byte 14 = random(35,65), Byte 20 = random(1,13) \| random(1,3)<<4 \| random(0,1)<<7 (Reihenfolge so) | training.ts:149-150, training.ts:406-407, newgame.ts:150-151 (`addToSquad`) | stimmt |
| 0x227F1 | Jugendregler: 37.VGA (0,54) 50x41 bei (209,193), zwei Striche y 212/213 von x 217 bis 217+Wert, Betrag ((Wert+1)·10000>>4)·2252/224E mittig 211..261, y 223, Farbe 0x1D | main.ts:792-797 (`drawTraining`) | stimmt (Tausenderpunkte hängen am klebrigen 07B2, schon als unklar in anzeigen.md) |
| 0x22919 | Freie Bälle: Modus 0 → 20 − Σ Byte 321..324, Modus ≠0 → 10 − Σ Byte 326..329 (8-Bit-Summe), Byte 325 zählt nicht | training.ts:230 (`TRAINING_BUDGET`), main.ts:715-716, `setTraining` | stimmt |
| 0x22995 | Bälle zeichnen/löschen: Zeile 0/1 Leisten x 5/300, y 196−16k−19 (> 15), Zeilen 2..9 Balken x 31/210+16(k−1), y 36+37i, Zeile 8 Intensität x 31 y 190; Modus 0 stellt den Hintergrund aus (2,2) wieder her | main.ts:722-757 (`drawTraining`) | stimmt (Modus 0 braucht der Canvas nicht) |
| 0x22C15 22C15-22D8F | Aufbau: Tafeln, Überschriften, Knöpfe LEIHEN (175,110)/KAUFEN (245,110), Vorgabe KAUFEN (-0x8 = 0) | main.ts `drawMarket` | nicht nötig (Grafik) |
| 22C15 22DA3-22F57 | "Kontostand:" mit Kontostand·2252/224E, Tausenderpunkte (07B2 = 0), " DM" | main.ts `drawMarket`, gfx.ts:253 `dm` | stimmt |
| 22C15 22F5A-22FBA | Neuzeichnen des Kaders (0x1F37F) und **danach immer 0x22030** (Aufstellungsautomatik), auch beim Betreten | server.ts:3282 nur nach Kauf | **Befund T4-5** |
| 22C15 22FBF-2302F | Marktliste mit Manager 4 (0x1F37F, Modus Leihe+1), einmaliger Hinweis 0x76B:1416 auf 4238:2E70 | main.ts `drawMarket` | Liste: Teil 1F37F (andere Gruppe); Hinweis unklar |
| 22C15 23038-230F1 | Klickverteilung; Klick in Fläche 0x65 mit y > 109 kippt LEIHEN/KAUFEN, außer bei 4238:513C = 1964/1993 | main.ts:6433-6434 | stimmt (513C ist im Remake immer 22251) |
| 22C15 23114-233AC | Überfahren einer Marktzeile: "VON " + Vereinsname (Besitzer 4) **bzw. Managername in Großbuchstaben (0x3196D)** + ", " + Alter (Byte 26) + " J.", mittig 2..155 bei y 190 | main.ts:6447 | **Befund T4-9** |
| 22C15 23458-234A1 | Kaderspieler: Karriereende (Byte 24 Bit 7) meldet "Dieser Spieler hört am Saisonende auf." - **vor** der Angebotsprüfung | transfer.ts:371 (`listPlayer`); `saleOffer` prüft es nicht | **Befund T4-8** |
| 22C15 234AE-23652 | Angebot für Kaderspieler (Bit 6): Wert 0x24D4E(Platz,0)·random(85,150)/10000·100, Dialog 0x242CF, Bit 6 wird immer gelöscht, Meldungszeiger frei; VERKAUFEN: Ablöse aufs Konto, Platz entfernen (0x1FDBE, 24), **dann** Byte 22 und Stärken vom Platz lesen | transfer.ts:429-466 (`saleOffer`, `decideSale`) | Betrag stimmt; **Befund T4-1** |
| 22C15 23655-23797 | Auf den Markt setzen: eigene Marktspieler zählen (≥ 3 → "Schon 3 Spieler auf dem Transfermarkt"), Besitzer ≠ Manager → "Dieser Spieler ist nur ausgeliehen", Aufnahme 0x224A8 mit Manager 4 (Grenze 12), Nummer 0, Platz komplett kopiert, Kaderplatz entfernt | transfer.ts:368-389 (`listPlayer`) | Reihenfolge und Kopie stimmen; **Befund T4-2** (Würfel), **T4-10** (Text "Markt voll") |
| 22C15 2379A-23813 | Marktspieler rechts angeklickt: Info 0x15346 nur für eigene Spieler | - | nicht nötig (Bedienung) |
| 22C15 23816-23843 | Byte 3: Bit 0x80 und Bit des Managers → "Angebot wurde bereits abgelehnt" | transfer.ts:500 | stimmt (Bit ohne 0x80 kommt nicht vor, der Tagesverfall kippt nur das Managerbit) |
| 22C15 238AE-2397E | Angebot eingeben (8 Stellen), ·224E/2252 | main.ts `marketClick`/`fragZahl` | stimmt |
| 22C15 23981-23B1E | Eigener Marktspieler mit Angebot (Bit 7): Wert mit Manager 4 · random(67,110)/10000·100, Dialog, Bit 7 gelöscht; VERKAUFEN: Byte 22 **vor** dem Entfernen gelesen, Spieler 36 = Verein, 0x16E1A, Konto, 0x1FDBE(12), Besitzer 5. Ohne Angebot: Zurückholen (-0xA = 1) | transfer.ts:429-466 | stimmt |
| 22C15 23B22-23B5A | Angebot ≠ 0 und Konto ≥ Angebot (32 Bit signed), sonst "Sie haben nicht genug Geld" | transfer.ts:502-503 | stimmt |
| 22C15 23B7D-23C9E | Spieler eines anderen Managers: Wert 0x24D4E mit Manager 4, bei LEIHEN /3; Fehler nur bei Angebot < Wert·60/100 **oder > Wert·140/100** | transfer.ts:504-507 | **Befund T4-3** |
| 22C15 23CA1-23E23 | Frage an den Besitzer "NEHMEN SIE DAS ANGEBOT (X DM) FÜR Name AN ?" NA GUT./NEIN !; bei Ja Spielerbytes 28/29/30 = Marktplatz 16/17/18 | server.ts:3336-3370, transfer.ts:549-554 | stimmt (Ablauf über den Tageswechsel: SPIELMECHANIK) |
| 22C15 23E28-23E55 | KI-Spieler: 0x248E1 entscheidet | transfer.ts:509-513 | Teil 248E1 (andere Gruppe) |
| 22C15 23E58-23EE2 | Aufnahme 0x224A8 (Grenze 24, beim Zurückholen 25; Byte 12 = 0x63 bei LEIHEN), bei 0x7F Ende ohne Weiteres; Kauf (nicht Leihe, nicht Zurückholen): Vertragsdialog 0x251FF | transfer.ts:514-526, server.ts:3252-3280 | **Befund T4-6**, **T4-7** |
| 22C15 23EE5-23F6C | Kauf von einem Manager: Byte 9 (**ungefiltert**), 23, 13, 0, 1, 2 vom Marktplatz | transfer.ts:558-565 | **Befund T4-4** |
| 22C15 23F6F-23FFA | Zurückholen **oder** LEIHEN: ganzer Marktplatz kopiert (Byte 9 ungefiltert); bei LEIHEN (auch beim Zurückholen!) Byte 11 = 1, Byte 12 = Verein + 0x80, Gehalt aus 0x224A8, Bytes 3..5 = 0 | transfer.ts:392-410 (`takeBack`), 582-609 (`completeLoan`) | **Befund T4-4**, **T4-2**, **T4-11** |
| 22C15 23FFF-240A9 | Marktplatz entfernen (0x1FDBE mit Manager 4, 12); Kauf/Leihe vom Manager: Betrag an den Besitzer, Spieler 36 = Verein des Käufers; Besitzer = Käufer außer bei Leihe | transfer.ts:566-575, 600-608 | stimmt |
| 22C15 240B1-24119 | Abbuchen; **nur bei KI-Kauf und KI-Leihe** Sponsor-Zuschuss 0x0272D; danach 0x22030 über das Neuzeichnen | server.ts:3285 | **Befund T4-6**, T4-5 |
| 22C15 2411C-241B5 | Vertrag abgebrochen: Kaderplatz wieder entfernen, Spieler 36 zurück, "Der Transfer findet nicht statt", Ablehnungsbit nur ohne -0x78 (nicht bei Kauf vom Manager); Ablehnung (248E1 = 0 oder NEIN !): "Ihr Angebot wurde abgelehnt", Bit | transfer.ts:532-535, server.ts:3264/3274/3343 | **Befund T4-7** |
| 22C15 241B7-2429F | Meldungen, Zeilenmarke löschen | - | nicht nötig (Grafik) |
| 22C15 2429F-242CE | Ende (0x66): Bild zurück, 0x0F9D2 (Stärke des Managers) | server.ts:3471 (`/api/verlassen`) | stimmt |

## Befunde

### T4-1 (S) Verkauf eines Kaderspielers: Verein und Stärkung kommen vom Nachrücker

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

### T4-2 (S) Auf den Markt setzen und Zurückholen würfeln im Original fünfmal

Original 0x236F2: `lcall 1ecd:37d8` = 0x224A8 mit Manager 4; Zurückholen 0x23E86 ebenso (Grenze
25). 0x224A8 würfelt immer: `22687 lcall 76b:cc7` mit (0x50,0x78) → Byte 19, dann
`2269c lcall 2277:a` = 0x2277A (random(35,65), random(1,13), random(1,3), random(0,1)), dann
0x24D4E(Platz, 1) (bei Byte 9 = 0 ohne Wurf). Die Werte werden anschließend von der Kopie des
Kader- bzw. Marktplatzes überschrieben (0x2373D, 0x23FA8), die Würfe sind aber verbraucht.
Remake transfer.ts:368-389 (`listPlayer`) und 392-410 (`takeBack`) kopieren ohne `rng`. Die
Zufallsfolge des Raums verschiebt sich um fünf Würfe je Aktion (alle folgenden Würfe desselben
Tages anders). Bei LEIHEN im Zurückholen würfelt 0x24D4E mit Flag 3 ebenfalls nicht mehr (Byte 9 = 0).

### T4-3 (S) Obergrenze beim Angebot an einen anderen Manager: genau 140 % ist erlaubt

Original 0x23BF0-0x23C1D: Grenze = Wert·140/100 (`mov $0x8c,%ax ... lcall 3a01:1ae6; lcall
3a01:1a4c`), dann `cmp -0x4(%bp),%dx; jle 23c16` / `23c16: jl 23c20` /
`cmp -0x6(%bp),%ax; jb 23c20` / sonst `jmp 23ca1`: Fehler nur, wenn Grenze < Angebot. Untere
Grenze (0x23BE4): Fehler nur, wenn Wert·60/100 > Angebot.
Remake transfer.ts:506: `amount >= div(value * 140, 100)` → Fehler. Ein Angebot von genau
Wert·140/100 lehnt das Remake ab, das Original legt es dem Besitzer vor.

### T4-4 (S) Byte 9 wird beim Kauf vom Manager und bei der Leihe ungefiltert übernommen

Original 0x23EEE: `mov %es:0x9(%bx),%al` → `mov %cl,%es:0x7753(%bx)` (Kaderplatz Byte 9 =
Marktbyte 9, ohne Maske); Leihe und Zurückholen 0x23FA8: ganzer Platz per `lcall 35ac:304a`,
danach kein Zugriff auf Byte 9.
Remake transfer.ts:559 `n.setU8(9, market[9] & 0x3f)` und transfer.ts:594 `bytes[9] &= 0x3f`
(beim Zurückholen transfer.ts:401 ohne Wirkung, weil dort Bit 7 nie gesetzt ist).
Wirksam, wenn der Marktspieler eines Managers ein offenes KI-Angebot hat (Bit 7, 0x0DF0D): im
Original trägt der Käufer/Entleiher das Bit im Kader weiter. Das Bit ändert den Marktwert
(value.ts:76-79: ·130/100 bei Byte 22 > 63, sonst ·random(95,100)/100 - also auch ein Wurf) bis
zum Löschen am Saisonende (0x0CB62, Byte 9 &= 0x3F).

### T4-5 (S) Aufstellungsautomatik bei jedem Neuzeichnen des Kaders

Original 0x22F5A-0x22FBA: ist -0x2A gesetzt, zeichnet 0x1F37F den Kader und ruft danach
`22fba lcall 1ecd:3360` (0x22030; bei manuellem System sofort Ende). -0x2A ist beim Betreten
gesetzt (0x22C2F) und nach Verkauf eines Kaderspielers (0x2364E), Aufnahme in den Markt
(0x2375B) sowie jedem Kauf, jeder Leihe und jedem Zurückholen (0x240AE).
Remake: nur nach dem Kauf mit Vertrag (server.ts:3282). `/api/market/list` (3156),
`/api/market/decide` (3186), `/api/market/takeback` (3169), Leihe (`/api/market/buy` "done",
3229 ff.; Leihe unter Managern 3358) und das Öffnen des Bildschirms rufen `autoLineupIfEnabled`
nicht. Nach Abgabe eines Starters fehlt bei eingeschalteter Automatik bis zum nächsten Aufruf
(Tagesroutine) die Nummer, der Neue auf der Leihe bekommt keine.

### T4-6 (S) Sponsor-Zuschuss 0x0272D: bei KI-Leihe ja, bei Kauf vom Manager nein

Original 0x240DB: `cmpb $0,-0xa; jne 24114; cmpb $0,-0x78; jne 24114` - Abbuchung und
`2410d lcall 0:272d` (random(0,6), ggf. random(20,65)) laufen genau bei Kauf **und Leihe** eines
KI-Spielers (-0x78 = 0); beim Kauf/der Leihe vom Manager (-0x78 = 1) nur Abbuchung bei 0x240B7.
Remake server.ts:3285: `sponsorSubsidy` nur in `/api/market/contract` - also bei jedem Kauf mit
Vertrag, auch vom Manager (über `/api/market/answer` → `room.purchases`), und nie bei einer
KI-Leihe. Folge: Würfe und ggf. Geld an der falschen Stelle.

### T4-7 (S) Abgebrochener Kauf und voller Kader

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

### T4-8 (S, selten) Karriereende sperrt im Original auch das Verkaufsangebot

Original 0x2347A: `testb $0x80,%es:0x18(%bx); je 234a4` → sonst Meldung 4cb3:4D74 "Dieser
Spieler hört / am Saisonende auf." und Ende - vor der Prüfung auf Bit 6 (0x234AE).
Remake main.ts:6390/6496 schickt bei Bit 6 `/api/market/offer`; `saleOffer` (transfer.ts:429)
prüft Byte 24 nicht. Ein Spieler mit Karriereende und noch offenem Angebot (Angebot vor dem
Setzen von Bit 7 entstanden und noch nicht verfallen) ist im Remake verkaufbar, im Original nicht.
Ob der Fall im Spiel entsteht, hängt davon ab, wann Byte 24 Bit 7 gesetzt wird (nicht Teil dieses Bereichs).

### T4-9 (A) "VON"-Zeile beim Marktspieler eines Managers

Original 0x2325E: nur bei Besitzer 4 der Vereinsname (`add $0x3066` auf 4238, 0x22 je Verein);
sonst `lcall 3091:105d` (0x3196D: Großbuchstaben-Kopie) auf den Managersatz 4238:2242+Besitzer·0x30A
= Managername. Text "VON <MANAGER>, <Alter> J." mittig 2..155 bei y 190 (0x2335E ff.).
Remake main.ts:6447 zeigt immer `clubName(sel.club)` (Spielerbyte 36) bei (163,135); der
Managername steht nur als eigene Zeile darunter (main.ts:6461).

### T4-10 (A) Meldung bei vollem Markt

Original: 0x224A8 mit Grenze 12 (`224b8 cmpb $0xc,0x10(%bp)`, Platz 11 belegt) meldet
4cb3:4D2C/4D30 "Schon 12 Mann auf / dem Transfermarkt". Remake transfer.ts:377: "Der
Transfermarkt ist voll" (kein Originaltext).

### T4-11 (S) Zurückholen bei gewähltem LEIHEN wird zur Leihe

Original 0x23F6F-0x23FFA: die Nachbehandlung hängt an `cmpb $0,-0x8(%bp)` (Schalter LEIHEN),
nicht an -0xA: ist beim Zurückholen LEIHEN gewählt, setzt das Original Byte 11 = 1, Byte 12 =
eigener Verein + 0x80 (Leihmarke), Gehalt = Wert aus 0x224A8 mit Flag 3 (0x23E79: `mov $0x63,%al;
imulb -0x8(%bp)` → Byte-12-Argument 0x63 → 0x226EE Flag 3, ein Drittel), Bytes 3..5 = 0; Besitzer
bleibt der Manager (0x24089), kein Geld. Remake transfer.ts:392-410 (`takeBack`) kennt den
Schalter nicht (main.ts:6482 schickt ihn nicht mit) und übernimmt den Platz unverändert.
Folge im Original: Vertrag 1 Jahr, Gehalt gedrittelt, Byte 12 wird am Saisonende gelöscht.

## Unklar

- 0x2300F-0x2302F: beim ersten Aufbau `lcall 76b:1416` mit dem Zeiger 4238:2E70/2E72 (Argument 1).
  Was dort steht (Hinweistext?) und ob das Remake es zeigt, habe ich nicht geklärt; nur Anzeige.
- 0x1FDBE mit Anzahl 24 bzw. 12 kopiert Platz 24 (bzw. Markt 112) nach 23 (111) und löscht von
  Platz 24 (112) nur Byte 15; `removePlace` nullt den ganzen letzten Platz. Nur Restbytes leerer
  Plätze, wirkt aber mit T4-1 zusammen (der Verkaufte als Letzter liest Byte 22 dieses Rests).
- Außerhalb meines Bereichs aufgefallen (0x224A8, Teil 3): die Aufnahme sortiert auch bei
  Managern nach Spielernummer ein (0x22584: erster Platz mit Nummer ≥ neuer oder leer, Nachschieben
  ab 23), das Remake (`addToSquad` → `sortIntoSquad`) nach Mannschaftsteil. Bitte dort prüfen.
- Bedienung ohne Befund: das Remake fragt vor "auf den Markt setzen" und "zurückholen" nach
  (main.ts:6482, 6497), das Original nicht; Überfahren statt Anklicken für die VON-Zeile.
