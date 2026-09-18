# bmp-remake

Nachbau von **Bundesliga Manager Professional** (Software 2000, 1991, DOS) als
Netzwerkspiel im Browser. Ziel ist eine möglichst exakte Nachbildung der Spielmechanik des
Originals, dazu ein erweitertes Regelwerk "Version 2026" für den Mehrspielerbetrieb.
Methode und Meilensteine stehen in `docs/PLAN.md`.

## Das Original wird gebraucht

Im Repo steht **keine einzige Datei aus dem Original** – keine Bilder, keine Schriften, keine
Klänge, keine Torszenen und auch keine Spieltexte. Wer spielen will, braucht seine eigene Kopie
von Bundesliga Manager Professional und erzeugt daraus einmalig alles Nötige:

    npm install
    npm run assets -- /pfad/zur/installation

Das liest `PIC/`, `TORE/`, `SOUND/`, `BMLOADER.EXE` und `BMMAIN.EXE` und legt in `assets/` die
Bilder, Schriften, Klänge, die Titelmusik, die Torszenen und den Textkatalog ab. `assets/` steht
in `.gitignore` und bleibt auf dem eigenen Rechner. Gebraucht werden Python 3 mit Pillow; für die
Titelmusik zusätzlich `gcc` und `ffmpeg` (ohne sie läuft das Spiel auch, nur still).

Die Spielstände (`*.MAN`) und die Stammdaten (`MANA.DAT`) liest der Server unverändert aus dem
Ordner der Installation. Wo der liegt, sagt die Umgebungsvariable `BMP_DIR` (Vorgabe: der
Nachbarordner `../bmp`).

**Gebraucht wird die DOS-Fassung.** Die Amiga-Fassung wird noch nicht unterstützt: Bilder,
Schriften, Klänge und Texte liegen dort in anderen Formaten, und ob Stammdaten und Spielstände
denselben Aufbau haben, ist ungeprüft. Sie soll später dazukommen.

Einzelne Schritte, falls nötig:

| Befehl | erzeugt |
| --- | --- |
| `python3 tools/vga.py --all <bmp>/PIC assets/pic` | alle Bilder |
| `python3 tools/fonts.py <bmp>/BMLOADER.EXE assets/font <entpacktes BMMAIN>` | Schriften |
| `npm run texte -- <bmp>/BMMAIN.EXE` | Textkatalog `assets/text/spiel.json` |
| `python3 tools/digi.py <bmp>` | die fünf Klänge |
| `python3 tools/tore.py <bmp>` | Torszenen und ihre Bilder |

Wie der Textkatalog funktioniert: `tools/texte-manifest.json` merkt sich nur **Fundstelle,
Länge und Prüfsumme** jedes Textes im entpackten `BMMAIN.EXE`; `tools/texte.py` schneidet sie
dort heraus. Der Spielkern fragt sie über `texte(gruppe)` ab (`packages/core/src/data/texte.ts`).
Kurze Beschriftungen, die keine eigene Formulierung des Originals sind (einzelne Wörter,
Spaltenköpfe), stehen weiter im Quelltext.

Ob sich doch einer eingeschlichen hat, prüft `python3 tools/eigenetexte.py <entpacktes BMMAIN>`:
es liest jede Zeichenkette aus `packages/**/*.ts` (auch aus den Tests und aus den Bausteinen von
Schablonen) und meldet jede, die wörtlich im Programm des Originals steht. Der Befehl endet mit
Rückgabewert 1, solange es Funde gibt - er lässt sich also als Torwächter benutzen.

## Spielen

Mehrspieler-Server (hält den Spielstand, Anmeldung mit Benutzer und Passwort):

    node packages/server/users.ts add NAME PASSWORT
    cd packages/web && npm run build
    node packages/server/server.ts --load SPIELSTAND.MAN --port 8765

Danach `http://localhost:8765/` im Browser öffnen. Alle Schalter, die Benutzerverwaltung und
der Betrieb hinter einem Reverse Proxy stehen in `docs/BETRIEB.md`.

Nur den Spielstand ansehen (Prototyp 0, ohne Server und Anmeldung):

    cd packages/web && npm start        # http://localhost:8765/
    # Direkt auf einen Bildschirm: ?load=SPIELSTAND.MAN&screen=squad

## Aufbau

- `packages/web` – Browser-Client im Originallook: Hauptmenü, Mannschaft mit
  Aufstellungstausch, Verträge, Transfermarkt, Training, Stadion, Tabelle, Finanzen,
  Meldungen, Live-Konferenz mit Torszenen.
- `packages/server` – Node-Server: hält den Spielstand, Anmeldung und Sitzungen,
  Tageswechsel, Konferenz, Mehrspieler-Schnittstelle unter `/api/`.
- `packages/core` – TypeScript-Kern: Spielstand-Codec (`SaveFile`), typisierte Datensätze
  (`GameState`, `Club`, `Player`, `Manager`, `Standing`, `Lineup`) und die nachgebaute
  Spielmechanik unter `src/sim/`. Läuft ohne Build direkt unter Node 24.
