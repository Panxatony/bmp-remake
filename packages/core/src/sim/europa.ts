/**
 * Pokalwettbewerbe (DFB-Pokal, Europapokal der Landesmeister, der Pokalsieger, UEFA-Pokal)
 * und die Relegation, aus BMMAIN.EXE rekonstruiert:
 *
 *   Auslosung erste Runde        0x18600   Folgerunde 0x18FC2   Heimrecht Unterklassiger 0x18DA8
 *   Rundenabschluss              0x192FC (Hin-/Rückspiele, Sieger, Titelverteidiger) mit 0x196E6
 *   Hin-/Rückspielentscheid      0x19208   Verlängerung/Elfmeter 0x18E46, 0x666D
 *   Europapokalteilnehmer        0x18B12   Relegationstag 0x33C0
 *
 * Tabellen im Spielstand (siehe docs/MEMORY-MAP.md):
 *   28009  4238:76CA  Paarungen, 4 Bereiche x 32 Bytes (Bereich 0 DFB-Pokal, 1..3 Europapokale)
 *   28233  4238:0008  laufende Runde je Pokal (1-basiert)
 *   28241  4238:1D18  Europapokal 1..3: 1 = Hinspiel gespielt
 *   28304  4238:4C7E  Ergebnisse des Pokaltags, 4 x 32 (Heim +10 Verlängerung, +20 Elfmeter)
 *   28137  4238:21E2  Hinspielergebnisse Europapokal 1..3, gespiegelt (Gast, Heim)
 *   27978  4238:56FE  Liste der deutschen Europapokalteilnehmer
 *   27988  4238:57AA  deutsche Startplätze je Europapokal, 6 Bytes, 0x80 = frei
 *   2340   4cb3:07AC  DFB-Pokalsieger + 1; 2341..2343 Titelverteidiger der Europapokale + 1; 2344 Finalist + 1
 *   28244  4238:535A  Tabellenreihenfolge je Liga (20 Bytes)
 *   28007  4238:2E6E  Hinspielergebnis der Relegation; 34367 4238:3060 Ausgang (1 = Zweitligist steigt auf)
 */
import type { GameState } from "../records.ts";
import { texte } from "../data/texte.ts";
import type { Rng, MatchResult, TeamStrength } from "./match.ts";
import { simulateMatch, chanceCounts, chanceMinutes, goalDice } from "./match.ts";
import { matrixFor, bookEvents, afterMatch } from "./matchday.ts";
import { attendance, bookAttendance, bookGate } from "./attendance.ts";
import { riotCheck } from "./finance.ts";
import type { MatchSim } from "./live.ts";

const defaultSim: MatchSim = (_h, _a, hs, as, r) => simulateMatch(hs, as, r);

export const CUP_TABLE = 28009;
export const CUP_ROUND = 28233;
export const LEG_FLAG = 28241;
export const CUP_RESULTS = 28304;
export const FIRST_LEG = 28137;
export const EU_LIST = 27978;
export const EU_SLOTS = 27988;
export const DFB_WINNER = 2340;
export const HOLDER = 2341;
export const DFB_FINALIST = 2344;
export const ORDER_LIST = 28244;
export const PLAYOFF_FIRST_LEG = 28007;
export const PLAYOFF_RESULT = 34367;
/** Manager Byte 306 + Pokal: laufende Runde (1-basiert), 30 = ausgeschieden. */
export const CUP_OUT = 30;
/** Paare je Runde (4cb3:07D6), Index = Rundennummer. */
export const ROUND_PAIRS = [32, 16, 8, 4, 2, 1];
export const GERMAN_CLUBS = 58;
const UEFA_PLACES = 4;
const LEVEL_OFFSET = 34062;
/** Namen der vier Pokale, wie das Original sie schreibt ("DfB-Pokal", "Pokal der Landesmeister"). */
export const cupNames = (): string[] => texte("pokal.namen");

const area = (cup: number): number => CUP_TABLE + 32 * cup;
const resultArea = (cup: number): number => CUP_RESULTS + 32 * cup;
const legArea = (cup: number): number => FIRST_LEG + 32 * (cup - 1);

export function cupRoundOf(g: GameState, cup: number): number {
  return g.save.plain[CUP_ROUND + cup];
}

export function legPlayed(g: GameState, cup: number): boolean {
  return g.save.plain[LEG_FLAG + cup - 1] !== 0;
}

