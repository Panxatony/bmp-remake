/**
 * Monatliche Einnahmen (0x17076) und Ausgaben (0x17262) eines Managers, wie sie der
 * Statistik-Bildschirm zeigt, sowie Kreditzinsen (0x1222D). Siehe docs/SPIELMECHANIK.md.
 */
import type { GameState } from "../records.ts";
import { texte } from "../data/texte.ts";
import { is2026 } from "./regeln.ts";
import type { Rng } from "./match.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
import { ADV_OFFSET, monthlyAdvertising } from "./werbung.ts";
/** Transfermarkt = Kaderplätze 100..124 (4238:8B9A) */
const MARKET_FIRST = 100;

function advertising(g: GameState, manager: number, i: number): number {
  const o = ADV_OFFSET + manager * 36 + 4 * i;
  const p = g.save.plain;
  return (p[o] | (p[o + 1] << 8) | (p[o + 2] << 16) | (p[o + 3] << 24)) | 0;
}

/** Summe der Kreditzinsen je Monat (interest = true) oder der Kreditsummen aller Geldgeber. */
export function loanTotal(g: GameState, manager: number, interest: boolean): number {
  let sum = 0;
  for (let lender = 0; lender < 5; lender++) sum += lenderDebt(g, manager, lender, interest);
  return sum;
}

/**
 * Schulden (oder Zinsen je Monat) eines Managers bei einem einzelnen Geldgeber; das Original
 * ruft dieselbe Routine 0x1222D mit der Geldgebernummer auf (99 = alle) und zeigt sie im
 * Bankbildschirm als "SCHULDEN HIER" bzw. "ZINSEN HIER".
 */
export function lenderDebt(g: GameState, manager: number, lender: number, interest = false): number {
  const m = g.managers.at(manager);
  let sum = 0;
  for (let slot = 0; slot < 3; slot++) {
    const o = 508 + (lender * 3 + slot) * 18;
    const amount = m.i32(o);
    if (amount === 0) continue;
    sum += interest ? m.i32(o + 4) : amount;
  }
  return sum;
}

function marketEntries(g: GameState) {
  const out = [];
  for (let i = MARKET_FIRST; i < MARKET_FIRST + 25; i++) {
    const l = g.lineups.at(i);
    if (!l.isEmpty) out.push(l);
  }
  return out;
}

/** Monatseinnahmen; schreibt den Grundwert nach Manager Byte 480 wie das Original. */
export function monthlyIncome(g: GameState, manager: number, dayOfMonth: number): number {
  const m = g.managers.at(manager);
  const club = g.clubs.at(m.clubIndex);
  const count = g.squadOf(manager).length;
  let s = 0;
  for (let l = 0; l < 3; l++) s += club.u8(24 + l) + club.u8(27 + l);
  let q = div(s * 15 * count, 3);
  const fans = m.u8(476) | (m.u8(477) << 8);
  q += div(fans, 5) + 25;
  m.setU8(480, q & 0xff);
  m.setU8(481, (q >> 8) & 0xff);
  let income = q;
  for (let i = 0; i < 8; i++) income += advertising(g, manager, i);
  const n = g.activeManagers().length;
  for (let other = 0; other < n; other++) if (other !== manager) income += loanTotal(g, other, true);
  void dayOfMonth; // Zuschuss (4cb3:0644) liegt nicht im Spielstand
  return income < 0 ? 0 : income;
}

/** Monatsausgaben: Grundkosten, Gehälter, Stadion, Trainer, Jugend, Werbung, Zinsen, Steuer. */
export function monthlyExpenses(g: GameState, manager: number): number {
  const m = g.managers.at(manager);
  let e = 150000;
  for (const l of g.squadOf(manager)) e += l.i32(40);
  for (const l of marketEntries(g)) if (g.players.at(l.playerIndex).u8(33) === manager) e += l.i32(40);
  const league = m.u8(312);
  const t = 3000 * m.i32(398);
  const u = 1375 * (m.i32(374) + m.i32(382));
  let w = (3 - league) * 43750 + u + t + m.i32(350);
  w = 2 * w + m.i32(358);
  w = 2 * w + m.i32(366);
  e += w;
  e += m.u8(478) | (m.u8(479) << 8);
  e += (10000 * (m.u8(319) + 1)) >> 4;
  e += advertising(g, manager, 8);
  e += loanTotal(g, manager, true);
  const balance = m.i32(496);
  if (league !== 2 && balance > 2000000) {
    let tax = 30000 * div(balance - 2000000, 500000) + 20000;
    if (balance >= 4000000) tax = div(3 * tax, 2);
    e += tax;
  }
  return e < 0 ? 0 : e;
}

