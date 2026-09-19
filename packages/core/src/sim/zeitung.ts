/**
 * Sportzeitung nach dem Spieltag (0x2F243 mit Platzhalterausgabe 0x2ED04/0x2F15A, Gruppenwahl
 * 0x3058F, Artikel 0x2EFAB, Spielbericht 0x305DE). Schlagzeilen (69 Vorlagen, DGROUP 0x4F90,
 * Gruppen 4cb3:9322) und Artikelsätze (110 Vorlagen, DGROUP 0x90D2, Gruppen 4cb3:9350) mit
 * Platzhaltern: %0:%1 Endstand, %2:%3 Stand beim größten Rückstand, %4:%5 Stand bei der
 * größten Führung, %9 Zuschauer, %a eigener Verein, %b Gegner, %c bester und %d schwächster
 * Spieler, %t Manager, %e Zeilenumbruch, %x<s><n>A#B#…#% Auswahl (s = 0 Zufall, 1 Heim/Auswärts,
 * 2 Spielklasse 1..4, 3 Ergebnis 1 Remis/2 Sieg/3 Niederlage, 4 Zufriedenheit, 5 Spielverlauf).
 * Siehe docs/SPIELMECHANIK.md, Abschnitt "Sportzeitung".
 */
import type { GameState } from "../records.ts";
import { texte, text as T } from "../data/texte.ts";
import type { Rng, MatchEvent, TeamStrength } from "./match.ts";
import { strength } from "./match.ts";
import { matrixFor } from "./matchday.ts";
import { TOTAL_CAPACITY } from "./stadium.ts";
import { positionFit, lineDist } from "./goals.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Schlagzeilen (DGROUP 0x30F4, 69 Stück in 23 Gruppen): stehen im Textkatalog, nicht im Quelltext (data/texte.ts). */
export const schlagzeilen = (): string[] => texte("zeitung.schlagzeilen");

/** Gruppengrößen der Schlagzeilen (4cb3:9322). */
export const HEADLINE_GROUPS = [4, 2, 3, 4, 2, 3, 1, 2, 4, 3, 2, 2, 7, 4, 5, 3, 3, 3, 3, 3, 2, 2, 2];

/** Artikelsätze (DGROUP 0x3282, 109 Stück in 20 Gruppen): stehen im Textkatalog, nicht im Quelltext (data/texte.ts). */
export const artikel = (): string[] => texte("zeitung.artikel");

/** Gruppengrößen der Artikelsätze (4cb3:9350, die ersten 20 Gruppen). */
export const ARTICLE_GROUPS = [8, 5, 4, 8, 5, 7, 4, 7, 8, 10, 4, 4, 7, 6, 6, 5, 1, 1, 2, 7];

const groupBase = (sizes: number[], g: number): number => sizes.slice(0, g).reduce((a, b) => a + b, 0);

/** Schriftbelegung des Spiels ({ } | ~ [ ] \) in Codepage 437 wie die Namen im Spielstand. */
export function gameToCp437(s: string): string {
  const map: Record<string, string> = { "{": "\x84", "}": "\x81", "|": "\x94", "~": "\xe1", "[": "\x8e", "]": "\x9a", "\\": "\x99" };
  return s.replace(/[{}|~\[\]\\]/g, (c) => map[c]);
}

/** Spielbericht eines Managers (4238:90CA, 154 Bytes je Manager), soweit die Zeitung ihn liest. */
export interface MatchReport {
  manager: number;
  /** Vereinsindizes und Namen (Codepage 437) */
  own: number;
  opp: number;
  ownName: string;
  oppName: string;
  managerName: string;
  home: boolean;
  ownGoals: number;
  oppGoals: number;
  /** Stand beim größten Rückstand (%2:%3) und bei der größten Führung (%4:%5) */
  deficitScore: [number, number];
  leadScore: [number, number];
  /** größter Rückstand (<= 0, Byte 0xA) und größte Führung (>= 0, Byte 0xB) */
  deficit: number;
  lead: number;
  /** Alle Chancen beider Seiten in Spielreihenfolge */
  events: { minute: number; own: boolean; goal: boolean }[];
  /** Zuschauer (nur Heimspiel, sonst 0), ausverkauft (Byte 0x12) */
  attendance: number;
  soldOut: boolean;
  /** Karten im Spiel (Byte 0x94) */
  cards: number;
  /** Name des besten (Bewertung > 25) und schwächsten (< -15) Feldspielers, "" = keiner */
  best: string;
  worst: string;
  /** Stärken (0x04568 über drei Mannschaftsteile ·2/15) */
  ownStrength: number;
  oppStrength: number;
  /** Bild 0..29 -> PIC 200+ */
  picture: number;
  /** Aufstellung, Tore und Karten für die Fußzeilen */
  lineup: string;
  goals: string;
  yellow: string;
  red: string;
}