/** Paarungen der laufenden Runde eines Pokals (erster Verein Heim). */
export function currentPairs(g: GameState, cup: number): [number, number][] {
  const p = g.save.plain;
  const n = ROUND_PAIRS[Math.min(cupRoundOf(g, cup), 5)];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([p[area(cup) + 2 * i], p[area(cup) + 2 * i + 1]]);
  return out;
}

/** Tabellenreihenfolge einer Liga aus der gespeicherten Liste (Platz -> Verein). */
export function orderList(g: GameState, league: number): number[] {
  const n = league === 0 ? 18 : 20;
  return Array.from(g.save.plain.subarray(ORDER_LIST + 20 * league, ORDER_LIST + 20 * league + n));
}

/** 0x197D5: 1 Bundesliga, 2 Zweite Liga, 4 sonst (Oberliga und Ausland). */
const clubClass = (c: number): number => (c < 18 ? 1 : c < 38 ? 2 : 4);

/** 0x18DA8: auf einem Gastplatz (ungerader Index) spielt ein Unterklassiger vor Runde 4 zu Hause. */
function lowerClassHome(g: GameState, slot: number): void {
  const p = g.save.plain;
  if ((slot & 1) === 0) return;
  const a = p[CUP_TABLE + slot];
  const b = p[CUP_TABLE + slot - 1];
  if (clubClass(a) === 4 && clubClass(b) < 4 && p[CUP_ROUND] < 4) {
    p[CUP_TABLE + slot] = b;
    p[CUP_TABLE + slot - 1] = a;
  }
}

function setManagerRound(g: GameState, cup: number, club: number, value: number): void {
  g.activeManagers().forEach((m) => {
    if (m.clubIndex === club) m.setU8(306 + cup, value);
  });
}

/**
 * Auslosung der ersten Runde (0x18600). DFB-Pokal: die Managervereine bekommen zufällige
 * Plätze, die übrigen Plätze werden aus random(0, 58) ohne Doppelte gezogen, danach Heimrecht
 * für Unterklassige. Europapokal: 32 Auslandsvereine random(64, 199) ohne Doppelte über die drei
 * Europabereiche, dann ersetzen die deutschen Teilnehmer zufällige Plätze 1..31.
 */
export function initialDraw(g: GameState, cup: number, rng: Rng): void {
  const p = g.save.plain;
  const managers = g.activeManagers();
  p[CUP_ROUND + cup] = 0;
  const lo = cup ? 64 : 0;
  const hi = cup ? 199 : GERMAN_CLUBS;
  if (cup === 1) p.fill(0, FIRST_LEG, FIRST_LEG + 96);
  managers.forEach((m) => m.setU8(306 + cup, CUP_OUT));
  const managerSlots: number[] = [];
  if (cup === 0) {
    managers.forEach((m) => {
      let s: number;
      do s = rng(0, 31);
      while (managerSlots.includes(s));
      managerSlots.push(s);
      m.setU8(306, 1);
      p[area(0) + s] = m.clubIndex;
    });
  }
  const areas = cup === 0 ? [0] : [1, 2, 3];
  for (let slot = 0; slot < 32; slot++) {
    if (cup === 0 && managerSlots.includes(slot)) continue;
    for (;;) {
      const c = rng(lo, hi);
      let dup = false;
      for (const a of areas) {
        const n = a === cup ? slot : 32;
        for (let j = 0; j < n; j++) if (p[area(a) + j] === c) dup = true;
      }
      if (managers.some((m) => m.clubIndex === c)) dup = true;
      if (!dup) {
        p[area(cup) + slot] = c;
        break;
      }
    }
  }
  if (cup === 0) {
    for (let slot = 0; slot < 32; slot++) lowerClassHome(g, slot);
  } else {
    p[LEG_FLAG + cup - 1] = 0;
    for (let i = 0; i < 6; i++) {
      const club = p[EU_SLOTS + 6 * (cup - 1) + i];
      if (club === 0x80) break;
      let s: number;
      do s = rng(1, 31);
      while (p[area(cup) + s] < 64);
      p[area(cup) + s] = club;
      setManagerRound(g, cup, club, 1);
    }
  }
  p[CUP_ROUND + cup] = 1;
}

/**
 * Auslosung der Folgerunde (0x18FC2): die Sieger stehen auf den geraden Plätzen, werden
 * zusammengeschoben und mit zwanzig Zufallstauschen gemischt; benachbarte Plätze bilden
 * die Paare. Nach dem Finale (Runde 5) passiert nichts.
 */
