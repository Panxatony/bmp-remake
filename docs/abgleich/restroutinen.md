# Zweigbuch Restroutinen - die 59 bisher nirgends eingeordneten Routinen

Gelesen am 25.9.2026. Es sind die Routinen aus docs/AUDIT-ROHDATEN.md, die weder ein Zweigbuch
noch das Audit nennt. Jede ist eingeordnet als **Anzeige**, **Datei/System**, **Hilfsroutine**
(mit der Stelle im Remake) oder **Spiellogik**. Befunde stehen unten mit ihrem Stand.

## 0x02895 bis 0x1243B

| Adresse | Was | Art | Remake | Urteil |
|---|---|---|---|---|
| 0x02895 | Kalenderindex des n-ten Tages mit einem Maskenbit (Spieltagsdatum) | Hilfsroutine | `matchdayDate` (display.ts) | stimmt |
| 0x03361, 0x03390, 0x03A95 | Titel "DFB-Pokal", "Europapokal", "Ligaspiel" im Tagesablauf | Anzeige | - | - |
| 0x050E7 | Ordinalendung je Sprache | Anzeige | nur Deutsch | - |
| 0x08BC4, 0x08EAF, 0x08F0D | Programmstart, Palette, Grafikressourcen laden und freigeben | Datei/System | - | - |
| 0x094B2 | Mausklicks der Hauptschleife, versteckter Autoplay-Schalter (Klick auf 0,0 bzw. 1,1) | Oberfläche | Weiter-Knopf; Autoplay bewusst weggelassen | stimmt |
| 0x0A89D, 0x0AA35, 0x0AA56, 0x0AC21 | Startbildschirm: Kacheln, Taste abwarten, Wappen tauschen, Nummernknopf | Anzeige | `drawStart` | - |
| 0x0A9B3 | Steht ein Verein noch im Europapokal (Neues Spiel, Masken 7 und 4)? | Hilfsroutine | fehlt; wirkungslos, Oberligisten 38..57 sind nie im Europapokal | stimmt im Ergebnis |
| 0x0AB84 | Tauscht die Tabellensätze zweier Vereine | Spiellogik (Neues Spiel) | newgame.ts nach `swapClubs` | **R4**, behoben |
| 0x11354 | Kaderzahl: eigene Plätze und die eigenen Spieler auf dem Markt und in Leihe | Spiellogik | `kaderZahl` (transfer.ts) | **R1, R2**, behoben |
| 0x1243B | Kreditliste eines Geldgebers | Anzeige | `drawBank`, `loans()` | stimmt |

Die Zuordnung "im Team" zu 0x0AA56 in AUDIT-ROHDATEN ist falsch: 0x0AA56 liest 4238:4D38, einen
Grafikpuffer. Der Text steht in 4cb3:4D38 und gehört zu 0x224A8.

## 0x1366B bis 0x21696

| Adresse | Was | Art | Remake | Urteil |
|---|---|---|---|---|
| 0x1366B | Bankkasten: Kontostand, Schulden, Zinsen | Anzeige | `drawBank` | stimmt |
| 0x14A4A | Credits-Texte mit XOR entschlüsseln | Anzeige | - | - |
| 0x14E59, 0x14FB4 | TORE\ANZAHL lesen (43/5/2), Fehler der Torszenen-Diskette | Datei/System | fest in server/live.ts | stimmt |
| 0x1618E | Wert ± random(1,7) - 4, begrenzt auf 30..99 | Hilfsroutine von 0x161D8 | `poolTargets` (pool.ts) | stimmt |
| 0x1704A | Titelbild einer Saisonendphase | Anzeige | - | - |
| 0x19810 | "Liga GEGEN Liga:" in der Pokalübersicht | Anzeige | - | - |
| 0x1A7CE, 0x1A8D0 | Werte und Vereinsname auf der Konferenztafel | Anzeige | `drawLivePanel` | **R11** (Umbruch), behoben |
| 0x1FEC9 | Starter auf einer Feldzelle suchen | Hilfsroutine | `freieZelle`, `/api/position` | stimmt |
| 0x1FF36 | Freie Feldzelle für einen neuen Starter | Spiellogik (Kader) | `freieZelle` (lineup.ts) | **R5**, behoben |
| 0x1FFFA, 0x20105, 0x21328, 0x213B6 | Trikots, Einsatzregler, Spielfeld, Systemknöpfe zeichnen | Anzeige | `drawPitch` | - |
| 0x20197 | Automatik aus, mit Hinweis | Spiellogik (Zustand) | Web-Client und `/api/position` | **R6**, behoben |
| 0x21696 | Taktikbrett: Systemwahl, Spieler verschieben und tauschen | Spiellogik (Kader) | `/api/system`, `/api/position` | **R6, R7**, behoben |