- `tools/` – Werkzeuge zum Entpacken, Deuten und Erzeugen (siehe unten).
- `docs/SPIELMECHANIK.md` – was das Spiel wie rechnet, samt dem Regelwerk 2026.
- `docs/MEMORY-MAP.md` – Speicherkarte: Spielstand-Blöcke, Adressen, Datensatzgrößen,
  bekannte Felder.
- `docs/BETRIEB.md` – Server starten, Benutzer anlegen, Schnittstelle, Reverse Proxy.
- `docs/PLAN.md` – Methode und Meilensteine.

## Regelwerk

Ein Spielstand läuft entweder nach den **Originalregeln** oder nach **Version 2026**: gleiche
Vereine, gleiche Spieler, gleiche Bilder, gleiche Bildschirme – nur ein erweitertes Regelwerk für
den Betrieb zu mehreren. Gewählt wird beim neuen Spiel, umgeschaltet im Bildschirm "Regeln 2026"
im Untermenü Diskette. Ein Spielstand des Originals wird immer als Original gelesen.

## Version 2026: was dazugekommen ist

Eine Ergänzung zum Handbuch von 1993 – was es gibt und wo es steht. **Wie** es rechnet, steht
hier absichtlich nicht; das findet man im Spiel heraus (und, wer es genau wissen will, in
`docs/SPIELMECHANIK.md`).

### Auf dem Platz

- **Drei Punkte je Sieg.** Die Tabelle zeigt nur noch die Punkte, keine Minuspunkte.
- **Fünf Auswechslungen** je Spiel, unabhängig von der Position.

### Handel unter Managern

- **Abwerben.** Man muss nicht mehr warten, bis ein Mitspieler einen Spieler auf den
  Transfermarkt setzt: jeder Spieler eines anderen Managers lässt sich direkt ansprechen. Gefragt
  wird nicht der Verein, sondern der Spieler – und er sagt auch nein. Über die Ablöse hinaus darf
  man ihm etwas bieten; wie viel er dafür nachgibt, merkt man erst an seiner Antwort. Je Saison
  gelingt bei jedem Mitspieler höchstens eine Abwerbung. *(Untermenü Trikots, Symbol mit der
  Angel.)*
- **Gegenwehr.** Wer abgeworben wird, erfährt davon und hat bis zum nächsten Tageswechsel Zeit,
  seinen Spieler mit einer Gehaltserhöhung zu halten. Die Erhöhung bleibt stehen – auch wenn er
  trotzdem geht.
- **Bietgefecht.** Ein Gebot auf einen Spieler ohne Manager wird nicht mehr sofort entschieden.
  Es steht bis zum nächsten Tageswechsel, jeder darf nachlegen, und man sieht nur das eigene
  Gebot und wie viele insgesamt vorliegen. Wer zuschlägt, verhandelt nicht mehr – es ist eine
  Versteigerung.
- **Ablösefrei am Saisonende.** Auslaufende Verträge bringen dem alten Verein nichts mehr. Die
  Spieler stehen allen Managern offen, geboten wird ein Monatsgehalt. Wer keinen Abnehmer findet,
  geht ins Ausland. *(Bildschirm "Regeln 2026".)*
- **Kredit nur mit Zustimmung.** Geld von einem Mitspieler gibt es nur noch auf Anfrage: der
  Borger nennt die Summe, der Geldgeber setzt Laufzeit und Zins – oder lehnt ab. Unbeantwortete
  Anfragen verfallen mit dem Tag. Die Bank leiht wie gehabt sofort.

### Geld und Risiko

- **Überschuldung.** Wer zur Monatsabrechnung tief im Minus steht, verliert Punkte in der Tabelle
  und darf einen Monat lang nicht kaufen, leihen oder abwerben. Alle erfahren davon.
- **Derby-Einsatz.** Treffen zwei Managervereine aufeinander, geht es um Geld. Jeder setzt vorher
  einen Betrag, ohne den des anderen zu kennen; gespielt wird um den kleineren. Aussteigen kann
  niemand. *(Bildschirm "Regeln 2026".)*
- **Entschärfte Ungerechtigkeiten.** Zinsen werden für alle zum selben Termin gebucht (im
  Original hing er am Tag der Aufnahme), teure Spieler bekommen keine unsinnigen Marktpreise
  mehr, und Geld auf dem Konto wird nur bis zu einer Obergrenze verzinst – Horten ist keine
  Strategie mehr.

### Neue Abteilungen

- **Medizinische Versorgung.** Für jeden verletzten Spieler lässt sich eine Behandlungsstufe
  wählen, vom Vereinsarzt bis zur Sportklinik. Das kostet je Woche und kann die Ausfallzeit
  verkürzen – sicher ist es nicht, und aus einem Kreuzbandriß wird nie eine Zerrung. Lange
  Verletzungen lohnen die Behandlung eher als kurze. *(Untermenü Trikots, Symbol mit dem roten
  Kreuz.)*
