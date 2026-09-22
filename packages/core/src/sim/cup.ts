/**
 * DFB-Pokal: Spieltag über die gemeinsamen Pokalroutinen in europa.ts (Auslosung 0x18600 /
 * 0x18FC2, Rundenabschluss 0x192FC, Verlängerung 0x18E46, Elfmeterschießen 0x666D).
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "DFB-Pokal".
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { CUP_TABLE, CUP_ROUND, ROUND_PAIRS, playCupMatch, afterCupDay, type CupMatch, type CupFinal, type NachspielQuelle } from "./europa.ts";
import { seasonDay, dayIndex } from "./calendar.ts";
import type { MatchSim } from "./live.ts";

export { CUP_TABLE, CUP_OUT, extraTime, shootout, type CupMatch } from "./europa.ts";

/** Laufende Pokalrunde 0-basiert (Rundenbyte 28233 minus 1); der Tagindex bleibt aus Kompatibilität. */
export function cupRound(g: GameState, _k?: number): number {
  return Math.max(0, g.save.plain[CUP_ROUND] - 1);
}

export function cupPairs(g: GameState, round: number): [number, number][] {
  const n = ROUND_PAIRS[Math.min(round + 1, 5)];
  const p = g.save.plain;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([p[CUP_TABLE + 2 * i], p[CUP_TABLE + 2 * i + 1]]);
  return out;
}

/** Spielt die anstehende DFB-Pokalrunde, setzt Managerrunden und lost die nächste Runde. */
export function playCupDay(g: GameState, rng: Rng, sim?: MatchSim, zuschauer?: (home: number, away: number) => number | undefined, nachspiel?: NachspielQuelle, vorbereitet = false): CupMatch[] & { finals?: CupFinal[]; gezogen?: number[] } {
  const day = seasonDay(dayIndex(g));
  const n = ROUND_PAIRS[Math.min(g.save.plain[CUP_ROUND], 5)];
  const out: CupMatch[] & { finals?: CupFinal[]; gezogen?: number[] } = [];
  for (let i = 0; i < n; i++) out.push(playCupMatch(g, 0, 2 * i, false, day, rng, sim, zuschauer, nachspiel, vorbereitet));
  // gezogen: [0], wenn danach die nächste Runde ausgelost wurde - nach dem Finale bleibt es leer
  out.gezogen = [];
  out.finals = afterCupDay(g, [0], day, rng, false, out.gezogen);
  return out;
}
