/**
 * Ein Ligaspieltag im Ganzen: Stärkematrizen, Simulation aller Spiele, Ergebnisse
 * in die Ergebnistabelle, Tabellenfortschreibung, nächster Spieltag und neue Paarungen.
 */
import type { MatchSim } from "./live.ts";
import { TABLES } from "../records.ts";
import type { GameState } from "../records.ts";
import type { Rng, TeamStrength, MatchResult } from "./match.ts";
import { simulateMatch } from "./match.ts";
import { strengthInput, teamStrength } from "./strength.ts";
import { applyResult, updatePositions } from "./standings.ts";
import { fixtures, LEAGUES } from "./fixtures.ts";
import { bookGoal, bookMissedChance, bookDefence } from "./goals.ts";
import { attendance, bookAttendance, bookGate } from "./attendance.ts";
import { bookHistory } from "./history.ts";
import { isForfeit, bookForfeit, matchIncidents, type Incident } from "./incidents.ts";
import { creditAiGoals, bookBaseBonus } from "./ai.ts";
import { riotCheck } from "./finance.ts";
import { SCALARS } from "../records.ts";

export interface PlayedMatch {
  home: number;
  away: number;
  result: MatchResult;
  /** Zuschauer und Einnahmen, wenn der Heimverein ein Managerverein ist */
  attendance?: number;
  gate?: number;
  /** Torschützen der Managervereine */
  scorers: { minute: number; side: "home" | "away"; name: string; goals?: number; assist?: string }[];
  /** Manager, dessen Spiel 0:2 gewertet wurde (weniger als acht einsatzfähige Starter) */
  forfeit?: number;
  /** Karten und Verletzungen der Managervereine */
  incidents?: Incident[];
}

/** Stärkematrix eines Vereins; Managervereine über den Spielweg aus der Aufstellung. */
export function matrixFor(g: GameState, club: number, rng: Rng): TeamStrength {
  const managers = g.activeManagers();
  for (let i = 0; i < managers.length; i++) {
    if (managers[i].clubIndex === club) return teamStrength(strengthInput(g, i), rng, true);
  }
  return g.clubs.at(club).strengthMatrix;
}

/** Schreibt ein Ergebnis in die Ergebnistabelle (Spieltag 0-basiert). */
export function writeResult(g: GameState, league: number, matchday: number, match: number, home: number, away: number): void {
  const o = TABLES.results.offset + (league * 38 + matchday) * 20 + match * 2;
  g.save.plain[o] = home;
  g.save.plain[o + 1] = away;
}

/** Schreibt die Paarungen eines Spieltags in den Paarungsblock. */
export function writePairings(g: GameState, league: number, matchday: number): void {
  const from = [0, 20, 40][league];
  const pairs = fixtures(league, matchday);
  const b = g.save.plain;
  pairs.forEach(([h, a], i) => {
    b[TABLES.tableOrder.offset + from + 2 * i] = h;
    b[TABLES.tableOrder.offset + from + 2 * i + 1] = a;
  });
}

/**
 * Spielt den anstehenden Spieltag einer Liga. `postponed` sind Spielnummern, die
 * verlegt werden (Marke 30). Danach zeigt nextMatchday auf den folgenden Spieltag
 * und der Paarungsblock enthält dessen Paarungen.
 */
export interface LiveBooking {
  /** Manager, deren Spiel schon vor dem Anpfiff 0:2 gewertet wurde */
  forfeit: (manager: number) => boolean;
  /** Karten und Verletzungen, die in der Konferenz schon gebucht sind */
  incidents: (manager: number) => Incident[];
}

