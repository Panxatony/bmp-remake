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
import { initialDraw, clearCupResults, europeanParticipants, remapCupClubs, orderList, PLAYOFF_RESULT, ORDER_LIST } from "./europa.ts";
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

/** Abstiegsplätze je Liga (4cb3:2266) und Relegation (4cb3:226A). */
const ABSTIEG = [3, 4, 4];
const RELEGATION = [1, 0, 0];

/**
 * Auf- und Abstieg wie im Tagesablauf des Originals (0x1E319 bis 0x1E662, #99):
 *
 * 1. Lizenzentzug: Managerverein der Bundesliga oder 2. Liga mit Kontostand unter -2.000.000 DM
 *    rückt in der Reihenfolgeliste (28244) ans Ende seiner Liga, zählt als zusätzlicher Absteiger,
 *    Managerbyte 320 = 4 und die Liga (312) eins tiefer.
 * 2. Je Liga steigen max(Abstiegsplätze, Zusatzabsteiger) ab - von unten gezählt, gepaart mit
 *    dem Verein von oben aus der Liga darunter. In der Bundesliga bleibt der Relegationsplatz
 *    (der letzte gezählte), wenn der Bundesligist die Relegation gewonnen hat (34367 = 0).
 * 3. Die Oberliga tauscht mit den Vereinen außerhalb: der Letzte mit random(61,62), dann 60, 59, 58.
 * 4. Managerbyte 320: 1 Aufstieg, 2 Abstieg, 8 Abstieg aus der Oberliga - der Manager beginnt dann
 *    neu mit 500.000 DM, sein Verein wird zweimal getauscht und bleibt also, wo er ist.
 */
export function promoteRelegate(g: GameState, rng: Rng): Relegation {
  const p = g.save.plain;
  const res: Relegation = { up: [], down: [], licence: [] };
  const managers = g.activeManagers();
  const managerOf = (club: number) => managers.findIndex((m) => m.clubIndex === club);
  const order = (l: number, i: number) => p[ORDER_LIST + 20 * l + i];
  const extra = [0, 0, 0];
  managers.forEach((m) => {
    m.setU8(320, 0);
    if (!(m.i32(496) < -2000000)) return;
    const l = m.u8(312);
    if (l >= 2) return;
    m.setU8(320, 4);
    const n = LEAGUES[l].teams;
    let i = 0;
    while (i < n && order(l, i) !== m.clubIndex) i++;
    if (i >= n) return;
    for (; i < n - 1; i++) p[ORDER_LIST + 20 * l + i] = order(l, i + 1);
    p[ORDER_LIST + 20 * l + n - 1] = m.clubIndex;
    extra[l]++;
    m.setU8(312, l + 1);
    res.licence.push(m.clubIndex);
  });
  if (RELEGATION[0] && p[PLAYOFF_RESULT] === 0) extra[0]++;
  if (RELEGATION[0]) {
    const home = order(0, LEAGUES[0].teams - 3);
    const away = order(1, 2);
    res.playoff = { home, away, winner: p[PLAYOFF_RESULT] === 1 ? away : home };
  }
  for (let l = 0; l < 3; l++) {
    extra[l] = extra[l] > ABSTIEG[l] ? extra[l] - ABSTIEG[l] : 0;
    p[SCALARS.nextMatchday + l] = 1;
    const n = LEAGUES[l].teams;
    const anzahl = extra[l] + ABSTIEG[l];
    for (let i = 0; i < anzahl; i++) {
      const ab = order(l, n - 1 - i);
      let auf: number;
      if (l >= 2) auf = i === 0 ? rng(61, 62) : 58 + 3 - i;
      else auf = order(l + 1, i);
      if (l === 0 && anzahl - i === 1 && p[PLAYOFF_RESULT] === 0 && RELEGATION[0]) continue;
      const md = managerOf(ab);
      if (md >= 0 && managers[md].u8(320) === 0) {
        if (l < 2) {
          managers[md].setU8(320, 2);
          managers[md].setU8(312, managers[md].u8(312) + 1);
        } else {
          managers[md].setU8(320, 8);
          const b = 500000;
          for (let k = 0; k < 4; k++) managers[md].setU8(496 + k, (b >>> (8 * k)) & 0xff);
          swapClubs(g, ab, auf);
        }
      }
      const mp = managerOf(auf);
      if (mp >= 0 && managers[mp].u8(320) === 0) {
        managers[mp].setU8(312, managers[mp].u8(312) - 1);
        managers[mp].setU8(320, 1);
      }
      swapClubs(g, ab, auf);
      res.down.push(ab);
      res.up.push(auf);
    }
  }
  return res;
}

