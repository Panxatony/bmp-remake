# Zweigbuch 20DBC - Einwechslung, Verlassen des Kaderbildschirms 21190

Gelesen am 23.9.2026 (GitLab #100). 0x20DBC ist der Teil des Kaderbildschirms, der einem Platz
eine Rückennummer gibt; mit Schalter +6 (Spiel läuft) ist es eine Einwechslung. Remake:
`server/live.ts` (`applySubstitutions`, `refreshStrength`), Server `/api/squad`, `/api/system`.

| Adressen | Was | Remake | Urteil |
|---|---|---|---|
| 20DBC-20DC2 | Nur im laufenden Spiel (+6) | `room.live` | stimmt |
| 20DC5-20E06 | Wechselkontingent 4238:5396 + 2 · Manager + (Spielerbyte 31 ≥ 1) herunter - **nach dem Eingewechselten**: Torwart bei Byte 31 = 0 | zählte nach dem Ausgewechselten | **W1** |
| 20E0B-20E17 | Liga (+8 = 0): Spielerbyte 35 + 1 | fehlte | **W2** |
| 20E1C-20E50 | Einsatz im Wettbewerb: Kaderbyte 6/7/8 + 1 (16-Bit-Zähler 28/30/32 nicht) | fehlte | **W2** |
| 20E55-20E72 | Frische + 4 + random(2,4) | fehlte | **W2** |
| 20E77-20E86 | Auswechslungen des Managers 4238:90C6 + 1 | `state.subs` (`wechselZahl`) | stimmt |
| 20E8B-20EF2 | Feldposition 25/26 vom Ausgewechselten, Nummer 11, danach neu nummerieren (0x2119D) | Client | stimmt |
| 2117E-21190 | Beim Verlassen im Spiel: Stärke neu (0x0F9D2, Flag 1) | `refreshStrength` | stimmt |

## Befunde

| | Was | Stand |
|---|---|---|
| W1 | Das Wechselkontingent (ein Torwart, zwei Feldspieler) zählte das Remake nach dem ausgewechselten Spieler; im Original nach dem eingewechselten - wer einen Feldspieler für den Torwart bringt, verbraucht einen Feldspielerwechsel | behoben |
| W2 | Der Eingewechselte bekam keinen Einsatz (Kaderbyte 6/7/8, in der Liga Spielerbyte 35) und keine Frische + 4 + random(2,4) | behoben |
