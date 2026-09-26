# Audit 2, Gruppe G: Routinen 0x2A41E bis unter 0x3074A

Stand 26.9.2026. Nur gelesen, im Repo nichts geändert. 23 Routinen (Segment 2a41 und 0x305DE aus 2e3a).
Remake-Pfade relativ zu dem Repo.

## Routinen

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x2A41E | Tafel "Info über <Verein>" (Kopf, Bilanzen, Serien, Rekorde, Ewige Tabelle; ANZEIGEN kippt Bit 7 von Vereinsbyte 33 bei 0x2B282) | core/sim/vereinsinfo.ts:`vereinsInfo`, `markiereVerein`; server.ts:3449; web main.ts:4869 | Befunde G9, G12, G13, G14; Schreibzugriff stimmt |
| 0x2B31E | Rekordtext einer Zeile, setzt 079C = 1, gibt Rohbyte zurück | history.ts:`clubRecords`, vereinsinfo.ts:`rohRekord` | stimmt (079C siehe G9) |
| 0x2B4F3 | Paarungsblock 4238:4B5E aus den Buchstabentabellen 4cb3:06FC/0744 laden (Rückrunde getauscht, Spieltag auf Hälfte begrenzt) | fixtures.ts:`fixtures`, matchday.ts:`writePairings` | stimmt (Doku siehe G7) |
| 0x2B61A | Spielplan / Ligaübersicht "SPIELE <Liga> n.SPIELTAG" (Konferenz 0x5C3D/0x5CE7, Menü 0xA69B); am Anfang Stärke Flag 0, am Ende Flag 1 aller Manager | web main.ts:`drawSpiele`, `drawLeagueOverview`; server live.ts:`halbzeitStaerke` | Befunde G4, G5, G6, G10 |
| 0x2C128 | "n. PLATZ, STÄRKE t (K,T,F)" | display.ts:`clubStrength`; main.ts:6898-6905 | Befund G10 |
| 0x2C304 | Tabellensatz Spalte → Spalte kopieren (Schnappschuss 0→2, Wiederherstellen 2→0) | standings.ts:`applyResult` (`mirror`) | stimmt im Ergebnis (siehe Unklar 1) |
| 0x2C3C0 | Formzeichenkette schieben, neues Zeichen an Stelle 7 | standings.ts:`push` | stimmt |
| 0x2C3FC | Grundzuschlag Byte 23 ± random(0, 2·abs(d)), 16 Bit auf 47..53 begrenzt | ai.ts:`bookBaseBonus` | stimmt |
| 0x2C483 | Bilanz Manager gegen Verein (5 Plätze, sonst schieben) | history.ts:`bookHistory` | stimmt (Doku siehe G8) |
| 0x2C55C | Tabellenbildschirm HEIM/GESAMT/AUSWÄRTS | web main.ts:`drawTable`, standings.ts:`tableOrder` | Befunde G11, G13 (Umsortieren bewusst, ABWEICHUNGEN.md:28) |
| 0x2D143 | Tabellenbuchung einer Liga (Flag 1 Schnappschuss, Flag 0 Buchung, Bilanz, Rekorde, Serien, Grundzuschlag), danach Serienrekorde der Manager, Sortierung, Platz nach Managerbyte 267 + Spieltag | standings.ts, history.ts:`bookHistory`, ai.ts:`bookBaseBonus`, originaltag.ts:`ligaBuchung`, matchday.ts:`spieleEins` | Befund G3; Buchung, Serien und Sortierung stimmen (Zweigbuch 2D144 bestätigt) |
| 0x2DBDF | Vereinsrekord setzen, wenn der neue Wert größer ist | history.ts:`bookRecord` | Befunde G1, G2 |
| 0x2DCA1 | Stärketabelle (4 Ansichten); ab 0x2E3AE Zeitungsaufstellung | display.ts:`strengthTable`, main.ts:`drawStaerken`; zeitung.ts:`reportFromMatch` | Befunde G15, G16 |
| 0x2E9AA | Aufstellungszeile zweifarbig | main.ts:`drawZeitung` (schwarz) | bekannt (anzeigen.md "Unklar"), nicht neu gemeldet |
| 0x2EA7F | Blocksatz der Zeitung | zeitung.ts:`artikelspalte`, main.ts:`umbruch`/`blocksatz` | stimmt im Core; Web siehe G20 |
| 0x2ECB9 | Leerzeichen einfügen | main.ts:`blocksatz` | stimmt |
| 0x2ED04 | Platzhalter der Vorlagen (%0..%5, %9, %a..%e, %t, %x) | zeitung.ts:`parse`/`render`/`expandTemplate` | Befund G18 |
| 0x2EFAB | Artikelspalte (13,60), Breite 180 | zeitung.ts:`artikelspalte` | stimmt (Web G20) |
| 0x2F0D3 | Satz in Wörter teilen | zeitung.ts:`artikelspalte` | stimmt (Web G20) |
| 0x2F15A | Schlagzeile in zwei Zeilen | zeitung.ts:`composeZeitung` | stimmt |
| 0x2F243 | Zeitung eines Managers (Foto, Kurve, Noten, Flags, Artikel, Schlagzeile) | zeitung.ts:`reportFromMatch`/`spielnoten`/`composeZeitung` | Befunde G17, G19 |
| 0x3058F | Gruppenwahl random(1, prio) > taken, dann random(lo, hi) | zeitung.ts:`pick` | stimmt |
| 0x305DE | Spielbericht 4238:90CA + 0x9A·Manager | zeitung.ts:`reportFromMatch` | stimmt |

