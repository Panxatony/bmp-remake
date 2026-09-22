# Mannschaftsstärke eines Managers (0x0F9D2)

Aufruf: `staerke(manager, schreiben)`; `schreiben` = 0 nur rechnen (z.B. für
Anzeige), sonst Moral (Byte 317) und Vereinsstärke schreiben. Ergebnis landet im
Vereinsdatensatz des Managervereins: Byte 24+l Kondition, 27+l Technik,
30+l Form je Linie l (0 Abwehr, 1 Mittelfeld, 2 Angriff), jeweils Durchschnitt
der Spieler der Linie. Stand: Anzeigeweg exakt gegen drei Spielstände geprüft, Spielweg aus dem
Disassembly rekonstruiert (Zufallsanteile).

## Eingaben je Startspieler (Kaderplatz mit Nummer 1..11)

- `ko, te, fo` = Kaderplatz Byte 16, 17, 18
- `frische` = Byte 19 (50..150), `einsaetze` = Byte 6, `tore` = Byte 3
- `linie` = 7 - Byte 26 (0 = Sturm ... 7 = Tor); Gruppe l = TABELLE_2A2[linie]
  (DGROUP 0x2A2, 8 Einträge, ordnet Feldlinien den drei Gruppen zu)
- `rolle` = Byte 25 (0..6), `pos` = Spieler Byte 31 (0..99), `posArt` = Spieler Byte 32
- `stufe` = DGROUP 0x4A28 (Save-Offset 34062): die Spielstufe, **umgekehrt** gespeichert als
  5 - Level. Der Optionsbildschirm zeigt sie als "(LEVEL n)" wieder zurückgerechnet (0x265F8),
  die Auswahl beim Spielstart schreibt 5 - Wahl (0x34468). Kein Regler - bis GitLab #73 stand
  hier "Regler Einsatz, 1..7", das war falsch.
- `einsatz` = Manager Byte 305: der Regler im Kaderbildschirm, 0..34, Vorgabe 16. Er wird mit
  der Maus gezogen (x 275..309 bei y 5..35, Wert = x - 275, geklemmt bei 0x205EF, geschrieben
  bei 0x2061F).
- `moral` = Manager Byte 317 (100 = 0:2-Wertung, dann wird nicht überschrieben)

## Rechnung

```
sumKo[l] = sumTe[l] = sumFo[l] = 0 ; anzahl[l] = 0 ; malus[l] = 0 ; sumTe[l] = 8 (Startwert)
plusAbw = -9 ; plusMit = -8 ; plusAng = -5     // Zähler für Besetzung der Linien
tw = 0 ; starter = 0 ; torwartModus = 1 ; spielart = 0

für jeden Startspieler:
    starter += 1
    // Besetzung der Linien zählen
    rolle 1 oder 5: tw += 1 ; rolle 0 oder 6: tw += 2
    linie >= 3: plusAbw += 2, sonst siehe unten
    linie == 3 (Mittelfeld):
        plusAbw += 1, plusMit += 1
        rolle 2..4 und positionFit(spieler) < 2 und te - 10 > ko: sumTe[l] += 15
    linie 4..5: plusMit += 2 ; linie == 6: plusMit += 1, plusAng += 1 ; linie 7: plusAng += 2
    linie == 1 und rolle == 3 und positionFit < 2 und te - 10 > ko: sumTe[l] += 15
    linie == 0 und rolle == 3: torwartModus = (pos / 25 == 0) ? 0 : 2   // Torwart im Sturm?
    // Fehlbesetzung
    positionFit(spieler) > 2      -> malus[l] += random(2, 6)
    abstandZurLinie(spieler) > 25 -> malus[l] += random(2, 6)
    // Summen
    koMinusTe += ko - te        (0x0FB1F, einzige Schreibstelle von -0x26)
    sumKo[l] += ko + einsaetze/6 - frische/20 + 3
    sumTe[l] += te + tore - 1   (plus obige Zuschläge von 15)
    sumFo[l] += fo
    anzahl[l] += 1

// Einsatzregler wirkt auf den Malus
für l in 0..2: sumTe[l] += (stufe - 5) * malus[l] * 20 / 100
starter == 0: alle Summen 0
moral = (starter < 8) ? 100 : 0   -> Manager Byte 317, in jeder Rechnung (starter = Nummer 1..11,
                                     ohne Blick auf Sperre oder Verletzung)
weniger als 11 Starter: fehlende Plätze zählen reihum als Linie mit
stufe == 0 und tw > 8: sumTe[2] += -100 * W   (0x0FD4E; W = Wort -0x2A, das die Routine nie
                                                beschreibt: Stapelrest, nicht nachbildbar, entfällt)
torwartModus > 0: k = torwartModus - 1
    sumTe[0]  *= random(10k+5, 20k+5) / 100
    sumTe[1]  *= random(10, 40) / 100
    sumKo[0]  *= random(5(k+2), 30k+20) / 100
sumTe[0], sumTe[1], sumKo[0] auf 0..32000 begrenzen (nur diese drei, 0x0FDEE..0x0FE16)
// Besetzungsprüfung
plusMit < 1:
    plusAbw > 0: plusAng += plusMit - 1
    plusAng > 0: plusAbw += plusMit - 1
plusAbw < -1 und random(7,10) > plusAbw + 10: plusMit -= random(3,5)
für l in 0..2:
    sumTe[l] += stufe
    sumKo[l] != 0: sumKo[l] += einsatz - 16
    sumTe[l] != 0 und stufe < 4:
        sumTe[l] += (plus[l] * anzahl[l] + 3 * wechsel[manager]) * 10   (4238:90C6)
        sumKo[l] += 5 * (plus[l] * anzahl[l])
    negative Summen auf 0
z = clamp(koMinusTe / 9, -4, 4) ; z < 0: 0
neueMoral = clamp(z + einsatz, 0, 40) -> Manager Byte 317 (wenn dort nicht 100 steht)
// Ergebnis in den Vereinsdatensatz
für l in 0..2:
    anzahl[l] <= 1: ko = te = fo = 0
    sonst: verein.byte[24+l] = sumKo[l] / anzahl[l]
           verein.byte[27+l] = sumTe[l] / anzahl[l]
           verein.byte[30+l] = sumFo[l] / anzahl[l]
```

