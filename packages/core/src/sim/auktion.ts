/**
 * Bietgefecht um Marktspieler (nur Version 2026, sim/regeln.ts).
 *
 * Im Original entscheidet der abgebende Verein sofort über ein Gebot (0x248E1, aiAccepts): wer
 * zuerst klickt, bekommt den Spieler. In der Version 2026 läuft stattdessen eine Frist bis zum
 * nächsten Kalendertag, in der jeder Manager bieten und nachlegen darf. Beim Tageswechsel
 * bekommt das höchste Gebot den Zuschlag, sofern der abgebende Verein es überhaupt annimmt
 * (dieselbe Prüfung wie im Original). Bei gleichen Geboten gewinnt der schwächere Verein: erst
 * die niedrigere Liga, dann der schlechtere Tabellenplatz (AUDIT-2026 B17).
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { aiAccepts, completeLoan, completePurchase, MARKET_MANAGER } from "./transfer.ts";
import { salaryDemand } from "./contracts.ts";
import { sponsorSubsidy } from "./finance.ts";
import { tabellenRang } from "./abwerben.ts";

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

/**
 * Höchstes Gebot; bei Gleichstand der schwächere Verein - erst die niedrigere Liga, dann der
 * schlechtere Platz (AUDIT-2026 B17). Bis dahin zählte nur der Platz innerhalb der Liga, und ein
 * Bundesliga-Zehnter schlug einen Zweitliga-Fünften.
 */
export function highestBid(g: GameState, bids: Bid[]): Bid | null {
  let best: Bid | null = null;
  for (const b of bids) {
    if (b.amount <= 0) continue;
    if (!best || b.amount > best.amount) {
      best = b;
      continue;
    }
    if (b.amount === best.amount && tabellenRang(g, b.manager) > tabellenRang(g, best.manager)) best = b;
  }
  return best;
}

/**
 * Gebote in der Reihenfolge, in der sie zum Zug kämen: nach Betrag, bei Gleichstand der
 * schlechtere Tabellenplatz zuerst - wie highestBid. Die Anzeige "VORN" nennt damit denselben
 * Manager, der den Zuschlag bekäme (AUDIT-2026 A34/Q5).
 */
export function bidOrder(g: GameState, bids: Bid[]): Bid[] {
  return bids.slice().sort((x, y) => y.amount - x.amount || tabellenRang(g, y.manager) - tabellenRang(g, x.manager));
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

export interface Zuschlag {
  /** neuer Kaderplatz, -1 wenn der Wechsel nicht zustande kam */
  platz: number;
  /** Monatsgehalt beim Kauf (Leihe: 0, das Gehalt setzt completeLoan) */
  gehalt: number;
  /** Angebot eines Sponsor-Zuschusses (0 = keins) */
  zuschuss: number;
}

/**
 * Zuschlag für einen Marktspieler des Rechners vollziehen: ein Kauf über zwei Jahre zur üblichen
 * Forderung ohne Verhandlung, oder eine Leihe. Danach der Sponsor-Zuschuss wie beim Kauf und bei
 * der Leihe vom Rechner (0x240E1 -> 0x272D, Audit 2 E23; AUDIT-2026 B16). Eine Rückennummer
 * gibt es wie nach jedem Kauf nicht (B15). Geld und Kaderplatz prüft der Aufrufer.
 */
export function zuschlagVollziehen(g: GameState, w: Bid, slot: number, rng: Rng): Zuschlag {
  let frei = 0;
  while (frei < 24 && !g.lineups.at(w.manager * 25 + frei).isEmpty) frei++;
  let platz: number;
  let gehalt = 0;
  if (w.loan) platz = completeLoan(g, w.manager, slot, w.amount, MARKET_MANAGER, rng);
  else {
    gehalt = salaryDemand(g, w.manager, frei, 2, { manager: MARKET_MANAGER, place: slot });
    platz = completePurchase(g, w.manager, slot, w.amount, 2, gehalt, rng);
  }
  if (platz < 0) return { platz, gehalt, zuschuss: 0 };
  return { platz, gehalt, zuschuss: sponsorSubsidy(w.amount, rng) };
}
