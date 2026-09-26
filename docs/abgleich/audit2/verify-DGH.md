# Gegenprüfung Audit 2, Gruppen D, G, H (26.9.2026)

Geprüft: alle Befunde aus audit2-D.md, audit2-G.md und audit2-H.md. Die Befunde der Klasse S habe ich
adversarial gegen all.s (dis.sh/da.sh) und den Remake-Code geprüft. Bei A und D habe ich nur die
zitierte Stelle nachgelesen, stichprobenartig. Im Repo ist nichts geändert.
Hilfsskripte im Scratchpad: vg1.mts (Halbbytes der Torrekorde je Spielstand), vd1.mts (Spieler je
KI-Verein), vh2.mts (Rücktrittskandidaten in KP-SAISON-START).

---

## Gruppe G

### G1 - BESTÄTIGT (S)
- **Original, Argumente:** Erstes Argument ist bp+6. Bei 0x2DBDF gilt bp+6 = Verein, bp+8 = k, bp+a = a, bp+c = b, bp+e = Modus, bp+10 = p, bp+12 = q, bp+14 = Gegner.
  - Aufruf k = 3 (0x2D2A0-0x2D2B9): `push -0x12` (Gegner = Gast), `push 0xffff` (q = −1), `push 0` (p), `push 0` (Modus), `push -0x18` (b = Gasttore), `push -0x1e` (a = Heimtore), `push 3`, `push -0x10` (Heimverein).
  - Aufruf k = 6: dasselbe für den Gastverein.
  - Aufrufe k = 2 und k = 7: p = 1, q = 0.
- **Original, Rechnung in 0x2DBDF (Modus 0):**
  - Neuer Wert = p·a − q·b.
  - Alter Wert = hi·p − lo·q (0x2DC2C-0x2DC5F).
  - `cmp %cx,%ax; jge 0x2dc9b`: Das Original schreibt nur bei alt < neu.
  - Danach macht `cmpw $0,0x12(%bp); jge` aus q = −1 den Wert 1, und das Byte wird `(p·a)<<4 + q·b`. Bei k = 3/6 steht damit **b = Gasttore im unteren Halbbyte**.
- **Spielstände, mit dem Decoder des Remakes geprüft** (vg1.mts über alle 42 *.MAN in ../bmp): In jedem Stand liegt k = 2/7 ausschließlich im oberen und k = 3/6 ausschließlich im unteren Halbbyte. Kein Byte hat beide Hälften belegt.
  - Beispiel TEST4, Verein 0: `50,3,50,4,4,40,4,50`.
  - Beispiel CLAUDE.MAN: `10,0,10,0,…`. Dort ist k = 3 noch 0 (keine Gegentore), das stützt auch G2.
- **Remake:** history.ts:172-173 `bookRecord(g, home, 3, a, a << 4, away)` und `bookRecord(g, away, 6, a, a << 4, home)` schreiben ins obere Halbbyte.
  - Der Vergleich in `bookRecord` (`(old>>4) || (old&15)`) liest beide Lagen richtig. Deshalb fällt der Fehler erst beim Schreiben auf.
  - Die Gesamtansicht von vereinsinfo.ts:150 (`ra >= rh`, Rohbyte wie 0x2AD68) vergleicht danach andere Werte als das Original.
  - Kein Test deckt k = 3/6 ab (history.test.ts prüft nur records[0], [1], [2], [4]).
  - Ein Eintrag in ABWEICHUNGEN.md fehlt.
- **Häufigkeit:**
  - Das Byte weicht bei jedem neuen Rekord "kassiert heim" oder "erzielt auswärts" ab. In der ersten Saison eines neuen Spiels passiert das oft, später selten.
  - Die Anzeige in der Gesamtansicht der Info-Tafel dreht sich dann um.
  - Keine Würfel.
- **Korrektur:** history.ts `bookHistory`, gespeichertes Byte bei k = 3/6 von `a << 4` auf `a` ändern. Die Grenze auf 15 kann bleiben (nur Randfall). **Aufwand: klein.**
  - Dazu einen Test mit TEST4 und `bookHistory`, der prüft, dass Byte k = 3 < 16 bleibt.

