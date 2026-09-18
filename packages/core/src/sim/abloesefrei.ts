/**
 * Ablösefreie Spieler am Saisonende (nur Version 2026, sim/regeln.ts).
 *
 * Im Original geht ein Spieler mit abgelaufenem Vertrag weg und der Verein bekommt den halben
 * Marktwert (0x0DB40, sim/seasonEvents.ts). In der Version 2026 gibt es dafür nichts: der
 * Spieler ist ablösefrei und steht allen Managern offen. Jeder darf ein Monatsgehalt bieten;
 * den Zuschlag bekommt das beste Angebot, wobei ein höher spielender Verein zählt, als hätte er
 * zehn Prozent mehr geboten. Bei gleichem Wert entscheidet der schlechtere Tabellenplatz - der
 * Kleine bekommt den Spieler.
 */
import type { GameState } from "../records.ts";
import { LEAGUES } from "./fixtures.ts";

export interface FreeAgent {
  /** Spielerdatensatz */
  playerIndex: number;
  name: string;
  position: string;
  age: number;
  strength: number[];
  /** bisheriger Verein (Managerindex) */
  from: number;
  /** bisheriges Monatsgehalt */
  salary: number;
  /** Marktwert zum Zeitpunkt des Abgangs */
  value: number;
}

export interface FreeBid {
  manager: number;
  /** gebotenes Monatsgehalt */
  salary: number;
}

function leagueOf(club: number): number {
  for (let i = LEAGUES.length - 1; i >= 0; i--) if (club >= LEAGUES[i].base) return i;
  return 0;
}

/** Bewertung eines Angebots: Gehalt, dazu zehn Prozent je Ligastufe nach oben. */
export function bidScore(g: GameState, bid: FreeBid): number {
  const club = g.managers.at(bid.manager).clubIndex;
  const liga = leagueOf(club);
  return Math.trunc((bid.salary * (100 + 10 * (2 - liga))) / 100);
}

/** Zuschlag: bestes Angebot, bei Gleichstand der schlechtere Tabellenplatz. */
export function bestBid(g: GameState, bids: FreeBid[]): FreeBid | null {
  let best: FreeBid | null = null;
  let bestScore = -1;
  for (const b of bids) {
    if (b.salary <= 0) continue;
    const s = bidScore(g, b);
    if (s > bestScore) {
      best = b;
      bestScore = s;
      continue;
    }
    if (s === bestScore && best) {
      const platz = (m: number) => g.standings.at(g.managers.at(m).clubIndex).u8(46);
      if (platz(b.manager) > platz(best.manager)) best = b;
    }
  }
  return best;
}
