/**
 * Torschütze und Vorlagengeber eines Managervereins (Wahlfunktion 0x05D9A) und die
 * Buchung von Tor und Chance (0x1B223): Tore in Spieler Byte 34 und Kaderplatz Byte 3/4
 * sowie Karrieresummen bei 34/36/38, Spielbewertung in Byte 21 (+15 Tor, -10 vergebene
 * Chance, +10 Vorlage; Gegner: Gegentor Torwart -8, Feldspieler -5; abgewehrte Chance Torwart +8,
 * Feldspieler -3). Siehe docs/abgleich/1B223.md.
 */
import type { GameState, Lineup, Player } from "../records.ts";
import type { Rng } from "./match.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

export function positionFit(l: Lineup, p: Player): number {
  return Math.abs(p.u8(32) - l.u8(25));
}

export function lineDist(l: Lineup, p: Player): number {
  return Math.abs(p.positionValue - (div((7 - l.fieldLine) * 75, 7) + 5));
}

/**
 * Wählt einen Starter (Nummer 1..11): Kandidaten werden zufällig gezogen und mit
 * random(0,3500) < Gewicht angenommen. mode 0 = Schütze/Chance, 1 = Vorlage;
 * flag = Ereignistyp (1 = Tor). Liefert den Kaderplatz oder -1.
 */
export function pickPlayer(g: GameState, manager: number, mode: number, flag: number, rng: Rng): number {
  // Wie 0x5D9A: ohne Starter (0x31A19 Modus 1) nichts, sonst random(0, Anzahl - 1) mit der
  // Kaderzahl aus 0x31A19 Modus 0 **direkt als Kaderplatz** - bei einer Lücke im Kader kann der
  // leere Platz gezogen werden, der letzte Spieler nie (#100). Liefert den Kaderplatz.
  const squad = g.squadOf(manager);
  if (!squad.some((l) => l.number >= 1 && l.number <= 11)) return -1;
  for (let tries = 0; tries < 2000; tries++) {
    const si = rng(0, squad.length - 1);
    const l = g.lineups.at(manager * 25 + si);
    if (l.number < 1 || l.number > 11) continue;
    const p = g.players.at(l.playerIndex);
    let w: number;
    if (mode !== 0 || flag !== 0) w = div(3 * l.u8(17), 5 - 3 * mode) + div(l.u8(16), 5) + div(l.u8(18), 5);
    else w = rng(120, 170);
    w += div(p.u8(31), 25) * (6 - mode) * 7;
    w += 46 * l.u8(3);
    // 0x05ED2/0x05F18: `cmp mode,1; sbb; neg` ist 1 für den Schützen (mode 0), nicht für die
    // Vorlage; der Betrag danach gilt der x-Position (Byte 25), nicht Byte 19 (#99)
    const schuetze = mode < 1 ? 1 : 0;
    const y = (l.u8(26) << 24) >> 24;
    w += schuetze * 300 + (7 - Math.abs(y)) * 200;
    if (y < 2) w += 1200;
    w += 5 * (Math.abs(((l.u8(25) << 24) >> 24) - 3) - 2 * schuetze);
    if (mode !== 0 || flag !== 0) w += 5 * (5 - positionFit(l, p)) + (35 - lineDist(l, p));
    else w += 5 * positionFit(l, p) + lineDist(l, p);
    let ok = rng(0, 3500) < w;
    if (p.u8(31) === 0 && rng(0, 20) !== 0) ok = false;
    if (ok) return si;
  }
  return -1;
}

function addRating(l: Lineup, delta: number): void {
  let v = l.u8(21);
  if (v > 127) v -= 256;
  v = Math.max(-128, Math.min(127, v + delta));
  l.setU8(21, v & 0xff);
}

export interface GoalRecord {
  scorer: number;
  assist: number;
  scorerName: string;
}

