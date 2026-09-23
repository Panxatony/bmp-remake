/**
 * Automatische Aufstellung (0x22030 mit Spielerwahl 0x22305): vergibt die Nummern 1..11 nach
 * dem gewählten System (Tabelle 4cb3:541C: 1-4-4-2, 1-3-5-2, 1-3-4-3) und die Bank.
 * System je Manager: Save-Offset 51 + 2·Manager (4cb3:079E; 1 = manuell, 2..4 = System 1..3),
 * dahinter die Sicherung (079F), die das Original vor dem Spieltag anlegt.
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "Automatische Aufstellung".
 */
import type { GameState } from "../records.ts";
import { TABLES } from "../records.ts";

export const SYSTEM_OFFSET = 51;
export const SYSTEM_MANUAL = 1;
export const FORMATIONS: number[][] = [
  [1, 4, 4, 2],
  [1, 3, 5, 2],
  [1, 3, 4, 3],
];
export const SYSTEM_NAMES = ["MANUELL", "1-4-4-2", "1-3-5-2", "1-3-4-3"];
/** x-Versatz je Gruppengröße (4cb3:5428) und Feldreihe je Gruppe (4cb3:542E). */
const X_OFFSET = [0, 3, 2, 1, 0, 0];
const ROW_Y = [7, 6, 3, 0];

/**
 * Platz auf dem Spielfeld je Rückennummer und System (Kaderbytes 25 = Spalte 0..6,
 * 26 = Reihe 0..7; Reihe 0 ist vorn). Die Reihe für 1-4-4-2 stammt aus dem Original
 * (SCHWARZ-.MAN, frisches Spiel): Torhüter (3,7), Abwehr (5,5) (1,5) (4,6) (2,6),
 * Mittelfeld (6,3) (2,3) (0,3) (4,3), Angriff (4,0) (2,0). Welcher Spieler welchen der
 * Plätze bekommt, richtet sich im Original nach seiner Seitenvorliebe; hier zählt die
 * Reihenfolge der Auswahl. Alle drei Systeme stammen aus Spielständen des Originals
 * (SCHWARZ-.MAN für 1-4-4-2, CLAUDE3.MAN für 1-3-5-2 und 1-3-4-3).
 */
const POSITIONS: [number, number][][] = [
  [[3, 7], [5, 5], [1, 5], [4, 6], [2, 6], [6, 3], [2, 3], [0, 3], [4, 3], [4, 0], [2, 0]],
  [[3, 7], [3, 6], [5, 6], [1, 6], [3, 3], [4, 3], [0, 3], [6, 3], [2, 3], [4, 0], [2, 0]],
  [[3, 7], [5, 6], [3, 6], [1, 6], [2, 3], [4, 3], [6, 3], [0, 3], [5, 0], [1, 0], [3, 0]],
];

const div = (a: number, b: number): number => Math.trunc(a / b);

export function systemOf(g: GameState, manager: number): number {
  const v = g.save.plain[SYSTEM_OFFSET + 2 * manager];
  return v >= 1 && v <= 4 ? v : SYSTEM_MANUAL;
}

export function setSystem(g: GameState, manager: number, system: number): void {
  g.save.plain[SYSTEM_OFFSET + 2 * manager] = system;
}

/**
 * Vor den Spielen (0x1D817): 079F = 079E, dann 079E = 1 (manuell). Bis zum nächsten Spieltag
 * läuft die Automatik damit ins Leere - auch am Ende der Tagesroutine und nach einem Kauf
 * (#99, am Speicher des Originals nachgesehen). Bis #99 kopierte das Remake nur. Einmal je
 * Spieltag aufrufen - ein zweiter Aufruf sicherte die 1.
 */
export function backupSystem(g: GameState, manager: number): void {
  const o = SYSTEM_OFFSET + 2 * manager;
  g.save.plain[o + 1] = g.save.plain[o];
  g.save.plain[o] = SYSTEM_MANUAL;
}

/** Tagesbeginn eines Spieltags (0x1D797): 079E = 079F, danach stellt der Aufrufer neu auf. */
export function restoreSystem(g: GameState, manager: number): void {
  const o = SYSTEM_OFFSET + 2 * manager;
  g.save.plain[o] = g.save.plain[o + 1];
}

