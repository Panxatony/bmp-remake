# Referenz: Kaufentscheidung der KI

Gemessen am Original in DOSBox am 17.9.2026 (GitLab #22). Die Regel steht in
`packages/core/src/sim/transfer.ts` (`aiAccepts`, Original 0x248E1) und entscheidet über jeden
Kauf vom Transfermarkt - die Regel, die im Mehrspielerbetrieb am meisten weh täte, wenn sie
falsch wäre. Das Ergebnis steht nur auf dem Bildschirm, im Spielstand landet nur die Folge.

## Wie gemessen wurde

Je Versuch: Spielstand laden, den obersten Marktspieler anklicken, einen Betrag eingeben und die
Antwort ablesen. **Angenommen** heißt, der Vertragskasten geht auf ("VERTRAGSDAUER (IN SAISONS)"),
**abgelehnt** heißt, es bleibt beim Transfermarkt.

Zwei Fallen, beide beim Messen aufgefallen:

- **Das Original erneuert den Transfermarkt beim Laden teilweise.** Ein fester Betrag würde sich
  daher auf einen unbekannten Wert beziehen. Deshalb wird der Stand nach dem Laden sofort wieder
  gespeichert und der Marktwert des angeklickten Spielers aus diesem Stand gelesen; der Betrag
  ist dann ein Anteil davon.
- **Der Speicherdialog fragt beim zweiten Mal nach.** "FILE EXISTIERT BEREITS. ÜBERSCHREIBEN?"
  mit ACH BITTE ! links und BLOSS NICHT ! rechts - `drive.py` klickte bei Dialogen pauschal
  rechts. Der Dialog blieb offen, alle Klicks danach liefen ins Leere, und die Messung las
  Unsinn. Behoben in `tools/dosbox/drive.py`.

Werkzeug: `tools/dosbox/kaufmessung.py` (im Scratchpad entstanden, Ablauf oben beschrieben).

## Ergebnis

Grundlage war `RIED-4TE.MAN` mit einem Konto von 90 Millionen; die Marktwerte lagen je nach Lauf
zwischen 250.000 und 918.000 DM.

| Angebot | Versuche | angenommen | Quote | unsere Formel |
| --- | --- | --- | --- | --- |
| 70 % des Werts | 8 | 0 | 0 % | 0 % |
| 80 % | 8 | 0 | 0 % | 0 % |
| 100 % | 50 | 27 | **54 %** | 48,9 % |
| 115 % | 16 | 14 | **87,5 %** | 85,6 % |
| 130 % | 8 | 8 | 100 % | 100 % |

**Alle fünf Stufen passen.** Die beiden Schwellen sind damit bestätigt: unterhalb von etwa 85 %
wird nie angenommen, ab 120 bis 130 % immer. Dazwischen wird gewürfelt, und die gemessenen
Quoten liegen innerhalb des Zufallsrauschens unserer Fassung (bei 100 % ist "mindestens 27 von
50" unter unserem Modell zu 28 % zu erwarten, der 95-%-Vertrauensbereich der Messung reicht von
40 bis 68 %).

Eine Zwischenauswertung nach acht Versuchen hatte bei 100 % noch 75 % Annahmen gezeigt und den
Verdacht auf eine zu strenge Formel genährt; mit 50 Versuchen hat sich das als Rauschen erwiesen.
Die Messwerte stehen als Test in `packages/core/test/transfer-messung.test.ts`.
