/**
 * Schrittweise Spielsimulation für die Live-Konferenz (Live-Schleife 0x05404): die
 * Chancenminuten einer Halbzeit werden zu deren Beginn gewürfelt (0x102BA), in jeder
 * Chancenminute entscheidet der Torwürfel (0x1060C) mit den dann gültigen Stärken. Ohne
 * Stärkeänderung entsteht dieselbe Zufallsfolge wie in simulateMatch. Auswechslungen
 * ändern die Stärke einer Seite ab der nächsten Minute (Kaderbildschirm mit Spielweg,
 * 0x21190). Auswechselgrenzen wie im Original (4238:5396): ein Torwart, zwei Feldspieler.
 */
import { chanceCounts, chanceMinutes, goalDice, type MatchEvent, type MatchResult, type Rng, type TeamStrength } from "./match.ts";

export interface LiveChance {
  minute: number;
  side: "home" | "away";
  goal: boolean;
}

export const SUBSTITUTIONS = { goalkeeper: 1, field: 2 } as const;

export class LiveMatch {
  minute = 0;
  hg = 0;
  ag = 0;
  events: MatchEvent[] = [];
  private pending: { minute: number; side: "home" | "away" }[] = [];

  home: TeamStrength;
  away: TeamStrength;
  private rng: Rng;
  readonly halves: readonly (readonly [number, number])[];

  constructor(home: TeamStrength, away: TeamStrength, rng: Rng, halves: readonly (readonly [number, number])[] = [[1, 45], [46, 90]]) {
    this.home = home;
    this.away = away;
    this.rng = rng;
    this.halves = halves;
  }

  get finished(): boolean {
    return this.minute >= this.halves[this.halves.length - 1][1];
  }

  /** Eine Minute weiter; liefert die Chancen dieser Minute (Heim vor Gast wie im Original). */
  step(): LiveChance[] {
    if (this.finished) return [];
    this.minute++;
    for (const [from, to] of this.halves) {
      if (this.minute !== from) continue;
      const n = chanceCounts(this.home, this.away, from, to, this.rng);
      for (const m of chanceMinutes(n.home, from, to, this.rng)) this.pending.push({ minute: m, side: "home" });
      for (const m of chanceMinutes(n.away, from, to, this.rng)) this.pending.push({ minute: m, side: "away" });
      this.pending.sort((a, b) => a.minute - b.minute || (a.side === "home" ? -1 : 1));
    }
    const out: LiveChance[] = [];
    while (this.pending.length && this.pending[0].minute === this.minute) {
      const c = this.pending.shift()!;
      const goal = goalDice(this.home, this.away, c.side, this.minute, this.hg, this.ag, this.rng);
      if (goal) c.side === "home" ? this.hg++ : this.ag++;
      this.events.push({ minute: this.minute, side: c.side, goal });
      out.push({ minute: this.minute, side: c.side, goal });
    }
    return out;
  }

  result(): MatchResult {
    return { home: this.hg, away: this.ag, events: this.events.slice() };
  }
}

/** Ergebnislieferant für die Buchungsroutinen: liefert ein vorher live gespieltes Ergebnis. */
export type MatchSim = (home: number, away: number, hs: TeamStrength, as: TeamStrength, rng: Rng) => MatchResult;
