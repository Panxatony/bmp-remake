# Audit 2, Gruppe E, Teil 3: 0x1FDBE bis 0x224A8

Gelesen am 26.9.2026. Hinweis zur Disassembly: Nahaufrufe `call 0x2xxxx` im Segment 1ecd zeigen auf
0x1xxxx (z. B. `call 0x2ff36` bei 0x20EFC = 0x1FF36). Die Rohdaten nennen deshalb für 0x1FF36 und
0x1FFFA "0 Aufrufer"; tatsächlich ruft 0x20EFC die 0x1FF36 und 0x213A3/0x21552/0x21AEE/0x21BB7/0x21BC8
die 0x1FFFA.

Kaderplatz (52 Bytes, 4238:774A + 52·(25·Manager + Platz)): 0x7754 = Byte 10 (Rückennummer),
0x7759 = Byte 15 (Spieler), 0x7763/0x7764 = Byte 25/26 (Feldzelle). Alle Routinen hier arbeiten
auf der Liste 4238:304A (Manager am Zug, 4 = Markt).

| Adresse | Aufgabe | Remake (Datei:Funktion) | Urteil |
|---|---|---|---|
| 0x1FDBE | Kaderplatz entfernen: leerer Platz -> 1; fremder Spieler ohne Flag -> 0; Meldung freigeben; Plätze slot..count-1 bekommen den Nachfolger, Byte 15 von Platz count wird 0 | transfer.ts:removePlace | stimmt (Platz count selbst: Original löscht nur Byte 15, Remake den ganzen Platz; gleich, solange Platz 24/112 leer ist, s. unklar U3) |
| 0x1FEC9 | Starter (Byte 10 = 1..11, ohne Prüfung von Byte 15) auf Zelle (Spalte Byte 25, Reihe Byte 26) suchen, sonst 0x7F | lineup.ts:freieZelle (`belegt`), server.ts `/api/position` | stimmt |
| 0x1FF36 | Nur bei Byte 25 = 0xFF: Reihe 7 + 7·Pos/(−100) (idiv), 7 -> 6, erste freie Spalte 0..7, sonst nächste Reihe mit Umlauf | lineup.ts:freieZelle | stimmt |
| 0x1FFFA | Trikot eines Starters zeichnen (x 16·Spalte+0xC2, y 14·Reihe+0x63, Nummer) | web main.ts drawPitch | nicht nötig (Grafik) |
| 0x20105 | Einsatzregler zeichnen (Managerbyte 305) | web main.ts | nicht nötig (Grafik) |
| 0x20197 | Automatik aus: nur bei 079E > 1; Hinweis "Auto-Aufstellung ist deaktiviert !", 079E = 1 | server.ts `/api/position`, `/api/system` (System 1), Web-Client | stimmt (s. U4 zur Klickfläche) |
| 0x20230 | Kaderbildschirm (Zweigbuch 20230/20DBC) | Web drawSquad/pickRow, server.ts:uebernimmNummern, live.ts:applySubstitutions | Befund T3-2; Stichproben K1-K3, W1, W2, R5, R6 bestätigt |
| 0x2119D | Starter (Byte 10 1..11) in Platzreihenfolge 1.. neu nummerieren, ohne Prüfung von Byte 15 | lineup.ts:starterNummern | stimmt |
| 0x21328 | Trikots aller Starter zeichnen | web drawPitch | nicht nötig (Grafik) |
| 0x213B6 | Systemknöpfe zeichnen (079E − i = 2 hervorgehoben) | web | nicht nötig (Grafik) |
| 0x21567 | Zeigertext "ST[RKE:(16+17+18)/3, Alter JAHRE (Fuß 0x04D22)" | web main.ts:4713 | stimmt |
| 0x21696 | Taktikbrett: Systemknöpfe nur mit Arg 0x1A = 0 (außerhalb des Spiels) -> 079E = Knopf+1, 0x22030, 0x2119D; Feld: Spalte (x−0xC2)/16 ≤ 6, Reihe (y−0x63)/14 ≤ 7; aufnehmen/ablegen/tauschen von Byte 25/26; jeder Linksklick aufs Feld -> 0x20197 | server.ts `/api/system`, `/api/position` | stimmt (R6/R7) |
| 0x21E40 | Statusspalte: Flag Byte 9 & 3 (Flag 1 nicht bei 513E) -> 4cb3:22FC[Flag] ("GESP."+"("+Byte 13+")", "VERL.", " "); sonst 22FC[3 + (Nr ≥ 1) + (Nr > 11)] = " ", "IM TEAM", "RESERVE" | web main.ts:4655 | stimmt (Nr 0 und Flag 3 zeigen " ", Remake "" bzw. " " - gleiches Bild) |
| 0x22030 | Aufstellungsautomatik (Zweigbuch 22030, Emulatortest) | lineup.ts:autoLineup/aufstellungKern | stimmt (bewusst: kleine Bank, ABWEICHUNGEN) |
| 0x22305 | Spielerwahl | lineup.ts:selectPlace | stimmt (Zweig für Zweig nachgelesen: Richtung, `any` vor der Gruppenprüfung, erster Torwart mit −1 übersprungen, weitere Stärke 1, Endebedingungen in derselben Reihenfolge) |
| 0x224A8 | Aufnahme in eine Liste: Marktgrenze 12, Kaderzahl > Grenze−1 bei fremdem Verein, Einfügestelle, Platz genullt, Byte 15/19/14/20/11/12/16-18/40, Vereinswechsel (Spieler 34/35 = 0, 36 = Verein) | newgame.ts:addToSquad, transfer.ts:kaderVoll | Befund T3-1; Reihenfolge unklar U1 |