## 0x21E40 bis 0x30E42

| Adresse | Was | Art | Remake | Urteil |
|---|---|---|---|---|
| 0x21E40 | Statusspalte der Kaderzeile | Anzeige | `drawSquad` | **R8**, behoben |
| 0x26D8F | Zahl mit Mindestbreite ("^@" für 0) | Hilfsroutine | `pad()` in `drawStatistik` | stimmt |
| 0x284D1 | Tore je Spiel "x.y" | Anzeige | `statistics` (display.ts) | stimmt |
| 0x29BFE | "Damals... Ihre Erfolge": Saisonverlauf und Balken | Anzeige | `drawVerlauf`, `history()` | **R9**, behoben |
| 0x2C128 | "n. PLATZ, STÄRKE t (K,T,F)" | Anzeige | `clubStrength` | **R10**, behoben |
| 0x2C3C0 | Formzeichenkette schieben | Hilfsroutine von 0x2D143 | standings.ts | stimmt |
| 0x2C483 | Bilanz Manager gegen Verein | Spiellogik | `bookHistory` (history.ts) | **R12**, behoben |
| 0x2C55C | Tabellenbildschirm HEIM/GESAMT/AUSWÄRTS | Anzeige mit Rechnung | `drawTable`, `tableOrder` | **R13**, behoben |
| 0x2E9AA, 0x2ECB9 | Blocksatz der Hilfetexte | Anzeige | Browsersatz | - |
| 0x30910 | Freien Ablaufplatz einer Meldung suchen | Spiellogik (Meldungen) | fehlt | bekannt (0DF0D.md, C) |
| 0x30E42 | Alle Meldungstexte freigeben | Datei/System | - | - |

## 0x30ED4 bis 0x34E6E

| Adresse | Was | Art | Remake | Urteil |
|---|---|---|---|---|
| 0x30ED4 | Meldungskasten, drei je Seite | Anzeige | `drawMeldungen` | **R14** (Reihenfolge), behoben |
| 0x3142B, 0x314B5 | Zahl mit Währungspunkt, Drehfeld | Anzeige | Stadionbildschirm | stimmt |
| 0x31943 | Byte begrenzen | toter Code | - | - |
| 0x31ADC, 0x32032 | Treffertest der Knöpfe, Knopf drücken | Oberfläche | `hit()` | - |
| 0x31D7C | Ja/Nein-Dialog ("An Alle:" ist nur eine Überschrift) | Anzeige | eigene Dialoge | stimmt |
| 0x320C7 | Kaderplatz eines Spielers suchen | Hilfsroutine von 0xCB62 | `fundort` (seasonEvents.ts) | **R15**, behoben |
| 0x3216C | Managerkopf neu zeichnen (0x322B6: Diskettenfehler) | Anzeige | `gesichtSpalte` | - |
| 0x322F7, 0x323EF | Block verschlüsseln und schreiben, lesen und entschlüsseln | Datei | savefile.ts, cipher.ts | stimmt |
| 0x334BC | Spielstand laden | Datei | `roomFromSave`, `decode`, `withMessages` | **R16**, behoben bis auf Randfälle |
| 0x34E6E | Dateiauswahl | Datei/System | `/api/saves` | - |

## Befunde

