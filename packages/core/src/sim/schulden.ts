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
 *
 * Abgezogen wird nie unter null. Was nicht abgezogen werden konnte - am 30.6. sind die Tabellen
 * schon geleert, am 31.7. steht höchstens ein Spieltag darin -, wird vorgetragen (Byte 34130 +
 * Manager) und bei den nächsten Monatsprüfungen nachgeholt (AUDIT-2026 B24, #154).
 */
import type { GameState } from "../records.ts";
import { is2026 } from "./regeln.ts";

export const DEBT_LIMIT = -1_000_000;
export const DEBT_POINTS = 3;
export const BLOCK_OFFSET = 34117;
/** Vorgetragener Punktabzug je Manager 0..3 (Version 2026, AUDIT-2026 B24). */
export const DEBT_CARRY_OFFSET = 34130;

/** Noch nicht abgezogene Punkte wegen Schulden (Version 2026). */
export function debtCarry(g: GameState, manager: number): number {
  return is2026(g) && manager >= 0 && manager < 4 ? g.save.plain[DEBT_CARRY_OFFSET + manager] : 0;
}

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
  /** tatsächlich abgezogene Punkte (nie unter null), vorgetragene eingeschlossen */
  points: number;
  /** Konto unter der Grenze: Kaufsperre für einen Monat (fehlt = ja) */
  gesperrt?: boolean;
  /** Punkte, die mangels Punkten noch offen bleiben und vorgetragen werden (AUDIT-2026 B24) */
  offen?: number;
}

/**
 * Monatsprüfung: jeder Managerverein unter der Grenze verliert Punkte und bekommt die
 * Kaufsperre, alle anderen sind sie los. Ein vorgetragener Abzug kommt dazu, auch ohne neue
 * Schulden. Liefert die bestraften Manager und die, bei denen ein Abzug nachgeholt wurde.
 */
export function checkDebt(g: GameState): DebtResult[] {
  if (!is2026(g)) return [];
  const out: DebtResult[] = [];
  g.activeManagers().forEach((m, i) => {
    const balance = m.balance;
    const ueber = balance < DEBT_LIMIT;
    setBlocked(g, i, ueber);
    const faellig = debtCarry(g, i) + (ueber ? DEBT_POINTS : 0);
    if (faellig === 0) return;
    const s = g.standings.at(m.clubIndex);
    const vorher = s.u8(0) + s.u8(1);
    const abzug = Math.min(faellig, vorher);
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
    const offen = Math.min(255, faellig - abzug);
    if (i < 4) g.save.plain[DEBT_CARRY_OFFSET + i] = offen;
    if (ueber || abzug > 0) out.push({ manager: i, balance, points: abzug, gesperrt: ueber, offen });
  });
  return out;
}

/**
 * Meldungen zum Monatsletzten im Minus: an den Manager selbst und an alle anderen. Ohne Punkte
 * (am 30.6. sind die Tabellen schon geleert, oder der Verein hat noch keine) bleibt nur die
 * Kaufsperre - keine Meldung "0 Punkte Abzug" (AUDIT-2026 A34/G10); der Abzug wird vorgetragen und
 * später nachgeholt, mit eigener Meldung (AUDIT-2026 B24).
 */
export function debtMessages(d: DebtResult, name: string): { own: string[]; others: string[] } {
  const offen = d.offen ?? 0;
  // Nur nachgeholt, das Konto steht wieder über der Grenze (AUDIT-2026 B24)
  if (d.gesperrt === false) return { own: ["Nachgeholter Abzug", `wegen Schulden: ${d.points}`, d.points === 1 ? "Punkt." : "Punkte."], others: [`${name} verliert`, `nachtr{glich ${d.points} ${d.points === 1 ? "Punkt" : "Punkte"}`, "wegen Schulden."] };
  if (d.points > 0 && offen > 0) return { own: ["Ihr Konto ist zu tief", "im Minus: " + d.points + " Punkte", `Abzug, ${offen} folgen.`, "Ein Monat Kaufsperre."], others: [`${name} bekommt`, `${d.points} Punkte Abzug`, "wegen Schulden."] };
  if (d.points > 0) return { own: ["Ihr Konto ist zu tief", "im Minus: " + d.points + " Punkte", "Abzug, ein Monat", "keine Eink{ufe."], others: [`${name} bekommt`, `${d.points} Punkte Abzug`, "wegen Schulden."] };
  if (offen > 0) return { own: ["Ihr Konto ist zu tief", "im Minus: ein Monat", "keine Eink{ufe. Der", `Abzug (${offen}) folgt.`], others: [`${name} bekommt`, "einen Monat Kaufsperre", "wegen Schulden."] };
  return { own: ["Ihr Konto ist zu tief", "im Minus: ein Monat", "keine Eink{ufe."], others: [`${name} bekommt`, "einen Monat Kaufsperre", "wegen Schulden."] };
}
