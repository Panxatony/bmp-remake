/**
 * Derby-Einsatz (nur Version 2026, sim/regeln.ts).
 *
 * Treffen zwei Managervereine aufeinander, geht es um Geld. Jeder Manager stellt vorher seinen
 * Einsatz ein (50.000, 100.000, 250.000 oder 500.000 DM), ohne den des anderen zu kennen;
 * gespielt wird um den **kleineren** der beiden Beträge. Der Sieger bekommt ihn vom Verlierer,
 * bei einem Unentschieden passiert nichts. Wer hoch pokert, gewinnt also nur, wenn der andere
 * mitgeht - aussteigen kann niemand: 50.000 DM sind der Mindesteinsatz (Entscheidung vom
 * 16.9.2026, davor ging auch "kein Einsatz" und dann blieb das Derby wirkungslos).
 *
 * Der eingestellte Einsatz steht je Manager in Byte 34118 + Manager (Stufe 0..3).
 */
import type { GameState } from "../records.ts";
import { is2026 } from "./regeln.ts";

export const DERBY_OFFSET = 34118;
export const DERBY_STAKES = [50_000, 100_000, 250_000, 500_000];

export function stakeLevel(g: GameState, manager: number): number {
  if (manager < 0 || manager > 3) return 0;
  const v = g.save.plain[DERBY_OFFSET + manager];
  return v >= 0 && v < DERBY_STAKES.length ? v : 0;
}

export function setStakeLevel(g: GameState, manager: number, level: number): void {
  if (manager < 0 || manager > 3) return;
  g.save.plain[DERBY_OFFSET + manager] = Math.max(0, Math.min(DERBY_STAKES.length - 1, Math.trunc(level)));
}

export function stakeOf(g: GameState, manager: number): number {
  return DERBY_STAKES[stakeLevel(g, manager)];
}

/** Der Einsatz eines Derbys: der kleinere der beiden Beträge, höchstens das Guthaben beider. */
export function derbyStake(g: GameState, a: number, b: number): number {
  if (!is2026(g)) return 0;
  const betrag = Math.min(stakeOf(g, a), stakeOf(g, b));
  if (betrag <= 0) return 0;
  const kasse = Math.min(g.managers.at(a).balance, g.managers.at(b).balance);
  return Math.max(0, Math.min(betrag, kasse));
}

export interface DerbyResult {
  winner: number;
  loser: number;
  amount: number;
}

/**
 * Ein Spiel zwischen zwei Managervereinen abrechnen. `hg`/`ag` sind die Tore von Heim und Gast.
 * Liefert null, wenn nichts fließt (Unentschieden, kein Einsatz, kein Regelwerk 2026).
 */
export function playDerby(g: GameState, home: number, away: number, hg: number, ag: number): DerbyResult | null {
  if (hg === ag) return null;
  const amount = derbyStake(g, home, away);
  if (amount <= 0) return null;
  const winner = hg > ag ? home : away;
  const loser = hg > ag ? away : home;
  const w = g.managers.at(winner);
  const l = g.managers.at(loser);
  w.balance = w.balance + amount;
  l.balance = l.balance - amount;
  return { winner, loser, amount };
}
