/**
 * Schrittweise Spielsimulation für die Live-Konferenz (Live-Schleife 0x05404): die
 * Chancenminuten einer Halbzeit werden zu deren Beginn gewürfelt (0x102BA), in jeder
 * Chancenminute entscheidet der Torwürfel (0x1060C) mit den dann gültigen Stärken. Ohne
 * Stärkeänderung entsteht dieselbe Zufallsfolge wie in simulateMatch. Auswechslungen
 * ändern die Stärke einer Seite ab der nächsten Minute (Kaderbildschirm mit Spielweg,
 * 0x21190). Auswechselgrenzen wie im Original (4238:5396): ein Torwart, zwei Feldspieler.
 *
 * Innerhalb einer Minute hält das Original diese Reihenfolge je Spiel: erst Karten und
 * Verletzungen (0x05FE5), nach glatt Rot oder Verletzung die Chancen des Spiels neu (0x0657F),
 * dann die Chancen der Minute (0x1060B). Deshalb ist die Minute zweigeteilt: `beginMinute`
 * und `chances`; `step` macht beides.
 */
import { chanceCounts, chanceMinutes, chancenFolge, chancenplaetze, goalDice, type Chancenplatz, type MatchEvent, type MatchResult, type Rng, type TeamStrength } from "./match.ts";

export interface LiveChance {
  minute: number;
  side: "home" | "away";
  goal: boolean;
}

export const SUBSTITUTIONS = { goalkeeper: 1, field: 2 } as const;

export class LiveMatch {
  minute = 0;
  hg = 0;
  ag = 0;
  events: MatchEvent[] = [];
  private pending: Chancenplatz[] = [];
  /** Chancenzahl der laufenden Halbzeit, wie zu ihrem Beginn gewürfelt (4238:21DA). */
  private halbzeitChancen: [number, number] = [0, 0];
  /** Nach einer Neuauslosung je Manager fortgeschrieben (4238:21DA gilt je Manager). */
  private chancenJeManager = new Map<number, [number, number]>();
  private halbzeit: readonly [number, number] = [1, 45];
  private pokal: boolean;
  /**
   * Markierung im Heimergebnis während der Verlängerung (0x18E46 setzt +10 nur beim offenen
   * Spiel). Die Live-Schleife spielt die Verlängerung aber für alle Paare des Wettbewerbs; bei den
   * entschiedenen steht keine Markierung.
   */
  marke = 10;

  home: TeamStrength;
  away: TeamStrength;
  private rng: Rng;
  halves: (readonly [number, number])[];

  /** `pokal`: Wettbewerb 10 und darüber (DFB-Pokal, Europapokal, Relegation), siehe chanceMinutes. */
  constructor(home: TeamStrength, away: TeamStrength, rng: Rng, halves: readonly (readonly [number, number])[] = [[1, 45], [46, 90]], pokal = false) {
    this.home = home;
    this.away = away;
    this.rng = rng;
    this.halves = halves.slice();
    this.pokal = pokal;
  }

  /**
   * Verlängerung anhängen (0x18E46, in europa.ts als `extraTime` für die Buchung): zwei Blöcke
   * 91..105 und 106..120, deren Chancen zu Beginn des jeweiligen Blocks gewürfelt werden - also
   * dieselbe Zufallsfolge wie dort. Der Aufrufer prüft vorher, ob es überhaupt unentschieden
   * steht (GitLab #72).
   */
  verlaengern(): void {
    if (this.halves.length > 2) return;
    this.halves.push([91, 105], [106, 120]);
  }

  get finished(): boolean {
    return this.minute >= this.halves[this.halves.length - 1][1];
  }

  /** Eine Minute weiter; liefert die Chancen dieser Minute (Heim vor Gast wie im Original). */
  step(): LiveChance[] {
    if (!this.beginMinute()) return [];
    return this.chances();
  }

  /** Uhr eine Minute weiter; zu Beginn einer Halbzeit werden deren Chancen gewürfelt (0x102BA). */
  beginMinute(): boolean {
    if (this.finished) return false;
    this.minute++;
    for (const half of this.halves) {
      const [from, to] = half;
      if (this.minute !== from) continue;
      const n = chanceCounts(this.home, this.away, from, to, this.rng);
      this.halbzeit = half;
      this.halbzeitChancen = [n.home, n.away];
      this.chancenJeManager.clear();
      const heim = chanceMinutes(n.home, from, to, this.rng, !this.pokal);
      this.pending.push(...chancenplaetze(heim, chanceMinutes(n.away, from, to, this.rng, !this.pokal)));
      this.sortPending();
    }
    return true;
  }