export function playMatchday(g: GameState, league: number, rng: Rng, postponed: number[] = [], sim: MatchSim = (_h, _a, hs, as, r) => simulateMatch(hs, as, r), attendanceOf?: (home: number, away: number) => number | undefined, live?: LiveBooking): PlayedMatch[] {
  const md1 = g.nextMatchday(league);
  const md = md1 - 1;
  const pairs = g.pairings(league);
  const out: PlayedMatch[] = [];
  pairs.forEach(([home, away], m) => {
    if (postponed.includes(m)) {
      writeResult(g, league, md, m, 30, 0);
      return;
    }
    const gespielt = spieleEins(g, league, md, m, home, away, rng, sim, attendanceOf, live);
    out.push(gespielt);
  });
  // Einsätze und Tore der Spieler der KI-Vereine (0x160A2 am Ende des Spieltags)
  for (const p of out) {
    creditAiGoals(g, p.home, p.result.home, rng);
    creditAiGoals(g, p.away, p.result.away, rng);
  }
  updatePositions(g, league, md1);
  if (md1 < LEAGUES[league].matchdays) {
    g.save.plain[SCALARS.nextMatchday + league] = md1 + 1;
    writePairings(g, league, md1 + 1);
  }
  return out;
}

/**
 * Ein einzelnes Spiel austragen und buchen: Wertung, Tabelle, Historie, Schützen, Vorfälle,
 * Zuschauer und die Nachbereitung der beteiligten Manager. `matchday` ist 0-basiert.
 */
function spieleEins(
  g: GameState,
  league: number,
  md: number,
  m: number,
  home: number,
  away: number,
  rng: Rng,
  sim: MatchSim,
  attendanceOf?: (home: number, away: number) => number | undefined,
  live?: LiveBooking,
): PlayedMatch {
  {
    const managers = g.activeManagers();
    const mHome = managers.findIndex((mg) => mg.clubIndex === home);
    const mAway = managers.findIndex((mg) => mg.clubIndex === away);
    let forfeit: number | undefined;
    const check = (mi: number) => (live ? live.forfeit(mi) : isForfeit(g, mi));
    if (mHome >= 0 && check(mHome)) forfeit = mHome;
    else if (mAway >= 0 && check(mAway)) forfeit = mAway;
    const result = forfeit !== undefined ? { home: forfeit === mHome ? 0 : 2, away: forfeit === mHome ? 2 : 0, events: [] } : sim(home, away, matrixFor(g, home, rng), matrixFor(g, away, rng), rng);
    if (forfeit !== undefined) bookForfeit(g, forfeit);
    writeResult(g, league, md, m, result.home, result.away);
    applyResult(g, home, away, result.home, result.away);
    bookHistory(g, home, away, result.home, result.away);
    bookBaseBonus(g, home, result.home - result.away, rng);
    bookBaseBonus(g, away, result.away - result.home, rng);
    const scorers = bookEvents(g, home, away, result, 0, rng);
    const played: PlayedMatch = { home, away, result, scorers, forfeit };
    if (forfeit === undefined) {
      const incidents: Incident[] = [];
      for (const mi of [mHome, mAway]) if (mi >= 0) incidents.push(...(live ? live.incidents(mi) : matchIncidents(g, mi, rng)));
      if (incidents.length) played.incidents = incidents;
    }
    g.activeManagers().forEach((mg, i) => {
      if (mg.clubIndex !== home) return;
      const att = attendanceOf?.(home, away) ?? attendance(g, { manager: i, home, away, level: g.save.plain[34062] }, rng);
      bookAttendance(g, i, att, away);
      played.attendance = att;
      played.gate = bookGate(g, i, att);
      riotCheck(g, i, rng);
    });
    g.activeManagers().forEach((mg, i) => {
      if (mg.clubIndex === home || mg.clubIndex === away) afterMatch(g, i, 0, rng);
    });
    return played;
  }
}

/**
 * Nachholspiele eines Tages austragen (0x5C1A zeigt dazu die Seite "NACHHOLSPIELE"). Die
 * Paarung steht nicht im Paarungsblock, sondern kommt aus dem Spielplan des damaligen
 * Spieltags; nextMatchday und der Paarungsblock bleiben unberührt.
 */
