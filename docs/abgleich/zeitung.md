# Sportzeitung gegen die Bildschirme des Originals

Stand 24.9.2026 (GitLab #100). Die Würfe der Zeitung (0x3074A, 0x2F243) belegen die
Tagesvergleiche schon (Kontrollpunkte 24/25). Hier werden die fertigen Seiten verglichen:

- TEST4 und RIED-4TE sind im Original mit srand(0x1234) je Tag gespielt (seed-patch.py
  0x1234 tag, drive.py mit DRIVE_DEBUG), jede Seite als Bild gesichert und abgelesen.
- Dieselben Tage rechnet `originaltag`, die Zeitungen aus `composeZeitung` werden gesammelt.

Geprüft sind vier Seiten: Nürnberg-Schalke 0:0, Düsseldorf-Ulm 4:0, Duisburg-Hannover 4:1,
Düsseldorf-Hannover 1:0 (Derby). Schlagzeile, alle Sätze, Aufstellung mit Noten, Torschützen und
Karten stimmen Wort für Wort (test/zeitung-original.test.ts). Das Foto (random(0,29)) ist nicht
Teil des Vergleichs.

## Befund

| | Was | Stelle | Stand |
|---|---|---|---|
| Z1 | Der schwächste Spieler (%d, Bewertung unter -15, erster Treffer) kann auch der Torwart sein; nur beim besten (%c) prüft das Original die Position. Das Remake ließ den Torwart bei beiden aus (TEST4: "J.SIEVERS BEFÖRDERTE SEINE MANNSCHAFT ... AUF DIE VERLIERERSTRASSE") | 0x2F66E, 0x2F6DB | behoben |
