# Referenz: Trainingswirkung

Gemessen am Original in DOSBox am 17.9.2026 (GitLab #24). Die Routine steht in
`packages/core/src/sim/training.ts` (Original 0x0DF0D, aufgerufen aus der Tagesroutine 0x1DBFE)
und war bis dahin nur an den Balkenlängen des Trainingsbildschirms geprüft.

## Wie gemessen wurde

Anders als bei den Zuschauern steht das Ergebnis im Spielstand: Kondition, Technik und Form in
den Kaderplatz-Bytes 16/17/18, die Frische in Byte 19. Es genügt also, denselben Ausgangsstand
mehrfach zu laden, je einen Tag weiterzuschalten und die Werte danach zu lesen - je Lauf sind
das 16 Spieler mal drei Werte.

- Grundlage ist `RIED-4TE.MAN` (4.4.1996, Saisontag 249, Spiel-Level 3). An diesem Tag stehen
  keine Spiele an, der Tageswechsel ist deshalb in zwei Minuten durch.
- Die Trainingseinstellungen stehen in den Managerbytes 321..324 (Bälle je Bereich, mal 20),
  325 (Intensität) und 326..329 (Bälle je Positionsgruppe). Sie sind vor dem Laden gesetzt
  worden, damit die Eingaben exakt bekannt sind.
- Gefahren wurden drei Reihen: volles Ballbudget mit Intensität 10, minimales Budget mit
  Intensität 1, und noch einmal volles Budget mit **Spiel-Level 1** statt 3 (dazu Byte 34062
  geändert) - der Level entscheidet im Quelltext über zwei verschiedene Zweige.

**Werkzeug:** `tools/dosbox/drive.py replay`. Dabei ist aufgefallen, dass `drive.py save` den
Spielstand nicht schreibt, wenn nach dem Tageswechsel noch Meldungen im Hauptmenü stehen; das
ist behoben (es klickt sie jetzt alle weg).

## Ergebnis

| Reihe | Läufe | Stärkewerte | besser | schlechter | Mittel | Frische |
| --- | --- | --- | --- | --- | --- | --- |
| volles Budget, Intensität 10 | 4 | 192 | 15 | 4 | +0,089 | **+5,03** |
| kleines Budget, Intensität 1 | 4 | 192 | 0 | 26 | −0,224 | **−8,78** |
| Level 1, volles Budget | 3 | 144 | 8 | 2 | +0,069 | **+4,81** |

- **Die Stärkewirkung stimmt.** Richtung, Größenordnung und der Anteil bewegter Werte passen in
  allen drei Reihen zu unserer Fassung (0,045 / −0,243 / 0,054 gegen 0,089 / −0,224 / 0,069).
  Kondition und Technik ändern sich um höchstens drei Punkte je Tag.
- **Die Form hört bei 55 auf.** Jeder Formwert über 55, der sich änderte, sprang genau auf 55:
  AUMANN 59 → 55, KÖPKE 59 → 55, BÄURLE 57 → 55, DORFNER 56 → 55. Unveränderte Werte darüber
  (WEIDEMANN 62) bleiben stehen. Die Deckelung auf 45..55 ist damit bestätigt.
- **Die Frische lag bei uns zu hoch.** In allen drei Reihen war unsere Fassung um rund drei
  Punkte je Tag zu großzügig: die Zeilenschleife legte zweimal einen Zuschlag `Zufall(0,2)` auf
  Byte 19. Den gibt es nicht. Gemessen ist die Änderung genau
  **(Intensität − 5) · 2 − Zufall(3,7)**, begrenzt auf 60..150:
  bei Intensität 10 also +3 bis +7 (Mittel 5,0; gemessen 5,03), bei Intensität 1 rechnerisch
  −8,94 im Kaderschnitt (gemessen −8,78, weil fünf Spieler schon auf der Untergrenze 60 stehen).
  Nach der Berichtigung liefert unsere Fassung +4,99 / −8,90 / +5,00.

> **Berichtigung (GitLab #27):** Zwei Schlüsse dieses Abschnitts waren falsch, die Messwerte
> selbst stimmen.
>
> - Den Zuschlag `Zufall(0,2)` je Linie **gibt es** (0xEC50, 0xECEB) - aber nur im
>   Winterfenster, Saisontag 131 bis 206, und nach Saisontag 322. Am gemessenen Saisontag 249
>   fehlt er im Original zu Recht. Bei uns lag er dort nur deshalb an, weil das Fenster im Code
>   verkehrt herum stand (`> 207` statt `< 207`). Richtig wäre gewesen, das Fenster zu
>   berichtigen, nicht den Zuschlag zu streichen.
> - Der Vergleich mit **0x38 = 56** bei 0xDF8F gehört zur Schleife über die
>   **Transfermarktspieler** (Aufstellung 100 + Platz). Die Kaderplätze vergleicht 0xEFD4 mit
>   **0x32 = 50** - so wie es vorher bei uns stand.
>
> Die Gegenprobe im Winterfenster steht unten unter "Zweite Messung".

Die Messwerte stehen als Test in `packages/core/test/training-messung.test.ts`.

## Zweite Messung: über die Winterpause (GitLab #27)

Gemessen am 17.9.2026. Das Winterfenster (Saisontag 131..206) liegt genau in der Winterpause, in
der es keine Spiele gibt. Das Original durchläuft sie in **einem** Tageswechsel: vom Samstag,
2. Dezember (Kalendertag 36) bis zum 21. Februar (Kalendertag 59). Unterwegs zählt der
Tagesablauf den Saisontag einzeln hoch und trainiert an jedem Kalendertag.

- Ausgangsstand `WINT`: `RIED-5TE` in DOSBox zwei Tage bis zum 2.12. vorgespult, Spiel-Level 3.
  Die Frische des Kaders lag bei 60 60 60 75 123 60 69 73 84 60 105 60 64 84 122.
- Daraus zwei Stände mit festen Einstellungen wie in der ersten Messung, dann je ein Tageswechsel.

| Reihe | Läufe | Original | Remake mit Abreisetag | Remake mit Ankunftstag |
| --- | --- | --- | --- | --- |
| volles Budget, Intensität 10 | 2 | alle 15 Spieler **genau 150** (+72,73) | Werte bis 156 (+75,81) | alle 150 (+72,73) |
| kleines Budget, Intensität 1 | 4 | −8,62 (Läufe −7 bis −10) | −4,02 | −10,06 |

Ohne Winterfenster, also mit der Fassung vor #27, wären bei Intensität 1 alle Spieler auf 60
gefallen (−17,3). Im Original halten sich die hohen Werte über den Winter: 123 wurde 107, 96, 95,
97; 122 wurde 114, 124, 89, 112.

**Zwei Befunde:**

1. **Das Winterfenster wirkt.** Mindestintensität 6 und die Zuschläge `Zufall(0,2)` je Linie sind
   echt; über die Winterpause erholen sich die Spieler.
2. **Das Training gehört zum Ankunftstag.** "Alle genau 150" ist nur erklärbar, wenn am letzten
   Trainingstag kein Zuschlag mehr kam: das ist der 21.2. (Saisontag 207, außerhalb des Fensters),
   nicht der 17.2. (203). Der Code bestätigt es: der Tagesablauf spielt erst die Spiele des Tages,
   zählt dann den Saisontag hoch (0x1DA87) und trainiert für den neuen Kalendertag (0x1DBFE). Das
   Remake trainierte bis dahin vor den Spielen für den alten Tag - ein Stand des Originals wurde
   damit am ersten Tag doppelt trainiert. Die erste Messung (Saisontag 249) konnte das nicht
   zeigen, weil beide Tage außerhalb des Fensters liegen.

Die Messwerte stehen als Test in `packages/core/test/training-messung.test.ts`.

**Werkzeug:** `tools/dosbox/drive.py` kannte zwei Bildschirme nicht und blieb daran hängen: den
roten Hinweiskasten mit OKAY ("Achtung ! Dies ist der letzte Spieltag vor der Winterpause.") und
die Meldungen beim Managerwechsel ohne Titelleiste. Außerdem erkannte es offene Meldungstafeln an
einem Pixel, dessen Grau genau dem Marmor gleicht. Alle drei sind behoben.