export function playReplays(
  g: GameState,
  eintraege: { league: number; matchday: number; match: number }[],
  rng: Rng,
  sim: MatchSim = (_h, _a, hs, as, r) => simulateMatch(hs, as, r),
  attendanceOf?: (home: number, away: number) => number | undefined,
  live?: LiveBooking,
): PlayedMatch[] {
  const out: PlayedMatch[] = [];
  for (const e of eintraege) {
    const paar = fixtures(e.league, e.matchday)[e.match];
    if (!paar) continue;
    const [home, away] = paar;
    const played = spieleEins(g, e.league, e.matchday - 1, e.match, home, away, rng, sim, attendanceOf, live);
    out.push(played);
    creditAiGoals(g, home, played.result.home, rng);
    creditAiGoals(g, away, played.result.away, rng);
  }
  for (const league of new Set(out.length ? eintraege.map((e) => e.league) : [])) updatePositions(g, league, g.nextMatchday(league));
  return out;
}

/** Tore und Chancen der Managervereine buchen (Schützen, Statistik, Bewertung). */
export function bookEvents(g: GameState, home: number, away: number, result: MatchResult, matchType: number, rng: Rng): PlayedMatch["scorers"] {
  const managerOf = new Map<number, number>();
  g.activeManagers().forEach((mg, i) => managerOf.set(mg.clubIndex, i));
  const scorers: PlayedMatch["scorers"] = [];
  for (const e of result.events) {
    const attacker = managerOf.get(e.side === "home" ? home : away);
    const defender = managerOf.get(e.side === "home" ? away : home);
    if (attacker !== undefined) {
      if (e.goal) {
        const rec = bookGoal(g, attacker, matchType, rng);
        if (rec) {
          // Das Original nennt unter der Szene auch die Torzahl des Schützen und den
          // Vorlagengeber ("Torsch}tze: GUTBERIET (2) / nach Vorlage von BREITZKE")
          const squad = g.squadOf(attacker);
          const l = squad[rec.scorer];
          const tore = l ? l.leagueGoals + l.cupGoals : 0;
          const vorlage = rec.assist >= 0 && squad[rec.assist] ? g.players.at(squad[rec.assist].playerIndex).displayName : undefined;
          scorers.push({ minute: e.minute, side: e.side, name: rec.scorerName, goals: tore, assist: vorlage });
        }
      } else bookMissedChance(g, attacker, rng);
    }
    if (defender !== undefined) bookDefence(g, defender, e.goal);
  }
  return scorers;
}

/**
 * Nachbereitung eines Managervereins nach einem Spiel (Spielvorbereitung 0x1C632,
 * Kaderteil ab 0x1CC4A). matchType 0 = Liga, 1 = Pokal, sonst Freundschafts-/Europaspiel.
 * Je Kaderplatz: bei Ligaspielen zählt eine laufende Sperre (Byte 13) herunter, wenn
 * Flag-Bit 0 gesetzt ist; Byte 21 wird gelöscht; Starter (Nummer 1..11) bekommen
 * Frische + 6 + random(2,4) - [Kondition > Technik des Spielers], bei Liga einen
 * Einsatz in der Spielertabelle (Byte 35), bei Liga/Pokal einen Einsatz in Byte 6/7
 * und im 16-Bit-Zähler bei 28/30. Frische wird auf 50..150 begrenzt.
 */
export function afterMatch(g: GameState, manager: number, matchType: number, rng: Rng): void {
  for (const l of g.squadOf(manager)) {
    if ((l.u8(9) & 1) === 1 && l.u8(13) > 0 && matchType === 0) l.setU8(13, l.u8(13) - 1);
    l.setU8(21, 0);
    if (l.number >= 1 && l.number <= 11) {
      const p = g.players.at(l.playerIndex);
      const fit = p.u8(28) > p.u8(29) ? 1 : 0;
      l.setU8(19, (l.u8(19) + rng(2, 4) - fit + 6) & 0xff);
      if (matchType === 0) p.setU8(35, p.u8(35) + 1);
      if (matchType <= 1) {
        l.setU8(6 + matchType, l.u8(6 + matchType) + 1);
        const o = 28 + 2 * matchType;
        const v = (l.u8(o) | (l.u8(o + 1) << 8)) + 1;
        l.setU8(o, v & 0xff);
        l.setU8(o + 1, (v >> 8) & 0xff);
      }
    }
    if (l.u8(19) < 50) l.setU8(19, 50);
    if (l.u8(19) > 150) l.setU8(19, 150);
  }
}
