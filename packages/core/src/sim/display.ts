import { FLAG_CUP, FLAG_EUROPE, FLAG_LEAGUE, calendarFlag, dayIndex, dateOfSeasonDay, seasonDay, seasonStartYear, CALENDAR_DAYS } from "./calendar.ts";
import { texte, text as T } from "../data/texte.ts";
/**
 * Reine Anzeigen des Hauptmenüs: Vereinsstärken (Wappen-Untermenü "Stärken"), Spieltag mit
 * Paarungen und Ergebnissen ("Spiele"), Bestenliste ("Die Besten der Liga") und
 * Pokalrunden. Datenquellen: Vereinsmatrix (Bytes 24..32), Ergebnistabelle, Spielerbytes
 * 34/35 (Tore/Einsätze), Pokaltabellen (sim/europa.ts).
 */
import type { GameState } from "../records.ts";
import { fixtures, LEAGUES } from "./fixtures.ts";
import { tableOrder } from "./standings.ts";
import { currentPairs, cupRoundOf, ROUND_PAIRS, CUP_RESULTS, FIRST_LEG, cupNames } from "./europa.ts";
import { seriesCurrent, seriesRecord, clubRecords, type ClubRecord } from "./history.ts";
import { monthlyIncome, monthlyExpenses, loanTotal, INTEREST_CAP } from "./finance.ts";
import { is2026 } from "./regeln.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/**
 * Kondition, Technik, Form eines Vereins als Mittel der drei Linien der Matrix, dazu die
 * Gesamtstärke. Die Gesamtstärke mittelt alle neun Werte der Matrix auf einmal, nicht die drei
 * schon gekürzten Linienmittel - in DOSBox nachgemessen: der 1.FC Nürnberg zeigt mit
 * (72,86,54) die Stärke 71, nicht 70 (GitLab #55).
 */
export function clubStrength(g: GameState, club: number): { ko: number; te: number; fo: number; total: number } {
  const c = g.clubs.at(club);
  const avg = (o: number) => div(c.u8(o) + c.u8(o + 1) + c.u8(o + 2), 3);
  let summe = 0;
  for (let o = 24; o < 33; o++) summe += c.u8(o);
  return { ko: avg(24), te: avg(27), fo: avg(30), total: div(summe, 9) };
}

/**
 * Datum eines Spieltags (1-basiert): der Spieltag ist der n-te Kalendertag mit dem Ligabit.
 * Das Original nennt es in der Überschrift der Spielübersicht ("SPIELE Bundesliga
 * 11.SPIELTAG 7.10."), genauso wie bei den Pokalrunden.
 */
export function matchdayDate(g: GameState, league: number, matchday: number): { day: number; month0: number; year: number } | null {
  let n = 0;
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    if ((calendarFlag(g, i) & FLAG_LEAGUE[league]) === 0) continue;
    if (++n === matchday) return dateOfSeasonDay(seasonDay(i), seasonStartYear(g));
  }
  return null;
}

export interface StrengthRow {
  place: number;
  club: number;
  ko: number;
  te: number;
  fo: number;
}

/** Die vier Ansichten der Stärketabelle (4cb3:4BB0). */
export const strengthModes = (): string[] => texte("staerken.modi");

/**
 * Stärketabelle einer Liga (Bildschirm 0x2DCA1). GESAMT mittelt die drei Linien der Matrix,
 * die übrigen Ansichten zeigen nur ihre Linie (Abwehr 0, Mittelfeld 1, Sturm 2). Sortiert wird
 * absteigend nach der Summe Kondition + Technik + Form der gewählten Linien, bei Gleichstand
 * bleibt die Reihenfolge der Liga stehen; die Werte sind auf 0..99 begrenzt.
 */
export function strengthTable(g: GameState, league: number, mode = 0): StrengthRow[] {
  const L = LEAGUES[league];
  const first = mode === 0 ? 0 : mode - 1;
  const last = mode === 0 ? 2 : mode - 1;
  const teiler = mode === 0 ? 3 : 1;
  const rows = Array.from({ length: L.teams }, (_, i) => {
    const club = L.base + i;
    const c = g.clubs.at(club);
    let sum = 0;
    const linie = (o: number) => {
      let v = 0;
      for (let d = first; d <= last; d++) v += c.u8(o + d);
      sum += v;
      return Math.max(0, Math.min(99, div(v, teiler)));
    };
    const ko = linie(24);
    const te = linie(27);
    const fo = linie(30);
    return { club, ko, te, fo, sum };
  });
  rows.sort((a, b) => b.sum - a.sum);
  return rows.map((r, i) => ({ place: i + 1, club: r.club, ko: r.ko, te: r.te, fo: r.fo }));
}

