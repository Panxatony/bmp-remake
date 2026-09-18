/**
 * Spielkalender: 95 Kalendertage je Saison (Bitfeld an Save-Offset 34227, aktueller
 * Tagindex 34226). Tagindex k liegt auf Saisontag (7k + 1) / 2 (Save-Offset 27972),
 * gerade Indizes sind Samstage, ungerade Mittwoche. Saisontag 0 ist der 29. Juli,
 * Schaltjahre gibt es nicht.
 * Datum: Tag 27960, Monat 27964 (0-basiert), Jahr 27968 (16 Bit, z.B. 1997).
 * Gegen alle vorliegenden Spielstände geprüft.
 */
import type { GameState } from "../records.ts";
import { SCALARS } from "../records.ts";

export const CALENDAR_DAYS = 95;
export const CAL_OFFSET = 34227;
export const DAY_INDEX_OFFSET = 34226;

export const FLAG_LEAGUE = [1, 2, 4] as const;
export const FLAG_CUP = 8;
export const FLAG_EUROPE = 0x70;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function seasonDay(dayIndex: number): number {
  return Math.trunc((7 * dayIndex + 1) / 2);
}

export function isSaturday(dayIndex: number): boolean {
  return dayIndex % 2 === 0;
}

/** Datum eines Saisontags; startYear = Jahr des Saisonbeginns (z.B. 1997). */
export function dateOfSeasonDay(day: number, startYear: number): { day: number; month0: number; year: number } {
  let year = startYear;
  let month0 = 6; // Juli
  let d = 29 + day; // 1-basierter Tag im Juli
  for (;;) {
    const len = MONTH_DAYS[month0]; // das Original kennt keine Schaltjahre (RIED-4TE, 1996)
    if (d <= len) return { day: d, month0, year };
    d -= len;
    month0++;
    if (month0 === 12) {
      month0 = 0;
      year++;
    }
  }
}

export function calendarFlag(g: GameState, dayIndex: number): number {
  return g.save.plain[CAL_OFFSET + dayIndex];
}

/** Kalenderbyte setzen (Nachholtage bekommen zusätzlich die Marke 0x80). */
export function setCalendarFlag(g: GameState, dayIndex: number, flag: number): void {
  g.save.plain[CAL_OFFSET + dayIndex] = flag & 0xff;
}

export function dayIndex(g: GameState): number {
  return g.save.plain[DAY_INDEX_OFFSET];
}

/** Jahr des Saisonbeginns aus dem gespeicherten Datum. */
export function seasonStartYear(g: GameState): number {
  const year = g.save.plain[SCALARS.year] | (g.save.plain[SCALARS.year + 1] << 8);
  const month0 = g.save.plain[SCALARS.monthIndex];
  return month0 >= 6 ? year : year - 1;
}

/** Setzt Tagindex, Saisontag und Datum. */
export function setDayIndex(g: GameState, dayIndex: number): void {
  const p = g.save.plain;
  const startYear = seasonStartYear(g);
  p[DAY_INDEX_OFFSET] = dayIndex;
  const sd = seasonDay(dayIndex);
  const dt = dateOfSeasonDay(sd, startYear);
  const w = (off: number, v: number) => {
    p[off] = v & 0xff;
    p[off + 1] = (v >> 8) & 0xff;
    p[off + 2] = 0;
    p[off + 3] = 0;
  };
  w(SCALARS.counter, sd);
  w(SCALARS.day, dt.day);
  w(SCALARS.monthIndex, dt.month0);
  w(SCALARS.year, dt.year);
}
