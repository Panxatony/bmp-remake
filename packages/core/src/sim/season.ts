/**
 * Saisonwechsel (Tagesablauf 0x1E4xx..0x1EA3B mit Tausch 0x3C24, Ligamischen 0x3AC5,
 * Pokalauslosung 0x18B12, Managerereignisse 0x0CB62, Datum 0x4290).
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "Saisonwechsel". Teile sind Näherungen.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { TABLES, SCALARS } from "../records.ts";
import { LEAGUES } from "./fixtures.ts";
import { writePairings } from "./matchday.ts";
import { tableOrder } from "./standings.ts";
import { resetPoachCounts } from "./abwerben.ts";
import { CAL_OFFSET, CALENDAR_DAYS, DAY_INDEX_OFFSET, setDayIndex, seasonStartYear } from "./calendar.ts";
import { initialDraw, clearCupResults, europeanParticipants, remapCupClubs, orderList, PLAYOFF_RESULT } from "./europa.ts";
import { seasonEndAdvertising, generateOffers } from "./werbung.ts";
import { texte } from "../data/texte.ts";
import { seasonEvents, type SeasonEvent } from "./seasonEvents.ts";

/** Kalendervorlage (Bitfeld 34227 aus dem Spielstand ohne Nachholmarken 0x80). */
export const CALENDAR_TEMPLATE = [7, 112, 7, 0, 7, 112, 7, 6, 8, 0, 7, 0, 7, 6, 7, 112, 7, 7, 7, 112, 7, 0, 8, 1, 7, 6, 7, 0, 7, 6, 8, 112, 7, 0, 7, 112, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 0, 7, 112, 8, 7, 7, 112, 7, 6, 7, 0, 7, 0, 7, 0, 7, 112, 7, 0, 7, 112, 7, 0, 7, 0, 8, 0, 7, 0, 7, 16, 16, 0, 0];

/** Tauscht die Vereinsplätze a und b: Vereinsdatensatz, Tabellendatensatz, Spielerzugehörigkeit, Managerverein (0x3C24). */
export function swapClubs(g: GameState, a: number, b: number): void {
  if (a === b) return;
  const p = g.save.plain;
  const swap = (base: number, size: number) => {
    const oa = base + a * size;
    const ob = base + b * size;
    for (let i = 0; i < size; i++) {
      const t = p[oa + i];
      p[oa + i] = p[ob + i];
      p[ob + i] = t;
    }
  };
  swap(TABLES.clubs.offset, TABLES.clubs.record);
  swap(TABLES.standings.offset, TABLES.standings.record);
  // Historieblock 28435 (4238:9336): je Manager 640 Bytes Bilanz gegen jeden Verein (10 je Verein),
  // ab +2560 21 Bytes je Verein, ab +3988 und +4500 je 8 Bytes je Verein
  const HIST = 28435;
  for (let m = 0; m < 4; m++) swap(HIST + m * 640, 10);
  swap(HIST + 2560, 21);
  swap(HIST + 3988, 8);
  swap(HIST + 4500, 8);
  for (const pl of g.players.toArray()) {
    if (pl.isEmpty) continue;
    const o = pl.u8(36);
    if (o === a) pl.setU8(36, b);
    else if (o === b) pl.setU8(36, a);
  }
  // Über den Setzer, damit die Liga (Byte 312) mitwandert - beim Auf- und Abstieg wechselt hier
  // das Ligaband des Vereins (GitLab #76)
  g.activeManagers().forEach((m) => {
    if (m.clubIndex === a) m.clubIndex = b;
    else if (m.clubIndex === b) m.clubIndex = a;
  });
  remapCupClubs(g, a, b);
}

/** Eintrag in die Managerhistorie (Byte 62 + 4i: Rang 1..58 über alle Ligen, Pokalrunde, Liga 1..3, Europa). */
export function writeHistory(g: GameState): void {
  const orders = [0, 1, 2].map((l) => tableOrder(g, l));
  g.activeManagers().forEach((m) => {
    const c = m.clubIndex;
    const league = c < 18 ? 0 : c < 38 ? 1 : 2;
    const pos = orders[league].indexOf(c);
    const rank = [0, 18, 38][league] + pos + 1;
    for (let i = 0; i < 20; i++) {
      const o = 62 + 4 * i;
      if (m.u8(o) !== 0) continue;
      m.setU8(o, rank);
      m.setU8(o + 1, m.u8(306));
      m.setU8(o + 2, league + 1);
      m.setU8(o + 3, 0);
      break;
    }
  });
}