export interface MatchdayRow {
  home: number;
  away: number;
  homePlace: number;
  awayPlace: number;
  result: { home: number; away: number } | null;
  postponed: boolean;
}

/** Paarungen eines Spieltags (1-basiert) mit Tabellenplätzen und Ergebnis, soweit gespielt. */
export function matchdayView(g: GameState, league: number, matchday: number): MatchdayRow[] {
  const order = tableOrder(g, league);
  const placeOf = (c: number) => order.indexOf(c) + 1;
  return fixtures(league, matchday).map(([home, away], i) => {
    const r = g.result(league, matchday - 1, i);
    return { home, away, homePlace: placeOf(home), awayPlace: placeOf(away), result: r && !r.postponed ? { home: r.home, away: r.away } : null, postponed: r?.postponed ?? false };
  });
}

export interface ScorerRow {
  playerIndex: number;
  name: string;
  club: number;
  goals: number;
  apps: number;
  /** Platz in der Bestenliste der Liga (1-basiert) */
  place: number;
}

/**
 * "Die Besten der Liga" (0x16515) aus der Spielertabelle (Byte 34 Tore, Byte 35 Einsätze,
 * Byte 36 Verein): nach Toren, dann Toren je Spiel absteigend. Aufgeführt wird, wer
 * **mindestens zwei Tore** hat - in DOSBox nachgezählt: die Bundesliga zeigte alle elf Spieler
 * mit zwei und mehr Toren und keinen einzigen mit einem (GitLab #55).
 *
 * Bei gleichen Toren und gleichem Schnitt steht die Reihenfolge des Originals nicht fest; es
 * sortiert instabil (zwei Messungen ergaben verschiedene Reihenfolgen gleichwertiger Spieler).
 */
/**
 * Reihenfolge der Torschützen wie im Original (0x165A7): **alle** Spieler 1 bis 150 werden
 * zuerst sortiert, erst danach wird auf die Liga eingedampft. Sortiert wird nach Toren
 * (Spielerbyte 34) absteigend, bei Gleichstand nach Einsätzen (Byte 35) **aufsteigend** - wer
 * für dieselben Tore weniger Spiele gebraucht hat, steht vorn. Das Original benutzt dafür eine
 * Auswahlsortierung, die sofort tauscht; wo auch die Einsätze gleich sind, fällt die Folge so,
 * wie die Tauschkette sie legt, und ein gewöhnliches Sortieren trifft sie nicht (GitLab #62).
 */
/**
 * Saisontore für die Torschützenliste: 0x16515 schreibt vorher bei allen Spielern in den
 * Managerkadern die Tore aus dem Kaderplatz (Byte 3) über Spielerbyte 34 (0x16566). Wer im
 * Laufe der Saison von einem Verein des Rechners kam, zählt also nur mit den Toren seit dem
 * Wechsel. Hier ohne Schreiben - der Saisonwechsel löscht Byte 34 ohnehin.
 */
function saisonTore(g: GameState): (c: number) => number {
  const kader = new Map<number, number>();
  g.activeManagers().forEach((_, m) => {
    for (const l of g.squadOf(m)) kader.set(l.playerIndex, l.u8(3));
  });
  return (c: number) => kader.get(c) ?? g.players.at(c).u8(34);
}

function scorerOrder(g: GameState): number[] {
  const idx = Array.from({ length: 151 }, (_, i) => i);
  const tore = saisonTore(g);
  const spiele = (c: number) => g.players.at(c).u8(35);
  for (let i = 1; i < 151; i++) {
    for (let j = i + 1; j < 151; j++) {
      const a = idx[i];
      const b = idx[j];
      if (tore(b) > tore(a) || (tore(b) === tore(a) && spiele(b) < spiele(a))) {
        idx[i] = b;
        idx[j] = a;
      }
    }
  }
  return idx.slice(1);
}