export function nextRoundDraw(g: GameState, cup: number, rng: Rng): void {
  const p = g.save.plain;
  const round = p[CUP_ROUND + cup];
  if (round === 5) return;
  const n = ROUND_PAIRS[round];
  if (cup !== 0) p.fill(0, FIRST_LEG, FIRST_LEG + 96);
  p[CUP_ROUND + cup]++;
  const a = area(cup);
  for (let i = 0; i < n && i < 16; i++) p[a + i] = p[a + 2 * i];
  for (let k = 0; k < 20; k++) {
    const x = rng(1, n) - 1;
    const y = rng(1, n) - 1;
    const t = p[a + x];
    p[a + x] = p[a + y];
    p[a + y] = t;
  }
  if (cup === 0) for (let slot = 0; slot < n; slot++) lowerClassHome(g, slot);
}

/**
 * Entscheid eines Europapokal-Rückspiels (0x19208) aus Hinspiel (gespiegelt gespeichert)
 * und Rückspiel: 1 = der Gast des Rückspiels kommt weiter, 0 = der Gastgeber, 30 = offen
 * (Gesamttore und Auswärtstore gleich). Nach Saisontag 315 gilt ein einzelnes Spiel.
 */
export function decideTie(g: GameState, cup: number, idx: number, seasonDayNow: number): number {
  const p = g.save.plain;
  let h2 = p[resultArea(cup) + idx];
  while (h2 > 9) h2 -= 10;
  const a2 = p[resultArea(cup) + idx + 1];
  const f1 = p[legArea(cup) + idx]; // Tore des jetzigen Gastgebers im Hinspiel (auswärts)
  const f2 = p[legArea(cup) + idx + 1]; // Tore des jetzigen Gastes im Hinspiel (zu Hause)
  if (seasonDayNow > 315 && f2 + a2 - f1 === h2) return 30;
  if (f2 + a2 > f1 + h2) return 1;
  if (a2 + f2 - h2 !== f1) return 0;
  if (f1 < a2) return 1;
  return a2 === f1 ? 30 : 0;
}

export function clearCupResults(g: GameState): void {
  g.save.plain.fill(0, CUP_RESULTS, CUP_RESULTS + 128);
}

export interface CupMatch {
  cup: number;
  /** 0 = einzelnes Spiel, 1 Hinspiel, 2 Rückspiel */
  leg: number;
  home: number;
  away: number;
  result: MatchResult;
  extraTime: boolean;
  penalties?: [number, number];
  /** Sieger; beim Hinspiel undefiniert */
  winner?: number;
  attendance?: number;
  gate?: number;
  scorers: { minute: number; side: "home" | "away"; name: string }[];
}

/** Verlängerung 91..105 und 106..120 wie die Live-Schleife; der Heimwert trägt die Markierung +10. */
export function extraTime(home: TeamStrength, away: TeamStrength, r: MatchResult, rng: Rng): void {
  for (const [from, to] of [
    [91, 105],
    [106, 120],
  ] as const) {
    const n = chanceCounts(home, away, from, to, rng);
    const list: { minute: number; side: "home" | "away" }[] = [];
    for (const m of chanceMinutes(n.home, from, to, rng)) list.push({ minute: m, side: "home" });
    for (const m of chanceMinutes(n.away, from, to, rng)) list.push({ minute: m, side: "away" });
    list.sort((a, b) => a.minute - b.minute || (a.side === "home" ? -1 : 1));
    for (const c of list) {
      const goal = goalDice(home, away, c.side, c.minute, r.home + 10, r.away, rng);
      if (goal) c.side === "home" ? r.home++ : r.away++;
      r.events.push({ minute: c.minute, side: c.side, goal });
    }
  }
}

/**
 * Elfmeterschießen (0x666D). Ohne Managerbeteiligung: beide Seiten random(2,5) Treffer,
 * neu gewürfelt bis ungleich. Mit Managerbeteiligung (animiert): fünf Schützen je Seite,
 * Treffer bei random(0,2) = 2, Abbruch sobald entschieden, danach abwechselnd bis zur
 * Entscheidung; die zuerst schießende Seite ist random(0,1).
 */