### G2 - BESTÄTIGT (S, gering)
- **Original:** 0x2DC61 `cmp %cx,%ax; jge 0x2dc9b` überspringt bei alt ≥ neu. Bei leerem Byte ist alt = 0. Bei 0 Toren ist neu = 0, also schreibt das Original weder das Byte noch den Gegner (0x2DC96).
- **Remake:** history.ts:119-125 setzt `oldValue = -1` für Byte 0. Mit `value = 0` ist `0 <= -1` falsch, das Remake schreibt also Byte 0 und **den Gegner** nach +4500.
- **Spielstände:** Leere Rekorde tragen dort verschiedene alte Gegnerbytes (rek2.mts: 3, 0, 6, 7, 12 …). Diese würde das Remake überschreiben.
- **Häufigkeit:** Nur solange ein Rekord leer ist, also praktisch nur in der ersten Saison eines neuen Spiels. Nur ein Spielstandbyte ändert sich, die Anzeige nicht, keine Würfel.
- **Korrektur:** `bookRecord`, leeres Byte als `oldValue = 0` werten (für k = 0/1/4/5 gilt ebenfalls 0, dort ist der neue Wert ohnehin ≥ 1). **Aufwand: klein.**

### G3 - BESTÄTIGT (S, Randfall)
- **Original:**
  - 0x2D812 `cmpb $0,0x8(%bp)`: nur bei Flag 0.
  - Die Schleife läuft über si < 4cb3:07AB (alle Manager). Den Verein holt 0x2D8A6 `mov %es:0x2260(%bx)`.
  - 0x2D865 `cmp %al,%es:-0x62ca(%bx); jbe`: Ist die laufende Serie (9D36 + 21·Verein) größer als der Rekord (A276 + 21·Manager), übernimmt sie das Original (0x2D873).
- **Remake:** history.ts:139-144 `if (club !== home && club !== away) return;`. Es vergleicht je Spiel und erst nach dessen Serienbuchung.
- **Wann es abweicht:** Nur wenn ein Managerverein eine laufende Serie über dem Rekord des Managers hat (nach Vereinswechsel oder neuem Manager) und diese im nächsten eigenen Spiel reißt, oder wenn der Verein an einem Ligatag nicht spielt (verlegt).
  - Sonst sind die Serien im Original nie größer als der Rekord.
- **Häufigkeit:** selten. Keine Würfel.
- **Korrektur:** `bookHistory` ohne die Vereinsbedingung. Besser: den Vergleich einmal für alle Manager nach der Buchung jeder Liga ausführen (matchday.ts `spieleEins` und originaltag.ts `ligaBuchung`). **Aufwand: klein.**

### G4 - BESTÄTIGT (S)
- **Original, 0x2B61A:**
  - Am Anfang 0x2B62F-0x2B653: bei bp+8 ≠ 0 `lcall $0xf9d,$0x2` mit (m, 0) für alle Manager.
  - Am Ende 0x2C0FC-0x2C120: mit (m, **1**) für alle Manager. Es gibt keinen anderen Ausstieg aus der Routine.
- **Original, Aufrufer 0x5C48-0x5CEC:**
  - Minute 0x2D mit 05FE + 3·Liga (Halbzeitstände).
  - Minute 0x5A mit 05FF + 3·Liga (Ergebnisse).
  - Beide Male `lcall $0x2a41,$0x120a` mit (Liga, **2**, Minute, 1). bp+8 = 2 ist also gesetzt.
  - Nachholtag (Ligamaske 0): 0x5C1E prüft 4cb3:060A, dann ruft 0x5C3D dieselbe Routine mit bp+8 = 2 auf.
- **Remake-Server:**
  - live.ts:473 ruft `halbzeitStaerke` nur bei `minute === 45` auf. Darin steht `matchStrength` ohne `matrixInVerein` (live.ts:362).
  - Nach der 90. Minute und am reinen Nachholtag rechnet der Server nicht neu.
  - Weiter reicht: Der Server schreibt die Spielmatrix auch vor dem Anpfiff nicht in den Vereinssatz (live.ts:256 `matrixFor`, im Original 0x1D7FF mit Flag 1). Nach dem Spieltag steht im Vereinssatz der Managervereine also die Anzeigematrix aus `anzeigeStaerke` (server.ts:1338).
- **Vergleichslauf:** originaltag.ts macht es richtig. Z. 202 (`staerkeNeu` je Managerliga nach `ligaBuchung`), Z. 583/586 (Nachholtag 45 und 90), Z. 468 (`matrixInVerein`).
  - Das Zweigbuch 05403 S6 nennt nur die Halbzeit, ebenso der Kommentar zu `halbzeitStaerke`. Die 90. Minute steht dagegen in 05403.md Zeile M ("je angezeigter Liga einmal").
