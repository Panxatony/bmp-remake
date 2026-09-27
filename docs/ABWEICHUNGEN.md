# Abweichungen vom Original im Regelwerk "Original"

Stand 25.9.2026. Diese Liste gilt für ein Spiel, das im Remake mit den Originalregeln läuft.
Die Zusätze der Version 2026 stehen in docs/AUDIT.md, Abschnitt 4. Alles, was hier nicht steht,
soll sich wie das Original verhalten; wo es das nicht tut, ist das ein Fehler.

## Entschiedene Änderungen an Spielregeln

| Was | Original | Remake | Entscheidung |
|---|---|---|---|
| Neuauslosung der Chancen in der Konferenz (Platzverweis, Verletzung) | verrechnet die neue Chancenzahl so, dass die geschwächte Seite eher mehr Chancen bekommt | Rest = max(0, neu − gespielt) | lhuno, GitLab #87; `sim/live.ts`, Zweigbuch 05403 |
| Elfmeterschießen im Europapokal und in der Relegation | das Schießen überschreibt den Ergebnisspeicher; Hinspieltore und Elfmeter zusammen entscheiden, der Verlierer des Schießens kann weiterkommen | der Sieger des Schießens kommt weiter | lhuno, Zweigbuch 18E46 (V2) |
| Verkauf eines Kaderspielers an einen Rechnerverein | liest Verein und Stärkeschnitt erst nach dem Entfernen des Platzes, also vom Nachrücker (0x235DD-0x2361D): der Verkaufte landet meist bei Verein 0, gestärkt wird ein falscher Verein, Byte 22 des Nachrückers wird genullt | der Käufer bekommt den Spieler und dessen Stärke | lhuno, 26.9.2026; Audit 2 E18/F8, `sim/transfer.ts` decideSale |
| Zurückholen vom Transfermarkt mit gewähltem LEIHEN | läuft als Leihe: ein Jahr, Leihmarke, Gehalt ein Drittel (0x224A8 mit 99) | Zurückholen behält Vertrag und Gehalt | lhuno, 26.9.2026; Audit 2 E28, `sim/transfer.ts` takeBack |
| Spielende eines 1-/3-Jahres-Spiels | Bestenliste, "ENDE", dann beendet sich das Programm (0x87FC), ohne zu speichern | Bestenliste und "ENDE" für alle; die Runde nimmt danach keine Züge mehr an, weiter nur mit neuem Spiel oder Laden | #133 (Mehrspielerbetrieb) |
| Aufnahme in ein 1-/3-Jahres-Spiel | im selben Programmlauf wie das neue Spiel beginnen Aufgenommene in der Bundesliga (4238:56F4 = 1), nach dem Laden in der Oberliga | immer in der Oberliga, wie nach dem Laden (vgl. Jugendspieler, #134) | #132/#133 |
| Schummeltasten der Einstellungen | wirken mit dem Mauszeiger auf einem Bildpunkt der Farbe 11 (0x26A85; in DOSBox: Buchstaben und Pfeil von HAUPT MENU); niemand erfährt davon | wie im Original; die anderen Mitspieler bekommen "Jemand schummelt!" ohne Namen. 'd' und 'p' ohne Wirkung (Kennungen des Speicherns, ungelesener Merker) | lhuno, 27.9.2026; #135 |
| Kauf oder Leihe vom Marktspieler eines anderen Managers | setzt Spielerbyte 36 nach der Aufnahme auf den Verein des Verkäufers (0x24067-0x2407E): der Spieler trägt weiter den alten Verein, seine Tore zählen in der Torschützenliste dort | der Spieler trägt den Verein des Käufers | lhuno, 27.9.2026; gefunden bei #125, `sim/transfer.ts` kaufVertrag/completeLoan |
| Jugendspieler in den ersten drei Saisons | nach einem neuen Spiel im selben Programmlauf (4238:56F4 = 1, 0xBD4D) läuft der Jugendblock erst bei einem Kalenderjahr über 1995 (0xCEA7-0xCEEE): an den Saisonenden 1993 bis 1995 kein Jugendspieler, kein Abbuchen des Jugendkontos, kein Wurf. Nach dem Laden in einem neuen Lauf gilt die Sperre nicht | Jugendspieler ab dem ersten Saisonende, wie im Original nach dem Laden | lhuno, 26.9.2026; Audit 2 B11, #134, `sim/seasonEvents.ts` |

## Wegen Mehrspielerbetrieb und Browser

| Was | Original | Remake |
|---|---|---|
| Speichern | beendet den Zug, das Kalenderblatt nimmt keinen Klick mehr an | nur eine Aufnahme des Serverstands, gespielt wird weiter (AUDIT B5) |
| Zug | die Manager ziehen nacheinander an einem Rechner | alle ziehen gleichzeitig; der Tag läuft, wenn alle fertig sind |
| Konferenz | läuft durch, Seiten per Klick | wartet an Halbzeit und Schluss, bis alle besetzten Manager bestätigt haben; der Tag wird beim Schlusspfiff gebucht |
| Meldungen | eine Meldungsliste nur für Manager 0 (0x0E00B) | eigene Meldungsliste je Manager auf dem Server (Zweigbuch 0DF0D) |
| Meisterschaft, Pokalsieg | Meldung an den Sieger | Meldung an alle Manager |
| Aufhören | Rückfrage 0x0A7DD | nach derselben Rückfrage führt der Rechner den Verein weiter, die Runde läuft für die anderen weiter |
| Preis des Trainingslagers | einmal je Programmlauf für den ziehenden Manager | für den, der den Bildschirm öffnet |
| Anzeigeoptionen, Zinsleitwert, Öffnungszeiten der Lager | nur im Speicher, nach dem Laden auf der Vorgabe | im Raumzustand des Servers; Zinsleitwert aus Byte 35 |
| Heim- und Auswärtstabelle ansehen | schreibt die Reihenfolgeliste und die Plätze um; beim Verlassen wird ab der Heimreihenfolge neu sortiert, bei völligem Gleichstand bleibt die Gesamtreihenfolge dauerhaft anders | nur Anzeige, der Spielstand bleibt unberührt (restroutinen.md, R13) |
| Lebensdauer der Meldungen | verfallen nach drei Tagen (Zähler 4238:1D34) | bleiben bis "Gelesen", je Manager die 20 neuesten (so viele fasst die Tabelle des Originals) |
| Laden | nur Stände, die im selben Programmlauf weder geladen noch gespeichert wurden; V1-Stände mit Levelabfrage; fehlt der Anhang, wird trotzdem geladen | jeder V2-Stand mit Anhang (R16, Rest) |

## Weggelassen

| Was | Anmerkung |
|---|---|
| Historischer Start (Schalter "Histor. Start" im Startbildschirm, Bit 3 bei 0x0BBE3) | das Original beginnt dann in der Saison 1963/64 (4cb3:07E0 = 1963 aus dem Abbild, sonst 1992 bei 0x0BD63); das Remake beginnt immer 1992/93 (Audit 2 B9) |
| Wappenleiste im Startbildschirm | die Kaderwerte, die das Original über ihre Stellung in einen fremden Spieler schreibt, landen im unbenutzten Spieler 0 (docs/abgleich/neuesspiel.md) |
| Credits (Klick im Startbildschirm, 0x0F749) | nicht nachgebaut |
| Stärkeliste der Zielvereine 0x0F58B | rechnet das Original aus, benutzt sie aber nicht |

## Bekannte Näherungen (keine Entscheidung, sondern noch nicht nachgebaut)

| Was | Warum | Zweigbuch |
|---|---|---|
| Kleine Bank: die 13 auf einen nicht gesetzten Platz | im Standardspiel nie erreicht | 22030 |
