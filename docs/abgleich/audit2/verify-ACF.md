# Gegenprüfung Audit 2, Gruppen A, C, F (26.9.2026)

Gelesen: all.s (mit da.sh für die Segmentvariablen), Remake-Stand bmp-remake, Tests in
packages/core/test, Spielstände ../bmp/*.MAN (Skript b9.mts). Im Repo nichts geändert.

---

## Gruppe C

### C1 - BESTÄTIGT (Steuer nach Gutschrift der Einnahmen; Kredite nach der Monatsabrechnung)

Original 0x11D0D, selbst nachgelesen:

```
11dfb..11e1f  Monatsletzter? (4cb3:07B8[Monat] == 4238:2EBA), sonst jmp 0x11fe7
11f0c  add %ax,%es:0x2424(%bx)        ; Jugendkonto += 4*Byte 319
11f13  lcall $0x14a4,$0x2636          ; 0x17076 Einnahmen (darin 0x17205-0x17240: Guthabenzins Summe/Tag/75)
11f1c  add %ax,%es:0x2432(%si)        ; Kontostand += Einnahmen   <- sofort gebucht
11f21  adc %dx,%es:0x2434(%si)
11f26  lcall $0x14a4,$0x2822          ; 0x17262 Ausgaben, liest jetzt den erhöhten Kontostand
11f43  sub %cx,%es:0x2432(%di)        ; Kontostand -= Ausgaben
11f62  Tagessumme 4cb3:0644 = 0, danach Fanwachstum
12002  movw $0x0,-0x36(%bp)           ; erst hier beginnt die Kreditschleife (Zinsen 0x120a0, Rückzahlung)
```

0x17262 ab 0x174A2: `cmpb $0x2,0x237a(%bx)` (Oberliga aus), `cmpw $0x1e,0x2434(%bx)` /
`cmpw $0x8480,0x2432(%bx)` (> 2.000.000), `(Konto-2.000.000)/500.000*30.000+20.000`, ab
0x3D0900 (4 Mio) *3/2. Es gibt keinen Parameter - die Steuer hängt am aktuellen Byte 496.

Remake finance.ts `dailyFinance`: Kreditschleife (Zeilen ~168-196) zuerst, dann am Monatsletzten
`monthlyExpenses` mit `m.i32(496)` **vor** der Gutschrift, erst danach `balance + income - expenses`.
Die Behauptung stimmt.

**Wer hat recht beim Test "RIED-CLI exakt"?** Beide. season.test.ts:162-176 prüft nur
`monthlyExpenses(g,0) === 1.172.205` als Einzelfunktion auf dem geladenen Stand - das ist die Zahl
aus dem Finanzbildschirm (REFERENZ-RIED-CLI.md:165), der 0x17262 für sich aufruft. Der Kontostand
dort ist 973.860 DM, Steuer 0 in beiden Fällen; selbst nach Gutschrift (973.860 + 883.584 + ~12.984
Zins = 1,87 Mio) bleibt er unter 2 Mio. Der Test deckt also weder die Aufrufreihenfolge noch die
Steuer ab; season.test.ts:208-210 (Monatsende) verwendet denselben Stand und bliebe auch nach der
Korrektur grün. Kein Widerspruch zum Original-Abgleich.

Wirkung/Häufigkeit: jeden Monat bei jedem Manager, dessen Kontostand nach Gutschrift der
Monatseinnahmen über 2 Mio liegt, sich aber vorher darunter befand (Steuerstufe verschoben:
bis zu 30.000 DM je Stufe, über 4 Mio x1,5) - bei erfolgreichen Vereinen in späteren Saisons
**häufig** (Monatseinnahmen liegen um 0,9 Mio). Dazu an Tagen mit Kreditzins/Rückzahlung am
Monatsletzten; in der Version 2026 bucht `fester` **alle** Kreditzinsen am Monatsletzten, dort
wirkt die Reihenfolge also bei jedem Kredit jeden Monat. Keine Zufallsfolge betroffen (Kredite
würfeln nicht; Fanwachstum bleibt nach der Abrechnung).

Korrektur: finance.ts `dailyFinance`: Monatsblock (Jugend, Werbung, Einnahmen inkl. Guthabenzins
auf Konto buchen, **dann** `monthlyExpenses` rechnen und abziehen, Summe nullen, Fans) vor die
Kreditschleife ziehen. Aufwand **klein**; Test mit Kontostand 1,9 Mio + Einnahmen 0,4 Mio
(erwartet 20.000 Steuer) und einer am Monatsletzten fälligen Rückzahlung ergänzen.

### C2 - BESTÄTIGT (Befehlsweg), Häufigkeit unklar/selten

0x102B9: `102ed mov 0x6(%bp),%al` (Gruppe, erstes Argument), `*0x26`, `+4cb3:225A[Gruppe]`
(ES -0x64dc = 4cb3), `*0x14`, `+0x8(%bp)` (Platz), `10319 cmpb $0x1e,%es:0x6dc8(%bx)` (ES -0x64da =
4238), `je -> 0x10605` (Ende). Aufrufer 0x0556C `lcall $0xf9d,$0x8e9` (=0x102B9) mit
`add $0xa,%al` auf -0x38 (Pokal) als letztes Push = bp+6, Platz -0x40 = bp+8. 4cb3:225A..226F im
Abbild: `[1,1,1,0,18,20,20,0,34,38,38,0,3,4,4,0,1,0,0,4,0,18]` → 225A[10..13] = 38,0,3,4.
Schreibzugriffe auf 225A[bx]: 0x1D93E/0x1E47B (Liga 0..2) und 0x2D110/0x2D138 (nur vorübergehend,
danach wiederhergestellt) - die Werte für 10..13 bleiben statisch. Adressen 0x8E70/0x8E70/0x91A4/
0x94B0 nachgerechnet. 4238:9164 = Spielbericht Manager 1 (0x1CDE9: `0x90CA + 0x9A*Mgr`) bestätigt.
Remake live.ts `beginMinute` würfelt `chanceCounts` ohne diese Prüfung.

Häufigkeit: nur Pokalsieger-Cup (Gruppe 12), nur mit ≥2 Managern, nur wenn in Bericht 1 an
91A4+Platz ein Byte 30 steht - statisch nicht bestimmbar, eher **selten**. Ändert dann die
Zufallsfolge. Korrektur: vor `chanceCounts` im Pokal das Byte an derselben Stelle nachbilden
(Bericht von Manager 1 bzw. Aufstellungen 113..115 für DFB/Landesmeister, Historie für UEFA).
Aufwand **mittel** (Spielbericht-Speicher müsste nachgebildet werden); vorher Emulatorlauf.

### C3 - BESTÄTIGT (A)
0x15656 `cmpb $0x1,-0x92(%bp)` / `jne 0x156b6` - Zähler nur bei Sperre. playerinfo.ts:52 zeigt
"NOCH n SPIELE VERLETZT (...)". Korrektur klein (Zeile 52 → `VERLETZT (${Art})`, SPIELMECHANIK:1417).

### C4 - BESTÄTIGT (A)
Schleife `157b8 cmpb $0x3,-0x92(%bp)` (drei Spalten), `1580c mov %es:0x3(%bx),%cl` Saison,
`15850 mov %es:0x22(%bx),%cx` Gesamt. playerinfo.ts liefert nur `[u8(3),u8(4)]`; SPIELMECHANIK:1424
("Europacup-Spalte entfällt") überholt. Aufwand klein-mittel (Daten + Tafel).

### C5 - BESTÄTIGT (D)
`14416 sub %bh,%bh`, `1442a cmp %bh,%es:0x226a` (ES 4cb3), `je 0x14476`; 4cb3:226A = 1 im Abbild,
einzige andere Stelle 0x1E4FC liest nur. Meldung ist im Original aktiv. ABWEICHUNGEN.md:38 und
messages.ts:93-94 falsch. Aufwand klein (Doku).

---

## Gruppe A

### A1 - BESTÄTIGT (S)
0x0602: nach der Zeilenwahl nur `07e9 cmpb $0x0,%es:0x577f(%bx)` / `je 0x814` (Sperre nach
Ablehnung). Ein Zugriff auf die Resttage (Stadionzeiger -0xa0, +0x36+2k) fehlt in 0x0602 - die
Treffer `push 0x44(%bx)` sind DS-Preistabellen (0x98A: `0x44+4k` ohne ES). 0x0000 rechnet laufende
Bauten ein: `010b random(20,80)`, `0120 mov %es:0x36(%bx,%si),%cx` (Resttage), `014a random(80,120)`,
und `041b..0433` wählt 4cb3:28A4 "BAUZEIT: INSGESAMT CA." wenn der Anteil ≠ 0 - der Fall ist also
vorgesehen. Remake main.ts:5961 `if (e.days || abgelehnt)` → "keine Baufirma"; Kasten immer
"CIRKA". Server-Cache `bauTage` (server.ts:3396) würde nach einer Korrektur beim zweiten Bau die
alte Zahl liefern (wird bisher nur durch die UI-Sperre verdeckt).

Häufigkeit: **häufig** (Bauzeiten 8-17 Wochen, in der Zeit ist die Art gesperrt). Korrektur:
main.ts `pickStadium` nur `abgelehnt` prüfen; Kasten bei `e.days > 0` "BAUZEIT: INSGESAMT CA.";
server.ts `/api/stadium/bauzeit` nicht über den Tag cachen bzw. nach `/api/stadium` den Eintrag
löschen. Aufwand **klein-mittel**.

### A2 - BESTÄTIGT (S)
0x053E-0x0570: `lcall 3091:11CC`, `cmpw $0x1,%es:0x2ea2 / jne 0x53e`, `or ... / je 0x53e` - nur ein
Linksklick auf einen der Knöpfe beendet die Schleife; Antwort 2 → `0584 random(15,55)` nach
4238:577F+Art, dann `jmp 0xdf` (Rückgabe -1). Remake main.ts:2682-2684 (Rechtsklick) und
`pickStadium` (Klick auf andere Zeile, 5965) schließen ohne `api/stadium/decline`.
Häufigkeit: jedes Mal, wenn ein Spieler die Rückfrage ohne Antwort verlässt - **häufig** und als
Umgehung nutzbar. Korrektur: im Kasten Rechtsklick/Zeilenwechsel sperren oder als "ACH NEE..."
werten. Aufwand **klein**.

### A3 - BESTÄTIGT (A)
`047b..048c`: ldiv(Bauzeit,7), `add $0x1,%ax`. stadium.ts:118 `Math.ceil(days/7)`. Unterschied bei
Tagen durch 7 teilbar (~1/7). Korrektur: `buildWeeks = trunc(days/7)+1` (identisch zu `restWochen`),
Aufwand klein. Die Messung (9 und 10 Wochen) passt zu beiden Formeln.

### A4 - BESTÄTIGT (A)
Größenzweig `114b jmp 0x12bb`, Statuszweig fällt durch; `12c9/12ce push 4cb3:28CA/28C8` =
"MAX. STATUS: " (aus dem Abbild). main.ts:5805 nimmt für Art ≤ 5 ui.stadium[3] = "MAX. GR|~E: ".
Aufwand klein.

### A5 - BESTÄTIGT (A)
`0a7c..0a86` (Kontostand/Preis = 0 → 4cb3:4CE8 "Kein Geld f}r / neue Pl{tze da..."), `0f03 cmp
%si,%di / jne` (→ 4CF0 "Was denn...? / NOCH besser ???"), `0f5d..0f7f` (→ 4CF8 "Da m}ssen Sie erst /
noch sparen..."); Texte im Abbild nachgelesen. Remake zeigt keinen Hinweis. Aufwand klein.

### A6 - BESTÄTIGT (D)
ABWEICHUNGEN.md:26 und SPIELMECHANIK.md:832f. beschreiben den Zustand vor #55. Aufwand klein.

### A7 - BESTÄTIGT (S, Randfall)
0x36F1: `388f incb -0x6(%bp)`, `3892 cmpb $0x5a,-0x6(%bp)`, `3896 jae 0x389b` (Rückgabe 0) - Suche
nur bis Tag 89. postpone.ts:41 läuft bis `calendar.length` (95). Kalenderbytes im Abbild: Tag 89 = 0,
90 = 7, 91/92 = 0x10, 93/94 = 0 → 93/94 wären "frei". Nötig ist, dass alle freien Tage 59..89
(61, 71, 73, 75, 79, 83, 85, 87, 89 ...) voll oder durch Vereinskonflikte belegt sind - bei 20
Tabellenplätzen **praktisch nie**. Korrektur: `d < 90` in `replayDay`, Aufwand klein.

---

## Gruppe F

### F1 - TEILWEISE (Mechanik stimmt, tritt so im Original kaum auf)
0x24D4E: `250c6 testb $0x80,%es:0x9(%bx)`, `250cd cmpb $0x3f,%es:0x16(%bx) / jbe`, dann
`250f9 random(95,100)` (sonst ·130/100). Aufrufe mit Flags 5 aus 0x25C2F und 0x24C66 bestätigt.
value.ts:78 nimmt ohne rng fest 97; contracts.ts ruft ohne rng.

Aber: Bit 7 von Kaderbyte 9 setzt im Programm nur 0xE17C (`orb $0x80`, Marktschleife); die
Kaderschleife 0xEB0B setzt Bit 6. Auf einem eigenen Kaderplatz steht Bit 7 im Original nur, wenn
ein Manager einen Marktspieler eines anderen Managers mit KI-Angebot kauft: 0x23EEE kopiert Byte 9
**unmaskiert** vom Marktplatz (`mov %es:0x9(%bx),%al` → `0x7753`), das Remake maskiert dort mit
`& 0x3f` (transfer.ts:559). In allen Spielständen (1742 belegte Kaderplätze) ist Byte 9 Bit 7 nie
gesetzt. Beim Kauf verhandelt das Original über den frischen Kaderplatz (Bit 7 leer), das Remake
über den Marktplatz, der bei Manager-Marktspielern Bit 7 tragen kann → dort rechnet das Remake
·97/100, wo das Original gar keinen Faktor hat (gehört zu F2).

Häufigkeit **selten**. Korrektur: `rng` an `playerValue` in contracts.ts durchreichen (klein) und
in `completePurchase` Byte 9 unmaskiert übernehmen (klein) - wirksam erst zusammen mit F2.

### F2 - BESTÄTIGT (S)
0x23E86 `lcall $0x1ecd,$0x37d8` (=0x224A8, würfelt Byte 19 bei 0x22687 und ruft 0x2277A:
Byte 14/20), danach - nur ohne Leihe (`-0xa`, `-0x8` = 0) - `23ed8 call 0x251ff` mit `push %di`
(neuer Platz) als erstem Argument; bei Rückgabe 0 → 0x2411C (Platz wieder entfernen). Die Kopie
der Marktdaten (Byte 9/23/13/0/1/2) kommt erst ab 0x23EE5. Im Dialog: `25fe9` Zustand 1 →
`26012 cmpw $0x0,-0x6(%bp) / jne` → `26029 call 0x249e0` - jede Einigung ohne Spielerangebot läuft
über 0x249E0. Remake: `buyOffer` rechnet vier Forderungen am Marktplatz (transfer.ts:527),
server.ts:3257ff. prüft nur ein eigenes Gehalt, sonst wird die Forderung ungeprüft übernommen;
`completePurchase` → `addToSquad` würfelt danach.

Häufigkeit: **jeder Kauf vom Markt** (häufig). Wirkung: andere Forderung/Mindestgehalt, fehlende
Absagen (Würfel, 100.000-Grenze), andere Wurfreihenfolge. Korrektur: transfer.ts/server.ts - Kauf
in `addToSquad` zuerst ausführen, dann Forderung/Prüfung über den neuen Kaderplatz
(`salaryDemand`/`contractCheck` ohne `source`), bei Absage/ABBRUCH Platz entfernen
(0x2411C) und Byte 24 = random(10,18); Aufwand **mittel**.

### F3 - BESTÄTIGT (S)
`255c9 testb $0x80,-0x6(%bp)` (Ruhestand), `255f3 cmp $0x63,%ax / jle`, `255f8 subw $0x64,-0x6(%bp)`
→ Dialog mit angebotenen Jahren; 0x25FB8-0x25FE4 vergleicht Jahre/Gehalt, `26012` überspringt
0x249E0 bei -0x6 ≠ 0. Remake main.ts:4697 `l.u8(24) > 0 && !(l.u8(24) & 0x80)` → "nicht
verhandlungsbereit" für 100..127; `/api/contract` wird vom Client nie aufgerufen (grep). Häufigkeit:
**gelegentlich** (jede Verlängerungsmeldung eines Spielers). Korrektur: main.ts Verlängerungs-Klick
bei 100+J den Dialog mit J Jahren öffnen und `/api/contract` benutzen; `acceptOffer`: Gehalt ohne
Eingabe = Byte 40, ohne `contractCheck`. Aufwand **mittel**.

### F4 - BESTÄTIGT (S)
`255c9 testb $0x80,-0x6(%bp)` → 4cb3:4EF4.. "wird sich mit Ablauf des Vertrages zur Ruhe setzen.",
Ende. Remake: main.ts:4697 lässt Bit 7 durch, `/api/newcontract` prüft nichts, setzt Byte 24 =
random(10,18) → Rücktrittsbit weg. Häufigkeit: **gelegentlich** (Spieler 33-35 mit Ankündigung,
wenn der Manager es versucht). Korrektur: Prüfung in main.ts und server.ts `/api/newcontract`.
Aufwand **klein**.

### F5 - BESTÄTIGT (S)
0x25F4D-0x25FB3: Zustand 1, Jahre (-0x4) > -0xe6 (= Byte 11, 0x25A3C) und -0xe (= Byte 40,
0x25A4C/0x25A54) > Gehalt (-0x3c) → 4cb3:4F1C/4F20/4F24 "So dumm" / "ist" / "leider nicht...",
Zustand 2, kein 0x249E0. Remake server.ts:2878 würfelt immer. Häufigkeit: **selten** (nur wenn der
Spieler länger und billiger anbietet), aber ausnutzbar. Korrektur: Vorprüfung vor `contractCheck`
in `/api/newcontract` (und Kaufpfad), Aufwand klein.

### F6 - BESTÄTIGT (S)
0x25A33 "zu lange" → Zustand 2; `25fe9`/`25ff7` jeder Zustand ≠ 1/3 → 0x26165 → `26195
random(10,18)` → `261a8` Byte 24. Remake: server.ts:2876 kehrt bei "zu lange" ohne Wurf zurück;
ABBRUCH nach Eingabe (main.ts:4451) nur clientseitig. Am Saisonende (vertragsendeFreigeben) verlässt
der Spieler den Kader ohnehin - dort ohne Wirkung. Häufigkeit: **gelegentlich**. Korrektur:
server.ts Wurf bei "zu lange", eigener Endpunkt/Flag für ABBRUCH nach Eingabe. Aufwand klein.

### F7 - BESTÄTIGT (bewusst festzuhalten)
0x26A85 Taste, `26aa1 lcall 3930:043A` Farbe, `26aa9 cmp $0xb,%ax`; Verteiler 0x26AC1: 's' (0x73),
'0'..'5' → `26c39 mov $0x35,%al; sub -0x6(%bp),%al; mov %al,0x4a28`, 'a', 'd', 'g', 'p'
(`26c26 movb $0x1,0x5f5`). Nicht im Remake, nicht in ABWEICHUNGEN. Häufigkeit: nur wer sie kennt.
Korrektur: ABWEICHUNGEN-Eintrag (Aufwand klein); Nachbau unnötig.

### F8 - BESTÄTIGT (S) - deckt sich mit E18
0x235D4-0x235DD: `push $0x18, $1, %si` → `lcall $0x1ecd,$0x10ee` (0x1FDBE; kopiert ab 0x1FE61 die
folgenden 0x34-Byte-Plätze nach vorn). Danach mit dem **unveränderten** Zeiger -0x24:
`235e8 mov %es:0x16(%bx),%al` (Byte 22), `235f0 mov %ah,%es:0x16(%bx)` (nullt), `23601 mov
%al,%es:0x5801(%bx)` (Spielerbyte 36 des verkauften Spielers, Index -0x2), `2360b..2362d` Bytes
0x10..0x12 /3, `23639 lcall $0x14a4,$0x23da` (0x16E1A) mit Verein = eben gelesenes Byte 22. Alles
vom Nachrücker (bzw. vom leeren Platz, wenn der Verkaufte der letzte war → Verein 0, Schnitt 0).
Remake transfer.ts:455-462 (`decideSale`) liest `avg`/`club` vorher vom Verkauften. Kein Test auf
Originaldaten (transfer.test.ts:117 setzt Byte 22 künstlich). Nicht in ABWEICHUNGEN.

Häufigkeit: **jeder Verkauf eines Kaderspielers auf ein KI-Angebot** - häufig. Wirkung: Spieler
landet im Original meist bei Verein 0 (Byte 22 des Nachrückers, meist 0), falscher Verein wird
gestärkt, Angebotsverein des Nachrückers gelöscht (dessen Bit 6 bleibt). Korrektur: in
`decideSale` für `where === "squad"` erst `removePlace`, dann `club`/`avg` vom Platz lesen und
Byte 22 dort nullen (Marktpfad unverändert) - oder bewusst als Abweichung eintragen, falls der
Fehler des Originals nicht übernommen werden soll. Aufwand **klein**.

### F9 - BESTÄTIGT (S)
0x23474 Zeiger auf den Kaderplatz, `2347a testb $0x80,%es:0x18(%bx) / je 0x234a4`, sonst
4cb3:4D74/4D78 "Dieser Spieler h|rt / am Saisonende auf." und Ende (0x2429F) - **vor** dem
Angebotstest `234ae testb $0x40,%es:0x9(%bx)`. `saleOffer` prüft Byte 24 Bit 7 nicht (listPlayer
schon, transfer.ts:372). Erreichbar: Bit 6 verfällt nur mit 1/4 je Tag, die Ankündigung kann
dazwischen kommen. Häufigkeit **selten**. Korrektur: `saleOffer` bei `where === "squad"` und
Bit 7 null/Meldung "ui.hoertauf". Aufwand klein.

### F10 - BESTÄTIGT (A)
main.ts:6818 zeigt `sale.fee` (Netto) und "(n Jahre Vertrag)". Plausibel wie beschrieben; klein.

### F11 - BESTÄTIGT (A)
0x2557D-0x255BE: Name, 4cb3:4EEC "ist leider von", `4238:3066 + 34·(Byte12 & 0x7F)`, 4EF0
"nur ausgeliehen.". main.ts:4694 ohne Verein. Klein.

### F12 - BESTÄTIGT (A)
`26127 push 4cb3:4F32/4F30` ... = "ist nicht an" / "Ihrem Angebot" / "interessiert." (Abbild).
main.ts:4471 zeigt immer "So dumm ...". Klein.

### F13 - BESTÄTIGT (A+D)
`26d37 cmpw $0x110`, `26d43 cmpw $0xca`, `26d52 sub $0xca` → 0..70. SPIELMECHANIK:899 "0 bis 75",
main.ts:7169 `*75/8`. Klein.

### F14 - BESTÄTIGT (A)
`28892 cmpb $0x0,0x6(%bp)` (Restmonate 0 → 4cb3:4AAC "K}NDBAR"). main.ts:5601 "SPONSOREN
ANSEHEN". Klein.

### F15 - BESTÄTIGT (A)
0x29765-0x2979E: Startsponsor aus 4238:4B9B[2·(6m+Platz)] bzw. 4238:0001[2m]; main.ts:5593
`werbungOffer = 0`. Klein.

### F16 - BESTÄTIGT (A)
`2993a cmpw $0x53 / cmpb $0x9 / incb`, `29949 cmpw $0x52 / cmpb $0x0 / decb` - oben hoch bis 9,
unten runter bis 0, kein Umlauf. main.ts:5616f. umgekehrt, modulo 10. Klein.

### F17 - BESTÄTIGT (A, Bedienung)
0x29737-0x2975B prüft nur Klickfläche und Ansichtszustand, nicht den laufenden Vertrag;
main.ts:5595 zeigt bei `cur.months > 0` keine Ansicht. Klein.

### F18 - BESTÄTIGT (A, Bedienung)
`29420 cmpw $0xd8`, `2942a $0x135`, `29431 $0xb9`, `29438 $0xc5`, `29442 cmpw $0x107` (Teilung
bei x 263). main.ts:5635f. teilt bei 254. Klein.

### F19 - BESTÄTIGT (A, Grafik)
`2a2cf testb $0xf,-0x2(%bp) / je 0x2a2fe`. Klein.

### F20 - BESTÄTIGT (D)
q = ((t/6+110)·8)/10 mit t = 0..400 → 88..141 (Forderung mit 122: 97..150). contracts.ts:32f./68f.,
SPIELMECHANIK:2086 falsch ("q nur 1 oder 2", "rund 5 %"); Code rechnet richtig. Klein.

### F21 - BESTÄTIGT (D)
docs/abgleich/251FF.md:28 und :30 urteilen falsch (siehe F5, F12). Klein.

---

## Übersicht

| ID | Urteil | Häufigkeit | Aufwand |
|---|---|---|---|
| A1 | BESTÄTIGT | häufig | klein-mittel |
| A2 | BESTÄTIGT | häufig (Umgehung) | klein |
| A3 | BESTÄTIGT (A) | ~1/7 der Bauten, Anzeige | klein |
| A4 | BESTÄTIGT (A) | immer, Anzeige | klein |
| A5 | BESTÄTIGT (A) | gelegentlich, Anzeige | klein |
| A6 | BESTÄTIGT (D) | - | klein |
| A7 | BESTÄTIGT | praktisch nie | klein |
| C1 | BESTÄTIGT | monatlich ab ~2 Mio Kontostand; 2026 bei jedem Kredit | klein |
| C2 | BESTÄTIGT (Befehlsweg) | selten/unklar | mittel |
| C3 | BESTÄTIGT (A) | bei jeder Verletzung, Anzeige | klein |
| C4 | BESTÄTIGT (A) | immer, Anzeige | klein-mittel |
| C5 | BESTÄTIGT (D) | - | klein |
| F1 | TEILWEISE | selten | klein |
| F2 | BESTÄTIGT | jeder Marktkauf | mittel |
| F3 | BESTÄTIGT | gelegentlich | mittel |
| F4 | BESTÄTIGT | gelegentlich | klein |
| F5 | BESTÄTIGT | selten (ausnutzbar) | klein |
| F6 | BESTÄTIGT | gelegentlich | klein |
| F7 | BESTÄTIGT (Doku) | nur bei Kenntnis | klein |
| F8 | BESTÄTIGT | jeder Kaderverkauf an KI | klein |
| F9 | BESTÄTIGT | selten | klein |
| F10-F19 | BESTÄTIGT (A) | Anzeige/Bedienung | klein |
| F20, F21 | BESTÄTIGT (D) | - | klein |