- **Weitere Folge, die das Audit nicht nennt:**
  - Die Zeitung liest im Original die Matrix aus dem Vereinssatz nach der Neurechnung (0x3074A läuft nach der Schleife 0x5C48). originaltag.ts:544 übergibt deshalb bewusst kein `staerke`.
  - Der Server übergibt die Matrix der Konferenz (server.ts:1897). `str()` in zeitung.ts:495 (Stärkevergleich für Stimmung und Schlagzeilen) rechnet also mit einer anderen Matrix.
- **Häufigkeit:** an **jedem** Ligaspieltag mit Manager und eingeschalteter Option "Ergebnisse" (Vorgabe an) sowie an jedem Nachholtag.
  - Folgen: Würfe fehlen, die Vereinsmatrix (Stärketabelle bis zum nächsten Flag-0-Aufruf) und Managerbyte 317 sind anders, und die Zeitung wird anders.
  - Die Würfelfolge des Servers ist ohnehin nicht wurfgleich (originaltag.ts:10). Das Zustandsbild weicht aber sichtbar ab.
- **Korrektur:** in live.ts:
  1. `halbzeitStaerke` zu `uebersichtStaerke(state, g, rng, schalter)` verallgemeinern und mit `matrixInVerein` schreiben.
  2. Nach dem Abpfiff aller Ligaspiele je Managerliga mit Option `flags[3·l+1]` aufrufen, vor der Zeitung.
  3. Am Nachholtag an Minute 45 und 90 mit Schalter 060A aufrufen.
  4. Die Zeitung dann ohne `staerke` aufrufen (Vereinssatz lesen).
  5. Außerdem die Anpfiffstärke per `matrixInVerein` schreiben.
  - **Aufwand: mittel.**

### G5 - BESTÄTIGT (A)
main.ts:6900 zeigt "verlegt". Die Stelle ist plausibel, den Originalzweig 0x2BBD2 habe ich nicht im Einzelnen gelesen.

### G6 - BESTÄTIGT (A)
main.ts:6916/6920 `Math.max(1, …)` und `Math.min(days, …)`.

### G7 - BESTÄTIGT (D)
MEMORY-MAP.md:31 nennt 4238:4B5E "Tabellenreihenfolge".

### G8 - BESTÄTIGT (D)
Die Kommentare history.ts:6-8 und :131 widersprechen dem Code (Z. 147/158: Heim ins gerade Byte, Byte = Gegentore·16 + eigene Tore).

### G9 - plausibel (A)
Nicht im Einzelnen nachgelesen.

### G10 - BESTÄTIGT (A)
main.ts:6903 `${place}. PLATZ` ohne Auffüllung.

### G11 - BESTÄTIGT (A)
main.ts:5041 `Math.max(...homeGames + awayGames)`.

### G12 - plausibel (A)
0x1A2FD-Klick siehe D5. Keine Klickfläche in der Pokalübersicht.

### G13 - BESTÄTIGT (A)
main.ts:5102 `if (!weiter)`.

### G14 - plausibel (D)
Folgt aus G12/G13.

### G15 - BESTÄTIGT (A)
display.ts:84 `rows.sort((a,b) => b.sum - a.sum)`, stabil.

### G16 - BESTÄTIGT (A)
zeitung.ts:499 sortiert nach Byte 10. main.ts:2585 hängt das Komma nicht an den letzten Baustein. Die Torzeile ist einzeilig (main.ts:2591).

### G17 - BESTÄTIGT (S)
- **Original, Byte 0x12 ≠ 0** (0x2FEAD):
  1. Zuerst die Gruppenwahl `call 0x2058f`. Gemeint ist 0x3058F (der Umbruch aus dem Auftrag). Argumente: Priorität 3, Kopf, &taken, lo, hi.
  2. Dann `lcall $0x76b,$0xcc7` (0x2FEEF) für den Artikel mit random(Basis, Basis + Anzahl − 1), gespeichert nach 4238:2E7E.