export interface Zeitung {
  headline: string[];
  sentences: string[];
  picture: number;
  lineup: string;
  goals: string;
  yellow: string;
  red: string;
}

/** Zustandsflags 4238:579C..57A0 für %x1..%x5. */
interface Flags {
  place: number;
  klasse: number;
  result: number;
  mood: number;
  momentum: number;
}

interface Ctx {
  r: MatchReport;
  flags: Flags;
  rng: Rng;
}

type Node = string | { sel: number; n: number; alts: Node[][] };

/**
 * Spielnote jedes Starters (0x3075D bis 0x3089B). Das Original rechnet am Ende des Spieltags
 * für jeden Aufgestellten einen Punktwert aus und teilt ihn durch 11; die Note ist auf 1 bis 6
 * begrenzt. Sie steht dann in einer Laufzeittabelle (4238:4D3C) und wird von der Sportzeitung
 * hinter den Namen gesetzt - es ist **nicht** die Rückennummer (GitLab #64).
 *
 * Der Punktwert (je kleiner, desto besser):
 *
 *   2 · ( (Kondition + Technik)/-33  -  |30 - Frische|/6  +  12 )
 *   + 4 · ( -(B + 12)/6 + 6 )        B = Spielbewertung (Kaderbyte 21) auf -12..36 begrenzt
 *   + Kaderbyte 19 / 33
 *   + Reihenabstand / 5              wie bei der Spielerwahl: |Positionswert - Reihe|
 *   + Positionsabstand               |Spielerbyte 32 - Kaderbyte 25|
 *
 * Danach greift die Zeitung selbst noch einmal ein: wer über 25 bewertet wurde (und einen
 * Positionswert hat), bekommt random(1,2) abgezogen, mindestens 1 (0x2F69D); der **erste**
 * Spieler unter -15 bekommt random(1,2) aufgeschlagen, höchstens 6 (0x2F6DB).
 */
function spielnoten(g: GameState, manager: number, rng: Rng, bewertungen?: Map<number, number>): Map<number, number> {
  // Schlüssel ist die Spielernummer, nicht der Kaderplatz: `squadOf` baut bei jedem Aufruf neue
  // Hüllen um dieselben Bytes, ein Map über diese Objekte fände später nichts wieder (#70).
  const aus = new Map<number, number>();
  let schlechtester = false;
  for (const l of g.squadOf(manager)) {
    const nr = l.u8(10);
    if (nr < 1 || nr > 11) continue;
    const p = g.players.at(l.playerIndex);
    const b = Math.max(-12, Math.min(36, bewertungen?.get(l.playerIndex) ?? (l.u8(21) << 24) >> 24));
    let wert = 2 * (div(l.u8(16) + l.u8(17), -33) - div(Math.abs(30 - l.u8(18)), 6) + 12);
    wert += 4 * (div(-(b + 12), 6) + 6);
    wert += div(l.u8(19), 33);
    wert += div(lineDist(l, p), 5);
    wert += positionFit(l, p);
    let note = Math.max(1, Math.min(6, div(wert, 11)));
    if (p.u8(31) !== 0 && b > 25) note = Math.max(1, note - rng(1, 2));
    else if (b < -15 && !schlechtester) {
      schlechtester = true;
      note = Math.min(6, note + rng(1, 2));
    }
    aus.set(l.playerIndex, note);
  }
  return aus;
}

