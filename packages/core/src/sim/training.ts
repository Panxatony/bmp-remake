/**
 * Training und Frische je Kalendertag für einen Manager (Trainingsfunktion 0x0DF0D).
 * Der Tagesablauf ruft sie an jedem Spieltag-Kalendertag (Saisontag 0 oder 4 mod 7),
 * bis Saisontag 321. Siehe docs/SPIELMECHANIK.md.
 */
import type { GameState, Lineup } from "../records.ts";
import { texte } from "../data/texte.ts";
import type { Rng } from "./match.ts";

/** Trainingsmatrix DGROUP 0x292: Zeilen Kondition/Spiel/Schuss/Taktik, Spalten Ko/Te/Fo. */
const MATRIX = [
  [80, 5, 15],
  [30, 40, 30],
  [20, 25, 55],
  [5, 65, 30],
];

/** Grunddauer der 18 Verletzungsarten in Wochen (DGROUP 0x5BC); die Namen stehen im Katalog. */
export const INJURY_WEEKS = [1, 2, 1, 2, 2, 4, 2, 1, 1, 6, 12, 5, 7, 10, 11, 9, 20, 14];

/** Verletzungsarten (DGROUP 0x23B4) mit Grunddauer in Wochen. */
export const injuries = (): { name: string; weeks: number }[] =>
  texte("verletzungen").map((name, i) => ({ name, weeks: INJURY_WEEKS[i] }));

export interface TrainingInput {
  /** Endlosspiel-Flag (4cb3:224D, nicht im Spielstand) */
  endless: number;
  /** Spiel-Level (Save-Offset 34062) */
  level: number;
}

export function trainingInput(g: GameState, endless = 0): TrainingInput {
  return { endless, level: g.save.plain[34062] };
}

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Das Fenster nach der Winterpause, in dem die Frische Zuschläge bekommt (0xEBB2..0xEC0C):
 * Saisontag über 130 + 7·Endlos und unter 207 - 14·Endlos, dazu alles nach Saisontag 322.
 *
 * Bis GitLab #27 stand der zweite Vergleich verkehrt herum (`> 207`): das Fenster lag dadurch
 * in der Rückrunde statt davor. Der Code vergleicht `207 - 14·Endlos` mit dem Saisontag und
 * springt mit `ja` in den Zuschlag - also nur, solange der Saisontag *darunter* liegt.
 */
function inWindow(seasonDay: number, endless: number): boolean {
  if (seasonDay > 130 + 7 * endless && seasonDay < 207 - 14 * endless) return true;
  return seasonDay > 322;
}

/**
 * Frische, Trainingsgewinn (Kaderplatz Bytes 16..18) und Trainingsfaktor (Byte 14)
 * aller Kaderplätze eines Managers für einen Kalendertag.
 */
