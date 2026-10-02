# Audit 2026, zweiter Durchgang - Bereich Q (Querschnitt)

Stand Repo: d5b503d (#144). Nur gelesen; Skripte in `scratchpad/q/`.

## 1. Geprüfte Funktionen

| Funktion | Code | Urteil |
|---|---|---|
| `is2026`/`winPoints`/`substitutionLimits` | regeln.ts | ok |
| Tabelle, Meldungen, Ewige Bilanz, PUN.-Spalte | standings.ts:32, messages.ts:54, season.ts:303, display.ts:442 | ok (über `winPoints`/`is2026`) |
| Guthabenzins-Obergrenze, Zinstermin | finance.ts:168/218 | ok, B9 umgesetzt |
| Marktaufschlag 16 Bit | value.ts:85 | ok, im Original gleich viele Würfe |
| Ablösefrei statt halber Ablöse | seasonEvents.ts:108 `releaseExpiring` | ok |
| Heimrecht DFB-Halbfinale (#140) | europa.ts:201 | ok (nur 2026) |
| Wechsel/Technikbonus | live.ts:246, 747 | ok (B5, B6) |
| `checkDebt`, `isBlocked` | schulden.ts:25/46 | ok |
| `derbyStake`/`playDerby`, `/api/derby` | derby.ts:36, server.ts:3774 | ok |
| `medWeek`, `medRows` | medizin.ts:118/162 | ok |
| `medSet`, `/api/medizin` | medizin.ts:190, server.ts:3289 | **Fehler Q1** |
| `dopeStart`/`dopeStop`, `/api/doping` | doping.ts:143/184, server.ts:3298 | **Fehler Q1** |
| `dopeMatchday` | doping.ts:213 | ok |
| `dopingCleanup` | doping.ts:243, server.ts:2292 | **Fehler Q2** (Original wird verändert) |
| `resetPoachCounts`, `jugendZaehlerLeeren` | season.ts:430, server.ts:1300 | schreiben im Original Nullen auf Nullen; H1 weiter offen (Q2) |
| `jugendAnlegen`/`jugendSaison`/`/api/jugend anlegen` | jugend.ts:264/365, server.ts:3154 | **Fehler Q3** |
| `jugendMonat`, `foerdern`, `jugendAufruecken`, `jugendAbwerben` | jugend.ts | ok (Indizes geprüft) |
| `poachCheck`/`/api/poach`/`/api/poach/answer` | abwerben.ts:142, server.ts:3708/3749 | ok (Besitzerprüfung Byte 33 fängt fremde Plätze ab) |
| `resolveAuctions`, Anzeige Bietgefecht | server.ts:844/1780, main.ts:6940-6997 | Rechnung ok, Anzeige **Q5** |
| `resolveFreeAgents`, `/api/free/bid` | server.ts:924/3785 | ok (B1) |
| Kredit mit Zustimmung | server.ts:3677/3804/3839 | ok (B10) |
| `managerAufnehmen`, `/api/aufnehmen` | newgame.ts:554, server.ts:2824 | Bytes ok; Jugend fehlt (**Q3**) |
| `createGame` (2026-Bytes) | newgame.ts:290-310 | ok: 34095..34214 genullt, Anhang leer |
| `spielBeenden`, Bestenliste | server.ts:1340, highscore.ts:34 | **Q6** (Regelfrage) |
| `tagesbeginn`/`finanzTag`/`advanceDay`/`zeitungen` (Server) | server.ts:1875-2320 | Original zieht keinen 2026-Wurf (Skript, Abschnitt 2) |
| Kader-Hilfezeile Verletzung | main.ts:3056 (#136) | **Fehler Q4** |
| Torszenen-Editor `/api/szene` | server.ts:3228 | A16 hält; Rechte **Q7** |

## 2. Trennung vom Original - Skriptbeleg

`q/build.mjs` bündelt `packages/server/server.ts` mit esbuild zweimal: **MIT** (unverändert) und
**OHNE** 2026-Code (`is2026` fest false; `resetPoachCounts`, `jugendZaehlerLeeren`, `jugendSaison`,
`jugendMonat`, `jugendAnlegen`, `dopeMatchday`, `dopingCleanup`, `medWeek`, `checkDebt`,
`playDerby`, `derbyStake` als leere Stummel; Aufruf von `zeremonieHeimrecht` in `nextRoundDraw`
entfernt). Das `listen` fällt weg, `mulberryRng` bekommt einen festen Samen und einen Zähler.
`q/harness.mjs` lädt einen Stand per `roomFromSave` und spielt per `zugBeenden` N Züge des echten
Server-Tagesablaufs (Live-Konferenz mit falscher Uhr, Zeremonien übersprungen). Mit `STACK=1` wird
bei jedem Wurf der Aufrufstapel geprüft (Quelltextkarten), ob ein 2026-Modul darin steht.

12 Züge je Stand, je MIT (zweimal, deterministisch), OHNE und MIT mit Regelbyte 1:

| Stand (Original) | Tage | Würfe MIT = OHNE | Würfe aus 2026-Modulen | Hash MIT / OHNE | Gegenprobe 2026 |
|---|---|---|---|---|---|
| TEST4 | 67..109 | 39554 = 39554 | 0 | gleich | 18 Würfe medizin.ts:136 |
| RIED2017 (mit Saisonwechsel) | 301..18 | 54239 = 54239 | 0 | gleich | 317 (jugend, medizin) |
| KP-SAISON-START (Saisonwechsel) | 326..35 | 47229 = 47229 | 0 | gleich | 287 (jugend, medizin) |
| KP-TEST3-WINTER (Winterpause) | 119..235 | 80006 = 80006 | 0 | **verschieden** | 22 (medizin) |

Die Gegenprobe zeigt, dass die Stapelprüfung 2026-Würfe findet. Ergebnis: Im Originalmodus zieht
der Server-Tagesablauf (inkl. `tagesbeginn`, Zeitungen, Saisonwechsel mit Sommertagen,
`spielBeenden`-Abzweig) **keine** Zufallszahl aus 2026-Code. Der Hash-Unterschied bei
KP-TEST3-WINTER ist Q2. Nicht über den Tagesablauf erreichbare Pfade (Bietgefecht, Ablösefreie,
Kreditanfragen, Abwerbeanfragen) werden nur über Endpunkte befüllt, die `is2026` prüfen
(server.ts:3150, 3377, 3685, 3779; `poachCheck`, `releaseExpiring`); im Original bleiben
`r.auctions`, `r.freeAgents`, `r.loanRequests`, `r.poachRequests` leer.

## 3. Spielstand-Felder der 2026-Daten

| Feld | Offset | Kollision |
|---|---|---|
| Regelbyte | 34099 | Ablauftabelle 4238:5664, Eintrag 1 (Bytes 34099..34102) |
| Abwerbezähler 4x4 | 34100..34115 | Einträge 1..5 |
| KI-Maske (Remake, beide Regelwerke) | 34116 | Eintrag 5 |
| Kaufsperre | 34117 | Eintrag 5 |
| Derby-Einsatz je Manager | 34118..34121 | Eintrag 5/6 |
| Jugend-Aufrücker / -Abwerbungen | 34122..34125 / 34126..34129 | Eintrag 6..8 |
| Doping Zustand/Aufschlag | Kaderbyte 44/45 | frei (s. u.) |
| Behandlungsstufe | Kaderbyte 23 Bits 6..7 (Art der Verletzung Bits 0..4) | Byte 23 wird vom Original als ganzer Index gelesen/geschrieben |
| Jugendmannschaften | Anhang hinter Dateiende | keine |
| Ablösefrei wartend | Spielerbyte 33 = 6 (nur bis Neustart) | s. Unklar U2 |

Gemessen über alle 70 Stände (`q/felder.ts`): Regelbyte immer 0; die Ablaufzähler 34065+i sind nur
für i = 10, 20, 21, 22 belegt, nie für 1..8; in den Kadern aktiver Manager und im Markt sind
Kaderbyte 44..47 überall 0 und Byte 23 nie > 17 (keine Bits 6/7). In Kaderplätzen **nicht
aktiver** Manager (Manager 3 in Dreierspielen, Plätze 75..99) steht dagegen Müll, auch in
Byte 44..47 und Byte 23 (134 Plätze) - daher Q2. Keine Überschneidung mit 34063/34064
(Endjahr-Kennung 4238:513C), 34062 (Level), 34224 (Saisonzähler) oder den Bytes, die
`managerAufnehmen` schreibt (Managersatz 62+4i, 267..304, 306..310, Kader, Spielerbyte 33).
`createGame` nullt 34065..34094 und 34095..34214, eine Vorlage aus einer 2026-Runde vererbt also
nichts. Das Remake pflegt die Ablauftabelle nicht (nur `withMessages` räumt Einträge mit Zähler
≠ 0 ab), daher im Remake kein Konflikt (H2 bleibt eine Doku-Frage, Q9).

## 4. Entscheidungen B1-B14

| Nr | Entscheidung | Stelle | Stand |
|---|---|---|---|
| B1 | Mindestgebot = bisheriges Gehalt | server.ts:3796 | umgesetzt |
| B2 | nein | server.ts:874-884 (kein Nachrücken) | so belassen |
| B3 | Gebote offen | server.ts:1779-1786, `freeAgents` mit `bids`, Derby `extra.derby` | umgesetzt (Anzeige Q5) |
| B4 | Neuaufstellung beide Seiten | server.ts:994/995, 3181, 3215/3216 | umgesetzt |
| B5 | Bonus endet nach 3 Wechseln | live.ts:246 (alle Aufrufe von `managerStaerke` gehen über `wechselZahl`) | umgesetzt |
| B6 | +1 Wechsel in der Verlängerung | live.ts:747 | umgesetzt |
| B7 | Grenzen des Originals | doping.ts:151-157, 167-169, 222 | umgesetzt (Form ohne Aufschlag, Frische ≥ 50, Malus ≥ 45) |
| B8 | Kur endet beim Wechsel | abwerben.ts:187, jugend.ts:559; Markt sperrt gedopte/gesperrte (server.ts:3319) | umgesetzt |
| B9 | kein Zins im Aufnahmemonat | finance.ts:218-221 | umgesetzt |
| B10 | Borger darf ablehnen | server.ts:3804-3866 (`loanOffers`) | umgesetzt |
| B11 | Punktabzug bleibt | schulden.ts:45ff | unverändert (A18 korrekt) |
| B12 | Ewige Bilanz nur Punkte | display.ts:442 | umgesetzt |
| B13 | Medizin an Verletzungswoche, nicht für Rechner | server.ts:2230 | umgesetzt |
| B14 | Förderung nur Spieler-Manager, Altersangaben | server.ts:1924, jugend.ts:60 | umgesetzt; Kommentar jugend.ts:7 veraltet (Q8) |

## 5. Befunde

### Q1 - A - Doping und Arzt treffen fremde Kader und den Markt
Stelle: doping.ts:143-191 (`dopeStart`, `dopeStop`), medizin.ts:190 (`medSet`), server.ts:3289/3298.
Fehlerbild: `place` wird nirgends auf 0..24 begrenzt; `g.lineups.at(manager*25 + place)` erreicht mit
`place` 25.. den Kader des nächsten Managers bzw. ab Index 100 den Transfermarkt, mit negativem
`place` den vorigen Manager. Manager 0 schickt `/api/doping {manager:0, place:25, on:true}` und
startet eine Kur beim Spieler von Manager 1; beim nächsten Einsatz würfelt `dopeMatchday(…,1,…)`
und Manager 1 zahlt Strafe und verliert den Spieler für Wochen. Ebenso `place: 100` dopt einen
Marktspieler (A13 umgangen) oder setzt per `/api/medizin` beim Rivalen die Sportklinik
(150.000 DM/Woche zu seinen Lasten) bzw. nimmt ihm die Behandlung.
Beleg: `q/fremd.ts` mit TEST4 (Regelbyte 1): `dopeStart(g,0,25)` -> ok, SCHMADTKE (Manager 1)
gedopt, Dopingtest bei Manager 1: erwischt, 17 Wochen, Konto -568.856 -> -618.856;
`dopeStart(g,3,25)` -> Marktplatz 100 gedopt; `medSet(g,0,26,3)` -> Stufe 3 beim Spieler von
Manager 1. Die Oberfläche schickt nur eigene Plätze; der Missbrauch geht über die API.
Korrektur: in den drei Funktionen `if (!Number.isInteger(place) || place < 0 || place > 24)
return { ok: false, error: "Kein Spieler" }` (wie es `poachCheck` über Byte 33 indirekt hat).
Aufwand: klein (3 Zeilen + Test).

### Q2 - A - `dopingCleanup` ändert im Original Bytes (H1 weiter offen, Aussage "nur Nullen" falsch)
Stelle: doping.ts:243-250, Aufruf server.ts:2292 ohne `is2026`.
Fehlerbild: Die Schleife läuft über die Kaderplätze 0..99 aller vier Manager, auch nicht aktiver.
Dort steht in Ständen des Originals Müll; ist zufällig `Byte44 & 3 = 2`, gilt der Platz als
"Dopingsperre" und Byte 44 wird 0. Beleg `q/cleanup.ts`: 15 von 70 Originalständen ändern sich,
z. B. KP-TEST3-WINTER Platz 77 Byte 44 154->0, Platz 85 150->0; KP-SAISON drei Plätze. Im
Server-Lauf (Abschnitt 2) unterscheidet sich deshalb der Spielstand MIT/OHNE 2026-Code bei
KP-TEST3-WINTER an genau 25448 und 25864. Spielwirkung keine (inaktive Plätze), aber der
Grundsatz "im Original kein Byte" ist verletzt und die KP-Stände werden byteweise verfälscht.
`resetPoachCounts` (season.ts:430) und `jugendZaehlerLeeren` (server.ts:1300) schreiben in allen
70 Ständen nur Nullen auf Nullen.
Korrektur: `if (!is2026(g)) return;` in allen drei Funktionen (H1), `dopingCleanup` nur über
`g.activeManagers()`. AUDIT-2026.md Absatz "Abgrenzung" berichtigen. Aufwand: klein.

### Q3 - A - Jugendmannschaften fehlen nach dem ersten Saisonwechsel und für aufgenommene Manager
Stelle: jugend.ts:264 (`jugendAnlegen`), 365 (`jugendSaison`), server.ts:3154 (`anlegen` nur bei
`!jugendVorhanden`), main.ts:4109, server.ts:2838 (`/api/aufnehmen`).
Fehlerbild: (a) Angelegt werden die drei Mannschaften erst beim ersten Öffnen des Jugend-
bildschirms. Hat bis zum ersten Saisonwechsel niemand ihn geöffnet, füllt `jugendSaison` aus leeren
Daten nur die C-Jugend; danach ist `jugendVorhanden` wahr und `anlegen` tut nichts mehr. Beleg
`q/jugend1.ts` (RIED2017, Regelbyte 1): nach dem Saisonwechsel C/B/A = 7/0/0, 7/0/0, 6/0/0;
nach drei weiteren Saisons 12/4/0 usw. - die A-Jugend bleibt jahrelang leer. (b) Ein mit
`managerAufnehmen` (#132) nachträglich aufgenommener Manager bekommt nie Mannschaften, wenn die der
anderen schon bestehen (gleiche Sperre über `jugendVorhanden`).
Korrektur: `jugendAnlegen` je Manager nur für Manager ohne jeden Jugendspieler, aufrufen beim neuen
Spiel (2026), in `/api/aufnehmen` für die neuen Plätze und vor Schritt 1 von `jugendSaison`; die
Bedingung in server.ts:3154 auf "dieser Manager hat keine" ändern. Aufwand: klein.

### Q4 - A - Kader-Hilfezeile: Verletzungsname fehlt bei laufender Behandlung (seit #136)
Stelle: main.ts:3056 `injuries()[l.u8(23)]`.
Fehlerbild: In 2026 trägt Byte 23 in Bits 6/7 die Behandlungsstufe (medizin.ts:52). Hat der
Manager eine Behandlung gewählt, ist `l.u8(23)` ≥ 64, der Index ins Verletzungsverzeichnis leer,
die Zeile zeigt "VERLETZT ()" statt z. B. "(BÄNDERRISS)". Alle anderen Leser (playerinfo.ts:64,
server.ts:2210, incidents.ts:193) nehmen `injuryKind(l)`.
Korrektur: `injuries()[injuryKind(l)]`. Aufwand: 1 Zeile.

### Q5 - A (klein) - Bietgefecht-Anzeige auf dem Transfermarkt
Stelle: main.ts:6991 und 6997; server.ts:1785.
Fehlerbild: (a) Wer eine Kaufsperre hat und einen Spieler mit laufendem Bietgefecht wählt, sieht
"VORN: …" und "KAUFSPERRE (KONTO IM MINUS)" übereinander bei (163,151). (b) "VORN" ist das erste
Gebot nach Betrag (stabile Sortierung = Reihenfolge der Gebote); den Zuschlag bekommt bei
Gleichstand aber der schlechtere Tabellenplatz (`highestBid`, auktion.ts:29) - die Anzeige kann
einen anderen Manager vorn nennen als den, der gewinnt.
Korrektur: Sperre eine Zeile tiefer oder statt VORN zeigen; im Server mit `highestBid` sortieren
(Gleichstand nach Tabellenplatz). Aufwand: klein.

### Q6 - B - Bestenliste: 2026- und Originalspiele in derselben Datei
Stelle: highscore.ts:34 `HIGH.${spielart}${level}`, server.ts:1210/1342.
Frage: Die Version 2026 schreibt ihre Einträge in dieselbe HIGH.xy wie Originalspiele (und wie das
DOS-Programm). Kontostand und Kaderwert gehen in die Punkte ein, und die hängen in 2026 an anderen
Regeln (Zinsobergrenze, Derby, Dopingstrafen, ablösefreie Abgänge statt halber Ablöse, sauberer
Marktaufschlag). Die Listen sind damit nicht vergleichbar, und ein 2026-Eintrag landet in einer
Datei, die das Original liest.
Empfehlung: eigene Datei für 2026 (z. B. `HIGH.x y` mit Kennung "2026" im Namen, die das Original
nie öffnet) und Anzeige der Liste nach Regelwerk. Aufwand: klein.

### Q7 - B - Torszenen-Editor: keine Rechte, gemeinsamer Namensraum
Stelle: server.ts:3228-3287.
Befund: A16 hält (Name mit Ziffer vorn abgelehnt; erlaubte Zeichen `[a-z0-9_-]` ohne Punkt, die
Endung `.T/.V` setzt der Server - eine Originalszene `n.T` ist so nicht zu treffen; Grenze 200
Dateien). Aber jeder angemeldete Benutzer mit Platz in irgendeiner Runde (auch Gast/Rolle
"spieler") darf jede eigene Szene unter gleichem Namen überschreiben; Szenen gelten global für alle
Runden, und der Server schreibt in den Installationsordner (`root/tore-eigen`, `root/assets/eigen`).
Ein Löschen gibt es nicht. Spielwirkung keine (`pickScene` wählt nur Originalnamen), es geht um
fremde Werke.
Empfehlung: Besitzer in der Beschreibung speichern und Überschreiben nur dem Besitzer bzw.
Präsident/Trainer (`darfRunden`) erlauben. Aufwand: klein.

### Q8 - C - Veraltete Doku zum Doping und zur Jugend
- docs/SPIELMECHANIK.md:2580-2595: Tabelle nennt **Kaderbyte 5 und 8** für Zustand/Aufschlag -
  seit #88 sind es 44/45 (Byte 5/8 sind Europapokaltore/-einsätze des Originals); "Aufschlag auf
  Kondition, Technik, Form" (seit #110 ohne Form); "40 Stände / 1879 Plätze".
- doping.ts:206-209: "13 bis 39 Wochen", "200.000 bis 500.000 DM mal Ligafaktor" - Code:
  `DOPING_BAN` 12..24 Wochen, Strafe 50.000 + 5 % des Guthabens.
- doping.ts:40/103: "Aufschlag auf Kondition, Technik und Form" - Form bekommt nichts.
- jugend.ts:7: "A-Jugend 16/17 Jahre" - seit #112 17/18 (`JUGEND_ALTER`).
- main.ts:4085 Dialog nennt fest "+12/+20", der tatsächliche Aufschlag ist an den Grenzen kleiner
  (H4, offen).

### Q9 - C - H2 nicht nachgezogen: "ungenutzter Bereich"
regeln.ts:9 ("gehört zu keiner der bekannten Tabellen"), abwerben.ts:56, jugend.ts:100, ki.ts:11,
SPIELMECHANIK.md:2276/2323/2627 nennen 34099..34129 frei; tatsächlich sind es die Einträge 1..8 der
Ablauftabelle 4238:5664 (Zähler 4238:1D34 = 34065+i). docs/MEMORY-MAP.md hat für 34065 und 34095
keine Bedeutung und keinen Hinweis auf die 2026-Nutzung. AUDIT-2026.md "Abgrenzung … nur Nullen"
ist durch Q2 widerlegt. Aufwand: Doku.

## 6. Hinweise (kein Fehlerbild)

- Nach `spielBeenden` sperrt der Server nur `/api/done` (server.ts:2997); 2026-Aufträge (Doping,
  Abwerben an Rechner-Manager, Kredite, Jugend) ändern und sichern den Stand weiter. Ohne Wirkung
  auf Bestenliste/Ergebnis.
- `/api/medizin` und `/api/loan/confirm` haben keine Live-Sperre; Wirkung erst beim Tageswechsel
  bzw. nur Geld, daher kein Befund.
- `resolveFreeAgents` (server.ts:953) nutzt noch `assignNumber`, das Bietgefecht noch
  `completePurchase` (server.ts:889) - der Kaufweg des Originals vergibt seit #121ff. keine
  Rückennummer mehr. Gehört zum Bereich Transfers; hier nur vermerkt.

## 7. Unklar

- U1: Belegung der Ablauftabelle 4238:5664. In den 70 Ständen sind nur Einträge 10, 20, 21, 22
  belegt - das sieht nach "Manager · 10 + k" aus. Dann belegte Manager 0 mit zwei verfallenden
  Meldungen Eintrag 1 = Bytes 34099..34102, und ein geladener DOS-Stand hätte im Regelbyte das
  niedrigste Zeigerbyte (1/256 Chance auf "Version 2026"). Ohne Disassemblierung von 0x33F44 nicht
  belegt.
- U2: `seasonPlayerPool` (pool.ts:160 `u8(33) <= 3`) nimmt wartende Ablösefreie (Byte 33 = 6) als
  Kandidaten und kann sie während der Vertragsgespräche einem anderen Verein zuweisen; was danach
  mit Byte 36 geschieht, wenn `resolveFreeAgents` sie vergibt, habe ich nicht verfolgt (Bereich
  Ablösefreie).

## Skripte (scratchpad/q)

- `felder.ts` - Belegung der 2026-Felder in allen 70 Ständen
- `build.mjs`, `harness.mjs` - Server-Tagesablauf MIT/OHNE 2026-Code, Würfe und Hash (Abschnitt 2)
- `cleanup.ts` - Q2; `fremd.ts` - Q1; `jugend1.ts` - Q3

## Kurzliste

| ID | Klasse | Einzeiler |
|---|---|---|
| Q1 | A | `/api/doping`, `/api/medizin`: Platz ungeprüft - Kur/Behandlung bei fremden Managern und Marktspielern |
| Q2 | A | `dopingCleanup` ändert im Original Byte 44 in Müllplätzen (15/70 Stände); H1 offen |
| Q3 | A | Jugend: ohne Öffnen nach dem 1. Saisonwechsel nur C-Jugend; aufgenommene Manager ohne Jugend |
| Q4 | A | Kader-Hilfezeile (#136) liest Byte 23 roh: Verletzungsname fehlt bei Behandlung |
| Q5 | A | Markt: VORN und KAUFSPERRE überlappen; VORN bei Gleichstand ≠ Zuschlag |
| Q6 | B | 2026-Spiele schreiben in dieselbe Bestenliste HIGH.xy wie das Original |
| Q7 | B | Torszenen-Editor ohne Rechte/Besitzer, globaler Namensraum |
| Q8 | C | SPIELMECHANIK Doping-Bytes 5/8 statt 44/45, veraltete Zahlen in doping.ts/jugend.ts |
| Q9 | C | H2 nicht nachgezogen: 34099..34129 als "ungenutzt" beschrieben, ist Ablauftabelle 5664 |
