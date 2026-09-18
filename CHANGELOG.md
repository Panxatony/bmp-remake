# Änderungen

## Unveröffentlicht

- **RK im Kaderbildschirm zählt nur glatt Rot** (aus dem Zahlenaudit #55): Eine Gelb-Rote Karte
  erschien dort als Rote. Im Original steht in der Spalte RK nur Byte 0; Gelb-Rot führt die
  Spielerinfo in einer eigenen Zeile. Nachgemessen an TEST4 in DOSBox (WIRSCHING: eine Gelb-Rote,
  RK bleibt 0).

- **Tore je Spiel werden abgeschnitten, nicht gerundet** (aus dem Zahlenaudit #55): In der
  Statistik standen 0,7 und 0,3 Gegentore je Spiel, im Original sind es 0,6 und 0,2 - es
  schneidet auf ein Zehntel ab (an `docs/original/buero-statistik.png` nachgemessen).

- **Spieler kündigen an, dass sie nicht verlängern** (GitLab #59, aus dem Meldungsaudit #54):
  Im letzten Vertragsjahr meldet das Original "<Name> kündigt an, daß er seinen Vertrag nicht
  mehr verlängern wird." - die Vorwarnung zum Vertragsende, die im Remake ganz fehlte. Die
  Wahrscheinlichkeit hängt an Alter und Stärke: je näher an 25 und je stärker, desto seltener.
  Danach verhandelt der Spieler nicht mehr (Kaderbyte 24 ab 100), wie im Original.

- **Karriereende im Wortlaut des Originals** (GitLab #58, aus dem Meldungsaudit #54): Statt
  "<Name> beendet seine Karriere." steht dort jetzt die Meldung des Originals mit ihrem festen
  Zeilenschnitt - "<Name> hängt den / Fußballjob im Alter von / <Alter> Jahren an den Nagel."
  (Vorlage 0x4E0AE). Auch die Überschrift "Saisonende" fällt dabei weg, die hat das Original nicht.

- **Der Stadionkomfort nutzt sich ab** (GitLab #57, gefunden im Meldungsaudit #54): Das Original
  würfelt jeden Kalendertag `random(0, 442 - 52·Komfort)`; bei 0 fällt die Komfortnote um eins,
  solange sie über 1 liegt, und der Manager bekommt die Meldung "In der neuen Komfortbewertung
  wird ihr Stadion um eine Note schlechter beurteilt." Im Remake sank die Note **nie** - damit
  blieben Zuschauer, Werbeeinnahmen und Monatskosten dauerhaft zu hoch, und "Komfort verbessern"
  war einmal gekauft für immer. Bei Note 3 fällt sie mit 1/286 je Tag, bei Note 6 mit 1/130.

- **Dopingstrafen neu gefasst** (GitLab #48, Regel von lhuno): Die Sperre liegt jetzt zwischen
  **12 und 24 Wochen** (vorher 13 bis 39), die Geldstrafe ist **50.000 DM plus 5 % des Vermögens**
  (vorher 200.000 bis 500.000 DM mal Ligafaktor, also bis zu einer Million) – ein Minus auf dem
  Konto senkt sie nicht. Der Ligafaktor entfällt, weil die Liga jetzt über das Vermögen wirkt.
  Neu ist außerdem eine Grenze: **höchstens drei Kuren gleichzeitig**. Der Dopingbildschirm nennt
  die Strafe in DM und zeigt "2/3 KUREN LAUFEN".

- **Trainingslager zeigt wieder etwas** (GitLab #42): Nach der Buchung sprang der Bildschirm
  wortlos ins Hauptmenü - im Original steht dort kurz ein Kasten mit einem Kopf (PIC/28.VGA,
  mittig bei 132,78), während die Wirkung gerechnet wird. Den zeigt das Remake jetzt auch.
  Die Rechnung selbst stimmte schon: an lhunos Spielstand im Original nachgemessen bringt das
  Fitnesscenter Krone +1,95 Kondition, +1,40 Technik und +1,50 Form im Schnitt - das Remake
  kommt auf +1,93 / +1,67 / +1,33.

- **Nach einem Platzverweis bleibt es bei zehn**: Ein Klick auf die automatische Aufstellung
  besetzte im laufenden Spiel auch den Platz eines vom Feld gestellten Spielers wieder - die
  Mannschaft spielte zu elft weiter, während die Tafel zehn Spieler zeigte. Die Systemwahl läuft
  jetzt durch dieselbe Prüfung wie eine Auswechslung und wird abgelehnt ("Ein Platzverweis lässt
  sich nicht ersetzen"); der Kader bleibt dann, wie er war.

- **Pokalspiele: Zuschauer in der Konferenz**: Die Tafel zeigte bei Pokalspielen keine
  Zuschauerzahl - gerechnet und gebucht wurde sie im Kern schon (mit den Pokalkapazitäten des
  Originals, Einnahme geteilt zwischen beiden Vereinen). Jetzt steht sie auch auf der Tafel, und
  gebucht wird genau die angezeigte Zahl.

- **Chancen zählen nur die eigene Mannschaft**: Auf der Tafel gelten Karten, Verletzte und
  Spielerzahl der Mannschaft des Managers - die Chancen zählten beide Mannschaften zusammen.

- **Keine Meldung über Pokalspiele mehr**: Das Original schreibt dazu keine (seine
  Meldungsroutine hat sieben Aufrufstellen, keine im Pokal). Das Ergebnis steht in der Konferenz,
  im Spielplan und im Verlauf.

- **Wortlaut wie im Original**: "<Verein> ist an <Spieler> interessiert." statt "interessiert
  sich für" (Meldungsvorlage 0x4E08C).

- **Statuszeile passt ins Bild**: Lange Meldungen wie "Gebot 370.000 DM für THON steht bis zum
  Tageswechsel" liefen rechts hinaus. Jetzt weicht die Zeile auf die kleine Schrift aus und wird
  erst dann gekürzt.

- **Torszene: Meldung statt Minute, nichts läuft mehr aus dem Bild**: Unter der Szene standen
  Minute und Meldung übereinander, und die Zeile "nach Vorlage von ..." war unten abgeschnitten.
  Im Original (in DOSBox nachgemessen) steht dort **entweder** die Minute **oder** die Meldung:
  solange die Szene läuft die Minute, am Ende "Torschütze: ... (n)" bei y 219 und der
  Vorlagengeber bei y 229, beide in der normalen Schrift. Genau so macht es das Remake jetzt.

- **Weniger Meldungen: der Fanwert bleibt verborgen** (GitLab #41): Das Remake schrieb
  "Fanwert steigt auf 47", Zinsen und die Monatsabrechnung in die Meldungsliste. Das Original
  ruft seine Meldungsroutine (0x30AA0) an genau sieben Stellen auf; die Fanerhöhung (0x11F76)
  gehört nicht dazu, und Einnahmen und Ausgaben stehen im Finanzbildschirm. Diese drei stehen
  jetzt nur noch im Verlauf des Servers. Randale (Meldung über 0x0239E) und fälliger Kredit
  (Hinweiskasten 0x12076) bleiben, wie sie sind.

- **Klicks gehen nicht mehr durch offene Kästen hindurch**: Der Eingabekasten (Gebot, Kredit,
  Gehalt), die Marktdialoge, die Frage zur Pokalauslosung und die Abwerbe-Anfrage meldeten ihre
  Schaltflächen an, ohne die des Bildschirms darunter zu löschen - und es gewinnt die zuerst
  angemeldete Fläche. Im Transfermarkt öffnete ein Klick in den Gebotskasten deshalb die Frage
  "<Spieler> AUF DEN TRANSFERMARKT SETZEN?" aus der Kaderliste dahinter (von lhuno mit
  Bildschirmfoto gemeldet: Kopfzeile "IHR ANGEBOT FÜR CRIENS", darin die Frage nach DEMANDT).
  Jetzt schirmen diese Kästen den Bildschirm ab, wie es der Hinweiskasten schon tat.

- **Ergebnisübersicht: Tabellenplatz statt Stärkerang**: Unter jeder Paarung stand "n. PLATZ,
  STÄRKE ..." - die Zahl war aber der Rang in der Stärkeliste, nicht der Tabellenplatz. Im
  Original setzt das Programm dort das Tabellenbyte 46 + 1 ein (0x2C193). Betroffen waren die
  Halbzeit-/Schlussseiten der Konferenz und die Spieltagsseite; die Zahl kommt jetzt aus der
  Tabelle (von lhuno gemeldet: Fortuna Düsseldorf stand als 4. statt als 18.).

- **Einstellungen gelten auch nach dem Spieltag**: Der Ergebnisbildschirm, den das Remake nach
  einem Spieltag zeigt, fragte die Schalter für Ergebnisse je Liga nicht ab - abgeschaltete
  Ligen kamen trotzdem. Er benutzt jetzt dieselben Schalter wie die Konferenz.

- **Auslaufende Verträge lassen sich verlängern** (GitLab #39): Bisher verließ jeder Spieler mit
  abgelaufenem Vertrag den Verein - das Original verhandelt erst. Jetzt bleiben diese Spieler
  zunächst im Kader (in der Vertragsansicht rot), und im ersten Zug der neuen Saison öffnet sich
  die Verhandlung des Originals Spieler für Spieler: "NEUER VERTRAG" wie gewohnt, "KEIN ANGEBOT"
  lässt ihn ziehen. Danach kommt der Kasten des Originals - "bleibt Ihnen auch die nächste Saison
  erhalten." oder "kehrt Ihrem Verein den Rücken..." mit der Ablöse. Wer am Zugende noch offen
  ist, geht; Spieler der Rechnermanager gehen sofort. Dabei fiel auf, dass das Original den Kader
  beim Abgang aufschiebt (0x1FDBE) - das Remake ließ eine Lücke.

- **Kader bleibt sortiert**: Ein Spieler, der vom Transfermarkt zurückgeholt wurde (`takeBack`),
  hing hinten am Kader, statt nach Mannschaftsteil einsortiert zu werden - in "IHRE MANNSCHAFT"
  stand dann etwa ein Torwart unter den Angreifern. Alle anderen Aufnahmewege sortierten schon.
  Spielstände, in denen das passiert ist, ordnet der Server beim Laden einmal neu (`sortSquad`).

- **Werbeverträge am Saisonende wie im Original** (GitLab #38): Das Remake beendete alle
  Werbeverträge jeder Saison. Im Original rührt das Saisonende die Werbung **nur beim
  Aufsteiger** an (ohne Aufstieg springt es über den ganzen Block, 0x0D924): dann enden die
  laufenden Verträge, **die Einnahmen bleiben aber erhalten**, und weil die Plätze frei sind,
  lassen sich in der höheren Liga sofort bessere Verträge abschließen. Schon abgelaufene
  Verträge verlieren dabei noch einmal neun Zehntel ihres Betrags - beim Trikot fehlte diese
  Kürzung ganz. Lief der Trikotvertrag noch, erklärt jetzt der Hinweiskasten des Originals, wie
  es gemeint ist ("Ihre Werbepartner erlauben es, die Verträge jederzeit zu kündigen. Die
  Einnahmen bleiben solange erhalten."). Eine eigene Kündigungsfunktion hat das Original nicht;
  die Restmonate werden nur beim Abschluss, im Monatsablauf und an dieser Stelle geschrieben.

- **Texte des Originals stehen nur noch im Katalog** (GitLab #37): `tools/eigenetexte.py` sucht
  jede Zeichenkette des Quelltextes im Programm des Originals. Alle Funde sind erledigt:
  Meldungen, Absagen und Beschriftungen in Kern, Server und Browser kommen jetzt aus dem
  Textkatalog (31 neue Gruppen, 6 erweiterte, zusammen 109 Texte mehr), die übrigen waren eigene
  Formulierungen, die nur mit einem Wortanfang des Originals zusammenfielen, und sind
  umformuliert. Dabei fielen drei Abweichungen auf: der Kasten "Wegen Wucher" zeigt im Original
  vier statt drei Zeilen (samt "Okay... War nur ein Scherz..."), die
  Kreditgrenze schreibt "maxmimal", und die Meldung über einen fertigen Ausbau nennt das
  Bauwerk mit eigenem Betreff ("Die Errichtung der neuen Flutlichtmasten") statt mit dem Kürzel
  des Stadionbildschirms. Alles drei ist nachgezogen; der Prüflauf ist jetzt leer und endet mit
  Rückgabewert 1, sobald wieder ein Text im Quelltext landet. Aufgefallen ist dabei auch, dass
  ein Katalogzugriff auf Modulebene den Server nicht starten ließ - der Katalog kommt erst zur
  Laufzeit, deshalb ist `TOO_LONG_TEXT` jetzt die Funktion `tooLongText()`.

- **Hinweiskasten vollständig abgeglichen** (GitLab #36): `tools/kasten.py` löst alle 26
  Aufrufstellen des Kastens samt Texten auf. Dazu kommen die 0:2-Wertung und der Mindestzins beim
  Kredit in den Kasten. Was das Original darin zeigt und das Remake noch nicht kann, steht als
  #38 (Werbeverträge kündigen) und #39 (Verlängerung am Saisonende) fest.

- **Keine Browserfenster mehr** (GitLab #36). Neun Stellen fragten noch über `prompt`, `confirm`
  oder `alert`: Kredit aufnehmen und geben, Gebot für einen ablösefreien Spieler, Managername,
  Speichern unter, Spielstand hochladen und neues Spiel. Alles läuft jetzt in den Kästen des
  Spiels, mit den Fragen des Originals ("Wie hoch soll der Kredit sein ?"); die Eingabe kann
  dafür auch Text. **Absagen des Servers** stehen im roten Hinweiskasten statt in der
  Statuszeile, die es im Original nicht gibt. Der fällige Kredit und das Vertragsende am
  Saisonende kommen ebenfalls in den Kasten, weil ihr Wortlaut in seiner Texttabelle steht.

- **Takt des Tagesablaufs geprüft und berichtigt** (GitLab #34, #35). Für jeden Aufruf im
  Tagesablauf des Originals steht jetzt fest, wie oft er läuft (Aufrufkarte in
  `docs/SPIELMECHANIK.md`). Fünf Abweichungen sind behoben:
  - Die **Vereinsstärken der KI** schwanken an jedem Kalendertag, nicht nur am Monatsende.
  - **Sponsorenangebote** werden alle 14 Saisontage neu gewürfelt; bisher standen sie die ganze
    Saison über fest.
  - Die **Zinstabelle der Bank** driftet mit 1/61 je Manager und Tag statt fest am Monatsende.
  - Die **Öffnungszeiten der Trainingslager** zählen je Manager herunter, nicht einmal je Tag.
  - **Gesperrte und verletzte Spieler** verlieren an jedem Kalendertag ihre Rückennummer.

- **Erbauer der Torszene** (GitLab #28): ein Rechtsklick in der Live-Konferenz zeigt wie im
  Original im Hinweiskasten, wer die zuletzt gespielte Torszene gebaut hat - bei eigenen Szenen
  der Name aus dem Editor. Die drei Textzeilen kommen aus dem Programm (Textkatalog
  `live.erbauer`, also `npm run texte` neu laufen lassen).

- **Aufgeräumt** (GitLab #29, #30): die unerreichbaren Bildschirme aus Prototyp 0 sind entfernt;
  `docs/SPIELMECHANIK.md` und `docs/PLAN.md` stimmen wieder mit dem Stand überein.

- **Tage ohne Spiele sind kein Zug mehr** (GitLab #32). Das Original rechnet einen Kalendertag
  ohne Spiele ohne Zug durch - Finanzen, Training, nächster Tag - und hält erst am nächsten Tag
  mit Spielen an. Die **Winterpause** läuft damit wie im Original in einem Tageswechsel vom
  2.12. bis zum 21.2. durch (bisher 22 leere Züge), ebenso jeder einzelne spielfreie Tag zwischen
  zwei Spieltagen. Weihnachten und die Monatsabrechnungen werden unterwegs gebucht, die
  Ergebnisübersicht zeigt den ganzen Wechsel.

- **Transfermarkt im Takt des Originals** (GitLab #33). Frische der Marktspieler und Angebote
  fremder Vereine liefen je Saisontag, also drei- bis viermal je Zug; sie laufen jetzt einmal je
  Kalendertag. Die Markterneuerung würfelt das Original vor jedem Zug eines Managers, nicht an
  jedem Tag - so jetzt auch das Remake.

- **Frische über die Winterpause wie im Original** (GitLab #27, Befund B3 des Audits). Beim
  Lesen der Trainingsroutine zeigten sich vier Fehler: das Winterfenster (Saisontag 131..206)
  stand verkehrt herum und galt dadurch nur nach Saisontag 207; die Mindestintensität 6 in der
  Winterpause hatte eine Bedingung, die nie zutraf; die Zuschläge `Zufall(0,2)` je Linie waren in
  #24 gestrichen worden, weil die damalige Messung am Saisontag 249 lag, wo es sie auch im
  Original nicht gibt; und die Kader verlieren Frische schon über 50, die 56 gehört zum
  Transfermarkt. Dazu ein fünfter: **das Training rechnet für den Tag, an dem der Zug ankommt** -
  der Tagesablauf spielt erst, zählt dann hoch und trainiert. Am Original über die Winterpause
  gemessen: bei Intensität 10 stehen danach alle Spieler auf genau 150, bei Intensität 1 fällt
  die Frische im Mittel um 8,6 statt auf 60. Das Remake trifft jetzt beides.

- **Jugendarbeit (Version 2026)**: drei Jugendmannschaften je Manager (C, B, A) mit je zwölf
  Plätzen, sortiert nach Tor, Abwehr, Mittelfeld, Sturm. Zwei Hebel je Spieler: **Geld**
  (2.000 DM im Monat) bezahlt die Betreuung, **Training** in drei Stufen treibt an. Beides
  zusammen kann ein Talent über sein Potenzial hinauswachsen lassen - und nur dieser Weg trägt
  das Risiko, dass der Spieler die Lust verliert und aufhört. Zum Saisonwechsel altern alle,
  steigen höchstens zwei je Mannschaft auf, der Rest geht. Wer aus der A-Jugend herauswächst,
  lässt sich in die Männermannschaft holen (höchstens fünf je Saison, halbe Gehaltsbasis); frisch
  Aufgerückte darf ein Mitspieler abwerben, einmal je Saison. Neuer Bildschirm im Untermenü Büro
  mit eigenem Symbol (`tools/icon_jugend.py`) und dem Verlauf der letzten vier Saisons.
  Gespeichert wird in einem Anhang am Spielstand, den das Original ignoriert (GitLab #4).

- **Jugendarbeit: nur vier je Jahrgang**: ein Trainer schafft nicht zwölf. Gleichzeitig gefördert
  (Geld oder Training) werden können höchstens vier Spieler je Mannschaft; die übrigen acht
  entwickeln sich mit der Grundchance weiter. Der Stand steht oben rechts im Bildschirm, und wer
  den fünften anklickt, bekommt es gesagt statt eines wirkungslosen Knopfes.

- **Jugendarbeit: Herkunft am Namen**: wer aufsteigt, trägt das Kürzel seiner alten Mannschaft
  hinter dem Namen - "NAME (C)" in der B-Jugend, "NAME (B)" in der A-Jugend.

- **Torszenen-Editor: WIE IM SPIEL, NEU und SZENE >** (GitLab #6). Der neue Schalter zeigt die
  Szene beim Abspielen so, wie sie in der Konferenz läuft - nur der Kameraausschnitt, dazu die
  Klänge an den Marken der Szene. Der Editor fing bisher immer mit der zuletzt abgelegten Szene
  an und zeigte damit ewig das Beispiel "konter"; jetzt startet er mit einer frischen Vorlage,
  NEU fängt neu an und SZENE > holt die abgelegten der Reihe nach.

- **Hinweiskasten wie im Original** (GitLab #31). Die Kalendermeldungen - "Achtung ! Dies ist der
  letzte Spieltag vor der Winterpause.", Relegation, Meisterschaft/Klassenerhalt gesichert oder
  verspielt - stehen nicht mehr in den grauen Meldungskästen, sondern kommen wie im Original
  einmal je Zug im roten Kasten mit OKAY. Maße und Farben sind aus der Routine 0x3174A gelesen;
  derselbe Kasten zeigt jetzt auch die Absagen am Transfermarkt, der bis dahin nur nach Augenmaß
  gebaut war. Nebenbei: das **Ausrufezeichen** der großen Schrift war ein gemustertes Kästchen,
  weil es im Original zwei Plätze weiter liegt (`tools/fonts.py`; `npm run assets` neu laufen
  lassen).

- **Beispielszene "konter" trifft jetzt auch**: der Ball flog in der Tor-Fassung vor das Tor
  (y 50 liegt unter der Latte) und in der Chancen-Fassung hinein - die beiden waren vertauscht.
  Tor-Fassung und Vorlage des Editors enden jetzt im Netz (x 296..318, y 19..39, wie in den
  Szenen des Originals gemessen), die Chancen-Fassung geht über die Latte.

- **Torszenen-Editor verständlich gemacht** (GitLab #6): neuer Knopf HILFE mit einem Blatt, das
  den Gedanken dahinter erklärt (man setzt nur Schlüsselbilder, den Weg dazwischen rechnet das
  Spiel); beim ersten Öffnen liegt es von selbst oben. Eine Figur lässt sich jetzt **anklicken**
  statt nur durchschalten, sie trägt ihren Namen über dem Rahmen, und die Hinweiszeile sagt, was
  der nächste Klick tut. "BILD -/+" hieß dasselbe wie das laufende Bild und heißt jetzt
  "LÄNGE -/+", "LÖSCHEN" heißt "MARKE WEG", "SPRITE" heißt "AUSSEHEN" und zeigt das Bild daneben.

- **Schaltflächen passen sich der Beschriftung an**: `knopf()` zeichnete immer 57 Punkte breit,
  auch wenn der Schalter breiter angelegt war. Dadurch stand "TRAINING: KEINS" im Jugendbildschirm
  über dem Rand und die Schalterreihen des Torszenen-Editors überzeichneten einander.

- **README als Handbuch-Ergänzung**: ein Kapitel "Version 2026: was dazugekommen ist" listet
  alle Erweiterungen und wo sie im Spiel stehen - bewusst ohne Zahlen und Formeln; die stehen
  weiter in `docs/SPIELMECHANIK.md`.

- **Eigene Torszenen** (GitLab #6, Stufe 1): Szenen lassen sich jetzt beschreiben statt Bild für
  Bild setzen - Laufwege mit Animationsphasen, Ballflug mit Schatten, Kameraführung, Klangmarken.
  Daraus rechnet `baueSzene()` die Bilder; die Chancenfassung leitet sich aus der Torfassung ab.
  Werkzeuge: `tools/szene.mjs` (prüfen, bauen) und `tools/szene.py` (Vorschau als Bildfolge,
  Ausgabe im Format des Originals). Beispiel: `tore-eigen/konter.json`.

- **Torszenen-Editor im Spielbild** (GitLab #6, Stufe 2): Untermenü Diskette, "SZENEN". Ganzes
  Spielfeld mit Zeitleiste, Figuren durch Klicken setzen (das gibt ein Schlüsselbild),
  Zwiebelhaut, Abspielen im Takt des Spiels, Sprite und Bildzahl ändern, Figuren anlegen und
  entfernen. Gespeichert werden Beschreibung und beide Fassungen; die Szene läuft danach sofort
  in der Konferenz mit.

- **Sponsoren- und Bandenangebote geprüft** (GitLab #25): 907 echte Angebote aus allen 40
  Spielständen des Originals gegen unsere Erzeugung gestellt. Bandenwerbung 421 von 421 im Band,
  Trikotwerbung 457 von 486; die Abweichler erklären sich bis auf einen Fall aus dem Fanwert zur
  Zeit der Auslosung.

- **Kaufentscheidung der KI im Original nachgemessen** (GitLab #22): 90 Angebote in fünf Stufen
  des Marktwerts. Alle Quoten passen zu unserer Fassung - unter 80 % wird nie angenommen, bei
  100 % in 27 von 50 Fällen, bei 115 % in 14 von 16, ab 130 % immer.

- **Trainingswirkung im Original nachgemessen** (GitLab #24): die Stärkewirkung und die
  Deckelung der Form auf 55 stimmen, die **Frische stieg bei uns um rund drei Punkte je Tag zu
  stark** - die Zeilenschleife legte zweimal einen Zuschlag auf die Frische, den es im Original
  nicht gibt. Behoben; drei Messreihen bestätigen jetzt die Formel
  (Intensität − 5) · 2 − Zufall(3,7).

- **Rückfragen im Stil des Spiels**: Doping, Abwerben und die beiden Fragen des Transfermarkts
  kamen bisher als Browserfenster. Sie stehen jetzt im Kasten des Originals mit JA und NEIN;
  solange die Frage steht, ist alles darunter tot.

- **Sachschaden der Randalierer im Original nachgemessen** (GitLab #26): sechs Läufe in zwei
  Platzkonstellationen trafen alle genau einen der vier möglichen Beträge. Die nach dem
  Schiebe-Audit berichtigte Formel (Stehplätze mal vier, Sitzplätze halbiert, mal 2 bis 5, auf
  Tausend abgerundet) ist damit bestätigt.

- **Doping (Version 2026)**: Spieler lassen sich dopen - die Werte steigen um 12 Punkte (Frische
  20), aber nach jedem Einsatz wird gewürfelt. Beim ersten Einsatz fliegt es mit 20 % auf, je
  weiterem Einsatz 15 Punkte mehr. Wer auffliegt, ist 13 bis 39 Wochen gesperrt, der Verein
  zahlt 200.000 bis 500.000 DM mal Ligafaktor, und alle Manager erfahren davon. Zweite Ansicht
  im Bildschirm "ARZT" (GitLab #3).

- **Medizinische Versorgung (Version 2026)**: verletzte Spieler lassen sich behandeln - vom
  Vereinsarzt bis zur Sportklinik. Je teurer die Stufe, desto wahrscheinlicher schlägt die
  Behandlung in einer Woche an und desto mehr nimmt sie von der Restzeit. Die Wirkung ist
  nach Schwere gestaffelt: bei einer Verletzung über zehn Wochen reicht die Behandlung bis zur
  Halbierung (Leistenbruch: im Schnitt 4,3 von 20 Wochen für rund 770.000 DM, mit Glück zehn),
  bei kürzeren höchstens bis zwei Drittel. Eine
  Verletzung bleibt damit eine Herausforderung und lässt sich nicht wegkaufen. Neuer Bildschirm
  mit eigenem Symbol im Untermenü Trikots (GitLab #2).

- **Karten und Verletzungen in der Konferenz**: unter der Torszene steht jetzt die Meldung des
  Originals - "Gelbe Karte: HOMBERG (2)" in Gelb, Rote und Gelb-Rote Karte in Rot, "Verletzt: …" -
  und unter dem Wappen der betroffenen Mannschaft erscheint das passende Bild aus PIC/8.VGA
  (gelbe Karte, rote Karte, Foul mit Sanitätskoffer, Anzeigetafel "TOR!").

- **Torschütze mit Torzahl und Vorlage**: "Torsch}tze: GUTBERIET (2)" und darunter
  "nach Vorlage von BREITZKE", wie im Original. Die Vorlage rechnete der Spielkern schon, sie
  wurde nur nie angezeigt.

- **Stadionausbau**: wer ein Angebot ablehnt, bekommt am selben Tag keine Baufirma mehr für diese
  Ausbauart - mit der Meldung des Originals in einem roten Kasten. Die Absagen des
  Stadionbildschirms kommen jetzt aus dem Textkatalog statt aus dem Quelltext.

- **Abwerben nur nach oben**: gewildert wird nur bei Vereinen, die in einer höheren Liga oder in
  derselben Liga vor einem stehen. Der Letzte darf bei allen, der Erste bei niemandem.

- **Derby-Meldung**: steht am Spieltag ein Spiel gegen einen Managerverein an, bekommen beide
  eine Meldung mit dem Gegner und dem eigenen Einsatz.

- **Derby-Einsatz mit Mindesteinsatz**: die unterste Stufe sind 50.000 DM statt "kein Einsatz".
  Weil der kleinere der beiden Beträge gilt, machte eine Null das Derby für beide wirkungslos -
  und genau das ist im ersten Testspiel passiert.

- **Fehler aus dem ersten Testspiel behoben** (GitLab #10, #12, #14, #15, #16, #19, #20):
  - Das **Bietgefecht** merkt sich jetzt den Spieler und nicht den Marktplatz und wird als Erstes
    beim Tageswechsel entschieden - bisher konnte eine Markterneuerung dazwischenfunken, das
    Gebot landete beim falschen Spieler und niemand bekam den Zuschlag. Ist der Spieler weg,
    erfahren es alle Bieter.
  - **Unterbrechen und Auswechseln**: nach dem Klick aufs Wappen wird der Kaderbildschirm auch
    gezeichnet (vorher blieb die Konferenztafel stehen, obwohl der Kader längst offen war), und
    der Hinweis "WAPPEN ANKLICKEN" steht jetzt in jeder Aufteilung, auch bei drei und vier
    Managerspielen. Die Zeile selbst unterbricht ebenfalls.
  - **Tore** erscheinen auf der Tafel erst mit ihrer Torszene, nicht schon einen Augenblick davor.
  - **Zugänge werden einsortiert**: gekaufte, geliehene, abgeworbene und ablösefreie Spieler
    stehen im Kader wieder an der Stelle ihres Mannschaftsteils - wie in allen Spielständen des
    Originals.
  - Die **Sportzeitung** wird an jedem Spieltag geleert; nach einem Pokal- oder Europapokaltag
    stand bisher die alte Ausgabe noch einmal in der Seitenfolge.
  - Die **Zeitungsfotos** brauchen die Graupalette; die ausgelieferten Bilder stammten noch aus
    einem Lauf davor und waren bunter Pixelbrei. `npm run assets` erzeugt sie neu.
  - **Hilfszeile im Kaderbildschirm**: die Zeile unter dem Zeiger wird gelb, und unter der Tabelle
    steht, was die Spalte unter der Maus bedeutet ("SPIELE GESAMT (LIGA U. POKAL)",
    "DURCHSCHNTTS-ST[RKE", "NAME: LOOSE (25 JAHRE) (L+R)",
    "TENDENZ DES SPIELERS: STEIGEND. (ERSCH|PFUNG:73)" …) - Texte und Reihenfolge aus dem
    Original, über den Katalog geholt. Beide Ansichten sind Spalte für Spalte nachgemessen: die
    Aufstellungsansicht hängt an die Tendenz die Erschöpfung und an die Stärken den Durchschnitt,
    die Vertragsansicht nicht; Mannschaftsteil und Status stehen in beiden mit ihrem Wert
    ("ABWEHRSPIELER", "STATUS: RESERVE"). Dabei ist die Kaderliste neu am Original vermessen worden:
    Kopfzeile, Striche, Zeilen und die Hilfszeile lagen acht Bildpunkte zu hoch, der gelbe Balken
    war zwei Zeilen zu hoch, und die Hilfszeile steht in Palettenfarbe 11 statt in Weiß.
  - **Antwort der Vertragsverhandlung** steht wie im Original unter der Tabelle
    ("Ihr Angebot wurde angenommen !" bzw. "So dumm ist <Name> leider nicht..."), nicht mehr als
    Servermeldung unter dem Spielbild.
  - **Randalierer**: der Sachschaden rechnet mit Stehplätze·4 (0xE29B schiebt nach links), nicht
    Stehplätze/4 - er war bisher rund sechzehnmal zu klein.
  - **Gehaltsforderung**: die Schiebehilfe des Originals (0x3BBC8) schiebt nach **links**, nicht
    nach rechts - dadurch war unsere Forderung achtmal zu klein und blieb immer beim alten
    Gehalt stehen. Jetzt verlangt ein Spieler am ersten Spieltag 114 % seiner Gehaltsbasis für
    ein Jahr, 128 % für zwei, 140 % für drei und 154 % für vier, genau wie im Original
    nachgemessen (1.800 DM Basis -> 2.052 / 2.304 / 2.520 / 2.772 DM). Dasselbe galt für die
    Annahmeschwelle beim eigenen Angebot.
  - **Vertragsdauer und Angebote** werden im Spielbild eingegeben statt in Browser-Dialogen: ein
    Klick auf die Laufzeit oder das Gehalt im Vertragskasten genügt, wie im Original (Ziffern
    tippen, EINGABE weiter, ESC Abbruch, NEUER VERTRAG schickt ab). Dasselbe gilt für das eigene Angebot bei Vertragsangeboten, den
    Vertrag nach einem Kauf und Angebot bzw. Leihgebühr im Transfermarkt. Vorher konnte der
    Browser die Dialoge sperren - dann liess sich die Jahreszahl nicht mehr ändern.

- **Version 2026, fairer**: Kredite von Mitspielern gibt es nur noch auf Anfrage - der Geldgeber
  setzt Laufzeit und Zins oder lehnt ab; die Zinsen aller Kredite werden zum selben Monatstermin
  gebucht statt nach dem Aufnahmetag; Marktpreise rechnen ohne den 16-Bit-Überlauf des Originals;
  der Guthabenzins zählt nur bis zwei Millionen; und im Bietgefecht sieht jeder nur sein eigenes
  Gebot und die Zahl der Gebote.

- **Fünf neue Regeln der Version 2026** für mehr Spannung zu dritt: Punktabzug und Kaufsperre
  bei über einer Million Schulden, Derby-Einsatz zwischen
  Managervereinen (es gilt der kleinere Betrag), Bietgefecht um Marktspieler bis zum
  Tageswechsel, Gegenwehr des Besitzers beim Abwerben (Gehaltserhöhung senkt die Zustimmung) und
  ablösefreie Spieler am Saisonende, um die alle bieten dürfen. Neuer Bildschirm "Regeln 2026"
  im Untermenü Diskette neben den Einstellungen.

- **Aufhören**: der Rechtsklick auf das Managersymbol rechts unten im Hauptmenü öffnet die
  Rückfrage des Originals ("M|CHTEN SIE DAS SPIEL WIRKLICH BEENDEN ?"). Wer bestätigt, steigt
  aus; sein Verein wird vom Rechner weitergeführt und kann später wieder übernommen werden.
  Gilt für beide Regelwerke.
- Eigenes Symbol für das Abwerben (ein Angler mit einem Ball an der Leine, `tools/icon_abwerben.py`).
- **Version 2026**: beim neuen Spiel wählbares Regelwerk mit denselben Vereinen, Spielern und
  Wappen, aber den heutigen Regeln - drei Punkte für einen Sieg und fünf Auswechslungen ohne
  Rücksicht auf die Position. Die Wahl steht im Spielstand (Byte 34099) und im Kopf des
  Einstellungsbildschirms.
- **Abwerben** (nur Version 2026): Spieler eines Mitspielers direkt abwerben. Die Ablöse ist sein
  Marktwert, bis zu 15 % Aufschlag sind möglich und erhöhen die Zustimmung; sagt der Spieler zu,
  ist der Wechsel bindend. Je Saison lassen sich demselben Manager höchstens zwei Spieler
  abwerben. Eigener Bildschirm im Untermenü Trikots.

- Titelmusik: SOUND/BM2TITLE.CMF wird mit `tools/cmf/cmf2wav.c` (OPL2-Emulator Nuked-OPL3)
  nach `assets/sound/titel.mp3` gewandelt und läuft auf dem Titelbild, in der Spielauswahl
  und bei der Platzwahl in einer Schleife.
- Klänge aus SOUND/DIGI.VOC in der Konferenz: Anpfiff je Halbzeit, die Klänge der Torszene
  nach den vier Kopfbytes der Szenendatei (Torjubel nur in den Torszenen), der Klang zum
  Ausgang über "TOR!" bzw. "KEIN TOR" sowie Karten und Verletzungen. Die Fundstellen stehen in
  `docs/SPIELMECHANIK.md` ("Ton: Klänge und Titelmusik").

## 1.0.0

Erste vollständige Fassung: alle Bildschirme und Abläufe des Originals sind nachgebaut und
Bildschirm für Bildschirm gegen Bundesliga Manager Professional in der DOSBox geprüft. Die
Spielregeln stammen durchweg aus der Disassembly von BMMAIN.EXE, die Fundstellen stehen in
`docs/SPIELMECHANIK.md`.

**Bildschirme** Hauptmenü mit den fünf Untermenüs (Büro, Wappen, Trikots, Pokal, Diskette),
Kader in drei Ansichten (Liste, Spielfeld mit Taktik, Verträge), Spielerinfo, Training,
Trainingslager, Stadion, Kredite, Werbung, Transfermarkt, Tabellen, Spiele, Stärken,
Bestenliste, Pokalrunden, Statistik, Ewige Tabelle und Bilanz, Verlauf, Zeitung, Highscore,
Auslosung, Einstellungen, neues Spiel.

**Spielablauf** Tagesroutine mit Training, Frische, Verletzungen, Sperren und Finanzen;
Spieltage als Konferenz mit Torszenen, Halbzeit- und Schlussseiten; Auswechslungen und
Taktikwechsel während der Unterbrechung; Pokale und Europapokale; winterliche Spielverlegungen
mit Nachholterminen; Saisonende mit Auf- und Abstieg.

**Mehrspieler** Server mit Anmeldung, Sitzplätzen je Manager, gemeinsamer Konferenz und
Spielstandverwaltung. Der Spielstand bleibt das Format des Originals (*.MAN) und lässt sich in
beide Richtungen austauschen.

**Nicht umgesetzt** Ton, Überblendungen zwischen den Seiten ("Blenden") und die
Relegationsmeldung, die das Original selbst über eine Konstante abschaltet.
