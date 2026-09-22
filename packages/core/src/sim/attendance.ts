/**
 * Zuschauer eines Heimspiels (0x10BB0) und Buchung in der Spielvorbereitung (0x1C632,
 * ab 0x1C798). Siehe docs/SPIELMECHANIK.md, Abschnitt "Zuschauer".
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { strength } from "./match.ts";
import { LEAGUES } from "./fixtures.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/** Ersatzkapazitäten je Ligaband des Heimvereins (DGROUP 0x2C8, ×10) */
const CUP_BASE = [4500, 2200, 1200, 600];

/**
 * Ersatz-Eintrittspreise je Ligaband (DGROUP 0x5390, gelesen bei 0x1CA27). Sie treten an die
 * Stelle des Managerbytes 266, wenn der Heimverein dem Rechner gehört; dazu kommt ein Wurf von
 * 0 oder 1.
 */
export const ERSATZ_PREIS = [16, 14, 10, 8];

/** Ligaband eines Vereins (0..3, Grenztabelle 4cb3:0x2272) */
export function ligaBand(club: number): number {
  return club < 18 ? 0 : club < 38 ? 1 : club < 58 ? 2 : 3;
}

export interface AttendanceInput {
  manager: number;
  home: number;
  away: number;
  /** Bedeutung des Spiels 0..3 (Original aus der Spielvorbereitung, hier 1) */
  importance?: number;
  /**
   * Der Heimverein gehört dem Rechner: dann würfelt das Original (0x10BB0, Argument +0x10) eine
   * Kapazität aus dem Ligaband aus, statt das Stadion aus dem Managersatz zu nehmen. Im eigenen
   * Heimspiel zählt immer das eigene Stadion - auch im Pokal.
   */
  fremdesStadion?: boolean;
  /** Eintrittspreis statt Managerbyte 266 (0x10BB0, Argument +0x12) */
  preis?: number;
  /** Spiel-Level (Save-Offset 34062) */
  level: number;
}

function partsSum(g: GameState, club: number): number {
  const m = g.clubs.at(club).strengthMatrix;
  return div(2 * (strength(m, 0, 1) + strength(m, 1, 1) + strength(m, 2, 1)), 15);
}

export function attendance(g: GameState, inp: AttendanceInput, rng: Rng): number {
  const mg = g.managers.at(inp.manager);
  const pos = (c: number) => (c < 64 ? g.standings.at(c).u8(46) : 5);
  let posH = pos(inp.home);
  const posA = pos(inp.away);
  const sH = partsSum(g, inp.home);
  const sA = partsSum(g, inp.away);
  const price = inp.preis ?? mg.u8(266);
  const league = mg.u8(312);
  const mult = 1 << (2 - league);
  if (mult === 4 && posH > 14) posH = 14;
  if (sH === 0 && sA === 0) return 1;

  // Gleitkommateil: Basis aus Plätzen und Stärken
  let base = (1 - 0.02 * (posA - 1)) * sA + (1 - 0.02 * (posH - 1)) * sH;
  base = base * 0.23255813953488372 * 1150;
  const r = rng((price - 10) * 1050, 1550 * price - 14400);
  let att = Math.trunc(base - r + 1000);

  // Stadionkomfort (Managerbytes 366.., i32) mit Qualitätsfaktor q
  const q = div((sA + sH) * 100, 180);
  const f = (off: number) => mg.i32(off);
  att += rng(5 * q, 9 * q) * f(398) - 20 * q;
  att += rng(4 * q, 12 * q) * f(390) - 31 * q;
  att += (10 * f(374) - 8) * q;
  att += (10 * f(382) - 5) * q;
  att += (div(f(366), 1000) - 8) * q;
  const fans = mg.u8(476) | (mg.u8(477) << 8);
  if (fans > 50) att += 30 * fans - 1500;
  att += -2000 * league;
  if (inp.level !== 0) att += 1200;
  if (mg.i32(350) + 2000 > mg.i32(358)) att += rng(400, 700);

  const md = g.nextMatchday(league);
  const matchdays = LEAGUES[league].matchdays;
  let capacity: number;
  if (inp.fremdesStadion) {
    const c = CUP_BASE[ligaBand(inp.home)];
    capacity = rng(c - div(c, 3), c + div(c, 3)) * 10;
  } else capacity = mg.i32(350) + mg.i32(358);

  let imp = Math.min(inp.importance ?? 1, 3);
  if (league === 2) imp = 0;
  if (sA < 90 && imp > 1) imp--;
  if (price < 22) att = div(att * (imp + 2), 3);
  if (md + 5 >= matchdays && price < 22) {
    if (md === matchdays) att = capacity;
    else {
      if (7 - 2 * (league > 0 ? 1 : 0) > posH) att += div(capacity, 4);
      if (posA < 7) att += div(capacity, 5);
      if (posH + 5 + (league > 0 ? 1 : 0) > LEAGUES[league].teams) att += div(capacity, 4);
    }
  }
  if (price > 10) att += 900 * (10 - price);
  const limit = (2 * mult - (mult === 4 ? 1 : 0)) * 100000;
  while (att * price > limit) att -= 1000;
  while (att <= 500) att += 500;
  if (att > capacity) att = capacity;
  return att;
}

