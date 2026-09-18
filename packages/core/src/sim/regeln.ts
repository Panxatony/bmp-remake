/**
 * Regelwerk eines Spielstands.
 *
 * Das Original spielt nach den Regeln seiner Zeit: zwei Punkte für einen Sieg und drei
 * Auswechslungen, davon höchstens eine im Tor. "Version 2026" behält Vereine, Spieler und
 * Wappen des Originals, spielt aber nach den heutigen Regeln. Gewählt wird beim neuen Spiel,
 * danach gilt die Wahl für den ganzen Spielstand.
 *
 * Gespeichert steht sie in Byte 34099. Die Stelle gehört zu keiner der bekannten Tabellen und
 * ist in allen 40 vorliegenden Spielständen des Originals 0 - ein Stand des Originals wird
 * deshalb immer als Original gelesen.
 */
import type { GameState } from "../records.ts";

export const RULES_OFFSET = 34099;
export const RULES_ORIGINAL = 0;
export const RULES_2026 = 1;

export interface SubstitutionLimits {
  /** Höchstzahl Torwartwechsel */
  goalkeeper: number;
  /** Höchstzahl Feldspielerwechsel */
  field: number;
  /** Höchstzahl aller Wechsel zusammen */
  total: number;
}

export function ruleSet(g: GameState): number {
  return g.save.plain[RULES_OFFSET] === RULES_2026 ? RULES_2026 : RULES_ORIGINAL;
}

export function setRuleSet(g: GameState, v: number): void {
  g.save.plain[RULES_OFFSET] = v === RULES_2026 ? RULES_2026 : RULES_ORIGINAL;
}

export function is2026(g: GameState): boolean {
  return ruleSet(g) === RULES_2026;
}

/** Punkte für einen Sieg: zwei im Original, drei ab der Version 2026 (Bundesliga seit 1995). */
export function winPoints(g: GameState): number {
  return is2026(g) ? 3 : 2;
}

/**
 * Auswechslungen je Spiel: im Original ein Torwart und zwei Feldspieler (Zähler 4238:5396/5397),
 * in der Version 2026 fünf Wechsel ohne Rücksicht auf die Position (Regel seit 2020).
 */
export function substitutionLimits(g: GameState): SubstitutionLimits {
  return is2026(g) ? { goalkeeper: 5, field: 5, total: 5 } : { goalkeeper: 1, field: 2, total: 3 };
}

/** Name des Regelwerks für Anzeigen. */
export function ruleName(g: GameState): string {
  return is2026(g) ? "VERSION 2026" : "ORIGINAL";
}