- **Remake:** zeitung.ts:394-396 würfelt erst `art(6)`, dann `group(true, 3)`.
- **Tests:** Der Vergleichslauf originaltag nutzt dieselbe Funktion. Das dort geprüfte Protokoll enthält offenbar kein ausverkauftes Managerheimspiel, deshalb ist es nicht aufgefallen.
- **Häufigkeit:** jedes ausverkaufte Heimspiel eines Managers. Bei vollem Stadion ist das häufig.
  - Folge: Artikel- und Schlagzeilenwurf bekommen andere Zufallszahlen, und der Text weicht ab.
  - `pick` würfelt random(lo, hi) nur, wenn random(1, prio) > taken ausfällt. Weil dieser Wurf jetzt eine andere Zahl bekommt, kann sich auch die Zahl der Würfe ändern und damit alle folgenden Würfe verschieben.
- **Korrektur:** zeitung.ts `composeZeitung`, die beiden Zeilen tauschen (`group(true, 3); art(6);`). **Aufwand: klein.**

### G18 - BESTÄTIGT (A, keine Würfel)
- **Original:** 0x2EE5C-0x2EE97 liest den Selektor 'D' − 0x30 = 0x14 und holt, weil ≠ 0, den Wert aus 4238:579B + 0x14 = 57AF.
  - Ist der Wert > 1, sucht die Schleife 0x2EE9F-0x2EED9 so viele '#'. Einen Wurf gibt es in diesem Zweig nicht; nur der Selektor 0 würfelt bei 0x2EE82.
- **Remake:** zeitung.ts:230 `?? 1` wählt die erste Alternative.
- **Wirkung:** Nur der angezeigte Text ist anders, die Würfelfolge nicht. Deshalb stufe ich den Befund als A ein.
- **Korrektur:** erst per DOSBox klären, was angezeigt wird. **Aufwand: klein**, sobald das geklärt ist.

### G19 - BESTÄTIGT (S, gering)
- **Original:** 0x2F28F `cmpb $0x0,%es:0x60b` (ES = 4cb3, Option 13), bei 0 geht es nach 0x30589 (im Listing als 0x20589 umgebrochen). 0x3074A selbst würfelt nicht (nur 0x4CD7/0x4DD3).
- **Remake:** server.ts:1883-1899 prüft `r.options.zeitung` nicht, und originaltag.ts `zeitungen` ebenfalls nicht.
- **Häufigkeit:** nur, wenn jemand die Zeitung abschaltet. Dann fallen je Manager-Spiel Würfe weg: Bild random(0,29), Noten, Schlagzeile, Artikel.
- **Korrektur:** In `nachDemSpiel` bei `!r.options.zeitung` weder `reportFromMatch` noch `composeZeitung` aufrufen; in originaltag optional einen Schalter einbauen. **Aufwand: klein.**

### G20 - BESTÄTIGT (A)
main.ts:2579 `.filter((w) => w !== "")`, main.ts:2580 `slice(0, 17)`.

### G21 - BESTÄTIGT (D)
SPIELMECHANIK.md:1443 nennt "110 Artikelsätze", und :1468 schreibt "frühe Chance … 16, frühes Tor 17".

---

## Gruppe D

### D1 - BESTÄTIGT (S)
- **Original:**
  - 0x1608B `cmpb $0x9,-0x2(%bp); ja 0x16094`.
  - 0x16094 `movb $0xa,-0x9e(%bp); jmp 0x16007`.
  - 0x16007 `cmpb $0x2; jbe; decb`.
  - Bei n ≥ 10 ergibt das w = 9. Bei n ≤ 9 ist w = tab[n] − 1 (0x15FFD `mov 0x5331(%bx)`, 0x16001 `dec`), danach > 2 → −1.
- **Tabelle:** 4cb3:5331 im Abbild ist [0,2,3,4,5,6,7,8,9,10] und stimmt mit `SCORER_WEIGHT` überein.
- **Remake:** ai.ts:41 `(SCORER_WEIGHT[Math.min(n,9)] ?? 10) - 1` ergibt 9, danach `w > 2 → 8`.
- **Wirkung:**
  - w wird je Tor neu gesetzt: 0x1608B steht in der Torschleife, 0x1604A überschreibt w mit dem Kandidatenindex. Das Remake hält w konstant, das ist gleichwertig.
  - `rng(0, w)` bei 0x1602E hat eine andere Spanne, damit ändern sich Ergebnis und Wurfzahl.