- **Doping.** Der schmutzige Gegenpol: ein Spieler wird deutlich stärker, als Training es je
  schaffen würde. Nach jedem Einsatz wird gewürfelt, ob er auffliegt, und mit jedem weiteren
  Einsatz steigt die Gefahr. Wer erwischt wird, ist Monate gesperrt und zahlt eine Geldstrafe, die
  mit dem Vermögen wächst – und alle Manager lesen davon. Mehr als drei Kuren gleichzeitig lässt
  der Arzt nicht zu. Für ein einzelnes wichtiges Spiel ist es eine Wette, auf Dauer nicht.
  *(Zweite Karteikarte im Arztbildschirm.)*
- **Jugendarbeit.** Jeder Manager führt eine C-, B- und A-Jugend. Die Talente altern, entwickeln
  sich, rücken auf – oder verschwinden. Zwei Hebel gibt es: **Geld** für die Betreuung und die
  **Trainingsintensität**. Beides zusammen kann aus einem Talent mehr machen, als in ihm zu
  stecken schien; wer zu viel verlangt, verliert ihn an die Lust. Kümmern kann man sich aber nur
  um **vier je Jahrgang** – die übrigen laufen mit. Wer reif ist, rückt in die Männermannschaft –
  und ist dort auch für die Mitspieler interessant. *(Untermenü Büro, Symbol mit dem Jungen am
  Ball.)*
- **Eigene Torszenen.** Die Torszenen des Originals lassen sich um eigene ergänzen: ein Editor im
  Spielbild setzt Figuren und Ball, spielt die Szene ab und legt sie zum Spielstand. Wie er
  gedacht ist, erklärt der Knopf HILFE im Editor selbst. *(Untermenü Diskette, "SZENEN".)*

Alle neuen Regeln hängen am gewählten Regelwerk und lassen einen Spielstand nach Originalregeln
unberührt.

## Werkzeuge

- `tools/unexepack.py` – entpackt das EXEPACK-komprimierte `BMMAIN.EXE`.
- `tools/xref.py` – findet Code-Zugriffe auf Datenadressen und die benachbarten
  Bildschirmtexte; das Hauptwerkzeug zur Felddeutung.
- `tools/func.py` – zerlegt eine Routine des Disassemblats.
- `tools/vga.py` – Bilder aus `PIC/*.VGA` und `*.CP` als PNG.
- `tools/fonts.py` – Bitmap-Schriften aus `BMLOADER.EXE`. Mit einem dritten Argument
  (entpacktes BMMAIN) kommt die große Zahlenschrift `gross.json` dazu.
- `tools/texte-manifest.py`, `tools/texte.py` – Textkatalog beschreiben und ausschneiden.
- `tools/eigenetexte.py` – findet Texte des Originals im Quelltext des Remakes (Torwächter für
  den Textkatalog; gibt nur Fundstellen aus, ändert nichts).
- `tools/kasten.py` – alle Aufrufstellen des Hinweiskastens mit ihren Texten auflisten (zum
  Abgleich der Darstellung; gibt Texte nur aus, speichert nichts).
- `tools/digi.py`, `tools/tore.py`, `tools/cmf/` – Klänge, Torszenen, Titelmusik.

## Entwickeln

    # Disassembly erzeugen (einmalig)
    python3 tools/unexepack.py <bmp>/BMMAIN.EXE tools/out/bmmain
    objdump -D -b binary -m i8086 tools/out/bmmain.bin > tools/out/bmmain.asm

    # Felder einer Tabelle deuten, z.B. Spieler (37 Bytes je Datensatz)
    python3 tools/xref.py 0x4238 0x57dd 5587 --summary --record 37

    # Tests des Kerns gegen eigene Spielstände (BMP_DIR zeigt auf den Ordner mit *.MAN)
    cd packages/core && npm test

Die Tests vergleichen die nachgebauten Routinen mit Werten aus echten Spielständen und
brauchen deshalb eine eigene Installation des Originals; die Spielstände selbst liegen nicht
im Repo.

## Verweise der Art "GitLab #12"

In Quelltext und Dokumentation stehen an vielen Stellen Verweise wie `GitLab #48`. Sie zeigen
auf die Arbeitsablage des Projekts, die nicht öffentlich ist, und sagen: "diese Entscheidung ist
dort festgehalten". Zum Verständnis des Codes braucht man sie nicht - was gilt und warum, steht
jeweils im Kommentar daneben.

## Lizenz und Sicherheit

Quelltext und Werkzeuge stehen unter der MIT-Lizenz, siehe `LICENSE` (dort auch die
Ausnahmen für fremde Bestandteile in `tools/cmf/`). Alle Rechte am Original liegen bei seinen
Urhebern; dieses Repo enthält nichts davon. Sicherheitslücken bitte vertraulich melden, siehe
`SECURITY.md`.
