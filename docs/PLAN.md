# Plan: Bundesliga Manager Professional als Netzwerkspiel

Ziel: Nachbau des Originals (Software 2000, 1991, DOS) so exakt wie möglich,
spielbar im Browser mit mehreren Managern auf verschiedenen Rechnern.

Entschieden am 2026-09-06:
- Spielmechanik aus `BMMAIN.EXE` per Reverse Engineering nachbilden.
- Technik: TypeScript, Browser-Client, Node-Server hält den Spielstand.
- Erster spielbarer Meilenstein: eine Liga-Saison mit mehreren Managern.

## Methode

1. Datenstrukturen zuerst. Der Spielstand ist ein Speicherabbild, jede
   Tabelle hat eine feste Adresse (`docs/MEMORY-MAP.md`). Mit `tools/xref.py`
   werden Code-Zugriffe auf ein Feld gefunden und über die benachbarten
   Bildschirmtexte gedeutet.
2. Feldbedeutungen absichern, indem zwei Spielstände derselben Karriere
   verglichen werden (RIED.MAN bis RIED-6TE.MAN) und indem Werte gegen die
   Anzeige im Original in DOSBox geprüft werden.
3. Routinen der Spielmechanik einzeln übersetzen: Spieltag-Ablauf,
   Spielsimulation (Torszenen, Stärkevergleich), Tabelle, Finanzen, Verträge,
   Transfers, Verletzungen, Zuschauer. Jede Routine bekommt einen Test, der
   sie gegen Werte aus echten Spielständen prüft, soweit möglich.
4. Server-Spielzustand ist die entschlüsselte Spielstand-Struktur selbst.
   Damit lassen sich Originalspielstände laden und exportieren, und die
   Übersetzung bleibt Feld für Feld nachvollziehbar.

## Meilensteine