- **Häufigkeit:**
  - Hängt davon ab, wie viele Spieler ein KI-Verein in der Spielertabelle hat. In 29 der 42 Stände sind es höchstens 9, dann tritt D1 nie ein.
  - In den Ständen mit Managern unterhalb der Bundesliga (CLAUDE*, RIED*, SERVER, TEST-LAS, SCHWARZ-) haben einzelne KI-Vereine 10 bis 27 Spieler, etwa Vereine 38-41.
  - Dort betrifft es regelmäßig jedes Tor dieser Vereine.
- **Korrektur:** ai.ts `creditAiGoals`: `let w = n > 9 ? 10 : SCORER_WEIGHT[n] - 1; if (w > 2) w--;`. **Aufwand: klein.**

### D2 - BESTÄTIGT (S, selten)
- **Original:** 0x16543-0x165A5 schreibt unbedingt `mov %cl,%es:0x57ff(%bx)`: Spielerbyte 34 := Kaderbyte 3. Das gilt für alle Manager und alle Plätze < Kaderzahl (0x3091:0x1109).
- **Remake:** display.ts:140 `saisonTore` liest nur.
- **Wann es abweicht:** Nur bei einem Spieler, der in der Saison von einem KI-Verein zu einem Manager kam, dessen Liste danach angesehen wurde (oder der Saisonendaufruf lief) und der den Managerkader in derselben Saison wieder verlässt.
  - Am Saisonende sind beide gleich, weil 0x16515 im Original schreibt und das Remake die Kadertore liest.
- **Häufigkeit:** selten. Keine Würfel.
- **Korrektur:** eine Funktion `torschuetzenSchreiben(g)` im Core. Der Server ruft sie beim Öffnen der Bestenliste (API) und am Saisonende auf. **Aufwand: klein bis mittel** (Server-Endpunkt nötig).

### D3 - BESTÄTIGT (A)
display.ts:188 filtert nach `leagueScorers`, und `leagueScorers` begrenzt auf 20.

### D4 - plausibel (A)
Nicht im Einzelnen gelesen.

### D5 - plausibel (A)
Keine `hit()` in der Pokalübersicht und der Bestenliste.

### D6 - BESTÄTIGT (S)
- **Original, 0x63B1:**
  - Je Manager in Reihenfolge prüft 0x63FE (bp+6 = Heim) und liefert m + 1 (0x6408).
  - Sonst prüft 0x63CE (bp+8 = Gast) und liefert `lea 0x81(%bx)` = 0x81 + m.
  - Die erste Übereinstimmung gewinnt.
- **Original, 0x18F76-0x18F8F:** `lcall 0x310:0x32b1` mit (Heim, Gast) und danach **ohne Maske** `movb $0x1,%es:0x1d13(%bx)`.
  - Bei einem Gastmanager landet die 1 in 4238:1D94 + m.
  - Die Stelle daneben, 0x18EEF, maskiert dagegen `and $0x7f`. Das zeigt, dass es sich um ein Versehen handelt.
- **Original, Abfrage:** 0x62C8 `cmp %ah,%es:0x1d14(%si); je` (ah = 0) überspringt Manager ohne Merker. 0x18E64 hatte alle Merker vorher auf 0 gesetzt.
- **Remake:** würfelt für beide Seiten, originaltag.ts:366 (`vorfaelleInVerlaengerung`) und live.ts:443 (`vorfaelle`).
- **Häufigkeit:**
  - Jede DFB-Verlängerung, in der ein Manager Gast ist. Durch die Heimrechtregel für Unterklassige ist ein Bundesligamanager oft Gast.
  - Manager gegen Manager: Nur der Heimmanager bekommt den Merker, und auch er nur, wenn er in der Managerreihenfolge zuerst kommt.
  - Etwa einige Male je Saison. Folge: zusätzliche Karten-, Verletzungs- und Moralwürfe.
- **Korrektur:** live.ts: `vorfaelle` in der Verlängerung nur für die Seite, die der Merker trifft. Das ist `e.managerHome`, und zwar nur, wenn kein Manager mit kleinerem Index Gast dieses Spiels ist (Nachbau von 0x63B1). originaltag.ts:366 genauso.
  - Die Nebenwirkung auf den Bestenlistenspeicher 1D94 ignorieren.
  - **Aufwand: klein.**

