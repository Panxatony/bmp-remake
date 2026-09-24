# Ganzstandvergleich nach Spieltag und Folgetag

Stand 24.9.2026 (GitLab #100). Die Messstände in tools/dosbox (KP-*.MAN) sind im Original nach
einem Tag gespeichert, im Zug des Folgetags. Der Vergleichslauf rechnet vom Ausgangsstand aus den
Tag (`originaltag`) und den Tagesbeginn des Folgetags bis zum Zug. Danach vergleicht er den
ganzen Spielstand Bereich für Bereich mit dem Original. Die Tests stehen in
test/originaltag.test.ts ("Ganzstand nach Tag und Folgetag", "Folgetag bis zum Zug").

Nicht verglichen werden:
- Tageszähler, Datum, Spieltage und Paarungen, die der Vergleichslauf nicht weiterschaltet;
- Ergebnistabelle, Prüfsumme, Lagerzeiten, Monat 4BCE;
- Tafelzuordnung der Konferenz 4238:5350;
- Laufzeitzeiger (Kaderplätze Bytes 48..51, 4238:5664).

## Befunde im Spiel

| | Was | Stelle | Stand |
|---|---|---|---|
| G1 | Tabelle: Austauschsortieren, bei gleichen Punkten weniger Spiele vor Tordifferenz | 0x2D144 | behoben (Zweigbuch 2D144) |
| G2 | Bilanz je Manager gegen jeden Verein: Heimspiel im geraden Byte, Byte = Gegentore·16 + eigene Tore | 0x2D182 | behoben |
| G3 | Spielvorbereitung über die Plätze 0..Anzahl-1: der letzte Spieler hinter einer Lücke behält seine Note | 0x1CC4A | behoben (1C632 V12) |
| G4 | Gehälter über die Plätze 0..Anzahl-1: das Gehalt im leeren Platz zählt, der letzte Spieler nicht | 0x17262 | behoben (11D0D G1) |
| G5 | Stärke über die Plätze 0..Anzahl-1: ein Starter hinter der Lücke zählt nicht | 0x0F9D2 | behoben (0F9D2 K5) |
| G6 | Tabellenplatz am Nachholtag nach Managerbyte 267 + 225A - 1, also zum zuletzt gespielten Spieltag | 0x2D144 | behoben (`playReplays`) |

Die Eigenheit "Plätze 0..Anzahl-1" (G3 bis G5) wirkt nur, wenn ein Kader eine Lücke hat. Das
Remake rückt beim Entfernen nach; Lücken kommen mit Spielständen aus dem Original (TEST4 und
RUNA0, Manager 2). Weitere Schleifen über den Kader im Modell (`squadOf`: Torschützen,
Vorfälle, Zeitung, Doping, Medizin …) sind darauf nicht einzeln geprüft.

## Befunde im Vergleichslauf

- Monatszins über die Tagessummen der Kontostände seit dem Laden (wie Original und Server).
- Lagersperre Byte 313 je Saisontag.
- Lagerzeiten des Folgetags aus dem ersten Tag.
- Tabellensortierung nach der Buchung.