## Hilfsfunktionen

- `positionFit(manager, platz)` (0x04CD7) = |Spieler Byte 32 - Kaderplatz Byte 25| (Rolle gegen Positionsart)
- `abstandZurLinie(manager, platz)` (0x04DD3) = |Spieler Byte 31 - ((7 - Kaderplatz Byte 26) * 75 / 7 + 5)|
- `clamp(ptr, lo, hi)` (0x31919), `abs(a, b)` (0x319E5)

## Zwei Rechenwege (Schreibflag)

Mit `schreiben = 0` (Aufruf aus den Bildschirmen) überspringt die Funktion
in der Spielerschleife alles außer den reinen Summen (Sprung 0xFBE4 -> 0xFB5B)
und nach der Schleife den ganzen Teil von 0xFD3C bis 0xFFAD (Torwart, Besetzung,
Spielstufe, Einsatzregler). Geschrieben wird die Matrix trotzdem:

```
Anzeige: ko = sum(ko)/n ; te = (8 + sum(te))/n ; fo = sum(fo)/n
```

Abgleich: TEST1, TEST2 und RIED-CLI enthalten genau diese Anzeigewerte
(Nürnberg Ko 84/90/62 bzw. 61, Te 89/76/95, Fo 56/54/54). Die Spielwerte
(Flag 1, mit Frische, Einsätzen, Toren, Fehlbesetzung, Einsatzregler und
Einsatzregler) stehen nie im Spielstand, weil danach wieder ein Anzeigeaufruf
folgt; sie lassen sich nur über wiederholte Spieltage statistisch prüfen.
Die Tabelle 4238:90C6 (je Manager ein Byte, nur zur Laufzeit) zählt die Auswechslungen im
Spiel (0x20E86). Zurückgesetzt wird sie im Tagesablauf erst **nach** der Stärkerechnung vor dem
Spiel (0x1D7FF, dann 0x1D838): die Anfangsstärke rechnet mit den Wechseln des vorigen Spiels,
Neuberechnungen im Spiel mit denen des laufenden. Der Server führt sie in `Room.letzteWechsel`
bzw. `LiveState.subs` (nach einem Neustart 0, wie das Original nach dem Laden).

## Unsicher

Die Zuordnung, welche Zuschläge auf `sumKo` und welche auf `sumTe` gehen,
folgt den Speicheroffsets -0x1E (Ko) und -0x18 (Te), kann aber vertauscht
sein. Die Rolle der Variablen `torwartModus` und die Divisionen durch 100
über Gleitkomma sind aus dem Code, die Bedeutung der Tabelle 0x6F3A ist offen.
Prüfung gegen die Anzeige "Stärken Bundesliga" (Nürnberg 78 86 54) steht aus.
