# Audit 2, Gruppe B, Teil 1: 0x0971F, 0x094B2, 0x0A7DD

## Tabelle

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x0971F | Hauptmenü, also der Zug eines Managers: Autosave (5256), 5358 = 304A, je Liga Tabellenabschluss 0x2B4F3/0x2D143(L,1,1), Kopfzeile mit Ereignistext, 513E/56EE, Nummern der Bank, **Aufstellung 0x22030 bei jedem Aufbau**, Tabellenkurve, Meldungsmerker 56E2, Kalendermeldungen 0x143ED, Untermenüs mit Sperren (Lager bei Byte 313, Jahr 1964/1993, 4 Manager) | web/main.ts: drawMenu, drawMenuHeader, dayEvent, drawTabellenkurve; server.ts: zugBeenden; core/sim/lineup.ts: sperreAusgesetzt | Befunde T1a, T1b, T1c, T1d; der Rest stimmt, ist bewusst (Autosave und Speichern, 56EE immer 15) oder gehört zu U1 |
| 0x094B2 | Mausklicks im Hauptmenü: Klick aufs Kalenderblatt beendet den Zug (Rückgabe 1), versteckter Autoplay-Schalter (0,0)/(1,1) mit 063A = 0x47, Klick in den Kopf (y < 44) zeigt die Credits 0xF749 (Rückgabe 2), Klick in die Mitte ohne offenes Untermenü öffnet die Meldungsliste 0x30ED4 | main.ts: drawMenuHeader, `hit(244,46,70,60)` → finishTurn | stimmt grob (Bedienung). Der Kalenderbereich ist im Original x 243..305, y 50..101, im Remake x 244..313, y 46..105. Autoplay und Credits sind bewusst weggelassen (ABWEICHUNGEN) |
| 0x0A7DD | Rückfrage "Möchten Sie das Spiel wirklich beenden ?" über 0x31D7C, bei Ja exit(99) | main.ts: drawEndeDialog; core/sim/ki.ts | bewusst (ABWEICHUNGEN "Aufhören") |

Geprüft und ohne Befund in 0x0971F:
- 0x9755 / 0xA649 / 0xA7C4: 4238:5358 = 304A, nach jedem Untermenü zurück. Im Remake gegenstandslos.
- 0x9A01-0x9A25: 56EE = 15 - 2·(224E = 4). Die historischen Startjahre gibt es im Remake nicht, darum ist 56EE immer 15 (bewusst). Die Umnummerierung der Bank 0x9C53-0x9D44 (16 → 15, alles > 15 → 0) läuft damit im Remake ins Leere, weil keine Nummer über 15 vorkommt.
- 0x9A73-0x9C46, Zweige A, B und C: Ligatag über Bit (Managerbyte 312) im Kalenderbyte 4cb3:2280[016E] mit dem Text "225A[Liga]. Spieltag"; der DFB-Pokal mit di = 8 und Managerbyte 306 = 4238:0008 setzt 513E = 1. Im Remake stimmen `sperreAusgesetzt` und der Spieltagstext (`nextMatchday` = 28432 = 225A).
- 0xA1C5-0xA222 / 0xA349-0xA3A9, gesperrte Knöpfe: das Trainingslager bei Managerbyte 313 ≠ 0 stimmt (main.ts:3417). Knopf 6 der Gruppe 1 ist bei 513C = 1964/1993 gesperrt; das Remake schreibt 513C = 22251, dort also nie gesperrt. "Neues Spiel" bei 07AB = 4 fällt im Mehrspielerbetrieb weg.
- 0x9F97: 56E2[Manager] (gesetzt in 0x30E2F, wenn eine Meldung ohne sofortige Anzeige eingeht) öffnet die Meldungsliste; das Remake zeigt die Meldungen zu Zugbeginn im Hauptmenü (main.ts:3394). Das ist nur Anzeige.
- 0x9FD5: 0x143ED einmal je Zug und nach dem Laden (0xA75A). Das Remake legt die Hinweise je Tag ab (SPIELMECHANIK "Kalendermeldungen"), stimmt.
- 0xA643: 0x4290(0) stellt das Datum aus 07DC wieder her (anzeigen.md, Eigenheit), gegenstandslos.

## Befunde

### T1a (S): 513E = 1 auch an Europapokaltagen, das Remake kennt nur den DFB-Pokal

