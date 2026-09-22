/**
 * Tageslauf in der Reihenfolge des Originals - nur für den bytegenauen Vergleich (GitLab #99).
 *
 * Das Original wird mit tools/seed-patch.py (Ort "zug") und tools/kontrollpunkte.py präpariert:
 * nach den Zügen setzt es srand(K) und schreibt an festen Aufrufen den Zustand seines
 * Zufallsgenerators ins Protokoll. Dieser Lauf macht dieselben Schritte mit `originalRng(K)` und
 * notiert an denselben Stellen die Zahl der Würfe. Stimmen die Zahlen, würfeln beide gleich.
 *
 * Der Server spielt einen Tag anders auf (Konferenz, Buchung danach); die Bausteine sind
 * dieselben. Abschnitte, die hier noch fehlen, beenden den Lauf - `bis` sagt, wie weit er kam.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { matchStrength } from "./matchday.ts";
import { kaderVorbereitung } from "./matchday.ts";
import { attendance, bookAttendance, bookGate } from "./attendance.ts";
import { riotCheck } from "./finance.ts";
import { isForfeit } from "./incidents.ts";
import { calendarFlag, dayIndex, FLAG_LEAGUE } from "./calendar.ts";

export interface Kontrollpunkt {
  punkt: number;
  wurf: number;
}

/** Stand des Laufs: Kontrollpunkte und bis wohin er kam. */
export interface Originaltag {
  punkte: Kontrollpunkt[];
  bis: string;
}

/**
 * Die Spielmatrix steht nach 0x0F9D2 mit Flag 1 im Vereinssatz (Kondition 24.., Technik 27..,
 * Form 30..); die Live-Schleife und die Zuschauerrechnung lesen sie dort (0x04568).
 */
function matrixInVerein(g: GameState, manager: number, s: { ko: number[]; te: number[]; fo: number[] }): void {
  const c = g.clubs.at(g.managers.at(manager).clubIndex);
  for (let l = 0; l < 3; l++) {
    c.setU8(24 + l, s.ko[l] & 0xff);
    c.setU8(27 + l, s.te[l] & 0xff);
    c.setU8(30 + l, s.fo[l] & 0xff);
  }
}

export function originaltag(g: GameState, rng: Rng & { zaehler(): number }): Originaltag {
  const punkte: Kontrollpunkt[] = [];
  const kp = (punkt: number) => punkte.push({ punkt, wurf: rng.zaehler() });
  const managers = g.activeManagers();

  // Nach den Zügen: Spielstärke aller Manager (0x1D7FF, Flag 1)
  managers.forEach((_, m) => matrixInVerein(g, m, matchStrength(g, m, rng)));

  const flag = calendarFlag(g, dayIndex(g));
  if ((flag & 7) === 0) return { punkte, bis: "kein Ligatag - weitere Tagesarten fehlen noch" };
  // Verlegungen je Liga (0x3563) würfeln nur im Winterfenster - dort fehlt der Lauf noch
  if (dayIndex(g) >= 25 && dayIndex(g) <= 69) return { punkte, bis: "Winterfenster (Verlegungen) fehlt noch" };

  // Spieltagstreiber 0x46DB: Spielvorbereitung je Paarung in Ligareihenfolge (0x4914)
  kp(1);
  const managerOf = new Map(managers.map((m, i) => [m.clubIndex, i] as const));
  for (let league = 0; league < 3; league++) {
    if (!(flag & FLAG_LEAGUE[league])) continue;
    for (const [home, away] of g.pairings(league)) {
      kp(2);
      // 0x1C632: die Manager der Paarung in ihrer Reihenfolge; der erste mit zu wenigen
      // Spielern beendet die Routine
      const beteiligt = [managerOf.get(home), managerOf.get(away)].filter((x) => x !== undefined).sort((a, b) => a - b);
      for (const mi of beteiligt) {
        if (isForfeit(g, mi)) break;
        if (managers[mi].clubIndex === home) {
          const att = attendance(g, { manager: mi, home, away, level: g.save.plain[34062] }, rng);
          bookAttendance(g, mi, att, away);
          bookGate(g, mi, att);
        }
        kaderVorbereitung(g, mi, 0, rng);
        if (managers[mi].clubIndex === home) riotCheck(g, mi, rng);
      }
    }
  }
  // Live-Schleife 0x05403: zu Beginn jeder Halbzeit die Chancen jeder Paarung (0x054C2)
  kp(4);
  return { punkte, bis: "Beginn der Live-Schleife - die Minuten fehlen noch" };
}
