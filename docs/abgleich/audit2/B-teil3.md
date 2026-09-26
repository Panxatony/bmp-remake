# Audit 2, Gruppe B, Teil 3: 0x0CB62, 0x0F2A6, 0x09623

Gelesen: Disassembly komplett (CB62..DF0D 1724 Zeilen, F2A6..F4D7, 9623..971F), dazu die
Aufrufer 0x1E150..0x1E1C8 und 0x1E935 und die Helfer 0x1FDBE, 0x224A8 (Anfang) und 0x0F4D7 (nur
geprüft, ob er seinen Puffer benutzt). Remake: `sim/seasonEvents.ts`, `sim/season.ts`
(`saisonwechselTeil1/2`), `sim/pool.ts`, `sim/newgame.ts` (`trainerUndFernsehgeld`, `addToSquad`),
`sim/transfer.ts` (`removePlace`). Zweigbücher 0CB62.md, saisonwechsel.md und werbung.md
stichprobenweise nachgeprüft: B, C, D (Betrag), F (Rechnung), G, J (Reihenfolge der Würfel), K, L
und M stimmen. Was dort fehlt, steht unten.

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x09623 | Trainergehalt (Byte 478) und Fernsehgeld (4cb3:066C+36m+28) je Manager | newgame.ts:`trainerUndFernsehgeld` (Aufrufe season.ts:456, newgame.ts:404) | stimmt |
| 0x0CB62 | Saisonende je Manager: Prämien, Werbung beim Aufstieg, Torschützenkönig, Jugend, Aprilscherz, Jahrgangswechsel, Karriereende, Saisonwerte, Anzeigeoptionen, Vertragsenden, dann 0x0F2A6 | seasonEvents.ts:`seasonEvents`, `jahrgangswechsel`, `jugendInKader`, `releaseExpiring`, `optionenImStandAnpassen`; season.ts:`saisonwechselTeil1` (Werbung) | Befunde T3a, T3b, T3c, T3d, T3e, T3g |
| 0x0F2A6 | Spielerpool der KI-Vereine: Fehlbestand je Liga aus 0x161D8, Kandidaten aus den anderen Ligen versetzen (0x0F4D7), am Ende noch einmal 0x161D8 | pool.ts:`seasonPlayerPool` | stimmt bis auf T3f (praktisch nie) |

## Befunde

### T3a (S): Jugendkonto und Jugendspieler hängen im Original vom Jahr und von der Startoption 56F4 ab

- Original 0x0CEA7..0x0CEEE: Der ganze Jugendblock (Konto J-J/3 zurückschreiben, Wurf
  random(0,2), Jugendspieler) läuft nur, wenn
  `(Jahr 4238:A7A0 > 1966 && 4238:56F4 == 0) || (Jahr > 1995 && 4238:56F4 != 0)`:
  `cmpw $0x7ae,%es:-0x5860` / `cmpb $0x0,%es:0x56f4` / `je 0xcef0` bzw.
  `cmpw $0x7cb,%es:-0x5860` / `jbe 0xcf48`. Sonst geht es zu 0xD10C: das Konto bleibt unverändert
  und es wird **nicht** gewürfelt.
- 56F4 schreibt nur der Startbildschirm (0x0BD4D: `56F4 = !(Optionsbits >> 3) & 1`). Die Optionen
  beginnen mit `movb $0x1,-0x58(%bp)` (0x0AD7A), Bit 3 ist also aus, 56F4 = 1. Das ist genau der
  Fall, in dem das Original das Jahr 4cb3:07E0 auf 1992 setzt (0x0BD63) - so startet auch das
  Remake (newgame.ts:450). 56F4 steht nicht im Spielstand (MEMORY-MAP, kein Block deckt 4238:56F4
  ab; im Bild ist das Byte 0), nach einem Laden in einem neuen Programmlauf ist es 0.
- Folge im Original: ein im selben Programmlauf gespieltes neues Spiel bekommt an den Saisonenden
  1993, 1994 und 1995 keine Jugend und kein Abschmelzen des Jugendkontos (und einen Wurf weniger
  je Manager); nach einem Laden gilt die Bedingung Jahr > 1966, also immer.
- Remake seasonEvents.ts:230-235 rechnet immer (`let j = ...; j = j + div(j, -3); ... if (j > 30
  && rng(0, 2) === 0 ...`). Es entspricht damit nur dem Fall "geladen". Das Zweigbuch 0CB62 (F)
  nennt die Bedingung und urteilt trotzdem "stimmt"; ABWEICHUNGEN erwähnt sie nicht.
  Entscheiden: nachbauen (Merker im Raumzustand wie die anderen Programmlauf-Werte) oder als
  bewusste Abweichung eintragen.

### T3b (S): Torschützenkönig wird im Original vor dem Auf- und Abstieg bestimmt, im Remake danach

