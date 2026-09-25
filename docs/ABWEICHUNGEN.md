# Abweichungen vom Original im Regelwerk "Original"

Stand 25.9.2026. Diese Liste gilt für ein Spiel, das im Remake mit den Originalregeln läuft.
Die Zusätze der Version 2026 stehen in docs/AUDIT.md, Abschnitt 4. Alles, was hier nicht steht,
soll sich wie das Original verhalten; wo es das nicht tut, ist das ein Fehler.

## Entschiedene Änderungen an Spielregeln

| Was | Original | Remake | Entscheidung |
|---|---|---|---|
| Neuauslosung der Chancen in der Konferenz (Platzverweis, Verletzung) | verrechnet die neue Chancenzahl so, dass die geschwächte Seite eher mehr Chancen bekommt | Rest = max(0, neu − gespielt) | lhuno, GitLab #87; `sim/live.ts`, Zweigbuch 05403 |
| Elfmeterschießen im Europapokal und in der Relegation | das Schießen überschreibt den Ergebnisspeicher; Hinspieltore und Elfmeter zusammen entscheiden, der Verlierer des Schießens kann weiterkommen | der Sieger des Schießens kommt weiter | lhuno, Zweigbuch 18E46 (V2) |

## Wegen Mehrspielerbetrieb und Browser

| Was | Original | Remake |
|---|---|---|
| Speichern | beendet den Zug, das Kalenderblatt nimmt keinen Klick mehr an | nur eine Aufnahme des Serverstands, gespielt wird weiter (AUDIT B5) |
| Zug | die Manager ziehen nacheinander an einem Rechner | alle ziehen gleichzeitig; der Tag läuft, wenn alle fertig sind |
| Konferenz | läuft durch, Seiten per Klick | wartet an Halbzeit und Schluss, bis alle besetzten Manager bestätigt haben; der Tag wird beim Schlusspfiff gebucht |
| Meldungen | eine Meldungsliste nur für Manager 0 (0x0E00B) | eigene Meldungsliste je Manager auf dem Server (Zweigbuch 0DF0D) |
| Meisterschaft, Pokalsieg | Meldung an den Sieger | Meldung an alle Manager |
| Ende nach der eingestellten Saisonzahl | "ENDE" | entfällt |
| Aufhören | Rückfrage 0x0A7DD | nach derselben Rückfrage führt der Rechner den Verein weiter, die Runde läuft für die anderen weiter |
| Preis des Trainingslagers | einmal je Programmlauf für den ziehenden Manager | für den, der den Bildschirm öffnet |
| Bauzeit in der Rückfrage | vor der Rückfrage gewürfelt, der Kasten nennt sie | der Server würfelt beim Bau, der Kasten nennt den Mittelwert |
| Anzeigeoptionen, Zinsleitwert, Öffnungszeiten der Lager | nur im Speicher, nach dem Laden auf der Vorgabe | im Raumzustand des Servers; Zinsleitwert aus Byte 35 |
| Heim- und Auswärtstabelle ansehen | schreibt die Reihenfolgeliste und die Plätze um; beim Verlassen wird ab der Heimreihenfolge neu sortiert, bei völligem Gleichstand bleibt die Gesamtreihenfolge dauerhaft anders | nur Anzeige, der Spielstand bleibt unberührt (restroutinen.md, R13) |
| Lebensdauer der Meldungen | verfallen nach drei Tagen (Zähler 4238:1D34) | bleiben bis "Gelesen", je Manager die 20 neuesten (so viele fasst die Tabelle des Originals) |
| Laden | nur Stände, die im selben Programmlauf weder geladen noch gespeichert wurden; V1-Stände mit Levelabfrage; fehlt der Anhang, wird trotzdem geladen | jeder V2-Stand mit Anhang (R16, Rest) |

## Weggelassen

| Was | Anmerkung |
|---|---|
| Historische Startjahre 1964/1966 | nicht angeboten; damit steht die Bank immer auf vier Ersatzspielern (4238:56EE = 15) |
| Wappenleiste im Startbildschirm | die Kaderwerte, die das Original über ihre Stellung in einen fremden Spieler schreibt, landen im unbenutzten Spieler 0 (docs/abgleich/neuesspiel.md) |
| Relegationsmeldung am 13. Juni | im Original über 4cb3:226A abgeschaltet |
| Credits (Klick im Startbildschirm, 0x0F749) | nicht nachgebaut |
| Stärkeliste der Zielvereine 0x0F58B | rechnet das Original aus, benutzt sie aber nicht |

## Bekannte Näherungen (keine Entscheidung, sondern noch nicht nachgebaut)

| Was | Warum | Zweigbuch |
|---|---|---|
| Kleine Bank: die 13 auf einen nicht gesetzten Platz | im Standardspiel nie erreicht | 22030 |
