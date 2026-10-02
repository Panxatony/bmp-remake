# Audit 2026, zweiter Durchgang - Bereich T (Transfers)

Stand 2.10.2026, Repo … (HEAD d5b503d). Nur gelesen. Belegskripte
im Scratchpad: `t/belege.mts`, `t/kaufpoach.mts`, `t/ablauf.mts` (node 24, direkt gegen
packages/core/src/index.ts und ../bmp/CLAUDE4.MAN bzw. alle 70 *.MAN).

## Geprüfte Funktionen

| Funktion | Code | Urteil |
|---|---|---|
| Gebot im Bietgefecht | server.ts:3363-3396 `/api/market/buy` (is2026, Besitzer 4) | Rechte, Kaufsperre, Geld, Sperre "wird gerade verhandelt", keine Leihe im 1-Jahres-Spiel: in Ordnung. Keine Sperre bei Spielende (T5) |
| Zuschlag | server.ts:844-902 `resolveAuctions`, auktion.ts | Rechnet richtig (aiAccepts, kaderVoll, Geld). Läuft über den alten Weg `completePurchase` mit `assignNumber` (T6), nach der Konferenz mit Kaderverschiebung (T2), ohne Sponsor-Zuschuss (T7), Sperre nicht neu geprüft (T4) |
| Gleichstand | auktion.ts:28-43 `highestBid`, abloesefrei.ts:49-65 `bestBid` | nur Platz in der Liga (T9) |
| Ablösefreie Spieler | server.ts:1241-1250, 1133-1152, 924-962 `resolveFreeAgents`, 3785-3803 `/api/free/bid` | B1 (Mindestgebot = bisheriges Gehalt) umgesetzt; Besitzer 6 in der Wartezeit, Neustart setzt auf 5 (server.ts:1518) - in Ordnung. Rückennummer (T6), Kaufsperre beim Zuschlag (T4) |
| Abwerben | abwerben.ts `poachCheck`/`poach`, server.ts:3708-3747 `/api/poach`, 968-1002 `poachAusfuehren` | Regeln (nach oben, 1 je Saison, 12 Mann, kaderVoll, Leihe, Karriereende, Kur endet) stimmen. Offener Kauf zählt nicht mit (T3), Rückennummer (T6), Byte 24 wandert mit (T8) |
| Gegenwehr | server.ts:3749-3772 `/api/poach/answer`, `raiseSalary` | Platzsuche über den Spieler (A9) und Live-Sperre (A11) in Ordnung. Keine Sperre im Vertragszug (T1) |
| Abwerbung beim Tageswechsel | server.ts:907-911 `resolvePoachRequests` | Anfragen vom Übergangstag überspringen den Tageswechsel (T1); stummes Scheitern (T10) |
| Kaufsperre | schulden.ts, server.ts:1968-1981 | Monatsprüfung nur 2026, Sperre an allen Antragswegen. Beim Vollzug nicht geprüft (T4) |
| Leihe unter Managern | server.ts:3506-3550 `/api/market/answer` (Original-Weg, auch 2026) | completeLoan ohne Rückennummer (E16), 1-Jahres-Spiel ohne Leihe; Kur kann nicht mitwandern (Markt sperrt gedopte Spieler) - in Ordnung |
| Aufgenommene Manager (#132) | newgame.ts:554 `managerAufnehmen`, server.ts:2824 | Zähler (34100 + 4·Werber + Besitzer), Sperrbit, Gebotslisten tragen 4 Manager; Freisuche zieht nur Besitzer 5, wartende Ablösefreie (6) bleiben unberührt - in Ordnung |
| Spielende (#133) | server.ts:1340 `spielBeenden` | offene Gebote/Anfragen bleiben, Transferwege offen (T5) |
| Trennung Original | alle obigen | Kein Wurf, kein Byte im Original - bis auf `resetPoachCounts` (T11, ohne Wirkung) |

## Befunde

### T1 - A - Abwerbeanfragen (und Gebote) vom Übergangstag überdauern den Saisonwechsel; im Vertragszug wechselt ein Spieler mit Vertrag 0 (A10 kehrt zurück)

Stelle: server.ts:3714 (`/api/poach` sperrt nur `"vertraege"`), server.ts:3749-3772
(`/api/poach/answer` ohne Stufenprüfung), server.ts:1179-1181 `zugBeenden` -> `saisonwechselBeginnen`
(kein `advanceDay`, also weder `resolveAuctions` noch `resolvePoachRequests`), abwerben.ts:142
`poachCheck` (prüft die Vertragsjahre nicht).

Fehlerbild: Am Übergangstag (Saisontag > 322, Stand `"zug"`) wirbt B um Spieler X des menschlichen
Managers A, dessen Vertrag ausläuft. Die Anfrage bleibt liegen, `zugBeenden` startet den
Saisonwechsel, X steht im Vertragszug mit 0 Jahren im Kader (seasonEvents.ts:357-363). A
antwortet jetzt auf die Anfrage -> `poachAusfuehren` -> X wechselt mit **Vertrag 0** zu B; A's
Vertragseintrag läuft ins Leere (`platzVon` < 0). Genau der Fall A10 ("wird beim nächsten
Jahrgangswechsel 255, läuft nie aus"). Beleg `belege.mts` [3]: `poachCheck` mit Vertrag 0 ->
`{"ok":true,...}`, nach `poach` "Vertrag 0 Jahre". Die Zähler setzt erst `saisonwechselTeil2`
zurück (season.ts:430), die Abwerbung zählt also noch für die alte Saison. Gebote des
Übergangstags werden erst nach Teil 2 gegen den erneuerten Markt und die Konten nach den
Sommertagen entschieden.

Sicher, weil: der Pfad `zugBeenden` -> `saisonwechselBeginnen` ruft `advanceDay` nicht, und keine
der drei Stellen prüft die Stufe bzw. die Vertragsjahre.

Korrektur: in `saisonwechselBeginnen` vor `saisonwechselTeil1` `resolveAuctions(r)` und
`resolvePoachRequests(r)` aufrufen (die Geschäfte des letzten Zugs schließen wie jeder
Tageswechsel); zusätzlich `poachCheck` mit `l.u8(11) === 0` ablehnen. Aufwand klein.

### T2 - A - Zuschlag nach der Konferenz verschiebt den Kader; die Dopingprüfung vergleicht die falschen Spieler

Stelle: server.ts:1996 `resolveAuctions` am Anfang von `advanceDay`; server.ts:2004 nimmt an
Konferenztagen `live.einsaetzeVorher` (beim Anpfiff erhoben, live.ts:256, nach Index von
`squadOf`); server.ts:2276-2280 vergleicht `jetzt[place] > vorher[place]`.

Fehlerbild: Spieltag mit Konferenz, Manager 0 gewinnt ein Bietgefecht. Der Zuschlag fügt den
Spieler per `sortIntoSquad` mitten in den Kader ein; danach zeigen die alten Indizes auf andere
Spieler. Beleg `belege.mts` [1] (CLAUDE.MAN 4, Zuschlag KUNATH auf Platz 2): **18 von 20 Indizes
versetzt; ohne ein einziges Spiel gälten 5 Spieler als eingesetzt** (SPANRING 0->2 usw.). Ein
gedopter Spieler hinter der Einfügestelle wird so mit den Einsätzen seines Vorgängers verglichen:
wer nicht gespielt hat, kann auffliegen (Sperre, Strafe), wer gespielt hat, entgeht der Prüfung.

Sicher, weil: Erhebung beim Anpfiff und Vergleich nach dem Zuschlag stehen beide im Code; die
Verschiebung ist gemessen.

Korrektur: `einsaetzeVorher` als Map Spielernummer -> Einsätze führen (live.ts:256,
server.ts:2004, 2277-2280), dann ist jede Kaderverschiebung egal. Aufwand klein. (Dieselbe
Verschiebung erzeugen die Marktwege ohne Live-Sperre, siehe "Unklar".)

### T3 - A - Ein offener Kauf hält keinen Kaderplatz frei: Abwerben während der Verhandlung führt zu Kaderzahl 25

Stelle: server.ts:3708-3726 `/api/poach` (und server.ts:3195-3208 Jugend-Abwerben) fragen
`room.purchases` nicht ab; `kaufplatz` nimmt den gewürfelten Platz bis zum Vertrag wieder heraus
(transfer.ts:549-560), `kaufVertrag` prüft `kaderVoll` nicht mehr.

Fehlerbild: Manager mit 22 Kaderspielern und einem eigenen Spieler auf dem Markt (Kaderzahl 23)
kauft vom Markt - `kaderVoll` erlaubt es. Während der Vertragsdialog offen ist, wirbt er bei einem
Mitspieler ab (Rechner-Manager: sofort; sonst sobald der Besitzer antwortet): `poachCheck` sieht
Kaderzahl 23 und lässt zu. Dann schließt er den Vertrag. Beleg `kaufpoach.mts`: Kaderzahl 22 ->
23 -> nach Abwerbung 24 -> **nach dem Vertrag 25** (Grenze 24, `{"ok":true,"place":5}`).

Sicher, weil: im Skript mit genau den Kernfunktionen der Serverwege nachgestellt; der Server
selbst sperrt nur `/api/market/buy` mit "Erst den Vertrag aushandeln" (server.ts:3365).

Korrektur: in `/api/poach` und im Jugend-Abwerben dieselbe Sperre wie beim Kauf
(`if (room.purchases.has(manager)) 409 "Erst den Vertrag aushandeln"`). Aufwand klein.

### T4 - A - Die Kaufsperre gilt beim Gebot, nicht beim Vollzug

Stelle: server.ts:924-962 `resolveFreeAgents` (kein `isBlocked`), server.ts:844 `resolveAuctions`,
abwerben.ts:142 `poachCheck` (kennt `isBlocked` nicht; Beleg `belege.mts` [4]: gesperrter Manager
0 -> `{"ok":true}`).

Fehlerbild: Ablösefreie Spieler entstehen in `saisonwechselBeginnen`; im Vertragszug darf jeder
bieten (`/api/free/bid` hat keine Stufenprüfung). Danach rechnet `saisonwechselAbschliessen` die
Sommertage 21.6.-28.7. mit `finanzTag` - am 30.6. läuft die Monatsprüfung (server.ts:1968).
Steht der Bieter dann unter -1 Mio., bekommt er Punktabzug und Kaufsperre - und am ersten Tag der
neuen Saison trotzdem den Spieler. Dasselbe gilt für Gebote und Abwerbeanfragen, die nach T1 über
den Saisonwechsel getragen werden. SPIELMECHANIK sagt ausdrücklich "keine Gebote auf ablösefreie
Spieler".

Sicher, weil: die Reihenfolge Gebot (Vertragszug) -> Sommertage mit Monatsprüfung -> Zuschlag ist
im Code fest; beim Zuschlag fragt niemand die Sperre ab.

Korrektur: gesperrte Bieter beim Zuschlag überspringen (`bestBid`/`highestBid` mit Filter oder in
den beiden resolve-Funktionen) und `poachCheck` um `isBlocked(g, poacher)` ergänzen. Aufwand klein.

### T5 - A - Spielende: Transferwege der Version 2026 bleiben offen

Stelle: server.ts:1340-1360 `spielBeenden` (verwirft weder `auctions` noch `poachRequests`),
Sperre `room.spielende` nur in `/api/done` (server.ts:2997); `/api/market/buy`, `/api/poach`,
`/api/poach/answer`, `/api/free/bid` prüfen sie nicht.

Fehlerbild: Nach "ENDE" eines 1-/3-Jahres-Spiels wirbt ein Manager bei einem Rechner-Manager ab:
`poachAusfuehren` vollzieht sofort, `persist` schreibt den geänderten Stand (server.ts:3741).
Bestenliste ist dann schon geschrieben, der Spielstand weicht aber vom Endstand ab; offene Gebote
liegen für immer.

Sicher, weil: keine der Routen liest `spielende`.

Korrektur: eine Sperre für alle zustandsändernden Spielrouten bei `room.spielende` (oder
wenigstens diese vier) und `auctions`/`poachRequests` in `spielBeenden` leeren. Aufwand klein.

### T6 - B - Rückennummer bei Zugängen der Version 2026 (E16)

Stelle: transfer.ts:683 (`completePurchase` -> `assignNumber`, nur noch vom Bietgefecht
benutzt, server.ts:889), server.ts:952 (ablösefrei), abwerben.ts:184/189 (Abwerben); ebenso
jugend.ts:561.

Fehlerbild: Kauf und Leihe vergeben seit #125 (E16) keine Rückennummer. Die drei 2026-Wege
vergeben dagegen die erste freie ab 12 - ist 12-15 frei, sitzt der Zugang auch bei manueller
Aufstellung sofort auf der Bank. Beleg `belege.mts` [1] Zuschlag: Nummer 16; [2] gleicher
Spieler über `kaufplatz`/`kaufVertrag`: Nummer 0. Außerdem ist `completePurchase` der letzte
Nutzer des alten Kaufwegs (eigene Würfe mit 2 Jahren statt 0x224A8 mit einem Jahr).

Empfehlung: `assignNumber` in allen drei Wegen streichen (beim Abwerben reicht `bytes[10] = 0`),
das Bietgefecht über `kaufplatz` + Einsetzen ohne Dialog führen und `completePurchase` entfernen.
Aufwand klein bis mittel. Entscheidung nötig, weil SPIELMECHANIK die Nummer beim Abwerben
ausdrücklich zusagt.

### T7 - B - Zuschlag vom Rechner ohne Sponsor-Zuschuss

Stelle: server.ts:885-898. Der Kauf und die Leihe vom Rechner würfeln den Zuschuss (0x240E1,
E23; server.ts:3410-3412, 3463-3466), der Zuschlag im Bietgefecht - ebenfalls ein Kauf vom
Rechner - nicht. In der Version 2026 gibt es also keinen Zuschuss mehr.

Empfehlung: nach dem Zuschlag `sponsorSubsidy(w.amount, rng)` wie beim Kauf und in
`r.subsidies` legen (verfällt nicht mit dem Tag). Aufwand klein.

### T8 - A (klein) - Abwerben nimmt das Verlängerungsangebot an den alten Verein mit

Stelle: abwerben.ts:183-186 kopiert alle 52 Bytes, löscht nur Byte 10 und Byte 9 Bit 6/7.

Fehlerbild: Hat der Spieler beim Besitzer ein Verlängerungsangebot offen (Byte 24 = 100 +
Jahre), steht es nach dem Wechsel beim Werber; dessen Vertragsdialog wertet es als liegendes
Angebot (server.ts:3066-3068, `spielerJahre`). Beleg `belege.mts` [3]: nach dem Wechsel Byte 24 =
103. Ebenso wandert der Meldungszeiger in Byte 48-51 mit, und der `r.offers`-Eintrag des
Besitzers bleibt mit dem alten `place` stehen.

Korrektur: in `poach` Byte 24 auf 0 setzen, wenn 100 <= Wert < 0x80, Bytes 48-51 nullen; in
`poachAusfuehren` `r.offers` des Besitzers für den Spieler streichen. Aufwand klein.

### T9 - B - Gleichstand über Ligagrenzen

Stelle: auktion.ts:38-40, abloesefrei.ts:59-62. Verglichen wird nur Standing-Byte 46 (Platz
innerhalb der Liga). Gleiche Gebote von einem Bundesliga-Zehnten und einem Zweitliga-Fünften:
der Bundesligist hat "den schlechteren Platz" (10 > 5) und gewinnt - entgegen der Absicht "der
Kleine bekommt den Spieler".

Empfehlung: wie `poachAllowedFrom` über (Liga, Platz) vergleichen. Aufwand klein.

### T10 - B - Abwerbeanfrage scheitert beim Tageswechsel stumm

Stelle: server.ts:976-985. Ist der Spieler weg oder schlägt `poachCheck` beim Vollzug fehl
(zweite Anfrage beim selben Besitzer nach geglückter erster, Geld fehlt, Kader voll), steht das
nur im Verlauf; der Werber erfährt nichts, obwohl er auf eine Antwort wartet. Das Bietgefecht
meldet den gleichen Fall ("nicht mehr auf dem Markt").

Empfehlung: Meldung an den Werber. B2 hat das für Bietgefecht und ablösefrei verneint, daher
Entscheidung. Aufwand klein.

### T11 - C - `resetPoachCounts` läuft weiter auch im Original (H1 offen)

Stelle: season.ts:430. Schreibt im Originalmodus Nullen auf 34100-34115, die in der
Ablauftabelle 4238:5664 liegen (Einträge 1-5, AUDIT-2026 H2). In allen 70 vorliegenden Ständen
sind diese Bytes 0 (`ablauf.mts`), also bisher ohne Wirkung. Vorschlag wie H1: mit `is2026`
einfassen.

### T12 - C - Doku und Kommentare

- SPIELMECHANIK.md:2407-2410 "Verdecktes Bietgefecht": seit B3/#105 sind die Gebote offen
  (server.ts:1779, web main.ts:6942). Abschnitt streichen bzw. umschreiben.
- SPIELMECHANIK.md:2350-2359: "Alle Bieter bekommen eine Meldung" stimmt nicht, wenn der
  Höchstbietende nicht zahlen kann oder sein Kader voll ist (B2 so entschieden); dass es keinen
  Nachrücker gibt, sollte dort stehen.
- SPIELMECHANIK.md:2369-2377: das Mindestgebot (bisheriges Gehalt, B1/#104) fehlt; "Kader voll"
  -> Spieler geht woanders hin, ebenfalls ohne Nachrücker.
- SPIELMECHANIK.md:2324 `resetPoachCounts` "in `newSeason`" - steht in `saisonwechselTeil2`.
- abwerben.ts:15 "höchstens zwei Spieler" - es ist einer (`POACH_MAX_PER_OWNER = 1`).
- server.ts:913-921: der Kommentar von `resolveFreeAgents` steht über `WARTET_ABLOESEFREI`
  (zwei JSDoc-Blöcke hintereinander).
- transfer.ts:502-505 (`buyOffer`): "Vertragsverhandlung (completePurchase)" - es sind
  `kaufplatz`/`kaufVertrag`; transfer.ts:652-656 `completePurchase` beschreibt den Kauf des
  Originals, dient aber nur noch dem Bietgefecht.

### B-Entscheidungen B1-B14 (soweit Bereich T)

B1 (Mindestgebot bisheriges Gehalt) umgesetzt: server.ts:3796. B2 (kein Nachrücker, keine
Nachricht) so im Code. B3 (offen) umgesetzt, Doku veraltet (T12). B4 (Neuaufstellung beider
Seiten) umgesetzt: server.ts:994-995. B8 (Kur endet beim Wechsel) umgesetzt: abwerben.ts:187;
Leihe vom Markt kann keine Kur tragen (server.ts:3319).

## Unklar / außerhalb des Bereichs

- Die Marktwege des Originals (`/api/market/list|takeback|decide|contract|answer`, server.ts:3314-3550)
  haben keine Live-Sperre. Ein Kauf, Verkauf oder eine Leihe während der Konferenz verschiebt den
  Kader wie in T2 (mindestens die Dopingprüfung, wohl auch Konferenzdaten nach Platz). Gehört zum
  Original-Bereich, dort prüfen.
- `/api/market/answer` (server.ts:3543) setzt `room.purchases` für den Käufer ohne
  `has`-Prüfung: nehmen zwei Besitzer Angebote desselben Käufers an, verdrängt der zweite Kauf den
  ersten ohne `kaufAbbrechen`; zwei Käufer desselben Spielers können beide eine Verhandlung
  bekommen. Original-Bereich.
- `managerAufnehmen` nimmt nach 1000 Fehlwürfen den zuletzt gezogenen Spieler ohne Rücksicht auf
  den Besitzer (newgame.ts:578-582, so im Original); das könnte theoretisch auch einen wartenden
  Ablösefreien (6) treffen. Mit einem vollen Pool praktisch unerreichbar, nicht belegt.

## Kurzliste

| ID | Klasse | Einzeiler |
|---|---|---|
| T1 | A | Abwerbeanfragen und Gebote vom Übergangstag überdauern den Saisonwechsel; `/api/poach/answer` im Vertragszug holt Spieler mit Vertrag 0 (A10 kehrt zurück) |
| T2 | A | Zuschlag nach der Konferenz verschiebt den Kader, die Dopingprüfung vergleicht nach Index die falschen Spieler |
| T3 | A | Offener Kauf hält keinen Platz frei: Abwerben während der Verhandlung führt zu Kaderzahl 25 |
| T4 | A | Kaufsperre nur beim Gebot geprüft; gesperrte Manager bekommen ablösefreie Spieler (Monatsprüfung 30.6. dazwischen) |
| T5 | A | Nach dem Spielende bleiben Bieten, Abwerben und Gegenwehr offen, Abwerbung schreibt den Stand |
| T6 | B | Zuschlag, ablösefrei und Abwerben vergeben Rückennummern ab 12 (alter Weg `completePurchase`), Kauf und Leihe seit E16 nicht |
| T7 | B | Zuschlag vom Rechner ohne Sponsor-Zuschuss (E23) |
| T8 | A | Abwerben nimmt das Verlängerungsangebot (Byte 24) und den Meldungszeiger mit |
| T9 | B | Gleichstand im Bietgefecht/ablösefrei vergleicht nur den Platz in der Liga |
| T10 | B | Scheiternde Abwerbeanfrage beim Tageswechsel ohne Meldung an den Werber |
| T11 | C | `resetPoachCounts` schreibt auch im Original (H1 offen, ohne Wirkung in 70 Ständen) |
| T12 | C | SPIELMECHANIK "verdecktes Bietgefecht" veraltet, Meldungen/Mindestgebot/Fundstellen, Kommentare in abwerben.ts, server.ts, transfer.ts |
