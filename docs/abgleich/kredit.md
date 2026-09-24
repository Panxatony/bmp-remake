# Zweigbuch Kredite - Aufnahme 122D9, Summen 1222D, Prüfungen im Bankbildschirm 1291F

Gelesen am 24.9.2026 (GitLab #100). Remake: `takeLoan`, `loanRequestCheck` (sim/stadium.ts),
`lenderDebt`, `loanTotal` (sim/finance.ts); Zinsen und Rückzahlung stehen im Zweigbuch 11D0D.

## 0x122D9 - Kredit eintragen

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 122E6-12333 | erster freie Platz (Betrag 0) unter den drei Plätzen des Geldgebers, Satz (Manager·778 + 508 + (Geldgeber·3 + Platz)·18) | `takeLoan` | stimmt |
| 12335-1235D | kein Platz frei: Meldung "Schon 3 Kredite" (4cb3:4D58) | ebenda | stimmt |
| 12360-12399 | Betrag, Satz in Byte 12, Zins je Monat = Betrag · Satz / 100 (32 Bit) | ebenda | stimmt |
| 1239D-123CA | Aufnahmetag Byte 8, Monat Byte 10, Jahr 14/15 und 16/17 | ebenda | stimmt |
| 123CE-123F5 | Rückzahlungsmonat = Monat + Laufzeit, über 11 je 12 abziehen und das Jahr erhöhen | ebenda | stimmt |
| 123F9-1242E | Zinstermin Byte 9 = Aufnahmetag, höchstens die Länge des Rückzahlungsmonats (4cb3:07B8) | ebenda | stimmt |

Die Buchung auf die Konten macht der Aufrufer, nicht 0x122D9.

## 0x1222D - Schulden oder Zinsen

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 12238-122D8 | Summe über fünf Geldgeber und je drei Plätze mit Betrag ≠ 0; Argument 1: 0 = Beträge, sonst Zinsen; Argument 2: Geldgeber oder 99 = alle | `lenderDebt`, `loanTotal` | stimmt |

## 0x1291F - Prüfungen im Bankbildschirm (ab 0x1320B)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 13216-132B6 | Mitspieler als Geldgeber: Kontostand unter dem Betrag → Absage | `takeLoan`, `loanRequestCheck` | stimmt |
| 132B8-132D8 | Mitspieler: Schulden bei ihm + Betrag über 1.000.000 → Meldung | `LOAN_MAX_MANAGER` | stimmt |
| 132FE-1331B | Bank: Schulden bei der Bank + Betrag über 4.000.000 → Meldung | `LOAN_MAX_BANK` | stimmt |
| 1340A | Laufzeit beim Mitspieler höchstens 24 Monate | `LOAN_MONTHS_MAX` | stimmt |

Keine Befunde.
