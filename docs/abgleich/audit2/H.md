# Audit 2, Gruppe H: 0x3074A bis Ende (ohne Segmente 35ac/3930/3a01)

Stand 26.9.2026. Grundlage sind die Disassembly (all.s), das Remake (bmp-remake, nur gelesen) und die
Spielstände in ~/bmp-spiel. Außerdem die Zweigbücher restroutinen.md, anzeigen.md (Teil 2),
zeitung.md und 0CB62.md.

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x3074A (0x3075D, 0x3089B) | Sportzeitung je Manager mit Merker 4238:1D14: Spielnote jedes Starters (Nr. 1..11, Plätze 0..Anzahl-1 aus 0x31A19) in 4238:4D3C, dann 0x2F243, wenn arg = 0 (Ligatag). Vorher: Kaderbyte 13 = 100 wird zu 1 mit Byte 9 \|= 1 (0x3077E) | originaltag.ts/`zeitungen`, zeitung.ts/`spielnoten` | stimmt (Formel, Rundung und Grenzen nachgerechnet; 0x4CD7 = `positionFit`, 0x4DD3 = `lineDist`, 0x319E5 = \|a-b\|). Zum Zweig mit Byte 13 = 100 siehe unklar U1 |
| 0x30910 | freien Ablaufplatz (4238:1D34, 10 je Manager) suchen, 0x7F wenn voll | fehlt | bewusst (ABWEICHUNGEN "Lebensdauer der Meldungen") |
| 0x30954 | Meldung nach Zeiger löschen, nachrücken, Zähler 0618[m]-- | eigene Meldungsliste | bewusst (ABWEICHUNGEN "Meldungen", 0DF0D.md C) |
| 0x30AA0 | Meldung anlegen: Datum = heute − **random(0,3)** Tage (Monats-/Jahreswechsel über 4cb3:07B8), "T. Monat Jahr^" + Vorlage mit `$` (Text) und `#` (Zahl, 07B2 = 1, ohne Tausenderpunkte), neue Meldung auf Platz 0, 0618[m]++; mit arg = 1 sofort anzeigen (0x30ED4), sonst Merker 4238:56E2[m] = 1 | server.ts/`pushMessage`, tagesroutine.ts/`meldungsWurf` | Format stimmt. **Befunde H1, H2, H3**: an zwei Aufrufstellen fehlt der Wurf |
| 0x30E42 | alle Meldungstexte freigeben (beim Laden) | - | nicht nötig (Speicher) |
| 0x30ED4 | Meldungskasten, 3 je Seite, "Keine Nachricht vorhanden." (schreibt keinen Spielstand) | web `drawMeldungen` | stimmt (R14 behoben) |
| 0x3142B | Zahl mit Währungspunkt (nur bei 224E ≠ 1) | Stadionbildschirm | nicht nötig (Anzeige, DM 1:1) |
| 0x314B5 | Drehfeld | Stadionbildschirm | nicht nötig (Bedienung) |
| 0x3174A | Hinweiskasten: 4 Zeilen mittig 60..245 bei y 123/133/143/153, OKAY bei (178,160) | main.ts Hinweiskasten | stimmt (grob) |
| 0x31919 | i16 auf [lo,hi] begrenzen | `Math.max/min` | stimmt |
| 0x31943 | i8 begrenzen | - | toter Code |
| 0x3196D | strcpy in Großschreibung: a..z, 0x81→0x9A, 0x84→0x8E, 0x94→0x99 (vorzeichenbehafteter Vergleich, ß bleibt) | gfx.ts/`upperGame` (auf Spielzeichensatz) | stimmt |
| 0x319E5 | \|a−b\| (32 Bit) | `Math.abs` | stimmt |
| 0x31A19 | Kaderzahl: n = 24 (Markt 12); Modus 0 Byte 15 ≠ 0, Modus 1 Nr. 1..11, Modus 2 Nr. > 11 | records.ts `squadOf().length`, transfer.ts | stimmt (Platz 24 wird nie belegt) |
| 0x31ADC | Treffertest der Knöpfe | `hit()` | nicht nötig (Bedienung) |
| 0x31B4D | Knopf zeichnen | main.ts | nicht nötig (Grafik) |
| 0x31D7C | Ja/Nein-Dialog | eigene Dialoge | stimmt (restroutinen.md) |
| 0x32032 | Knopf drücken | - | nicht nötig (Bedienung) |
| 0x320C7 | Kaderplatz eines Spielers (Manager 0..Anzahl-1 und 4, Plätze 0..Kaderzahl-1) | seasonEvents.ts/`fundort` | stimmt (R15) |
| 0x3216C | Managerkopf neu zeichnen, 0x322B6 Diskettenfehler | `gesichtSpalte` | nicht nötig (Grafik) |
| 0x322F7 | Block verschlüsseln (c = (k ^ p) + k, k += 0xD7, Prüfsumme += p), schreiben, im Speicher zurückentschlüsseln | cipher.ts `encrypt` | stimmt |
| 0x323EF | Block lesen und entschlüsseln | cipher.ts `decrypt` | stimmt |
| 0x32480 | Namensliste eines Vereins in MANA | newgame.ts/`manaListOf` | stimmt (anzeigen.md) |
| 0x324DE | Zufallsname: random(tab[g], tab[g+1]−1), Verein random(0,17) ohne Managerverein, ohne Doppelte; arg 0xA unbenutzt | newgame.ts/`randomName` | stimmt |
| 0x3260C | Spielerpool beim neuen Spiel: 150 × (Alter r(18,33), s = r(30,89), bei s < 45 und r(0,1) ≠ 0 neu, B29 = s − r(0,20) + 10, B30 = r(45,55), B28 = s − r(0,20) + 10, B27 = Schnitt, B32 = r(0,6), B33 = 5); je Manager die Gruppen 2/5/8/5 (4cb3:9438) ab 07A7−Rest+1, Name aus MANA sonst 0x324DE, Alter r(19,31), 0x224A8, B36 = Verein; Namen der Übrigen (Gruppengrenzen 20/64/106/151), B36 = 0xFF wegen 513C > 2000; Positionswert 0 / 25/50/75 + r(0,16) | newgame.ts/`buildPlayerPool` | stimmt (Würfelreihenfolge und Tabellen gegen das Abbild geprüft) |
| 0x32AAE | Spielstand speichern: Kennung = r(0,0x8FFF) + r(0,0x8FFF)·65536 + 1 (Wiederladeliste 4238:A6D8, 50 Plätze), Schlüssel = r(0,255) + 0x78, ein Füllbyte r(0,255), dann alle Blöcke, Meldungen (Zeiger, Länge = strlen+1, Text), Prüfsumme 2, Schluss 4cb3:05F6, 4238:2E7A, 4238:2E94 | savefile.ts `encode`; originaltag.ts (Würfe) | Format stimmt. Speichern ohne Würfel ist bewusst (ABWEICHUNGEN "Speichern"); **H4** zur automatischen Speicherung |
| 0x334BC | Spielstand laden: Wiederladesperre, Blöcke, Meldungen neu anlegen und Zeiger in Kaderplätzen (nur Plätze < Kaderzahl) und Ablaufliste umhängen, Prüfsumme 2, Schluss; danach 4238:4BEC[0..3] = 0, Managerbyte 29 = m+1 wenn 0 | savefile.ts `decode`, server `roomFromSave` (`msgFlags = []`) | bewusst (ABWEICHUNGEN "Laden", R16) |
| 0x34474 | Bestenliste lesen/schreiben: Name "HIGH." + Auswahl (0; 1 bei 1964/1993; 3 bei 1966/1995) + ('5' − 4cb3:4A28); gibt die Auswahl zurück | highscore.ts/`highscoreFile` | **Befund H7** |
| 0x34616 | Bestenliste: arg 0 nur zeigen, arg 1 zeigen mit vorläufigem Eintrag des ziehenden Managers und danach Aufruf mit 2, arg 2 Eintrag bilden (0x34CDA), einordnen, sortieren, Datei schreiben | highscore.ts/`insertHighscore`, main.ts/`drawHighscore` | **Befund H6** |
| 0x34B14 | Platzierungspunkte | highscore.ts/`placementPoints` | **Befund H5** |
| 0x34CDA | Eintrag: Punkte = 0x34B14 (16 Bit) + (Σ Marktwert der Plätze < Kaderzahl + 135000·Stadionwert + Konto − Kredite)/80000 + 40·M + 20·D + 60·E − 500, +300 bei arg = 0, mindestens 1 | highscore.ts/`highscoreEntry` | stimmt (0x24D4E rechnet mit 4238:304A; beide Aufrufer übergeben 304A) |
| 0x34E6E | Dateiauswahl | `/api/saves` | nicht nötig (Datei/System) |

