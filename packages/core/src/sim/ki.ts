/**
 * Aufhören und den Verein dem Rechner überlassen.
 *
 * Im Original öffnet ein Rechtsklick auf das Managersymbol rechts unten im Hauptmenü die
 * Rückfrage "M|CHTEN SIE / DAS SPIEL WIRKLICH / BEENDEN ?" (0x0A7DD mit dem Fensterrahmen
 * 0x6c7:0xa7 an 266,196 und den Knöpfen LEIDER JA / KEIN GEDANKE); wer bestätigt, beendet das
 * Programm (exit 99). Im Remake spielen mehrere Menschen denselben Spielstand, deshalb steigt
 * nur dieser eine Manager aus: sein Platz wird frei und der Rechner führt seinen Verein weiter.
 * Er bleibt ein Managerverein mit Kader, Konto und Stadion - nur bedient ihn niemand mehr.
 *
 * Gespeichert steht das als Bitmaske in Byte 34116 (Bit je Manager). Die Stelle liegt im selben
 * ungenutzten Bereich wie das Regelbyte (sim/regeln.ts) und ist in allen vorliegenden
 * Spielständen des Originals 0. Das gilt für beide Regelwerke.
 */
import type { GameState } from "../records.ts";

export const AI_OFFSET = 34116;

/** Bitmaske der vom Rechner geführten Manager. */
export function aiMask(g: GameState): number {
  return g.save.plain[AI_OFFSET];
}

export function isAi(g: GameState, manager: number): boolean {
  return manager >= 0 && manager < 8 && (aiMask(g) & (1 << manager)) !== 0;
}

/** Manager an den Rechner übergeben oder wieder freigeben. */
export function setAi(g: GameState, manager: number, on: boolean): void {
  if (manager < 0 || manager > 7) return;
  const bit = 1 << manager;
  g.save.plain[AI_OFFSET] = on ? aiMask(g) | bit : aiMask(g) & ~bit & 0xff;
}

/** Alle vom Rechner geführten Manager. */
export function aiList(g: GameState): number[] {
  return g.activeManagers().map((_, i) => i).filter((i) => isAi(g, i));
}
