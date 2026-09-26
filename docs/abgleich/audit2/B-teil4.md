# Audit 2, Gruppe B, Teil 4: 0x0DF0D (Tagesroutine) und 0x0F125

Geprüft: Disassembly 0xDF0D..0xF2A6 Befehl für Befehl, gegen `sim/tagesroutine.ts`, `transfer.ts`
(`dailyTransfers`, `kaderAngebote`, `angebotsbitsVerfallen`), `finance.ts` (`stadionTag`),
`training.ts` (`trainingsverletzung`, `dailyTraining`, `injuryCountdown`), `contracts.ts`
(`karriereAnkuendigung`, `vertragszaehler`, `verlaengerungsangebot`), `lineup.ts` (`seitenTausch`),
Aufruf in `server.ts:2044` und `originaltag.ts:263`. Das Zweigbuch 0DF0D.md mit F1..F7 stimmt im
heutigen Stand (alle sieben sind im Code umgesetzt). Die Stichproben zu seinen Urteilen stimmen, mit
einer Ausnahme: Abschnitt G, Punkt 5 schreibt „Byte 24 über 99: mit 1/6 zurück ..., sonst herunterzählen“.
Tatsächlich zählt ein Wert über 99 nie herunter (0xE5FA `jne 0xe650`). Der Code (`vertragszaehler`)
macht das richtig, nur der Text im Zweigbuch ist ungenau (Klasse D, sehr gering).

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x0DF0D A (DF0D-DF53) | Schwelle 37-[Stufe=5], ganze Routine entfällt ab Saisontag 322 | tagesroutine.ts:43, training.ts `threshold` | stimmt |
| 0x0DF0D B (DF54-E00A) | Markt, nur Manager 0: Frische > 56 um random(3,9) weniger, mit 1/4 fallen die Angebotsbits weg | transfer.ts:239-246 `dailyTransfers` | stimmt (Markt ist lückenlos, `removePlace` rückt nach) |
| 0x0DF0D C (E00B-E057) | Lebensdauer der Meldungen | Server-Meldungen | bewusst (ABWEICHUNGEN: Meldungen) |
| 0x0DF0D D (E058-E1FA) | eigene Spieler auf dem Markt: Ablehnungsbit 1/3, 0x0F6D8, Angebot fremder Vereine bei random(0,180) < Wert und random(0,2) ≠ 0 | transfer.ts:247-265 | stimmt (Zeiger ↔ Bit 0x80 gleichwertig, siehe Unklar U2) |
| 0x0DF0D E (E1FB-E443) | Krawallschaden (4·[358] + [350]/2)·random(2,5), auf 1000 abgerundet, Komfort 390 1/3 bzw. 2/3 | finance.ts:241-260 `stadionTag` | Rechnung stimmt; Meldung **Befund T4d** |
| 0x0DF0D F (E444-E537) | Komfortabnutzung random(0,442-52·[398]) = 0, > 1, nur Bundesliga | finance.ts:271-276 | Rechnung stimmt; Meldung **Befund T4d** |
| 0x0DF0D G (E538-E9D7) | Kaderschleife: Verletzung, Karriereankündigung, Nummer 0, Angebotsbits, Zähler Byte 24, Verlängerungsangebot | tagesroutine.ts:50-59, training.ts:175, contracts.ts:149/192/276, server.ts:1998 | Reihenfolge und Würfel stimmen; **Befund T4b**; Meldungsdatum Verletzung **Befund T4e** |
| 0x0DF0D H (E9D8-EB33) | Angebote fremder Vereine: random(0,200) < Wert, random(0,450) = 0, Ausland bei Wert > 90 mit 1/13 | transfer.ts:277-296 `kaderAngebote` | **Befund T4a** |
| 0x0DF0D I (EB34-EB9C) | Grundgewinn je Linie aus der Matrix 4cb3:0292 und den Bällen, /400 | training.ts:63-64 | stimmt (Matrix byteweise verglichen) |
| 0x0DF0D J (EB9D-EEE2) | Trainingslinie: Gewinn·Faktor/100·B14/50·Positionsbälle/100, Ziel, Frischezuschlag, Richtung, Schritt, Grenzen | training.ts:97-139 | Würfel und Grenzen stimmen; **Befund T4c** (16-Bit-Überlauf) |
| 0x0DF0D K (EEE3-EF7C) | Trainingsfaktor Byte 14 / Sonderprogramm Byte 20, abgelaufen → 0x2277A | training.ts:142-156 | stimmt (auch der Unterlauf der Restdauer auf 0xF) |
| 0x0DF0D L (EF7D-F124) | je Platz 0x0F6D8, Frische > 50 um random(3,7) weniger, Intensität im Fenster mindestens 6, Frische ±, 60..150, Faktor 20·Int, Abzug über 135, Torwart +30; am Ende 0x22030 | training.ts:71-92, tagesroutine.ts:62 | stimmt |
| 0x0F125 | Seitentausch: Starter mit \|Spalte(B25) - Vorliebe(Spieler 32)\| > 1 tauscht mit dem Starter derselben Reihe (B26), dessen Vorliebe am besten zur Spalte passt (Start 99, strikt <), wenn das besser ist | lineup.ts:130 `seitenTausch` | stimmt (Abstand 0x319E5 = \|a-b\|, Grenzen, Vergleiche, Tausch geprüft) |