/** Positionsgruppe eines Spielers: Positionswert (Byte 31) / 25 -> 0 Tor, 1 Abwehr, 2 Mittelfeld, 3 Angriff. */
export const groupOf = (g: GameState, playerIndex: number): number => div(g.players.at(playerIndex).u8(31), 25);

/**
 * Spielerwahl (0x22305): bester noch nummernloser, einsatzfähiger Spieler der Gruppe (Stärke =
 * (Ko+Te+Fo)/3 des Kaderplatzes); ist die Gruppe leer, wird in Richtung dir (Angriff und
 * Mittelfeld bei System < 4 abwärts, sonst aufwärts) mit Umlauf weitergesucht. Torhüter
 * werden nie im Feld aufgestellt; ohne Torwart darf ein Feldspieler ins Tor. `best.v`
 * verfolgt die größte gesehene Stärke (ab -1 unverändert).
 */
export function selectPlace(g: GameState, manager: number, group: number, system: number, best: { v: number }, suspendedAllowed = false): number {
  let result = -1;
  let bestStrength = 0;
  let cur = group;
  const dir = group === 3 || (group === 2 && system < 4) ? -1 : 1;
  let gkSeen = false;
  let any = false;
  for (let pass = 0; pass < 8; pass++) {
    for (let place = 0; place < 24; place++) {
      const l = g.lineups.at(manager * 25 + place);
      if (l.isEmpty || l.u8(10) !== 0) continue;
      const f = l.u8(9) & 3;
      if (f === 1 && !suspendedAllowed) continue;
      if (f >= 2) continue;
      any = true;
      const pg = groupOf(g, l.playerIndex);
      if (pg !== cur) continue;
      if (pg === 0 && group !== 0) {
        gkSeen = true;
        continue;
      }
      const s = div(l.u8(16) + l.u8(17) + l.u8(18), 3);
      if (bestStrength > s) continue;
      if (best.v !== -1 && best.v < s) best.v = s;
      bestStrength = s;
      result = place;
    }
    cur += dir;
    if (cur === 4) cur = 0;
    if (cur === -1) cur = 3;
    if (cur === group && gkSeen) return result;
    if (!any) return result;
    if (result !== -1) return result;
  }
  return result;
}

/**
 * Aufstellung nach System (0x22030): alle Nummern löschen, je Gruppe die Sollzahl mit der
 * Spielerwahl füllen (Nummern 1..11, Feldposition Bytes 25/26), danach die Bank: zu Spielbeginn
 * (Kadergröße 15) je Gruppe ein Ersatzspieler 12..15, sonst Nummer 12 an den ersten gefundenen
 * (meist der zweite Torwart) und 13 an den stärksten übrigen Feldspieler.
 * `system` 2..4; bei 1 (manuell) passiert nichts.
 */
export function autoLineup(g: GameState, manager: number, system: number, benchFour = false): void {
  const sys = system - 2;
  if (sys < 0 || sys > 2) return;
  for (let place = 0; place < 24; place++) g.lineups.at(manager * 25 + place).setU8(10, 0);
  const need = FORMATIONS[sys].slice();
  const counts = [0, 0, 0, 0];
  let number = 1;
  const best = { v: -1 };
  for (let grp = 0; grp < 4; grp++) {
    while (need[grp] !== 0) {
      const place = selectPlace(g, manager, grp, system, best);
      if (place < 0) break;
      const l = g.lineups.at(manager * 25 + place);
      const nr = number++;
      l.setU8(10, nr);
      need[grp]--;
      const pos = POSITIONS[sys][nr - 1] ?? [X_OFFSET[FORMATIONS[sys][grp]] + counts[grp], ROW_Y[grp]];
      l.setU8(25, pos[0] & 0xff);
      l.setU8(26, pos[1] & 0xff);
      counts[grp] += 2;
    }
  }
  if (benchFour) {
    const b = { v: -1 };
    number = 12;
    for (let grp = 0; grp < 4; grp++) {
      const place = selectPlace(g, manager, grp, system, b);
      if (place < 0) break;
      g.lineups.at(manager * 25 + place).setU8(10, number++);
    }
    return;
  }
  const b = { v: 0 };
  number = 12;
  let bestPlace = -1;
  for (let grp = 0; grp < 4; grp++) {
    const prev = b.v;
    const place = selectPlace(g, manager, grp, system, b);
    if (number > 12 && b.v !== prev) bestPlace = place;
    if (place < 0) break;
    if (number === 12) {
      b.v = 0;
      g.lineups.at(manager * 25 + place).setU8(10, 12);
      number = 13;
    }
  }
  if (bestPlace >= 0) g.lineups.at(manager * 25 + bestPlace).setU8(10, number);
}