## Befunde

### T3-1 (S) Neuer Kaderplatz bekommt im Original keine Rückennummer

Original: 0x224A8 holt einen genullten 52-Byte-Block (0x2256D `lcall 0x3930:0x10C` mit 0x34, 1) und
kopiert ihn auf den Einfügeplatz (0x2265B `lcall 0x35AC:0x304A`); danach werden nur Byte 15
(0x2267B), 19 (0x22691), 14 (0x22695), 11/12 (0x226A9/0x226B0), 16-18 und 40 geschrieben. Byte 10
bleibt 0. Im ganzen Programm schreiben nur 0x9CF7/0x9D39 (Hauptmenü), 0x1DA59, 0x20230-Teile,
0x2119D, 0x2208B-0x222ED (Automatik) und 0x23727 (Platz vor dem Listen auf 0 gesetzt) Byte 10
(`grep 'mov .*,%es:0x7754('`). Der Kauf (0x23E86 -> 0x224A8, danach 0x23EEE-0x23F6A Byte 9/23/13/0/1/2,
0x23F7E Leihe: ganzer Marktplatz, dessen Byte 10 seit 0x23727 bzw. 0x224A8 null ist) vergibt also
keine Nummer; eine Nummer kommt nur über die Automatik (0x24114 `lcall 0x1ecd:0x3360`, bei
manuellem System wirkungslos) oder von Hand.

Remake: transfer.ts:403 (`takeBack`), transfer.ts:568 (`completePurchase`), transfer.ts:603
(`completeLoan`) rufen `assignNumber` (transfer.ts:108-116: "0x224A8 vergibt Nummern ab 12"), das
die kleinste freie Nummer ab 12 setzt - bei belegter Bank 16, 17, ...

Folge im Originalmodus bei manuellem System: der Neue steht im Remake als RESERVE (Nummer 12..15 ist
Ersatzbank fürs nächste Spiel, im Spiel einwechselbar, weil `applySubstitutions` nur Nummer 0
abweist - live.ts:700), im Original ohne Nummer ("Spieler ist nicht aufgestellt", 0x208E1).
Auch die Spielerinfo wechselt von "KANN SPIELEN, DARF ABER SCHEINBAR NICHT..." zu "HÜTET DIE
ERSATZBANK". Nummern über 15 räumt das Original zudem im Hauptmenü ab (0x9D07-0x9D39: > 4238:56EE
-> 0, vorher 0x9CBB: 16 -> 15, wenn keine 15 vergeben ist) und beim Kaderbildschirm (s. T3-2) -
beides fehlt im Remake. Doku falsch: SPIELMECHANIK.md:1888 "(0x224A8, Nummer ab 12)".
(Die 2026-Wege jugend.ts:561, abwerben.ts:189, seasonEvents.ts:80, server.ts:926 sind Version 2026.)

### T3-2 (S) Auswechslung: der Herausgenommene bekommt im Original die kleinste freie Nummer ab 12

Original: vor jedem Klick in die Liste setzt 0x20661 `movb $0xc,-0xba(%bp)`; die Schleife
0x20689-0x20809 wiederholt sich, solange ein Platz die Nummer -0xba trägt (0x207A3-0x207B1
`incb -0xba`, 0x20802 `jmp 0x20689`) - -0xba ist danach die kleinste nicht vergebene Nummer ≥ 12.
Herausnehmen (0x20B12-0x20B1E): `cmpb $0x1,0x6(%bp); sbb %al,%al; inc %al; mulb -0xba(%bp); mov
%al,%es:0x7754(%bx)` - im Spiel (Arg 6 ≠ 0) diese Nummer, außerhalb 0. Beim ersten Wechsel mit
voller Bank 12..15 bekommt der Ausgewechselte also 16, der Eingewechselte wird 11 (0x20EF2) und
dann neu nummeriert; beim zweiten Wechsel ist 12 frei geworden, der zweite Ausgewechselte bekommt
12. Die 16 räumt das nächste Hauptmenü auf 0 (0x9D07-0x9D39, da 15 vergeben ist). Nach dem Spiel
sitzen damit der zweite Ausgewechselte und die unbenutzten Ersatzleute auf der Bank, der erste
Ausgewechselte hat keine Nummer mehr.

