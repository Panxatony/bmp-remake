# Audit: Original gegen Remake

Stand 17.9.2026, Commit `97d776f`. Geprüft wurde, **welche Anzeigen und Spielfunktionen das
Original hat** und **was davon im Remake umgesetzt ist**.

## Wie geprüft wurde

Vier Quellen, in dieser Reihenfolge:

1. **Das Programm selbst** - die aus dem entpackten `BMMAIN.EXE` gewonnenen Routinen, die in
   `docs/SPIELMECHANIK.md` mit Adresse festgehalten sind. Sie sind die Liste dessen, was das
   Original tut.
2. **Die Bildschirmfotos** des laufenden Originals (47 Stück in `docs/original/`, darunter die
   vollständige Menükarte `menu-*.png`, `buero-*`, `wappen-*`, `trikots-*`).
3. **Messreihen in DOSBox** (Work Items #21-#26): Zuschauer, Training, KI-Kaufentscheidung,
   Werbeangebote, Randale-Schaden.
4. **Der Quelltext des Remakes**: 36 Bildschirme (`Screen`), 41 `draw`-Routinen, 42 Module unter
   `packages/core/src/sim/`, 52 Schnittstellen unter `/api/`, 173 Tests in 35 Dateien.

**Was dieser Audit nicht ist:** kein Pixelvergleich. Geprüft ist, ob eine Anzeige oder Funktion
vorhanden ist und aus derselben Rechnung kommt - nicht, ob jeder Bildpunkt sitzt. Wo eine
Darstellung am Original vermessen wurde, steht das in `docs/SPIELMECHANIK.md` bei der jeweiligen
Routine.

## 1. Anzeigen

### Menükarte des Originals

Das Hauptmenü hat links Büro/Wappen/Trikots, rechts Pokal/Diskette/Manager; jeder Knopf öffnet
neun Felder. **Alle belegten Felder des Originals sind im Remake belegt, keines fehlt.**

| Untermenü | Original | Remake | Stand |
| --- | --- | --- | --- |
| Büro | Statistik | `drawStatistik` (Serien, Rekorde, Zuschauer, Finanzen, Monatsbilanz) | ✔ |
| Büro | Ewige Tabelle / Ewige Bilanz | `drawEwige` | ✔ |
| Büro | Verlauf | `drawVerlauf` | ✔ |
| Büro | Stadion | `drawStadium` | ✔ |
| Büro | Bank | `drawBank` | ✔ |
| Büro | Werbung | `drawWerbung` | ✔ |
| Wappen | Tabelle Bundesliga / 2. Liga / Oberliga | `drawTable` je Liga | ✔ |
| Wappen | Spiele je Liga | `drawSpiele` | ✔ |
| Wappen | Stärken je Liga | `drawStaerken` | ✔ |
| Trikots | Mannschaft (Aufstellung) | `drawSquad`, Ansicht KADER | ✔ |
| Trikots | Verträge | `drawSquad`, Ansicht VERTRAG | ✔ |
| Trikots | Transfermarkt | `drawMarket` | ✔ |
| Trikots | Training | `drawTraining` | ✔ |
| Trikots | Trainingslager | `drawCamp` | ✔ |
| Trikots | Bestenliste (LIGA / SPIELER) | `drawBestenliste` | ✔ |
| Pokal | DFB-Pokal, Landesmeister, Pokalsieger, UEFA | `drawPokal` je Wettbewerb | ✔ |
| Diskette | Laden | Spielstandwahl bzw. Anmeldung | ✔ |
| Diskette | Speichern | `saveGame` (Serverstand) | ✔ ¹ |
| Diskette | Highscore | `drawHighscore` | ✔ |
| Diskette | Optionen | `drawOptionen`, alle 15 Schalter + Geschwindigkeit | ✔ |
| Diskette | Neu | `drawNewGame` | ✔ |
| Manager | Meldungen | `drawMessages` | ✔ |

¹ Im Original ist nach dem Speichern der Zug zu Ende; im Mehrspielerbetrieb wäre das unsinnig,
deshalb bewusst nicht nachgebaut (siehe Befund B6).

### Anzeigen außerhalb der Menükarte

| Original | Remake | Stand |
| --- | --- | --- |
| Titelbild und Startbildschirm (0x0AD44) | `drawStart` / `drawStartOnline` | ✔ |
| Hauptmenü: Kalenderblatt, Managerfoto, Vereinswappen | `drawMenuHeader` | ✔ |
| Tabellenverlauf als Linienzug im oberen Feld (0x09857) | `drawMenuHeader` | ✔ |
| Meldungen zum Zugbeginn in den neun Feldern, mit Pfeil/X/Pfeil | `drawMeldungen` | ✔ |
| Live-Konferenz mit Tafeln, Halbzeit, Ergebnissen | `drawLive` | ✔ |
| Torszenen in der Konferenz (Ausschnitt 182x96) | `Scenes.draw`, `web/scene.ts` | ✔ |
| Karten- und Verletzungsmeldung mit Klang | `kartenMeldung`, `szeneTon` | ✔ |
| Zuschauerzahl auf der Konferenztafel, rot bei ausverkauft | `drawLive` | ✔ |
| Ergebnisübersicht nach dem Spieltag | `drawResults` | ✔ |
| Sportzeitung | `drawZeitung` | ✔ |
| Auslosung als Zeremonie (0x17C26) | `drawAuslosung` | ✔ |
| Spielerinfo (Rechtsklick auf einen Spieler, 0x15346) | `playerInfo`, `drawSquad` | ✔ |
| Vertragsverhandlungskasten | `drawVertragsKasten` | ✔ |
| Elfmeter-Schriftzug (0x05186) | `sim/playerinfo.ts` | ✔ |
| "Möchten Sie das Spiel wirklich beenden ?" (0x0A7DD) | `drawEndeDialog`, `sim/ki.ts` | ✔ |
| Überblendungen (Schalter "Blenden", 4cb3:060C) | `blende()` | ✔ |
| Klänge digi1..digi4 und Titelmusik | `Sounds`, `musikPflegen` | ✔ |
| Rechtsklick in der Konferenz: Erbauer der Torszene | — | **fehlt** (B2) |

## 2. Spielfunktionen

Jede Zeile ist eine Routine des Originals mit ihrer Adresse und dem Modul, das sie im Remake
nachbildet. Alle genannten Module sind vorhanden und durch Tests gegen echte Spielstände gedeckt.

| System | Original | Remake | Geprüft gegen |
| --- | --- | --- | --- |
| Spielplan | Buchstabentabellen | `sim/fixtures.ts` | alle 40 Spielstände |
| Spielsimulation | 0x0F9D2, 0x1D6F7 | `sim/match.ts` | 171 DOSBox-Spiele |
| Mannschaftsstärke | Anzeige- und Spielweg | `sim/strength.ts` | drei Spielstände |
| Tabellenfortschreibung | 0x2DBC5 | `sim/standings.ts` | TEST4→RUNA0, TEST3→RUN0 |
| Kalender, Spieltage | — | `sim/calendar.ts` | Kalendertage aller Stände |
| Winterverlegungen | 0x03563 | `sim/postpone.ts` | `postpone.test.ts` |
| Nachbereitung nach dem Spiel | 0x1C632 | `sim/matchday.ts` | TEST1→TEST2 |
| Karten, Verletzungen, 0:2-Wertung | 0x05FE5, 0x1BF6D | `sim/incidents.ts` | `incidents.test.ts` |
| Torschützen und Bewertung | 0x1B223, 0x05D9A | `sim/goals.ts` | Serienprotokoll |
| Training je Kalendertag | 0x0DF0D | `sim/training.ts` | TEST3→RUN0, Messreihe #24 |
| Trainingsverletzungen | 0xE668 | `sim/training.ts` | `training.test.ts` |
| Trainingslager | 0x113E5 | `sim/training.ts` | `training.test.ts` |
| Automatische Aufstellung | 0x22030 | `sim/lineup.ts` | `lineup.test.ts` |
| Zuschauer und Einnahmen | 0x10BB0, 0x1C798 | `sim/attendance.ts` | RUNA0, Messreihe #23 |
| Monatsabrechnung | 0x17076, 0x17262 | `sim/finance.ts` | RIED-CLI (exakt) |
| Tägliche Finanzroutine | 0x11D0D | `sim/finance.ts` | `bank.test.ts` |
| Kredite: Zins, Fälligkeit, Rückzahlung | 0x1222D | `sim/finance.ts` | `bank.test.ts` |
| Sponsor-Zuschuss, Sondertage | 0x0272D, 0x1CF86 | `sim/finance.ts` | `sonder.test.ts` |
| Stadionausbau | 0x0602 | `sim/stadium.ts` | `stadium.test.ts`, Messreihe #21 |
| Werbung: Angebote und Verträge | 0x176F4, 0x291CD | `sim/werbung.ts` | 907 Originalangebote (#25) |
| Marktwert | 0x24D4E | `sim/value.ts` | `transfer.test.ts` |
| Transfermarkt, KI-Entscheid | 0x22C15, 0x248E1 | `sim/transfer.ts` | 90 DOSBox-Angebote (#22) |
| Spielerpool der KI | 0x0F2A6 ff. | `sim/pool.ts` | `pool.test.ts` |
| KI-Vereine, Wochenschwankung | 0x160A2, 0x10067 | `sim/ai.ts` | `ai.test.ts` |
| Vertragsangebote der Spieler | 0xE76F, 0x16FC8 | `sim/contracts.ts` | `sim.test.ts` |
| DFB-Pokal und Europapokale | 0x18600 ff. | `sim/cup.ts`, `sim/europa.ts` | `europa.test.ts` |
| Relegation | 0x33C0 | `sim/season.ts` | `season.test.ts` |
| Saisonwechsel | 0x1E4A0 | `sim/season.ts` | `season.test.ts` |
| Saisonende je Manager: Prämien, Rücktritte, Abgänge | 0x0CB62 | `sim/seasonEvents.ts` | `season.test.ts` |
| Jugendspieler des Originals | 0x0CE84 | `sim/seasonEvents.ts` | `season.test.ts` |
| Neues Spiel aus den Stammdaten | 0x08FD8, 0x299DC | `sim/newgame.ts`, `data/mana.ts` | `newgame.test.ts` |
| Historieblock, Statistik, Ewige Tabelle | 0x2D182, 0x27C98 | `sim/history.ts` | `history.test.ts` |
| Kalendermeldungen | 0x143ED | `sim/messages.ts` | `messages.test.ts` |
| Sportzeitung | 0x2F243 | `sim/zeitung.ts` | `zeitung.test.ts` |
| Highscore | 0x34616 | `sim/highscore.ts` | `highscore.test.ts` |
| Live-Konferenz | 0x05404 | `server/live.ts` | `live.test.ts` |
| Torszenen laden und abspielen | 0x1502C, 0x0C7C4 | `web/scene.ts` | `szene.test.ts` |
| Spielstand lesen und schreiben | Prüfsummen | `savefile.ts` | 40 Spielstände, byte-genau |
| Aufhören, Rechner übernimmt | 0x0A7DD | `sim/ki.ts` | `ki.test.ts` |

## 3. Befunde

### B1 · Zwei Bildschirme ohne Weg dorthin — *ohne Folgen, aufräumen*
`drawFinances` und `drawContracts` sind gebaut, aber von keinem Menü aus erreichbar; man kommt
nur mit `?screen=finances` aus Prototyp 0 hin. Beide Inhalte gibt es an ihrem richtigen Platz:
Finanzen stehen in `drawStatistik` (wie im Original), Vertragsangebote im Meldungsweg und im
Vertragskasten. **Reste aus Prototyp 0** - entweder entfernen oder als Unterseite verdrahten.
Auch `buero` und `tabellen` stehen noch im `Screen`-Typ, ohne dass sie irgendwo gezeichnet werden.

### B2 · Erbauer der Torszene fehlt — *jetzt nachholbar*
Im Original zeigt ein Rechtsklick während der Konferenz "Der Erbauer der letzten gespielten
Torszene war: ...". Das war bisher nicht nachbaubar, weil die Szenen des Originals ihren Autor
zwar tragen, das Remake ihn aber nicht auslas. Seit dem Torszenen-Editor hat jede Szene ein Feld
`author` bzw. `autor` - **die Anzeige ließe sich jetzt bauen**, und bei eigenen Szenen stünde
dort der Name des Mitspielers, der sie gebaut hat.

### B3 · Frische: sechs Stellen der Trainingsroutine nicht portiert — *echte Lücke in der Rechnung*
Die Trainingsfunktion des Originals verändert die Frische an mehreren Stellen, die noch fehlen:
Transfermarktspieler über 56 verlieren `random(3,9)` (0xDF8F); Kaderspieler bekommen je nach
Saisontag und Regler Zuschläge (0xEC50, 0xECEB, 0xF04D) und Abzüge (0xEFEE) mit den Grenzen
60..150 (0xF08F/0xF09F), ebenso 0x119CD. Auswirkung: die Frische läuft über eine Saison
gerechnet anders als im Original. Die Hauptformel selbst stimmt (Messreihe #24).

### B4 · Bewusste Auslassungen — *kein Handlungsbedarf*
- Die Stärkeliste der Zielvereine (0x0F58B) rechnet das Original aus, benutzt sie aber nicht.
- Die Relegationsmeldung vom 13. Juni ist im Original durch die Konstante 4cb3:226A abgeschaltet.
- Historische Startjahre (1964/1966 mit Zuschlägen) bietet das Remake im neuen Spiel nicht an.

### B5 · Speichern beendet den Zug nicht — *bewusste Abweichung*
Im Original nimmt das Kalenderblatt nach dem Speichern keinen Klick mehr an. Im Mehrspielerbetrieb
ist Speichern nur eine Aufnahme des Serverstands; gespielt wird weiter.

### B6 · Die Dokumentation ist an drei Stellen veraltet — *Pflege*
- `docs/SPIELMECHANIK.md` schreibt "Bis auf 'Blenden' - Überblendungen gibt es im Remake nicht":
  falsch, `blende()` wertet den Schalter aus.
- Der Abschnitt "## Offen" nennt Zuschauerformel und Marktwert als offen; beide sind gemessen und
  portiert (#23, `sim/value.ts`).
- "Danach folgt im Original die Vertragsverhandlung (0x16FC8, Byte 24), noch offen": ist in
  `sim/contracts.ts` umgesetzt und läuft täglich auf dem Server.

### B7 · Die Haken in `docs/PLAN.md` stimmen nicht mehr — *Pflege*
In M2 bis M4 stehen zwölf Punkte offen, die längst fertig sind: Highscore, Optionen, Zeitung,
Bestenliste, Stärketabelle, Nachholspiele, Jugendspieler-Anzeige, Kredite mit Fälligkeit und
Tilgung, Sponsor-Zuschuss, Saisonende-Prämien, Vertragsverhandlung der KI, Konferenztafeln mit
Zuschauer- und Kartenzeilen. Der Plan zeichnet damit ein zu düsteres Bild vom Stand.

## 4. Was das Remake zusätzlich hat (Version 2026)

Kein Teil des Originals, sondern das erweiterte Regelwerk - umschaltbar, ein Spielstand des
Originals bleibt unberührt:

Abwerben mit Gegenwehr · Bietgefecht um Marktspieler, verdeckt · ablösefreie Spieler am
Saisonende · Kredit nur mit Zustimmung des Geldgebers · Punktabzug und Kaufsperre bei
Überschuldung · Derby-Einsatz · drei Punkte je Sieg, fünf Auswechslungen · medizinische Versorgung
· Doping · Jugendarbeit mit drei Mannschaften · eigener Torszenen-Editor · entschärfte
Ungerechtigkeiten (Zinstermin, Marktpreis-Überlauf, Guthabenzins).

Dazu der Mehrspielerbetrieb selbst: Server, Anmeldung, Sitzplätze, paralleler Zug, Live-Konferenz
für alle.

## 5. Empfehlung

| | Befund | Aufwand |
| --- | --- | --- |
| 1 | **B3** Frische-Stellen portieren - die einzige echte Lücke in der Spielrechnung | mittel |
| 2 | **B2** Erbauer der Torszene beim Rechtsklick zeigen - passt jetzt zum Editor | klein |
| 3 | **B6/B7** Doku und Plan nachziehen | klein |
| 4 | **B1** `drawFinances`, `drawContracts`, `buero`, `tabellen` entfernen oder verdrahten | klein |

Alles andere ist vollständig: **jeder Menüpunkt des Originals hat seinen Bildschirm, und jede
portierte Routine ist gegen echte Spielstände oder eine DOSBox-Messreihe geprüft.**

## Nachtrag: umgesetzt (17.9.2026)

| Befund | Work Item | Ergebnis |
| --- | --- | --- |
| B1 tote Bildschirme | #29 | `drawFinances`, `drawContracts` und die Namen `finances`, `contracts`, `buero`, `tabellen` entfernt |
| B2 Erbauer der Torszene | #28 | Rechtsklick in der Konferenz zeigt den Urheber im Hinweiskasten, wie 0x562A |
| B3 Frische | #27 | vier Stellen berichtigt, dazu der Trainingstag; über die Winterpause am Original gemessen |
| B6 Doku veraltet | #30 | Blenden, "## Offen" und 0x16FC8 in `SPIELMECHANIK.md` richtiggestellt |
| B7 Haken im Plan | #30 | am Code belegt und gesetzt; offen bleiben die Benennung aller Felder und mehrere Räume |

Beim Abarbeiten kamen Abweichungen dazu, die dieser Audit nicht erfasst hat, weil er nur prüfte,
*ob* eine Anzeige oder Funktion vorhanden ist: #31 (Kalendermeldungen in der falschen Form),
#32 (Tage ohne Spiele waren Züge) und #33 (Marktteile im falschen Takt).

## Nachtrag: Restroutinen (25.9.2026)

Die 59 Routinen, die bis dahin weder ein Zweigbuch noch dieser Audit nannte, sind in
docs/abgleich/restroutinen.md eingeordnet. Dabei kamen 16 Befunde heraus (R1 bis R16): Kaderzahl
beim Kauf und beim Jugendspieler, Feldzelle neuer Starter, Aufstellungsautomatik im Kader,
Saisonverlauf, Heim- und Auswärtstabelle, Reihenfolge der Meldungen und einige kleinere. Alle sind
behoben; von R16 bleiben nur Randfälle beim Laden, die in ABWEICHUNGEN stehen.

## Nachtrag: die letzten Bildschirme (25.9.2026)

Die 23 Routinen, die bis dahin nur als Bildschirm geprüft waren, sind jetzt Zweig für Zweig
gelesen: Kaderbildschirm (abgleich/20230.md, drei spielrelevante Befunde K1 bis K3, behoben),
Vereinsinfo (abgleich/2A41E.md) und die übrigen Anzeigen (abgleich/anzeigen.md, keine
spielrelevanten Befunde, zwölf Anzeigebefunde behoben). Der Bildschirm "Info über <Verein>" mit dem
Restprogramm ist nachgebaut (abgleich/2A41E.md); die Credits sind bewusst weggelassen.

