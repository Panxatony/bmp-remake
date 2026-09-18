/**
 * Bietgefecht um Marktspieler (nur Version 2026, sim/regeln.ts).
 *
 * Im Original entscheidet der abgebende Verein sofort über ein Gebot (0x248E1, aiAccepts): wer
 * zuerst klickt, bekommt den Spieler. In der Version 2026 läuft stattdessen eine Frist bis zum
 * nächsten Kalendertag, in der jeder Manager bieten und nachlegen darf. Beim Tageswechsel
 * bekommt das höchste Gebot den Zuschlag, sofern der abgebende Verein es überhaupt annimmt
 * (dieselbe Prüfung wie im Original). Bei gleichen Geboten gewinnt der schlechtere
 * Tabellenplatz.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { aiAccepts } from "./transfer.ts";

export interface Bid {
  manager: number;
  amount: number;
  /** Leihe statt Kauf */
  loan: boolean;
}

export interface AuctionResult {
  winner: Bid | null;
  /** Gebote, die der abgebende Verein abgelehnt hat (zu niedrig) */
  rejected: boolean;
}

/** Höchstes Gebot; bei Gleichstand der Verein mit dem schlechteren Tabellenplatz. */
export function highestBid(g: GameState, bids: Bid[]): Bid | null {
  let best: Bid | null = null;
  for (const b of bids) {
    if (b.amount <= 0) continue;
    if (!best || b.amount > best.amount) {
      best = b;
      continue;
    }
    if (b.amount === best.amount) {
      const platz = (m: number) => g.standings.at(g.managers.at(m).clubIndex).u8(46);
      if (platz(b.manager) > platz(best.manager)) best = b;
    }
  }
  return best;
}

/**
 * Betrag, den der abgebende Verein sicher annimmt. aiAccepts nimmt ein Gebot immer an, sobald es
 * einen gewürfelten Anteil von 120 bis 130 % des Werts erreicht - ab 130 % ist es also sicher.
 * Der Wert steht in der Absage, damit man weiß, wohin man beim nächsten Mal gehen muss (#19).
 */
export function sureBid(price: number): number {
  return Math.trunc((price * 130) / 100);
}

/** Auswertung beim Tageswechsel: höchstes Gebot, geprüft wie im Original. */
export function resolveAuction(g: GameState, price: number, bids: Bid[], rng: Rng): AuctionResult {
  const best = highestBid(g, bids);
  if (!best) return { winner: null, rejected: false };
  const preis = best.loan ? Math.trunc(price / 3) : price;
  if (!aiAccepts(preis, best.amount, rng)) return { winner: null, rejected: true };
  return { winner: best, rejected: false };
}