/** Vorlage in Text und Auswahlknoten zerlegen (%x<s><n>A#B#…#%, verschachtelbar). */
function parse(t: string, i: number, nested: boolean): { nodes: Node[]; alts?: Node[][]; end: number } {
  const alts: Node[][] = [];
  let cur: Node[] = [];
  let text = "";
  const flush = () => {
    if (text) cur.push(text);
    text = "";
  };
  while (i < t.length) {
    const c = t[i];
    if (c === "%" && t[i + 1] === "x") {
      flush();
      const sel = t.charCodeAt(i + 2) - 48;
      const n = t.charCodeAt(i + 3) - 48;
      const sub = parse(t, i + 4, true);
      cur.push({ sel, n, alts: sub.alts ?? [] });
      i = sub.end;
      continue;
    }
    if (nested && c === "#") {
      flush();
      alts.push(cur);
      cur = [];
      if (t[i + 1] === "%") return { nodes: [], alts, end: i + 2 };
      i++;
      continue;
    }
    if (c === "%") {
      flush();
      cur.push("%" + t[i + 1]);
      i += 2;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return { nodes: cur, end: i };
}

function render(nodes: Node[], ctx: Ctx): string {
  const r = ctx.r;
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string") {
      if (n.length === 2 && n[0] === "%") {
        switch (n[1]) {
          case "0": out += r.ownGoals; break;
          case "1": out += r.oppGoals; break;
          case "2": out += r.deficitScore[0]; break;
          case "3": out += r.deficitScore[1]; break;
          case "4": out += r.leadScore[0]; break;
          case "5": out += r.leadScore[1]; break;
          case "9": out += r.attendance; break;
          case "a": out += r.ownName; break;
          case "b": out += r.oppName; break;
          case "c": out += r.best; break;
          case "d": out += r.worst; break;
          case "t": out += r.managerName; break;
          case "e": out += "\n"; break;
          default: out += n;
        }
      } else out += gameToCp437(n);
      continue;
    }
    let v: number;
    if (n.sel === 0) v = ctx.rng(1, n.n);
    else v = [0, ctx.flags.place, ctx.flags.klasse, ctx.flags.result, ctx.flags.mood, ctx.flags.momentum][n.sel] ?? 1;
    const alt = n.alts[clamp(v, 1, Math.max(1, n.alts.length)) - 1] ?? [];
    out += render(alt, ctx);
  }
  return out;
}

/** Vorlage mit Platzhaltern ausgeben (0x2ED04). */
export function expandTemplate(t: string, ctx: Ctx): string {
  return render(parse(t, 0, false).nodes, ctx);
}

/**
 * Gruppenwahl (0x3058F): die erste passende Gruppe wird immer genommen, jede weitere ersetzt die
 * bisherige Wahl mit random(1, prio) > 1, also mit (prio-1)/prio.
 */
function pick(rng: Rng, prio: number, cur: number, taken: { v: number }, lo: number, hi: number): number {
  if (rng(1, prio) > taken.v) {
    taken.v = 1;
    return rng(lo, hi);
  }
  return cur;
}