/**
 * Chance eines Managervereins buchen (0x1B223, Modus 1 Tor / 0 vergeben), Zeile für Zeile
 * belegt in docs/abgleich/1B223.md:
 *
 * * Schütze `pickPlayer(0, Tor)`, Vorlage `pickPlayer(1, 1)` bis ungleich dem Schützen, sobald
 *   mehr als ein Spieler auf dem Platz steht - **auch bei einer vergebenen Chance**.
 * * Tor: Saisontore in Kaderbyte 3 + Spieltyp (3 Liga, 4 Pokal, **5 Europapokal**),
 *   Karrieresumme im Wort 34 + 2·Spieltyp, in der Liga zusätzlich Spielerbyte 34; Bewertung +15.
 *   Vergeben: Bewertung -10.
 * * **Vorlage: Bewertung +10** (0x1BD03), bei Tor wie bei vergebener Chance - außer die Szene
 *   war ein Elfmeter (0x1BC9E).
 *
 * Bis GitLab #85 fehlten die Europapokaltore, die Wertung der Vorlage und die Vorlage bei
 * vergebenen Chancen.
 */
export function bookChance(g: GameState, manager: number, goal: boolean, matchType: number, rng: Rng, elfmeter = false): GoalRecord | null {
  const squad = g.squadOf(manager);
  const scorer = pickPlayer(g, manager, 0, goal ? 1 : 0, rng);
  if (scorer < 0) return null;
  let assist = -1;
  if (squad.filter((l) => l.number >= 1 && l.number <= 11).length > 1) {
    do assist = pickPlayer(g, manager, 1, 1, rng);
    while (assist === scorer && assist >= 0);
  }
  const l = g.lineups.at(manager * 25 + scorer);
  const p = g.players.at(l.playerIndex);
  if (goal) {
    if (matchType === 0) p.setU8(34, p.u8(34) + 1);
    l.setU8(3 + matchType, l.u8(3 + matchType) + 1);
    const o = 34 + 2 * matchType;
    const v = (l.u8(o) | (l.u8(o + 1) << 8)) + 1;
    l.setU8(o, v & 0xff);
    l.setU8(o + 1, (v >> 8) & 0xff);
    addRating(l, 15);
  } else addRating(l, -10);
  if (assist >= 0 && !elfmeter) addRating(g.lineups.at(manager * 25 + assist), 10);
  return { scorer, assist, scorerName: p.displayName };
}

/**
 * Ein Schuss im Elfmeterschießen mit Manager (0x6733 ruft je Schuss den Chancenhandler 0x1B223
 * mit der Elfmetermarke +0x18 = 1): Schütze und Vorlage werden gewählt wie bei jeder Chance, aber
 * ein Treffer zählt nicht als Saisontor und bringt kein +15 (0x1BB08), und die Vorlage bekommt
 * nichts (0x1BCA4). Ein Fehlschuss kostet den Schützen wie jede vergebene Chance 10 (0x1BB79).
 */
export function bookShootoutShot(g: GameState, manager: number, goal: boolean, rng: Rng): GoalRecord | null {
  const squad = g.squadOf(manager);
  const scorer = pickPlayer(g, manager, 0, goal ? 1 : 0, rng);
  if (scorer < 0) return null;
  let assist = -1;
  if (squad.filter((l) => l.number >= 1 && l.number <= 11).length > 1) {
    do assist = pickPlayer(g, manager, 1, 1, rng);
    while (assist === scorer && assist >= 0);
  }
  const l = g.lineups.at(manager * 25 + scorer);
  if (!goal) addRating(l, -10);
  return { scorer, assist, scorerName: g.players.at(l.playerIndex).displayName };
}

/** Tor eines Managervereins buchen (Kurzform von `bookChance` für ein Tor). */
export function bookGoal(g: GameState, manager: number, matchType: number, rng: Rng): GoalRecord | null {
  return bookChance(g, manager, true, matchType, rng);
}

/**
 * Bewertung der Starter des verteidigenden Managervereins nach Gegentor (goal) oder abgewehrter
 * Chance. Das Original bucht sie **nur, wenn der Angreifer kein Managerverein ist** (0x1BDFA):
 * im Duell zweier Manager bekommt der Verteidiger nichts (GitLab #85).
 */
export function bookDefence(g: GameState, manager: number, goal: boolean): void {
  for (const l of g.squadOf(manager)) {
    if (l.number < 1 || l.number > 11) continue;
    const gk = g.players.at(l.playerIndex).u8(31) === 0;
    if (goal) addRating(l, gk ? -8 : -5);
    else addRating(l, gk ? 8 : -3);
  }
}
