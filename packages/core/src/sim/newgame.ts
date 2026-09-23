/**
 * Neues Spiel (0x08FD8 mit Stammdatenleser 0x299DC, Managervorgaben 0x08DBB, Startbildschirm
 * 0x0AD44 mit Spielerpool 0x3260C, Kaderplatz 0x224A8/0x2277A, Finanzen 0x09623,
 * Transfermarkt 0x245A8). Das Original startet jeden Manager mit seinem Wunschverein in der
 * Oberliga: der Verein wird auf einen zufälligen Oberligaplatz getauscht (0x3C24).
 *
 * Grundlage ist ein vorhandener Spielstand als Vorlage für die Blöcke, deren Bedeutung noch
 * offen ist; alle bekannten Tabellen werden neu aufgebaut.
 */
import { SaveFile, toDosText } from "../savefile.ts";
import { GameState, TABLES, SCALARS } from "../records.ts";
import type { Rng } from "./match.ts";
import type { ManaData } from "../data/mana.ts";
import { swapClubs, shuffleLeagues, CALENDAR_TEMPLATE } from "./season.ts";
import { writePairings } from "./matchday.ts";
import { initialDraw, clearCupResults, europeanParticipants, ORDER_LIST, EU_LIST, EU_SLOTS, DFB_WINNER, PLAYOFF_FIRST_LEG, PLAYOFF_RESULT, CUP_TABLE, CUP_ROUND, LEG_FLAG, CUP_RESULTS, FIRST_LEG } from "./europa.ts";
import { generateOffers, SHIRT_OFFSET, ADV_OFFSET } from "./werbung.ts";
import { playerValue } from "./value.ts";
import { driftClubs } from "./ai.ts";
import { refreshMarket } from "./transfer.ts";
import { distributePlayers } from "./pool.ts";
import { driftInterest } from "./stadium.ts";
import { autoLineup, setSystem, sortIntoSquad } from "./lineup.ts";
import { CAL_OFFSET, CALENDAR_DAYS, DAY_INDEX_OFFSET } from "./calendar.ts";
import { LEAGUES } from "./fixtures.ts";
import { RULES_OFFSET, RULES_ORIGINAL, RULES_2026 } from "./regeln.ts";
import { POACH_COUNT_OFFSET } from "./abwerben.ts";

export interface NewGameManager {
  name: string;
  /** Wunschverein: Index in MANA.DAT (0..63) */
  club: number;
  /** Porträt 1..4 */
  portrait: number;
}

export interface NewGameOptions {
  managers: NewGameManager[];
  /** Spiel-Level wie gespeichert (34062), 1..4; 4 = 1,9 Mio DM Startkapital */
  level: number;
  /** Regelwerk: 0 Original, 1 Version 2026 (sim/regeln.ts); ohne Angabe das Original */
  rules?: number;
  /**
   * Stellung der Wappenleiste im Startbildschirm (0..63, 4238:-0x4 in 0x0AD44; jeder Klick auf das
   * Wappen dreht sie um eins). Das Original schreibt die Kaderwerte über diesen Zähler in die
   * Spielertabelle (s. u.). Das Remake hat keine Leiste: Vorgabe 0, also Spieler 0.
   */
  leiste?: number;
  /** Kontrollpunkte des bytegenauen Vergleichs (kontrollpunkte.py 44..68, #100) */
  kp?: (punkt: number, stand: Uint8Array) => void;
}

const div = (a: number, b: number): number => Math.trunc(a / b);
/** Gruppen des Spielerpools (4cb3:07A6/07A7): Torhüter 1..19, Abwehr 20..63, Mittelfeld 64..105, Angriff 106..150 */
const GROUP_END = [20, 64, 106, 151];
const GROUP_COUNT = [2, 5, 8, 5];
const GROUP_SIZE = [19, 44, 42, 45];
const NAME_RANGE = [0, 2, 8, 15, 20];
const HISTORY = 28435;
const YEAR_MARK = 22251;

/** Zeichenkette Byte für Byte; Namen aus MANA.DAT stehen schon im Zeichensatz des Spiels (0xDC in "LÜTTICH") */
function writeStr(p: Uint8Array, off: number, len: number, s: string): void {
  p.fill(0, off, off + len);
  const t = s.slice(0, len - 1);
  for (let i = 0; i < t.length; i++) p[off + i] = t.charCodeAt(i) & 0xff;
}

function writeI32(p: Uint8Array, o: number, v: number): void {
  for (let i = 0; i < 4; i++) p[o + i] = (v >>> (8 * i)) & 0xff;
}