/** Monatsabrechnung: Einnahmen minus Ausgaben auf den Kontostand (Byte 496). */
export function bookMonth(g: GameState, manager: number, dayOfMonth: number): { income: number; expenses: number } {
  const income = monthlyIncome(g, manager, dayOfMonth);
  const expenses = monthlyExpenses(g, manager);
  const m = g.managers.at(manager);
  const v = m.i32(496) + income - expenses;
  for (let i = 0; i < 4; i++) m.setU8(496 + i, (v >>> (8 * i)) & 0xff);
  return { income, expenses };
}

/** Version 2026: höchstes Guthaben, das noch Zinsen bringt. */
export const INTEREST_CAP = 2_000_000;

/** Monatslängen (4cb3:07B8), 0-basierter Monat. */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function writeI32(g: GameState, manager: number, off: number, v: number): void {
  const m = g.managers.at(manager);
  for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff);
}

/** Nach einem Heimspiel (0x1CEA7): Krawall-Flag (Byte 318 Bit 0) mit 1/(4x+16), x = 30 - clamp((Steh - Sitz)/1000, 0, 30). */
export function riotCheck(g: GameState, manager: number, rng: Rng): boolean {
  const m = g.managers.at(manager);
  let x = div(m.i32(358) - m.i32(350), 1000);
  x = Math.max(0, Math.min(30, x));
  x = 30 - x;
  if (rng(0, 4 * x + 15) !== 0) return false;
  m.setU8(318, m.u8(318) | 1);
  return true;
}

export interface FinanceEvent {
  kind: "riot" | "interest" | "repaid" | "month" | "fans" | "komfort";
  text: string;
  amount?: number;
}

/**
 * Tägliche Finanzroutine je Manager (0x11D0D und Krawall aus 0x0DF0D): Krawallschaden,
 * Kreditzinsen am Fälligkeitstag, Rückzahlung im Fälligkeitsmonat, am Monatsende
 * Jugendkonto, Guthaben-/Überziehungszins, Einnahmen und Ausgaben, Fanwachstum.
 */
/** Tagessumme des Kontostands je Manager (4cb3:0644, nicht im Spielstand) für den Guthabenzins. */
export interface BalanceSum {
  sum: number;
}

/**
 * `tagesroutine`: Krawallschaden und Komfortabnutzung stammen aus der Tagesroutine 0x0DF0D, und
 * die entfällt ab Saisontag 322 ganz (0x0DF4F). Der Aufrufer sagt, ob sie an diesem Tag läuft;
 * Kredite und Monatsabrechnung (0x11D0D) laufen immer (GitLab #83, F6).
 */