## Befunde

### T4a (S): Angebote fremder Vereine trotz eines liegenden Verlängerungsangebots

- Original 0x0EAFA-0x0EB06 (Abschnitt H): Bedingung für das Angebot ist, dass im Kaderplatz **kein
  Meldungszeiger** steht: `mov %es:0x32(%bx),%ax; or %es:0x30(%bx),%ax; je 0xeb0b`, erst danach
  `orb $0x40,%es:0x9(%bx)`.
- Der Zeiger wird auch beim Verlängerungsangebot gesetzt: 0x0E9C1 `lcall $0x3091,$0x190`, dann
  0x0E9CD/0x0E9D1 `mov %ax,%es:0x30(%bx)` / `mov %dx,%es:0x32(%bx)`, zusammen mit Byte 24 = 100 + Jahre
  (0x0E992). Wieder gelöscht wird er nur zusammen mit den Angebotsbits (0x0E5B8, 0x2355A, 0x23A40),
  beim Verfall des Angebots (0x0E621, dort geht Byte 24 auf random(9,17)), im Vertragsdialog (0x2617A)
  und am Saisonende (0x0D43A).
- Remake transfer.ts:286: `... || (l.u8(9) & OFFER_SQUAD) !== 0) return;` prüft nur Bit 0x40.
  Liegt ein Verlängerungsangebot (Byte 24 = 101..104, Bit 0x40 frei), macht das Remake dem Spieler
  trotzdem ein Angebot eines fremden Vereins. Das Original tut das nicht.
- Folgen: Bit 0x40 und Byte 22 werden geschrieben. Dazu kommen Würfe, die das Original nicht macht:
  `rng(0,12)` bei Wert > 90, die Vereinswahl `chooseOfferClub` und der Meldungswurf random(0,3).
  Damit verschiebt sich der Zufallsstrom.
- Dafür bin ich mir sicher: die beiden Würfe davor (random(0,200), random(0,450)) liegen in beiden
  Fassungen gleich, verschieden ist nur die dritte Bedingung. Ein liegendes Verlängerungsangebot
  hat immer einen Zeiger, weil 0x0E9CD ihn gleich nach der Meldung setzt.

### T4b (S): Verlängerungsangebot trotz eines Angebots eines fremden Vereins

- Original 0x0E93C-0x0E956 (Abschnitt G): nach random(0,N) = 0 und random(0,3) = 0 gelten drei
  Bedingungen:
  - kein Meldungszeiger: `mov %es:0x32(%bx),%ax; or %es:0x30(%bx),%ax; jne 0xe958`
  - Bit 7 von Byte 24 frei: `testb $0x80,%es:0x18(%bx)`
  - Byte 11 = 1: `cmpb $0x1,%es:0xb(%bx); je 0xe95b`
  
  Byte 24 ≥ 100 prüft das Original nicht.
- Der Zeiger steht auch nach einem Angebot eines fremden Vereins (0x0EA6D/0x0EA71 nach
  `orb $0x40,%es:0x9(%bx)` bei 0x0EB0B).
- Remake contracts.ts:209: `if (b24 & 0x80 || b24 >= 100 || l.u8(11) !== 1) return null;`. Das Remake
  ersetzt die Zeigerprüfung durch `b24 >= 100` und prüft Bit 0x40 von Byte 9 nicht. Ein Spieler im
  letzten Vertragsjahr mit einem Angebot eines fremden Vereins (Bit 0x40 gesetzt, Byte 24 < 100)
  bietet im Remake eine Verlängerung an, im Original nicht.
- Folgen: Byte 24 = 100 + Jahre. Dazu kommen die Zusatzwürfe `rng(0,100)` und der Meldungswurf.
  Der Zufallsstrom verschiebt sich.
- Die Umkehrung (Byte 24 ≥ 100 ohne Zeiger) kann nur nach dem Saisonende entstehen, siehe Unklar U1.

### T4c (S, Randfall): 16-Bit-Überlauf beim Trainingsgewinn fehlt

- Original 0x0EE0C-0x0EEA3: alle drei Schritte rechnen `imul` und dann `cwtd; idiv`. Geteilt wird
  also nur das untere Wort des Produkts, mit Vorzeichen:
  - `imulw -0x8(%bp)` … `cwtd; idiv %cx(100)`
  - `imul %cx(B14)` … `cwtd; idiv %cx(50)`
  - `imulw -0x10(%bp)` … `cwtd; idiv %cx(100)`