function playerName(g: GameState, idx: number): string {
  return g.players.at(idx).name;
}

/** 0x324DE: zufälliger Name eines Bundesligavereins (Platz 0..17, kein Managerverein) für Gruppe g, ohne Doppelte im Pool. */
function randomName(g: GameState, mana: ManaData, group: number, rng: Rng): { name: string; club: number } {
  const managers = g.activeManagers();
  for (;;) {
    const nameIdx = rng(NAME_RANGE[group], NAME_RANGE[group + 1] - 1);
    let club: number;
    do club = rng(0, 17);
    while (managers.some((m) => m.clubIndex === club));
    const list = manaListOf(g, mana, club);
    const name = list ? list[nameIdx] : "";
    if (!name) continue;
    let dup = false;
    for (let i = 1; i < 151; i++) if (playerName(g, i) === name) dup = true;
    if (!dup) return { name, club };
  }
}

/** 0x32480: Spielerliste des Vereins mit dem Namen des Vereinsdatensatzes. */
function manaListOf(g: GameState, mana: ManaData, club: number): string[] | undefined {
  const name = g.clubs.at(club).name;
  const k = mana.names.findIndex((n, i) => i < 64 && n === name);
  return k >= 0 ? mana.players[k] : undefined;
}

/**
 * 0x224A8 mit 0x2277A: Spieler auf den ersten freien Kaderplatz eines Managers (0..23 bzw.
 * Markt 100..111).
 *
 * `leihe` entspricht dem Argument, das das Original bei 0x23E79 als 99 übergibt, wenn der
 * Schalter auf LEIHEN steht: dann rechnet es das Gehalt bei 0x226FA mit Modus **3** statt 1,
 * also mit dem Leihabschlag (ein Drittel). Ohne das zahlte ein geliehener Spieler bei uns das
 * volle Gehalt (GitLab #79).
 */
/**
 * Trainergehalt und Fernsehgeld eines Managers (0x09623), beim neuen Spiel und am Ende jedes
 * Saisonwechsels (0x1EAA2, für alle Manager): L = 2 - Liga; Trainer (Byte 478, 16 Bit) =
 * L · (random(15,20) + 40) + (L · (110 - Fans) & ~1) · 500, beides in 16 Bit, dann
 * · random(10 · (L + 10), 25 · (L + 4)) / 100; Fernsehgeld (Werbetabelle +28) =
 * 1000 · (30 · L + Fans).
 */
export function trainerUndFernsehgeld(g: GameState, mi: number, rng: Rng): void {
  const p = g.save.plain;
  const m = g.managers.at(mi);
  const L = 2 - m.u8(312);
  const fans = m.u8(476) | (m.u8(477) << 8);
  let trainer = (L * (rng(15, 20) + 40) + ((((L * (110 - fans)) & 0xfffe) * 500) & 0xffff)) & 0xffff;
  trainer = div(trainer * rng(10 * (L + 10), 25 * (L + 4)), 100) & 0xffff;
  m.setU8(478, trainer & 0xff);
  m.setU8(479, trainer >> 8);
  writeI32(p, ADV_OFFSET + mi * 36 + 28, 1000 * (30 * L + fans));
}

export function addToSquad(g: GameState, manager: number, playerIdx: number, years: number, rng: Rng, leihe = false): number {
  const base = manager === 4 ? 100 : manager * 25;
  const limit = manager === 4 ? 12 : 24;
  let slot = 0;
  while (slot < limit && !g.lineups.at(base + slot).isEmpty) slot++;
  if (slot >= limit) return -1;
  if (manager === 4) {
    // Der Transfermarkt bleibt nach Spielernummer geordnet: 0x224A8 sucht den ersten Platz mit
    // gleicher oder größerer Nummer und schiebt den Rest nach hinten (FA0 -> Markterneuerung,
    // #99). Die Kader ordnet danach sortIntoSquad nach Mannschaftsteil.
    let ziel = 0;
    while (ziel < slot && g.lineups.at(base + ziel).playerIndex < playerIdx) ziel++;
    const off = (i: number) => TABLES.lineups.offset + (base + i) * 52;
    g.save.plain.copyWithin(off(ziel + 1), off(ziel), off(slot));
    slot = ziel;
  }
  const l = g.lineups.at(base + slot);
  const pl = g.players.at(playerIdx);
  for (let i = 0; i < 52; i++) l.setU8(i, 0);
  l.setU8(15, playerIdx);
  l.setU8(19, rng(80, 120));
  l.setU8(14, rng(35, 65));
  l.setU8(20, rng(1, 13) | (rng(1, 3) << 4) | (rng(0, 1) << 7));
  l.setU8(11, years);
  l.setU8(12, 0);
  l.setU8(16, pl.u8(28));
  l.setU8(17, pl.u8(29));
  l.setU8(18, pl.u8(30));
  const salary = playerValue(g, manager === 4 ? 4 : manager, slot, leihe ? 3 : 1, rng);
  writeI32(g.save.plain, TABLES.lineups.offset + (base + slot) * 52 + 40, salary);
  if (manager !== 4) {
    const club = g.managers.at(manager).clubIndex;
    if (pl.u8(36) !== club) {
      pl.setU8(34, 0);
      pl.setU8(35, 0);
      pl.setU8(36, club);
    }
    // Der Kader bleibt nach Mannschaftsteil sortiert (der Transfermarkt nach Spielernummer, s.o.)
    return sortIntoSquad(g, manager, slot);
  }
  return slot;
}