/** Aufstellung nachziehen, wenn ein System gewählt ist (Tagesroutine, Verletzungsende, Kauf, nach dem Spieltag). */
export function autoLineupIfEnabled(g: GameState, manager: number): boolean {
  const system = systemOf(g, manager);
  if (system === SYSTEM_MANUAL) return false;
  // Die Bank ist auch im laufenden Spiel vier Mann stark (CLAUDE.MAN nach dem 1. Spieltag:
  // Nummern 12 bis 15)
  autoLineup(g, manager, system, true);
  return true;
}

/**
 * Einen frisch aufgenommenen Kaderplatz an die richtige Stelle rücken. Der Kader des Originals
 * ist nach Mannschaftsteil sortiert (Torwart, Abwehr, Mittelfeld, Angriff - in allen
 * Original-Spielständen ohne Ausnahme); wer hinten angehängt wird, steht in der Liste "IHRE
 * MANNSCHAFT" an der falschen Stelle. Innerhalb seiner Gruppe kommt der Neue ans Ende.
 * Liefert den neuen Kaderplatz.
 */
/**
 * Kader nach Mannschaftsteilen ordnen und dabei die Reihenfolge innerhalb einer Gruppe behalten.
 * Reparatur für Spielstände, in die ein Spieler unsortiert geraten ist (bis 18.9.2026 holte
 * `takeBack` einen Spieler vom Transfermarkt hinten an den Kader). Liefert true, wenn sich etwas
 * geändert hat.
 */
export function sortSquad(g: GameState, manager: number): boolean {
  if (manager < 0 || manager > 3) return false;
  const base = manager * 25;
  const plaetze: number[] = [];
  for (let i = 0; i < 25; i++) if (!g.lineups.at(base + i).isEmpty) plaetze.push(i);
  const gruppe = (i: number): number => groupOf(g, g.lineups.at(base + i).playerIndex);
  const neu = plaetze.slice().sort((a, b) => gruppe(a) - gruppe(b) || plaetze.indexOf(a) - plaetze.indexOf(b));
  if (neu.every((v, i) => v === plaetze[i])) return false;
  const p = g.save.plain;
  const off = (i: number) => TABLES.lineups.offset + (base + i) * 52;
  const bloecke = neu.map((i) => p.slice(off(i), off(i) + 52));
  for (let i = 0; i < 25; i++) p.fill(0, off(i), off(i) + 52);
  bloecke.forEach((b, i) => p.set(b, off(i)));
  return true;
}

export function sortIntoSquad(g: GameState, manager: number, place: number): number {
  if (manager < 0 || manager > 3 || place <= 0 || place > 24) return place;
  const base = manager * 25;
  const gruppe = (i: number): number => {
    const l = g.lineups.at(base + i);
    if (l.isEmpty) return 99;
    return Math.min(3, Math.trunc(g.players.at(l.playerIndex).positionValue / 25));
  };
  const mein = gruppe(place);
  if (mein > 3) return place;
  let ziel = 0;
  while (ziel < place && gruppe(ziel) <= mein) ziel++;
  if (ziel >= place) return place;
  const off = (i: number) => TABLES.lineups.offset + (base + i) * 52;
  const p = g.save.plain;
  const block = p.slice(off(place), off(place) + 52);
  p.copyWithin(off(ziel + 1), off(ziel), off(place));
  p.set(block, off(ziel));
  return ziel;
}
