/**
 * Automatische Aufstellung (0x22030 mit Spielerwahl 0x22305): vergibt die Nummern 1..11 nach
 * dem gewählten System (Tabelle 4cb3:541C: 1-4-4-2, 1-3-5-2, 1-3-4-3) und die Bank.
 * System je Manager: Save-Offset 51 + 2·Manager (4cb3:079E; 1 = manuell, 2..4 = System 1..3),
 * dahinter die Sicherung (079F), die das Original vor dem Spieltag anlegt.
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "Automatische Aufstellung".
 */
import type { GameState } from "../records.ts";
import { TABLES } from "../records.ts";
import { calendarFlag, dayIndex, FLAG_CUP } from "./calendar.ts";

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
 * Mittelfeld bei System < 4 abwärts, sonst aufwärts) mit Umlauf weitergesucht. Erreicht die
 * Suche für eine Feldgruppe die Torhüter, bleibt der erste stehen, jeder weitere zählt mit
 * Stärke 1; ohne Torwart darf ein Feldspieler ins Tor. `best.v` verfolgt die größte gesehene
 * Stärke (ab -1 unverändert). `suspendedAllowed` entspricht 4238:513E (Hauptmenü: der eigene
 * Verein spielt am Pokaltag nicht).
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
      let s = div(l.u8(16) + l.u8(17) + l.u8(18), 3);
      if (pg === 0 && group !== 0) {
        // Torhüter bei der Suche für eine Feldgruppe (0x22450): den ersten lässt das Original mit
        // Stärke -1 stehen, jeder weitere zählt mit Stärke 1 (#100; bis dahin nie ins Feld)
        if (!gkSeen) {
          gkSeen = true;
          continue;
        }
        s = 1;
      }
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
export function autoLineup(g: GameState, manager: number, system: number, benchFour = false, sperreFrei = false): void {
  const sys = system - 2;
  if (sys < 0 || sys > 2) return;
  aufstellungKern(g, manager, system, benchFour, sperreFrei);
  // Danach tauscht 0x0F125 Feldpositionen nach der Seitenvorliebe, und 0x2119D nummeriert die
  // Starter in Kaderreihenfolge neu (0x222F2/0x222FB) - bis #103 fehlte beides
  seitenTausch(g, manager);
  starterNummern(g, manager);
}

/**
 * Feldpositionen nach Seitenvorliebe (0x0F125): steht ein Starter mehr als eine Spalte neben
 * seiner Vorliebe (Spielerbyte 32), sucht das Original in derselben Reihe den Starter, dessen
 * Vorliebe am besten zu dieser Spalte passt, und tauscht die Spalten, wenn das besser ist.
 */
function seitenTausch(g: GameState, manager: number): void {
  const at = (i: number) => g.lineups.at(manager * 25 + i);
  const vorliebe = (i: number) => g.players.at(at(i).u8(15)).u8(32);
  const starter = (i: number) => at(i).u8(15) !== 0 && at(i).u8(10) !== 0 && at(i).u8(10) < 12;
  const sx = (i: number) => (at(i).u8(25) << 24) >> 24;
  for (let i = 0; i < 24; i++) {
    const eigen = Math.abs(sx(i) - vorliebe(i));
    if (!starter(i) || eigen <= 1) continue;
    let bester = -1;
    let bestD = 99;
    for (let j = 0; j < 24; j++) {
      if (j === i || !starter(j) || at(j).u8(26) !== at(i).u8(26)) continue;
      const d = Math.abs(sx(i) - vorliebe(j));
      if (d < bestD) {
        bestD = d;
        bester = j;
      }
    }
    if (bester < 0 || bestD >= eigen) continue;
    const x = at(i).u8(25);
    at(i).setU8(25, at(bester).u8(25));
    at(bester).setU8(25, x);
  }
}

/** Rückennummern der Starter 1..11 in Kaderreihenfolge (0x2119D ohne Anzeige). */
export function starterNummern(g: GameState, manager: number): void {
  let nr = 1;
  for (let i = 0; i < 24; i++) {
    const l = g.lineups.at(manager * 25 + i);
    const n = l.u8(10);
    if (n >= 1 && n <= 11) l.setU8(10, nr++);
  }
}