/**
 * Spielerpool (0x3260C): 150 Plätze mit gewürfelten Werten, je Manager die 20 Spieler des
 * Wunschvereins in Gruppenreihenfolge, danach Marktspieler mit Namen aus Bundesligavereinen.
 */
function buildPlayerPool(g: GameState, mana: ManaData, rng: Rng): void {
  const p = g.save.plain;
  p.fill(0, TABLES.players.offset, TABLES.players.offset + TABLES.players.length);
  p.fill(0, TABLES.lineups.offset, TABLES.lineups.offset + TABLES.lineups.length);
  for (let idx = 1; idx < 151; idx++) {
    const pl = g.players.at(idx);
    pl.setU8(26, rng(18, 33));
    let t = rng(30, 89);
    if (t < 45 && rng(0, 1) !== 0) t = rng(30, 89);
    pl.setU8(29, t - rng(0, 20) + 10);
    pl.setU8(30, rng(45, 55));
    pl.setU8(28, t - rng(0, 20) + 10);
    pl.setU8(27, div(pl.u8(28) + pl.u8(29) + pl.u8(30), 3));
    pl.setU8(32, rng(0, 6));
    pl.setU8(33, 5);
  }
  const remaining = GROUP_SIZE.slice();
  g.activeManagers().forEach((m, mi) => {
    const list = manaListOf(g, mana, m.clubIndex) ?? [];
    let nameIdx = 0;
    for (let grp = 0; grp < 4; grp++) {
      for (let k = 0; k < GROUP_COUNT[grp]; k++) {
        const idx = GROUP_END[grp] - remaining[grp] + 1;
        remaining[grp]--;
        const pl = g.players.at(idx);
        let name = list[nameIdx] ?? "";
        if (!name) name = randomName(g, mana, grp, rng).name;
        writeStr(g.save.plain, TABLES.players.offset + idx * 37, 26, name);
        nameIdx++;
        pl.setU8(33, mi);
        pl.setU8(26, rng(19, 31));
        addToSquad(g, mi, idx, 2, rng);
        pl.setU8(36, m.clubIndex);
      }
    }
  });
  for (let idx = 1; idx < 151; idx++) {
    if (!g.players.at(idx).isEmpty) continue;
    const grp = idx < 20 ? 0 : idx < 64 ? 1 : idx < 106 ? 2 : 3;
    const r = randomName(g, mana, grp, rng);
    writeStr(g.save.plain, TABLES.players.offset + idx * 37, 26, r.name);
    g.players.at(idx).setU8(36, 0xff);
  }
  for (let idx = 1; idx < 151; idx++) {
    const pos = idx <= 20 ? 0 : idx <= 63 ? 25 + rng(0, 16) : idx <= 105 ? 50 + rng(0, 16) : 75 + rng(0, 16);
    g.players.at(idx).setU8(31, pos);
  }
}

/** Startaufstellung (0x9D46: 0x22030 mit System 1-4-4-2 und Bank 12..15). */
function defaultLineup(g: GameState, manager: number): void {
  setSystem(g, manager, 2);
  g.save.plain[52 + 2 * manager] = 2;
  autoLineup(g, manager, 2, true);
}