32 Routinen.

## Befunde

### H1 (S): Fertiger Stadionausbau ohne den Meldungswurf random(0,3), falsche Wurfreihenfolge im Server

- Original: 0x11D0D ruft zuerst 0x020E1 auf (0x11D1E), erst danach kommen der Lagerwurf (0x11D59) und
  der Bankwurf (0x11DA9). Ist ein Bauwerk fertig, geht 0x020E1 immer durch die Meldungsroutine:
  entweder direkt mit `lcall $0x3091,$0x190` (0x022E2, arg 1) oder über `call 0x239e` (0x02346), und
  0x0239E ruft bei 0x023F3 selbst 0x30AA0 auf. 0x30AA0 würfelt bei 0x30B0A
  `push 3; push 0; lcall $0x76b,$0xcc7`, also random(0,3), und datiert die Meldung damit zurück.
- Remake: server.ts:1749-1759 (`finanzTag`) macht erst `advanceCampOpen` und `rng(0,60)`, dann
  `dailyConstruction`, und würfelt dabei nichts. Das Datum ist `dt`, ohne Rückdatierung.
- Der Vergleichslauf originaltag.ts:87/243/610 würfelt richtig (`for (const _ of dailyConstruction(g, m)) rng(0, 3);`
  vor den Lagern). Nur der Server weicht ab: Jedes Mal, wenn ein Ausbau fertig wird, verschiebt
  sich der Zufallsstrom um einen Wurf.