export function dailyTraining(g: GameState, manager: number, seasonDay: number, inp: TrainingInput, rng: Rng, freeDay = false, ohneVerletzungen = false, plaetze?: number): void {
  if (seasonDay > 321) return;
  const m = g.managers.at(manager);
  // Die Trainingsverletzungen würfelt das Original in der Kaderschleife davor (0x0E668); die
  // Tagesroutine ruft sie dort je Platz auf (sim/tagesroutine.ts)
  if (!ohneVerletzungen) trainingInjuries(g, manager, inp.level, freeDay, rng);
  const balls = [321, 322, 323, 324].map((o) => 20 * m.u8(o));
  const gainBase = [0, 1, 2].map((l) => div(balls.reduce((s, b, k) => s + MATRIX[k][l] * b, 0), 400));
  const threshold = 37 - (inp.level === 5 ? 1 : 0);
  const window = inWindow(seasonDay, inp.endless);
  const loFr = 7 * inp.endless + 130;
  const hiFr = 207 - 14 * inp.endless;

  // `plaetze`: die Tagesroutine geht wie das Original die Plätze 0..Anzahl-1 durch (0x31A19
  // zählt die belegten), auch über eine Lücke hinweg
  const liste = plaetze === undefined ? g.squadOf(manager) : Array.from({ length: plaetze }, (_, i) => g.lineups.at(manager * 25 + i));
  for (const l of liste) {
    injuryCountdown(l, seasonDay);
    let intens = m.u8(325);
    // Frische
    let fr = l.u8(19);
    // 0xEFD4 vergleicht mit 0x32 = 50. Die 56 bei 0xDF8F gehört zur Schleife über die
    // Transfermarktspieler (Aufstellung 100 + Platz) und steht in dailyTransfers.
    if (fr > 50) fr -= rng(3, 7);
    // Im Fenster nach der Winterpause trainiert niemand unter Intensität 6 (0xF006..0xF03D).
    // Anders als der Zuschlag gilt das nicht nach Saisontag 322.
    if (seasonDay > loFr && seasonDay < hiFr && intens < 6) intens = 6;
    fr = (fr + (intens - 5) * 2) & 0xff;
    if (fr > 130 && intens < 6) fr -= rng(1, 3);
    fr = clamp(fr, 60, 150);
    l.setU8(19, fr);
    let factor = 20 * intens;
    if (fr > 135) {
      factor -= rng(70 - 13 * inp.level, 90 - 5 * inp.level);
      if (factor < 10) factor = 10;
    }
    const p = g.players.at(l.playerIndex);
    const posGroup = div(p.u8(31), 25);
    if (posGroup === 0) factor += 30;

    // Linien Kondition, Technik, Form
    for (let line = 0; line < 3; line++) {
      let gain = div(gainBase[line] * factor, 100);
      gain = div(gain * l.u8(14), 50);
      const posBalls = 10 * m.u8(326 + posGroup) + 75 - rng(0, 3);
      gain = div(gain * posBalls, 100);
      let value = l.u8(16 + line);
      let dir = 0;
      let target = rng(0, 4) === 4 ? 1 : 0;
      // Frischezuschlag je Linie im Fenster (0xEC50 ab Level 3, 0xECEB unter Level 2; Level 2
      // bekommt keinen). Er landet nach der Begrenzung auf 60..150 im Kaderplatz und wird
      // erst am nächsten Tag wieder begrenzt.
      //
      // In #24 war er gestrichen worden, weil die Messung am Saisontag 249 ihn nicht zeigte.
      // Das lag am verkehrten Fenster (siehe inWindow): am Saisontag 249 gibt es ihn im
      // Original tatsächlich nicht, wohl aber zwischen den Tagen 131 und 206 (GitLab #27).
      if (inp.level > 2 && window) {
        if (rng(0, 2) === 0) target++;
        target = rng(threshold - target - 1, threshold + 2);
        l.setU8(19, (l.u8(19) + rng(0, 2)) & 0xff);
      } else target = rng(threshold - target - 2, threshold + 2);
      if (inp.level < 2 && window) l.setU8(19, (l.u8(19) + rng(0, 2)) & 0xff);
      if (gain < target - 8) {
        if (rng(0, 1) !== 0) {
          dir = -1;
          target = div(target - gain + 8, 11);
        }
      } else if (gain > target + 8) {
        if (rng(0, 1) !== 0) {
          dir = 1;
          target = div(gain - target + 8, 11);
        }
      }
      if (rng(0, 3) !== 0 || dir === 0) continue;
      if (target > 2) target = rng(2, 3);
      if (target === 0) continue;
      value += rng(1, target) * dir;
      value = line < 2 ? clamp(value, 1, 99) : clamp(value, 45, 55);
      l.setU8(16 + line, value);
    }

    // Trainingsfaktor Byte 14 und Sonderprogramm Byte 20 (Bit 7 Richtung, Bits 4..6 Stärke, Bits 0..3 Restdauer)
    let f14 = l.u8(14);
    const b20 = l.u8(20);
    if (rng(0, 3) !== 0) {
      const strength = (b20 & 0x70) >> 4;
      f14 += b20 & 0x80 ? strength : -strength;
    }
    const rest = (b20 & 0x0f) - 1;
    l.setU8(20, ((b20 & 0xf0) + (rest & 0xff)) & 0xff);
    if (rest === 0) {
      // Sonderprogramm abgelaufen: neu auswürfeln (0x2277A)
      l.setU8(14, rng(35, 65));
      l.setU8(20, (rng(1, 13) | (rng(1, 3) << 4) | (rng(0, 1) << 7)) & 0xff);
      continue;
    }
    l.setU8(14, clamp(f14, 30, 68));
  }
}

/**
 * Trainingsverletzungen (0x0DF0D ab 0xE668): je Kaderplatz ohne Sperre und ohne jeden Merker in
 * Byte 9 Wahrscheinlichkeit
 * 1 / (30·Level + d + 81) mit d = max(40, 2·(160 - Frische + 25·[spielfreier Tag])).
 * Verletzung (0x17B0F): Grundform des Spielers (Byte 30) über 20 sinkt um random(12,19);
 * Art random(0,17), mit 50 % Chance neu gewürfelt, wenn ihre Dauer > random(2,4);
 * Dauer = Wochen + random(0, Wochen/4 + 1) in Byte 13, Flag-Bit 1, Art in Byte 23,
 * Nummer 0 (aus der Aufstellung genommen).
 */
