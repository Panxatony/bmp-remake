/**
 * Winterliche Spielverlegungen (0x03563) und Nachholtermine (0x36F1),
 * siehe docs/SPIELMECHANIK.md.
 */
import type { Rng } from "./match.ts";
import { type GameState, TABLES } from "../records.ts";
import { calendarFlag, CALENDAR_DAYS, setCalendarFlag } from "./calendar.ts";

/** Nachholtermine im Spielstand: 20 Plätze zu fünf Bytes [Tag, Spieltag, Liga, Spiel, 0]. */
export const REPLAY_OFFSET = 5458;
export const REPLAY_SLOTS = 20;

/** Anzahl der an einem Spieltag zu verlegenden Spiele; 0 außerhalb des Winterfensters. */
export function postponementCount(dayIndex: number, rng: Rng, deckeln = true): number {
  if (dayIndex < 25 || dayIndex > 69) return 0;
  let k = 9 - Math.trunc(Math.abs(dayIndex - 44) / 3);
  if (k !== 0 && rng(0, 1) !== 0) k -= 1;
  const n = rng(0, k);
  return deckeln && n > 8 ? 8 : n;
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
    for (let md = 1; md <= (teams - 1) * 2; md++) for (let m = 0; m < teams / 2; m++) if (istVerlegt(g, league, md, m)) offen++;
  }
  const out: Replay[] = [];
  for (let i = 0; i < REPLAY_SLOTS && out.length < offen; i++) {
    const o = REPLAY_OFFSET + 5 * i;
    if (p[o] === 0) continue;
    out.push({ dayIndex: p[o], matchday: p[o + 1], league: p[o + 2], match: p[o + 3] });
  }
  return out;
}

/**
 * Einen Nachholtermin eintragen und den Tag im Kalender als Nachholtag markieren. Ohne `platz`
 * geht er auf den ersten freien Platz (Tagesbyte 0) - so belegt auch das Original die Tabelle.
 */
export function addReplay(g: GameState, r: Replay, platz?: number): void {
  const p = g.save.plain;
  const i = platz ?? [...Array(REPLAY_SLOTS).keys()].find((j) => p[REPLAY_OFFSET + 5 * j] === 0);
  if (i === undefined) return;
  const o = REPLAY_OFFSET + 5 * i;
  p[o] = r.dayIndex;
  p[o + 1] = r.matchday;
  p[o + 2] = r.league;
  p[o + 3] = r.match;
  p[o + 4] = 0;
  setCalendarFlag(g, r.dayIndex, calendarFlag(g, r.dayIndex) | 0x80);
}

/**
 * Abgetragene Nachholtermine löschen. Das Original setzt nur das Tagesbyte auf 0 und lässt den
 * Rest des Platzes stehen (RUN0 -> Nachholtag, #99); die Plätze rücken nicht auf.
 */
export function removeReplays(g: GameState, weg: Replay[]): void {
  const p = g.save.plain;
  for (let i = 0; i < REPLAY_SLOTS; i++) {
    const o = REPLAY_OFFSET + 5 * i;
    if (p[o] !== 0 && weg.some((w) => w.dayIndex === p[o] && w.matchday === p[o + 1] && w.league === p[o + 2] && w.match === p[o + 3])) p[o] = 0;
  }
}

/** Trägt das Spiel `match` des Spieltags `matchday` (1-basiert) die Verlegungsmarke 30? */
export function istVerlegt(g: GameState, league: number, matchday: number, match: number): boolean {
  return g.save.plain[TABLES.results.offset + (league * 38 + matchday - 1) * 20 + match * 2] === 30;
}

/**
 * Winterliche Verlegungen eines Spieltags vor dem Anpfiff (0x03563 mit 0x36F1), Würfel für
 * Würfel wie im Original (#99): Zahl n wie `postponementCount`, dann je Runde ab Platz 0 der
 * Nachholtabelle: ist der Platz frei (Tagesbyte 0), wird ein Spiel des Spieltags gewürfelt; ist es
 * schon gewählt oder findet sich kein Termin, geht es mit dem nächsten freien Platz weiter, sonst
 * kommt es auf diesen Platz, bekommt die Marke 30 und der Tag die Kalendermarke 0x80, und die
 * Runde beginnt von vorn. Eine Runde ohne Erfolg beendet die Verlegungen. Höchstens 8 je Liga
 * (bei n = 9 läuft deshalb eine Runde mehr). Belegte Plätze zählen auch dann, wenn ihr Spiel
 * nicht mehr aussteht. `matchday` ist der laufende Spieltag (1-basiert). Liefert die Spielnummern.
 */
export function verlegen(g: GameState, dayIndex: number, league: number, matchday: number, rng: Rng, paarung: (league: number, matchday: number, match: number) => [number, number] | undefined): number[] {
  const gewaehlt: number[] = [];
  if (dayIndex < 25 || dayIndex > 69) return gewaehlt;
  const p = g.save.plain;
  let rest = postponementCount(dayIndex, rng, false);
  const spiele = (league === 0 ? 18 : 20) / 2;
  const kalender = new Uint8Array(CALENDAR_DAYS);
  for (let d = 0; d < CALENDAR_DAYS; d++) kalender[d] = calendarFlag(g, d);
  const belegt = (): Replay[] => {
    const out: Replay[] = [];
    for (let i = 0; i < REPLAY_SLOTS; i++) {
      const o = REPLAY_OFFSET + 5 * i;
      if (p[o] !== 0) out.push({ dayIndex: p[o], matchday: p[o + 1], league: p[o + 2], match: p[o + 3] });
    }
    return out;
  };
  const vereine = (r: Replay): [number, number] => paarung(r.league, r.matchday, r.match) ?? [-1, -1];
  while (rest > 0) {
    const vorher = rest;
    if (rest > 8) rest = 8;
    for (let platz = 0; platz < REPLAY_SLOTS; platz++) {
      if (p[REPLAY_OFFSET + 5 * platz] !== 0) continue;
      const m = rng(0, spiele - 1);
      if (gewaehlt.includes(m) || istVerlegt(g, league, matchday, m)) continue;
      const clubs = paarung(league, matchday, m);
      if (!clubs) continue;
      const tag = replayDay(dayIndex, kalender, belegt(), clubs, vereine);
      if (tag === null) continue;
      addReplay(g, { dayIndex: tag, league, matchday, match: m }, platz);
      kalender[tag] |= 0x80;
      const o = TABLES.results.offset + (league * 38 + matchday - 1) * 20 + m * 2;
      p[o] = 30;
      p[o + 1] = 0;
      rest--;
      gewaehlt.push(m);
      break;
    }
    if (rest === vorher) break;
  }
  return gewaehlt;
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
