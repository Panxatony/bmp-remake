/**
 * KI-Vereine: Torschützen und Einsätze ihrer Spieler je Spieltag (0x160A2/0x15F14),
 * Grundzuschlag nach jedem Spiel (0x2C3FC) und die Schwankung der Vereinsmatrix am
 * Monatsende bzw. zu Saison- und Spielbeginn (0x10067).
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Gewichtstabelle 4cb3:5331 je Zahl der Kandidaten. */
const SCORER_WEIGHT = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Stärkebänder je Ligaklasse (4cb3:05CE): Bundesliga, 2. Liga, Oberliga. */
const BANDS: [number, number][] = [[70, 93], [40, 74], [15, 45]];

function isManagerClub(g: GameState, club: number): boolean {
  return g.activeManagers().some((m) => m.clubIndex === club);
}

/**
 * Tore eines KI-Vereins auf seine Spieler verteilen (0x15F14): jeder Spieler des Vereins
 * bekommt mit 94 % einen Einsatz (Byte 35); Kandidaten sind Spieler mit random(5,25) +
 * Positionswert (Byte 31) > random(10,99). Je Tor mit 4/5 ein Kandidat; dieser wird mit
 * w/(w+1) (w aus Tabelle 4cb3:5331) sofort gewählt, sonst wird neu gewürfelt oder das Tor
 * bleibt ohne Schützen (Byte 34).
 */
export function creditAiGoals(g: GameState, club: number, goals: number, rng: Rng): void {
  if (goals === 0 || isManagerClub(g, club)) return;
  const candidates: number[] = [];
  for (let i = 1; i < 151; i++) {
    const p = g.players.at(i);
    if (p.u8(36) !== club) continue;
    if (rng(0, 100) < 94) {
      p.setU8(35, (p.u8(35) + 1) & 0xff);
      const limit = rng(10, 99);
      if (rng(5, 25) + p.u8(31) > limit) candidates.push(i);
    }
  }
  const n = candidates.length;
  if (n <= 1) return;
  let w = (SCORER_WEIGHT[Math.min(n, 9)] ?? 10) - 1;
  if (w > 2) w--;
  for (let goal = 0; goal < goals; goal++) {
    if (rng(0, 4) === 0) continue;
    for (;;) {
      if (rng(0, w) !== 0) {
        const idx = candidates[rng(0, n - 1)];
        const p = g.players.at(idx);
        p.setU8(34, (p.u8(34) + 1) & 0xff);
        break;
      }
      if (rng(0, 1) + 2 >= n) break;
    }
  }
}

/** Grundzuschlag des Vereins (Byte 23) nach einem Spiel: ± random(0, 2·|Differenz|), Bereich 47..53 (0x2C3FC). */
export function bookBaseBonus(g: GameState, club: number, goalDiff: number, rng: Rng): void {
  if (club > 63) return;
  const c = g.clubs.at(club);
  const r = rng(0, 2 * Math.abs(goalDiff));
  c.setU8(23, clamp(c.u8(23) + (goalDiff > 0 ? r : -r), 47, 53));
}

/** Ligaklasse eines Vereins für die Stärkebänder (0x197D5 >> 1). */
function bandOf(club: number): [number, number] {
  return BANDS[club < 18 ? 0 : club < 38 ? 1 : 2];
}

/**
 * Schwankung der Vereinsmatrix (0x10067) für alle Vereine 0..63. mode 1 an jedem Kalendertag,
 * mode 10 zu Spiel- und Saisonbeginn; bei mode ≠ 1 gilt ab dem zweiten Verein mode 3
 * (Eigenheit des Originals) und die Werte werden auf das Band der Ligaklasse begrenzt,
 * sonst auf 1..99. Je Verein a = random(0, 2·mode), dazu k = 3 bei mode 3, sonst 1 - für alle
 * drei Linien gleich (0x1007B setzt k ohne Linienzähler; bis #99 stand hier 2i + 1).
 * Kondition += random(0, 2(k + a)) - k - mode; Technik ebenso, bei mode 1 nur mit 1/3;
 * Form = Form + random(0,6) - 3, begrenzt auf 45..55.
 */
export function driftClubs(g: GameState, mode: number, rng: Rng): void {
  let m = mode;
  for (let club = 0; club < 64; club++) {
    const c = g.clubs.at(club);
    const a = rng(0, 2 * m);
    if (m !== 1) {
      c.setU8(33, c.u8(33) & 0x7f);
      m = 3;
    }
    const band = m === 3 ? bandOf(club) : [1, 99];
    const k = m === 3 ? 3 : 1;
    for (let i = 0; i < 3; i++) {
      const ko = c.u8(24 + i) + rng(0, 2 * (k + a)) - k - m;
      c.setU8(24 + i, clamp(ko, band[0], band[1]));
    }
    for (let i = 0; i < 3; i++) {
      let te = c.u8(27 + i);
      if (rng(0, 2) === 0 || m === 3) te += rng(0, 2 * (k + a)) - m - k;
      c.setU8(27 + i, clamp(te, band[0], band[1]));
    }
    for (let i = 0; i < 3; i++) c.setU8(30 + i, clamp(c.u8(30 + i) + rng(0, 6) - 3, 45, 55));
  }
}
