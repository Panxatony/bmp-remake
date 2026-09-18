/**
 * Tabellenfortschreibung nach einem Spiel (0x2D144), abgeleitet aus dem
 * Rohvergleich TEST4 -> RUNA0 (Spieltag 10, alle 18 Vereine).
 *
 * Datensatz (54 Bytes) je Verein: 0/1 Punkte heim/auswärts (im Original 2-Punkte-System,
 * mit der Version 2026 drei Punkte je Sieg),
 * 2/3 Spiegel; 4..11 Formstring (letzte 8 Spiele, Kleinbuchstabe = Heimspiel:
 * s Sieg, u Unentschieden, n Niederlage), 13..20 Spiegel; 22/23 Tore heim/auswärts,
 * 24/25 Spiegel; 26/27 Gegentore, 28/29 Spiegel; 30/31 Spiele; 38/39 Siege,
 * 40 Spiegel der Heimsiege; 42/43 Niederlagen, 44 Spiegel der Heimniederlagen
 * (Auswärtssiege und -niederlagen haben keinen Spiegel); 46 Tabellenplatz (0-basiert).
 */
import type { GameState, Standing } from "../records.ts";
import { LEAGUES } from "./fixtures.ts";
import { winPoints } from "./regeln.ts";

function push(s: Standing, ch: number): void {
  for (let i = 4; i < 11; i++) s.setU8(i, s.u8(i + 1));
  s.setU8(11, ch);
  for (let i = 13; i <= 20; i++) s.setU8(i, s.u8(i - 9));
}

function mirror(s: Standing, a: number, b: number): void {
  s.setU8(b, s.u8(a));
}

/** Trägt ein Ergebnis für beide Vereine ein (ohne Neusortierung). */
export function applyResult(g: GameState, home: number, away: number, hg: number, ag: number): void {
  const h = g.standings.at(home);
  const a = g.standings.at(away);
  // Punkte je Sieg nach Regelwerk (zwei im Original, drei ab Version 2026)
  const sieg = winPoints(g);
  h.setU8(0, h.u8(0) + (hg > ag ? sieg : hg === ag ? 1 : 0));
  a.setU8(1, a.u8(1) + (ag > hg ? sieg : hg === ag ? 1 : 0));
  mirror(h, 0, 2);
  mirror(a, 1, 3);
  push(h, hg > ag ? 0x73 : hg === ag ? 0x75 : 0x6e);
  push(a, hg > ag ? 0x4e : hg === ag ? 0x55 : 0x53);
  h.setU8(22, h.u8(22) + hg);
  h.setU8(26, h.u8(26) + ag);
  a.setU8(23, a.u8(23) + ag);
  a.setU8(27, a.u8(27) + hg);
  mirror(h, 22, 24);
  mirror(h, 26, 28);
  mirror(a, 23, 25);
  mirror(a, 27, 29);
  h.setU8(30, h.u8(30) + 1);
  a.setU8(31, a.u8(31) + 1);
  if (hg > ag) {
    h.setU8(38, h.u8(38) + 1);
    a.setU8(43, a.u8(43) + 1);
  } else if (hg < ag) {
    a.setU8(39, a.u8(39) + 1);
    h.setU8(42, h.u8(42) + 1);
  }
  mirror(h, 38, 40);
  mirror(h, 42, 44);
}

/**
 * Tabellenreihenfolge einer Liga: Punkte, Tordifferenz, erzielte Tore. Die Vereine
 * werden in der bisherigen Reihenfolge (Byte 46) durchlaufen und jeweils vor den
 * ersten Verein gesetzt, der nicht besser ist; völlig gleichauf liegende Vereine
 * tauschen dadurch jeden Spieltag die Plätze (beobachtet TEST4 -> RUNA0,
 * Gladbach/Dortmund).
 */
export function tableOrder(g: GameState, league: number): number[] {
  const L = LEAGUES[league];
  const clubs = Array.from({ length: L.teams }, (_, i) => L.base + i);
  const key = (c: number) => {
    const s = g.standings.at(c);
    const pts = s.u8(0) + s.u8(1);
    const gf = s.u8(22) + s.u8(23);
    const ga = s.u8(26) + s.u8(27);
    return [pts, gf - ga, gf];
  };
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  const previous = clubs.slice().sort((x, y) => g.standings.at(x).u8(46) - g.standings.at(y).u8(46) || x - y);
  const order: number[] = [];
  for (const c of previous) {
    const k = key(c);
    let pos = order.findIndex((o) => !better(key(o), k));
    if (pos < 0) pos = order.length;
    order.splice(pos, 0, c);
  }
  return order;
}

/**
 * Schreibt die Plätze (Byte 46) und die Reihenfolgeliste 28244 (4238:535A, 20 Bytes je Liga).
 * Mit `matchday` merkt sich das Original danach den Platz jedes Managervereins für den
 * Tabellenverlauf im Hauptmenü (0x2DBC5): Managerbyte 267 + Spieltag. Byte 305 ist der Einsatz,
 * darum schreibt das Remake höchstens bis 304 (im Original läuft der Zähler ungebremst weiter).
 */
export function updatePositions(g: GameState, league: number, matchday?: number): void {
  tableOrder(g, league).forEach((c, pos) => {
    g.standings.at(c).setU8(46, pos);
    g.save.plain[28244 + 20 * league + pos] = c;
  });
  if (matchday === undefined || matchday < 0 || matchday > 37) return;
  g.activeManagers().forEach((m, i) => {
    void i;
    const s = g.standings.at(m.clubIndex);
    m.setU8(267 + matchday, s.u8(46));
  });
}
