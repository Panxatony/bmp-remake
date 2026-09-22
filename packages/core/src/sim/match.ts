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

/**
 * Der Zufall des Originals (GitLab #99): rand() von Microsoft C (0x3B7CE) -
 * Zustand = Zustand·214013 + 2531011 (32 Bit), Ergebnis Bits 16..30 - und random(lo, hi)
 * = lo + rand % (hi - lo + 1) mit 16-Bit-Arithmetik (0x08377, idiv mit Vorzeichen). `srand(k)`
 * setzt den Zustand auf k (0x3B7BC). Für den bytegenauen Vergleich mit einer Testkopie des
 * Originals, die jeden Tag mit demselben Startwert beginnt (tools/seed-patch.py).
 * `zaehler` zählt die Würfe mit - so lässt sich eine Abweichung eingrenzen.
 */
export function originalRng(seed: number): Rng & { zustand(): number; zaehler(): number } {
  let s = seed >>> 0;
  let n = 0;
  const s16 = (v: number) => (v << 16) >> 16;
  const f = ((lo: number, hi: number) => {
    s = (Math.imul(s, 214013) + 2531011) >>> 0;
    n++;
    const r = (s >>> 16) & 0x7fff;
    const l = s16(lo);
    const span = s16(s16(hi) - l + 1);
    if (span === 0) return l; // Division durch 0 bricht im Original ab; hier nur der Vollständigkeit halber
    // idiv: Rest hat das Vorzeichen des Dividenden (r ist nie negativ)
    return s16(l + (r % span));
  }) as Rng & { zustand(): number; zaehler(): number };
  f.zustand = () => s;
  f.zaehler = () => n;
  return f;
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
  // 0x043D3: mit random(0,1) != 0 das Größere von a und b, sonst b (0x043F2 springt nur bei b < a
  // zu a). Bis #99 stand hier das Kleinere - gefunden mit dem bytegenauen Vergleich.
  const pick = (a: number, b: number) => (rng(0, 1) !== 0 && b < a ? a : b);
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

/**
 * Chancenminuten im Fenster (0x043FF), höchstens 8 Plätze; der Index ist der Platz. In der Liga
 * verschieden: gezogen wird, bis die Minute frei ist, höchstens 100-mal - danach bleibt der Platz
 * leer (0, 0x044F4), auch wenn der hundertste Wurf gepasst hätte. Im Pokal (Wettbewerb 10 und
 * darüber: DFB-Pokal, Europapokal, Relegation) prüft das Original keine Doppelten - dort gibt es
 * auch zwei Chancen in derselben Minute.
 */
export function chanceMinutes(count: number, from: number, to: number, rng: Rng, verschieden = true): number[] {
  const out: number[] = [];
  const n = Math.min(count, 8);
  for (let i = 0; i < n; i++) {
    let m: number;
    let tries = 0;
    do {
      m = rng(from, to);
      tries++;
    } while (verschieden && out.includes(m) && tries < 100);
    out.push(tries >= 100 ? 0 : m);
  }
  return out;
}

export interface Chancenplatz {
  minute: number;
  side: "home" | "away";
  /** Platz 0..7 in der Minutenliste der Seite */
  slot: number;
}

/**
 * Chancen einer Halbzeit in der Reihenfolge der Live-Schleife (0x0576E): je Minute die Plätze
 * 0..7, bei jedem Platz erst Heim, dann Gast. Zwei Chancen derselben Minute kommen also in der
 * Reihenfolge ihrer Plätze - nicht alle Heimchancen vor den Gastchancen (#99). Leere Plätze
 * (Minute 0) fallen weg.
 */
export function chancenplaetze(home: number[], away: number[]): Chancenplatz[] {
  const list: Chancenplatz[] = [];
  home.forEach((minute, slot) => minute > 0 && list.push({ minute, side: "home", slot }));
  away.forEach((minute, slot) => minute > 0 && list.push({ minute, side: "away", slot }));
  return list.sort(chancenFolge);
}

export function chancenFolge(a: Chancenplatz, b: Chancenplatz): number {
  return a.minute - b.minute || a.slot - b.slot || (a.side === "home" ? -1 : 1) - (b.side === "home" ? -1 : 1);
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
export function simulateMatch(home: TeamStrength, away: TeamStrength, rng: Rng, pokal = false): MatchResult {
  const events: MatchEvent[] = [];
  let hg = 0;
  let ag = 0;
  for (const [from, to] of [
    [1, 45],
    [46, 90],
  ] as const) {
    const n = chanceCounts(home, away, from, to, rng);
    const heim = chanceMinutes(n.home, from, to, rng, !pokal);
    const list = chancenplaetze(heim, chanceMinutes(n.away, from, to, rng, !pokal));
    for (const c of list) {
      const goal = goalDice(home, away, c.side, c.minute, hg, ag, rng);
      if (goal) c.side === "home" ? hg++ : ag++;
      events.push({ minute: c.minute, side: c.side, goal });
    }
  }
  return { home: hg, away: ag, events };
}
