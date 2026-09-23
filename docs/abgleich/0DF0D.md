# Zweigbuch 0DF0D - Tagesroutine

Zeile für Zeile gelesen am 22.9.2026 (GitLab #82). Routine 0x0DF0D bis 0x0F125, 1706 Befehle,
136 bedingte Verzweigungen, 36 Würfel. Kommentierte Auflistung: `python3 tools/zweigbuch.py
0xDF0D --liste`.

Die Routine läuft einmal je Manager und Kalendertag. Sie ist in zwölf Abschnitte gegliedert;
jede Verzweigung gehört zu genau einem (Tabelle am Ende). Befunde sind mit **F1** bis **F7**
markiert und werden in GitLab #83 und #81 behoben; *anders* heißt: bewusst anders gelöst,
mit Grund.

## Abschnitte

| | Adressen | Was | Remake | Urteil |
|---|---|---|---|---|
| A | 0DF0D-0DF53 | Vorspann: Schwelle 37 - [Stufe = 5]; **Saisontag > 321: die ganze Routine entfällt** | `training.ts:57` nur fürs Training | **F6** |
| B | 0DF54-0E00A | Transfermarkt (nur Manager 0): Frische > 56 sinkt um `random(3,9)`; mit 1/4 fallen Angebotsbits und Meldung weg | `transfer.ts` `dailyTransfers`, Block `manager === 0` | stimmt |
| C | 0E00B-0E057 | Meldungsliste (nur Manager 0): Lebensdauer je Meldung herunterzählen, bei 0 wegräumen | Meldungen des Servers | *anders*: eigene Meldungsliste |
| D | 0E058-0E1FA | Eigene Spieler auf dem Markt: Leihbit mit 1/3 zurücknehmen, Sperre zählen (0x0F6D8), Angebot fremder Vereine bei `random(0,180) < Wert` und `random(0,2) != 0` | `dailyTransfers`, Marktschleife | stimmt; das Original prüft den Meldungszeiger, das Remake das Angebotsbit - gleichwertig |
| E | 0E1FB-0E443 | Krawallschaden (4·Stehplätze + Sitzplätze/2)·`random(2,5)`, auf 1000 abgerundet; **danach sinkt Komfortnote 390 um eins**: mit 1/3, bei mehr als 2 Mio. DM mit 2/3 | `finance.ts` `dailyFinance` | **F1**: Komfort 390 fehlt |
| F | 0E444-0E537 | Komfortabnutzung: `random(0, 442 - 52·Komfort398) == 0`, Komfort > 1, **nur Bundesliga** (Managerbyte 312 = 0) | `dailyFinance`, Ende | **F2**: gilt bei uns in jeder Liga |
| G | 0E538-0E9D7 | Kaderschleife: Trainingsverletzung; Karriereankündigung; Nummer 0 bei Sperre; Angebotsbits; Byte-24-Zähler; Verlängerungsangebot | `training.ts` `trainingInjuries`, `contracts.ts` | **F3, F4, F5, F7** |
| H | 0E9D8-0EB33 | Angebote fremder Vereine für Kaderspieler (bis Tag 321): `random(0,200) < Wert`, `random(0,450) == 0`, Ausland bei Wert > 90 mit 1/13 | `dailyTransfers`, Kaderteil | stimmt |
| I | 0EB34-0EB9C | Trainingsgewinn je Linie aus den Bällen (Managerbytes 321..324, Matrix DGROUP 0x292, /400) | `dailyTraining`, `gainBase` | stimmt |
| J | 0EB9D-0EEE2 | Trainingslinie: Ziel, Frischezuschlag im Fenster (Stufe > 2 bzw. < 2), Richtung, Schritt, Grenzen 1..99 bzw. 45..55 | `dailyTraining`, Linienschleife | stimmt, auch die Reihenfolge der Würfel |
| K | 0EEE3-0EF7C | Trainingsfaktor Byte 14 und Sonderprogramm Byte 20, abgelaufen -> neu (0x2277A) | `dailyTraining`, Ende | stimmt |
| L | 0EF7D-0F124 | Je Kaderplatz: Sperre zählen, Frische > 50 sinkt um `random(3,7)`, Intensität im Fenster mindestens 6, Frische 60..150, Faktor 20·Intensität, bei Frische > 135 Abschlag, Torhüter +30; am Ende Automatik-Aufstellung | `dailyTraining`, `autoLineupIfEnabled` | stimmt |

## Abschnitt G im Einzelnen

Je Kaderplatz, in dieser Reihenfolge:

1. **Trainingsverletzung** (0x0E668): Byte 13 = 0 und **Byte 9 = 0** (gar kein Merker), dann
   `random(0, 30·Stufe + d + 80) == 0` mit d = max(40, 2·(160 - Frische + 25·[spielfrei])).
   Das Remake prüft von Byte 9 nur die Bits 0 und 1. **F5.**
2. **Karriereankündigung** (0x0E76F): `random(32,45) < Wert` (0x16FC8, wächst mit dem Alter),
   Bit 7 frei, Byte 24 < 100 -> Bit 7 setzen, **Meldung 4 "kündigt an, dass er seinen Vertrag
   nicht mehr verlängern wird"**, Lebensdauer 3 Tage (0x0E835). Keine Verhandlung. Das
   Remake macht daraus ein Verlängerungsangebot mit Dialog. **F7.**
3. Sperre oder Verletzung: Nummer 0 (0x0E580) - macht bei uns der Server (0x1DA23, #34).
4. Mit 1/4 fallen Angebotsbits über 0x1F und die Meldung weg (0x0E591) - `dailyTransfers`.
5. Byte 24 über 99: mit 1/6 zurück auf `random(9,17)`, sonst herunterzählen (0x0E5DC) -
   `contractCooldown` (#80).
6. **Geliehene Spieler (Byte 12 != 0) hören hier auf** (0x0E650). Das Remake lässt sie auch
   Angebote machen. **F4.**
7. **Verlängerungsangebot** (0x0E83E): S = (Ko+Te+Fo)/3, L = min(8, |25-Alter|),
   A = 100 - 100·L/8, N₀ = (40·A + 60·S)/100, **T = min(5, (Einsätze 28 + 30 + 32)/36),
   N = N₀ - N₀·T/10** (0x0E8B5 bis 0x0E918 - der Summand, den das Remake als "noch nicht
   entschlüsselt" führte, **F3**). Dann `random(0,N) == 0` und `random(0,3) == 0`, kein
   Meldungszeiger, Bit 7 frei, letztes Vertragsjahr -> Stufe 2/3/4 (`random(0,100)` über 70 bzw.
   90), Byte 24 = 100 + Stufe, **Meldung 0 "bietet an, von 1 auf Stufe Jahre zu verlängern"**.
   Das Remake macht daraus die Ankündigung, nicht zu verlängern. **F7.**

## Befunde

| | Was | Wirkung |
|---|---|---|
| F1 | Nach Krawall sinkt Komfortnote 390 (1/3, reich 2/3) | Stadion wird bei uns nach Krawall nicht schlechter |
| F2 | Komfortabnutzung nur in der Bundesliga | bei uns nutzt es sich in jeder Liga ab |
| F3 | Dritter Summand der Angebotsschwelle | viel eingesetzte Spieler bieten bei uns zu selten an |
| F4 | Leihspieler machen keine Angebote | bei uns schon |
| F5 | Trainingsverletzung nur bei Byte 9 = 0 | Spieler mit Angebot eines fremden Vereins können sich bei uns verletzen |
| F6 | Ab Saisontag 322 keine Tagesroutine | Markt, Verträge, Krawall und Komfort laufen bei uns weiter |
| F7 | Ankündigung und Angebot vertauscht | siehe #81 |

## Alle Verzweigungen

| Adresse | Abschn. | Vergleich | Sprung | Befund |
|---|---|---|---|---|
| 0df29 | A | `cmpb $0x5,%es:0x4a28` | != → 0xdf30 | **F6** |
| 0df44 | A | `cmpw $0x0,%es:0x7de` counter105+2 | < → 0xdf54 | **F6** |
| 0df46 | A |  | > → 0xdf51 | **F6** |
| 0df4f | A | `cmpw $0x141,%es:0x7dc` counter105 | <= (vzl.) → 0xdf54 | **F6** |
| 0df61 | B | `cmp $0x3,%si` | < → 0xdf56 |  |
| 0df6d | B | `cmpb $0x0,%es:0x304a` curManager | == → 0xdf72 |  |
| 0df94 | B | `cmpb $0x38,%es:0x13(%bx)` | <= (vzl.) → 0xdfad |  |
| 0dfbd | B | `or %ax,%ax` | != → 0xdff4 |  |
| 0dfc8 | B | `cmpb $0x1f,%es:0x9(%bx)` markt+9 | <= (vzl.) → 0xdff4 |  |
| 0dfd2 | B | `or %es:0x30(%bx),%ax` markt+48 | == → 0xdff4 |  |
| 0e006 | B | `cmp %si,%ax` | <= → 0xe00b |  |
| 0e013 | C | `cmp $0xa,%di` | >= → 0xe04e | *anders* |
| 0e02a | C | `cmpb $0x0,%es:0x1d34(%bx)` | == → 0xe00f | *anders* |
| 0e031 | C |  | != → 0xe00f | *anders* |
| 0e052 | C | `cmp $0x3,%si` | >= → 0xe058 | *anders* |
| 0e0ad | D | `cmp %dx,%ax` | != → 0xe0d6 |  |
| 0e0bf | D | `or %ax,%ax` | != → 0xe0d6 |  |
| 0e0fa | D | `cmp %ax,%cx` | == → 0xe0ff |  |
| 0e116 | D | `testb $0x80,%es:0x18(%bx)` markt+24 | == → 0xe11b |  |
| 0e157 | D | `cmp -0x10(%bp),%ax` | < → 0xe15c |  |
| 0e16c | D | `or %ax,%ax` | == → 0xe1e1 |  |
| 0e17a | D | `or %es:0x30(%bx),%ax` markt+48 | != → 0xe1e1 |  |
| 0e1f6 | D | `cmp %si,-0x122(%bp)` | <= → 0xe1fb |  |
| 0e215 | E | `testb $0x1,%es:0x2380(%bx)` manager+318 | != → 0xe21a | **F1** |
| 0e327 | E | `cmpb $0x0,%es:0x224d` | == → 0xe345 | **F1** |
| 0e3c2 | E | `cmpw $0x0,%es:0x23ca(%bx)` manager+392 | < → 0xe425 | **F1** |
| 0e3c4 | E |  | > → 0xe3ce | **F1** |
| 0e3cc | E | `cmpw $0x1,%es:0x23c8(%bx)` manager+390 | <= (vzl.) → 0xe425 | **F1** |
| 0e3d4 | E | `cmpw $0x1e,%es:0x2434(%bx)` manager+498 | < → 0xe3f3 | **F1** |
| 0e3d6 | E |  | > → 0xe3e1 | **F1** |
| 0e3df | E | `cmpw $0x8480,%es:0x2432(%bx)` manager+496 | <= (vzl.) → 0xe3f3 | **F1** |
| 0e3f1 | E | `or %ax,%ax` | == → 0xe405 | **F1** |
| 0e403 | E | `or %ax,%ax` | != → 0xe425 | **F1** |
| 0e470 | F | `or %ax,%ax` | != → 0xe48e | **F2** |
| 0e48c | F | `cmpw $0x0,%es:0x23d2(%bx)` manager+400 | >= → 0xe491 | **F2** |
| 0e491 | F |  | > → 0xe49b | **F2** |
| 0e499 | F | `cmpw $0x1,%es:0x23d0(%bx)` manager+398 | <= (vzl.) → 0xe4a3 | **F2** |
| 0e4a1 | F | `cmpb $0x0,%es:0x237a(%bx)` manager+312 | == → 0xe4a6 | **F2** |
| 0e55b | G | `cmpw $0x0,%es:0x7de` counter105+2 | <= → 0xe560 |  |
| 0e560 | G |  | < → 0xe56e |  |
| 0e569 | G | `cmpw $0x142,%es:0x7dc` counter105 | < (vzl.) → 0xe56e |  |
| 0e585 | G | `cmpb $0x0,%es:0xd(%bx)` markt+13 | == → 0xe591 |  |
| 0e5a1 | G | `or %ax,%ax` | != → 0xe5d8 |  |
| 0e5ac | G | `cmpb $0x1f,%es:0x9(%bx)` markt+9 | <= (vzl.) → 0xe5d8 |  |
| 0e5b6 | G | `or %es:0x30(%bx),%ax` markt+48 | == → 0xe5d8 |  |
| 0e5e1 | G | `cmpb $0x63,%es:0x18(%bx)` markt+24 | <= (vzl.) → 0xe63e |  |
| 0e5e8 | G | `testb $0x80,%es:0x18(%bx)` markt+24 | != → 0xe63e |  |
| 0e5fa | G | `or %ax,%ax` | != → 0xe650 |  |
| 0e608 | G | `or %es:0x30(%bx),%ax` markt+48 | == → 0xe650 |  |
| 0e643 | G | `cmpb $0x0,%es:0x18(%bx)` markt+24 | == → 0xe650 |  |
| 0e64a | G | `testb $0x80,%es:0x18(%bx)` markt+24 | != → 0xe650 |  |
| 0e659 | G | `cmpb $0x0,%es:0xc(%bx)` markt+12 | != → 0xe65e |  |
| 0e663 | G | `cmp %si,-0x122(%bp)` | > → 0xe668 |  |
| 0e6be | G | `cmp $0x28,%ax` | >= → 0xe6c3 |  |
| 0e6cc | G | `cmpb $0x0,%es:0xd(%bx)` squad+13 | == → 0xe6d1 |  |
| 0e6d6 | G | `cmpb $0x0,%es:0x9(%bx)` squad+9 | == → 0xe6db |  |
| 0e6f8 | G | `or %ax,%ax` | != → 0xe76f |  |
| 0e791 | G | `cmp %di,%ax` | < → 0xe796 |  |
| 0e79f | G | `testb $0x80,%es:0x18(%bx)` squad+24 | != → 0xe7a8 |  |
| 0e7a6 | G | `cmpb $0x64,%es:0x18(%bx)` squad+24 | < (vzl.) → 0xe7ab |  |
| 0e803 | G | `cmp $0x7f,%di` | != → 0xe808 |  |
| 0e88e | G | `cmp $0x8,%ax` | <= → 0xe896 |  |
| 0e8cf | G | `cmp $0x5,%ax` | <= → 0xe8d7 |  |
| 0e928 | G | `or %ax,%ax` | != → 0xe958 |  |
| 0e93a | G | `or %ax,%ax` | != → 0xe958 |  |
| 0e948 | G | `or %es:0x30(%bx),%ax` squad+48 | != → 0xe958 |  |
| 0e94f | G | `testb $0x80,%es:0x18(%bx)` squad+24 | != → 0xe958 |  |
| 0e956 | G | `cmpb $0x1,%es:0xb(%bx)` squad+11 | == → 0xe95b |  |
| 0e96f | G | `cmp $0x5a,%ax` | <= → 0xe978 |  |
| 0e97b | G | `cmp $0x46,%ax` | <= → 0xe984 |  |
| 0e9fb | H | `cmpw $0x0,%es:0x7de` counter105+2 | <= → 0xea00 |  |
| 0ea00 | H |  | < → 0xea0b |  |
| 0ea09 | H | `cmpw $0x142,%es:0x7dc` counter105 | >= (vzl.) → 0xea7c |  |
| 0ea7a | H | `cmp %si,-0x122(%bp)` | > → 0xea7f |  |
| 0eaa8 | H | `cmpb $0x0,%es:0xf(%bx)` | == → 0xea75 |  |
| 0eaaf | H | `cmpb $0x0,%es:0xc(%bx)` | != → 0xeb08 |  |
| 0eab6 | H | `testb $0x80,%es:0x18(%bx)` | != → 0xeb08 |  |
| 0eae6 | H | `cmp -0x10(%bp),%ax` | >= → 0xeb08 |  |
| 0eaf8 | H | `or %ax,%ax` | != → 0xeb08 |  |
| 0eb06 | H | `or %es:0x30(%bx),%ax` squad+48 | == → 0xeb0b |  |
| 0eb14 | H | `cmpw $0x5a,-0x10(%bp)` | <= → 0xeb28 |  |
| 0eb26 | H | `or %ax,%ax` | == → 0xeb2b |  |
| 0eb5c | I | `cmp $0x4,%si` | < → 0xeb36 |  |
| 0eb7d | I | `cmp $0x4,%si` | < → 0xeb62 |  |
| 0eb8d | I | `cmp $0x3,%di` | >= → 0xeb98 |  |
| 0ebad | J | `cmpb $0x2,%es:0x4a28` | > → 0xebb2 |  |
| 0ebcf | J | `cmp %es:0x7de,%dx` counter105+2 | > → 0xebf7 |  |
| 0ebd1 | J |  | < → 0xebda |  |
| 0ebd8 | J | `cmp %es:0x7dc,%ax` counter105 | >= (vzl.) → 0xebf7 |  |
| 0ebec | J | `cmp %es:0x7de,%dx` counter105+2 | > → 0xec0e |  |
| 0ebee | J |  | < → 0xebf7 |  |
| 0ebf5 | J | `cmp %es:0x7dc,%ax` counter105 | > (vzl.) → 0xec0e |  |
| 0ec01 | J | `cmpw $0x0,%es:0x7de` counter105+2 | < → 0xec56 |  |
| 0ec03 | J |  | > → 0xec0e |  |
| 0ec0c | J | `cmpw $0x142,%es:0x7dc` counter105 | <= (vzl.) → 0xec56 |  |
| 0ec1e | J | `or %ax,%ax` | != → 0xec24 |  |
| 0ec7b | J | `cmpb $0x2,%es:0x4a28` | >= → 0xecef |  |
| 0ec9a | J | `cmp %es:0x7de,%dx` counter105+2 | > → 0xecc2 |  |
| 0ec9c | J |  | < → 0xeca5 |  |
| 0eca3 | J | `cmp %es:0x7dc,%ax` counter105 | >= (vzl.) → 0xecc2 |  |
| 0ecb7 | J | `cmp %es:0x7de,%dx` counter105+2 | > → 0xecd9 |  |
| 0ecb9 | J |  | < → 0xecc2 |  |
| 0ecc0 | J | `cmp %es:0x7dc,%ax` counter105 | > (vzl.) → 0xecd9 |  |
| 0eccc | J | `cmpw $0x0,%es:0x7de` counter105+2 | < → 0xecef |  |
| 0ecce | J |  | > → 0xecd9 |  |
| 0ecd7 | J | `cmpw $0x142,%es:0x7dc` counter105 | <= (vzl.) → 0xecef |  |
| 0ecfc | J | `cmp %ax,(%bx,%di)` | >= → 0xed22 |  |
| 0ed0e | J | `or %ax,%ax` | == → 0xed22 |  |
| 0ed2f | J | `cmp %ax,(%bx,%di)` | <= → 0xed60 |  |
| 0ed41 | J | `or %ax,%ax` | == → 0xed60 |  |
| 0ed70 | J | `or %ax,%ax` | != → 0xeddd |  |
| 0ed76 | J | `cmp %ax,-0x11e(%bp)` | == → 0xeddd |  |
| 0ed7d | J | `cmpw $0x2,-0x116(%bp)` | <= → 0xed92 |  |
| 0ed97 | J | `cmpw $0x0,-0x116(%bp)` | == → 0xeddd |  |
| 0edb2 | J | `cmp $0x2,%di` | >= → 0xedbd |  |
| 0ede1 | J | `cmp $0x3,%di` | < → 0xede6 |  |
| 0eed8 | J | `cmp $0x4,%ax` | == → 0xeedd |  |
| 0ef03 | K | `or %ax,%ax` | == → 0xef30 |  |
| 0ef0e | K | `testb $0x80,%es:0x14(%bx)` squad+20 | == → 0xef21 |  |
| 0ef4f | K | `cmpw $0x0,-0x116(%bp)` | != → 0xef5c |  |
| 0ef81 | L | `cmp %si,-0x122(%bp)` | > → 0xef86 |  |
| 0efd9 | L | `cmpb $0x32,%es:0x13(%bx)` squad+19 | <= (vzl.) → 0xeff2 |  |
| 0f00f | L | `cmp %es:0x7de,%dx` counter105+2 | > → 0xf042 |  |
| 0f011 | L |  | < → 0xf01a |  |
| 0f018 | L | `cmp %es:0x7dc,%ax` counter105 | >= (vzl.) → 0xf042 |  |
| 0f02c | L | `cmp %es:0x7de,%dx` counter105+2 | < → 0xf042 |  |
| 0f02e | L |  | > → 0xf037 |  |
| 0f035 | L | `cmp %es:0x7dc,%ax` counter105 | <= (vzl.) → 0xf042 |  |
| 0f03b | L | `cmpw $0x6,-0x8(%bp)` | >= → 0xf042 |  |
| 0f056 | L | `cmpb $0x82,%es:0x13(%bx)` squad+19 | <= (vzl.) → 0xf07b |  |
| 0f05c | L | `cmpw $0x6,-0x8(%bp)` | >= → 0xf07b |  |
| 0f08d | L | `cmpb $0x3c,%es:0x13(%bx)` squad+19 | >= (vzl.) → 0xf094 |  |
| 0f09d | L | `cmpb $0x96,%es:0x13(%bx)` squad+19 | <= (vzl.) → 0xf0a4 |  |
| 0f0b6 | L | `cmp $0x87,%cl` | <= (vzl.) → 0xf0f0 |  |
| 0f0e9 | L | `cmpw $0xa,-0x8(%bp)` | >= → 0xf0f0 |  |
| 0f10d | L | `or %al,%al` | != → 0xf113 |  |

## Nachtrag #99 (bytegenauer Vergleich)

Wurf für Wurf gegen das Original geprüft (TEST4, drei Manager, Speicherabzug des Kaders):

- Die Abschnitte laufen als eine Funktion in dieser Reihenfolge (sim/tagesroutine.ts); die
  Kaderschleife G ist je Platz verschränkt. Vorher liefen die Teile in eigenen Schleifen.
- E/F (Krawall, Komfort) laufen einmal am Ankunftstag, nicht für jeden übersprungenen Tag.
- Jede Meldung (0x30AA0) würfelt random(0,3) und datiert sich um so viele Tage zurück.
- Die Schleifen G, H und I-L gehen die Plätze 0..Anzahl-1 durch (Anzahl = belegte Plätze,
  0x31A19). Hat der Kader eine Lücke, kommt die leere Stelle dran und der letzte Spieler nicht.
- Die Automatik-Aufstellung am Ende (0x0F118) läuft an Spieltagen ins Leere: 0x1D817 hat das
  System vor den Spielen auf manuell gestellt, erst der nächste Spieltag stellt es zurück.
- Offen: Nummernvergabe und Feldpositionen der Aufstellung (GitLab #103).
