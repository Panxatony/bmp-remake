# Audit der Version 2026 gegen die Originalregeln

Stand 25.9.2026. Geprüft wurde, ob die Zusätze der Version 2026 sauber vom Original getrennt
sind und ob sie zu den Originalregeln passen, die seit #100 nachgebaut sind (Kaderzahl 0x11354,
Plätze 0..Anzahl-1, Wechselregeln K1-K3, Meldungsgrenze 20 usw.). Drei Durchgänge: Transfers,
Finanzen/Medizin/Doping/Derby, Spielbetrieb/Kader. Die Runden 1 und 2 auf dem Server laufen mit
den Regeln 2026.

**Abgrenzung zum Original: in Ordnung.** Alle Zusätze fragen `is2026` ab; im Regelwerk Original
ziehen sie keine Zufallszahl und ändern kein Byte. Ausnahme ohne Wirkung: `resetPoachCounts`,
`jugendZaehlerLeeren` und `dopingCleanup` laufen auch im Original, schreiben dort aber nur Nullen
(H1).

## A. Fehler - zu beheben, ohne Regelentscheidung

**Stand 25.9.2026: alle behoben** (Tests in core/test/audit2026.test.ts und wechsel.test.ts).
Wartende ablösefreie Spieler tragen bis zur Entscheidung den Besitzer 6, damit keine Freisuche sie
zieht; nach einem Neustart des Servers werden sie wieder frei (5). Die Jugend nimmt Aufrücker über
die Aufnahme des Originals (0x224A8 wie `jugendInKader`) auf. `tools/eigenetexte.py` löst jetzt
auch `\u`-Schreibweisen auf.

| Nr | Funktion | Befund | Beleg |
|---|---|---|---|
| A1 | Ablösefreie Spieler | Der neue Verein bekommt den Spieler ohne Besitzer (Byte 33 bleibt 5): Markterneuerung, Jugend und Jahrgangswechsel behandeln ihn als frei - er kann doppelt vorkommen oder verschwinden | server.ts `resolveFreeAgents`, newgame.ts `addToSquad` |
| A2 | Ablösefreie Spieler | In der Wartezeit bis zur Entscheidung (Byte 33 = 5) können Markterneuerung und Jugendaufrücken denselben Datensatz ziehen | server.ts, transfer.ts `refreshMarket`, jugend.ts |
| A3 | Kaderlimit | Ablösefreie, Abwerben, Jugend-Aufrücken und Jugend-Abwerben prüfen nur freie Plätze statt `kaderVoll`: Kaderzahl über 24 möglich (das Original kennt das nie; beim Jahrgangswechsel kann ein Marktspieler dann nicht zurück) | abwerben.ts `poachCheck`, jugend.ts, server.ts |
| A4 | Jugend-Abwerben | `jugendFrisch` merkt sich nur den Kaderplatz: nach einer Verschiebung wird ein anderer Spieler abgeworben, auch ein Leihspieler (verwaiste Leihe) | server.ts, jugend.ts `jugendAbwerben` |
| A5 | Jugend-Abwerben | Fehlversuche unbegrenzt und kostenlos - die Zustimmungsrechnung ist wirkungslos | server.ts `/api/jugend` |
| A6 | Jugend-Abwerben | Kaufsperre bei Überschuldung wird nicht geprüft; Prüfungen aus `poachCheck` (Leihe, Karriereende, Mindestkader) fehlen | jugend.ts, server.ts |
| A7 | Jugend-Aufrücken | Positionswert `Art · 14 + Zufall`: Art 1 (ABW) wird Torwart (Wert < 25), ein Jugendtorwart mit Wert > 0 gilt bei Wechseln und Toren als Feldspieler | jugend.ts |
| A8 | Jugend-Aufrücken | Eigene Aufnahme statt 0x224A8: Ligatore/-einsätze (Bytes 34/35) des alten Datensatzes bleiben stehen, Kaderbyte 20 = 0 wird im Training zum Sonderprogramm, Frische/Faktor fest | seasonEvents.ts `addToSquad`, training.ts |
| A9 | Abwerben | Gehaltserhöhung des Besitzers trifft den gemerkten Platz - nach einer Verschiebung einen anderen Spieler | server.ts `/api/poach/answer` |
| A10 | Abwerben | Im Vertragszug des Saisonwechsels möglich: ein Spieler mit Vertrag 0 wechselt, beim nächsten Jahrgangswechsel wird daraus 255 (Vertrag läuft nie aus) | server.ts `/api/poach` |
| A11 | Konferenz | Während des laufenden Spiels nicht gesperrt: `/api/poach/answer`, `/api/jugend`, `/api/doping` (Kur in der 89. Minute beenden = gedopt ohne Risiko), `/api/derby` (Einsatz vor dem Abpfiff senken) | server.ts |
| A12 | Medizin | `medRows` liefert den Index ohne leere Plätze, `medSet` nimmt ihn als Kaderplatz: bei einer Kaderlücke trifft die Behandlung den falschen Spieler | medizin.ts |
| A13 | Doping/Transfer | Gedopter oder gesperrter Spieler auf dem Markt: der Käufer bekommt den Aufschlag dauerhaft ohne Risiko, eine Dopingsperre kommt als verkürzbare "Verletzung" an | transfer.ts `listPlayer`, `completePurchase` |
| A14 | Drei Punkte | Tabellenmeldungen ("gesichert"/"verspielt") rechnen mit 2 Punkten je Sieg und melden in 2026 zu früh | messages.ts `POINTS_PER_WIN` |
| A15 | Drei Punkte | Ewige Bilanz: Minuspunkte `2·Spiele − Punkte` werden negativ und laufen über (Werte um 65.500) | season.ts `saisonbilanz` |
| A16 | Torszenen-Editor | Ein rein numerischer Name ("12") überschreibt im Browser die Originalszene 12.T - auch in Originalrunden | server.ts `/api/szene`, scene.ts |
| A17 | Texte | Originaltext "Sie können nur maximal 1 Mio. DM ..." steht wörtlich im Code (mit ö, daher von eigenetexte.py nicht gefunden) | stadium.ts `loanRequestCheck` |
| A18 | Punktabzug | Am 30.6. (Sommertage) wird `updatePositions` auch ohne Abzug gerufen und mischt die Startreihenfolge der neuen Saison | server.ts `finanzTag` |
| A19 | Doping | Rot und Auffliegen im selben Spiel: Spiel- und Wochensperre zählen dasselbe Byte 13 herunter, die Dopingsperre läuft doppelt so schnell ab | doping.ts `dopeMatchday` |