- Original: das Byte je Manager, das 0x0CB62 bei 0x0D6B6 liest (`les 0x6(%bp),%si; mov
  %es:(%bx,%si),%al`), rechnet der Tagesablauf bei 0x1E1AA/0x1E1B0 aus (`lcall $0x14a4,$0x1ad5` =
  0x16515(1), `mov %al,-0x20(%bp,%si)`), und zwar in der Schleife **vor** 0x1EB17
  (Ewigkeitspunkte), also vor dem Zurücksetzen der Tabellen, dem Auf- und Abstieg, dem Mischen und
  vor allen Karriereenden. 0x1E935 reicht dieses Feld nur durch.
- Remake: seasonEvents.ts:223 `hasTopScorer(g, i)` läuft in der Managerschleife, also nach
  `promoteRelegate`/`shuffleLeagues` (season.ts:370-385) und nach Jugend, Jahrgangswechsel und
  Karriereende der vorherigen Manager. `hasTopScorer` nimmt die Liga aus dem **neuen**
  Vereinsindex (seasonEvents.ts:51) und `leagueScorers` die Vereine nach ihrem neuen Ligaband.
- Folge: Für einen Auf- oder Absteiger vergleicht das Remake mit der Liste der neuen Liga (die
  Mitaufsteiger und die Gebliebenen, nicht mehr die Absteiger). Ein Zweitliga-Torschützenkönig
  eines Aufsteigers bekommt die 250.000 DM nur, wenn er auch die Bundesligaschützen übertrifft;
  umgekehrt kann ein Absteiger sie für die Zweitliga-Liste bekommen. Zusätzlich verschieben
  Rücktritte/Rückkehrer des ersten Managers die Liste für die folgenden.
- Behebung: Flags wie das Original vor `ewigkeitspunkte` in `saisonwechselTeil1` bestimmen und an
  `seasonEvents` übergeben.

### T3c (S): Neubelegung eines Datensatzes (Karriereende) schreibt die Positionsart in einen anderen Spieler

- Original 0x0D615..0x0D631: `random(0,6)` → `mov $0x25,%ax; imulw -0x7c(%bp); ... mov
  %cl,%es:0x57fd(%bx)`. Index ist **-0x7c**, nicht der Schleifenspieler -0x7a (das Alter
  davor und Byte 28/29 gehen über `%si` = 37·(-0x7a) an den richtigen Spieler, 0x0D5DB/0x0D610/
  0x0D646). -0x7c ist in 0x0CB62 der Zähler der Bandenschleife (0x0CC7F, endet auf 6, nur beim
  Aufstieg) bzw. der Index des Jugendspielers (0x0CF96); beim ersten Manager ohne beides ist er
  uninitialisiert (Stapelrest).
- Folge im Original: der neu belegte Spieler (vereinsloser Alter > random(32,34) oder
  zurückgetretener Kaderspieler) behält seine alte Positionsart (Spielerbyte 32). Den Wurf bekommt
  stattdessen der Jugendspieler dieses Managers (überschreibt dessen random(0,6) von 0x0CFDE; der
  letzte Wurf gewinnt), nach einem Aufstieg ohne Jugend der Spieler 6, sonst der Spieler aus dem
  vorigen Managerdurchgang.
- Remake seasonEvents.ts:210 `p.setU8(32, rng(0, 6))` am neu belegten Spieler. Reihenfolge der
  Würfel stimmt, das Ziel nicht. Auch SPIELMECHANIK.md ("Positionsart random(0,6)" beim
  Neubelegen) ist danach falsch.

### T3d (S): Rückkehr eines Leihspielers löscht Leihmarke und Vertragsbyte im Kader von Manager 0

- Original 0x0D3BC..0x0D3E8: nach Aufnahme (0x224A8 für den Besitzer, 304A = Besitzer) und Kopie
  des alten Platzes: `mov -0x44(%bp),%al` (= 304A zu Beginn des Durchgangs, 0x0D222; der
  Jahrgangswechsel läuft nur bei 304A == 0, 0x0D27D) `... mov %al,%es:0x304a; mov $0x19,%cl; imul
  %cl; add -0x80(%bp),%ax; ... mov %al,%es:0x7762(%bx); mov %al,%es:0x7756(%bx)`. Gelöscht werden
  Byte 24 und 12 auf Platz 25·**0** + neuer Platz, nicht im Kader des Besitzers. Das läuft auch im
  Zweig Besitzer ≥ 4 (0x0D378 → 0x0D38A), dann mit einem alten -0x80.
- Folge im Original, wenn der Besitzer nicht Manager 0 ist: der Rückkehrer behält Byte 12
  (Leihmarke) und Byte 24 (Vertragsgespräch/Karriereankündigung) des alten Platzes; dafür verliert
  der Spieler von Manager 0 auf diesem Platzindex seine Bytes 12 und 24 (z.B. die
  Karriereankündigung Bit 7, die über das Karriereende entscheidet).
- Remake seasonEvents.ts:181-184 löscht `plain[o + 24]` und `plain[o + 12]` am neuen Platz des
  Besitzers. Stimmt nur für Besitzer 0.

### T3e (S): Jahrgangswechsel schiebt den alten Platz mit falscher Länge auf, wenn er Platz 4 ist