## Befunde

### G1 (S, dazu A): Torrekorde "kassiert heim" und "erzielt auswärts" im falschen Halbbyte

- **Original:** 0x2D143 ruft 0x2DBDF für diese beiden Rekorde mit p = 0 und q = −1 auf:
  - 0x2D2A0-0x2D2B9: (Heim, k = 3, a = hg, b = ag, Modus 0, p = 0, q = 0xffff, Gegner = Gast).
  - 0x2D2BF-0x2D2D8: (Gast, k = 6, dieselben Werte).
- **Rechnung in 0x2DBDF:**
  - Neuer Wert = p·a − q·b = ag, alter Wert = hi·p − lo·q = lo.
  - 0x2DC65 `cmpw $0x0,0x12(%bp); jge` setzt q = 1.
  - Das Byte ist dann (p·a)<<4 + q·b, also **ag im unteren Halbbyte** (0x2DC70-0x2DC8E).
  - k = 2 und k = 7 laufen mit p = 1, q = 0 (0x2D256-0x2D29A) und landen im oberen Halbbyte.
- **Beleg aus den Spielständen:** Ausgezählt habe ich alle Spielstände in ../bmp (Skript scratchpad/rek.mts). Nicht leere Bytes:

  | Rekord | nur oberes Halbbyte | nur unteres Halbbyte |
  |---|---:|---:|
  | k = 2 | 2147 | 0 |
  | k = 3 | 0 | 2090 |
  | k = 6 | 0 | 2089 |
  | k = 7 | 2146 | 0 |

- **Remake:** history.ts:172-173 `bookRecord(g, home, 3, a, a << 4, away)` und `bookRecord(g, away, 6, a, a << 4, home)` schreiben ins obere Halbbyte. Der Kommentar history.ts:13-14 ("Byte = Heimtore·16 + Gasttore") beschreibt das Original richtig; der Code folgt ihm nicht.
- **Folgen:**
  - (1) Die Spielstandbytes Historie +3988 + 8·Verein + 3/6 sind anders.
  - (2) Die Gesamtansicht der Info-Tafel vergleicht Torrekorde nach dem Rohbyte (vereinsinfo.ts:150 `ra >= rh`, wie 0x2AD68 im Original).
    - Original: Die Zeile "kassiert" vergleicht k = 3 (unten) mit k = 7 (oben), die Zeile "erzielt" k = 2 (oben) mit k = 6 (unten). Dort gewinnt also fast immer dieselbe Seite.
    - Remake: Nach einem vom Remake geschriebenen Rekord vergleicht es echte Torzahlen und zeigt die andere Seite.
  - Die Einzelansichten zeigen dasselbe (`clubRecords` liest `hi || lo`).
