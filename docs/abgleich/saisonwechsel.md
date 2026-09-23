# Saisonwechsel gegen den ganzen Spielstand des Originals

Abgleich vom 23.9.2026 (GitLab #100). Der Würfelvergleich (#99) prüft nur die Wurfzahl an den
Kontrollpunkten; ob dabei auch die richtigen Bytes entstehen, prüft er nicht. Hier rechnet das
Modell `saisonwechseltag` (originaltag.ts) ab dem Stand PS0 des Originals
(`tools/dosbox/KP-SAISON-START.MAN`) und wird Byte für Byte gegen den Stand des Originals nach
dem Wechsel (`KP-SAISON.MAN`) verglichen, Bereich für Bereich der Speicherkarte:

```
node --import packages/core/test/setup.ts tools/saisonvergleich.mts --tag0
node --import packages/core/test/setup.ts tools/saisonvergleich.mts --tag0 4238:2242 778   # je Satz
```

Der Zufall wird bei Kontrollpunkt 37 (erster Sommertag) auf die Wurfzahl des Originals gesetzt,
weil der Spielerpool nicht Wurf für Wurf nachzubauen ist. `--tag0` hängt den Tagesbeginn des
ersten Tages an (Finanzen, Schwankung, Aufstellung, Zug): KP-SAISON ist im ersten Zug gespeichert.

## Gefunden und behoben

| Was | Stelle im Original | Wirkung im Remake vorher |
|---|---|---|
| Trainergehalt und Fernsehgeld für alle Manager neu, zwei Würfe je Manager | 0x09623 bei 0x1EAA2 | Trainergehalt blieb, Fernsehgeld blieb; Auslosungen lagen im Zufallsstrom verschoben |
| Jahreszähler + 1 | 4cb3:07E0 bei 0x1EA5C | blieb stehen |
| DFB-Auslosung `random(0, 57)` | 4cb3:2277 | `random(0, 58)`: Verein 58 ziehbar, andere Paarungen |
| Vereinstausch lässt Pokaltabelle, Reihenfolge und Europapokallisten in Ruhe; nur das Mischen tauscht die Einträge der Reihenfolge innerhalb der Liga | 0x3C24, 0x3AC5 | alle Listen mitgetauscht, auch die Nullen der Auffüllplätze; Zweitligisten in der Bundesliga-Reihenfolge |
| Europapokalteilnehmer nach dem Mischen | 0x18B12 bei Kontrollpunkt 35 | vor dem Auf- und Abstieg |
| Gegner der Vereinsrekorde beim Tausch umschreiben | 0x4044 | nur die Zeilen getauscht |
| Tabellen: nur zwölf Felder zurücksetzen; am Ende Platz und Spiegelbytes aus der gemischten Reihenfolge, Managerbyte 267 = Platz zum Start | 0x1E29E; Tabellenroutine | alle Bytes 0..45 gelöscht, Platz alt |
| Historieneintrag: Platz aus 266 + Spieltagszahl (nach dem vorletzten Spieltag - Eigenheit), Liga, DFB-Runde (+128), Europapokal (+128); am Saisonzähler, ab 50 verschoben | 0x1DE67 bis 0x1E031 | andere Byte-Belegung, erster freier von 20 |
| Pokaltitel zählt erst der Historieneintrag | 0x1DF63, 0x1DFB6 | schon beim Finale |
| Werbung nach Aufstieg vor den Sommertagen | 0x0CC00 in 0x0CB62 | danach: Vertrag mit einem Monat Rest zweimal gezehntelt |
| Vertragsjahr ohne Prüfung abziehen (Markt: 0 → 255) | 0x0D46E | nur über 0 |
| Anzeigeoptionen je Liga an die Ligen der Manager | 0x0DA40 | blieben |
| Verletzungen heilen über den Sommer | 0x0F6D8 in 0x1E955 | blieben stehen |
| Saisonbilanz (ewige Bilanz) | 0x1DD03 | fehlte |
| Nachholtabelle und Relegationsausgang bleiben stehen | - | geleert |

## Was übrig bleibt

| Bereich | Warum |
|---|---|
| Spieler (Wert, Stärke 28/29, Verein 36) | Spielerpool 0x0F2A6: die Wertrechnung liest für Spieler 50..127 Speicher hinter dem Spielstand (#99) |
| Stärke der drei Managervereine, zwei Aufstellungsbytes | folgen aus den Spielerwerten |
| Einnahmengrundwert (Managerbyte 480), Kontostand | folgen aus der Vereinsmatrix |
| 4238:56DC | Zähler im Spielerpool |
| 4cb3:0620 | Öffnungszeiten der Trainingslager, stehen nicht im Spielstand |
| 4238:4BCE | Monat vor der Datumsrechnung; überschreibt das Original an jedem Tagesbeginn vor dem Lesen |

Für normale Spieltage taugt der Vergleich erst mit einem Modell der spielfreien Folgetage: die
Vorlagen sind im nächsten Zug gespeichert, und dazwischen liegen oft mehrere Trainingstage.