export function shootout(rng: Rng, managerInvolved: boolean): [number, number] {
  if (!managerInvolved) {
    let h: number;
    let a: number;
    do {
      h = rng(2, 5);
      a = rng(2, 5);
    } while (h === a);
    return [h, a];
  }
  const score = [0, 0];
  const first = rng(0, 1);
  let side = first;
  let round = 0;
  for (;;) {
    if (round >= 5 && score[0] !== score[1] && side === first) break;
    if (rng(0, 2) === 2) score[side]++;
    if (side !== first) round++;
    side ^= 1;
    if (round > 30) break;
  }
  return [score[0], score[1]];
}

/**
 * Spielt ein Pokalspiel des Paars idx (Byteindex im Bereich) und trägt das Ergebnis in die
 * Ergebnistabelle ein (Heimwert +10 nach Verlängerung, +20 nach Elfmeterschießen, die
 * Elfmetertreffer zählen zu den Toren wie im Original). Verlängerung gibt es im DFB-Pokal
 * bei Gleichstand, im Europapokal nur im Rückspiel, wenn 0x19208 "offen" meldet.
 */
export function playCupMatch(g: GameState, cup: number, idx: number, secondLeg: boolean, seasonDayNow: number, rng: Rng, sim: MatchSim = defaultSim, zuschauer?: (home: number, away: number) => number | undefined): CupMatch {
  const p = g.save.plain;
  const home = p[area(cup) + idx];
  const away = p[area(cup) + idx + 1];
  const managers = g.activeManagers();
  const managerOf = new Map<number, number>();
  managers.forEach((m, i) => managerOf.set(m.clubIndex, i));
  const hs = matrixFor(g, home, rng);
  const as = matrixFor(g, away, rng);
  const result = sim(home, away, hs, as, rng);
  const ro = resultArea(cup) + idx;
  const write = (marker: number, pen: [number, number]) => {
    p[ro] = (result.home + pen[0] + marker) & 0xff;
    p[ro + 1] = (result.away + pen[1]) & 0xff;
  };
  write(0, [0, 0]);
  const undecided = () => (cup === 0 ? p[ro] % 10 === p[ro + 1] : secondLeg && decideTie(g, cup, idx, seasonDayNow) === 30);
  let extra = false;
  let penalties: [number, number] | undefined;
  if (undecided()) {
    extra = true;
    extraTime(hs, as, result, rng);
    write(10, [0, 0]);
    if (undecided()) {
      penalties = shootout(rng, managerOf.has(home) || managerOf.has(away));
      write(30, penalties);
    }
  }
  const leg = cup === 0 ? 0 : secondLeg ? 2 : 1;
  const match: CupMatch = { cup, leg, home, away, result, extraTime: extra, penalties, scorers: [] };
  if (cup === 0) match.winner = p[ro] % 10 > p[ro + 1] ? home : away;
  else if (secondLeg) match.winner = decideTie(g, cup, idx, seasonDayNow) === 1 ? away : home;
  const matchType = cup === 0 ? 1 : 2;
  match.scorers = bookEvents(g, home, away, result, matchType, rng);
  const mh = managerOf.get(home);
  const ma = managerOf.get(away);
  if (mh !== undefined) {
    const importance = cup === 0 ? 1 : p[CUP_ROUND + 1] > 4 ? 3 : 2;
    // Hat die Live-Konferenz die Zahl schon gezeigt, wird genau sie gebucht
    const att = zuschauer?.(home, away) ?? attendance(g, { manager: mh, home, away, cup: true, importance, level: p[LEVEL_OFFSET] }, rng);
    bookAttendance(g, mh, att, away);
    match.attendance = att;
    match.gate = bookGate(g, mh, att, 2);
    if (ma !== undefined) bookGate(g, ma, att, 2);
    riotCheck(g, mh, rng);
  }
  for (const mi of [mh, ma]) if (mi !== undefined) afterMatch(g, mi, matchType, rng);
  return match;
}

export interface CupFinal {
  cup: number;
  winner: number;
  loser: number;
}

/**
 * Rundenabschluss nach einem Pokaltag (0x192FC mit 0x196E6): Sieger nach vorn, Managerrunden,
 * Titelverteidiger nach dem Finale, Ergebnistabelle löschen, Folgerunde auslosen.
 * `init` entspricht dem Initialisierungsmodus 4238:57DC (Relegation): keine Managerbytes,
 * keine Titelverteidiger, kein Löschen, keine Auslosung.
 */