/** Zahl der gespielten Spielzeiten (4cb3:07E2). */
const SAISONZAEHLER = 34224;

/**
 * Ewigkeitspunkte (0x1EB17) je Verein 0..63: 25 je Ligastufe (Bundesliga 2, 2. Liga 1) minus
 * Tabellenplatz plus 19, für Vereine außerhalb (über 57) nichts; Pokalsieger bekommen dazu
 * 20 (DFB-Pokal), 50 (Landesmeister), 40 (Pokalsieger), 30 (UEFA-Pokal); der Meister 12, die
 * Plätze 2..5 der Bundesliga 3, der Erste der unteren Ligen 3. Bis #99 zählte das Remake statt
 * dessen die Saisonpunkte.
 */
export function ewigkeitspunkte(g: GameState): void {
  const p = g.save.plain;
  const sieger: [number, number][] = [[2340, 20], [2343, 30], [2342, 40], [2341, 50]];
  for (let c = 0; c < 64; c++) {
    const s = g.standings.at(c);
    const platz = s.u8(46);
    let v = 25 * ((c < 38 ? 1 : 0) + (c < 18 ? 1 : 0)) - platz + 19;
    if (c > 57) v = 0;
    for (const [o, bonus] of sieger) if (p[o] - c - 1 === 0) v += bonus;
    if (c < 18) v += platz === 0 ? 12 : platz < 5 ? 3 : 0;
    else if (platz === 0 && c <= 57) v += 3;
    const neu = s.i32(50) + v;
    for (let i = 0; i < 4; i++) s.setU8(50 + i, (neu >>> (8 * i)) & 0xff);
  }
}

/**
 * Tabellen zurücksetzen (0x1E29E): alle Saisonwerte auf 0, die Bytes 4..21 auf die Vorlage
 * 4cb3:53C7 (achtmal 64, dann 0 - zweimal); Tabellenplatz (46) und Ewigkeitspunkte (50) bleiben,
 * der Platz wandert beim Tausch mit dem Verein.
 */