export function leagueScorers(g: GameState, league: number, limit = 20): ScorerRow[] {
  const L = LEAGUES[league];
  const out: ScorerRow[] = [];
  const tore = saisonTore(g);
  for (const i of scorerOrder(g)) {
    const p = g.players.at(i);
    const club = p.u8(36);
    if (club < L.base || club >= L.base + L.teams || tore(i) < 2 || p.u8(33) === 5 && p.name === "") continue;
    out.push({ playerIndex: i, name: p.displayName, club, goals: tore(i), apps: p.u8(35), place: out.length + 1 });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * "Die Besten der Spieler": dieselbe Bestenliste der Liga, nur auf die Vereine der Mitspieler
 * eingedampft - die Plätze bleiben die der Liga. In DOSBox nachgemessen: als Manager von
 * Hannover 96 standen dort die Spieler von Hannover **und** von Fortuna Düsseldorf, dem Verein
 * des zweiten Mitspielers, mit den Plätzen 1, 5, 8, 12, 13, 14, 15 aus der Ligaliste
 * (GitLab #55).
 */
export function playerScorers(g: GameState, league: number): ScorerRow[] {
  const vereine = new Set(g.activeManagers().map((m) => m.clubIndex));
  return leagueScorers(g, league).filter((r) => vereine.has(r.club));
}

/** Torschützen des eigenen Kaders (Kaderplatz Byte 3 Ligatore, Byte 6 Ligaeinsätze). */
export function squadScorers(g: GameState, manager: number): ScorerRow[] {
  const club = g.managers.at(manager).clubIndex;
  const out: ScorerRow[] = [];
  g.squadOf(manager).forEach((l) => {
    if (l.u8(3) + l.u8(4) === 0) return;
    out.push({ playerIndex: l.playerIndex, name: g.players.at(l.playerIndex).displayName, club, goals: l.u8(3) + l.u8(4), apps: l.u8(6) + l.u8(7), place: 0 });
  });
  const ratio = (r: ScorerRow) => (r.apps ? r.goals / r.apps : r.goals);
  return out.sort((a, b) => b.goals - a.goals || ratio(b) - ratio(a)).map((r, i) => ({ ...r, place: i + 1 }));
}

export interface CupPairRow {
  home: number;
  away: number;
  /** Ergebnis des laufenden Spiels (0:0, solange nicht gespielt) */
  result: [number, number];
  /** Hinspielergebnis aus Sicht des jetzigen Gastgebers (Europapokal, Rückspielrunde) */
  firstLeg: [number, number] | null;
}

/** Rundennamen des Originals (DGROUP 0x24C8): Rundenbyte 1..5. */
export const roundNames = (): string[] => texte("pokal.runden");

export function cupRoundName(pairs: number): string {
  return pairs >= 16 ? "1.Runde" : pairs === 8 ? T("quell.display", 0) : pairs === 4 ? T("quell.display", 1) : pairs === 2 ? "Halbfinale" : "Endspiel";
}

/** Laufende Runde eines Pokals (0 DFB, 1..3 Europa) mit Paarungen und Ergebnissen. */
export function cupView(g: GameState, cup: number): { name: string; round: string; pairs: CupPairRow[] } {
  const p = g.save.plain;
  const round = cupRoundOf(g, cup);
  const n = ROUND_PAIRS[Math.min(round, 5)];
  const pairs: CupPairRow[] = [];
  currentPairs(g, cup).forEach(([home, away], i) => {
    if (home > 199 || away > 199) return;
    const ro = CUP_RESULTS + 32 * cup + 2 * i;
    const result: [number, number] = [p[ro] % 10, p[ro + 1] % 10];
    let firstLeg: [number, number] | null = null;
    if (cup > 0) {
      const lo = FIRST_LEG + 32 * (cup - 1) + 2 * i;
      firstLeg = [p[lo], p[lo + 1]];
    }
    pairs.push({ home, away, result, firstLeg });
  });
  return { name: cupNames()[cup], round: cupRoundName(n), pairs };
}

export interface Statistics {
  /** 7 Zeilen × 3 Spalten: laufende Serie und Rekord */
  series: { current: number[]; record: number[] }[];
  goalsPerGame: number[];
  againstPerGame: number[];
  records: ClubRecord[];
  attendance: { total: number; games: number; average: number; needed: number; record: number; recordOpponent: number | null; minus: number; minusOpponent: number | null; history: number[] };
  balance: number;
  debt: number;
  income: number;
  expenses: number;
}

/**
 * Statistikbildschirm (Büro): Serien (0x26F88), Rekorde (0x2B31E), Zuschauer, Finanzen,
 * Monatsbilanz.
 *
 * `konto` ist die laufende Tagessumme des Kontostands mit dem Tag des Monats (im Original
 * 4cb3:0644, nicht im Spielstand - der Server führt sie mit). Daraus kommt der Guthabenzins
 * bzw. der Überziehungsaufschlag, den die Monatsabrechnung bucht; ohne die Summe fehlt er in
 * der Vorschau, und der benötigte Zuschauerschnitt fällt entsprechend daneben (GitLab #55).
 */
export function statistics(g: GameState, manager: number, konto?: { sum: number; tag: number }): Statistics {
  const m = g.managers.at(manager);
  const club = m.clubIndex;
  const cur = seriesCurrent(g, club);
  const rec = seriesRecord(g, manager);
  const s = g.standings.at(club);
  // Tore je Spiel zeigt das Original auf ein Zehntel **abgeschnitten**, nicht gerundet: bei
  // TEST4 stehen dort 0.6 / 0.2 / 1.0 Gegentore, während 6/9 und 1/4 gerundet 0.7 und 0.3
  // ergäben (an docs/original/buero-statistik.png nachgemessen, GitLab #55).
  const zehntel = (z: number, n: number) => (n ? Math.trunc((10 * z) / n) / 10 : 0);
  const per = (h: number, a: number, gh: number, ga: number) => [zehntel(h + a, gh + ga), zehntel(h, gh), zehntel(a, ga)];
  const goalsPerGame = per(s.homeGoalsFor, s.awayGoalsFor, s.homeGames, s.awayGames);
  const againstPerGame = per(s.homeGoalsAgainst, s.awayGoalsAgainst, s.homeGames, s.awayGames);
  const games = m.u8(314);
  const total = m.i32(484);
  let income = monthlyIncome(g, manager, 1);
  let expenses = monthlyExpenses(g, manager);
  // Wie in dailyFinance am Monatsende: Zins auf den Monatsdurchschnitt des Kontos
  if (konto && konto.tag > 0) {
    const schnitt = div(konto.sum, konto.tag);
    if (schnitt > 0) income += div(Math.min(is2026(g) ? INTEREST_CAP : Number.MAX_SAFE_INTEGER, schnitt), 75);
    else if (schnitt < 0) expenses += div(schnitt, -10);
  }
  const homeGames = LEAGUES[club < 18 ? 0 : club < 38 ? 1 : 2].teams - 1;
  const ticket = Math.max(1, m.u8(266));
  const needed = Math.max(0, div(div((expenses - income) * 12, homeGames), ticket));
  const minus = m.i32(492);
  return {
    series: cur.map((c, r) => ({ current: c, record: rec[r] })),
    goalsPerGame,
    againstPerGame,
    records: clubRecords(g, club),
    attendance: {
      total,
      games,
      average: games ? div(total, games) : 0,
      needed,
      record: m.i32(488),
      recordOpponent: m.i32(488) > 0 ? m.u8(500) : null,
      minus: minus === 99999 ? 0 : minus,
      minusOpponent: minus === 99999 ? null : m.u8(504),
      history: Array.from({ length: Math.min(20, games) }, (_, i) => m.u8(330 + i)),
    },
    balance: m.balance,
    debt: loanTotal(g, manager, false),
    income,
    expenses,
  };
}

/** Ewige Tabelle: Punkte aller Vereine über alle Saisons (Tabellendatensatz u16 bei 50). */
export function allTimeTable(g: GameState, alle = false): { club: number; points: number }[] {
  // Das Original sortiert mit einer Auswahlsortierung, die **sofort tauscht** (0x27BED): für
  // jedes i läuft j von i+1 bis 63, und sobald ein Eintrag mehr Punkte hat, werden die beiden
  // getauscht. Weil dabei auch die noch nicht besuchten Plätze durcheinandergeraten, ist die
  // Reihenfolge gleichwertiger Vereine weder die der Datensätze noch ihr Gegenteil - sie fällt
  // einfach so, wie die Tauschkette sie legt. Ein einfaches Sortieren traf sie nicht (GitLab
  // #62). Die Schleife geht über **64** Tabellendatensätze, nicht über die 58 Vereine.
  const idx = Array.from({ length: 64 }, (_, i) => i);
  // vorzeichenlos verglichen (0x27C2A)
  const wert = (c: number) => g.standings.at(c).i32(50) >>> 0;
  for (let i = 0; i < 63; i++) {
    for (let j = i + 1; j < 64; j++) {
      if (wert(idx[j]) > wert(idx[i])) {
        const t = idx[i];
        idx[i] = idx[j];
        idx[j] = t;
      }
    }
  }
  // Der Bildschirm zeigt und nummeriert alle 64 Sätze, auch die Vereine außerhalb der Ligen
  // (0x28256: Platz = si + 1); `alle` = false lässt sie für andere Leser weg
  return idx.filter((c) => alle || c < 58).map((c) => ({ club: c, points: (wert(c) >>> 0) % 100000 }));
}

export interface AllTimeBalance {
  /** Meisterschaften, DFB-Pokale, Landesmeister-Pokale, Pokalsieger-Pokale, UEFA-Pokale */
  titles: number[];
  /**
   * Zeilen PUN., TORE, SIEGE, NIED., UNEN. mit den drei Spalten gesamt, heim, auswärts. PUN. und
   * TORE tragen je Spalte zwei Werte (für und gegen), die übrigen nur einen.
   */
  rows: { label: string; columns: [number, number | null][] }[];
}

/** Ewige Bilanz eines Managers (0x27DC9): Titel Bytes 57..61, Bilanz u16 420..450. */
export function allTimeBalance(g: GameState, manager: number): AllTimeBalance {
  const m = g.managers.at(manager);
  const w = (o: number) => m.u16(o);
  const pair = (fh: number, fa: number, ah: number, aa: number): [number, number | null][] => [
    [fh + fa, ah + aa],
    [fh, ah],
    [fa, aa],
  ];
  const single = (h: number, a: number): [number, number | null][] => [
    [h + a, null],
    [h, null],
    [a, null],
  ];
  return {
    titles: [57, 58, 59, 60, 61].map((o) => m.u8(o)),
    rows: [
      { label: "PUN.", columns: pair(w(420), w(422), w(432), w(434)) },
      { label: "TORE", columns: pair(w(424), w(426), w(428), w(430)) },
      { label: "SIEGE", columns: single(w(440), w(442)) },
      { label: "NIED.", columns: single(w(444), w(446)) },
      { label: "UNEN.", columns: single(w(448), w(450)) },
    ],
  };
}

/**
 * Datum des nächsten Spieltags eines Wettbewerbs (Kalenderflags: DFB-Pokal 8, Europapokale
 * 0x70). Die Spielübersicht des Originals zeigt es hinter dem Titel ("1.Runde DfB-Pokal 26.8.").
 */
export function nextCupDate(g: GameState, cup: number): { day: number; month0: number } | null {
  const flag = cup === 0 ? FLAG_CUP : FLAG_EUROPE;
  const startYear = seasonStartYear(g);
  for (let k = dayIndex(g); k < CALENDAR_DAYS; k++) {
    if ((calendarFlag(g, k) & flag) === 0) continue;
    const d = dateOfSeasonDay(seasonDay(k), startYear);
    return { day: d.day, month0: d.month0 };
  }
  return null;
}

/**
 * Hilfszeile unter der Kaderliste (0x21567 ff.): sie erklärt die Spalte unter dem Mauszeiger.
 * Reihenfolge wie im Original; "DURCHSCHNTTS-ST[RKE" trägt dessen Tippfehler.
 */
export const squadHelp = (): string[] => texte("ui.kaderhilfe");

/** Meldungen der Live-Konferenz unter der Torszene (0x05186 ff.). */
export const liveTexts = (): string[] => texte("ui.konferenz");

/** Tafel des Elfmeterschießens (0x6733): Überschrift und das Wort zwischen den Vereinen. */
export const shootoutTexts = (): string[] => texte("ui.elfmeter");

/** Tendenz in Worten und die Beschriftung der Erschöpfung (Hilfszeile der Kaderliste). */
export const tendencyWords = (): string[] => texte("ui.tendenz");