- Original 0x0D396..0x0D3B4: `cmpb $0x4,-0x68(%bp)` (-0x68 = **Platz**, -0x86 = Halter, siehe
  0x0D34B `25·(-0x86) + (-0x68)`), Länge = (2 - (Platz == 4))·12, dann `lcall $0x1ecd,$0x10ee`
  (0x1FDBE) mit (Platz, 1, Länge). 0x1FDBE kopiert Platz k+1 nach k für k = Platz..Länge-1 und setzt
  nur Byte 15 von Platz Länge auf 0 (0x1FE92..0x1FEBC).
- Folge: Steht ein Leihspieler im Managerkader auf Platz 4, wird nur bis Platz 12 aufgeschoben:
  Platz 12 wird leer (nur Spielernummer 0, Rest bleibt), die Plätze 13..23 bleiben stehen - der
  Kader hat eine Lücke, und alles, was über die Zahl der belegten Plätze sucht (0x31A19/0x320C7,
  auch das Vertragsende 0x0DB40), sieht den letzten Spieler nicht mehr. Bei einem Halter-Kader auf
  einem anderen Platz und beim Markt auf Platz 4 ist das Ergebnis dasselbe wie im Remake; beim
  Markt auf anderen Plätzen schiebt das Original die Plätze 112..124 mit (siehe "Unklar").
- Remake seasonEvents.ts:177 `removePlace(g, basis, wo.place, wo.manager === 4 ? 12 : 25)` - immer
  lückenlos.

### T3f (S, praktisch nie): Spielerpool zieht höchstens 1001 Mal

- Original 0x0F3EA..0x0F41F: `mov -0x56(%bp),%ax; incw -0x56(%bp); cmp $0x3e8,%ax; jl 0xf3ef` -
  nach 1001 Treffern auf verbrauchte Einträge wird der Eintrag 0xFF genommen, also Spieler 255, und
  `mov %cl,%es:0x5801(%bx)` schreibt hinter die Spielertabelle (4238:7CDC, in den Aufstellungen).
- Remake pool.ts:144-145 `do r = rng(...) while (cand[src][r] < 0)` ohne Grenze. Nur relevant,
  wenn fast alle Kandidaten einer Liga verbraucht sind (Wahrscheinlichkeit etwa (1-1/n)^1001).

### T3g (D): Beschreibung des Karriereendes in SPIELMECHANIK.md

- SPIELMECHANIK.md "Saisonende je Manager": "Rücktritt (0x0D475): Kaderspieler mit Alter >
  random(32,34) beenden die Karriere". Der Code (0x0D4DE..0x0D51F) und das Remake
  (seasonEvents.ts:262-285) sagen: Kaderspieler gehen, wenn Byte 11 = 0 und Byte 24 Bit 7; neu
  belegt nach Alter > random(32,34) werden nur Spieler, die auf keinem Kader- oder Marktplatz
  stehen. Außerdem zu T3c: die Positionsart geht nicht an den neu belegten Spieler.
- SPIELMECHANIK.md (neues Spiel, 0x09623): "((L·(110 - Fans)) & 0xFE)·500". Der Befehl ist `and
  $0xfe,%al` (0x09681), löscht also nur Bit 0 des 16-Bit-Produkts (& 0xFFFE, so auch
  newgame.ts:120). Die Schreibweise & 0xFE ist missverständlich.

## Unklar

- Plätze 112..124 der Aufstellungstabelle: Ist ein Marktspieler mit fremdem Besitzer auf einem
  Platz ≠ 4 betroffen (T3e), schiebt das Original mit Länge 24 auch diese Plätze nach unten. Sind
  sie immer 0 (in den Originalständen prüfen), ist das Ergebnis gleich.
- Aprilscherz 0x0D161: gewürfelt wird nur, wenn 4cb3:224E/2250 == 2252/2254. Das Remake würfelt
  immer (seasonEvents.ts:257, Kommentar "im Original stets"). Richtig, falls beide Werte nie
  auseinandergehen (0x0DD1E rechnet mit ihnen den Betrag der Abgangsmeldung um, eine
  Währungsoption?). Nicht nachgeprüft, wo 224E/2252 geschrieben werden.
- Karriereende 0x0D50E: ist ein vereinsloser Spieler nicht älter als der Wurf, liest das Original
  Byte 11 und 24 über den Nullzeiger (0000:000B, 0000:0018 = Interrupttabelle). Mit üblichen
  BIOS-Vektoren (Segment F000) folgt "überspringen" wie im Remake.
- Karriereende im Remake `if (p.isEmpty) continue;` (seasonEvents.ts:269) vor dem Wurf
  random(32,34); das Original würfelt für alle 150. Wirkt nur, wenn ein Spielerdatensatz 1..150
  keinen Namen hat.
- Aufnahme fehlgeschlagen (0x224A8 gibt 0x7F zurück): das Original schreibt dann in Platz 0x7F
  weiter (Jugend 0x0D0C3, Rückkehr 0x0D335); das Remake bricht ab bzw. macht den Spieler frei.
  Mit den vorgeschalteten Prüfungen (Kaderzahl < 23; Rückkehrer mit Grenze 25) nicht erreichbar.
