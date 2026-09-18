/**
 * Überschuldung (nur Version 2026, sim/regeln.ts).
 *
 * Im Original darf ein Verein beliebig tief ins Minus rutschen; teuer wird nur der Zins. Die
 * Version 2026 zieht eine Grenze: Steht ein Managerverein am Monatsende tiefer als eine
 * Million DM im Minus, verliert er drei Punkte in der Tabelle und darf einen Monat lang keine
 * Spieler kaufen, leihen oder abwerben.
 *
 * Die Kaufsperre steht als Bitmaske in Byte 34117 (Bit je Manager) und wird bei der nächsten
 * Monatsprüfung neu gesetzt - wer sein Konto ausgleicht, ist sie also nach einem Monat los.
 */
import type { GameState } from "../records.ts";
import { is2026 } from "./regeln.ts";

export const DEBT_LIMIT = -1_000_000;
export const DEBT_POINTS = 3;
export const BLOCK_OFFSET = 34117;

export function blockMask(g: GameState): number {
  return g.save.plain[BLOCK_OFFSET];
}

/** Kaufsperre eines Managers (Version 2026). */
export function isBlocked(g: GameState, manager: number): boolean {
  return is2026(g) && manager >= 0 && manager < 8 && (blockMask(g) & (1 << manager)) !== 0;
}

export function setBlocked(g: GameState, manager: number, on: boolean): void {
  if (manager < 0 || manager > 7) return;
  const bit = 1 << manager;
  g.save.plain[BLOCK_OFFSET] = on ? blockMask(g) | bit : blockMask(g) & ~bit & 0xff;
}

export interface DebtResult {
  manager: number;
  balance: number;
  /** tatsächlich abgezogene Punkte (nie unter null) */
  points: number;
}

/**
 * Monatsprüfung: jeder Managerverein unter der Grenze verliert Punkte und bekommt die
 * Kaufsperre, alle anderen sind sie los. Liefert die bestraften Manager.
 */
export function checkDebt(g: GameState): DebtResult[] {
  if (!is2026(g)) return [];
  const out: DebtResult[] = [];
  g.activeManagers().forEach((m, i) => {
    const balance = m.balance;
    if (balance >= DEBT_LIMIT) {
      setBlocked(g, i, false);
      return;
    }
    setBlocked(g, i, true);
    const s = g.standings.at(m.clubIndex);
    const vorher = s.u8(0) + s.u8(1);
    const abzug = Math.min(DEBT_POINTS, vorher);
    // Punkte hängen an Heim- und Auswärtszählern; abgezogen wird zuerst vom Heimkonto
    let rest = abzug;
    const heim = Math.min(rest, s.u8(0));
    s.setU8(0, s.u8(0) - heim);
    s.setU8(2, s.u8(0));
    rest -= heim;
    if (rest > 0) {
      s.setU8(1, s.u8(1) - rest);
      s.setU8(3, s.u8(1));
    }
    out.push({ manager: i, balance, points: abzug });
  });
  return out;
}