export function afterCupDay(g: GameState, cups: number[], seasonDayNow: number, rng: Rng, init = false): CupFinal[] {
  const p = g.save.plain;
  const finals: CupFinal[] = [];
  for (const cup of cups) {
    const round = p[CUP_ROUND + cup];
    const count = 2 * ROUND_PAIRS[Math.min(round, 5)];
    const a = area(cup);
    if (cup === 0) {
      const orig: [number, number] = [p[a], p[a + 1]];
      let winner = orig[0];
      let loser = orig[1];
      for (let idx = 0; idx < count; idx += 2) {
        let h = p[resultArea(0) + idx];
        while (h > 9) h -= 10;
        if (p[resultArea(0) + idx + 1] > h) {
          p[a + idx] = p[a + idx + 1];
          if (idx === 0) [winner, loser] = [orig[1], orig[0]];
        }
        if (!init) setManagerRound(g, 0, p[a + idx], round + 1);
      }
      if (count === 2) {
        p[DFB_WINNER] = winner + 1;
        p[DFB_FINALIST] = loser + 1;
        finals.push({ cup: 0, winner, loser });
        p[a] = orig[0];
        p[a + 1] = orig[1];
      }
      continue;
    }
    if (p[LEG_FLAG + cup - 1] === 0) {
      p[LEG_FLAG + cup - 1] = 1;
      for (let idx = 0; idx < count; idx += 2) {
        p[legArea(cup) + idx] = p[resultArea(cup) + idx + 1];
        p[legArea(cup) + idx + 1] = p[resultArea(cup) + idx];
        const t = p[a + idx];
        p[a + idx] = p[a + idx + 1];
        p[a + idx + 1] = t;
      }
      continue;
    }
    p[LEG_FLAG + cup - 1] = 0;
    let finalPair: [number, number] = [p[a], p[a + 1]];
    for (let idx = 0; idx < count; idx += 2) {
      const pair: [number, number] = [p[a + idx], p[a + idx + 1]];
      if (idx === 0) finalPair = pair;
      if (decideTie(g, cup, idx, seasonDayNow) !== 0) {
        p[a + idx] = pair[1];
        p[a + idx + 1] = pair[0];
      }
      if (!init) setManagerRound(g, cup, p[a + idx], round + 1);
    }
    if (count === 2 && !init) {
      const winner = p[a];
      p[HOLDER + cup - 1] = winner < 64 ? winner + 1 : 0;
      finals.push({ cup, winner, loser: p[a + 1] });
      p[a] = finalPair[0];
      p[a + 1] = finalPair[1];
    }
  }
  if (init) return finals;
  const first = cups[0];
  const roundNow = p[CUP_ROUND + (first === 0 ? 0 : 1)];
  if (first === 0 ? roundNow < 5 : p[LEG_FLAG] !== 0 || roundNow < 5) clearCupResults(g);
  for (const cup of cups) if (cup === 0 || p[LEG_FLAG + cup - 1] === 0) nextRoundDraw(g, cup, rng);
  return finals;
}

/** Spieltag der drei Europapokale (Kalenderflag 0x70): alle Paare der laufenden Runde. */
export function playEuropaDay(g: GameState, seasonDayNow: number, rng: Rng, sim: MatchSim = defaultSim, zuschauer?: (home: number, away: number) => number | undefined): { matches: CupMatch[]; finals: CupFinal[] } {
  const matches: CupMatch[] = [];
  for (const cup of [1, 2, 3]) {
    const n = ROUND_PAIRS[Math.min(cupRoundOf(g, cup), 5)];
    const second = legPlayed(g, cup);
    for (let i = 0; i < n; i++) matches.push(playCupMatch(g, cup, 2 * i, second, seasonDayNow, rng, sim, zuschauer));
  }
  const finals = afterCupDay(g, [1, 2, 3], seasonDayNow, rng);
  return { matches, finals };
}

/**
 * Relegation (0x33C0, Kalendertage mit Flag 0x10): Bundesliga-16. gegen Zweitliga-3. in Hin-
 * und Rückspiel über Bereich 1, Platz 0 (Hinspiel beim Zweitligisten). Der Ausgang steht in
 * 34367 (1 = der Zweitligist steigt auf), das Hinspiel in 28007.
 */