- **Nebenbei:** Ab 16 Toren begrenzt das Remake auf 15 (history.ts:161-163); das Original rechnet ohne Grenze mit 8 Bit (0x2DC73 `imulb`, `shl $4,%al`). Das Spiel erreicht so viele Tore praktisch nie.

### G2 (S, gering): Bei 0 Toren schreibt das Remake den Gegner eines leeren Rekords

- **Original:** 0x2DC61 `cmp %cx,%ax; jge 0x2dc9b` schreibt im Modus 0 nur bei alt < neu. Für einen leeren Rekord (Byte 0) ist alt = 0. Ein Spiel mit 0 Toren (k = 2, 3, 6, 7) schreibt deshalb weder das Rekordbyte noch den Gegner (4238:A4CA, Historie +4500).
- **Remake:** history.ts:119-125 setzt `oldValue = -1` für ein leeres Byte. Bei `value = 0` gilt `0 <= -1` nicht, das Remake schreibt also Byte 0 und **den Gegner** nach +4500.
- **Folge:** Das Gegnerbyte im Spielstand ist anders. Die Anzeige bleibt gleich, weil ein leerer Rekord keinen Gegner zeigt.

### G3 (S, Randfall): Serienrekorde der Manager nur für den gerade spielenden Verein

- **Original:** 0x2D812-0x2D8B3 läuft nach allen Paarungen einer Liga (Flag 0) über **alle** Manager bis 4cb3:07AB.
  - Je Manager nimmt es seinen Verein (Managerbyte 30, 0x2D8A6).
  - Es übernimmt jede der 21 laufenden Serien (4238:9D36 + 21·Verein), die größer ist als der Rekord (4238:A276 + 21·Manager): 0x2D862 `cmp %al,%es:-0x62ca(%bx); jbe`.
  - Die Bundesliga wird zuerst gebucht (0x5C68-Schleife), dann die übrigen Ligen. Bei der Buchung der Bundesliga werden also auch die Manager der anderen Ligen verglichen, mit dem Stand ihres Vereins **vor** dessen eigenem Spiel.
- **Remake:** history.ts:139-144 vergleicht nur für Manager, deren Verein in genau diesem Spiel steht (`if (club !== home && club !== away) return;`), und das nach dessen Serienbuchung.
- **Wann es abweicht:** Ein Manager übernimmt einen Verein mit laufender Serie über seinem Rekord (Vereinswechsel, neuer Manager), der Verein spielt nicht in der Bundesliga, und die Serie reißt im nächsten Spiel.
  - Das Original übernimmt die Serie schon bei der Bundesligabuchung.
  - Das Remake nie.
  - Genauso bei einem verlegten Spiel des neuen Vereins.

### G4 (S): Stärke aller Manager nach dem Schlusspfiff und auf der Nachholseite wird nicht neu gerechnet; auch an der Halbzeit fehlt der Eintrag in den Vereinssatz

- **Original, Ende von 0x2B61A** (0x2C0FC-0x2C122): Bei Argument bp+8 ≠ 0 läuft `lcall $0xf9d,$0x2` mit (Manager, 1) für jeden Manager bis 07AB, also Fehlbesetzungswürfe und Moral.
  - 0x0F9D2 schreibt die Matrix am gemeinsamen Ende 0x0FFAD in den Vereinssatz (Bytes 24..32), auch mit Flag 1 (Zweigbuch 0F9D2 M, 10BB0).
