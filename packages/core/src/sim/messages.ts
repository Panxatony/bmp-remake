/**
 * Kalendermeldungen des Hauptmenüs (0x143ED) und Abschlussbild (0x1A36D).
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "Kalendermeldungen und Abschlussbild".
 */
import type { GameState } from "../records.ts";
import { texte, text as T } from "../data/texte.ts";
import { LEAGUES } from "./fixtures.ts";
import { tableOrder } from "./standings.ts";

/** Punkte je Sieg (4cb3:2271). */
export const POINTS_PER_WIN = 2;
/** Zweiter Platzindex je Liga (4cb3-Rechnung in 0x143ED): Bundesliga UEFA-Cup-Platz 5, 2. Liga Aufstieg 2., Oberliga Aufstieg 4. */
const SECOND_PLACE = [4, 1, 3];
/** Letzter sicherer Platzindex je Liga: Bundesliga 18-4 = 14 (15. Platz), 2. Liga und Oberliga 20-5 = 15 (16. Platz). */
const SAFE_PLACE = [14, 15, 15];

export const winterBreakLines = (): string[] => texte("meldungen.winterpause");

/** 2. Dezember: letzter Spieltag vor der Winterpause. */
export function isWinterBreakDay(date: { day: number; month0: number }): boolean {
  return date.month0 === 11 && date.day === 2;
}

const seasonPoints = (g: GameState, club: number): number => {
  const s = g.standings.at(club);
  return s.u8(0) + s.u8(1);
};
const gamesPlayed = (g: GameState, club: number): number => {
  const s = g.standings.at(club);
  return s.u8(30) + s.u8(31);
};

/**
 * Tabellenmeldungen (0x143ED ab 0x14596): für die drei Zielplätze (Meisterschaft, UEFA-Cup-Platz
 * bzw. Aufstieg, Klassenerhalt) prüft das Original je Manager: "gesichert", wenn keine Mannschaft
 * unterhalb des Zielplatzes mit ihren restlichen Spielen die eigenen Punkte noch erreichen kann;
 * "verspielt", wenn die Mannschaft auf dem Zielplatz mehr Punkte hat als der Manager mit allen
 * restlichen Spielen erreichen kann. Jede Meldung erscheint einmal (Merkbits in 4238:4BEC, nicht
 * im Spielstand: Bits 0..2 verspielt, 3..5 gesichert); in der 2. Liga und Oberliga entfällt die
 * Meisterschaft. Nach dem 13. Juni schweigt die Routine.
 */
export function standingsMessages(g: GameState, manager: number, flags: { v: number }, date: { day: number; month0: number }): string[][] {
  const out: string[][] = [];
  if (date.month0 === 5 && date.day > 13) return out;
  const m = g.managers.at(manager);
  const league = m.u8(312);
  const teams = LEAGUES[league].teams;
  const places = [0, SECOND_PLACE[league], SAFE_PLACE[league]];
  const order = tableOrder(g, league);
  const my = m.clubIndex;
  const myPts = seasonPoints(g, my);
  const remaining = (LEAGUES[league].matchdays - gamesPlayed(g, my)) * POINTS_PER_WIN;
  const name = g.clubs.at(my).name;
  for (let kind = 0; kind < 3; kind++) {
    const place = places[kind];
    let maxBelow = 0;
    for (let p = place + 1; p < teams; p++) {
      const c = order[p];
      const reach = (LEAGUES[league].matchdays - gamesPlayed(g, c)) * POINTS_PER_WIN + seasonPoints(g, c);
      if (reach > maxBelow) maxBelow = reach;
    }
    if (maxBelow < myPts && !(flags.v & (1 << (kind + 3)))) {
      flags.v |= 1 << (kind + 3);
      if (!(league !== 0 && kind === 0)) {
        const what = kind === 0 ? T("quell.messages", 0) : kind === 1 ? (league === 0 ? T("quell.messages", 1) : T("quell.messages", 2)) : T("quell.messages", 3);
        out.push([name + " hat", what, T("quell.messages", 4)]);
      }
    }
    const holder = seasonPoints(g, order[place]);
    if (holder > remaining + myPts && !(flags.v & (1 << kind))) {
      flags.v |= 1 << kind;
      if (!(league !== 0 && kind === 0)) {
        const what = kind === 0 ? T("quell.messages", 5) : kind === 1 ? (league === 0 ? T("quell.messages", 6) : T("quell.messages", 7)) : T("quell.messages", 8);
        out.push([name + " hat", T("quell.messages", 9), what]);
      }
    }
  }
  return out;
}

/**
 * Deutscher Meister am Saisonende (0x1D6F6 ab 0x1DE87): Tabellenerster der Bundesliga; ist es ein
 * Managerverein, zählt das Original den Titel (Byte 57) und zeigt "<Verein> gewinnt die Deutsche
 * Meisterschaft" (0x1A36D). Liefert Verein und Manager (-1 = KI-Verein).
 */
/**
 * Relegationsmeldung (0x143ED ab 0x1445E): am 13. Juni bekommt der Manager, dessen Verein das
 * Relegationsspiel bestreitet, "Ihre Mannschaft bestreitet das Relegationsspiel. Viel Glück."
 * Das sind der Sechzehnte der Bundesliga (Platzbyte == 15) und der Dritte der 2. Liga (== 2).
 * Das Original hat die Meldung über die Konstante 4cb3:226A abgeschaltet; das Remake zeigt sie,
 * weil es das Relegationsspiel tatsächlich austrägt.
 */
export const relegationLines = (): string[] => texte("meldungen.relegation");

export function relegationMessage(g: GameState, manager: number, date: { day: number; month0: number }): string[] | null {
  if (date.day !== 13 || date.month0 !== 5) return null;
  const m = g.managers.at(manager);
  const league = m.u8(312);
  if (league > 1) return null;
  const platz = tableOrder(g, league).indexOf(m.clubIndex);
  return platz === (league === 0 ? 15 : 2) ? relegationLines() : null;
}

export function bookChampion(g: GameState): { club: number; manager: number } {
  const club = tableOrder(g, 0)[0];
  const manager = g.activeManagers().findIndex((m) => m.clubIndex === club);
  if (manager >= 0) {
    const m = g.managers.at(manager);
    m.setU8(57, (m.u8(57) + 1) & 0xff);
  }
  return { club, manager };
}

/** Pokalsieg eines Managervereins (0x192FC): Titel Byte 58 + Pokal, Abschlussbild "gewinnt den <Pokal>". */
export function bookCupTitle(g: GameState, cup: number, winner: number): number {
  const manager = g.activeManagers().findIndex((m) => m.clubIndex === winner);
  if (manager >= 0) {
    const m = g.managers.at(manager);
    m.setU8(58 + cup, (m.u8(58 + cup) + 1) & 0xff);
  }
  return manager;
}