### D7 - BESTÄTIGT (S, selten)
- **Original, Folge in 0x18FC2:**
  - 0x19039 fragt nach der Zeremonie (0x17C26), 0x19047 `incb 4238:0008`.
  - 0x190FC: nur bei 57C8 ≠ 0 geht es nicht nach 0x191D0, sondern weiter mit 0x19111 `decb`, der Ziehungsanzeige und 0x19185-0x191B6 (bei DFB 0x18DA7 für alle Plätze mit der alten Runde).
  - 0x191C2 `incb`, dann 0x191D0-0x19201 ein zweiter Durchlauf.
- **Original, 0x18DA7:** Tauscht nur, wenn Klasse(Heim) = 4, Klasse(Gast) < 4, `cmpb $0x4,%es:0x8; jae` (Runde < 4) und der Platz ungerade ist.
  - Mit Runde r = 3 tauscht also der erste Durchlauf, der zweite nicht.
  - Bei r < 3 tauschen beide nicht doppelt, weil nach dem Tausch der Heimverein nicht mehr Klasse 4 hat.
- **Wann:** Die Abfrage gibt es bei r = 3 (07D6[3] = 4 Paare, nicht < 4). Das Heimrecht im Halbfinale hängt also an "ABER KLAR".
- **Remake:** europa.ts:197 `nextRoundDraw`, Server-Abfrage erst danach (server.ts:1969). Das Remake kennt nur den Fall ohne Zeremonie.
- **Häufigkeit:** Ein Unterklassiger muss im DFB-Halbfinale gegen einen Bundesligisten auf dem Gastplatz stehen, und die Zeremonie muss gewählt sein. Das ist selten. Keine Würfel, nur die Paarung.
- **Korrektur:** `nextRoundDraw(g, cup, rng, zeremonie)`: bei DFB und Zeremonie zuerst `lowerClassHome` mit der alten Runde. Der Server muss die Abstimmung dann **vor** der Auslosung einholen, oder die Auslosung merkt sich den Tausch und wendet ihn nach dem Ja nachträglich an.
  - Das Zweigbuch 18FC2 ergänzen.
  - **Aufwand: mittel** (Ablauf der Abstimmung).

### D8 - BESTÄTIGT (A)
0x17C77-0x17C83: bei DFB und `-0x12` (07D6[Runde]) < 4 folgt 0x17F89 (57C8 = 1 ohne Frage).

### D9 - BESTÄTIGT (S)
- **Original:**
  - 0x1BF88 `cmpb $0x0,0x18(%bp)`: Gelb-Rot bucht Byte 2 +1 und Byte 1 −1, glatt Rot Byte 0 +1.
  - Beide laufen nach 0x1C0A7: `mov $6,%al; mulb 0x18(%bp); sub $7; neg`, dann `push ax` (bp+8 = hi = 7 − 6f), `push 1` (bp+6 = lo), `lcall 0x76b:0xcc7`.
- **Wurf:** 0x8377 ruft bei 0x8389 immer rand() auf (`lcall 3a01:17be`), auch bei lo = hi. Bei Gelb-Rot bleibt also ein Wurf random(1,1).
- **Remake:** incidents.ts:164 `l.setU8(13, 1)` ohne rng. Das Zweigbuch 1B223 Zeile K nennt die Formel `random(1, 7 - 6·GelbRot)` ausdrücklich, und der Code folgt ihr nicht.
- **Häufigkeit:** jedes Gelb-Rot eines Managerspielers, alle paar Spieltage. Die Würfelfolge verschiebt sich um einen Wurf, alle folgenden Chancen, Karten und Ergebnisse des Tages ändern sich.
- **Korrektur:** incidents.ts:164 `l.setU8(13, rng(1, 1))`. **Aufwand: klein.**

### D10 - BESTÄTIGT (A)
goals.ts:58-61 `addRating` begrenzt auf −128..127.

### D11 - BESTÄTIGT (A)
main.ts:7093 `mine.has(club)`.

### D12 - BESTÄTIGT (A)
display.ts:228 `% 10` ohne Zusatz.

### D13 - plausibel (A)
Nicht im Einzelnen gelesen.

### D14 - plausibel (A)
Nicht im Einzelnen gelesen.

### D15 - BESTÄTIGT (D)
SPIELMECHANIK.md:1111ff. MEMORY-MAP.md:32-33 nennt "Spieltag" und "Zähler".

---

## Gruppe H

