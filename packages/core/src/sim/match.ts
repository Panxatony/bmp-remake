/**
 * Spielsimulation nach dem Original (docs/routines/spielsimulation.md).
 *
 * Ein Verein geht als Stärkematrix ein: bytes 23..32 des Vereinsdatensatzes,
 * also Grundzuschlag, Kondition/Technik/Form je Linie (Abwehr, Mittelfeld,
 * Angriff). Für Managervereine wird die Matrix vorher aus der Aufstellung
 * berechnet.
 */

export interface TeamStrength {
  /** Vereinsbyte 23 (47..53) */
  base: number;
  /** Kondition je Linie: Abwehr, Mittelfeld, Angriff (Bytes 24..26) */
  ko: [number, number, number];
  /** Technik je Linie (Bytes 27..29) */
  te: [number, number, number];
  /** Form je Linie (Bytes 30..32) */
  fo: [number, number, number];
}

/** Zufallszahl von lo bis hi einschließlich, wie random(lo,hi) im Original. */
export type Rng = (lo: number, hi: number) => number;

export function mulberryRng(seed: number): Rng {
  let s = seed >>> 0;
  return (lo, hi) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return lo + Math.floor(r * (hi - lo + 1));
  };
}

/** Ganzzahldivision mit Rundung zur Null (C-Semantik). */
const div = (a: number, b: number): number => Math.trunc(a / b);

const WEIGHTS = [
  [80, 20, 0],
  [25, 50, 25],
  [0, 20, 80],
] as const;

const CHANCE_TABLE = [1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4];

/** Aktuelle Stärke (0x04568): part 0 Abwehr, 1 Mittelfeld, 2 Angriff. */
export function strength(t: TeamStrength, part: 0 | 1 | 2, minute: number): number {
  let sum = 0;
  for (let l = 0; l < 3; l++) {
    const te = t.te[l];
    let v = te + div(10 * minute, -1 - te);
    if (v < 0) v = 0;
    v += t.fo[l] + t.ko[l];
    sum += Math.trunc((v * WEIGHTS[part][l]) / 100);
  }
  return sum + t.base - 44;
}

/** Chancenzahl je Seite für einen Spielabschnitt (0x102BA). */
export function chanceCounts(home: TeamStrength, away: TeamStrength, from: number, to: number, rng: Rng): { home: number; away: number } {
  const pick = (a: number, b: number) => (rng(0, 1) !== 0 && a < b ? a : b);
  let h = rng(0, 1);
  let g = 0;
  const sh = strength(home, 1, from);
  const sg = strength(away, 1, from);
  let d = div(sh, 3) - div(sg, 3);
  if (d > 0) {
    const k = d <= 19 ? CHANCE_TABLE[d] : div(d, 5);
    const a = rng(1, k);
    const b = rng(1, k);
    if (rng(0, 1) !== 0 && d > 8) h += pick(a, b);
    else h = a;
    if (d < 25) g = rng(0, 2);
  } else {
    d = -d;
    const k = d <= 19 ? CHANCE_TABLE[d] : div(d, 5);
    if (d < 25) h += rng(0, 2);
    const a = rng(1, k);
    const b = rng(1, k);
    if (rng(0, 2) === 0 && d > 8) g += pick(a, b);
    else g = a;
  }
  g += rng(0, 2);
  h += rng(0, 3);
  while (h > 8 || g > 8) {
    h--;
    g--;
  }
  if (h > 4 && rng(0, 1) !== 0) h--;
  if (g > 4 && rng(0, 1) !== 0) g--;
  if ((h > 2 || g > 2) && rng(0, 1) !== 0) {
    h--;
    g--;
  }
  if (h < 0) h = 0;
  if (g < 0) g = 0;
  if (sh === 0) {
    h = 0;
    if (sg > 20) g = 8;
  }
  if (sg === 0) {
    g = 0;
    if (sh > 20) h = 8;
  }
  h = div(h * (to - from), 45);
  g = div(g * (to - from), 45);
  if (from > 90) {
    h++;
    g++;
  }
  return { home: h, away: g };
}

/** Verschiedene Chancenminuten im Fenster (0x043FF), höchstens 8. */
export function chanceMinutes(count: number, from: number, to: number, rng: Rng): number[] {
  const out: number[] = [];
  const n = Math.min(count, 8);
  for (let i = 0; i < n; i++) {
    let m = rng(from, to);
    for (let tries = 0; tries < 100 && out.includes(m); tries++) m = rng(from, to);
    out.push(m);
  }
  return out;
}

/** Torwürfel in einer Chancenminute (0x1060C). */
export function goalDice(home: TeamStrength, away: TeamStrength, side: "home" | "away", minute: number, hg: number, ag: number, rng: Rng): boolean {
  const threatAway = div(strength(away, 2, minute) - strength(home, 0, minute), 3);
  const threatHome = div(strength(home, 2, minute) - strength(away, 0, minute), 3);
  let t: number;
  if (side === "home") {
    if (hg === 9 || hg >= 19) return false;
    if (rng(0, 4) <= 1) return false;
    t = threatHome;
  } else {
    if (ag === 9 || ag >= 19) return false;
    if (rng(0, 1) === 0) return false;
    t = threatAway;
  }
  if (t > 0) {
    const p = div(t, 4) + 2;
    return rng(0, p) !== 0;
  }
  const p = div(-t, 4);
  if (rng(0, p) === 0) return true;
  return rng(0, 6) === 0;
}

export interface MatchEvent {
  minute: number;
  side: "home" | "away";
  goal: boolean;
}

export interface MatchResult {
  home: number;
  away: number;
  events: MatchEvent[];
}

/** Ein Spiel über zwei Halbzeiten; das Original ruft die Live-Schleife mit 1..45 und 46..90 auf. */
export function simulateMatch(home: TeamStrength, away: TeamStrength, rng: Rng): MatchResult {
  const events: MatchEvent[] = [];
  let hg = 0;
  let ag = 0;
  for (const [from, to] of [
    [1, 45],
    [46, 90],
  ] as const) {
    const n = chanceCounts(home, away, from, to, rng);
    const list: { minute: number; side: "home" | "away" }[] = [];
    for (const m of chanceMinutes(n.home, from, to, rng)) list.push({ minute: m, side: "home" });
    for (const m of chanceMinutes(n.away, from, to, rng)) list.push({ minute: m, side: "away" });
    list.sort((a, b) => a.minute - b.minute || (a.side === "home" ? -1 : 1));
    for (const c of list) {
      const goal = goalDice(home, away, c.side, c.minute, hg, ag, rng);
      if (goal) c.side === "home" ? hg++ : ag++;
      events.push({ minute: c.minute, side: c.side, goal });
    }
  }
  return { home: hg, away: ag, events };
}