export function dailyFinance(g: GameState, manager: number, date: { day: number; month0: number; year: number }, rng: Rng, acc?: BalanceSum, tagesroutine = true): FinanceEvent[] {
  const m = g.managers.at(manager);
  const events: FinanceEvent[] = [];
  const daysInMonth = DAYS_IN_MONTH[date.month0];
  const fester = is2026(g);
  if (acc) acc.sum += m.i32(496);

  if (tagesroutine && m.u8(318) & 1) {
    // 0xE29B: Stehplätze mal vier (die Hilfsroutine 0x3BBC8 schiebt nach links), Sitzplätze
    // halbiert (sar/rcr bei 0xE2C6), das Ganze mal random(2,5) und auf 1000 abgerundet
    let damage = (m.i32(358) * 4 + (m.i32(350) >> 1)) * rng(2, 5);
    damage = div(damage, 1000) * 1000;
    writeI32(g, manager, 496, m.i32(496) - damage);
    m.setU8(318, m.u8(318) & ~1);
    events.push({ kind: "riot", text: `${texte("ui.randale").join(" ")}${damage} DM an.`, amount: damage });
    // Danach leidet das Stadion (0x0E3BC bis 0x0E41F): Komfortnote 390 sinkt um eins, solange
    // sie über 1 liegt - mit einem Drittel, und wer nach dem Schaden noch mehr als 2 Mio. DM
    // hat, bekommt vorher einen zweiten Wurf mit der Hälfte (zusammen zwei Drittel). Fehlte
    // bis GitLab #83 (F1).
    if (m.i32(390) > 1) {
      const trifft = (m.i32(496) > 2000000 && rng(0, 1) === 0) || rng(0, 2) === 0;
      if (trifft) writeI32(g, manager, 390, m.i32(390) - 1);
    }
  }


  for (let lender = 0; lender < 5; lender++) {
    for (let slot = 0; slot < 3; slot++) {
      const o = 508 + (lender * 3 + slot) * 18;
      const amount = m.i32(o);
      if (amount === 0) continue;
      // Im Original hängt der Zinstermin am Aufnahmetag (Byte 9). Dazu bucht es die Zinsen am
      // Monatsletzten ein zweites Mal, wenn der laufende Monat kürzer ist als der Monat der
      // Rückzahlung (Byte 11) - 0x12151 vergleicht die Monatslängen, nicht den Termin. Wer im
      // Juli zurückzahlt, zahlt also im Februar und in den 30-Tage-Monaten doppelt. Die Version
      // 2026 bucht die Zinsen für alle einmal zum Termin der Monatsabrechnung.
      const termin = fester
        ? date.day === daysInMonth
        : date.day === m.u8(o + 9) || (DAYS_IN_MONTH[m.u8(o + 11)] > daysInMonth && date.day === daysInMonth);
      if (!termin) continue;
      const interest = m.i32(o + 4);
      writeI32(g, manager, 496, m.i32(496) - interest);
      events.push({ kind: "interest", text: `Zinsen ${interest} DM für Kredit über ${amount} DM`, amount: interest });
      const dueYear = m.u8(o + 16) | (m.u8(o + 17) << 8);
      if (dueYear === date.year && m.u8(o + 11) === date.month0) {
        writeI32(g, manager, 496, m.i32(496) - amount);
        if (lender !== 4) writeI32(g, lender, 496, g.managers.at(lender).i32(496) + amount);
        for (let i = 0; i < 18; i++) m.setU8(o + i, 0);
        events.push({ kind: "repaid", text: `${texte("ui.kreditfaellig")[0]} ${amount} DM ${lender === 4 ? "bei der Bank " : ""}${texte("ui.kreditfaellig")[1]}`, amount });
      }
    }
  }

  if (date.day === daysInMonth) {
    const youth = (m.u8(482) | (m.u8(483) << 8)) + 4 * m.u8(319);
    m.setU8(482, youth & 0xff);
    m.setU8(483, (youth >> 8) & 0xff);
    monthlyAdvertising(g, manager);
    let income = monthlyIncome(g, manager, date.day);
    let expenses = monthlyExpenses(g, manager);
    const balance = m.i32(496);
    const avg = acc ? div(acc.sum, date.day) : balance;
    // Guthabenzins über den Monatsdurchschnitt. In der Version 2026 zählt davon höchstens
    // INTEREST_CAP mit - Geld horten ist dann keine Strategie mehr (sim/regeln.ts).
    if (avg > 0) income += div(Math.min(fester ? INTEREST_CAP : Number.MAX_SAFE_INTEGER, div(acc ? acc.sum : balance * date.day, date.day)), 75);
    else if (avg < 0) expenses += div(avg, -10);
    if (acc) acc.sum = 0;
    writeI32(g, manager, 496, balance + income - expenses);
    events.push({ kind: "month", text: `Monatsabrechnung: +${income} DM, -${expenses} DM, Kontostand ${m.i32(496)} DM` });
    const fans = m.u8(476) | (m.u8(477) << 8);
    if (fans < 95) {
      const o = ADV_OFFSET + manager * 36 + 32;
      const p = g.save.plain;
      const adExpenses = (p[o] | (p[o + 1] << 8) | (p[o + 2] << 16) | (p[o + 3] << 24)) | 0;
      if (rng(0, 22) < div(adExpenses, 2500)) {
        const f = fans + rng(1, 3);
        m.setU8(476, f & 0xff);
        m.setU8(477, (f >> 8) & 0xff);
        events.push({ kind: "fans", text: `Fanwert steigt auf ${f}` });
      }
    }
  }
  // Abnutzung des Stadionkomforts (0x0E444 im Tagesblock): mit Wahrscheinlichkeit
  // 1/(442 - 52·Komfort) fällt die Komfortnote um eins, solange sie über 1 liegt (0x0E50D) -
  // und nur für einen Bundesligisten.
  // Je besser das Stadion, desto schneller altert es: bei Note 3 ist das 1/286 je Kalendertag,
  // bei Note 6 schon 1/130. Der Wurf steht am Ende, damit er den Zufallsstrom der
  // Monatsabrechnung davor nicht verschiebt (GitLab #57).
  // Nur in der Bundesliga (0x0E49B prüft Managerbyte 312 = 0), und gewürfelt wird wie im
  // Original vor den Bedingungen (GitLab #83, F2).
  const komfort = m.i32(398);
  const wurf = tagesroutine ? rng(0, 442 - 52 * komfort) : -1;
  if (wurf === 0 && komfort > 1 && m.u8(312) === 0) {
    writeI32(g, manager, 398, komfort - 1);
    events.push({ kind: "komfort", text: texte("ui.komfort").join(" ") });
  }
  return events;
}

