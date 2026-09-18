# Referenz: Zuschauer eines Heimspiels

Gemessen am Original in DOSBox am 16.9.2026 (GitLab #23). Die Formel steht in
`packages/core/src/sim/attendance.ts` (Original 0x10BB0) und ließ sich bis dahin gegen keinen
Spielstand prüfen, weil das Ergebnis nur auf der Konferenztafel steht.

## Wie gemessen wurde

- Grundlage ist `TEST4.MAN` (30.9.1997, 12. Spieltag, Manager 0 = NORMI mit 1. FC Nürnberg,
  Heimspiel gegen den FC Schalke 04). Die Kapazität ist auf 30.000 Sitz- und 30.000 Stehplätze
  gesetzt, weil das Stadion sonst ausverkauft ist und immer genau die Kapazität herauskommt -
  mit 8.000/16.000 lieferten zehn Läufe zehnmal 24.000.
- Die Spielstände erzeugt `SaveFile.encode()` unseres eigenen Codes; das Original lädt sie
  anstandslos. Damit sind die Eingaben exakt bekannt.
- Gemessen wird mit `tools/dosbox/mess.py`: Spielstand laden, bis zum Anpfiff durchschalten,
  die Zuschauerfelder der Konferenztafel sichern. Die Zahl wird in der Spielvorbereitung
  gezogen, der Rest des Spieltags muss dafür nicht laufen (spart je Messung rund 20 Minuten).
  `tools/dosbox/reihe.sh` fährt eine Reihe und baut ein Sammelbild.
- **Gegenprobe der Ablesung:** In einem vollständig durchgespielten Lauf zeigte die Tafel
  34.025, und im gespeicherten Stand stieg Managerbyte 484 (Zuschauer gesamt) um genau 34.025;
  die Reihe 330+n bekam "34" angehängt. Tafel und Spielstand stimmen überein.

**Wichtig für spätere Messungen:** Den Tabellenplatz (Standing-Byte 46) direkt zu setzen bringt
nichts - das Original rechnet die Plätze beim Laden neu aus Punkten und Toren. Nachgewiesen:
ein Stand mit Byte 46 = 17 für Schalke kam nach bloßem Laden und Speichern mit Byte 46 = 3
zurück. Wer den Platz verändern will, muss Punkte und Tore verändern (`punkte.mjs`-Ansatz,
danach `updatePositions`).

## Bänder

Je Reihe fünf Läufe. "Unser Band" ist das Ergebnis von `attendance()` über 3.000 Würfe.

| Reihe | Eingabe | Original (5 Messungen) | unser Band | Mittel gemessen | Mittel berechnet |
| --- | --- | --- | --- | --- | --- |
| ZA | Preis 19 | 34.025 / 28.077 / 27.402 / 31.509 / 32.109 | 24.672 … 34.294 | 30.624 | 29.641 |
| ZB | Preis 12 | 44.560 / 46.692 / 46.057 / 45.558 / 45.952 | 41.797 … 48.015 | 45.764 | 45.025 |
| ZC | Preis 25 | 20.940 / 15.845 / 16.174 / 14.595 / 19.751 | 9.994 … 22.533 | 17.461 | 16.454 |
| ZD | Fanwert 30 | 29.919 / 28.037 / 25.359 / 27.451 / 28.805 | 24.162 … 33.784 | 27.914 | 29.131 |
| ZE | Fanwert 90 | 31.569 / 31.166 / 33.710 / 28.733 / 28.548 | 25.362 … 34.984 | 30.745 | 30.331 |
| ZH | Gegner Platz 1 | 29.603 / 29.349 / 32.986 / 34.313 | 25.613 … 35.235 | 31.563 | 30.582 |
| ZI | Gegner Platz 18 | 24.412 / 22.644 / 19.960 / 23.024 / 22.376 | 18.082 … 27.704 | 22.483 | 23.051 |

Alle Eingaben außer der genannten sind die von ZA. Bei ZH ist nur vier Läufe gemessen worden,
der fünfte Schnappschuss traf den Kaderbildschirm statt der Tafel.

Alle 34 Messwerte liegen im Band unserer Formel, die Mittelwerte liegen 1 bis 4 Prozent
auseinander. Der Tabellenplatz des Gegners senkt die Kulisse im Original von Platz 1 auf
Platz 18 um rund 9.100 (unsere Formel sagt 7.500), der Eintrittspreis verschiebt sie von 12
auf 25 DM um den Faktor zweieinhalb. `packages/core/test/zuschauer.test.ts` stellt die Werte
gegen die Formel, damit ein späterer Eingriff auffällt.

Nebenbei fiel in allen Läufen eine zweite Reihe an: Fortuna Düsseldorf (Manager 1, Preis 12,
Kapazität 22.000, Heimspiel gegen SSV Ulm 46) lag über 30 Läufe zwischen 15.997 und 19.911.

## Ausverkauf

Zehn Läufe aus `TEST4.MAN` mit der ursprünglichen Kapazität von 24.000 (8.000 Sitz-, 16.000
Stehplätze) ergaben zehnmal genau 24.000. Die Deckelung `att > capacity -> att = capacity` ist
damit bestätigt.
