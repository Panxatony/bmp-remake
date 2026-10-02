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
import { calendarFlag, dayIndex, FLAG_LEAGUE } from "./calendar.ts";
import { replays } from "./postpone.ts";
import { fixtures } from "./fixtures.ts";

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
 * `betrag`: der beim Anpfiff festgeschriebene Einsatz (derbyStake vor dem Spiel); ohne ihn gilt
 * der Stand jetzt. Mit Konferenz zählt der Anpfiff, sonst ließe sich der Einsatz während des
 * Spiels über Ausgaben drücken (AUDIT-2026 A30).
 * Liefert null, wenn nichts fließt (Unentschieden, kein Einsatz, kein Regelwerk 2026).
 */
export function playDerby(g: GameState, home: number, away: number, hg: number, ag: number, betrag?: number): DerbyResult | null {
  if (hg === ag || !is2026(g)) return null;
  const amount = betrag ?? derbyStake(g, home, away);
  if (amount <= 0) return null;
  const winner = hg > ag ? home : away;
  const loser = hg > ag ? away : home;
  const w = g.managers.at(winner);
  const l = g.managers.at(loser);
  w.balance = w.balance + amount;
  l.balance = l.balance - amount;
  return { winner, loser, amount };
}

/**
 * Derbys des aktuellen Kalendertags (Heimverein, Gastverein, Heimmanager, Gastmanager): die
 * Ligapaarungen des Tages und die Nachholspiele, die heute angesetzt sind - auch dort wird der
 * Einsatz gebucht (AUDIT-2026 A34/G12). Ob ein Spiel des Tages wegen Winterwetters verlegt wird,
 * entscheidet erst der Anpfiff; angekündigt wird es trotzdem.
 */
export function derbysHeute(g: GameState): [number, number, number, number][] {
  if (!is2026(g)) return [];
  const k = dayIndex(g);
  const heute = calendarFlag(g, k);
  const managerVon = new Map<number, number>();
  g.activeManagers().forEach((m, i) => managerVon.set(m.clubIndex, i));
  const paare: [number, number][] = [];
  for (let liga = 0; liga < 3; liga++) if (heute & FLAG_LEAGUE[liga]) paare.push(...g.pairings(liga));
  for (const e of replays(g)) {
    if (e.dayIndex !== k) continue;
    const paar = fixtures(e.league, e.matchday)[e.match];
    if (paar) paare.push(paar);
  }
  const out: [number, number, number, number][] = [];
  for (const [heim, gast] of paare) {
    const a = managerVon.get(heim);
    const b = managerVon.get(gast);
    if (a !== undefined && b !== undefined) out.push([heim, gast, a, b]);
  }
  return out;
}
