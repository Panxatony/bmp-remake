/**
 * Abwerben (nur Version 2026, sim/regeln.ts).
 *
 * Im Original kommt man an die Spieler eines Mitspielers nur heran, wenn dieser sie selbst auf
 * den Transfermarkt setzt. Die Version 2026 erlaubt, einen Spieler direkt abzuwerben: gefragt
 * wird nicht der Besitzer, sondern der Spieler.
 *
 * - Die Ablöse ist der Wert, den der Spieler auf dem Transfermarkt hätte (Marktwert des
 *   Kaderplatzes, sim/value.ts mit Variante 0 - derselbe Wert, den der Markt bei einem
 *   gelisteten Spieler eines Managers anzeigt).
 * - Darauf darf der Werbende bis zu 15 % aufschlagen; jedes Prozent macht die Zustimmung
 *   wahrscheinlicher. Mehr als 15 % nimmt niemand entgegen.
 * - Sagt der Spieler zu, ist der Wechsel bindend: der Werbende zahlt, der Besitzer bekommt das
 *   Geld, zurücktreten kann keiner von beiden. Sagt der Spieler ab, passiert nichts.
 * - Demselben Manager lassen sich in einer Saison höchstens zwei Spieler abwerben; der Zähler
 *   steht im Spielstand und wird zum Saisonwechsel geleert.
 * - Gewildert wird nur **nach oben**: beim Besitzer muss es besser laufen als beim Werbenden -
 *   höhere Liga, oder in derselben Liga ein besserer Tabellenplatz. Der Tabellenletzte darf
 *   damit bei allen, der Erste bei niemandem (Entscheidung vom 16.9.2026, GitLab #1). Sonst
 *   nimmt der wohlhabende Spitzenreiter dem Schlusslicht auch noch die zwei besten Spieler weg.
 * - In der Version 2026 erfährt der Besitzer vom Versuch und darf sich wehren: eine
 *   Gehaltserhöhung von bis zu 50 % senkt die Zustimmung um ebenso viele Punkte (`raiseSalary`).
 *   Die Erhöhung gilt auch dann weiter, wenn der Spieler trotzdem geht - sie kostet also.
 * - Der Spieler wechselt mit seinem laufenden Vertrag (Restjahre und Gehalt bleiben stehen);
 *   eine Vertragsverhandlung wie beim Kauf vom Markt gibt es nicht.
 *
 * Die Zustimmung ist eine Erfindung dieses Remakes und steht so in keinem Original.
 */
import type { GameState } from "../records.ts";
import { TABLES } from "../records.ts";
import type { Rng } from "./match.ts";
import { playerValue } from "./value.ts";
import { addBalance, slotBytes, setSlotBytes, assignNumber, removePlace } from "./transfer.ts";
import { is2026 } from "./regeln.ts";
import { texte } from "../data/texte.ts";
import { sortIntoSquad } from "./lineup.ts";
import { LEAGUES } from "./fixtures.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Höchster Aufschlag auf die Ablöse in Prozent. */
export const POACH_MAX_BONUS = 15;
/** So viele Spieler müssen dem Besitzer bleiben. */
export const POACH_MIN_SQUAD = 12;
/**
 * So viele Spieler darf man demselben Manager in einer Saison abwerben. Seit lhunos
 * Entscheidung vom 16.9.2026 ist es einer: zwei Wechsel aus demselben Kader reißen in einer
 * Saison zu viel heraus, zumal nur nach oben gewildert wird (poachAllowedFrom).
 */
export const POACH_MAX_PER_OWNER = 1;
/** Höchste Gehaltserhöhung, mit der sich der Besitzer wehren darf, in Prozent. */
export const POACH_COUNTER_MAX = 50;
/**
 * Zähler der geglückten Abwerbungen, 16 Bytes ab 34100: Werber · 4 + Besitzer. Die Stelle liegt
 * im selben ungenutzten Bereich wie das Regelbyte (siehe sim/regeln.ts) und wird zum
 * Saisonwechsel geleert (sim/season.ts).
 */
export const POACH_COUNT_OFFSET = 34100;

/** Wie viele Spieler `poacher` dem Manager `owner` in dieser Saison schon abgeworben hat. */
export function poachCount(g: GameState, poacher: number, owner: number): number {
  if (poacher < 0 || poacher > 3 || owner < 0 || owner > 3) return 0;
  return g.save.plain[POACH_COUNT_OFFSET + poacher * 4 + owner];
}