export interface Relegation {
  up: number[];
  down: number[];
  /** Relegation Bundesliga-16. gegen Zweitliga-3. (Ausgang aus 34367) */
  playoff?: { home: number; away: number; winner: number };
  /** Lizenzentzug (Kontostand unter -2 Mio, Tagesablauf 0x1E3DA): betroffene Vereine */
  licence: number[];
}

/**
 * Auf- und Abstieg (Tabellen 4cb3:2266 = Abstiegsplätze [3,4,4], 4cb3:226A = Relegation [1,0,0]):
 * Bundesliga 17./18. direkt, 16. im Relegationsspiel gegen den Dritten der 2. Liga; 2. Liga
 * 1./2. auf, 17.-20. ab; Oberliga 1.-4. auf. Lizenzentzug: Managerverein der Bundesliga oder
 * 2. Liga mit Kontostand unter -2.000.000 DM steigt zusätzlich ab (Flag 4 in Byte 320).
 */
export function promoteRelegate(g: GameState, rng?: Rng): Relegation {
  const res: Relegation = { up: [], down: [], licence: [] };
  const bl = tableOrder(g, 0);
  const l2 = tableOrder(g, 1);
  const ol = tableOrder(g, 2);
  // Lizenzentzug
  g.activeManagers().forEach((m) => {
    if (m.i32(496) < -2000000 && m.clubIndex < 38) res.licence.push(m.clubIndex);
  });
  const isDown = (c: number) => res.licence.includes(c);
  // Bundesliga: 17., 18. ab (Lizenzentzug ersetzt von unten her), 16. Relegation
  let downBl = [bl[17], bl[16]];
  for (const c of res.licence.filter((c) => c < 18)) if (!downBl.includes(c)) downBl.push(c);
  downBl = downBl.slice(0, Math.max(2, res.licence.filter((c) => c < 18).length + 2));
  const relegationClub: number | undefined = isDown(bl[15]) ? undefined : bl[15];
  const upL2 = [l2[0], l2[1]];
  const third = l2[2];
  // Relegation: Hin- und Rückspiel an den Kalendertagen 91/92 (europa.ts), Ausgang in 34367
  if (relegationClub !== undefined) {
    const home = relegationClub;
    const away = third;
    const winner = g.save.plain[PLAYOFF_RESULT] === 1 ? away : home;
    res.playoff = { home, away, winner };
    if (winner === away) {
      downBl.push(home);
      upL2.push(away);
    }
  }
  void rng;
  // Tausch Bundesliga <-> 2. Liga (paarweise)
  const pairsBl = Math.min(downBl.length, upL2.length);
  for (let i = 0; i < pairsBl; i++) {
    res.down.push(downBl[i]);
    res.up.push(upL2[i]);
    swapClubs(g, downBl[i], upL2[i]);
  }
  // 2. Liga <-> Oberliga: vier Absteiger (nach Lizenzentzug ergänzt), vier Aufsteiger
  const l2now = tableOrder(g, 1);
  let downL2 = [l2now[19], l2now[18], l2now[17], l2now[16]];
  for (const c of res.licence.filter((c) => c >= 18 && c < 38)) if (!downL2.includes(c)) downL2.unshift(c);
  downL2 = downL2.slice(0, 4);
  const upOl = [ol[0], ol[1], ol[2], ol[3]];
  for (let i = 0; i < 4; i++) {
    res.down.push(downL2[i]);
    res.up.push(upOl[i]);
    swapClubs(g, downL2[i], upOl[i]);
  }
  return res;
}

/** Mischt die Plätze innerhalb jeder Liga (0x3AC5: 55 Zufallstausche je Liga). */
export function shuffleLeagues(g: GameState, rng: Rng): void {
  for (const L of LEAGUES) {
    for (let i = 0; i < 55; i++) swapClubs(g, L.base + rng(0, L.teams - 1), L.base + rng(0, L.teams - 1));
  }
}

/** Neue Saison: Tabellen, Ergebnisse, Spieltage, Kalender, Datum, Statistiken, Alter, Verträge, Pokal. */
import { driftClubs } from "./ai.ts";
import { seasonPlayerPool, distributePlayers } from "./pool.ts";

