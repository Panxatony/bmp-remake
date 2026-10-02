# Audit 2026, zweiter Durchgang - Bereich S (Spielbetrieb und Jugend)

Stand 2.10.2026, Repo bei d5b503d (#144). Nur gelesen; Belegskripte in `scratchpad/s/`
(`wechsel5.ts`, `jugend1.ts`, `jugend2.ts`, `aufruecken.ts`, `ablauf.ts`), alle gegen
`../bmp/RIED-CLI.MAN` bzw. alle 70 Stände in `../bmp` und `tools/dosbox`.

## Geprüfte Funktionen

| Funktion | Code | Urteil |
|---|---|---|
| `winPoints`: Tabelle `applyResult`, Sortierung `tableOrder` | standings.ts:32, 66ff | in Ordnung (3 Punkte, max. 57 je Seite passt in ein Byte) |
| Tabellenmeldungen gesichert/verspielt | messages.ts:54-80 | in Ordnung (A14 bleibt behoben) |
| Relegationsmeldung | messages.ts:96-104 | in Ordnung (platzbasiert, punktunabhängig) |
| Ewige Bilanz `saisonbilanz` | season.ts:290-312 | in Ordnung (A15 behoben; Original weiter 2·Spiele - Punkte) |
| Ewige Bilanz Anzeige PUN. (B12) | display.ts:442 | in Ordnung |
| Ewige Tabelle `ewigkeitspunkte` (Byte 50) | season.ts:207-221 | in Ordnung, punktunabhängig; Doku veraltet -> S8 |
| Tabelle im Browser (Minuspunkte) | main.ts:5381-5393 | in Ordnung |
| Highscore `placementPoints`/`highscoreEntry` | highscore.ts | rechnet punktunabhängig; gemeinsame Datei -> S7 |
| Punktabzug 3 Punkte (B11) | schulden.ts:46-70 | unverändert wie entschieden |
| `substitutionLimits`, Zusatzwechsel Verlängerung (B6) | regeln.ts:49, live.ts:745-748 | rechnet richtig; Bank zu klein -> S4 |
| `wechselZahl` Bonusende nach drei (B5) | live.ts:242-247, alle Aufrufer 264/265/374/480/807 | in Ordnung, alle Stärkewege (#122) gehen darüber |
| `applySubstitutions` Nummernvergabe (E17/#131) | live.ts:763-777 | rechnet wie dokumentiert; mit 5 Wechseln Wiedereinwechslung -> S4 |
| `nummernPflege` + Neuaufstellung je Hauptmenü (#123) | lineup.ts:253, server.ts:1175-1178 | in Ordnung; räumt 16/17 aus S3 vor dem Anpfiff weg |
| `nextRoundDraw` + `zeremonieHeimrecht` (#140) | europa.ts:181-232, server.ts:2937-2940 | in Ordnung: Doppellauf mit Zeremonie ist idempotent, kein Wurf, Original unberührt |
| `jugendAnlegen` / Anlage beim ersten Öffnen | jugend.ts:264, server.ts:3155, main.ts:4109 | Fehler -> S1, S2 |
| `jugendSaison` (Altern, Entwicklung, Aufstieg) | jugend.ts:365-453, server.ts:1300 | rechnet wie dokumentiert; Gleichgewicht -> S6 |
| `jugendAufruecken` | jugend.ts:494-524 | Kaderzahl/Positionswert (A7/A3) ok; Byte 32 -> S5; Rückennummer -> S3 |
| `addToSquad` (seasonEvents, Aufnahme 0x224A8) | seasonEvents.ts:80-85 | alter Weg `assignNumber` -> S3 |
| `jugendAbwerben` | jugend.ts:537-570, server.ts:3194-3225 | Prüfungen A4-A6, Live-Sperre, B4, B8 ok; `assignNumber` -> S3 |
| `foerdern`, `jugendKosten`, `jugendMonat` (B14) | jugend.ts:305-344, server.ts:1922-1928 | in Ordnung (Rechner-Manager zahlen nicht) |
| `jugendZaehlerLeeren` | jugend.ts:468, server.ts:1300 | läuft ungeprüft auch im Original -> S9 |
| /api/jugend: Rechte, Live-Sperre, Doppelaufrufe | server.ts:3147-3226 | `mine`, Live-Sperre, Versuch je Tag ok; offene Kaufverhandlung -> S10 |
| Aufnahme von Managern (#132) und Jugend | newgame.ts:554, server.ts:2824 | Fehler -> S2 |
| 1-/3-Jahres-Spiel (#133) und Jugend | server.ts:1205, jugend.ts:477 | -> S6 (Teil b) |
| Torszenen-Editor im Spielbetrieb | server.ts:3228-3288, live.ts:212, scene.ts:47 | eigene Szenen laufen nie in der Konferenz -> S11 |
| Trennung Original (Würfel/Bytes) | alle obigen | in Ordnung bis auf S9 (schreibt Nullen) |

## Befunde

### S1 - A - Jugend wird nie vollständig angelegt, wenn vor dem ersten Saisonwechsel niemand den Bildschirm öffnet

- Stelle: jugend.ts:264 (`jugendAnlegen` nur über /api/jugend `anlegen`, server.ts:3155, ausgelöst
  von main.ts:4109 nur bei `!jugendVorhanden`); jugend.ts:442-449 (Saisonwechsel füllt nur die
  C-Jugend auf).
- Fehlerbild: Neues Spiel 2026, kein Manager öffnet bis zum Saisonende JUGEND. `jugendSaison`
  liest leere Mannschaften, füllt aber die C-Jugend auf -> `jugendVorhanden` ist danach true, die
  Anlage mit B- und A-Jugend kommt nie mehr. Ergebnis (`jugend1.ts`, RIED-CLI, 3 Manager):
  nach dem 1. Saisonwechsel C/B/A = 11/0/0, 5/0/0, 9/0/0; erst nach dem 5. Saisonwechsel steht
  jemand in der A-Jugend, der erste "reif" frühestens nach dem 6. - fünf Jahre ohne Aufrücker,
  obwohl die Förderung längst Geld gekostet haben kann.
- Sicher, weil: Skript belegt; einzige Aufrufstelle von `jugendAnlegen` ist server.ts:3156.
- Korrektur: in `jugendSaison` (oder `createGame` bei 2026) je Manager ohne jeden Jugendspieler
  vorher `jugendAnlegen` für diesen Manager laufen lassen; besser: Anlage beim neuen Spiel
  (Würfelfolge 2026 ändert sich dann, Original unberührt). Aufwand klein.

### S2 - A - Aufgenommene Manager (#132) bekommen keine Jugendmannschaften

- Stelle: newgame.ts:554-600 (`managerAufnehmen`), server.ts:2824-2846; jugend.ts:188-209 liest
  für den neuen Index leere Mannschaften.
- Fehlerbild: 2026-Spiel mit angelegter Jugend, Manager 4 wird aufgenommen: M3 = 0/0/0; der
  Client legt nicht an (`jugendVorhanden` ist wegen der anderen true). Danach nur C-Auffüllung:
  Saison 1: 7/0/0, Saison 3: 11/2/0 (`jugend1.ts`) - der Neue hat für Jahre nichts aufzurücken,
  während die Alten volle A-Jugenden haben. Speicherfelder sonst in Ordnung: Anhang wächst
  sauber auf vier Manager, Zähler 34122+3/34126+3 sind 0, `letzteWechsel[3]` fehlt -> 0.
- Sicher, weil: Skript belegt; `managerAufnehmen` und /api/aufnehmen berühren den Anhang nicht.
- Korrektur: in /api/aufnehmen (nur `is2026`) für die neuen Indizes Mannschaften anlegen
  (`jugendAnlegen` je Manager statt für alle; heute würfelt es alle neu und überschriebe die
  bestehenden). Zusammen mit S1 eine Funktion `jugendAnlegenFuer(g, manager, rng)`. Aufwand klein.

### S3 - A - Jugend-Aufrücken und Jugend-Abwerben vergeben noch eine Rückennummer (alter Weg)

- Stelle: seasonEvents.ts:83 (`assignNumber` in `addToSquad` der Jugend), jugend.ts:561
  (`jugendAbwerben`); Kommentar seasonEvents.ts:77 "Dazu eine Rückennummer ab 12".
- Fehlerbild: Seit #125 (Audit 2 E16) vergibt die Aufnahme 0x224A8 keine Nummer, ein Neuzugang
  steht nicht im Aufgebot. Die Jugend nutzt weiter `assignNumber`: bei voller Bank 12..15 bekommt
  ein Aufrücker 16, der zweite 17 (`aufruecken.ts`: "X.STUERMER Nummer 16", "Y.TORWART Nummer 17"),
  die Bank hat bis zum nächsten Hauptmenü sechs Mann; fehlt eine Banknummer (z.B. 14), rückt der
  Aufrücker ungefragt auf die Bank. `nummernPflege` beim Zugende (server.ts:1176) macht aus 16/17
  wieder 0, ins Spiel kommt die Übernummer also nicht - wohl aber die Bankbesetzung bei einer
  Lücke.
- Sicher, weil: Code und Skript; `nummernPflege` danach liefert 12,13,14,15.
- Korrektur: `assignNumber` in beiden Wegen streichen (Byte 10 = 0 wie beim Kauf), Kommentar
  anpassen. Dasselbe steht in abwerben.ts:189 und transfer.ts:683 (`completePurchase` für das
  Bietgefecht, server.ts:889) - anderer Bereich, gleiche Korrektur. Aufwand klein.

### S4 - B - Fünf Wechsel bei vier Ersatzspielern: der fünfte (und der Zusatzwechsel) geht nur als Wiedereinwechslung

- Stelle: live.ts:731 (Einwechseln nur mit Nummer != 0), live.ts:763-777 (Ausgewechselter
  bekommt Nummer ab 12), lineup.ts:253-259 (`nummernPflege`, Bank höchstens 12..15),
  regeln.ts:49-51.
- Fehlerbild (`wechsel5.ts`, 2026): vier Wechsel leeren die Bank (12..15 auf dem Feld, die
  Ausgewechselten tragen 16, 12, 13, 14). Der fünfte Wechsel ist nur noch mit einem schon
  Ausgewechselten möglich - und wird angenommen: "raus #6, rein Bank #16 ... ok, field 5;
  Platz 1 wieder auf dem Feld". Der Wiedereingewechselte bekommt erneut einen Einsatz (Byte 6-8,
  Spielerbyte 35) und Frische +6..8. Die Regel "fünf Wechsel wie heute" ist so nur mit
  Rückwechsel erreichbar, den es im heutigen Fußball nicht gibt; in der Verlängerung (B6) gilt
  das auch für den sechsten. (Ob über /api/squad ein Tribünenspieler mit einem Ausgewechselten die
  Nummer tauschen und so nachrücken kann, siehe Unklar U1.)
- Sicher, weil: Skript gegen echten Stand, Prüfung in live.ts:731 kennt nur "Nummer 0".
- Entscheidung nötig. Empfehlung: in 2026 (a) Ausgewechselte im Live-Zustand je Manager merken
  (`state.ausgewechselt`) und Wiedereinwechslung abweisen ("Spieler wurde ausgewechselt"), und
  (b) die Bank in 2026 vergrößern (heute bis 9 Ersatzspieler; z.B. 12..18 in `autoLineup`
  benchFour und `nummernPflege` max) - sonst bleiben de facto vier Wechsel. Alternativ: Regel auf
  "fünf Wechsel, Rückwechsel erlaubt" so dokumentieren. Aufwand (a) klein, (b) mittel (Anzeige,
  Aufstellung, Nummernpflege nur in 2026).

### S5 - A - Aufrücker: Positionsart landet als Seitenvorliebe in Spielerbyte 32

- Stelle: jugend.ts:514 `p.setU8(32, s.art)`.
- Fehlerbild: Byte 32 ist die Seitenvorliebe 0..6 (playerinfo.ts:43, goals.ts:14 `positionFit`,
  lineup.ts:132 `seitenTausch`), im Spielerpool frei gewürfelt (newgame.ts:210 `rng(0,6)`). Der
  Aufrücker bekommt dort seine Positionsart: jeder Jugendtorwart 0 (LINKS), Abwehr 1-2 (LINKS/
  MITTE), Mittelfeld 3-4 (MITTE), jeder Stürmer 5-6 (RECHTS). Beleg `aufruecken.ts`:
  Stürmer Art 6 -> Byte 32 = 6, Torwart -> 0. Wirkt auf Torschützenwahl (`positionFit`) und den
  Seitentausch der Aufstellung.
- Sicher, weil: Byte-32-Bedeutung an drei Stellen im Code belegt, die Positionsart steckt schon in
  Byte 31 (A7).
- Korrektur: Byte 32 wie der Pool mit `rng(0, 6)` würfeln (nur 2026, ein Wurf mehr) oder eine
  eigene Vorliebe im Jugendsatz führen. Aufwand klein.

### S6 - B - Jugend im Gleichgewicht: B- und A-Jugend dünn, Grenzen greifen nie; im 1-Jahres-Spiel reine Kosten

- Stelle: jugend.ts:59 (`JUGEND_AUFSTIEGE = 2`), 442-449 (nur C wird aufgefüllt), 107
  (`JUGEND_MAX_AUFRUECKER = 5`), 71 (`JUGEND_MAX_FOERDERUNG = 4`); server.ts:1205 (Spielende vor
  `jugendSaison`).
- a) Nach der Startbesetzung pendelt sich je Manager ein (`jugend2.ts`, 20 Saatwerte, Saisons
  5-10): C/B/A = 9,6 / 4,0 / 5,9, davon 2,0 reif; je Saison 4,8 Abgänge. Bei zwei Aufsteigern je
  Mannschaft und zwei Jahrgängen bleibt die B-Jugend bei genau 4 Spielern, die "zwölf Plätze" und
  die Förderobergrenze 4 sind dort nie bindend, und mehr als zwei Aufrücker je Saison gibt es nie
  - die Grenze 5 (SPIELMECHANIK, jugend.ts) greift nicht.
- b) 1-Jahres-Spiel: das Spiel endet in `saisonwechselBeginnen` (server.ts:1205) vor
  `jugendSaison`; A-Jugendliche starten mit 17/18 und werden erst mit 19 reif (`istReif`,
  jugend.ts:458) - es kann nie jemand aufrücken, die Förderung (bis 12 x 2.000 DM im Monat)
  mindert nur das Vermögen und damit den Highscore (`div(wealth, 80000)`).
- Entscheidung nötig. Empfehlung: a) B- und A-Jugend ebenfalls von außen auffüllen (z.B. wie C mit
  2/3 Chance je freiem Platz) oder `JUGEND_AUFSTIEGE` auf 4 heben; b) im 1-Jahres-Spiel den
  Jugendbildschirm nicht anbieten bzw. ohne Kosten, oder die Startbesetzung der A-Jugend teils
  schon reif (19) anlegen. Aufwand klein.

### S7 - B - Highscore: Spiele der Version 2026 und des Originals in derselben Datei

- Stelle: highscore.ts:34-37 (`HIGH.<Spielart><Level>`), server.ts:1208-1214, 1340-1350.
- Fehlerbild: Ein 2026-Spiel (Abwerben, Jugend, Doping, Arzt, ablösefrei ...) trägt sich in
  dieselbe Liste wie Originalspiele ein; die Liste wird mit dem DOS-Format geschrieben. Die
  Punkte selbst hängen nicht an `winPoints` (nur Plätze/Pokale/Vermögen) - rechnerisch richtig,
  aber die Wertungen sind nicht vergleichbar.
- Sicher, weil: Dateiname kennt das Regelwerk nicht.
- Empfehlung: eigene Datei für 2026 (z.B. `HIGH.<Spielart><Level>` mit Zusatz, den das Original
  nicht liest) oder Kennzeichen im Eintrag. Aufwand klein.

### S8 - C - SPIELMECHANIK, Regeltabelle 2026 unvollständig und ein Satz veraltet (H6 offen)

- docs/SPIELMECHANIK.md:2282-2290: Tabelle nennt nur "5, unabhängig von der Position"; es fehlen
  Bonusende nach drei Wechseln (B5), Zusatzwechsel in der Verlängerung (B6), Heimrecht im
  DFB-Halbfinale (#140, steht nur bei Zeile 405), Ewige Bilanz nur Punkte (B12). Zeile 2289
  "Die ewige Tabelle addiert die Saisonpunkte unverändert weiter - ... wachsen die
  Ewigkeitspunkte also schneller" ist falsch: Byte 50 zählt seit #99 Plätze und Titel
  (season.ts:200-221), unabhängig von 2/3 Punkten. Das ist AUDIT-2026 H6, weiter offen.
- jugend.ts:8: "A-Jugend 16/17" (seit #112 17/18; Konstante und SPIELMECHANIK stimmen).
- records.ts:409-416 `Standing.total`: `pointsAgainst: 2 * games - points` (Zwei-Punkte-Regel),
  nur noch in Tests benutzt - Hinweis im Kommentar oder `winPoints`.
- regeln.ts:9-11, jugend.ts:100, SPIELMECHANIK.md:2276-2278: "gehört zu keiner der bekannten
  Tabellen"/"ungenutzter Bereich" - 34099 und 34122..34129 liegen in der Ablauftabelle
  4238:5664 (savefile.ts:29 `ABLAUF_ZEIGER = 34095`, 30 Einträge), Einträge 1 bzw. 6..8 (AUDIT-2026
  H2, Kommentar nicht berichtigt). In den 70 vorliegenden Ständen sind dort nur die Einträge 10
  und 20..22 belegt (`ablauf.ts`), also kein Konflikt beobachtet.
- Aufwand klein.

### S9 - C/H - `jugendZaehlerLeeren` läuft auch im Original (AUDIT-2026 H1 offen)

- Stelle: server.ts:1300, jugend.ts:468-473 ohne `is2026`.
- Fehlerbild: im Originalmodus schreibt jeder Saisonwechsel Nullen in 34122..34129 (Zeigerbytes
  der Ablaufeinträge 6..8). In allen 70 Ständen stehen dort Nullen (`ablauf.ts`), eine Wirkung
  ist also nicht beobachtet - formal verletzt es "im Original kein Byte ändern".
- Korrektur: `if (!is2026(g)) return;` in `jugendZaehlerLeeren`. Aufwand trivial.

### S10 - A - Jugend-Aufrücken/-Abwerben während einer offenen Kaufverhandlung lässt den Kauf scheitern

- Stelle: server.ts:3147-3226 (keine Prüfung auf `room.purchases`), transfer.ts:549-575
  (`kaufplatz` nimmt den Platz wieder heraus, `platzEinsetzen` sucht ihn erst beim Vertrag).
- Fehlerbild: Manager mit 23 Spielern beginnt einen Kauf (Platz geprüft, Dialog offen), rückt
  dann einen Jugendspieler auf (24) und nimmt die Forderung an: `platzEinsetzen` findet keinen
  Platz -> `kaufVertrag` liefert `{ok:false}` ohne Absage, der Client zeigt "kein Transfer"
  (server.ts:3446-3452). Im Original ist der Kaufdialog modal; /api/market/buy sperrt einen
  zweiten Kauf ausdrücklich ("Erst den Vertrag aushandeln", server.ts:3365). Dasselbe für den
  Abwerber beim Jugend-Abwerben. Kein Byte wird inkonsistent, der Kauf ist nur verloren.
- Sicher, weil: Codepfad eindeutig (Kaderplatz-Schleife `slot < 24`).
- Korrektur: in /api/jugend für `aufruecken` und `abwerben` `if (room.purchases.has(manager))
  return 409 "Erst den Vertrag aushandeln"`. Aufwand trivial.

### S11 - B (mit C) - Eigene Torszenen laufen nie in der Konferenz

- Stelle: server.ts:291-300 (`sceneNames` nur aus assets/tore/scenes.json), live.ts:212-226
  (`pickScene` zieht nur `n.T/n.V/n.TE/n.TJ`), server.ts:3258 (Namen müssen seit A16 mit einem
  Buchstaben beginnen); SPIELMECHANIK.md:676-678 "die Szene läuft danach sofort in der Konferenz
  mit".
- Fehlerbild: Eine im Editor gespeicherte Szene ("konter") kommt nur in den Katalog des Browsers
  (scene.ts:47-58); der Server wählt sie nie, also erscheint sie in keinem Spiel. Vor A16 ging
  das nur über das Überschreiben einer Originalnummer, was A16 bewusst verbietet.
- Sicher, weil: einzige Szenenwahl ist `pickScene` mit Namen aus Würfeln.
- Entscheidung: soll der Editor das Spiel beeinflussen? Empfehlung: in 2026-Runden mit kleiner
  Chance (z.B. 1/10) statt der gewürfelten Szene eine eigene ziehen (Servermenge um
  `assets/eigen/tore/szenen.json` ergänzen, Wurf nur in 2026, damit die Originalfolge bleibt);
  sonst die Doku berichtigen ("nur zum Ansehen im Editor"). Aufwand klein bis mittel.

### S12 - A (klein, ohne bleibende Wirkung) - Neuaufstellung nach Jugend-Aufrücken/-Abwerben ohne 513E

- Stelle: server.ts:3182, 3215-3216 `autoLineupIfEnabled(room.game, manager)` ohne
  `sperreAusgesetzt`; der Kauf (server.ts:3454) übergibt ihn seit #123.
- Fehlerbild: an einem Pokaltag mit ausgesetzter Sperre fliegt nach einem Aufrücken ein
  gesperrter, aber spielberechtigter Spieler aus der Automatik-Aufstellung. Das Zugende
  (server.ts:1175-1178) stellt mit dem richtigen 513E neu auf, vor dem Anpfiff ist es also
  wieder richtig - sichtbar nur bis dahin.
- Korrektur: `sperreAusgesetzt(room.game, i)` mitgeben. Aufwand trivial.

## B1-B14 aus AUDIT-2026, soweit Bereich S

- B4 (Neuaufstellung nach Jugend-Abwerben/Aufrücken): umgesetzt (server.ts:3182, 3215f), siehe S12.
- B5 (Bonus endet nach drei): umgesetzt, alle Stärkewege über `wechselZahl`.
- B6 (Zusatzwechsel Verlängerung): umgesetzt (live.ts:747), praktisch nur als Rückwechsel (S4).
- B8 (Kur endet beim Wechsel): Jugend-Abwerben ruft `kurBeimWechselBeenden` (jugend.ts:559).
- B11 (Punktabzug wie er ist): unverändert.
- B12 (Ewige Bilanz nur Punkte): umgesetzt.
- B14 (Förderung nur Spieler-Manager, Alter angleichen): umgesetzt (server.ts:1924, JUGEND_ALTER);
  nur der Dateikopf jugend.ts:8 ist alt (S8).

## Unklar

- U1: /api/squad (`uebernimmNummern`, server.ts:1085-1117) erlaubt im laufenden Spiel jeden
  Nummerntausch, also auch Tribüne (0) <-> Bank (12..16). `applySubstitutions` zählt das nicht als
  Wechsel (kein Platz wechselt zwischen Feld und Nicht-Feld). Damit ließe sich die Bank im Spiel
  mit frischen Spielern neu besetzen (würde S4 teilweise umgehen). Ob das Original im
  Kaderbildschirm der Konferenz Bank und Tribüne tauschen lässt, habe ich nicht geprüft; nicht mit
  einem Stand belegt (RIED-CLI hat nur 15 Spieler, alle mit Nummer).
- U2: Nach `spielende` (#133) sperrt nur /api/done; /api/jugend (Aufrücken, Förderung) und andere
  Wege nehmen weiter Aufträge an. Wirkung auf das Ergebnis keine erkennbar (Highscore ist
  geschrieben), aber der Stand ändert sich weiter - bereichsübergreifend.
- U3: /api/szene prüft nur, dass eine Runde betreten ist (kein `mine`/Verwalter): auch Zuschauer
  schreiben Dateien in `tore-eigen/` und `assets/eigen/tore/` (Grenze 200) und können fremde
  Szenen gleichen Namens überschreiben. Bei drei vertrauten Spielern wohl unkritisch.

## Kurzliste

| ID | Klasse | Einzeiler |
|---|---|---|
| S1 | A | Ohne Öffnen des Jugendbildschirms vor dem 1. Saisonende entstehen nie B-/A-Jugend (5 Jahre kein Aufrücker) |
| S2 | A | Per #132 aufgenommene Manager bekommen keine Jugendmannschaften |
| S3 | A | Jugend-Aufrücken/-Abwerben vergeben noch Rückennummer per `assignNumber` (seit #125 nicht mehr) |
| S4 | B | 5 Wechsel bei 4 Ersatzspielern: 5. (und 6. in der Verlängerung) nur als Wiedereinwechslung |
| S5 | A | Aufrücker: Positionsart wird als Seitenvorliebe (Byte 32) geschrieben |
| S6 | B | Jugend-Gleichgewicht: B=4, A≈6, max. 2 Aufrücker/Saison; im 1-Jahres-Spiel nur Kosten |
| S7 | B | Highscore von 2026- und Originalspielen in derselben Datei |
| S8 | C | Regeltabelle 2026 unvollständig, Satz zur Ewigen Tabelle falsch (H6), Kommentare A-Jugend/34099 veraltet |
| S9 | C | `jugendZaehlerLeeren` läuft auch im Original (H1 offen, schreibt nur Nullen) |
| S10 | A | Jugend-Aufrücken/-Abwerben während offener Kaufverhandlung lässt den Kauf scheitern |
| S11 | B | Eigene Torszenen werden in der Konferenz nie gezeigt (Doku sagt anderes) |
| S12 | A | Neuaufstellung nach Jugendwechsel ohne 513E (vom Zugende korrigiert) |
