/**
 * Highscore (Diskette): Punkte 0x34CDA mit Platzierungspunkten 0x34B14, Datei HIGH.0x
 * (0x34474: 20 Einträge zu 58 Bytes), Liste 0x34616. Siehe docs/SPIELMECHANIK.md, "Highscore".
 *
 * Eintrag: 0..25 Managername, 26..48 Vereinsname, 49 Meisterschaften, 50 DFB-Pokale,
 * 51 Europapokale, 52..53 Punkte (u16), 54..57 frei.
 */
import type { GameState } from "../records.ts";
import { LEAGUES } from "./fixtures.ts";
import { playerValue } from "./value.ts";
import { stadiumValue } from "./werbung.ts";
import { loanTotal } from "./finance.ts";
import { seasonStartYear } from "./calendar.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

export const HIGHSCORE_ENTRY = 58;
export const HIGHSCORE_MAX = 20;

export interface HighscoreEntry {
  name: string;
  club: string;
  titles: [number, number, number];
  points: number;
}

/** Dateiname nach Startjahr (0x34474): 1964/1993 HIGH.00, 1966/1995 HIGH.01, sonst HIGH.02. */
export function highscoreFile(startYear: number): string {
  if (startYear === 1964 || startYear === 1993) return "HIGH.00";
  if (startYear === 1966 || startYear === 1995) return "HIGH.01";
  return "HIGH.02";
}

/**
 * Platzierungspunkte (0x34B14): (57 - Tabellenplatz - Ligabasis)/2 (nicht unter 0) + 2·Runde je
 * laufendem Pokal (Runden 1..6), dazu je gespielter Saison aus dem Verlauf (Byte 62 + 4i):
 * (58 - Rang)/2 + 2·(Ligabyte & 7), +20 bei Bit 7 des Ligabytes; hat das Ligabyte Bits über 3,
 * zusätzlich 25 (Europabyte Bit 7) bzw. 3·(Europabyte & 7). Summe durch (Saisons + 1), mal 10.
 */
export function placementPoints(g: GameState, manager: number): number {
  const m = g.managers.at(manager);
  const league = m.u8(312);
  const pos = g.standings.at(m.clubIndex).u8(46);
  let v = 57 - pos - LEAGUES[league].base;
  if (v < 0) v = 0;
  v = div(v, 2);
  for (let cup = 0; cup < 4; cup++) {
    const r = m.u8(306 + cup);
    if (r !== 0 && r < 7) v += 2 * r;
  }
  let seasons = 0;
  for (let i = 0; i < 50; i++) {
    const o = 62 + 4 * i;
    if (o + 3 >= 778 || m.u8(o) === 0) break;
    seasons++;
    v += (58 - m.u8(o)) >> 1;
    const lg = m.u8(o + 2);
    if (lg & 0x80) v += 20;
    else v += 2 * (lg & 7);
    if (lg & 0xf8) {
      const eu = m.u8(o + 3);
      v += eu & 0x80 ? 25 : 3 * (eu & 7);
    }
  }
  if (seasons > 0) v = div(v, seasons + 1);
  return v * 10;
}

/**
 * Highscore-Eintrag eines Managers (0x34CDA): Platzierungspunkte + (Marktwerte des Kaders +
 * 135000·Stadionwert - Kredite + Kontostand)/80000 + 40·Meisterschaften + 20·DFB-Pokale +
 * 60·Europapokale - 500, mindestens 1.
 *
 * Und dazu **+300**, wenn die Bestenliste die gewöhnliche ist (0x34E4D). Das Original gibt den
 * Punktestand nur in den historischen Anfangsjahren ohne diesen Zuschlag; sonst kommt er immer
 * dazu. Ohne ihn frisst der Abzug von 500 alles auf, und jeder Manager landete bei einem Punkt
 * (GitLab #61). Bei P4.MAN kommt damit für NORMI genau die 232 heraus, die in HIGH.02 steht.
 */
export function highscoreEntry(g: GameState, manager: number, bonus = highscoreFile(seasonStartYear(g)) === "HIGH.02"): HighscoreEntry {
  const m = g.managers.at(manager);
  let points = placementPoints(g, manager);
  let wealth = 0;
  const squad = g.squadOf(manager).length;
  for (let place = 0; place < squad; place++) wealth += playerValue(g, manager, place, 0);
  wealth += 135000 * stadiumValue(g, manager);
  wealth += m.i32(496) - loanTotal(g, manager, false);
  points += div(wealth, 80000);
  const titles: [number, number, number] = [m.u8(57), m.u8(58), (m.u8(59) + m.u8(60) + m.u8(61)) & 0xff];
  points += 40 * titles[0] + 20 * titles[1] + 60 * titles[2] - 500;
  if (bonus) points += 300;
  if (points < 1) points = 1;
  return { name: m.name, club: g.clubs.at(m.clubIndex).name, titles, points: points & 0xffff };
}

const readStr = (b: Uint8Array, o: number, n: number): string => {
  let s = "";
  for (let i = 0; i < n; i++) {
    if (b[o + i] === 0) break;
    s += String.fromCharCode(b[o + i]);
  }
  return s;
};

export function decodeHighscore(data: Uint8Array): HighscoreEntry[] {
  const out: HighscoreEntry[] = [];
  for (let o = 0; o + HIGHSCORE_ENTRY <= data.length; o += HIGHSCORE_ENTRY) {
    const name = readStr(data, o, 26);
    if (!name) continue;
    out.push({ name, club: readStr(data, o + 26, 23), titles: [data[o + 49], data[o + 50], data[o + 51]], points: data[o + 52] | (data[o + 53] << 8) });
  }
  return out;
}

export function encodeHighscore(entries: HighscoreEntry[]): Uint8Array {
  const b = new Uint8Array(HIGHSCORE_ENTRY * HIGHSCORE_MAX);
  entries.slice(0, HIGHSCORE_MAX).forEach((e, i) => {
    const o = i * HIGHSCORE_ENTRY;
    for (let k = 0; k < Math.min(25, e.name.length); k++) b[o + k] = e.name.charCodeAt(k) & 0xff;
    for (let k = 0; k < Math.min(22, e.club.length); k++) b[o + 26 + k] = e.club.charCodeAt(k) & 0xff;
    b[o + 49] = e.titles[0];
    b[o + 50] = e.titles[1];
    b[o + 51] = e.titles[2];
    b[o + 52] = e.points & 0xff;
    b[o + 53] = (e.points >> 8) & 0xff;
  });
  return b;
}

/**
 * Eintrag einordnen (0x34616): derselbe Manager mit demselben Verein wird ersetzt, wenn die
 * neuen Punkte höher sind; sonst kommt der Eintrag hinzu, solange Platz ist oder er den letzten
 * übertrifft. Liste absteigend nach Punkten, höchstens 20.
 */
export function insertHighscore(list: HighscoreEntry[], e: HighscoreEntry): HighscoreEntry[] {
  const out = list.slice();
  const same = out.findIndex((x) => x.name === e.name && x.club === e.club);
  if (same >= 0) {
    if (out[same].points < e.points) out[same] = e;
  } else if (out.length < HIGHSCORE_MAX) out.push(e);
  else {
    const last = out.length - 1;
    if (out[last].points < e.points) out[last] = e;
  }
  out.sort((a, b) => b.points - a.points);
  return out.slice(0, HIGHSCORE_MAX);
}