export function trainingInjuries(g: GameState, manager: number, level: number, freeDay: boolean, rng: Rng): number[] {
  const injured: number[] = [];
  g.squadOf(manager).forEach((l, i) => {
    if (trainingsverletzung(g, l, level, freeDay, rng)) injured.push(i);
  });
  return injured;
}

/** Trainingsverletzung eines Kaderplatzes (0x0E668); true, wenn er sich verletzt hat. */
export function trainingsverletzung(g: GameState, l: Lineup, level: number, freeDay: boolean, rng: Rng): boolean {
  // Kaderbyte 9 muss ganz leer sein (0x0E6D1), nicht nur Sperre und Verletzung: wer etwa ein
  // Angebot eines fremden Vereins hat (Bit 6/7), verletzt sich nicht (GitLab #83, F5)
  if (l.u8(13) !== 0 || l.u8(9) !== 0) return false;
  let d = 2 * (160 - l.u8(19) + (freeDay ? 25 : 0));
  if (d < 40) d = 40;
  if (rng(0, 30 * level + d + 80) !== 0) return false;
  injurePlayer(g, l, rng);
  return true;
}

/** Verletzung eines Kaderplatzes (0x17B0F): Form - random(12,19), Art, Dauer, Flag-Bit 1, Nummer 0. */
export function injurePlayer(g: GameState, l: Lineup, rng: Rng): void {
  const p = g.players.at(l.playerIndex);
  if (p.u8(30) > 20) p.setU8(30, p.u8(30) - rng(12, 19));
  let kind = rng(0, 17);
  if (rng(0, 1) !== 0 && injuries()[kind].weeks > rng(2, 4)) kind = rng(0, 17);
  const weeks = injuries()[kind].weeks;
  l.setU8(13, weeks + rng(0, div(weeks, 4) + 1));
  l.setU8(9, l.u8(9) | 2);
  l.setU8(23, kind);
  l.setU8(10, 0);
}

/** Verletzung (Flag-Bit 1) zählt wöchentlich herunter; abgelaufene Sperre/Verletzung wird gelöscht (0x0F6D8). */
function injuryCountdown(l: Lineup, seasonDay: number): void {
  const flags = l.u8(9);
  if ((flags & 2) === 2 && l.u8(13) > 0 && seasonDay % 7 === 0) l.setU8(13, l.u8(13) - 1);
  if ((flags & 3) !== 0 && l.u8(13) === 0) l.setU8(9, flags & 0xfc);
}

// ---- Trainingsbildschirm (0x139EC) und Trainingslager (0x113E5, Wirkung 0x119CD) ----

/** Ballbudget (0x22919): vier Bereiche zusammen höchstens 20 Bälle, vier Positionsgruppen zusammen höchstens 10. */
export const TRAINING_BUDGET = { categories: 20, positions: 10, intensityBalls: 10, slider: 34 } as const;

export interface TrainingSettings {
  /** Bälle Kondition, Spiel, Schuss, Taktik (Byte 321..324) */
  balls: number[];
  /** Bälle Intensität (Byte 325) */
  intensityBalls: number;
  /** Bälle Tor, Abwehr, Mittelfeld, Angriff (Byte 326..329) */
  positions: number[];
  /** linker Regler Intensität/Jugendarbeit 0..34 (Byte 319) */
  slider: number;
}

export function trainingSettings(g: GameState, manager: number): TrainingSettings {
  const m = g.managers.at(manager);
  return { balls: [0, 1, 2, 3].map((i) => m.u8(321 + i)), intensityBalls: m.u8(325), positions: [0, 1, 2, 3].map((i) => m.u8(326 + i)), slider: m.u8(319) };
}

export function setTraining(g: GameState, manager: number, s: TrainingSettings): string | null {
  const ok = (v: number, hi: number) => Number.isInteger(v) && v >= 0 && v <= hi;
  if (s.balls.length !== 4 || s.positions.length !== 4) return "Ungültige Werte";
  if (!s.balls.every((v) => ok(v, TRAINING_BUDGET.categories)) || s.balls.reduce((a, b) => a + b, 0) > TRAINING_BUDGET.categories) return `Höchstens ${TRAINING_BUDGET.categories} Bälle für die Bereiche`;
  if (!s.positions.every((v) => ok(v, TRAINING_BUDGET.positions)) || s.positions.reduce((a, b) => a + b, 0) > TRAINING_BUDGET.positions) return `Höchstens ${TRAINING_BUDGET.positions} Bälle für die Positionen`;
  if (!ok(s.intensityBalls, TRAINING_BUDGET.intensityBalls) || !ok(s.slider, TRAINING_BUDGET.slider)) return "Ungültige Werte";
  const m = g.managers.at(manager);
  s.balls.forEach((v, i) => m.setU8(321 + i, v));
  m.setU8(325, s.intensityBalls);
  s.positions.forEach((v, i) => m.setU8(326 + i, v));
  m.setU8(319, s.slider);
  return null;
}

