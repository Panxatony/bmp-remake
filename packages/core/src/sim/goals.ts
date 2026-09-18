/**
 * Torschütze und Vorlagengeber eines Managervereins (Wahlfunktion 0x05D9A) und die
 * Buchung von Tor und Chance (0x1B223): Tore in Spieler Byte 34 und Kaderplatz Byte 3/4
 * sowie 16-Bit-Zähler bei 34/36, Spielbewertung in Byte 21 (+15 Tor, -10 vergebene
 * Chance; Gegner: Gegentor Torwart -8, Feldspieler -5; abgewehrte Chance Torwart +8,
 * Feldspieler -3). Siehe docs/SPIELMECHANIK.md.
 */
import type { GameState, Lineup, Player } from "../records.ts";
import type { Rng } from "./match.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

export function positionFit(l: Lineup, p: Player): number {
  return Math.abs(p.u8(32) - l.u8(25));
}

export function lineDist(l: Lineup, p: Player): number {
  return Math.abs(p.positionValue - (div((7 - l.fieldLine) * 75, 7) + 5));
}

/**
 * Wählt einen Starter (Nummer 1..11): Kandidaten werden zufällig gezogen und mit
 * random(0,3500) < Gewicht angenommen. mode 0 = Schütze/Chance, 1 = Vorlage;
 * flag = Ereignistyp (1 = Tor). Liefert den Index im Kader oder -1.
 */
export function pickPlayer(g: GameState, manager: number, mode: number, flag: number, rng: Rng): number {
  const squad = g.squadOf(manager);
  if (squad.length === 0) return -1;
  for (let tries = 0; tries < 2000; tries++) {
    const si = rng(0, squad.length - 1);
    const l = squad[si];
    if (l.number < 1 || l.number > 11) continue;
    const p = g.players.at(l.playerIndex);
    let w: number;
    if (mode !== 0 || flag !== 0) w = div(3 * l.u8(17), 5 - 3 * mode) + div(l.u8(16), 5) + div(l.u8(18), 5);
    else w = rng(120, 170);
    w += div(p.u8(31), 25) * (6 - mode) * 7;
    w += 46 * l.u8(3);
    const line = Math.abs(l.fieldLine);
    w += (mode >= 1 ? 300 : 0) + (7 - line) * 200;
    if (line < 2) w += 1200;
    w += 5 * (Math.abs(l.u8(19) - 3) - 2 * (mode >= 1 ? 1 : 0));
    if (mode !== 0 || flag !== 0) w += 5 * (5 - positionFit(l, p)) + (35 - lineDist(l, p));
    else w += 5 * positionFit(l, p) + lineDist(l, p);
    let ok = rng(0, 3500) < w;
    if (p.u8(31) === 0 && rng(0, 20) !== 0) ok = false;
    if (ok) return si;
  }
  return -1;
}

function addRating(l: Lineup, delta: number): void {
  let v = l.u8(21);
  if (v > 127) v -= 256;
  v = Math.max(-128, Math.min(127, v + delta));
  l.setU8(21, v & 0xff);
}

export interface GoalRecord {
  scorer: number;
  assist: number;
  scorerName: string;
}

/** Tor eines Managervereins buchen (matchType 0 Liga, 1 Pokal). */
export function bookGoal(g: GameState, manager: number, matchType: number, rng: Rng): GoalRecord | null {
  const squad = g.squadOf(manager);
  const scorer = pickPlayer(g, manager, 0, 1, rng);
  if (scorer < 0) return null;
  let assist = -1;
  const starters = squad.filter((l) => l.number >= 1 && l.number <= 11).length;
  if (starters > 1) {
    do assist = pickPlayer(g, manager, 1, 1, rng);
    while (assist === scorer && assist >= 0);
  }
  const l = squad[scorer];
  const p = g.players.at(l.playerIndex);
  if (matchType === 0) p.setU8(34, p.u8(34) + 1);
  if (matchType <= 1) {
    l.setU8(3 + matchType, l.u8(3 + matchType) + 1);
    const o = 34 + 2 * matchType;
    const v = (l.u8(o) | (l.u8(o + 1) << 8)) + 1;
    l.setU8(o, v & 0xff);
    l.setU8(o + 1, (v >> 8) & 0xff);
  }
  addRating(l, 15);
  return { scorer, assist, scorerName: p.displayName };
}

/** Vergebene Chance eines Managervereins: Bewertung des gewählten Spielers -10. */
export function bookMissedChance(g: GameState, manager: number, rng: Rng): number {
  const i = pickPlayer(g, manager, 0, 0, rng);
  if (i >= 0) addRating(g.squadOf(manager)[i], -10);
  return i;
}

/** Bewertung der Starter des verteidigenden Managervereins nach Gegentor (goal) oder abgewehrter Chance. */
export function bookDefence(g: GameState, manager: number, goal: boolean): void {
  for (const l of g.squadOf(manager)) {
    if (l.number < 1 || l.number > 11) continue;
    const gk = g.players.at(l.playerIndex).u8(31) === 0;
    if (goal) addRating(l, gk ? -8 : -5);
    else addRating(l, gk ? 8 : -3);
  }
}
