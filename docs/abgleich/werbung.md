# Zweigbuch Werbung - Abschluss 291CD/29242, Monat 11E42, Saisonende 0CC00

Gelesen am 24.9.2026 (GitLab #100). Remake: `signShirt`, `signBoard`, `monthlyAdvertising`,
`seasonEndAdvertising` (sim/werbung.ts); die Angebote 0x176F4 stehen in Zweigbuch 176F4.

## 0x291CD / 0x29242 - Vertrag im Werbebildschirm

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 29188-291CA | Seite 0 (Trikot): läuft der Vertrag noch (4238:0000[2 · Manager] ≠ 0), Meldung "unter Vertrag" | `signShirt` | stimmt |
| 291CD-2923F | Sponsor nach 4238:0001, Restmonate = 12 · Laufzeit 4238:2EC2[Index], Betrag aus 4238:002E nach 4cb3:066C + 36 · Manager; Index = (2 · Manager + Seite) · 10 + Sponsor; das Angebot bleibt stehen | ebenda | stimmt |
| 29242-29260 | Seite 1 (Bande, Platz 0..5): Vertrag läuft noch → Meldung | `signBoard` | stimmt |
| 29263-292F4 | Sponsor, Restmonate 12 · Laufzeit nach 4238:4B9A, Betrag nach 4cb3:0670 + 4 · (9 · Manager + Platz); das Angebot wird 0 | ebenda | stimmt |

## 0x11E42 - Monatsende (aus der Finanzroutine 0x11D0D)

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 11E42-11E76 | Trikot: Restmonate > 0 → minus 1; bei 0 Betrag / 10 (0x3BA18) | `monthlyAdvertising` | stimmt |
| 11E7B-11EEB | Banden 0..5 ebenso | ebenda | stimmt |

## 0x0CC00 - Saisonende, nur nach einem Aufstieg

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 0CC00-0CC32 | Trikot abgelaufen (Restmonate 0): Betrag / 10 | `seasonEndAdvertising` | stimmt |
| 0CC34-0CC7C | Trikot läuft noch: Restmonate 0, Hinweiskasten (4238:4F44..4F52) | ebenda, Rückgabe `hinweis` | stimmt |
| 0CC7F-0CCEB | Banden 0..5: abgelaufen → Betrag / 10; dann Restmonate 0 | ebenda | stimmt |

Keine Befunde. Dass der Block vor den Sommertagen läuft (0x0CC00 im Saisonende 0x0CB62), steht
im Abgleich des Saisonwechsels (docs/abgleich/saisonwechsel.md).