function aufstellungKern(g: GameState, manager: number, system: number, benchFour: boolean, sperreFrei: boolean): void {
  const sys = system - 2;
  for (let place = 0; place < 24; place++) g.lineups.at(manager * 25 + place).setU8(10, 0);
  const need = FORMATIONS[sys].slice();
  const counts = [0, 0, 0, 0];
  let number = 1;
  const best = { v: -1 };
  for (let grp = 0; grp < 4; grp++) {
    while (need[grp] !== 0) {
      const place = selectPlace(g, manager, grp, system, best, sperreFrei);
      if (place < 0) break;
      const l = g.lineups.at(manager * 25 + place);
      const nr = number++;
      l.setU8(10, nr);
      need[grp]--;
      // Feldposition (0x22166): Reihe je Gruppe, x = Versatz nach Gruppengröße + 2 je Spieler;
      // bei 1-4-4-2 rücken Nummer 2 (eine vor, eine nach rechts) und 5 (eine vor, eine nach links)
      let x = X_OFFSET[FORMATIONS[sys][grp]] + counts[grp];
      let y = ROW_Y[grp];
      if (sys === 0 && nr === 2) {
        y--;
        x++;
      }
      if (sys === 0 && nr === 5) {
        y--;
        x--;
      }
      l.setU8(25, x & 0xff);
      l.setU8(26, y & 0xff);
      counts[grp] += 2;
      // Fünferkette enger (0x221D2)
      if (FORMATIONS[sys][grp] === 5 && counts[grp] !== 2 && counts[grp] !== 6) counts[grp]--;
    }
  }
  if (benchFour) {
    const b = { v: -1 };
    number = 12;
    for (let grp = 0; grp < 4; grp++) {
      const place = selectPlace(g, manager, grp, system, b, sperreFrei);
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
    const place = selectPlace(g, manager, grp, system, b, sperreFrei);
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

/**
 * 4238:513E, gesetzt im Hauptmenü des Managers am Zug (0x99FC auf 0, 0x9B31 auf 1): an einem
 * reinen DFB-Pokaltag (Kalenderbyte 8), wenn der Verein in der laufenden Runde steht (Managerbyte
 * 306 = 4238:0008), zählen gesperrte Spieler als verfügbar - die Sperre gilt nur in der Liga
 * (sie zählt auch nur dort herunter). Das lesen die Automatik 0x22305 und der Kaderbildschirm.
 * Den Wert hat nur, wer im Zug aufstellt; am Tagesbeginn steht noch der Wert des letzten
 * Hauptmenüs vom Vortag (meist 0), das Remake nimmt dort 0.
 */
export function sperreAusgesetzt(g: GameState, manager: number): boolean {
  if (calendarFlag(g, dayIndex(g)) !== FLAG_CUP) return false;
  return g.managers.at(manager).u8(306) === g.save.plain[28233];
}

/**
 * Feldzelle für einen neuen Starter ohne gemerkte Zelle (0x1FF36): Reihe 7 - 7·Position/100
 * (Spielerbyte 31; aus 7 wird 6), darin die erste Spalte 0..7, auf der kein Starter der Plätze
 * 0..23 steht (0x1FEC9); ist die Reihe voll, die nächste, nach 7 wieder 0.
 */
export function freieZelle(g: GameState, manager: number, place: number): void {
  const l = g.lineups.at(manager * 25 + place);
  const belegt = (col: number, row: number) => {
    for (let i = 0; i < 24; i++) {
      const s = g.lineups.at(manager * 25 + i);
      if (s.number >= 1 && s.number <= 11 && s.u8(25) === col && s.u8(26) === row) return true;
    }
    return false;
  };
  let row = 7 + Math.trunc((7 * g.players.at(l.playerIndex).u8(31)) / -100);
  if (row === 7) row = 6;
  for (let versuch = 0; versuch < 8; versuch++) {
    for (let col = 0; col < 8; col++) {
      if (!belegt(col, row)) {
        l.setU8(25, col);
        l.setU8(26, row);
        return;
      }
    }
    row = row + 1 === 8 ? 0 : row + 1;
  }
}

/** Aufstellung nachziehen, wenn ein System gewählt ist (Tagesroutine, Verletzungsende, Kauf, nach dem Spieltag). */
export function autoLineupIfEnabled(g: GameState, manager: number, sperreFrei = false): boolean {
  const system = systemOf(g, manager);
  if (system === SYSTEM_MANUAL) return false;
  // Die Bank ist auch im laufenden Spiel vier Mann stark (CLAUDE.MAN nach dem 1. Spieltag:
  // Nummern 12 bis 15)
  autoLineup(g, manager, system, true, sperreFrei);
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