- Dazu D: docs/SPIELMECHANIK.md:363 nennt "Bau (0x020E1, ohne Würfel)". Das ist falsch, weil der Wurf in
  der Meldungsroutine steckt.

### H2 (S): Karriereende am Saisonwechsel ohne den Meldungswurf

- Original 0x0D52D-0x0D5B8: Bei einem Kaderspieler mit Byte 11 = 0 und Byte 24 Bit 7 folgt
  0x0D55E `lcall $0x3091,$0x190` (Vorlage 3, arg 0). Damit gibt es **random(0,3)**, bevor
  0x1FDBE (0x0D5A4) den Spieler entfernt und die Würfe der Neubelegung (0x0D5C6 ff.) kommen. Die
  Meldung wird sofort angezeigt (0x0D576 `lcall $0x3091,$0x5c4` = 0x30ED4) und gleich wieder gelöscht
  (0x0D588 `lcall $0x3091,$0x44` = 0x30954, Rückgabe 0 in Kaderbyte 48).
- Remake: seasonEvents.ts:278-284 ruft `removeFromSquad` und `neuBelegen` auf, ohne vorher `rng(0,3)`
  zu würfeln. Jeder Rücktritt verschiebt so die Würfe der restlichen Saisonwechselschleife.
- Dazu A: server.ts:1300 legt die Meldung dauerhaft in die Meldungsliste. Im Original ist sie ein
  einmaliger Meldungskasten und steht danach nicht mehr in der Liste und nicht im Spielstand.
  SPIELMECHANIK.md:2008 ("✔ seit #58") beschreibt das nicht.

### H3 (A): Meldungen der Tagesroutine: Datum und Reihenfolge

- Die Trainingsverletzung würfelt zwar ihren Rückversatz (tagesroutine.ts:52,
  `verletzt.push({ place, zurueck: meldung() })`), `t.verletzt` wird aber nirgends gelesen.
  server.ts:2078 meldet die Verletzung über den Vergleich der Bits vorher/nachher mit dem
  Tagesdatum, ohne `datum(zurueck)`. Im Original geht sie durch 0x0239E und 0x30AA0 (0x0E762) und
  hat das Datum heute − r.
- Reihenfolge: 0x30AA0 setzt jede neue Meldung auf Platz 0, also in Aufrufreihenfolge. Die ist
  Marktinteresse (0x0E1CD), Krawall (0x0E43C), Komfort (0x0E530), dann **je Kaderplatz**
  Verletzung (0x0E762), Karriereankündigung (0x0E7F0) und Verlängerungsangebot (0x0E9C1), zuletzt
  Kaderinteresse (0x0EA61). server.ts:2047-2079 legt die Meldungen dagegen nach Art gebündelt an:
  Stadion, alle Transfers (Markt und Kader zusammen), Karriereende, Angebote und die Verletzungen
  zuletzt. Bei mehreren Meldungen am selben Tag stehen sie deshalb anders in der Liste.