### M0 Grundlage (dieser Stand)
- [x] Spielstand-Verschlüsselung geknackt, Werkzeug `bmp/bmp_save.py`.
- [x] EXE entpackt, Disassembly, Querverweis-Werkzeug.
- [x] Speicherkarte mit Blocktabelle und Datensatzgrößen.
- [x] TypeScript-Kern: Codec, typisierte Datensätze, Tests gegen neun Spielstände.
- [x] Bildformat PIC/*.VGA und *.CP dekodiert, alle 162 Bilder als PNG in assets/pic.

### M1 Datenmodell vollständig
- [ ] Alle Felder von Spieler, Verein, Manager, Tabellenstand, Aufstellung benannt.
- [x] MANA.DAT (Stammdaten für neues Spiel) lesbar, Spielstart aus Stammdaten (sim/newgame.ts), Startbildschirm und Hochladen im Client.
- [x] Prototyp 0: Browser-Ansicht eines Spielstands im Originallook (Kader mit
      Aufstellungstausch, Verträge, Tabelle, Finanzen, Stadion, Meldungen),
      Rückschreiben als *.MAN. Schriften aus BMLOADER.EXE extrahiert.

### M2 Spieltag
- [x] Spielplan-Erzeugung wie im Original (Buchstabentabellen, gegen alle Spielstände geprüft, sim/fixtures.ts).
- [x] Spielsimulation aus dem Original übersetzt (packages/core/src/sim/match.ts):
      Stärke je Minute, Chancen je Halbzeit, Torwürfel. Torschnitt 2,30 gegen 2,39
      echt; der Abgleich per DOSBox steht im nächsten Punkt.
- [x] Mannschaftsstärke aus der Aufstellung in TypeScript (Anzeigeweg exakt gegen drei Spielstände, Spielweg aus dem Code).
- [x] Ergebnisverteilung über 19 wiederholte DOSBox-Spieltage (171 Spiele) geprüft: Original 58/25/17 %, 1,65:0,74 Tore; Simulation 56/26/19 %, 1,53:0,76 (tools/calib/compare.ts, docs/routines/spielsimulation.md).
- [x] Einsätze, Sperren und Frische nach dem Spiel (afterMatch, geprüft an TEST1/TEST2).
- [x] Training, Frische, Trainingsfaktor und Sonderprogramm je Kalendertag (dailyTraining, an TEST3->RUN0 geprüft).
- [x] Trainingsverletzungen mit 18 Arten und Dauer (trainingInjuries), Meldung im Serverprotokoll.
- [x] Torschützen, Vorlagen und Spielbewertung (sim/goals.ts), Schützen im Serverprotokoll.
- [x] Vertragsverhandlung der KI (0x16FC8, sim/contracts.ts), Verletzungs- und Torschützenanzeige im Client, Kredite mit Fälligkeit und Rückzahlung, Sponsor-Zuschuss, Saisonende-Prämien (sim/finance.ts, sim/seasonEvents.ts).
- [x] Ticketeinnahmen je Heimspiel und Monatsabrechnung (sim/finance.ts, Ausgaben exakt gegen RIED-CLI).
- [x] Zuschauer je Heimspiel mit Buchung (sim/attendance.ts, gegen RUNA0 geprüft).
- [x] Tabellenfortschreibung byte-genau (sim/standings.ts, geprüft an TEST4->RUNA0 und TEST3->RUN0), Kalender und Datum (sim/calendar.ts), Winterverlegungen (sim/postpone.ts).
- [x] Torschützen, Einsätze, Frische nach dem Spiel, Sperren, Verletzungen, Zuschauer und Einnahmen (sim/goals.ts, sim/matchday.ts, sim/incidents.ts, sim/attendance.ts).

### M3 Netzwerk-Saison (erster spielbarer Meilenstein)
- [x] Server (packages/server/server.ts) mit einem Raum: Sitzplatz je Manager, Züge parallel, SSE-Aktualisierung; Dauerbetrieb als systemd-Dienst.
- [x] Zug-Abschluss je Manager per Klick aufs Kalenderblatt, Spieltag aller drei Ligen läuft, sobald alle fertig sind; Ergebnisbildschirm.
- [x] Hauptmenü mit Untermenüs wie im Original (docs/original/menu-*.png), Bildschirme Spiele, Stärken, Bestenliste, Pokalrunden, Tabellen je Liga.
- [x] Statistik, Ewige Tabelle/Bilanz, Verlauf (Historieblock entschlüsselt, sim/history.ts).
- [x] Highscore, Optionen, Zeitung (sim/highscore.ts, sim/zeitung.ts).
- [x] Spielstand wählen und neu beginnen, Speichern auf dem Server aus dem Client, Aufstellung ändern und an den Server senden.
- [ ] Mehrere Räume (der Server hält genau einen Spielstand).
- [x] Kontostand, Gehälter, Zuschauereinnahmen; Training, Trainingslager, Stadionausbau, Eintrittspreis, Bankkredit als Bildschirme (Original-Routinen portiert).
- [x] Benutzeranmeldung (users.json, scrypt, Cookie-Sitzung, Sitz an Benutzer gebunden), proxy-tauglich; Betrieb hinter NGINX, siehe docs/BETRIEB.md.

### M4 Vollständigkeit
- [x] Pokale exakt (Auslosung, Runden, Hin-/Rückspiel, Titelverteidiger), Europapokale, Relegation, Werbung (Angebote und Verträge), Saisonende mit Auf- und Abstieg (sim/europa.ts, sim/werbung.ts).
- [x] Transfermarkt (Kauf, Leihe, Verkauf, eigene Spieler anbieten, KI-Angebote, Erneuerung; sim/transfer.ts), Stadionausbau.
- [x] Jugendspieler-Anzeige, Bestenliste, Torschützenliste, Stärketabelle, Nachholspiele, Zeitung.
- [x] Live-Konferenz mit Torszenen (TORE/* entschlüsselt, assets/tore), Unterbrechung per Logo-Klick und Auswechslungen (server/live.ts, web/scene.ts).
- [x] Weitere Originalgrafiken (PIC/*.VGA): Zuschauer- und Kartenzeilen der Konferenztafeln, Torszenen-Töne.

## Rahmen

Privates Projekt für drei Spieler, die alle das Original besitzen. Namen,
Grafiken und Daten des Originals werden deshalb direkt übernommen.
