# Neues Spiel gegen den ganzen Spielstand des Originals

Abgleich vom 24.9.2026 (GitLab #100). Remake: `createGame` (sim/newgame.ts), Verteilung
`distributePlayers`/`poolTargets` (sim/pool.ts), Markt `refreshMarket` (sim/transfer.ts),
Stärke mit Flag 0 `anzeigeStaerke` (sim/matchday.ts); Server `/api/newgame`, `nachTageswechsel`.

## Messung

Im Original legt `tools/dosbox/neuesspiel.sh NAME [KLICKS]` ein neues Spiel an (ein Manager TEST
mit Dynamo Dresden, `KLICKS` Klicks auf das Wappen, speichern im ersten Zug). Die Testkopie ist mit
`seed-patch.py ... 1 tag` und `kontrollpunkte.py --hoehle statistik` gebaut: beim neuen Spiel ist
`randomize` überbrückt, der Zufall beginnt beim Zustand 1, jeder Tagesbeginn mit srand(1).

- Kontrollpunkte 44 bis 59 im Ablauf 0x08FD8/0x0AD44, 60 bis 62 in der Verteilung, 63 bis 68 an den
  Aufrufen der Stärke 0x0F9D2.
- Speicherabzüge (`--dump`, `--dump-ziel`) von Vereinsmatrix, Managersatz, Kaderplätzen und
  Spielertabelle an den Punkten 54, 55, 58 und 59 grenzen die Stellen ein.
- Das Protokoll gehört **nicht** in den Historieblock (`--log 0x9840`): den füllt das neue Spiel
  danach mit 0xFF.
- Die Kaderplätze ab 75, wo es sonst liegt, liest 0x161D8 als Spielerwerte - hier ohne Folgen,
  weil keiner der dort gelesenen Spieler versetzt wird.

Der Test `Neues Spiel wie das Original` (test/newgame.test.ts) rechnet `createGame` mit Leiste 1
und den ersten Tagesbeginn und vergleicht Würfe und Stand mit `tools/dosbox/KP-NEUESSPIEL.MAN`
(gitignored, aus NG12).

Ausgenommen sind nur:
- der Dateikopf (Kennung beim Speichern);
- die Prüfsumme 56DC;
- die Öffnungszeiten der Trainingslager 4cb3:0620 (Laufzeit);
- der Monat 4238:4BCE.

## Gefunden und behoben

| Was | Stelle im Original | Wirkung im Remake vorher |
|---|---|---|
| Reihenfolge: Stammdaten, Mischen, Europapokalteilnehmer, Pokalergebnisse löschen, die drei Europapokale auslosen - alles vor dem Startbildschirm | 0x923B bis 0x930E | Europapokal nach dem Tausch der Managervereine |
| Titelträger aus dem Programmabbild: DFB-Sieger 7 | 4cb3:07AC | 0 |
| Startwerte aus dem Programmabbild: Systeme 2, Anzeigeoptionen, Tempo 40, Tabellenvorlage 64 | 4cb3:079E, 05FE, 063A, 53C7 | Werte der Vorlage |
| Kaderwerte: je Wert random(b, b+5) und random(40,60), die Form nimmt den zweiten | 0xC0A8 bis 0xC1AE | drei Würfe je Wert |
| Die Spielertabelle schreibt 0xC0A8 über den Zähler der **Wappenleiste** (-0x4 in 0x0AD44, 0..63, jeder Klick ±1): die Kaderspieler behalten ihre Poolwerte, der Spieler mit der Nummer der Leistenstellung bekommt die Werte des letzten Kaderplatzes (*Eigenheit*) | 0xC0B3, 0xC15A, 0xC171; Leiste 0xB304, 0xB4C1 | Kaderspieler überschrieben |
| Zinsen, Schwankung (10), Verteilung, DFB-Auslosung, Markt nach dem Startbildschirm | 0x942A bis 0x9482 | andere Reihenfolge |
| Verteilung 0x1643B: Spieler mit Verein nur, wenn das Jahr 4238:A7A0 gesetzt ist - beim neuen Spiel steht es auf 0: die fünf von 0x161D8 versetzten Spieler bleiben, 125 statt 130 Auswahlen | 0x164A4 | alle Spieler außer den Managerspielern |
| 0x161D8 rechnet den Wert der versetzten Spieler als Kaderplatz 25 · 4238:304A + Nummer; beim neuen Spiel ist 304A = 0, nicht die Managerzahl | 0x16307, 0x16368 | Managerzahl |
| Transfermarkt: dieselbe Erneuerung 0x245A8 wie im Tagesablauf | 0x9482 | eigene Füllung mit anderen Spielern und Stärken |
| Vereinsnamen und Spielernamen Byte für Byte aus MANA.DAT (0xDC in "STANDARD LÜTTICH") | 0x299DC | über den Zeichensatz des Remakes: 93 |
| Nach dem letzten Spieltag (0x1DC52, Tageszähler über 322): das vor den Spielen gesicherte System zurück, aufstellen, Stärke mit Flag 0 (`tagesendeAufstellen`); an allen anderen Tagen bleibt das System bis zum nächsten Spieltag manuell (TEST4 gemessen: 079E = 1 am Tagesende) | 0x1DC79 bis 0x1DCD5 | fehlte |
| Tagesbeginn: nach der Aufstellung die Stärke mit Flag 0 (ohne Würfel, ohne Moral) in die Vereinsmatrix der Managervereine, Byte 317 = 100 bei weniger als acht Spielern, sonst 0 | 0x1D7BA -> 0x0F9D2 (0xFD33 springt nach 0xFFAD) | Matrix erst mit Flag 1 vor den Spielen |

## Offen

| Was | Warum |
|---|---|
| Die übrigen Aufrufe der Stärke mit Flag 0: Verlassen von Transfermarkt 0x242C2 und Trainingslager 0x119C0 für den Manager am Zug (4238:304A); die Übersicht 0x2B61A (0x2B63F, nur im Modus 2 der Halbzeit- und Schlussseiten) für alle Manager, die sie an ihrem Ende mit Flag 1 überschreibt (0x2C10C) | behoben (#113): der Client meldet das Verlassen (`/api/verlassen`), der Server rechnet `anzeigeStaerke`; die Übersicht braucht nichts, `halbzeitStaerke` schreibt Flag 1 |
| 0x245A8 nimmt für einen versetzten Spieler den Verein aus Byte 36 ohne Grenze. Für Verein 255 liest es 4238:5244 + 25/28, einen Bereich, der im Abbild null ist und nirgends beschrieben wird | behoben (#115): das Remake behält Verein 255 und rechnet mit Stärke 0, Kondition also 10 |
| Wappenleiste | Das Remake hat keine; Vorgabe 0 schreibt in den unbenutzten Spieler 0 |