### H4 (S, im Server nicht nachgebaut): Automatische Speicherung würfelt viermal

- Original: 0x11E3D setzt am Monatsletzten mit Monat % 4 = 0 die Marke 4cb3:5256. Das nächste
  Hauptmenü speichert dann über 0x9744 und 0x32AAE. Dabei würfelt 0x32AAE bei 0x32C9B und 0x32CAB je
  random(0,0x8FFF), bei 0x32D4B random(0,255) für den Schlüssel und bei 0x32D6B random(0,255) für das
  Füllbyte. Alles läuft im Spielstrom.
- Remake: nur originaltag.ts:118-121 würfelt so. server.ts hat keinen Autosave und keine Würfe dafür.
  Im Januar, Mai und September verschiebt sich der Strom deshalb um vier Würfe gegenüber dem
  Original.
- SPIELMECHANIK.md:369 hält fest: "Der Server speichert selbst und bildet das nicht nach". In
  ABWEICHUNGEN.md steht das nicht; dort steht nur das manuelle Speichern. Entweder gehört es dort
  eingetragen oder in den Server eingebaut.

### H5 (A, Bestenliste): Platzierungspunkte 0x34B14: Europapokal-Zuschlag und Saisonzahl

- Original 0x34C85-0x34CA9 liest das Pokalbyte des Verlaufs (Byte 64+4i). Ist Bit 7 gesetzt, kommt
  +20 dazu und es geht nach 0x34C05, wo `test $0xfff8` auf das volle Byte **anschlägt**. Sonst
  macht 0x34BF3 `andb $0x7,-0x8(%bp)` und rechnet +2·(b&7). Danach schlägt `test $0xfff8` auf das
  **maskierte** Byte nie an. Den Europapokal-Zuschlag (25 bei Europabyte Bit 7, sonst 3·(e&7)) gibt
  es also nur mit DFB-Siegerbit.
- Remake highscore.ts:57-62 prüft `lg & 0xf8` auf dem ungekappten Byte. Wer aus dem DFB-Pokal
  ausgeschieden ist, hat das Byte 30 + 1 = 31 (season.ts:90). Das Remake gibt dann trotzdem den
  Europapokal-Zuschlag, das Original nicht. Das betrifft jede Saison, in der ein Manager im
  Europapokal spielte und im DFB-Pokal ausschied.
- Randfall: Das Original zählt i < min(4cb3:07E2, 50) (0x34BDA), das Remake bis zum ersten Rang 0
  (highscore.ts:54). Außerdem teilt das Original (58 − Rang)/2 mit Rundung gegen null
  (`cwtd; sub %dx,%ax; sar`), das Remake mit `>> 1`. Beides wirkt nur bei Rangbytes 0xFF. Die gibt es,
  denn SERVER.MAN hat 50 × 0xFF bei 5 Saisons: Das Remake zählt dort 50 Saisons, das Original 5.

### H6 (A, Bestenliste): Einordnen in 0x34616

1. Gleicher Name und gleicher Verein ersetzen den Eintrag **ohne Punktevergleich**. Bei 0x347CB und
   0x347E8 zeigen beide strcmp auf 0, dann folgt `je 0x34817` mit memcpy. Genauso macht es 0x1E7FF im
   Spielende-Zweig. Remake highscore.ts:138 ersetzt nur bei `out[same].points < e.points`.
2. Sortiert wird mit einer Tausch-Auswahlsortierung (0x346F0-0x34787, Tausch bei `>`). Die ist nicht
   stabil: Aus [3a, 3b, 5] wird [5, 3b, 3a]. Das Remake sortiert stabil (`out.sort`, Zeile 144), bei
   gleicher Punktzahl steht die Reihenfolge also anders.
3. In die Bytes 54..57 schreibt das Original 4cb3:0668 (0x34842). Beim Zeichnen wird ein Eintrag mit
   diesem Wert (oder, bei Auswahl ≠ 0, der gerade eingefügte) in Farbe 3 statt 1 hervorgehoben
   (0x3492C-0x3495C). `encodeHighscore` schreibt dort 0, `drawHighscore` hebt nichts hervor.