- **Die Aufrufer mit bp+8 = 2:**
  - 0x5CE7 nach der **90. Minute**, wenn 4cb3:05FF + 3·Liga ("Ergebnisse") gesetzt ist (0x5C9F-0x5CBC); an der 45. Minute über 05FE.
  - 0x5C3D auf der Seite **Nachholspiele** (Schalter 4cb3:060A), an Halbzeit- und Spielende eines Nachholtags (0x5BF6-0x5C45).
- **Remake-Server:**
  - live.ts:473-475 rechnet nur an Minute 45 (`halbzeitStaerke`, live.ts:355-370), und nur bei gesetztem Liga-Bit. Nach dem Schlusspfiff und an einem reinen Nachholtag rechnet es nicht.
  - `halbzeitStaerke` schreibt die Matrix nicht in den Vereinssatz: `matchStrength` ohne `matrixInVerein`. `matrixInVerein` rufen nur originaltag.ts:127 und originaltag.ts:468 auf.
- **Vergleichslauf:** originaltag.ts macht es richtig (Zeilen 202, 468, 583-586). Das Zweigbuch 05403 (S6) deckt nur die Halbzeit ab.
- **Folgen:**
  - Es fehlen je angezeigter Liga Würfe.
  - Die Vereinsmatrix der Managervereine bleibt nach dem Spieltag auf der Anzeigestärke (Flag 0) statt auf der zuletzt gewürfelten Matrix. Das sieht man in der Stärketabelle, und die tägliche Schwankung 0x10067 startet von dort.
  - Managerbyte 317 (Moral) ist anders.

### G5 (A): Verlegte Spiele im Spielplan und in der Ligaübersicht

- **Original** (0x2BBD2-0x2BD5B): Steht im Ergebnis 0x1E (verlegt), sucht es in der Nachholtabelle 4238:5714 den Eintrag mit Spieltag, Liga und Spielnummer (5716/5717/5718).
  - Gefunden: Es zeigt den Termin "T.M. (N)", also Tag + "." + Monat + "." + 4cb3:4A1C " (N)", rechtsbündig bei x 0x128.
  - Nicht gefunden: Es zeigt nichts.
  - Die Zeile steht nach dem Paarungsplatz: y = (si/2)·0x11 + 0x1A (0x2BED9-0x2BEE5).
- **Remake:**
  - main.ts:6900 zeigt im Spielplan "verlegt".
  - Die Ligaübersicht der Konferenz lässt verlegte Paarungen ganz weg (live.ts:265 legt keinen Eintrag an), und main.ts:2090-2097 rückt die folgenden Zeilen nach oben (`y = 18 + 17·i`).

### G6 (A, Bedienung): Spieltag blättern

- **Original** (0x2BF6B-0x2BFA6): Blättern springt über den Rand. Nach dem letzten Spieltag kommt 1, vor 1 der letzte.
- **Startwert:** 225A, bei 225A > Spieltagszahl der Spieltag 1 (0x2B781-0x2B78D).
- **Remake:** main.ts:6916/6920 bleibt mit `Math.max`/`Math.min` am Rand stehen.

### G7 (D): 4238:4B5E ist der Paarungsblock, keine Tabellenreihenfolge

- **Original:** 0x2B4F3 schreibt nach 4B5E + (10·Liga + k)·2 je Heim und Gast (0x2B5AF-0x2B5D4). 0x2D143 liest dort die Paarungen.
- **Doku im Remake:** MEMORY-MAP.md:31 nennt 27900/4238:4B5E "Tabellenreihenfolge: 18 Bundesliga, 20 + 20". Dasselbe steht in records.ts:28 (`tableOrder`) und im Getter records.ts:611-618. Den Getter nutzt nur savefile.test.ts:32.
- **Richtig ist** "Paarungen des aktuellen Spieltags, 9/10/10 Paare"; so steht es in SPIELMECHANIK.md:37 und `pairings()`.
- **Ebenso:** MEMORY-MAP.md:21 führt 59/4238:6DDC als "kleine Zählwerte, Zweck offen"; es ist die Ergebnistabelle (records.ts:29).

### G8 (D): Kopfkommentar der Bilanz in history.ts