/**
 * Ticketeinnahmen (Zuschauer · Preis / Teiler; Liga 1, Pokal 2 für beide Manager) auf den
 * Kontostand (Byte 496). Der Preis ist der des Heimvereins - kassiert wird an seiner Kasse -,
 * darum nimmt das Original für den Gast nicht dessen Byte 266, sondern das des Gegners
 * (0x1C9DC über -0x1e) und, wenn dort der Rechner spielt, den Ligasatz (0x1CA27).
 */
export function bookGate(g: GameState, manager: number, att: number, divisor = 1, preis?: number): number {
  const m = g.managers.at(manager);
  const income = div(att * (preis ?? m.u8(266)), divisor);
  const v = m.i32(496) + income;
  for (let i = 0; i < 4; i++) m.setU8(496 + i, (v >>> (8 * i)) & 0xff);
  return income;
}

/**
 * Zuschauer beim Manager buchen, nur im Ligaheimspiel (0x1C798): Historie (Byte 330 + Zähler
 * 314, in Tausend), gesamt 484, Rekord 488/500, Minuskulisse 492/504. Einen Rekord löst auch
 * die gleiche Zahl ab (0x1C7E4/0x1C821). Die Historie hat im Original keine Grenze; mit
 * höchstens 19 Heimspielen endet sie vor Byte 350 (Sitzplätze), die 20 ist nur Schutz.
 */
export function bookAttendance(g: GameState, manager: number, att: number, opponent: number): void {
  const m = g.managers.at(manager);
  const n = m.u8(314);
  if (n < 20) m.setU8(330 + n, div(att, 1000) & 0xff);
  m.setU8(314, n + 1);
  const w = (off: number, v: number) => {
    for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff);
  };
  w(484, m.i32(484) + att);
  if (att >= m.i32(488)) {
    w(488, att);
    w(500, opponent);
  }
  if (att <= m.i32(492)) {
    w(492, att);
    w(504, opponent);
  }
}

/** DFB-Pokalfinale (Rundenbyte > 4): feste Kulisse (4cb3:2256, das Olympiastadion) - 0x1CB6B. */
export const FINALE_KULISSE = 76000;
/** ... und statt Eintritt eine Pauschale für jeden beteiligten Manager (0x1C8F5, 0x1CAA2). */
export const FINALE_PAUSCHALE = 532000;

const s16 = (v: number): number => (v << 16) >> 16;

/**
 * Pokalzuschlag im Heimspiel eines Managers gegen einen Verein aus höherer Liga (0x1C858): mit
 * d = eigene Liga (Byte 312) - Ligaband des Gastes kommen `random(Kulisse/(8 - 3d), Kulisse)`
 * Zuschauer dazu, höchstens bis zur Stadiongröße. Das Original würfelt mit 16-Bit-Grenzen
 * (`lo + rand % (hi - lo + 1)`, 0x08377); über 32767 Zuschauern kippt die obere Grenze ins
 * Negative, der Rest wird dann wie dort genommen.
 */
export function pokalZuschlag(g: GameState, manager: number, away: number, att: number, rng: Rng): number {
  const m = g.managers.at(manager);
  const d = m.u8(312) - ligaBand(away);
  if (d <= 0) return att;
  const lo = s16(div(att, 8 - 3 * d));
  const span = s16(s16(att) - lo + 1);
  if (span === 0) return att;
  att += s16(lo + rng(0, Math.abs(span) - 1));
  return Math.min(att, m.i32(350) + m.i32(358));
}