- Remake training.ts:99-102: `div(gain * posBalls, 100)` usw. rechnet ohne Kürzung auf 16 Bit.
- Erreichbar im dritten Schritt, wenn Gewinn₂ · Positionsbälle ≥ 32768 ist. Ein Beispiel:
  - Bälle: alle 20 auf Kondition, dann ist der Grundgewinn 80.
  - Intensität 10 bei Frische ≤ 135 ergibt Faktor 200.
  - Mit B14 ≥ 59 wird Gewinn₂ ≥ 188.
  - 10 Positionsbälle auf die Gruppe des Spielers ergeben 172..175.
  
  Beim Torwart (Faktor 230) reicht schon B14 ≥ 52, und auch die Technik-Linie (Grundgewinn 65)
  kann überlaufen.
- Im Original wird der Gewinn dann negativ (z.B. 37324 → -28212 → -282). Die Linie sinkt mit
  random(2,3) statt zu steigen. Die Würfe bleiben dieselben, das Ergebnis ist aber anders
  (Spielerwerte).

### T4d (A): Randale- und Komfortmeldung anders umbrochen, Betrag ohne Tausenderpunkte

- Original 0x0E21A-0x0E3A5 und 0x0E4A6-0x0E4F6: drei feste Zeilen gehen an 0x0239E.
  - Randale: 4cb3:1B23 „Randalierer im Stadion“, 1B3A „richteten einen Sachschaden“, dann
    „von “ + Betrag + „ DM an.“. Der Betrag wird über 0x7D31 formatiert (0x0E375), also mit
    Tausenderpunkten (0x7D64: 07B2 = 0 → '.').
  - Komfort: 1B5B „In der neuen Komfortbewertung“, 1B79 „wird ihr Stadion um eine Note“,
    1B97 „schlechter beurteilt.“.
- Remake finance.ts:248 und :275 fügt die Zeilen zu einem Text zusammen (`${damage}` ohne Punkte).
  server.ts:2049 (und :1771) bricht ihn mit `wrap(…, 24)` neu um. Heraus kommen z.B. „Randalierer im
  Stadion / richteten einen / Sachschaden von 123000 / DM an.“ statt der drei Originalzeilen.

### T4e (A): Meldung „Verletzung im Training“ ohne Rückdatierung

- Original 0x0E762 `lcall $0x0,$0x239e` → 0x30AA0. Wie jede Meldung wird sie um random(0,3) Tage
  zurückdatiert. Das Remake würfelt das auch (tagesroutine.ts:52 `verletzt.push({ place, zurueck: meldung() })`).
- server.ts:2078 benutzt `t.verletzt` aber nicht. Es erkennt die Verletzung am Bitvergleich und ruft
  `pushMessage` ohne Datum auf, also mit dem heutigen Tag. Randale, Transfer, Karriere und
  Verlängerung übergeben dagegen `datum(ev.zurueck)`. Datum und Reihenfolge in der Meldungsliste
  weichen deshalb ab.

### T4f (D): Zweigbuch 0DF0D, Abschnitt G Punkt 5

- Dort steht „Byte 24 über 99: mit 1/6 zurück auf random(9,17), sonst herunterzählen“.
- Das Original zählt über 99 nicht herunter: 0x0E5F8 `or %ax,%ax; jne 0xe650` überspringt, und das
  Herunterzählen 0x0E63E-0x0E64C erreicht nur ≤ 99.
- Außerdem gilt der Rücksprung nur mit Meldungszeiger (0x0E5FC). Code und Kommentar in
  contracts.ts:256-275 sind richtig.

## Unklar

- **U1** Saisonende: 0x0D42D-0x0D457 löscht Zeiger und Bits 0x40/0x80, lässt Byte 24 aber stehen
  (außer 4cb3:05D4 ≠ 0 → 0x0D2B8 Byte 24 = 0). Bleibt ein Verlängerungsangebot (101..104) über das
  Saisonende stehen, verfällt es im Original nie mehr (0x0E5FC braucht den Zeiger), und der Spieler
  darf neu anbieten (kein Zeiger). Im Remake verfällt es mit 1/6, und es blockiert
  (`b24 >= 100`). Ob der Fall vorkommt, hängt am Saisonende 0x0CB62 (Vertragsjahr 1 → 0, Abgang?).
  Das gehört zum anderen Teil.
- **U2** Markt: 0x0E16E prüft den Meldungszeiger des Marktplatzes, das Remake Bit 0x80. Das ist
  gleichwertig, solange der Zeiger nur aus Abschnitt D kommt. Setzt der Manager einen Spieler mit
  liegendem Verlängerungsangebot auf den Markt (0x23655 kopiert den Platz; ob mit Zeiger, habe ich
  nicht geprüft), bekäme er im Original nie ein Marktangebot. Das Remake prüft das nicht.
- **U3** Karriereankündigung ohne freien Meldungsplatz (0x0E800 `cmp $0x7f,%di` → 0x0E573 gibt
  die Meldung sofort frei): im Original erscheint dann keine Meldung, das Remake zeigt sie immer.
  Gewürfelt wird gleich. Das gehört vermutlich zur bewussten Meldungsabweichung.