/** Noch offene Abwerbungen bei diesem Manager. */
export function poachLeft(g: GameState, poacher: number, owner: number): number {
  return Math.max(0, POACH_MAX_PER_OWNER - poachCount(g, poacher, owner));
}

/** Alle Zähler löschen (Saisonwechsel). */
export function resetPoachCounts(g: GameState): void {
  g.save.plain.fill(0, POACH_COUNT_OFFSET, POACH_COUNT_OFFSET + 16);
}

/** Liga eines Vereins (0 Bundesliga, 1 zweite Liga, 2 Oberliga). */
function leagueOf(club: number): number {
  for (let i = LEAGUES.length - 1; i >= 0; i--) if (club >= LEAGUES[i].base) return i;
  return 0;
}

/**
 * Tabellenplatz eines Managervereins innerhalb seiner Liga (Standing-Byte 46, 0-basiert).
 * Vereine aus höheren Ligen stehen grundsätzlich vor allen aus tieferen.
 */
function rang(g: GameState, manager: number): [number, number] {
  const club = g.managers.at(manager).clubIndex;
  return [leagueOf(club), g.standings.at(club).u8(46)];
}

/**
 * Darf `poacher` bei `owner` wildern? Nur wenn es beim Besitzer besser läuft: höhere Liga oder,
 * in derselben Liga, ein besserer Tabellenplatz.
 */
export function poachAllowedFrom(g: GameState, poacher: number, owner: number): boolean {
  const [ligaP, platzP] = rang(g, poacher);
  const [ligaO, platzO] = rang(g, owner);
  if (ligaO !== ligaP) return ligaO < ligaP;
  return platzO < platzP;
}

/** Ablöse ohne Aufschlag: der Marktwert des Kaderplatzes. */
export function poachPrice(g: GameState, owner: number, place: number): number {
  return playerValue(g, owner, place, 0);
}

/** Ablöse mit Aufschlag (0..15 %), auf volle 1000 DM abgerundet wie die Preise des Originals. */
export function poachAmount(g: GameState, owner: number, place: number, bonus: number): number {
  const b = clamp(Math.trunc(bonus), 0, POACH_MAX_BONUS);
  return div(div(poachPrice(g, owner, place) * (100 + b), 100), 1000) * 1000;
}

/**
 * Wahrscheinlichkeit in Prozent, dass der Spieler zusagt: 30 als Grundbereitschaft, dazu zwei
 * Punkte je Prozent Aufschlag (also bis zu 30), zehn Punkte je Liga, die der werbende Verein
 * höher spielt (und ebenso viele Abzug nach unten), fünfzehn Punkte im letzten Vertragsjahr
 * (sonst fünf Abzug je weiterem Jahr) und zehn Punkte, wenn der Spieler zurzeit gar nicht
 * eingeplant ist (keine Rückennummer). Begrenzt auf 5 bis 90.
 */
export function poachChance(g: GameState, poacher: number, owner: number, place: number, bonus: number, counter = 0): number {
  const l = g.lineups.at(owner * 25 + place);
  if (l.isEmpty) return 0;
  const b = clamp(Math.trunc(bonus), 0, POACH_MAX_BONUS);
  let c = 30 + 2 * b - clamp(Math.trunc(counter), 0, POACH_COUNTER_MAX);
  c += 10 * (leagueOf(g.managers.at(owner).clubIndex) - leagueOf(g.managers.at(poacher).clubIndex));
  const jahre = l.u8(11);
  c += jahre <= 1 ? 15 : -5 * (jahre - 1);
  if (l.u8(10) === 0) c += 10;
  return clamp(c, 5, 90);
}

export type PoachResult =
  | { ok: false; error: string }
  /** Der Spieler hat abgelehnt; es fließt kein Geld. */
  | { ok: true; agreed: false; amount: number; chance: number }
  /** Der Wechsel ist vollzogen; `place` ist der neue Kaderplatz beim Werbenden. */
  | { ok: true; agreed: true; amount: number; chance: number; place: number };