export function createGame(template: Uint8Array, mana: ManaData, opt: NewGameOptions, rng: Rng): SaveFile {
  if (opt.managers.length < 1 || opt.managers.length > 4) throw new Error("1 bis 4 Manager");
  // Meldungen der Vorlage zuerst entfernen, solange ihre Managerzahl noch gilt: sonst blieben
  // Meldungsbytes von Managern stehen, die es im neuen Spiel nicht mehr gibt.
  const plain = new SaveFile(template).withMessages([]).plain.slice();
  const g = new GameState(new SaveFile(plain));
  const p = plain;
  const kp = opt.kp ? (k: number) => opt.kp!(k, plain) : () => {};
  // Tabellen leeren
  for (const t of [TABLES.managers, TABLES.players, TABLES.lineups, TABLES.standings, TABLES.results, TABLES.advertising]) p.fill(0, t.offset, t.offset + t.length);
  p.fill(0, 5457, 5457 + 100);
  p.fill(0, CUP_TABLE, CUP_TABLE + 128);
  p.fill(0, FIRST_LEG, FIRST_LEG + 96);
  p.fill(0, CUP_ROUND, CUP_ROUND + 8);
  p.fill(0, LEG_FLAG, LEG_FLAG + 3);
  p.fill(0, CUP_RESULTS, CUP_RESULTS + 128);
  p.fill(0, EU_LIST, EU_LIST + 10);
  p.fill(0x80, EU_SLOTS, EU_SLOTS + 18);
  // Titelträger 4cb3:07AC..07B0 wie im Programmabbild: DFB-Sieger 7 (Verein 6), sonst keiner -
  // das Mischen der Ligaplätze nimmt ihn mit, und so hat die erste Saison einen Pokalsieger im
  // Europapokal (NG2 gegen das Original geprüft, #100)
  p.fill(0, DFB_WINNER, DFB_WINNER + 5);
  p[DFB_WINNER] = 7;
  p.fill(0, PLAYOFF_FIRST_LEG, PLAYOFF_FIRST_LEG + 2);
  p[PLAYOFF_RESULT] = 0;
  p.fill(0, HISTORY, HISTORY + 5012);
  // Weitere Startwerte wie im Programmabbild (gegen ein neues Spiel des Originals, NG2, #100);
  // bis dahin blieben hier Werte der Vorlage stehen
  p.fill(0, 45, 49); // 4238:5350
  p.fill(2, 51, 59); // Spielsystem je Manager (4cb3:079E): 2
  for (let i = 0; i < 15; i++) p[33447 + i] = i < 14 ? 1 : 0; // Anzeigeoptionen (4cb3:05FE)
  p[34222] = 40; // Spielgeschwindigkeit (4cb3:063A)
  p[34223] = 0;
  p[34224] = 0; // Zahl der Spielzeiten (4cb3:07E2)
  p[34225] = 0;
  p.fill(0, 34065, 34065 + 30); // 4238:1D34
  p.fill(0, 34095, 34095 + 120); // 4238:5664
  // Tabellen: Vorlage der Bytes 4..21 wie beim Zurücksetzen (4cb3:53C7: achtmal 64, 0)
  // (die Vereine außerhalb der Ligen, 58..63, nur die erste Hälfte)
  for (let c = 0; c < 64; c++) for (let i = 0; i < (c < 58 ? 18 : 9); i++) p[TABLES.standings.offset + 54 * c + 4 + i] = i % 9 === 8 ? 0 : 64;
  p.fill(0, SHIRT_OFFSET, ADV_OFFSET);
  // Werbeblock: das Original startet nicht bei 0, sondern mit den Werten, die im Datensegment
  // von BMMAIN.EXE stehen (4cb3:066C): Trikotwerbung 50.000, jede der sechs Banden 6.000,
  // Fernsehgeld 0 (wird je Manager gesetzt) und Werbeausgaben 5.000. Deshalb hat auch ein
  // Verein ohne einen einzigen Bandenvertrag 36.000 DM Bandeneinnahmen.
  for (let mi = 0; mi < 4; mi++) {
    writeI32(p, ADV_OFFSET + mi * 36, 50000);
    for (let i = 1; i <= 6; i++) writeI32(p, ADV_OFFSET + mi * 36 + 4 * i, 6000);
    writeI32(p, ADV_OFFSET + mi * 36 + 28, 0);
    writeI32(p, ADV_OFFSET + mi * 36 + 32, 5000);
  }
  p.fill(0, 27900, 27960);
  p[SCALARS.currentManager] = 0;
  p[34062] = Math.max(1, Math.min(4, opt.level));
  p[RULES_OFFSET] = opt.rules === RULES_2026 ? RULES_2026 : RULES_ORIGINAL;
  p.fill(0, POACH_COUNT_OFFSET, POACH_COUNT_OFFSET + 16); // Abwerbezähler der Version 2026
  p[34063] = YEAR_MARK & 0xff;
  p[34064] = YEAR_MARK >> 8;
  p[SCALARS.managerCount] = opt.managers.length;
  // Vereine (0x299DC)
  kp(44);
  for (let c = 0; c < 200; c++) {
    const o = TABLES.clubs.offset + 34 * c;
    writeStr(p, o, 23, mana.names[c]);
    p.fill(0, o + 23, o + 34);
    for (let d = 0; d < 3; d++) {
      p[o + 24 + d] = mana.strength[c][d];
      p[o + 27 + d] = mana.strength[c][d];
      p[o + 30 + d] = rng(45, 55) - (c > 64 ? 5 : 0);
    }
    p[o + 23] = rng(45, 55);
    if (c < 64) p[o + 33] = mana.logos[c];
  }
  for (let league = 0; league < 3; league++) {
    const L = LEAGUES[league];
    for (let i = 0; i < L.teams; i++) {
      p[ORDER_LIST + 20 * league + i] = L.base + i;
      p[27900 + 20 * league + i] = L.base + i;
      g.standings.at(L.base + i).setU8(46, i);
    }
  }
  // Managervorgaben (0x08DBB)
  p.fill(0xff, HISTORY, HISTORY + 2560);
  for (let m = 0; m < 4; m++) {
    const o = TABLES.managers.offset + 778 * m;
    // Unbesetzte Plätze tragen im Original Porträt m+1 und Verein 100 (TEST-LAS);
    // die Pokalrunden bleiben auf 0, nicht auf CUP_OUT
    p[o + 29] = m + 1;
    p[o + 30] = 100;
  }
  opt.managers.forEach((mg, m) => {
    const o = TABLES.managers.offset + 778 * m;
    writeStr(p, o, 29, toDosText(mg.name.slice(0, 12).toUpperCase()));
    p[o + 29] = Math.max(1, Math.min(4, mg.portrait));
    p[o + 30] = Math.max(0, Math.min(63, mg.club));
  });
  // Ligaplätze mischen (0x3AC5), Europapokalteilnehmer (0x18B12), Pokalergebnisse löschen und
  // die drei Europapokale auslosen (0x92E5 bis 0x930E) - alles vor dem Startbildschirm, also vor
  // dem Tausch der Managervereine in die Oberliga
  kp(45);
  shuffleLeagues(g, rng);
  kp(46);
  europeanParticipants(g);
  clearCupResults(g);
  for (let cup = 1; cup < 4; cup++) {
    kp(47);
    initialDraw(g, cup, rng);
  }
  // Wunschvereine nach dem Mischen wiederfinden
  opt.managers.forEach((mg, m) => {
    const name = mana.names[Math.max(0, Math.min(63, mg.club))];
    let idx = -1;
    for (let c = 0; c < 64; c++) if (g.clubs.at(c).name === name) idx = c;
    g.managers.at(m).setU8(30, idx >= 0 ? idx : 11 * m);
  });
  // Spielerpool (0x3260C)
  kp(48);
  buildPlayerPool(g, mana, rng);
  // Managerschleife (0x0AD44 ab 0xBDB8)
  const level = p[34062];
  const managers = g.activeManagers();
  managers.forEach((m, mi) => {
    const o = TABLES.managers.offset + 778 * mi;
    const club = m.clubIndex;
    const cls = club < 18 ? 1 : club < 38 ? 2 : 4;
    if (!(cls === 4 && club <= 58)) {
      let y: number;
      do y = rng(38, 57);
      while (managers.slice(0, mi).some((x) => x.clubIndex === y));
      kp(50);
      swapClubs(g, club, y, false);
    }
    const league = 2;
    const b = div(level, 2) + 27;
    // Kaderwerte (0xC0A8 bis 0xC1AE): je Wert random(b, b+5) und immer auch random(40,60) - die
    // Form nimmt den zweiten. Die Spielertabelle (Bytes 28, 29, 30) schreibt das Original über
    // -0x4 - das ist aber die Stellung der Wappenleiste aus dem Startbildschirm, nicht der Spieler
    // des Kaderplatzes: die Kaderspieler behalten ihre Poolwerte, und der Spieler mit der Nummer
    // der Leistenstellung bekommt die Werte des letzten Kaderplatzes (NG18 gegen das Original:
    // ein Klick auf das Wappen, Spieler 1 mit 28/33/47, #100)
    const zeiger = g.players.at((opt.leiste ?? 0) & 63);
    g.squadOf(mi).forEach((l) => {
      for (let k = 0; k < 3; k++) {
        const v = rng(b, b + 5);
        const f = rng(40, 60);
        l.setU8(16 + k, k === 2 ? f : v);
        zeiger.setU8(28 + k, k === 2 ? f : v);
      }
    });
    g.squadOf(mi).forEach((_, slot) => {
      kp(52);
      writeI32(p, TABLES.lineups.offset + (mi * 25 + slot) * 52 + 40, playerValue(g, mi, slot, 1, rng));
    });
    [5, 4, 6, 5, 6].forEach((v, i) => (p[o + 321 + i] = v));
    [1, 3, 3, 3].forEach((v, i) => (p[o + 326 + i] = v));
    p[o + 312] = league;
    p[o + 266] = 2 * 8 - 3 * league;
    writeI32(p, o + 358, 4000 * (5 - league));
    writeI32(p, o + 350, 3000 * (2 - league));
    writeI32(p, o + 366, 3500 * (2 - league));
    writeI32(p, o + 390, 4);
    writeI32(p, o + 398, 3);
    p[o + 305] = 16;
    const fans = (50 - 20 * league) & 0xffff;
    p[o + 476] = fans & 0xff;
    p[o + 477] = fans >> 8;
    trainerUndFernsehgeld(g, mi, rng);
    kp(53);
    generateOffers(g, mi, rng);
    writeI32(p, o + 496, level === 4 ? 1900000 : 1500000);
    writeI32(p, o + 492, 99999);
    // Verlauf (62..261) und Zuschauerreihe (268..304) bleiben leer, die Pokalrunden auf 0:
    // so sieht ein frisches Spiel des Originals aus (TEST-LAS)
    defaultLineup(g, mi);
  });
  // Spieltage, Pokale, Markt, Kalender, Datum
  for (let l = 0; l < 3; l++) {
    p[SCALARS.nextMatchday + l] = 1;
    writePairings(g, l, 1);
  }
  // Nach dem Startbildschirm (0x9427 bis 0x9482): Vereinsmatrix mit 10 (0x10067), Ligaverteilung
  // der freien Spieler (0x1643B), DFB-Pokal-Auslosung; die Europapokal-Aufrufe mit Schalter 1
  // kehren sofort zurück (0x18644), dann der Transfermarkt
  // Zinstabelle der Bank am Ende des Startbildschirms (0xC745 -> 0x112AA) vom Programmstartwert 5
  driftInterest(g, rng, 5);
  kp(54);
  driftClubs(g, 10, rng);
  kp(55);
  distributePlayers(g, false, rng, 0); // Jahr 4238:A7A0 noch 0, Manager am Zug 0
  kp(56);
  initialDraw(g, 0, rng);
  for (let cup = 1; cup < 4; cup++) kp(57);
  managers.forEach((m) => {
    for (let cup = 1; cup < 4; cup++) m.setU8(306 + cup, 0);
  });
  kp(58);
  // Transfermarkt: dieselbe Erneuerung 0x245A8 wie im Tagesablauf (bis #100 eine eigene Füllung
  // mit anderen Spielern und Stärken)
  refreshMarket(g, rng);
  kp(59);
  // Tabellenplatz aus der Reihenfolgeliste und der Platz zum Saisonstart je Manager (Byte 267 =
  // Spieltag 0), wie nach jedem Saisonwechsel; Spieler 0 gehört wie alle freien dem Manager 5
  for (let league = 0; league < 3; league++) {
    for (let i = 0; i < LEAGUES[league].teams; i++) g.standings.at(p[ORDER_LIST + 20 * league + i]).setU8(46, i);
  }
  managers.forEach((m) => m.setU8(267, g.standings.at(m.clubIndex).u8(46)));
  p[TABLES.players.offset + 33] = 5;
  for (let i = 0; i < CALENDAR_DAYS; i++) p[CAL_OFFSET + i] = CALENDAR_TEMPLATE[i];
  p[DAY_INDEX_OFFSET] = 0;
  writeI32(p, SCALARS.counter, 0);
  writeI32(p, SCALARS.day, 29);
  writeI32(p, SCALARS.monthIndex, 6);
  writeI32(p, SCALARS.year, 1992);
  p[SCALARS.year16] = 1992 & 0xff;
  p[SCALARS.year16 + 1] = 1992 >> 8;
  return new SaveFile(plain).withMessages([]);
}