function tabellenZuruecksetzen(g: GameState): void {
  const vorlage = [64, 64, 64, 64, 64, 64, 64, 64, 0];
  for (let c = 0; c < 64; c++) {
    const s = g.standings.at(c);
    for (let i = 0; i < 46; i++) s.setU8(i, 0);
    for (let i = 0; i < 18; i++) s.setU8(4 + i, vorlage[i % 9]);
  }
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

export interface SaisonHaken {
  /** Kontrollpunkt des bytegenauen Vergleichs (originaltag.ts, #99) */
  kp?: (punkt: number) => void;
  /**
   * Die Tage vom Saisonende bis zum 28. Juli (0x1E955 bis 0x1EA2E): je Tag und Manager die
   * Sperren der Kaderplätze (0x0F6D8) und die Finanzen 0x11D0D. Ohne Haken fallen sie aus.
   */
  tage?: () => void;
  /**
   * Die Vertragsgespräche des Saisonendes (0x0DB40 -> 0x251FF) laufen im Original vor dem
   * Spielerpool; der Haken bekommt die Ereignisse und entscheidet sie.
   */
  vertraege?: (events: SeasonEvent[]) => void;
}

export function newSeason(g: GameState, rng: Rng, verlaengerung = false, haken: SaisonHaken = {}): SeasonEvent[] {
  const p = g.save.plain;
  const kp = haken.kp ?? (() => {});
  writeHistory(g);
  // Europapokalteilnehmer aus der Abschlusstabelle (0x18B12); Vereinstausche werden mitgeführt.
  // Das Original ruft es erst nach dem Mischen der Ligaplätze auf - gewürfelt wird dabei nicht.
  europeanParticipants(g);
  const managersBefore = g.activeManagers().map((m) => m.clubIndex);
  // Reihenfolge des Tagesablaufs (0x1E319 bis 0x1E935, #99): Auf- und Abstieg, Schwankung aller
  // Vereine, Sponsorenangebote je Manager, Ligaplätze mischen, Saisonende je Manager
  // Ewigkeitspunkte (0x1EB17), danach die Fans aus deren Zuwachs (0x1E1C8) und das Zurücksetzen
  // der Tabellen (0x1E29E) - alles vor dem Auf- und Abstieg
  const managers = g.activeManagers();
  const ewigVorher = managers.map((m) => g.standings.at(m.clubIndex).i32(50));
  ewigkeitspunkte(g);
  const jahre = Math.min(5, (p[SAISONZAEHLER] | (p[SAISONZAEHLER + 1] << 8)) + 1);
  // Eigenheit des Originals: der neue Fanwert landet in einer einzigen Variablen - am Ende gilt
  // der des letzten Managers, und den bekommen nach der Schwankung alle (0x1E6C7)
  let fansNeu = 0;
  managers.forEach((m, i) => {
    const d = g.standings.at(m.clubIndex).i32(50) - ewigVorher[i];
    const fans = m.u8(476) | (m.u8(477) << 8);
    const v = fans + (Math.trunc(Math.trunc((d * 100) / 108) / jahre) - Math.trunc(fans / jahre));
    fansNeu = Math.max(0, Math.min(100, v));
  });
  tabellenZuruecksetzen(g);
  kp(30);
  const moves = promoteRelegate(g, rng);
  const flags = g.activeManagers().map((m) => m.u8(320));
  void managersBefore;
  kp(31);
  // Vereinsmatrix zum Saisonbeginn neu gewürfelt (0x10067 mit 10, 0x1E665)
  driftClubs(g, 10, rng);
  // Fans: der Wert von oben, in den oberen Ligen mindestens 30, in der Bundesliga mindestens 61 -
  // die Anhebung wirkt für die folgenden Manager mit (0x1E671)
  for (const m of managers) {
    if (fansNeu < 30 && m.u8(312) < 2) fansNeu = 30;
    if (fansNeu < 61 && m.u8(312) === 0) fansNeu = 61;
    m.setU8(476, fansNeu & 0xff);
    m.setU8(477, fansNeu >> 8);
  }
  g.activeManagers().forEach((_, i) => {
    kp(33);
    generateOffers(g, i, rng);
  });
  kp(34);
  shuffleLeagues(g, rng);
  kp(35);
  kp(36);
  // Vertragsjahre, Alter, Rückkehr der Leihspieler und Saisonwerte der Kader laufen im
  // Ereignisbildschirm in der Reihenfolge des Originals (seasonEvents, 0x0CB62)
  const events = seasonEvents(g, flags, rng, verlaengerung);
  // Zahl der Spielzeiten (4cb3:07E2) eins weiter (0x1E940)
  const z = (p[SAISONZAEHLER] | (p[SAISONZAEHLER + 1] << 8)) + 1;
  p[SAISONZAEHLER] = z & 0xff;
  p[SAISONZAEHLER + 1] = (z >> 8) & 0xff;
  haken.vertraege?.(events);
  // Spielerpool der KI-Vereine nach den Vertragsdialogen (0x0DB40 -> 0x0F2A6)
  kp(41);
  seasonPlayerPool(g, rng, () => kp(42));
  haken.tage?.();
  void moves;
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
