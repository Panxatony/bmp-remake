/**
 * Medizinische Versorgung (nur Version 2026, sim/regeln.ts; GitLab #2).
 *
 * Im Original liegt ein verletzter Spieler genau so lange flach, wie die Verletzung dauert -
 * der Manager kann nichts tun als warten. In der Version 2026 wählt er je verletztem Spieler
 * eine Behandlungsstufe. Das Geld bestimmt, wie wahrscheinlich die Behandlung in einer Woche
 * anschlägt und wie kräftig sie wirkt - beides bewusst zurückhaltend: eine Verletzung soll eine
 * Herausforderung bleiben und sich nicht wegkaufen lassen.
 *
 * Die Verkürzung ist ein **Anteil der Restdauer**, keine feste Woche: dieselbe Behandlung
 * wirkt damit beim Leistenbruch (20 Wochen) in Wochen gerechnet stark und bei der Platzwunde
 * (1 Woche) kaum. Zwei Regeln halten das im Rahmen: mindestens eine Woche, wenn sie anschlägt,
 * und die Genesung sinkt nie unter die Untergrenze der Verletzungsart (die Hälfte der
 * Grunddauer über zehn Wochen, sonst zwei Drittel) - auch der
 * beste Arzt macht aus dem Kreuzbandriß keine Zerrung.
 *
 * Ohne Behandlung (Stufe 0) kann es umgekehrt eine Woche länger dauern.
 *
 * Gespeichert wird die Stufe in den oberen beiden Bits von Lineup-Byte 23, das die Art der
 * Verletzung hält (0..17, also fünf Bits). Ein Spielstand des Originals liest sich damit
 * unverändert: Stufe 0.
 */
import type { GameState, Lineup } from "../records.ts";
import type { Rng } from "./match.ts";
import { INJURY_WEEKS } from "./training.ts";
import { addBalance } from "./transfer.ts";
import { is2026 } from "./regeln.ts";
import { isDopeBanned } from "./doping.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/**
 * Die vier Stufen. `chance` ist die Wahrscheinlichkeit in Prozent, dass die Behandlung in einer
 * Woche anschlägt, `min`/`max` der Anteil der Restdauer, der dann wegfällt.
 */
export const MED_LEVELS: { name: string; cost: number; chance: number; min: number; max: number }[] = [
  { name: "VEREINSARZT", cost: 0, chance: 0, min: 0, max: 0 },
  { name: "FACHARZT", cost: 20_000, chance: 8, min: 10, max: 18 },
  { name: "SPEZIALKLINIK", cost: 60_000, chance: 15, min: 15, max: 25 },
  { name: "SPORTKLINIK AM SEE", cost: 150_000, chance: 25, min: 20, max: 33 },
];

/** Ohne Behandlung dauert es mit dieser Wahrscheinlichkeit (Prozent) eine Woche länger. */
export const MED_SETBACK = 5;

/** Art der Verletzung (untere fünf Bits von Byte 23). */
export function injuryKind(l: Lineup): number {
  return l.u8(23) & 0x1f;
}

/** Gewählte Behandlungsstufe (obere zwei Bits von Byte 23). */
export function medLevel(l: Lineup): number {
  return (l.u8(23) >> 6) & 3;
}

/** Behandlungsstufe setzen, ohne die Art der Verletzung anzutasten. */
export function setMedLevel(l: Lineup, level: number): void {
  const v = Math.max(0, Math.min(MED_LEVELS.length - 1, Math.trunc(level)));
  l.setU8(23, (l.u8(23) & 0x3f) | (v << 6));
}

/** Ist der Kaderplatz verletzt (Flag-Bit 1 und Restwochen)? */
export function isInjured(l: Lineup): boolean {
  return (l.u8(9) & 2) === 2 && l.u8(13) > 0;
}

/**
 * Behandeln lässt sich nur eine Verletzung. Eine Dopingsperre (#3) benutzt dieselbe Mechanik,
 * gehört aber keinem Arzt: sie taucht hier nicht auf und lässt sich nicht verkürzen.
 */
function behandelbar(l: Lineup): boolean {
  return isInjured(l) && !isDopeBanned(l);
}

/** Ab dieser Grunddauer gilt die mildere Untergrenze (lhunos Vorgabe vom 17.9.2026). */
export const MED_LONG = 10;

/**
 * Untergrenze der Genesung, gerechnet auf die Grunddauer der Verletzungsart:
 *
 * - **über zehn Wochen** (Kreuzbandriß, Leistenbruch und die anderen schweren Fälle) reicht die
 *   Behandlung bis zur **Hälfte** - bei einer langen Verletzung lohnt sich der Arzt also
 *   wirklich;
 * - **bis zehn Wochen** bleibt es bei **zwei Dritteln**, also höchstens einem Drittel Gewinn.
 *
 * So bleibt eine Verletzung eine Herausforderung, gerade für kleine Kader, ohne dass ein halbes
 * Jahr Ausfall ohne jede Aussicht dasteht.
 */