- **Doku:** history.ts:6-8 schreibt "Seite 1 = Heimspiele, 0 = Auswärtsspiele" und "Byte = eigene Tore·16 + Gegentore"; history.ts:131 schreibt "Heimspiel im ungeraden".
- **Original:**
  - 0x2D79C-0x2D7BD ruft 0x2C483 für den Heimmanager mit Seite 0 und für den Gast mit Seite 1 auf.
  - Das Byte ist (Gegentore << 4) + eigene Tore (0x2C549-0x2C553: `bp+0xe << 4` + `bp+0xc`).
- **Remake-Code:** Er macht es richtig (history.ts:150, 159), nur die Kommentare stimmen nicht.

### G9 (A): Mindestbreite 4cb3:079C in der Info-Tafel

- **Original:**
  - 0x2A41E setzt 079C vor der Kopfzeile nicht. Aus Tabelle (0x2CEE3) und Stärketabelle (0x2E003) steht noch 2; die Zeile heißt dann "^5. PLATZ IN DER …", in der kleinen Schrift ein leeres Zeichen, mittig gesetzt.
  - 0x284D1 lässt 2 stehen (0x28639), und 0x2B31E setzt 1 nur bei einem nicht leeren Rekord (0x2B37F/0x2B45C). Sind alle gezeigten Rekorde leer, laufen die historischen Ergebnisse (0x2B049/0x2B0A3) und die Ewigen Punkte (0x2B1B8) mit Breite 2, etwa "A: ^1:^0".
- **Remake:** vereinsinfo.ts:89, 171, 182 ff. ohne Auffüllung.

### G10 (A): Platz in "n. PLATZ, STÄRKE …" im Spielplan nicht auf zwei Stellen

- **Original:** 0x2C139 setzt `movb $0x2,%es:0x79c` vor der Platzzahl. 0x2B61A zeichnet den Text linksbündig bei x = 5 bzw. 0x94 (0x2BB4D-0x2BBB1). "^5." und "12." stehen dadurch bündig.
- **Remake:** main.ts:6904-6905 ohne '^'.
- **Nicht betroffen:** Ergebnisseite (main.ts:2265, rechtsbündig) und Restprogramm.

### G11 (A): Titel der Tabelle vor dem ersten Spieltag

- **Original** (0x2C81A-0x2C885): Spieltag = 225A − (arg2 = 1 und 225A > 1 ? 1 : 0). Aus dem Menü (0xA686) steht bei 225A = 1 "1.SPIELTAG".
- **Remake:** main.ts:5041 nimmt das Maximum der gespielten Spiele und schreibt "0.SPIELTAG".

### G12 (A): Info-Tafel aus der Pokal- und Europapokalübersicht fehlt

- **Original:** 0x198EB ruft bei 0x1A2FD `lcall $0x2a41,$0xe` auf (Verein, Modus = x > 0x82 ? 1 : 0, Versatz 0, P 0). Über diesen Weg erreicht man den Zweig Verein > 63 (0x2A56B, Späher-Text "IHRE SPÄHER KÖNNEN LEIDER NUR …", zwei Knöpfe).
- **Remake:** Die Pokalübersicht (main.ts:7037 ff.) hat keinen Klick, und `vereinsInfo` kennt diesen Zweig nicht.

### G13 (A): Info-Tafel aus der Tabelle im Spieltagsablauf

- **Original:** 0x46DB ruft die Tabelle bei 0x4C89 mit arg2 = 0 auf. Klicks gehen trotzdem (0x2D0C0-0x2D0D1), und die Tafel bekommt P = 1 (0x2D062-0x2D06F).
- **Remake:** main.ts:5102 `if (!weiter)`: Im Ablauf gibt es keinen Klick.

### G14 (D): Zweigbuch docs/abgleich/2A41E.md