## B. Anpassungen mit Regelentscheidung (Vorschläge)

Entscheidungen von lhuno (25.9.2026): B1 Mindestgebot = bisheriges Gehalt; B2 nein; B3 Gebote
offen anzeigen; B5 Bonus endet nach drei Wechseln; B6 ein Zusatzwechsel in der Verlängerung; B9
kein Zins im Aufnahmemonat; B10 der Borger darf ablehnen; B11 Punktabzug bleibt wie er ist; B12
Ewige Bilanz in 2026 nur Punkte; B7 Grenzen des Originals, B8 Kur endet beim Wechsel; B14
Förderung nur für Spieler-Manager, Altersangaben angleichen; B4 und B13 nach Empfehlung
(Neuaufstellung für beide Seiten; Medizin nur mit der Verletzungswoche, nicht für Rechner-Manager).
Work Items #104-#112. Umgesetzt: B1 (#104), B3 (#105, dazu offene Derby-Einsätze), B5/B6 (#106), B9/B10 (#107), B12
(#108), B4 (#109), B7/B8 (#110), B13 (#111), B14 (#112).

| Nr | Funktion | Frage | Vorschlag |
|---|---|---|---|
| B1 | Ablösefreie Spieler | Kein Mindestgebot: 1 DM Gehalt reicht | Mindestens das halbe bisherige Gehalt |
| B2 | Bietgefecht, Ablösefreie | Scheitert der Höchstbietende (Geld, Kader), geht der Spieler nicht an den Nächsten; Verlierer erfahren nichts | Gebote der Reihe nach, alle benachrichtigen |
| B3 | Bietgefecht, Derby, Ablösefreie | "Verdeckt" nur in der Oberfläche: Beträge stehen im Protokoll und im Zustand, den jeder Client bekommt | Beträge nur an den Bieter; Protokoll ohne Beträge |
| B4 | Abwerben, Jugend | Keine Neuaufstellung nach dem Wechsel (Werber, Besitzer) | `autoLineupIfEnabled` wie bei Kauf und ablösefreien Spielern |
| B5 | Fünf Wechsel | Jede Auswechslung gibt im Original +30 Technik je Mannschaftsteil (Eigenheit, wirkt bis ins nächste Spiel) - mit 5 Wechseln bis +150 statt +90 | Bonus in 2026 bei 3 Wechseln kappen |
| B6 | Fünf Wechsel | Kein Zusatzwechsel in der Verlängerung | offen lassen oder +1 wie heute |
| B7 | Doping | Form (Original 45..55) und Frische verlassen die Originalspannen; beim Absetzen wird nicht auf Originalgrenzen geklemmt | Aufschlag an den Grenzen bemessen, beim Abziehen klemmen |
| B8 | Doping | Kur und Sperre wandern bei Leihe und Abwerben mit, die Grenze von drei Kuren lässt sich so umgehen | beim Wechsel absetzen |
| B9 | Zinstermin 2026 | Ein Kredit über 3 Monate zahlt vier Zinsraten (Aufnahmemonat mit) | im Aufnahmemonat nicht buchen |
| B10 | Kredit mit Zustimmung | Der Borger muss die Bedingungen des Geldgebers annehmen, das Geld fließt sofort | Rückfrage beim Borger |
| B11 | Punktabzug | zuerst vom Heimkonto (verfälscht die Heimtabelle); trifft auch Rechner-Manager | hälftig verteilen; Rechner ausnehmen? |
| B12 | Ewige Bilanz | "PUN." zeigt auch in 2026 für:gegen | in 2026 nur Punkte |
| B13 | Medizin | wirkt auch am Tag ohne Tagesroutine (Saisontag 322); Rechner-Manager bekommen nur den Rückschlag | an die Tagesroutine koppeln |
| B14 | Jugend | Förderkosten laufen für Rechner-Manager weiter, deren Spieler nie aufrücken; Altersangaben A-/B-Jugend überschneiden sich | abschalten bzw. Anzeige anpassen |

## H. Hinweise

- H1: `resetPoachCounts`, `jugendZaehlerLeeren`, `dopingCleanup` mit `is2026` einfassen (schreiben
  im Original nur Nullen).
- H2: Die 2026-Bytes 34099..34129 liegen in der Ablauftabelle der Meldungen 4238:5664 (regeln.ts
  sagt anderes). Im eigenen Spiel kein Konflikt; beim Import eines Originalstands mit belegten
  Einträgen 1..9 stünden Zeiger im Regelbyte (unklar, in 50 Originalständen nie belegt).
- H3: Bankkredit (beide Regelwerke): Laufzeit und Zins kommen ungeprüft vom Client.
- H4: Kleinigkeiten in Texten: "Ihr Kader ist voll" statt `ui.kadervoll`, "verl{sst"/"verl{~t",
  `toUpperCase` statt `upperGame`, gemischte Schreibung im Extras-Bildschirm, Hilfetext "VERL."
  bei Dopingsperre, Dialog nennt immer "+12".
- H5: Viele Einzelmeldungen (Gebote, Freigaben) verdrängen wegen der Grenze 20 ältere Meldungen.
- H6: SPIELMECHANIK: Satz zur Ewigen Tabelle mit 3 Punkten ist veraltet (Byte 50 zählt Plätze).
- H7: Würfelfolge: Arzt, Doping und Rückschlag würfeln nach der Tagesroutine - in 2026 sind die
  Folgetage verschoben (gewollt, nur Doku).

## Was passt

Tabellensortierung mit 3 Punkten (auch Heim/Auswärts), Auf- und Abstieg, Relegation, Ewige
Tabelle (Byte 50), Vereinsinfo; fünf Wechsel mit K2/K3; Dopingsperre über Byte 9/13 greift in K1,
Automatik und Anzeige; Bietgefecht-Zuschlag über `aiAccepts` und `kaderVoll`; Kredit mit
Zustimmung prüft Grenzen doppelt; Kaufsperre an allen direkten Kaufwegen; Derby ohne Würfel;
Guthabenzins-Obergrenze in Anzeige und Buchung gleich; Meldungen über die Originalwege (neueste
vorn, höchstens 20).