Dieselbe Schleife schreibt außerhalb des Spiels jede Nummer > 4238:56EE (15) auf die kleinste
freie aus 12..15, sonst 0 (0x207DB-0x207F0, 0x206BA-0x20730). Das ist die Zeile "20681-207F5
unklar, nicht nachgebaut" des Zweigbuchs 20230.

Remake: der Kaderbildschirm tauscht nur Nummern (server.ts:1059 `uebernimmNummern`, Web
`pickRow`); der Ausgewechselte erhält die Nummer des Eingewechselten (12..15) und bleibt dauerhaft
auf der Bank. Unterschied für Manager mit manuellem System: nach einem Spiel mit Wechsel hat die
Bank im Original einen Mann weniger (der erste Ausgewechselte ist draußen), im Remake bleibt sie
bei vier und enthält ihn. Sicher, weil die Nummernvergabe allein an -0xba hängt und kein anderer
Schreiber von Byte 10 dazwischen liegt (Liste oben). Das Zweigbuch 20230 bewertete 20ACD-20B55 mit
"stimmt" nur nach erreichbaren Aufstellungen im Spiel, nicht nach dem Stand danach.

## Unklar

- **U1 Einfügestelle in 0x224A8.** Der Code fügt in jede Liste (auch die Managerkader) vor dem
  ersten Platz ein, dessen Spieler-Index ≥ dem neuen ist (0x22584 `cmp %al,%es:0x7759(%bx); jae`,
  Abbruch an einem leeren Platz oder bei Platz 24), und schiebt 23..i um eins nach hinten
  (0x225EC-0x2262F). Das Remake macht das nur für den Markt; Managerkader ordnet `sortIntoSquad`
  (lineup.ts:306) nach Mannschaftsteil, der Neue ans Ende seiner Gruppe (Begründung 0CB62.md:45).
  Da die Spielertabelle in den Ständen nach Gruppen geordnet ist, unterscheiden sich beide Regeln
  nur innerhalb einer Gruppe (Einfluss auf Gleichstände in 0x22305, Seitentausch, Nummernfolge).
  Gegen die Codelesung spricht RIED-CLI.MAN (Original) Manager 2: Stürmer 114, 122, 145, **120** -
  mit Index-Einfügung nicht erreichbar, und außer 0x224A8 schreibt nichts Byte 15 (nur
  Blockkopien). Zur Klärung fehlt ein Emulatorlauf von 0x224A8 (tools/emu-routine.py) mit einem
  Kader, in dem ein kleinerer Index nach einem größeren derselben Gruppe kommt, oder die Herkunft
  dieses Kaders.
- **U2 Grenze der Aufnahme.** 0x224A8 prüft die Kaderzahl gegen Arg 0x10 − 1; die Aufrufer geben
  0x18, im Jahrgangswechsel 0x19 (0xD306) und im Kauf 0x18 + -0xA(bp) (0x23E72). Das Remake prüft
  immer > 23 (`kaderVoll`) bzw. im Jahrgangswechsel gar nicht (seasonEvents.ts:179), und
  `addToSquad` nimmt nur Plätze 0..23 - das Original kann über die Verschiebung Platz 24 belegen.
  Randfall (25. Spieler), Kaufteil gehört zu 0x22C15.
- **U3 1FDBE, letzter Platz.** Nur gleich, solange Platz 24 (Kader) bzw. 112 (Markt) leer ist; nach
  U2 kann Platz 24 im Original belegt sein.
- **U4 Klickfläche 20638.** Geklärt für das Zweigbuch: jeder Linksklick, der weder eine Zeile
  (si = 0x7F), noch den Regler, noch das Taktikbrett trifft (0x21696 liefert 1 nur nach Ablegen
  oder Systemknopf), ruft 0x20197 und schaltet die Automatik ab. Das Remake kennt so einen Klick
  nicht; reine Bedienung, kein Befund.

Außerhalb des Bereichs bemerkt: die Nummernpflege des Hauptmenüs 0x9C78-0x9D40 (siehe T3-1/T3-2)
fehlt im Remake ganz.