export function injuryFloor(kind: number): number {
  const wochen = INJURY_WEEKS[kind] ?? 1;
  return Math.max(1, Math.ceil(wochen > MED_LONG ? wochen / 2 : (2 * wochen) / 3));
}

export interface MedEvent {
  manager: number;
  place: number;
  playerIndex: number;
  /** verkuerzt: Behandlung hat angeschlagen; laenger: Rückschlag ohne Behandlung;
   *  klamm: Konto reicht nicht, Stufe fällt auf 0; geheilt: der Spieler ist sofort wieder fit */
  kind: "verkuerzt" | "laenger" | "klamm" | "geheilt";
  level: number;
  /** gewonnene (oder verlorene) Wochen */
  weeks?: number;
  /** gebuchte Kosten der Woche */
  cost?: number;
  /** Restwochen danach */
  left: number;
}

/**
 * Eine Behandlungswoche für alle verletzten Spieler eines Managers. Der Tageslauf ruft sie an
 * denselben Tagen, an denen die Verletzung herunterzählt (Saisontag durch 7 teilbar), und zwar
 * **nach** dem Training: die reguläre Woche ist dann schon abgezogen.
 *
 * Gebucht wird nur, wenn die Behandlung überhaupt noch etwas ausrichten kann - steht die
 * Restdauer schon auf der Untergrenze, kostet die Woche nichts.
 */
export function medWeek(g: GameState, manager: number, rng: Rng): MedEvent[] {
  const out: MedEvent[] = [];
  if (!is2026(g)) return out;
  g.squadOf(manager).forEach((l, place) => {
    if (!behandelbar(l)) return;
    const stufe = medLevel(l);
    const rest = l.u8(13);
    const grenze = injuryFloor(injuryKind(l));
    const fertig = (ev: MedEvent) => {
      // Ist die Verletzung abgelaufen, wird das Flag gelöscht wie im wöchentlichen Zähler
      if (l.u8(13) === 0) {
        l.setU8(9, l.u8(9) & 0xfc);
        setMedLevel(l, 0);
        out.push({ ...ev, kind: "geheilt", left: 0 });
      } else out.push(ev);
    };
    if (stufe === 0) {
      // Ohne Behandlung kann es länger dauern
      if (rng(1, 100) <= MED_SETBACK) {
        l.setU8(13, Math.min(255, rest + 1));
        out.push({ manager, place, playerIndex: l.playerIndex, kind: "laenger", level: 0, weeks: 1, left: l.u8(13) });
      }
      return;
    }
    if (rest <= grenze) return; // mehr ist nicht herauszuholen, also kostet die Woche auch nichts
    const s = MED_LEVELS[stufe];
    if (g.managers.at(manager).balance < s.cost) {
      setMedLevel(l, 0);
      out.push({ manager, place, playerIndex: l.playerIndex, kind: "klamm", level: stufe, cost: s.cost, left: rest });
      return;
    }
    addBalance(g, manager, -s.cost);
    if (rng(1, 100) > s.chance) return;
    const anteil = rng(s.min, s.max);
    let weg = Math.max(1, div(rest * anteil, 100));
    if (rest - weg < grenze) weg = rest - grenze;
    if (weg <= 0) return;
    l.setU8(13, rest - weg);
    fertig({ manager, place, playerIndex: l.playerIndex, kind: "verkuerzt", level: stufe, weeks: weg, cost: s.cost, left: l.u8(13) });
  });
  return out;
}

/** Alle verletzten Spieler eines Managers für den Bildschirm "Medizin". */
export function medRows(g: GameState, manager: number): { place: number; playerIndex: number; name: string; kind: number; weeks: number; level: number; cost: number; floor: number }[] {
  const out: ReturnType<typeof medRows> = [];
  g.squadOf(manager).forEach((l, place) => {
    if (!behandelbar(l)) return;
    const kind = injuryKind(l);
    out.push({
      place,
      playerIndex: l.playerIndex,
      name: g.players.at(l.playerIndex).displayName,
      kind,
      weeks: l.u8(13),
      level: medLevel(l),
      cost: MED_LEVELS[medLevel(l)].cost,
      floor: injuryFloor(kind),
    });
  });
  return out;
}

/** Wochenkosten aller laufenden Behandlungen eines Managers. */
export function medCost(g: GameState, manager: number): number {
  return medRows(g, manager).reduce((s, r) => s + (r.weeks > r.floor ? r.cost : 0), 0);
}

/** Stufe setzen (Server): prüft Regelwerk, Verletzung und Stufe. */
export function medSet(g: GameState, manager: number, place: number, level: number): { ok: boolean; error?: string } {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  const l = g.lineups.at(manager * 25 + place);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  if (!behandelbar(l)) return { ok: false, error: "Nicht verletzt" };
  if (!Number.isInteger(level) || level < 0 || level >= MED_LEVELS.length) return { ok: false, error: "Diese Stufe gibt es nicht" };
  setMedLevel(l, level);
  return { ok: true };
}