- Original 0x9B88-0x9C0A: Zweig D des Kopftexts, erreicht, wenn weder der Ligazweig noch der DFB-Zweig noch die Relegation greift:
  `movw $0x0,-0x150(%bp)`, Schleife k = 1..3 mit `mov %es:0x8(%bx),%al` (4238:0008+k, die laufende Runde) und `cmp %cl,%es:0x2374(%bx)` (Managerbyte 306+k), bei Gleichheit `movw $0x1,-0x150(%bp)`. Danach `cmpw $0x0,-0x150(%bp); je`, `test $0x70,%di; je`, `cmp $0x10,%di; je` und dann der Text "Europapokal", `movb $0xf,%es:0x56ee` und `jmp 0x9b2d`, also `movb $0x1,%es:0x513e`.
- Remake core/sim/lineup.ts:234-237: `sperreAusgesetzt` gibt nur bei `calendarFlag === FLAG_CUP` (8) und `u8(306) === plain[28233]` true zurück. Europapokaltage (Kalenderbyte 0x70) liefern immer false.
- Folge: An jedem der zehn Europapokaltage stellt die Automatik 0x22305 im Original gesperrte Spieler auf, wenn der Verein in einem der drei Europapokale in der laufenden Runde steht. Im Remake fehlen sie (Kauf und Systemwahl in server.ts:3282/3303, der gemerkte Wert `sperre513E` in server.ts:1143). Auch die Kaderliste im Client (`einsatzFlag`, main.ts:4963) zeigt dann fälschlich "GESP.".
- Sicher, weil die Zweigfolge eindeutig ist: 0x9B37 und 0x9C0A laufen beide über 0x9B2D. 22030.md, Befund A2, beschreibt nur den DFB-Zweig 0x9AE8-0x9B31.

### T1b (S): Das Hauptmenü stellt bei jedem Aufbau neu auf (0x9D46), das Remake nicht

- Original 0x9D46: `lcall $0x1ecd,$0x3360` (0x22030, die Aufstellungsautomatik) steht ohne Bedingung im Aufbau des Hauptmenüs ab 0x97DC. Dorthin springt das Programm beim Zugbeginn, nach jedem Untermenü (0xA659 `jmp 0x97dc`), bei Rückgabe 2 von 0x94B2 (0xA077, 0xA4AC) und nach "Neues Spiel" (0xA7D4 → 0xA5E1 → 0xA659). Ausgewertet wird dabei der unmittelbar vorher gesetzte 513E dieses Managers (0x99FC, 0x9B31). 0x22030 löscht Byte 10 der Plätze 0..23 und stellt neu auf (22030.md). Die Aufstellung vom Tagesbeginn (0x1D797) wird damit im Zug jedes Managers mit Automatik überschrieben.
- Remake: server.ts:1333-1339 stellt nur am Tagesbeginn auf, mit `r.sperre513E`, dem Wert des letzten Managers vom Vortag. `zugBeenden` (server.ts:1141-1148) und der Zugbeginn stellen nicht neu auf, das tun nur einzelne Aktionen (Kauf, Systemwahl, server.ts:2802/3024/3057/3282/3303). Der Vergleichslauf originaltag.ts:95-122 bildet das Hauptmenü ebenfalls nur mit den Autosave-Würfen nach, ohne 0x22030.
- Folge für Manager mit Automatik (System ≠ manuell):
  - Pokaltag, der Verein ist dabei: im Original spielen gesperrte Spieler (513E = 1). Im Remake nur dann, wenn zufällig der letzte Manager des Vortags 513E = 1 hatte.
  - Ligatag nach einem Pokaltag, an dem der letzte Manager dabei war: `sperre513E` ist true, das Remake stellt am Tagesbeginn gesperrte Spieler auf und behält die Aufstellung für das Ligaspiel. Das Original stellt im Hauptmenü mit 513E = 0 neu auf.
  - Jede andere Änderung im Zug ohne eigenen Aufstellungsaufruf im Remake.