| | Was | Stand |
|---|---|---|
| R1 | Jugendspieler am Saisonende nur bei Kaderzahl 0x11354 < 23 (0xCF35): eigene Spieler auf dem Markt und in Leihe zählen mit | behoben (`kaderZahl` in seasonEvents.ts) |
| R2 | Kauf und Leihe: ist die Kaderzahl über 23 und der Spieler nicht vom eigenen Verein, kommt "Schon 24 Mann im Team" und der Kauf endet wie ein abgelehnter (0x224FF, 0x2411C). Das Remake prüfte nur freie Kaderplätze | behoben (`kaderVoll`: Marktkauf, Verkauf unter Managern, Bietgefecht); Test |
| R3 | Neues Spiel: nur Oberligisten bis Verein 57 (4cb3:2277) bleiben stehen, das Remake ließ auch 58 stehen | behoben; Test |
| R4 | Neues Spiel: 0xAB84 tauscht die Tabellensätze nach 0x3C24 zurück; wirkt nur bei Wunschverein 58..63 | behoben; Test |
| R5 | Wer über die Kaderliste in die Elf kommt, übernimmt die Feldzelle des Herausgenommenen (0x20AED, 0x20E8B), sonst sucht 0x1FF36 eine freie. Das Remake ließ die alte Zelle stehen, zwei Starter konnten auf einer Zelle stehen (Torwahl, Stärke) | behoben (`uebernimmNummern`, `freieZelle`); Test |
| R6 | Bei eingeschalteter Automatik nimmt die Kaderliste keine Änderung an ("Auto-Aufstellung ist aktiviert !", 0x2084F); jeder Klick aufs Spielfeld schaltet sie ab (0x20197). Das Remake nahm die Änderung an und schaltete dabei ab; ein Verschieben auf dem Feld ließ die Automatik an | behoben (Server und Web-Client) |
| R7 | Die Systemknöpfe wertet das Original nur außerhalb des Spiels aus (0x216DD); das Remake erlaubt die Systemwahl in der Unterbrechung als Auswechslung (GitLab #53) | behoben wie im Original (Entscheidung lhuno, 25.9.2026): im Spiel keine Systemwahl, Knöpfe ohne Wirkung |
| R8 | Kaderstatus: "GESP.(n)" mit der Sperrdauer, Flag 3 als leerer Text | behoben |
| R9 | Verlauf: Byte 63 ist die Liga, Byte 64 der DFB-Pokal - das Remake las beide vertauscht; Europapokal als Runde und Wettbewerb, Sieger gelb, Saisonzahl wie 0x29F11, 16 Saisons je Seite, Zeilen über den Saisonzähler, "EXISTIERTEN SIE NOCH GAR NICHT ALS MANAGER..." für 0xFF | behoben; Test angepasst |
| R10 | Ergebnisseite: Stärke = Summe der neun Matrixbytes / 9 | behoben |
| R11 | Konferenztafel: Umbruch des Vereinsnamens, wenn die ersten Länge - 1 Zeichen breiter als 60 Punkte sind, am ersten Leerzeichen; ohne Leerzeichen einzeilig. Das Remake brach ab 16 Zeichen am letzten Leerzeichen | behoben |
| R12 | Bilanzbyte ohne Begrenzung auf 15 Tore (8-Bit-Summe) | behoben |
| R13 | Heim- und Auswärtstabelle mit "weniger Spiele"; das Umschreiben der Reihenfolgeliste dabei macht das Remake nicht nach | behoben; Test; Rest in ABWEICHUNGEN |
| R14 | Die neueste Meldung steht vorn (0x30AA0) | behoben; Test |
| R15 | Saisonende sucht Spieler nur auf den Plätzen 0..Anzahl-1 der Kader 0..Anzahl-1 (0x320C7): hinter einer Lücke bleibt z. B. ein Leihspieler stehen (RIED-CLI, Spieler 120) | behoben; Test angepasst |
| R16 | Remake-Stand im Original: (1) Das Remake schrieb alle Meldungszeiger als 0; das Original setzte beim Laden die Adresse der ersten Meldung in jeden Kaderplatz ohne Angebot und machte danach keine Vertragsangebote mehr. (2) Mehr als 20 Meldungen je Manager schreibt das Original beim Laden über seine Tabelle hinaus. Dazu Randfälle beim Laden (V1-Stände, Wiederladesperre, fehlender Anhang) | (1) und (2) behoben: Zeiger aus dem Originalstand bleiben, neue Meldungen bekommen eigene Werte, tote Verweise in Kaderplätzen und laufenden Ablaufeinträgen werden 0; höchstens die 20 neuesten je Manager. Im Original geprüft: TEST4 mit drei neuen Meldungen geladen und gespeichert - mit Nullzeigern 49 Kaderplätze auf der ersten Meldung, jetzt keiner, die Ablaufeinträge zeigen auf die neuen Adressen. Die Randfälle bleiben (ABWEICHUNGEN) |