/**
 * Die drei Balken links unten im Trainingsbildschirm (Summen 0x10AF2, Höhe 0x139EC ab 0x13EBB):
 * über alle Kaderplätze mit Rückennummer 1..11 die Summen von Kondition (Byte 16), Technik
 * (Byte 17) und Frische (Byte 19). Die Balken sind höchstens 38 Pixel hoch; K und T stehen im
 * Verhältnis ihrer Summen (38 · (100 · Summe / (K + T)) / 100), E folgt der mittleren Frische
 * mit (Frische - 50) · 38 / 100.
 */
export function trainingBars(g: GameState, manager: number): [number, number, number] {
  let ko = 0;
  let te = 0;
  let fr = 0;
  let n = 0;
  for (const l of g.squadOf(manager)) {
    const nr = l.u8(10);
    if (nr === 0 || nr >= 12) continue;
    n++;
    ko += l.u8(16);
    te += l.u8(17);
    fr += Math.min(100, l.u8(19));
  }
  const total = ko + te === 0 ? 1 : ko + te;
  const share = (v: number) => Math.max(0, div(38 * div(100 * v, total), 100));
  // Der dritte Balken (Frische) rechnet mit **höchstens 100** je Spieler. Am Original
  // nachgemessen (GitLab #56): bei TEST/P4 stehen in Kaderbyte 19 der elf Aufgestellten
  // 67,80,129,105,99,67,99,101,80,128,131 - ungekappt gäbe das den Schnitt 98 und einen Balken
  // von 18, das Original zeigt aber 15, und das ist genau der Schnitt 90 der gekappten Werte.
  // Kein anderes Kaderbyte kommt auf diesen Schnitt. Wo das Original kappt, ist noch offen:
  // die Summenroutine 0x10AF2 addiert die Bytes roh, die Grenze muss also beim Schreiben
  // liegen - oder Byte 19 bedeutet über 100 etwas anderes, als wir bisher annehmen.
  return [share(ko), share(te), Math.max(0, div((div(fr, n || 1) - 50) * 38, 100))];
}

/**
 * Acht Trainingslager (Bild 5.VGA, spaltenweise): Name (4cb3:2394), Grundwert des Preises
 * (4cb3:5244 ab Index 5) und Wirkungsprofil (4cb3:527E). Der Wochenpreis steht erst fest, wenn
 * der Bildschirm zum ersten Mal offen ist (0x113E5 ab 0x11477): Grundwert · Kadergröße · 2000.
 * Das Original rechnet ihn einmal je Programmlauf mit dem Kader des gerade ziehenden Managers
 * aus; das Remake nimmt den Kader dessen, der hinsieht.
 */
/** Trainingslager (4cb3:28D0): Grundwert und Profil; die Namen stehen im Katalog. */
const CAMP_DATA = [
  { base: 5, profile: [1, 2, 1, 1, 1] },
  { base: 6, profile: [1, 2, 3, 1, 1] },
  { base: 7, profile: [1, 3, 2, 1, 1] },
  { base: 10, profile: [2, 4, 3, 2, 2] },
  { base: 11, profile: [2, 1, 2, 4, 4] },
  { base: 10, profile: [2, 4, 3, 2, 2] },
  { base: 13, profile: [3, 2, 2, 3, 4] },
  { base: 15, profile: [5, 3, 2, 4, 5] },
] as const;

export const camps = (): { name: string; base: number; profile: readonly number[] }[] =>
  texte("lager.namen").map((name, i) => ({ name, ...CAMP_DATA[i] }));

/** Bezeichner der fünf Profilwerte (4cb3:29A4 und 4cb3:28D0, Hinweiszeile 0x0243F). */
/** Bezeichner der fünf Profilwerte (4cb3:29A4); die Namen stehen im Katalog. */
const CAMP_LETTERS = ["E", "F", "P", "R", "V"] as const;

export const campTraits = (): { letter: string; name: string }[] =>
  texte("lager.eigenschaften").map((name, i) => ({ letter: CAMP_LETTERS[i], name }));

/** Wochenpreis eines Lagers: Grundwert · Kadergröße · 2000. */
export function campCost(g: GameState, manager: number, camp: number): number {
  return camps()[camp].base * g.squadOf(manager).length * 2000;
}