### H1 - BESTÄTIGT (S)
- **Original, 0x11D0D:** 0x11D1E `lcall $0x0,$0x20e1` (Bau) kommt vor dem Lagerwurf 0x11D59 und dem Bankwurf 0x11DA9.
  - 0x020E1 meldet ein fertiges Bauwerk über `lcall $0x3091,$0x190` = 0x30AA0 (0x022E2) oder über `call 0x239e` (0x02346 → 0x023F3 wieder 0x30AA0).
- **Original, 0x30AA0:** hat vor 0x30B0A keinen bedingten Sprung. 0x30B0A `push 3; push 0; lcall 0x76b:0xcc7` würfelt random(0,3) also immer.
- **Remake-Server:** server.ts:1749-1759 (`finanzTag`) macht `advanceCampOpen`, dann `rng(0,60)`, dann `dailyConstruction`.
  - Beim Bau gibt es keinen Wurf.
  - `pushMessage` (server.ts:985) würfelt nicht.
  - Das Datum ist `dt` ohne Rückdatierung.
- **Vergleichslauf:** originaltag.ts:87/243/610 macht es richtig (`rng(0,3)` je fertigem Bau vor den Lagern). Der Server weicht also vom geprüften Nachbau ab und ist verdächtig.
- **Häufigkeit:** jede Fertigstellung, einige Male je Saison und Manager. Die Würfelfolge verschiebt sich um einen Wurf, außerdem stimmt die Reihenfolge Bau → Lager → Bank nicht.
- **Korrektur:** server.ts `finanzTag`:
  1. Die Schleife `dailyConstruction` vor `advanceCampOpen` setzen.
  2. Je Bau `const z = r.rng(0, 3)` würfeln und das Datum wie bei `datum(zurueck)` (server.ts:2046) zurücksetzen.
  3. SPIELMECHANIK.md:363 berichtigen.
  - **Aufwand: klein.**

### H2 - BESTÄTIGT (S)
- **Original:** 0x0D55E `lcall $0x3091,$0x190` (0x30AA0, Wurf random(0,3)) kommt vor 0x0D576 (anzeigen), 0x0D588 (0x30954 löschen), 0x0D5A4 (0x1FDBE entfernen) und der Neubelegung ab 0x0D5C6.
- **Remake:** seasonEvents.ts:278-284 würfelt vor `removeFromSquad` und `neuBelegen` nicht.
- **Tests:** Der Saisonwechsel-Vergleichstest (originaltag.test.ts:316) deckt das nicht ab, denn KP-SAISON-START hat keinen Kandidaten mit Byte 11 = 0 und Byte 24 Bit 7 (vh2.mts).
- **Häufigkeit:** jeder Rücktritt eines Managerspielers am Saisonende, gelegentlich. Alle folgenden Würfe des Saisonwechsels verschieben sich.
- **Korrektur:** seasonEvents.ts vor `removeFromSquad` `rng(0, 3)` würfeln. Den Wert nicht verwenden, oder ihn für die Meldung nutzen.
  - Teil A: server.ts:1300 legt die Meldung dauerhaft ab (`pushMessage`). Treu wäre ein Hinweiskasten (`r.hinweise`).
  - **Aufwand: klein.**

### H3 - plausibel (A)
server.ts:2044-2080 bündelt die Meldungen nach Art. Die Verletzung steht zuletzt und ohne `datum(zurueck)`.

### H4 - BESTÄTIGT (S, Dokulücke)
- Der Server hat keinen Autosave und keine Würfe dafür (grep: keine Stelle 5256/autosave). SPIELMECHANIK.md:369 nennt das bewusst, ABWEICHUNGEN.md nicht (dort nur "Speichern", Zeile 18).
- **Häufigkeit:** dreimal je Saison, je vier Würfe.
- **Korrektur:** in ABWEICHUNGEN.md eintragen (klein) oder im Server am Monatsletzten mit Monat % 4 = 0 viermal würfeln (klein).

### H5 - BESTÄTIGT (A)
- **Original, 0x34BF3-0x34C45:**
  - `andb $0x7,-0x8(%bp)`, dann `test $0xfff8` auf dem maskierten Byte: schlägt nie an.
  - Nur der Weg mit Bit 7 (+20, Sprung nach 0x34C05) testet das volle Byte.
  - Die Grenze ist `min(07E2, 50)` (0x34BDA-0x34BE9).
  - Die Division rundet gegen null (`cwtd; sub %dx,%ax; sar`, 0x34C79).