4. Das Hauptmenü öffnet die Bestenliste mit arg 1 (0x0A78C). Dann zeigt das Original den
   ziehenden Manager vorläufig an seinem Platz (0x34A9E-0x34ACF) und ruft danach bei Auswahl 0
   0x34616(2) auf (0x34AF5). Damit wird sein aktueller Punktestand in die Datei geschrieben, wegen
   Punkt 1 auch nach unten. Das Remake schreibt nur am Saisonende.

### H7 (A und D): Dateiname der Bestenliste

- Original 0x3449D-0x344E0: 4cb3:94A2 = 0x35 − 4cb3:4A28 ist die Stufenziffer, 4cb3:94A1 = '0' +
  Auswahl (1 bei 1964/1993, 3 bei 1966/1995, sonst 0). "HIGH.02" heißt also "normales Startjahr,
  gespeicherte Stufe 3", und das haben alle Stände in ~/bmp-spiel. Je Spielstufe gibt es eine
  eigene Liste HIGH.01..HIGH.04.
- Remake highscore.ts:28-32 (`highscoreFile`) wählt nur nach dem Startjahr (HIGH.00/01/02). Ein Spiel
  auf einer anderen Stufe schreibt deshalb in HIGH.02 statt in HIGH.0(5−Stufe). Die +300 hängen am
  Rückgabewert 0, also am normalen Startjahr, und stimmen im Ergebnis.
- D: SPIELMECHANIK.md:1498-1499 ("Startjahr 1964/1993: HIGH.00, 1966/1995: HIGH.01, sonst HIGH.02")
  und der Kommentar in highscore.ts:28 sind falsch. Auch "Beim Saisonwechsel (0x1E871)" stimmt nicht:
  0x1E871 ist der Spielende-Zweig (arg 1, **ohne** +300, nur wenn 4238:513C = Jahr). Am
  gewöhnlichen Saisonende läuft 0x1E8D6, das 0x34616(2) je Manager aufruft (mit +300).

## Unklar

- **U1 (0x3077E):** Vor der Note macht 0x3074A aus Kaderbyte 13 = 100 den Wert 1 und setzt Byte 9
  Bit 0 (Sperre von einem Spiel). Das läuft auch an Pokaltagen (arg ≠ 0). Im Remake fehlt das. Eine
  Stelle im Code, die 100 in Byte 13 schreibt, habe ich nicht gefunden: gesucht nach direkten
  Schreibzugriffen auf +0xD und 0x7757 sowie nach `$0x64`. Byte 13 kommt aber auch als Kopie aus dem
  Markt (0x23F29). Offen ist, ob Originalstände oder der Editor 100 enthalten. Zur Klärung Byte 13
  aller Kaderplätze in Originalständen auf 100 prüfen.
- **U2:** Welchen Wert 4cb3:0668 (Markierung der eigenen Bestenlisteneinträge, H6.3) hat und wann er
  gesetzt wird, habe ich nicht verfolgt. Er steht nicht in der Speicherkarte.
- **U3:** Aus welchem Pfad die 0xFF-Rangbytes in SERVER.MAN stammen: 0x0AD44 schreibt bei 0x0BF25
  50 × 0xFF in Byte 62+4i, TEST-LAS hat 0. Das betrifft den Randfall in H5.

## Nebenbefund außerhalb des Bereichs (für die Gruppe mit 0x0CB62)

- **(S) 0x0D615-0x0D631:** Bei der Neubelegung eines Spielerdatensatzes am Saisonwechsel schreibt
  das Original die Positionsart random(0,6) nach `imulw -0x7c(%bp)`, also an Spieler [bp−0x7C]. Das
  ist der zuletzt angelegte Jugendspieler (0x0CF96) oder 6 aus der Schleife bei 0x0CC7F. Alter und
  Werte gehen dagegen an [bp−0x7A], den neu belegten Spieler. seasonEvents.ts:210 schreibt Byte 32
  des neu belegten Spielers. Die Würfelfolge ist gleich, das Schreibziel nicht. Einen fremden
  Spieler trifft das im Original bei jeder Neubelegung. 0CB62.md (Zeile J) sagt dazu "stimmt".
