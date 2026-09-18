# Referenz: Sponsoren- und Bandenangebote

Geprüft am 17.9.2026 (GitLab #25). Die Angebote würfelt das Original beim Saisonwechsel
(0x176F4, bei uns `generateOffers` in `packages/core/src/sim/werbung.ts`); die Beträge hängen an
Liga, Fanwert und Stadionwert.

## Wie geprüft wurde

Das Ticket sah vor, die Angebote im Werbebildschirm abzulesen. Das war nicht nötig: **die
Angebote stehen im Spielstand** - Beträge als i32 ab 33598, Laufzeiten ab 33518, je
`(Manager · 2 + Seite) · 10 + Sponsor`. Jeder Spielstand des Originals trägt damit einen Satz
echter, vom Original erzeugter Angebote.

Geprüft wurden alle 40 vorliegenden Spielstände: **907 Angebote**. Zu jedem wurde das Band
unserer Erzeugung aus 400 Würfen mit denselben Eingaben gebildet und geschaut, ob der echte
Betrag darin liegt.

## Ergebnis

| Art | Angebote | im Band |
| --- | --- | --- |
| Bandenwerbung | 421 | **421 (100 %)** |
| Trikotwerbung | 486 | 457 (94 %) |

**Die Bandenwerbung stimmt vollständig.** Bei der Trikotwerbung liegen 29 Angebote daneben, die
sich auf **sechs verschiedene Fälle** verteilen (die Spielstände RUNA0..9 und RUNB0..9 sind
Kopien derselben Lage):

| Betrag | unser Band | daneben | Spielstände |
| --- | --- | --- | --- |
| 249.034 | 251.257..357.882 | 0,88 % | AUTOSAVE, RUNA0..9, TEST4 (Tag 63/67) |
| 222.488 | 224.504..313.710 | 0,90 % | RUNB0..9, TEST5 (Tag 70/77) |
| 223.939 | 224.504..313.710 | 0,25 % | RIED-CLI, TEST1, TEST2 (Tag 105/109) |
| 171.129 | 172.444..255.678 | 0,76 % | RIED-6TE (Tag 7) |
| 110.273 | 79.697..109.733 | 0,49 % | TEST-LAS (Tag 0) |
| 157.757 | 122.591..148.742 | **6,06 %** | SCHWARZ-, CLAUDE (Tag 0/4) |

**Fünf der sechs Fälle liegen unter einem Prozent neben der Grenze** und erklären sich damit,
dass der Fanwert im Spielstand nicht mehr der ist, mit dem gewürfelt wurde - die Angebote
entstehen beim Saisonwechsel, der Fanwert wandert danach weiter. Nachgewiesen:

- `TEST-LAS.MAN`: mit dem gespeicherten Fanwert 10 passt ein Angebot nicht, mit **15 bis 25
  passen alle fünf** gleichzeitig.
- `RIED-6TE.MAN`: gespeichert ist 64, alle sieben Angebote passen bei **30 bis 60**.

**Offen bleibt ein Fall.** Bei `SCHWARZ-.MAN` (Oberliga, Tag 0) liegt das Angebot von Sponsor 8
mit 157.757 DM sechs Prozent über unserer Obergrenze, während die übrigen vier Angebote
desselben Managers beim gespeicherten Fanwert 10 passen. Ein einzelner Fanwert erklärt diesen
Stand nicht: ab 30 passt Sponsor 8, dafür fallen dann die anderen heraus. Das ist ein Angebot
von 907 und betrifft nur die Trikotseite; die Ursache ist nicht gefunden.

Der Test in `packages/core/test/werbung-messung.test.ts` prüft eine Auswahl der Spielstände:
Bandenangebote müssen alle im Band liegen, Trikotangebote zu mindestens 90 Prozent. Die Zahl der
Würfe für das Band muss dabei groß genug sein - mit 200 statt 400 fällt schon ein Bandenangebot
heraus, weil die Grenzen dann noch nicht ausgereizt sind.