- **Remake:** highscore.ts:57-62 prüft `lg & 0xf8` auf dem vollen Byte.

### H6 - plausibel (A)
highscore.ts:138 (`points <`) und :144 (`out.sort`) stimmen mit der Beschreibung.

### H7 - BESTÄTIGT (A/D)
highscore.ts:28-32 und SPIELMECHANIK.md:1498-1499 nehmen nur das Startjahr.

### H-Nebenbefund 0x0D615 - BESTÄTIGT (S)
- **Original:**
  - 0x0D615 `random(0,6)`, dann 0x0D628 `imulw -0x7c(%bp)` und `mov %cl,%es:0x57fd(%bx)` (Byte 32).
  - Alter und Werte davor gehen an `-0x7a` (0x0D5D2).
  - `-0x7c` setzt 0x0CF96 (Jugendspieler) bzw. die Schleife 0x0CC7F-0x0CCE7 (Endwert 6).
- **Remake:** seasonEvents.ts:210 `p.setU8(32, rng(0, 6))` beim neu belegten Spieler.
- **Wirkung:**
  - Die Würfe sind gleich.
  - Im Original behält der neue Spieler sein altes Byte 32, und ein fremder Spieler bekommt es überschrieben.
  - Byte 32 geht in `positionFit` (strength.ts:95), goals.ts:14 und lineup.ts:132 ein, ist also spielrelevant.
- **Häufigkeit:** jede Neubelegung am Saisonwechsel (viele je Saison).
- **Korrektur:** In `neuBelegen` den Zielspieler für Byte 32 übergeben (zuletzt angelegter Jugendspieler bzw. Spieler 6). 0CB62.md Zeile J berichtigen. **Aufwand: klein bis mittel** (das Ziel muss durchgereicht werden).

---

## Übersicht

| ID | Urteil | Häufigkeit | Aufwand |
|---|---|---|---|
| G1 | BESTÄTIGT (durch alle Spielstände belegt) | bei jedem neuen Rekord k = 3/6, anfangs oft | klein |
| G2 | BESTÄTIGT | nur solange Rekorde leer sind (1. Saison) | klein |
| G3 | BESTÄTIGT | selten (Vereinswechsel, verlegtes Spiel) | klein |
| G4 | BESTÄTIGT, dazu: Zeitungsmatrix und Anpfiffmatrix | jeder Ligaspieltag mit Manager und jeder Nachholtag | mittel |
| G5-G16, G20 | BESTÄTIGT bzw. plausibel (A) | Anzeige/Bedienung | klein |
| G17 | BESTÄTIGT | jedes ausverkaufte Managerheimspiel | klein |
| G18 | BESTÄTIGT, aber A (keine Würfel) | Schlagzeile 9 bei hoher Niederlage | klein (nach DOSBox) |
| G19 | BESTÄTIGT | nur bei abgeschalteter Zeitung | klein |
| G7, G8, G14, G21 | BESTÄTIGT (D) | Doku | klein |
| D1 | BESTÄTIGT | häufig in Spielen mit KI-Vereinen ≥ 10 Spielern (Manager unterhalb BL); sonst nie | klein |
| D2 | BESTÄTIGT | selten | klein-mittel |
| D3-D5, D8, D10-D14 | BESTÄTIGT bzw. plausibel (A) | Anzeige/Bedienung | klein |
| D6 | BESTÄTIGT | DFB-Verlängerung mit Gastmanager, einige Male je Saison | klein |
| D7 | BESTÄTIGT | selten (Unterklassiger im Halbfinale, Zeremonie an) | mittel |
| D9 | BESTÄTIGT | jedes Gelb-Rot eines Managerspielers | klein |
| D15 | BESTÄTIGT (D) | Doku | klein |
| H1 | BESTÄTIGT (Server weicht von originaltag ab) | jede Fertigstellung eines Baus | klein |
| H2 | BESTÄTIGT (kein Test deckt es ab) | jeder Rücktritt am Saisonende | klein |
| H3 | plausibel (A) | Tage mit mehreren Meldungen | klein |
| H4 | BESTÄTIGT (Eintrag in ABWEICHUNGEN fehlt) | dreimal je Saison | klein |
| H5-H7 | BESTÄTIGT bzw. plausibel (A/D) | Bestenliste | klein |
| H-Neben 0x0D615 | BESTÄTIGT (S) | jede Neubelegung am Saisonwechsel | klein-mittel |