/**
 * Öffnungszeiten der acht Lager (4cb3:0620, nur im Speicher, nicht im Spielstand). Ein Wert über
 * 0 heißt "hat nicht geöffnet" (Spinnwebe), darunter ist das Lager frei; der Betrag zählt je
 * Kalendertag um 1 in Richtung 0 und wird bei 0 mit umgekehrtem Vorzeichen auf random(20,70)
 * neu gesetzt (0x11D2D). Beim Programmstart stehen die vier billigen Lager offen.
 */
export const CAMP_OPEN_START: readonly number[] = [-80, -50, -100, -60, 80, 50, 70, 60];

export function advanceCampOpen(open: number[], rng: Rng): void {
  for (let i = 0; i < open.length; i++) {
    const step = open[i] < 0 ? 1 : open[i] > 0 ? -1 : 0;
    open[i] += step;
    if (open[i] === 0) open[i] = rng(20, 70) * step;
  }
}

/** Sperre nach einem Lager: Managerbyte 313 zählt je Saisontag herunter (0x11DEE in 0x11D0D). */
export function campCountdown(g: GameState, manager: number): void {
  const m = g.managers.at(manager);
  if (m.u8(313) !== 0) m.setU8(313, m.u8(313) - 1);
}

/** Wirkungsmatrix 4cb3:52A6: vier Profilwerte auf Kondition, Technik, Form. */
const CAMP_MATRIX = [
  [20, 20, 40],
  [60, 10, 20],
  [20, 50, 20],
  [10, 40, 30],
];

export interface CampResult {
  cost: number;
  freshness: number;
  strength: [number, number, number];
}

/**
 * Trainingslager (0x119CD): Summen s[k] = Σ Profil[d]·Matrix[d][k] / 5. Je Kaderplatz:
 * Frische += random(w/9, w/6) mit w = max(80, -(s0+s1+s2)/3 + 2·(s0 - s2 + 10) + s1), begrenzt auf 60..150;
 * je Eigenschaft x = (random(2·Level+87, 2·Level+117) + s[k] - 100)/10, x += random(0,x) - random(0, 20x/30),
 * Wert += x/4 (höchstens 99); danach Trainingsfaktor und Sonderprogramm neu (0x2277A).
 */
export function trainingCamp(g: GameState, manager: number, camp: number, rng: Rng): CampResult | string {
  const c = camps()[camp];
  if (!c) return "Unbekanntes Lager";
  const m = g.managers.at(manager);
  if (m.u8(313) !== 0) return texte("ui.lagerzuoft").join(" ");
  const cost = campCost(g, manager, camp);
  if (m.i32(496) < cost) return texte("ui.keinGeld").join(" ");
  const s = [0, 1, 2].map((k) => div(c.profile.slice(0, 4).reduce((sum, v, d) => sum + v * CAMP_MATRIX[d][k], 0), 5));
  const level = g.save.plain[34062];
  let freshSum = 0;
  const strengthSum = [0, 0, 0];
  const squad = g.squadOf(manager);
  for (const l of squad) {
    let w = div(s[0] + s[1] + s[2], -3) + 2 * (s[0] - s[2] + 10) + s[1];
    if (w < 80) w = 80;
    l.setU8(19, Math.max(60, Math.min(150, l.u8(19) + rng(div(w, 9), div(w, 6)))));
    freshSum += l.u8(19);
    let x = 0;
    for (let k = 0; k < 3; k++) {
      const r = rng(2 * level + 87, 2 * level + 117);
      x = div(r + s[k] - 100, 10);
      const a = rng(0, div(20 * x, 30));
      const b = rng(0, x);
      x += b - a;
      l.setU8(16 + k, Math.min(99, (l.u8(16 + k) + (x >> 2)) & 0xff));
      strengthSum[k] += l.u8(16 + k);
    }
    x += div(x * s[2], 200);
    if (rng(0, 4) === 0) l.setU8(14, (l.u8(14) + div(rng(155, 300) * x, 800)) & 0xff);
    l.setU8(14, rng(35, 65));
    l.setU8(20, rng(1, 13) | (rng(1, 3) << 4) | (rng(0, 1) << 7));
  }
  const bal = m.i32(496) - cost;
  for (let i = 0; i < 4; i++) m.setU8(496 + i, (bal >>> (8 * i)) & 0xff);
  // Sperre des Menüpunkts: random(7,18) Kalendertage (0x11CD1)
  m.setU8(313, rng(7, 18));
  const n = Math.max(1, squad.length);
  return { cost, freshness: div(freshSum, n), strength: [div(strengthSum[0], n), div(strengthSum[1], n), div(strengthSum[2], n)] };
}