- Es nennt nur drei Aufrufer; 0x198EB (Aufruf 0x1A2FD) fehlt.
- "Aus dem Menü ist es 0 wie in der Tabelle" gilt nur für die Tabelle aus dem Menü; aus dem Spieltagsablauf gibt 0x2C55C P = 1 weiter.
- Die offene Frage, ob Verein > 63 erreichbar ist, klärt sich über 0x198EB.

### G15 (A): Stärketabelle sortiert im Original instabil

- **Original** (0x2DF80-0x2DFFD): Austauschsortieren; getauscht wird bei sum[order[d]] > sum[order[si]] (0x2DFC9 `jle`). Aus den Summen [2a, 2b, 3] wird [3, 2b, 2a].
- **Remake:** display.ts:84 `rows.sort((a, b) => b.sum - a.sum)` ist stabil und liefert [3, 2a, 2b].
- **Folge:** Bei gleichen Summen stehen Reihenfolge und Platznummern anders. In den Einzelansichten mit drei Bytes ist das häufig.

### G16 (A): Zeitungsaufstellung (0x2E3AE)

- (a) **Reihenfolge:** Das Original geht nach Kaderplatz (0x2E480-0x2E564, Positionsbyte 10 in 1..11). zeitung.ts:499 sortiert nach Byte 10.
- (b) **Komma am Ende:** Das Original setzt "," auch nach dem letzten Eintrag (0x2E527, ohne Bedingung). main.ts:2585 lässt es beim letzten weg.
- (c) **Vereinsname:** Im Original ist er ein eigener Baustein (0x2E469); im Remake hängt er am ersten Spieler.
- (d) **Tore:**
  - Jedes Tor ist ein eigener Baustein mit Umbruch (Breite 0x127); main.ts:2591 zeichnet die Torzeile einzeilig.
  - Bei einem Gegentor stehen zwei Leerzeichen (0x90C3 " ", 0x90C5 " ("), zeitung.ts:514 setzt eins.

### G17 (S): Ausverkauft: Artikel- und Schlagzeilenwurf vertauscht

- **Original:** Bei Spielbericht-Byte 0x12 ≠ 0 kommt erst die Gruppenwahl (0x2FED7 `call 0x3058f`), danach der Artikelwurf (0x2FEEF `lcall $0x76b,$0xcc7`, Gruppe 6).
- **Remake:** zeitung.ts:395-396 würfelt erst `art(6)`, dann `group(true, 3)`.
- **Folge:** Bei jedem ausverkauften Heimspiel eines Managers weichen Schlagzeile und Artikel ab, und alle späteren Würfe verschieben sich. Das gilt auch für originaltag.ts.

### G18 (A, vielleicht S): Schlagzeile 9 mit Tippfehler "%xDE"

- **Original:** Die Vorlage heißt `%a WIRD VON%e%b %0:%1 %xDEKLASSIERT#]BERROLLT#%`.
  - 0x2ED04 liest 'D' als Selektor 0x14 und holt den Wert aus 4238:57AF (0x2EE97). In allen Spielständen steht dort 0x80.
  - Die Schleife ab 0x2EE9F überspringt dann 127 '#' und liest über das Ende der Zeichenkette hinaus.
- **Remake:** zeitung.ts:230 (`?? 1`) zeigt "… KLASSIERT".
- **Wirklich angezeigt:** Was das Original tatsächlich zeigt, ist statisch nicht zu klären (DOSBox-Versuch: hohe Niederlage, Gruppe 3, Schlagzeile 9). Sicher ist nur: den Remake-Text zeigt es nicht.

### G19 (S, gering): Zeitung ausgeschaltet, das Remake würfelt trotzdem

- **Original:** 0x2F28F `cmpb $0x0,%es:0x60b` prüft Schalter 13; steht er auf 0, springt es nach 0x30589, und es fällt kein Wurf.
- **Remake:**
  - server.ts:1883-1899 (`nachDemSpiel`) ruft `reportFromMatch` und `composeZeitung` mit `r.rng` immer auf.
  - originaltag.ts:535 `zeitungen` kennt den Schalter nicht.

### G20 (A): Web-Anzeige der Artikelspalte