/** Prüft, ob ein Spieler überhaupt abgeworben werden darf. */
export function poachCheck(g: GameState, poacher: number, owner: number, place: number, bonus: number): { ok: false; error: string } | { ok: true; amount: number } {
  if (!is2026(g)) return { ok: false, error: "Abwerben gibt es nur in der Version 2026" };
  if (poacher === owner) return { ok: false, error: "Das ist Ihr eigener Spieler" };
  const l = g.lineups.at(owner * 25 + place);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  const p = g.players.at(l.playerIndex);
  if (p.u8(33) !== owner) return { ok: false, error: texte("ui.leihspieler").join(" ") };
  if (l.u8(12) !== 0) return { ok: false, error: texte("ui.leihspieler").join(" ") };
  if (l.u8(24) & 0x80) return { ok: false, error: texte("ui.hoertauf").join(" ") };
  if (Math.trunc(bonus) < 0 || Math.trunc(bonus) > POACH_MAX_BONUS) return { ok: false, error: `H|chstens ${POACH_MAX_BONUS}% Aufschlag` };
  if (g.squadOf(owner).length <= POACH_MIN_SQUAD) return { ok: false, error: `Der Kader mu~ ${POACH_MIN_SQUAD} Spieler behalten` };
  if (poachLeft(g, poacher, owner) <= 0)
    return { ok: false, error: POACH_MAX_PER_OWNER === 1 ? "Von diesem Manager haben Sie diese Saison schon einen" : `Von diesem Manager haben Sie schon ${POACH_MAX_PER_OWNER} Spieler` };
  if (!poachAllowedFrom(g, poacher, owner)) return { ok: false, error: "Abgeworben wird nur nach oben: dieser Verein steht hinter Ihnen" };
  let frei = 0;
  while (frei < 24 && !g.lineups.at(poacher * 25 + frei).isEmpty) frei++;
  if (frei >= 24) return { ok: false, error: "Ihr Kader ist voll" };
  const amount = poachAmount(g, owner, place, bonus);
  if (g.managers.at(poacher).balance < amount) return { ok: false, error: texte("ui.zuwenig").join(" ") };
  return { ok: true, amount };
}

/**
 * Abwerbeversuch ausführen. Sagt der Spieler zu, wechselt er mit allem, was auf seinem
 * Kaderplatz steht (Vertrag, Gehalt, Karten, Verletzung), bekommt eine freie Rückennummer und
 * die Ablöse wird gebucht.
 */
export function poach(g: GameState, poacher: number, owner: number, place: number, bonus: number, rng: Rng, counter = 0): PoachResult {
  const pruef = poachCheck(g, poacher, owner, place, bonus);
  if (!pruef.ok) return pruef;
  const amount = pruef.amount;
  // Gegenwehr des Besitzers: die Gehaltserhöhung steht schon auf dem Kaderplatz und drückt die
  // Zustimmung um ihren Prozentsatz
  const chance = poachChance(g, poacher, owner, place, bonus, counter);
  if (rng(0, 99) >= chance) return { ok: true, agreed: false, amount, chance };
  const l = g.lineups.at(owner * 25 + place);
  const spieler = l.playerIndex;
  let ziel = 0;
  while (ziel < 24 && !g.lineups.at(poacher * 25 + ziel).isEmpty) ziel++;
  const bytes = slotBytes(g, owner * 25 + place);
  bytes[10] = 0; // Rückennummer neu vergeben
  bytes[9] &= 0x3f; // offene Angebote bleiben beim alten Verein
  setSlotBytes(g, poacher * 25 + ziel, bytes);
  ziel = sortIntoSquad(g, poacher, ziel);
  assignNumber(g, poacher, ziel);
  removePlace(g, owner * 25, place, 25);
  addBalance(g, poacher, -amount);
  addBalance(g, owner, amount);
  const p = g.players.at(spieler);
  p.setU8(33, poacher);
  p.setU8(36, g.managers.at(poacher).clubIndex);
  g.save.plain[POACH_COUNT_OFFSET + poacher * 4 + owner] = poachCount(g, poacher, owner) + 1;
  return { ok: true, agreed: true, amount, chance, place: ziel };
}

/**
 * Gegenwehr: das Monatsgehalt des Spielers um `prozent` erhöhen (Version 2026). Liefert das neue
 * Gehalt; die Erhöhung bleibt auf dem Kaderplatz stehen, auch wenn der Spieler doch wechselt.
 */
export function raiseSalary(g: GameState, owner: number, place: number, prozent: number): number {
  const p = clamp(Math.trunc(prozent), 0, POACH_COUNTER_MAX);
  const idx = owner * 25 + place;
  const l = g.lineups.at(idx);
  if (l.isEmpty || p === 0) return l.isEmpty ? 0 : l.i32(40);
  const neu = div(l.i32(40) * (100 + p), 100);
  const off = TABLES.lineups.offset + idx * 52 + 40;
  for (let i = 0; i < 4; i++) g.save.plain[off + i] = (neu >>> (8 * i)) & 0xff;
  return neu;
}