  /**
   * Nach glatt Rot oder einer Verletzung beim Manager `manager` (0x0657F): die Chancenzahl der
   * ganzen Halbzeit wird mit den neuen Stärken noch einmal gewürfelt (0x102BA, ohne Minuten).
   * Übrig bleibt je Seite die neue Zahl abzüglich der schon gespielten Chancen. Deren Minuten
   * werden ab der laufenden Minute bis zum Halbzeitende neu verteilt (0x043FF), die alten
   * verfallen. Die laufende Minute zählt mit.
   *
   * **Bewusst anders als das Original (GitLab #87).** Das Original verrechnet
   * rest = alt - gespielt + (neu - alt), aber nur wenn neu >= alt; sonst schlägt es die ganze
   * neue Zahl drauf - die geschwächte Seite bekommt so eher mehr Chancen. `wieOriginal` rechnet
   * so, für den bytegenauen Vergleich (originaltag.ts).
   */
  neuAuslosen(manager: number, wieOriginal = false): void {
    const [from, to] = this.halbzeit;
    const alt = this.chancenJeManager.get(manager) ?? this.halbzeitChancen;
    const n = chanceCounts(this.home, this.away, from, to, this.rng);
    const neu: [number, number] = [n.home, n.away];
    const rest: [number, number] = [0, 0];
    const seiten = ["home", "away"] as const;
    for (let i = 0; i < 2; i++) {
      const seite = seiten[i];
      const gespielt = this.events.filter((e) => e.side === seite && e.minute >= from && e.minute < this.minute).length;
      if (wieOriginal) {
        if (alt[i] <= neu[i]) neu[i] -= alt[i];
        rest[i] = Math.max(0, alt[i] - gespielt + neu[i]);
      } else rest[i] = Math.max(0, neu[i] - gespielt);
      this.pending = this.pending.filter((c) => c.side !== seite);
      chanceMinutes(rest[i], this.minute, to, this.rng, !this.pokal).forEach((minute, slot) => minute > 0 && this.pending.push({ minute, side: seite, slot }));
    }
    this.chancenJeManager.set(manager, rest);
    this.sortPending();
  }

  /**
   * Die Chancen der laufenden Minute auswürfeln (0x1060B). `nachChance` läuft gleich nach jedem
   * Torwürfel: dort ruft das Original den Chancenhandler (0x108EF -> 0x1B223), noch vor dem
   * Würfel der nächsten Chance.
   */
  chances(nachChance?: (c: LiveChance) => void, vorWuerfel?: (side: "home" | "away") => void): LiveChance[] {
    const out: LiveChance[] = [];
    while (this.pending.length && this.pending[0].minute === this.minute) {
      const c = this.pending.shift()!;
      // In der Verlängerung liest das Original das Ergebnisbyte, in dem die Markierung +10 schon
      // steht: der Torwürfel bekommt den Heimwert um 10 erhöht (wie `extraTime`).
      const hg = this.minute > 90 ? this.hg + this.marke : this.hg;
      // 0x10703: nach der 90. Minute würfelt nur ein Spiel mit Markierung (Heimwert ab 10); die
      // Chancen der entschiedenen Paare verfallen ohne Würfel und ohne Chancenhandler
      if (this.minute > 90 && hg < 10) continue;
      vorWuerfel?.(c.side);
      const goal = goalDice(this.home, this.away, c.side, this.minute, hg, this.ag, this.rng);
      if (goal) c.side === "home" ? this.hg++ : this.ag++;
      this.events.push({ minute: this.minute, side: c.side, goal });
      out.push({ minute: this.minute, side: c.side, goal });
      nachChance?.({ minute: this.minute, side: c.side, goal });
    }
    return out;
  }

  private sortPending(): void {
    this.pending.sort(chancenFolge);
  }

  result(): MatchResult {
    return { home: this.hg, away: this.ag, events: this.events.slice() };
  }
}

/** Ergebnislieferant für die Buchungsroutinen: liefert ein vorher live gespieltes Ergebnis. */
export type MatchSim = (home: number, away: number, hs: TeamStrength, as: TeamStrength, rng: Rng) => MatchResult;
