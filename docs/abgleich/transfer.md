# Zweigbuch Transfer - 24D4E, 16EFF, 16E1A, 248E1, 245A8, 242CF, 22C15

Gelesen am 22.9.2026 (GitLab #82, Kapitel 8). Remake: `value.ts` (`playerValue`),
`transfer.ts`. Befunde in GitLab #96.

| Routine | Was | Remake | Urteil |
|---|---|---|---|
| 0x24D4E Marktwert | Grundwert, Tore, Einsätze, Trainingsfaktor, Karten, Alter; Gehaltsbasis mit dritter Potenz; Leihe /3 und random(75,95); Angebotsmarke ·130 bzw. random(95,100); ·5/3; Marktaufschlag random(v/20, v/10) in 16 Bit; Rundung | `playerValue` | stimmt Term für Term |
| 0x16EFF Verein für ein Angebot | Wert kommt als **Byte** (alle drei Aufrufer schieben AL) | ohne Kürzung | **T1** behoben |
| 0x16E1A Verein stärken | Summenschleife liest mit dem noch unbelegten Index -0x4: eine zufällige Linie aus dem Stapelrest statt des Durchschnitts | Durchschnitt aller Linien | *nicht nachbildbar*, Näherung bleibt |
| 0x248E1 KI nimmt Kaufangebot an | Annahme erst **über** Preis·random(120,130)/100 | ab Gleichstand | **T2** behoben |
| 0x245A8 Markterneuerung | wie Remake; aber nach einer Neuwahl des Vereins (Manager-Verein) steht der Schleifenzähler -0xA auf dem Ligaband (0x248C4) | fehlte | **T3** behoben (Eigenheit übernommen) |
| 0x242CF Verkaufsdialog | Ablöse = Angebot - Angebot/7·Vertragsjahre; Anzeige mit Umrechnungsfaktor 4cb3:2252/224E | `saleOffer` | stimmt |
| 0x22C15 Marktbildschirm, Kauf ab 0x23DD2 | Kauf von einem Manager: dessen Kaderwerte 16/17/18 in den Spielerdatensatz, keine KI-Prüfung, danach Byte 9/23/13/0/1/2 vom Marktplatz; bei KI-Spielern frischer Platz aus 0x224A8 | kopierte die Bytes immer | **T4** behoben |