export function playPlayoffDay(g: GameState, seasonDayNow: number, rng: Rng, sim: MatchSim = defaultSim): CupMatch {
  const p = g.save.plain;
  p[CUP_ROUND + 1] = 5;
  const a = area(1);
  const saved = [p[a], p[a + 1], p[resultArea(1)], p[resultArea(1) + 1], p[legArea(1)], p[legArea(1) + 1]];
  const second = p[LEG_FLAG] !== 0;
  p[resultArea(1)] = p[resultArea(1) + 1] = 0;
  for (let i = 0; i < 2; i++) p[legArea(1) + i] = second ? p[PLAYOFF_FIRST_LEG + i] : 0;
  const bl16 = p[ORDER_LIST + 15];
  const third = p[ORDER_LIST + 22];
  p[a] = second ? bl16 : third;
  p[a + 1] = second ? third : bl16;
  const match = playCupMatch(g, 1, 0, second, seasonDayNow, rng, sim);
  afterCupDay(g, [1], seasonDayNow, rng, true);
  if (p[LEG_FLAG] === 0) p[PLAYOFF_RESULT] = decideTie(g, 1, 0, seasonDayNow);
  else for (let i = 0; i < 2; i++) p[PLAYOFF_FIRST_LEG + i] = p[legArea(1) + i];
  [p[a], p[a + 1], p[resultArea(1)], p[resultArea(1) + 1], p[legArea(1)], p[legArea(1) + 1]] = saved;
  return match;
}

/**
 * Deutsche Europapokalteilnehmer am Saisonende (0x18B12): Meister (und Titelverteidiger des
 * Landesmeisterpokals, ersatzweise der Vizemeister) in den Landesmeisterpokal; DFB-Pokalsieger
 * (ersatzweise Finalist) und Titelverteidiger des Pokalsiegerpokals in den Pokalsiegerpokal;
 * Titelverteidiger des UEFA-Pokals und die nächsten vier der Tabelle in den UEFA-Pokal.
 */
export function europeanParticipants(g: GameState): void {
  const p = g.save.plain;
  const order = orderList(g, 0);
  p.fill(0x80, EU_SLOTS, EU_SLOTS + 18);
  const list: number[] = [];
  const slots: number[][] = [[], [], []];
  const add = (cup: number, c: number) => {
    slots[cup].push(c);
    list.push(c);
  };
  const inList = (c: number) => list.includes(c);
  add(0, order[0]);
  if (p[HOLDER] !== 0) add(0, inList(p[HOLDER] - 1) ? order[1] : p[HOLDER] - 1);
  if (p[DFB_WINNER] !== 0) {
    if (!inList(p[DFB_WINNER] - 1)) add(1, p[DFB_WINNER] - 1);
    else if (p[DFB_FINALIST] !== 0 && !inList(p[DFB_FINALIST] - 1)) add(1, p[DFB_FINALIST] - 1);
  }
  if (p[HOLDER + 1] !== 0) {
    if (!inList(p[HOLDER + 1] - 1)) add(1, p[HOLDER + 1] - 1);
    else if (p[DFB_FINALIST] !== 0 && !inList(p[DFB_FINALIST] - 1)) add(1, p[DFB_FINALIST] - 1);
  }
  let uefa = UEFA_PLACES;
  if (p[HOLDER + 2] !== 0) {
    if (!inList(p[HOLDER + 2] - 1)) add(2, p[HOLDER + 2] - 1);
    else uefa++;
  }
  for (let pos = 1; uefa > 0 && pos < order.length; pos++) {
    if (inList(order[pos])) continue;
    add(2, order[pos]);
    uefa--;
  }
  slots.forEach((s, cup) => s.slice(0, 6).forEach((c, i) => (p[EU_SLOTS + 6 * cup + i] = c)));
  list.slice(0, 10).forEach((c, i) => (p[EU_LIST + i] = c));
}

/** Vereinsplätze a und b in allen Pokal- und Europatabellen vertauschen (Ergänzung zu swapClubs). */
export function remapCupClubs(g: GameState, a: number, b: number): void {
  const p = g.save.plain;
  const map = (v: number) => (v === a ? b : v === b ? a : v);
  for (let i = 0; i < 128; i++) p[CUP_TABLE + i] = map(p[CUP_TABLE + i]);
  for (let i = 0; i < 60; i++) p[ORDER_LIST + i] = map(p[ORDER_LIST + i]);
  for (let i = 0; i < 10; i++) p[EU_LIST + i] = map(p[EU_LIST + i]);
  for (let i = 0; i < 18; i++) if (p[EU_SLOTS + i] !== 0x80) p[EU_SLOTS + i] = map(p[EU_SLOTS + i]);
  for (const o of [DFB_WINNER, HOLDER, HOLDER + 1, HOLDER + 2, DFB_FINALIST]) if (p[o] !== 0) p[o] = map(p[o] - 1) + 1;
}
