# Spielsimulation (aus BMMAIN.EXE rekonstruiert)

Alle Spiele eines Spieltags laufen als Konferenz: Runde 0x046DB registriert
jede Paarung, die Live-Schleife 0x05404 zählt die Minuten hoch, und in den
vorab gewürfelten Chancenminuten entscheidet der Torwürfel 0x1060C.
`random(lo, hi)` (0x076B:0CC7) liefert ganze Zahlen von lo bis hi einschließlich.
Divisionen sind ganzzahlig mit Rundung zur Null (C-Semantik).

## Aktuelle Stärke eines Vereins (0x04568)

```
staerke(verein, teil, minute):
    gewichte = [[80,20,0], [25,50,25], [0,20,80]]   // teil 0 Abwehr, 1 Mittelfeld, 2 Angriff; Linie Abwehr, Mittelfeld, Angriff
    summe = 0
    für linie l in 0..2:
        te = verein.byte[27+l]
        v  = te + (10 * minute) / (-1 - te)          // Ermüdung, ganzzahlig
        v  = max(v, 0)
        v += verein.byte[30+l] + verein.byte[24+l]     // Form + Kondition
        summe += trunc(v * gewichte[teil][l] / 100)
    return summe + verein.byte[23] - 44
```

Vereinsbyte 23 liegt bei 47..53 und wirkt als Grundzuschlag.

## Chancen je Halbzeit (0x102BA, Aufruf je Halbzeit mit von/bis-Minute)

```
chancen(heim, gast, von, bis):
    TAB = [1,2,2,2,2,2,3,3,3,3,3,3,3,3,4,4,4,4,4,4]
    pick(a, b) = (random(0,1) != 0 und a < b) ? a : b
    h = random(0,1) ; g = 0
    sh = staerke(heim, 1, von) ; sg = staerke(gast, 1, von)
    d = sh/3 - sg/3
    wenn d > 0:
        k = d <= 19 ? TAB[d] : d/5
        a = random(1,k) ; b = random(1,k)
        wenn random(0,1) != 0 und d > 8: h += pick(a,b) sonst h = a
        wenn d < 25: g = random(0,2)
    sonst:
        d = -d ; k = d <= 19 ? TAB[d] : d/5
        wenn d < 25: h += random(0,2)
        a = random(1,k) ; b = random(1,k)
        wenn random(0,2) == 0 und d > 8: g += pick(a,b) sonst g = a
    g += random(0,2) ; h += random(0,3)
    solange h > 8 oder g > 8: h-- ; g--
    wenn h > 4 und random(0,1): h--
    wenn g > 4 und random(0,1): g--
    wenn (h > 2 oder g > 2) und random(0,1): h-- ; g--
    h = max(h,0) ; g = max(g,0)
    wenn sh == 0: h = 0 ; wenn sg > 20: g = 8
    wenn sg == 0: g = 0 ; wenn sh > 20: h = 8
    h = h * (bis - von) / 45 ; g = g * (bis - von) / 45
    wenn von > 90: h++ ; g++
    Chancenminuten: je Seite min(n, 8) verschiedene Minuten random(von, bis)
```

Die Live-Schleife (0x05404) wird mit den Fenstern 1..45, 46..90 und bei
Verlängerung 91..105, 106..120 aufgerufen; die Skalierung mit (bis - von)/45 = 44/45
rundet ab und nimmt jeder Seite eine Chance je Halbzeit.

## Torwürfel in einer Chancenminute (0x1060C)

```
tor(heim, gast, seite, minute, hg, gg):
    sg = (staerke(gast,2,minute) - staerke(heim,0,minute)) / 3   // Bedrohung durch Gast
    sh = (staerke(heim,2,minute) - staerke(gast,0,minute)) / 3   // Bedrohung durch Heim
    wenn seite == heim:
        wenn hg == 9 oder hg >= 19: kein Tor
        wenn random(0,4) <= 1: kein Tor          // 40 % vergeben
        t = sh
    sonst:
        wenn gg == 9 oder gg >= 19: kein Tor
        wenn random(0,1) == 0: kein Tor          // 50 % vergeben
        t = sg
    wenn t > 0:  p = t/4 + 2 ; Tor wenn random(0,p) != 0
    sonst:       p = (-t)/4  ; Tor wenn random(0,p) == 0, sonst Tor wenn random(0,6) == 0
```

Nach 90 Minuten (Verlängerung) wird bei hg < 10 nichts mehr gewürfelt (Detail offen).
Für Managervereine wird die Stärkematrix vor dem Spiel aus der Aufstellung
berechnet (docs/routines/mannschaftsstaerke.md), KI-Vereine tragen sie im
Vereinsdatensatz und sie schwankt wöchentlich.

## Abgleich mit dem Original (tools/calib/compare.ts)

Je zehn Wiederholungen des 10. Spieltags (TEST4 -> RUNA0..9, 90 Spiele) und neun des
11. Spieltags (TEST5 -> RUNB0..8, 81 Spiele) im Original gegen die TypeScript-Simulation
mit den gespeicherten Matrizen (Managerverein über den Spielweg):

| | Heim/Unent./Ausw. | Tore Heim : Gast |
|---|---|---|
| Original, 10. Spieltag | 67 / 24 / 9 % | 1,81 : 0,51 = 2,32 |
| Simulation, 10. Spieltag | 57 / 26 / 17 % | 1,48 : 0,66 = 2,14 |
| Original, 11. Spieltag | 48 / 27 / 25 % | 1,48 : 0,99 = 2,47 |
| Simulation, 11. Spieltag | 54 / 25 / 21 % | 1,58 : 0,87 = 2,45 |
| Original, beide | 58 / 25 / 17 % | 1,65 : 0,74 = 2,39 |
| Simulation, beide | 56 / 26 / 19 % | 1,53 : 0,76 = 2,29 |

Die Heimlastigkeit der ersten Serie kehrt sich in der zweiten um; über beide Serien
liegen Sieg-, Remis- und Torquoten innerhalb des statistischen Rauschens (Standardfehler
der Tore je Spiel etwa 0,1). Stärkefunktion, Chancenfunktion, Torwürfel und Live-Schleife
wurden dabei noch einmal gegen das Disassembly geprüft; die KI-Matrizen driften zwischen
Spielstand und Spieltag nur um ±2 Punkte (Wochenfunktion 0x10067: Zufallsweg innerhalb
von Bändern aus Tabelle 4cb3:05CE, Form in 45..55).