/**
 * Sponsor-Zuschuss nach einem Kauf (0x0272D, Transfermarkt 0x22C15): mit 1/7 bietet ein Sponsor
 * random(20,65) % des Kaufpreises, auf 10.000 DM abgerundet ("NEHMEN SIE EINEN SPONSOR-ZUSCHUSS
 * VON … DM AN ? ABER IMMER! / LIEBER NICHT."). 0 = kein Angebot.
 */
export function sponsorSubsidy(price: number, rng: Rng): number {
  if (rng(0, 6) !== 0) return 0;
  return div(div(price, 100) * rng(20, 65), 10000) * 10000;
}

/** Zuschuss annehmen: Betrag auf das Konto. */
export function acceptSubsidy(g: GameState, manager: number, amount: number): void {
  writeI32(g, manager, 496, g.managers.at(manager).i32(496) + amount);
}

export const christmasLines = (): string[] => texte("finanzen.weihnachten");

export interface ChristmasResult {
  /** Grundbetrag (Bundesliga); 0 = nur der Gruß */
  base: number;
  /** Ausgabe je aktivem Manager: Grundbetrag / (Liga + 1) */
  amounts: number[];
}

/**
 * Weihnachten (Tagesroutine 0x1D6F6 -> 0x1CF86 am 24.12.): der Bildschirm "Frohe Weihnachten !"
 * erscheint nur mit random(0,3) = 0 (null = nichts); darin mit random(0,1) <> 0 die
 * Weihnachtspakete: Grundbetrag random(15,85)·10000 DM, angezeigt als "BUNDESLIGA: b DM,
 * 2.LIGA: b/2 DM, AMATEUR-OBERLIGA: b/3 DM (INCL. MWST.)"; jeder Manager zahlt b/(Liga+1).
 */
export function christmasPresents(g: GameState, rng: Rng): ChristmasResult | null {
  if (rng(0, 3) !== 0) return null;
  const managers = g.activeManagers();
  if (rng(0, 1) === 0) return { base: 0, amounts: managers.map(() => 0) };
  const base = rng(15, 85) * 10000;
  const amounts = managers.map((m, i) => {
    const a = div(base, m.u8(312) + 1);
    writeI32(g, i, 496, m.i32(496) - a);
    return a;
  });
  return { base, amounts };
}