/** Zeitung eines Managers aus seinem Spielbericht zusammensetzen (0x2F243). */
export function composeZeitung(r: MatchReport, rng: Rng): Zeitung {
  const diff = r.ownGoals - r.oppGoals;
  const result = diff > 0 ? 1 : diff < 0 ? 2 : 0;
  const chances = r.events.length;
  // Frühe Tore/Chancen und später Treffer (Schleifen ab 0x2F4D2)
  const goals = r.events.filter((e) => e.goal);
  const misses = r.events.filter((e) => !e.goal);
  const earlyGoal = goals.some((e) => e.minute < 8);
  const earlyChance = !earlyGoal && misses.some((e) => e.minute < 8);
  const last = goals[goals.length - 1];
  const lateDecisive = last !== undefined && last.minute > 80 && Math.abs(r.ownGoals - r.oppGoals) <= 1;
  const ownMisses = misses.filter((e) => e.own).length;
  // Spielverlaufskurve: je Ereignis 66 Punkte (Gewichte 3,4,5,7,9,10,9,7,5,4,3) für oder gegen
  let sum = 0;
  for (const e of r.events) sum += e.own ? 66 : -66;
  if (div(sum, 120) > 2) sum = 2;
  const klasse = Math.min(4, div(clamp(chances, 3, 10) - 3, 2) + (result === 1 ? 1 : 0) + 1);
  let mood = 1;
  if (result === 1 || (result === 0 && r.oppStrength > r.ownStrength) || (result === 0 && r.attendance === 0 && r.ownStrength + 10 < r.oppStrength)) mood = 2;
  let momentum = 2;
  if (sum > 0 || (sum === 0 && rng(0, 1) !== 0)) momentum = 1;
  const flags: Flags = { place: r.attendance !== 0 ? 1 : 2, klasse, result: result + 1, mood, momentum };
  const ctx: Ctx = { r, flags, rng };

  // Artikelkandidaten in Originalreihenfolge (4238:2E7E)
  const articles: number[] = [];
  const art = (g: number) => articles.push(groupBase(ARTICLE_GROUPS, g) + rng(0, ARTICLE_GROUPS[g] - 1));
  art(0);
  art(r.attendance !== 0 ? 1 : 2);
  if (rng(0, 1) !== 0 && r.cards > 2) art(3);
  if (rng(0, 1) !== 0 && r.cards === 0) art(4);
  if (r.best && result === 1) art(10);
  if (r.worst && result === 2) art(11);
  art(5);
  if (lateDecisive) art(18);
  if (ownMisses > 3 && diff < 2) art(12);
  if (earlyChance) art(16);
  if (earlyGoal) art(17);
  if (ownMisses < 2 && result === 1) art(13);
  if (result === 2) art(19);
  if (result === 1) art(7);

  // Schlagzeile: Gruppen der Reihe nach mit Priorität
  let head = 0;
  const taken = { v: 0 };
  let g = 0;
  const abs = Math.abs(sum);
  const group = (cond: boolean, prio: number) => {
    if (cond) head = pick(rng, prio, head, taken, groupBase(HEADLINE_GROUPS, g), groupBase(HEADLINE_GROUPS, g) + HEADLINE_GROUPS[g] - 1);
    g++;
  };
  group(diff > 3, 5);
  group(diff > 0 && diff < 2, 5);
  group(diff > 0 && diff < 4, 5);
  group(diff < -3, 5);
  group(diff < 0 && diff > -2, 5);
  group(diff < 0 && diff > -4, 5);
  group(diff === 0, 2);
  if (r.soldOut) {
    art(6);
    group(true, 3);
  } else g++;
  if (r.deficit !== 0 && result !== 2) art(14);
  if (r.lead !== 0 && result !== 1 && diff > -2) art(15);
  group(r.deficit !== 0 && result === 1, 5);
  group(r.lead !== 0 && result === 2, 5);
  group(r.deficit < -1 && result === 0, 4);
  group(r.lead > 1 && result === 0, 4);
  group(r.best !== "" && result === 1, 4);
  group(chances > 7 && abs < 3, 3);
  group(chances < 4 && abs < 3, 3);
  group(r.worst !== "" && result === 2, 4);
  group(momentum === 1 && result === 2, 4);
  group(momentum === 2 && result === 1, 4);
  if (momentum === 1 && result === 1) {
    group(true, 3);
    art(8);
  } else g++;
  if (momentum === 2 && result === 2) {
    group(true, 3);
    art(9);
  } else g++;
  group(abs < 2 && result === 0, 4);
  group(momentum === 2 && result === 0, 3);
  group(momentum === 1 && result === 0, 3);

  const headline = expandTemplate(schlagzeilen()[head], ctx).split("\n");
  const sentences = articles.map((i) => expandTemplate(artikel()[i], ctx));
  return { headline, sentences, picture: r.picture, lineup: r.lineup, goals: r.goals, yellow: r.yellow, red: r.red };
}

export interface ReportSource {
  home: number;
  away: number;
  result: { home: number; away: number; events: MatchEvent[] };
  scorers: { minute: number; side: "home" | "away"; name: string }[];
  attendance?: number;
  /** Karten der Managervereine: Namen der Spieler mit gelber bzw. roter Karte */
  yellowNames?: string[];
  redNames?: string[];
  cards?: number;
  /**
   * Spielbewertung (Kaderbyte 21) je Spielernummer, am Ende des Spiels festgehalten. Ohne sie
   * stünde hier nur noch die Null, die `afterMatch` hinterlässt - dann hätten alle dieselbe
   * Note und es gäbe nie einen besten oder schwächsten Mann (GitLab #70).
   */
  bewertungen?: Map<number, number>;
}

