# Audit 2026, zweiter Durchgang - Bereich G: Geld und Gesundheit

Stand 2.10.2026, Repo … (HEAD d5b503d). Nur gelesen; Belegskripte
in `scratchpad/g/` (g1.ts bis g5.ts, laufen mit `node gX.ts` gegen ../bmp/*.MAN).

## Geprüfte Funktionen

| Funktion | Code | Urteil |
|---|---|---|
| Überschuldung `checkDebt`, Aufruf am Monatsletzten | schulden.ts:45, server.ts:1968-1982 | rechnet richtig; läuft für jeden Kalendertag genau einmal (Schleife bis vor den Ankunftstag, `tagesbeginn`, Sommertage 327-364), nach Einnahmen, Ausgaben, Krediten und Jugend - passt zu #121/#124. Sommer: G10, G11 |
| Kaufsperre `isBlocked` | server.ts:3202, 3372, 3723, 3793 | an allen direkten Wegen (Kauf, Leihe, Bietgefecht, Abwerben, Jugend-Abwerben, ablösefrei); aufgeschobene Ausführung ohne Prüfung: G4 |
| Derby `derbyStake`/`playDerby` | derby.ts:39-68, server.ts:2046-2062 | rechnet richtig, kein Würfel; Kappung erst beim Abpfiff angreifbar: G3 |
| Derby-Einsatz `/api/derby` | server.ts:3774 | Rechte, Live-Sperre, Regelwerk ok |
| Derby-Ankündigung | server.ts:2254-2274 | Nachholspiele fehlen: G12 |
| Kreditanfrage/-angebot/-annahme | server.ts:3677-3700, 3804-3865; stadium.ts:265-350 | Rechte, Doppelaufrufe (splice vor Prüfung, Rückstellung bei Fehler), Prüfung des Geldgeber-Kontos bei der Annahme ok; keine Live-Sperre (wirkt nur über G3) |
| Fester Zinstermin, kein Zins im Aufnahmemonat | finance.ts:207-235 | Termin und Aufnahmemonat stimmen mit #121 (Zug nach den Finanzen des Ankunftstags) und #124 (Kredite nach Einnahmen/Ausgaben); Zinsen insgesamt doppelt: G5; Anzeige: G9 |
| `INTEREST_CAP` | finance.ts:184, display.ts:359 | Buchung und Anzeige gleich, ok |
| Medizin `medWeek` | medizin.ts:118, server.ts:2226-2249 | an die Verletzungswoche des Ankunftstags gekoppelt (Saisontag % 7, `mitTagesroutine`), nicht für Rechner (B13) - passt zu #121 |
| Medizin `medSet` (`/api/medizin`) | medizin.ts:190, server.ts:3289 | Platz ungeprüft: G2 |
| Behandlungsstufe beim Vereinswechsel | transfer.ts:604, 675; seasonEvents.ts:196 | wandert mit: G6 |
| Doping `dopeStart`/`dopeStop` (`/api/doping`) | doping.ts:142-190, server.ts:3298 | Platz ungeprüft: G1; Leihspieler: G7 |
| Doping `dopeMatchday` | doping.ts:212-236, server.ts:2276-2291 | Würfel, Strafe, A19 ok; Verletzung im selben Spiel geht verloren: G8; KI-Manager: G13 |
| `dopingCleanup` | doping.ts:242 | ok (schreibt im Original nichts, H1 weiter nur formal offen) |
| Jugendförderung `jugendMonat` | jugend.ts:336, server.ts:1921-1928 | ok: nach der Monatsabrechnung samt Krediten, nur Spieler-Manager (B14), Original 0 |
| Aufgenommene Manager (#132) | server.ts:2838, newgame.ts:543 | `balanceSums` wächst mit; Sperrbit, Derbybyte (34118+i, i<4), Jugendzähler je Manager in Bytes für vier Manager; Jugendanhang liest fehlende Manager leer - ok |
| Spielende (#133) | server.ts:1340 | kein Bezug zu Geld/Gesundheit außer "Unklar" 3 |
| Trennung vom Original | alle obigen | ok: alle Zweige fragen `is2026`, kein Wurf und kein Byte im Original (medWeek, dopeMatchday, derbyStake, checkDebt, jugendMonat kehren vorher zurück) |

**B-Entscheidungen:** B3 (Derby-Einsätze offen, #105) umgesetzt - `stateJson` liefert alle
Stufen; B9 nur für die Terminbuchung umgesetzt, nicht für die Ausgabenseite (G5); B10, B11, B13,
B14, B7 umgesetzt; B8 für Abwerben/Jugend/Markt umgesetzt, nicht für Leihe (G7).

## Befunde

### G1 - A - `/api/doping` dopt Spieler anderer Manager
- Stelle: server.ts:3304-3306 (`place = Math.trunc(Number(body.place))`), doping.ts:143 und 184
  (`g.lineups.at(manager * 25 + place)` ohne Bereichsprüfung).
- Fehlerbild: Manager 0 schickt `{place: 25 + x, on: true}` -> Kur bei Manager 1, Platz x. Die
  Kurgrenze zählt nur den eigenen Kader (`dopeCures(g, 0)` bleibt 0), also beliebig viele. Der
  Gegner trägt Risiko, 12-24 Wochen Sperre und Strafe 50.000 + 5 % (dopeMatchday läuft über
  `squadOf(Besitzer)`). Umgekehrt beendet `{on:false}` fremde Kuren; Manager 3 erreicht mit
  Platz 25..49 die Marktplätze 100..124.
- Sicher: g1.ts auf RIED-4TE, CLAUDE, P4: `dopeStart(0, 25+y)` -> ok, Spieler von Manager 1
  gedopt (Kondition/Technik 52/51 -> 64/63), Kuren M0/M1 = 0/1.
- Korrektur: in `dopeStart`/`dopeStop` (Kern, damit jeder Aufrufer geschützt ist)
  `Number.isInteger(place) && place >= 0 && place < 25` prüfen; besser zusätzlich `playerIndex`
  mitschicken und vergleichen (siehe Unklar 1). Aufwand: klein (3 Zeilen + Test).

### G2 - A - `/api/medizin` setzt die Behandlung fremder Spieler
- Stelle: server.ts:3292, medizin.ts:192.
- Fehlerbild: Manager 0 setzt `{place: 25 + x, level: 3}` -> verletzter Spieler von Manager 1 auf
  SPORTKLINIK AM SEE, Manager 1 zahlt 150.000 DM je Woche, bis die Untergrenze erreicht ist (bei
  20 Wochen rund 770.000 DM laut SPIELMECHANIK). Mit `level: 0` lässt sich eine fremde
  Behandlung abschalten (5 % Rückschlag).
- Sicher: g1.ts: `medSet(0, 25+x, 3)` -> `{ok:true}`, Stufe beim Spieler von Manager 1 = 3.
- Korrektur: wie G1 in `medSet`. Aufwand: klein.

### G3 - A - Derby-Betrag lässt sich während der Konferenz drücken
- Stelle: derby.ts:44-47 (`derbyStake` kappt auf das kleinere Guthaben), ausgewertet erst beim
  Buchen nach dem Abpfiff (server.ts:2054). Ausgaben ohne Live-Sperre: `/api/stadium`
  (server.ts:3579, stadium.ts:152 bucht sofort), `/api/market/buy`, `/api/loan/confirm`
  (Geldgeber-Konto sinkt), dazu Bankkredit (Sieger hebt sein Guthaben).
- Fehlerbild: beide Einsätze 500.000 DM, der Verlierer hat 600.000 DM. Beim 0:2 bestellt er einen
  Ausbau für 590.000 DM -> Derby zahlt 10.000 statt 500.000 DM. AUDIT-2026 A11 sperrte nur das
  Senken der Stufe; die Kappung öffnet denselben Weg wieder.
- Sicher: Code - Betrag = min(Stufe, min(Kontostände)) zum Buchungszeitpunkt; keine der genannten
  Routen prüft `room.live`.
- Korrektur: Betrag je Derby beim Anpfiff (`startLive`, nach `backupSystem`) festschreiben und beim
  Buchen nur noch auf das Verliererkonto prüfen - oder die Kappung am Anpfiff auswerten. Alternativ
  Live-Sperre für alle Geldwege (größer, berührt den Kaufweg). Aufwand: klein bis mittel.

### G4 - B - Kaufsperre bei aufgeschobenen Geschäften
- Stelle: server.ts:907 `resolvePoachRequests` -> `poachAusfuehren`, server.ts:924
  `resolveFreeAgents`; beide am Ende von `advanceDay`, also **nach** der Finanzschleife
  server.ts:2160, die einen Monatsletzten mit `checkDebt` enthalten kann.
- Fehlerbild: Gebot auf einen ablösefreien Spieler im Saisonwechsel; der erste Tageswechsel der
  neuen Saison (Tag 0 -> 4) bucht 30.7.-1.8. mit dem 31.7. als Monatsende, die Sperre wird gesetzt,
  danach bekommt der jetzt gesperrte Manager den Spieler trotzdem. Ebenso eine Abwerbeanfrage
  gegen einen Menschen, über deren Tageswechsel ein Monatsletzter liegt (auch der 30.6. in den
  Sommertagen liegt zwischen Gebot und Zuschlag).
- Sicher: Ablauf im Code; `isBlocked` steht nur in den POST-Routen.
- Frage: Gilt die Sperre für vor der Sperre abgegebene Gebote? **Empfehlung:** ja - bei der
  Ausführung prüfen (gesperrte Bieter überspringen, nächstbestes Gebot; Abwerbung entfällt mit
  Meldung). Aufwand: klein.

### G5 - B - Kreditzinsen doppelt, Zinseinnahmen von allen Krediten aller
- Stelle: finance.ts:94 (`monthlyExpenses` zählt die eigenen Zinsen, 0x17262), finance.ts:207-226
  (Terminbuchung), finance.ts:69 (`monthlyIncome`: jeder Manager bekommt die Zinsen aller
  anderen an **alle** Geldgeber, auch an die Bank). Original-Eigenheit (abgleich/audit2/C.md),
  aber die Version 2026 verspricht in finance.ts:217 "genau n Raten" (#107, B9).
- Fehlerbild (g3.ts, RIED-4TE, 2026): 1 Mio. DM von Manager 1 an Manager 0, 3 Monate, 10 %,
  aufgenommen am 15.10.: Termin bucht 30.11., 31.12., 31.1. (3 Raten, stimmt mit B9); die
  Monatsabrechnung zählt den Zins zusätzlich am 31.10., 30.11., 31.12. und 31.1. (der Kredit
  steht dort noch) -> der Borger zahlt **7 x 100.000**, der Geldgeber bekommt **4 x 100.000**,
  drei Raten verschwinden. Jeder dritte Manager bekommt dieselben 4 x 100.000 als "Zinsen anderer"
  ebenfalls, ebenso die Zinsen jedes Bankkredits der Mitspieler.
- Sicher: Skriptlauf und Code.
- Empfehlung: in der Version 2026 (a) die eigenen Zinsen aus den Ausgaben nehmen oder die
  Terminbuchung streichen - eine Rate je Monat, wie B9 meinte; (b) als Einnahme nur
  `lenderDebt(g, other, manager, true)` (Zinsen an genau diesen Geldgeber) und ohne Aufnahmemonat;
  Statistik (display.ts) gleich mitziehen. Original unverändert. Aufwand: klein bis mittel
  (Tests in finance/audit2026).

### G6 - A - Behandlungsstufe wandert zum neuen Verein
- Stelle: transfer.ts:604 (`kaufVertrag` vom Manager) und 675 (`completeLoan`) kopieren Byte 23
  ganz, also mit den Stufenbits 6..7; `listPlayer` legt den Kaderplatz unverändert auf den Markt;
  die Leihrückkehr kopiert den ganzen Platz (seasonEvents.ts:196).
- Fehlerbild: Manager 1 behandelt einen verletzten Spieler mit Stufe 3 und verleiht/verkauft ihn,
  der neue Verein zahlt ab der nächsten Woche 150.000 DM, ohne gewählt zu haben.
- Sicher: g4.ts: nach `listPlayer` + `completeLoan` an Manager 0: Stufe 3, `medCost(0)` = 150.000.
- Korrektur: in der Version 2026 beim Abgang (`listPlayer`) oder bei der Ankunft (beide
  Kopierstellen, Leihrückkehr) `setMedLevel(…, 0)`; im Original bleiben die Bits ohnehin 0.
  Aufwand: klein.

### G7 - A - Kur auf einem Leihspieler, Rückkehr mit Kur (B8 unvollständig)
- Stelle: doping.ts:142-158 (`dopeStart` prüft weder Spielerbyte 33 noch Leihmarke Byte 12),
  seasonEvents.ts:194-197 (Jahrgangswechsel kopiert den alten Kaderplatz samt Byte 44/45 zum
  Besitzer).
- Fehlerbild: Manager 0 leiht einen Spieler von Manager 1 und dopt ihn (g2.ts: `dopeStart` ok,
  Byte 33 = 1). Beim Jahrgangswechsel steht der Spieler mit laufender Kur und Aufschlag bei
  Manager 1, der sie nie begonnen hat (Risiko und Strafe für ihn, Grenze 3 überschreitbar, sobald
  er verlängert). B8 verlangt "beim Wechsel absetzen"; umgesetzt nur für Abwerben, Jugend, Markt.
- Sicher: Kurbeginn im Skript; die Rückkehr kopiert laut Code den ganzen 52-Byte-Platz (im
  Skriptlauf lief danach der Leihvertrag aus, Rückkehr selbst nicht im Lauf beobachtet).
- Korrektur: in `dopeStart` Leihspieler abweisen wie `listPlayer` (`p.u8(33) !== manager ||
  l.u8(12) !== 0`), zusätzlich im Jahrgangswechsel (nur 2026) `kurBeimWechselBeenden`. Aufwand: klein.

### G8 - A - Verletzung und Dopingsperre im selben Spiel: Verletzungsdauer geht verloren
- Stelle: doping.ts:227-229.
- Fehlerbild: gedopter Spieler verletzt sich im Spiel (Bit 1, Byte 13 = 22 Wochen) und fliegt auf
  -> Byte 13 = 12 (nur die Rotsperre, Bit 0, wird berücksichtigt), Byte 23 = 0. Die Dopingsperre
  verkürzt damit einen Kreuzbandriss.
- Sicher: g5.ts: Byte 13 danach 12, Byte 23 0.
- Korrektur: `Math.max(weeks, (l.u8(9) & 3) !== 0 ? l.u8(13) : 0)`. Aufwand: klein.

### G9 - A - Bank zeigt in 2026 den falschen Fälligkeitstag
- Stelle: web/src/main.ts:6523 zeigt `dueDay` (Byte 9); in der Version 2026 wird am Monatsletzten
  zurückgezahlt (finance.ts:220-228).
- Fehlerbild: Kredit am 15.10. über 3 Monate -> "FÄLLIG AM 15.1.", gebucht wird am 31.1.
- Korrektur: in 2026 den Monatsletzten des Fälligkeitsmonats anzeigen. Aufwand: klein.

### G10 - A - Meldung "0 Punkte Abzug" im Sommer
- Stelle: server.ts:1970-1980. Am 30.6. (Sommertage in `saisonwechselAbschliessen`) sind die
  Tabellen schon geleert (`tabellenZuruecksetzen` in Teil 1), `checkDebt` liefert `points: 0`;
  trotzdem geht an den Manager "… 0 Punkte Abzug, ein Monat keine Einkäufe" und an alle anderen
  "X bekommt 0 Punkte Abzug wegen Schulden". Ebenso jeder Verein ohne Punkte (31.7. nach dem
  ersten Spieltag).
- Korrektur: Meldungstext bei `points === 0` nur mit der Kaufsperre. Aufwand: klein.

### G11 - B - Punktabzug verfällt am Saisonende
- Gleiche Stelle wie G10: wer am 30.6. unter -1 Mio. steht, verliert keine Punkte; am 31.7. ist
  der Abzug durch "nie unter null" auf höchstens die Punkte des ersten Spieltags begrenzt.
- Empfehlung: den Abzug des 30.6. vormerken und mit dem ersten Spieltag der neuen Saison abziehen -
  oder bewusst so lassen und in SPIELMECHANIK festhalten. Aufwand: klein (Byte im 2026-Bereich).

### G12 - A - Derby-Ankündigung fehlt bei Nachholspielen
- Stelle: server.ts:2257-2274 schaut nur auf `FLAG_LEAGUE` und `pairings`, nicht auf
  `replays(g)` des neuen Tages; gebucht wird das Derby aber auch im Nachholspiel
  (server.ts:2078-2089 -> `nachDemSpiel`). Umgekehrt wird ein am Spieltag verlegtes Derby
  angekündigt.
- Korrektur: Nachholpaarungen des Ankunftstags mit ankündigen. Aufwand: klein.

### G13 - B - Kuren laufen weiter, wenn der Rechner übernimmt
- Stelle: server.ts:2276-2291 prüft alle Manager, `/api/quit` (server.ts:2972) beendet keine Kur.
- Fehlerbild: wer mit drei Kuren aufhört, hinterlässt dem Rechner-Verein Woche für Woche
  steigendes Risiko, Sperren und Strafen; der Rechner kann nicht absetzen.
- Empfehlung: beim Aufhören alle Kuren beenden (`kurBeimWechselBeenden` über den Kader), analog
  zu B13 (Medizin nur für Spieler-Manager). Aufwand: klein.

### G14 - C - Doku und Kommentare
- SPIELMECHANIK.md:2587ff: Dopingtabelle nennt noch Byte 5/8 statt 44/45 (#88).
- doping.ts:208-209: "13 bis 39 Wochen … 200.000 bis 500.000 DM mal Ligafaktor" - gilt 12-24
  Wochen, 50.000 + 5 %. doping.ts:15, 40, 103: Aufschlag "auf Form" - seit #110 nur Kondition/Technik.
- derby.ts:4-5 und SPIELMECHANIK.md:2341: "ohne den des anderen zu kennen" - seit #105 (B3) offen.
  Ebenso der Abschnitt "Verdecktes Bietgefecht" (Nachbarbereich).
- SPIELMECHANIK.md:2333: Monatsprüfung "in einer Saison viermal" - es sind zwölf Monatsletzte.
- SPIELMECHANIK "Kredit nur mit Zustimmung": die Rückfrage beim Borger (#107, B10) fehlt;
  "Zinsen zu einem festen Termin": kein Zins im Aufnahmemonat, Rückzahlung am Monatsletzten fehlen.
- SPIELMECHANIK Medizin: "nicht für Rechner-Manager, nicht am Saisontag 322" (B13) fehlt.
- SPIELMECHANIK/derby.ts: "Treffen zwei Managervereine aufeinander" - gilt nur Liga und
  Nachholspiel, nicht Pokal, Europapokal, Relegation.
- finance.ts:217-218 "genau n Raten": siehe G5.

## Unklar

1. Indizes nach Kaderverschiebung: `/api/doping` und `/api/medizin` nehmen nur den Kaderplatz. Nimmt
   in derselben Zugphase ein Mitspieler ein Angebot an (`/api/market/answer` setzt beim Käufer
   einen Spieler einsortiert ein), verschiebt sich der Kader; ein Klick aus der alten Ansicht trifft
   dann einen anderen Spieler. Wie oft das zeitlich passt, hängt am Client - Empfehlung trotzdem:
   `playerIndex` mitschicken und prüfen (wie A9/A12).
2. `dopeMatchday` vergleicht die Einsätze je **Platz** zwischen Anpfiff (`st.einsaetzeVorher`) und
   Buchung (server.ts:2276-2280). Die Marktrouten (`/api/market/list`, `takeback`, `buy`,
   `answer`) haben keine Live-Sperre; verschiebt sich der Kader während der Konferenz, prüft die
   Dopingkontrolle die falschen Spieler (ein gedopter Stammspieler kann durchrutschen). Ursache
   gehört zum Kaufweg; robust wäre ein Vergleich je `playerIndex`.
3. Nach `spielBeenden` (#133) sperrt nur `/api/done`; Kredit, Derby, Medizin, Doping ändern den
   Stand weiter und `/api/loan/confirm` speichert ihn. Auf die Bestenliste wirkt das nicht mehr -
   ob der gesicherte Rundenstand später noch gebraucht wird, konnte ich nicht klären.