- Der am Tagesbeginn gemerkte Wert (#114) wirkt im Original praktisch nie, weil an Zugtagen jeder Manager das Hauptmenü durchläuft.

### T1c (A): Ereignistext im Kopf des Hauptmenüs weicht ab

- Original 0x9A29-0x9C46, Reihenfolge:
  1. Argument 0xFF (Saisonendschleife 0x1E077 `mov $0xff,%al; push; lcall $0x8bc,$0xb5f`) oder Datum 2EBA = 20 + 224C und Monat 2E8E = 5 ergibt "SAISONENDE" (4cb3:25B8).
  2. Ligabit ergibt "n. Spieltag".
  3. DFB (di = 8, Byte 306 = 4238:0008) ergibt "DFB-Pokal".
  4. Verein = 4238:5369 oder 5370 (Bundesliga Platz 16, 2. Liga Platz 3) und di = 0x10 ergibt "Relegation" (25C4).
  5. Europapokal (Byte 306+k = 4238:0008+k, di & 0x70, di ≠ 0x10) ergibt "Europapokal".
  6. 0x310A und di & 0x80 ergibt "Nachholspiel", sonst "Spielfrei".
- Remake main.ts:3253-3271 `dayEvent`:
  - `dabei(cup)` = Runde 1..7 statt Runde = laufende Runde. Der Verlierer behält aber seine Runde (europa.ts:53, `setManagerRound` nur für Sieger). Ausgeschiedene Manager sehen darum an späteren Pokaltagen "DFB-Pokal" bzw. "Europapokal" statt "Spielfrei".
  - `flag & (8 << 1)` prüft 0x10, also den Relegationstag, als Europapokal 1: wer in der Saison im Landesmeisterpokal war (Byte 307 in 1..7), sieht an den Relegationstagen "Europapokal". "Relegation" für die beiden Relegationsvereine fehlt ganz.
  - "SAISONENDE" fehlt: im Saisonendzug steht "Spielfrei".

### T1d (A): Flacher Strich der Tabellenkurve unter falscher Bedingung

- Original: 0x9860 `cmpb $0x1,-0x156(%bp); jle` setzt bei höchstens einem Spiel nur den Startpunkt auf y = 0x4A und die Schrittweite auf 116.0 (DS:0x9A2C). Die Schleife zieht dann kein Stück. Ob der flache Strich kommt, entscheidet 0x9F1B-0x9F2F: `cmpw $0x0,%es:0x7de ... cmpw $0x1,%es:0x7dc; jbe 0x9f63`, also nur bei Saisontag 4cb3:07DC ≤ 1 (Farbe 7). Sonst zieht 0x9F31 die Schlusslinie in Farbe 11 von (63, 74) nach (177, Managerbyte 268 + 65).
- Remake main.ts:3224-3227: bei `spiele <= 1` flacher Strich in Farbe 7 (#303051) und Ende.
- Folge: Vor dem zweiten Spiel der Saison zeigt das Original eine schräge Linie in Farbe 11, das Remake einen flachen grauen Strich. Die Beschreibung im Kommentar (main.ts:3169-3170) stimmt insoweit nicht.

## Unklar

- U1: Tabellenabschluss 0x979B-0x97DA. Für jede Liga mit 225A[L] < 2262[L] ruft das Hauptmenü 0x2B4F3(L, 225A) und 0x2D143(L, 1, 1) auf. Mit Argument 2 = 1 kopiert 0x2D143 je gespieltem Paar die laufenden Tabellenbytes in den Spiegel (0x2C304(Verein, 0, 2): Bytes 0/1 → 2/3, 22/23 → 24/25 usw., Formstring) und sortiert neu (Platz, Managerbyte 267+Spieltag). Die Buchung (Argument 2 = 0) holt vorher den Spiegel zurück (0x2C304(Verein, 2, 0)) und bucht darauf. Das Remake spiegelt in `applyResult` sofort (standings.ts:35-56), die Buchung addiert auf den laufenden Stand. Gleich ist das, solange ein Verein zwischen zwei Hauptmenüs nur einmal gebucht wird. Zur Klärung fehlt, ob an einem Tag ein Nachholspiel (Buchung 0x5C09/0x5C68) und ein regulärer Spieltag denselben Verein buchen können. Dann würde das Original das erste Ergebnis beim zweiten Zurückholen verwerfen. Das gehört zum Bereich 0x2D143/0x5403.
- Die Schrittweite der Kurve rechnet das Original in float32 (fdivr, fstp dword), das Remake in double. An Grenzfällen kann ein Knick ein Pixel versetzt sein. Nicht nachgemessen.