- **Leere Wörter:** main.ts:2579 filtert sie heraus. Das Original und der Core setzen dafür eine Lücke; Artikel 55 beginnt mit " %a".
- **Zeilengrenze:** main.ts:2580 bricht nach 17 Zeilen ab (`slice(0, 17)`). Im Original hört 0x2EFAB erst vor dem nächsten Artikel auf, bei y > 148; der letzte Artikel läuft ganz durch.

### G21 (D): Zeitungsdoku

- **Zahl der Artikelsätze:** SPIELMECHANIK.md:1443 und zeitung.ts:4 nennen "110 Artikelsätze". Es sind 109; so stehen sie im Manifest und in zeitung.ts:25.
- **Flags 16 und 17:** SPIELMECHANIK.md:1468 schreibt "frühe Chance … 16, frühes Tor 17". Richtig ist: 16 = frühes Gegentor, 17 = frühes eigenes Tor (0x2F4D2/0x2F5C0).
- **Führung ohne Sieg (15):** Die Bedingung Differenz > −2 fehlt (0x2FF5C `cmpb $0xfe,%es:0x9`).

## Unklar

1. **Spiegelspalten der Tabellensätze (Bytes 2/3, 13-20, 24/25, 28/29, 40, 44):**
   - Das Original stellt bei Flag 0 erst Spalte 2 → 0 wieder her (0x2D1B3-0x2D1D2) und bucht dann nur in die Hauptspalte. Den Spiegel schreibt nur der Schnappschuss (Flag 1: 0x46DB/0x49F7 vor den Spielen, 0x97CE am Tagesbeginn nur bei 225A < Spieltagszahl, Tabellenansicht).
   - Das Remake spiegelt sofort nach der Buchung (standings.ts:36-54).
   - Zwischen den Spieltagen ist das gleich; alle Spielstände in ../bmp haben Spiegel = Hauptwert.
   - Nach dem letzten Spieltag der Saison schnappt 0x97CE nicht mehr. Ob der Spiegel im Original dann bis zum Saisonwechsel auf dem Stand vor dem letzten Spieltag bleibt, ließ sich ohne Spielstand aus diesem Fenster nicht prüfen.
2. **Reihenfolge der Würfe am Spieltag des Servers:** matchday.ts:`spieleEins` würfelt je Spiel Stärke, Grundzuschlag, Chancen, Vorfälle und Zuschauer hintereinander. Das Original bucht alle Grundzuschläge einer Liga erst nach der 90. Minute in 0x2D143. Laut originaltag.ts:10 ist das gewollt ("Der Server spielt einen Tag anders auf"), steht aber nicht in ABWEICHUNGEN.md. Nicht als Befund gewertet.
3. **fixtures(Liga, 0):** Das Original nimmt Tabelleneintrag 0 (leere Zeichenkette, 4cb3:02D8), das Remake greift auf `TABLE[-1]` zu. Vom Remake wird das nie aufgerufen.
4. **Wert von 079C beim Öffnen der Info-Tafel aus dem Spielplan:** 0x2BC4B setzt 2, 0x2BD55 setzt 1; die Reihenfolge zum Klickpfad 0x2C089 ist nicht verfolgt.
5. **Zuschauer in der Zeitungsaufstellung:** 0x2E3D8-0x2E3F2 setzt Spielbericht +0x96/98 auf 0, wenn der Wert über 200000 liegt. Rote Karten stehen dort nur als **ein** Spieler (+0x93); das Remake führt Listen.
6. **Tausenderpunkte in %9 (Zuschauer):** Sie hängen an 4cb3:07B2, also am zuvor gezeigten Bildschirm. Das Remake schreibt die Zahl immer ohne Punkte.
7. **Außerhalb des Bereichs (0x1C632), nur als Hinweis:** "Ausverkauft" (Byte 0x12) vergleicht im Original die Stadionsumme 23A0+23A8 mit 2426 (0x1CE82); das Remake nimmt `attendance >= TOTAL_CAPACITY`.
