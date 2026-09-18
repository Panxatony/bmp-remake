/**
 * Winterliche Spielverlegungen (0x03563) und Nachholtermine (0x36F1),
 * siehe docs/SPIELMECHANIK.md.
 */
import type { Rng } from "./match.ts";
import type { GameState } from "../records.ts";
import { calendarFlag, CALENDAR_DAYS, setCalendarFlag } from "./calendar.ts";

/** Nachholtermine im Spielstand: 20 Plätze zu fünf Bytes [Tag, Spieltag, Liga, Spiel, 0]. */
export const REPLAY_OFFSET = 5458;
export const REPLAY_SLOTS = 20;

/** Anzahl der an einem Spieltag zu verlegenden Spiele; 0 außerhalb des Winterfensters. */
export function postponementCount(dayIndex: number, rng: Rng): number {
  if (dayIndex < 25 || dayIndex > 69) return 0;
  let k = 9 - Math.trunc(Math.abs(dayIndex - 44) / 3);
  if (k !== 0 && rng(0, 1) !== 0) k -= 1;
  const n = rng(0, k);
  return n > 8 ? 8 : n;
}

export interface Replay {
  dayIndex: number;
  league: number;
  matchday: number;
  match: number;
}

/**
 * Nachholtermin für ein Spiel: erster Tag nach `dayIndex` ohne Spielbetrieb
 * (Kalenderbyte 0 oder 0x80), außerhalb der Winterpause (35..59), an dem noch
 * keine 9 Nachholspiele liegen und keiner der beiden Vereine spielt.
 */
export function replayDay(
  dayIndex: number,
  calendar: Uint8Array,
  replays: Replay[],
  clubs: [number, number],
  pairingClubs: (r: Replay) => [number, number],
): number | null {
  for (let d = dayIndex + 1; d < calendar.length; d++) {
    if (d > 35 && d < 59) d = 59;
    const flag = calendar[d];
    if (flag !== 0 && flag !== 0x80) continue;
    const onDay = replays.filter((r) => r.dayIndex === d);
    if (onDay.length >= 9) continue;
    if (onDay.some((r) => pairingClubs(r).some((c) => c === clubs[0] || c === clubs[1]))) continue;
    return d;
  }
  return null;
}

/**
 * Eingetragene Nachholtermine. Die Tabelle wird vom Original nicht geleert, deshalb gelten nur
 * so viele Plätze als belegt, wie es verlegte Spiele gibt (Marke 30 im Ergebnisfeld).
 */
export function replays(g: GameState): Replay[] {
  const p = g.save.plain;
  let offen = 0;
  for (let league = 0; league < 3; league++) {
    const teams = league === 0 ? 18 : 20;
    for (let md = 0; md < (teams - 1) * 2; md++) for (let m = 0; m < teams / 2; m++) if (g.result(league, md, m)?.postponed) offen++;
  }
  const out: Replay[] = [];
  for (let i = 0; i < REPLAY_SLOTS && out.length < offen; i++) {
    const o = REPLAY_OFFSET + 5 * i;
    if (p[o] === 0) continue;
    out.push({ dayIndex: p[o], matchday: p[o + 1], league: p[o + 2], match: p[o + 3] });
  }
  return out;
}

/** Einen Nachholtermin eintragen und den Tag im Kalender als Nachholtag markieren. */
export function addReplay(g: GameState, r: Replay): void {
  const p = g.save.plain;
  const belegt = replays(g).length;
  if (belegt >= REPLAY_SLOTS) return;
  const o = REPLAY_OFFSET + 5 * belegt;
  p[o] = r.dayIndex;
  p[o + 1] = r.matchday;
  p[o + 2] = r.league;
  p[o + 3] = r.match;
  p[o + 4] = 0;
  setCalendarFlag(g, r.dayIndex, calendarFlag(g, r.dayIndex) | 0x80);
}

/** Einen abgetragenen Nachholtermin löschen; die folgenden Plätze rücken auf. */
export function removeReplays(g: GameState, weg: Replay[]): void {
  const bleibt = replays(g).filter((r) => !weg.some((w) => w.league === r.league && w.matchday === r.matchday && w.match === r.match));
  const p = g.save.plain;
  for (let i = 0; i < REPLAY_SLOTS; i++) {
    const o = REPLAY_OFFSET + 5 * i;
    const r = bleibt[i];
    p[o] = r ? r.dayIndex : 0;
    p[o + 1] = r ? r.matchday : 0;
    p[o + 2] = r ? r.league : 0;
    p[o + 3] = r ? r.match : 0;
    p[o + 4] = 0;
  }
}

/**
 * Nach einem Spieltag die verlegten Spiele auf Nachholtermine legen (0x03563 mit 0x36F1).
 * `matchday` ist 1-basiert, `matches` sind die Spielnummern des Spieltags.
 */
export function scheduleReplays(g: GameState, dayIndex: number, league: number, matchday: number, matches: number[], paarung: (league: number, matchday: number, match: number) => [number, number]): Replay[] {
  const neu: Replay[] = [];
  const kalender = new Uint8Array(CALENDAR_DAYS);
  for (let d = 0; d < CALENDAR_DAYS; d++) kalender[d] = calendarFlag(g, d);
  for (const m of matches) {
    const clubs = paarung(league, matchday, m);
    const tag = replayDay(dayIndex, kalender, [...replays(g), ...neu], clubs, (r) => paarung(r.league, r.matchday, r.match));
    if (tag === null) continue;
    const r: Replay = { dayIndex: tag, league, matchday, match: m };
    addReplay(g, r);
    kalender[tag] |= 0x80;
    neu.push(r);
  }
  return neu;
}