/** Spielbericht eines Managers aus einem gespielten Spiel aufbauen (0x305DE je Ereignis). */
export function reportFromMatch(g: GameState, manager: number, m: ReportSource, rng: Rng): MatchReport {
  const mg = g.managers.at(manager);
  const own = mg.clubIndex;
  const home = m.home === own;
  const opp = home ? m.away : m.home;
  const ownSide = home ? "home" : "away";
  const events = m.result.events.map((e) => ({ minute: e.minute, own: e.side === ownSide, goal: e.goal }));
  let og = 0;
  let pg = 0;
  let deficit = 0;
  let lead = 0;
  let deficitScore: [number, number] = [0, 0];
  let leadScore: [number, number] = [0, 0];
  for (const e of events) {
    if (!e.goal) continue;
    if (e.own) og++;
    else pg++;
    const d = og - pg;
    if (d < deficit) {
      deficit = d;
      deficitScore = [og, pg];
    }
    if (d > lead) {
      lead = d;
      leadScore = [og, pg];
    }
  }
  // Bester/schwächster Feldspieler nach der Bewertung (Byte 21) der Kaderplätze
  let best = "";
  let worst = "";
  for (const l of g.squadOf(manager)) {
    if (l.isEmpty) continue;
    const p = g.players.at(l.playerIndex);
    if (p.u8(31) === 0) continue;
    const rating = m.bewertungen?.get(l.playerIndex) ?? (l.u8(21) << 24) >> 24;
    if (rating > 25) best = p.name;
    if (rating < -15 && worst === "") worst = p.name;
  }
  const str = (club: number): number => {
    const t: TeamStrength = matrixFor(g, club, rng);
    return div((strength(t, 0, 0) + strength(t, 1, 0) + strength(t, 2, 0)) * 2, 15);
  };
  const attendance = home ? (m.attendance ?? 0) : 0;
  const starters = g.squadOf(manager).filter((l) => !l.isEmpty && l.u8(10) >= 1 && l.u8(10) <= 11).sort((a, b) => a.u8(10) - b.u8(10));
  // Reihenfolge wie im Original: erst das Foto (0x2F3D3), dann die Noten (0x2F63C)
  const picture = rng(0, 29);
  const noten = spielnoten(g, manager, rng, m.bewertungen);
  // Im Original steht zwischen Name und Rückennummer ein Leerzeichen, und hinter dem Verein
  // nur eines: der Blocksatz der Zeitung füllt die Lücken hinter den Kommas selbst auf (#56)
  const lineup = g.clubs.at(own).name + ": " + starters.map((l) => `${g.players.at(l.playerIndex).name} (${noten.get(l.playerIndex) ?? 6})`).join(", ");
  let hg = 0;
  let ag = 0;
  const goalTexts: string[] = [];
  for (const e of m.result.events) {
    if (!e.goal) continue;
    if (e.side === "home") hg++;
    else ag++;
    const sc = m.scorers.find((s) => s.minute === e.minute && s.side === e.side && s.side === ownSide);
    goalTexts.push(`${hg}:${ag}${sc ? " " + sc.name : ""} (${e.minute}.MIN)`);
  }
  return {
    manager,
    own,
    opp,
    ownName: g.clubs.at(own).name,
    oppName: g.clubs.at(opp).name,
    managerName: mg.name,
    home,
    ownGoals: home ? m.result.home : m.result.away,
    oppGoals: home ? m.result.away : m.result.home,
    deficitScore,
    leadScore,
    deficit,
    lead,
    events,
    attendance,
    soldOut: attendance > 0 && attendance >= TOTAL_CAPACITY,
    cards: m.cards ?? (m.yellowNames?.length ?? 0) + (m.redNames?.length ?? 0),
    best,
    worst,
    ownStrength: str(own),
    oppStrength: str(opp),
    picture,
    lineup,
    goals: goalTexts.length ? "TORE: " + goalTexts.join(", ") : "TORE: FEHLANZEIGE",
    yellow: T("quell.zeitung", 0) + (m.yellowNames?.length ? m.yellowNames.join(", ") : "KEINE"),
    red: T("quell.zeitung", 1) + (m.redNames?.length ? m.redNames.join(", ") : "KEINE"),
  };
}