export function newSeason(g: GameState, rng: Rng, verlaengerung = false): SeasonEvent[] {
  const p = g.save.plain;
  writeHistory(g);
  // Vereinsmatrix zum Saisonbeginn neu gewürfelt (0x10067 mit 10, 0x1E665)
  driftClubs(g, 10, rng);
  // Europapokalteilnehmer aus der Abschlusstabelle (0x18B12); Vereinstausche werden mitgeführt
  europeanParticipants(g);
  const managersBefore = g.activeManagers().map((m) => m.clubIndex);
  const moves = promoteRelegate(g, rng);
  const flags = managersBefore.map((c) => (moves.up.includes(c) ? 1 : moves.licence.includes(c) ? 4 : moves.down.includes(c) ? 2 : 0));
  // Verträge laufen vor den Ereignissen ab (Original: Alterung im Ereignisbildschirm)
  for (let i = 0; i < 100; i++) {
    const l = g.lineups.at(i);
    if (!l.isEmpty && l.u8(11) > 0) l.setU8(11, l.u8(11) - 1);
  }
  const events = seasonEvents(g, flags, rng, verlaengerung);
  shuffleLeagues(g, rng);
  // Spielerpool der KI-Vereine nach den Vertragsdialogen (0x0DB40 -> 0x0F2A6)
  seasonPlayerPool(g, rng);
  // Tabellen: alles außer Ewigkeitspunkten (i32 bei 50) löschen, Ewigkeitspunkte += Saisonpunkte
  for (let c = 0; c < 58; c++) {
    const s = g.standings.at(c);
    const allTime = s.i32(50) + s.u8(0) + s.u8(1);
    for (let i = 0; i < TABLES.standings.record; i++) s.setU8(i, 0);
    for (let i = 0; i < 4; i++) s.setU8(50 + i, (allTime >>> (8 * i)) & 0xff);
    s.setU8(46, c - (c < 18 ? 0 : c < 38 ? 18 : 38));
    p[28244 + (c < 18 ? c : c < 38 ? 20 + c - 18 : 40 + c - 38)] = c;
  }
  p.fill(0, TABLES.results.offset, TABLES.results.offset + TABLES.results.length);
  for (let l = 0; l < 3; l++) {
    p[SCALARS.nextMatchday + l] = 1;
    writePairings(g, l, 1);
  }
  p.fill(0, 5457, 5457 + 100); // Nachholspiele
  resetPoachCounts(g); // Abwerbungen der Version 2026 gelten je Saison
  for (let i = 0; i < CALENDAR_DAYS; i++) p[CAL_OFFSET + i] = CALENDAR_TEMPLATE[i];
  // Datum: 29. Juli des Folgejahres, Tagindex 0
  const year = seasonStartYear(g) + 1;
  p[SCALARS.year] = year & 0xff;
  p[SCALARS.year + 1] = (year >> 8) & 0xff;
  p[SCALARS.monthIndex] = 6;
  p[DAY_INDEX_OFFSET] = 0;
  setDayIndex(g, 0);
  // Spieler: Saisonstatistik zurück. Ein Jahr älter werden sie schon in seasonEvents, direkt
  // vor dem Karriereende (0x0D420, #81)
  for (const pl of g.players.toArray()) {
    if (pl.isEmpty) continue;
    pl.setU8(34, 0);
    pl.setU8(35, 0);
  }
  // Kaderplätze aller Manager und Transfermarkt: Vertragsjahr weniger, Karten/Tore/Einsätze zurück
  for (let i = 0; i < 125; i++) {
    const l = g.lineups.at(i);
    if (l.isEmpty) continue;
    // Saisontore in Liga, Pokal und Europapokal (Bytes 3, 4, 5) - Byte 5 wird seit GitLab #85
    // gebucht; in den Originalspielständen steht es bei 0, auch wo die Karrieresumme 38 nicht 0 ist
    for (const off of [1, 3, 4, 5, 6, 7]) l.setU8(off, 0);
    for (const off of [28, 29, 30, 31, 34, 35, 36, 37]) l.setU8(off, 0);
    l.setU8(9, l.u8(9) & 0x3f);
  }
  // Manager: Krawall-Flag, Zuschauerhistorie; Werbung (0x0CC00) und neue Sponsorenangebote (0x176F4).
  // Die Werbeverträge rührt das Original nur nach einem Aufstieg an (0x0D924); lief der
  // Trikotvertrag noch, erklärt danach der Hinweiskasten, warum die Einnahmen bleiben (0x0CC77).
  g.activeManagers().forEach((m, i) => {
    m.setU8(314, 0);
    m.setU8(318, m.u8(318) & ~1);
    if ((flags[i] ?? 0) & 1) {
      const zeilen = texte("ui.werbepartner");
      if (seasonEndAdvertising(g, i)) events.push({ manager: i, text: zeilen.join(" "), kasten: zeilen });
    }
    generateOffers(g, i, rng);
  });
  // Pokale: Ergebnistabelle löschen (0x1978D), alle vier Wettbewerbe auslosen (0x18600)
  // Spieler ohne Verein bekommen zu Spielbeginn einen (0x942A -> 0x1643B)
  distributePlayers(g, false, rng);
  clearCupResults(g);
  g.save.plain[PLAYOFF_RESULT] = 0;
  for (let cup = 0; cup < 4; cup++) initialDraw(g, cup, rng);
  void orderList;
  return events;
}
