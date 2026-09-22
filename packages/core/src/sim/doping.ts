/**
 * Doping (nur Version 2026, sim/regeln.ts; GitLab #3).
 *
 * Der schmutzige Gegenpol zur medizinischen Versorgung (#2): ein gedopter Spieler wird deutlich
 * stärker, als Training je erreichen würde - aber nach jedem Einsatz kann er auffliegen, und
 * dann ist er ein halbes Jahr weg und der Verein zahlt.
 *
 * **Speicherung.** Die Sperre des Originals zählt in Spielen (Lineup-Byte 13 mit Flag-Bit 0),
 * die Verletzung in Wochen (dasselbe Byte, Flag-Bit 1). Eine Dopingsperre zählt wie eine
 * Verletzung in Wochen und macht den Spieler genauso unverfügbar - sie benutzt deshalb dieselbe
 * Mechanik (Flag-Bit 1 und Byte 13). Dass es Doping ist und keine Verletzung, steht in zwei
 * eigenen Bytes des Kaderplatzes:
 *
 *     Byte 44: Bit 0..1 Zustand (0 nichts, 1 Kur, 2 Dopingsperre), Bit 2..5 Einsätze unter Doping
 *     Byte 45: Bit 0..3 gewährter Aufschlag auf Kondition/Technik/Form,
 *              Bit 4..7 gewährter Aufschlag auf die Frische, in Zweierschritten
 *
 * Beide Bytes sind in allen vorliegenden Spielständen des Originals über alle 1927 belegten
 * Kaderplätze 0, und kein Befehl des Originals greift auf Kaderoffset 44..47 zu. Ein Stand des
 * Originals liest sich damit als "niemand gedopt", und die Angaben wandern beim Transfer mit
 * dem Spieler mit - eine Sperre nimmt er also zum neuen Verein mit.
 *
 * Bis September 2026 lagen die Angaben in Byte 5 und 8. Die sind im Original aber nicht frei:
 * Byte 5 zählt die Europapokaltore der Saison (0x1BA9C), Byte 8 die Europapokaleinsätze
 * (0x1CC11) - beides war nur in keinem Spielstand zu sehen, weil dort kein Managerverein im
 * Europapokal spielte. `migriereDopingBytes` zieht alte Stände einmalig um (GitLab #88).
 *
 * Der Aufschlag wird so bemessen, dass er nirgends an die Obergrenze stößt (99 bzw. 150).
 * Dadurch lässt er sich später auf den Punkt genau wieder abziehen, ohne dass die Werte vorher
 * irgendwo gemerkt werden müssten.
 */
import type { GameState, Lineup } from "../records.ts";
import type { Rng } from "./match.ts";
import { addBalance } from "./transfer.ts";
import { is2026 } from "./regeln.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/** Höchster Aufschlag auf Kondition, Technik und Form; die Obergrenze der Skala ist 99. */
export const DOPING_BONUS = 12;
/** Höchster Aufschlag auf die Frische (Obergrenze 150), in Zweierschritten gewährt. */
export const DOPING_FRESH = 20;
/** Risiko beim ersten Einsatz in Prozent, danach je Einsatz mehr, höchstens 95. */
export const DOPING_RISK = 20;
export const DOPING_RISK_STEP = 15;
export const DOPING_RISK_MAX = 95;
/** Sperre in Wochen (drei bis sechs Monate). */
export const DOPING_BAN = [12, 24] as const;
/** Geldstrafe: fester Sockel plus Anteil am Vermögen. */
export const DOPING_FINE_BASE = 50_000;
export const DOPING_FINE_PERCENT = 5;
/** Höchstzahl gleichzeitig laufender Kuren je Manager. */
export const DOPING_MAX_CURES = 3;
/** Malus auf die Form beim Auffliegen. */
export const DOPING_MALUS = 10;
/** Höchstzahl gezählter Einsätze unter Doping (vier Bits). */
export const DOPING_APPS_MAX = 15;

export const DOPE_NONE = 0;
export const DOPE_ON = 1;
export const DOPE_BANNED = 2;
/** Kaderbyte für Zustand und Einsätze unter Doping */
export const DOPING_ZUSTAND = 44;
/** Kaderbyte für die gewährten Aufschläge */
export const DOPING_AUFSCHLAG = 45;

/**
 * Einmaliger Umzug der Dopingangaben aus den alten Bytes 5/8 nach 44/45 (GitLab #88), für
 * Stände der Version 2026 von vor dem Umzug. Nicht beim Laden aufrufen: danach stehen in
 * Byte 5/8 Europapokaltore und -einsätze, die dürfen nicht als Doping gelesen werden.
 * Liefert die Zahl der umgezogenen Kaderplätze.
 */
export function migriereDopingBytes(g: GameState): number {
  let n = 0;
  for (let i = 0; i < 125; i++) {
    const l = g.lineups.at(i);
    if (l.isEmpty || l.u8(DOPING_ZUSTAND) !== 0 || l.u8(DOPING_AUFSCHLAG) !== 0) continue;
    if (l.u8(5) === 0 && l.u8(8) === 0) continue;
    l.setU8(DOPING_ZUSTAND, l.u8(5));
    l.setU8(DOPING_AUFSCHLAG, l.u8(8));
    l.setU8(5, 0);
    l.setU8(8, 0);
    n++;
  }
  return n;
}

/** Zustand: 0 nichts, 1 Kur, 2 Dopingsperre. */
export function dopeState(l: Lineup): number {
  return l.u8(DOPING_ZUSTAND) & 3;
}

/** Einsätze unter Doping. */
export function dopeApps(l: Lineup): number {
  return (l.u8(DOPING_ZUSTAND) >> 2) & 0xf;
}

function setState(l: Lineup, state: number, apps: number): void {
  l.setU8(DOPING_ZUSTAND, (state & 3) | ((Math.min(DOPING_APPS_MAX, apps) & 0xf) << 2));
}

/** Gewährter Aufschlag auf Kondition, Technik und Form. */
export function dopeBonus(l: Lineup): number {
  return l.u8(DOPING_AUFSCHLAG) & 0xf;
}

/** Gewährter Aufschlag auf die Frische. */
export function dopeFresh(l: Lineup): number {
  return ((l.u8(DOPING_AUFSCHLAG) >> 4) & 0xf) * 2;
}

function setBonus(l: Lineup, bonus: number, fresh: number): void {
  l.setU8(DOPING_AUFSCHLAG, (bonus & 0xf) | ((div(fresh, 2) & 0xf) << 4));
}

export const isDoped = (l: Lineup): boolean => dopeState(l) === DOPE_ON;
export const isDopeBanned = (l: Lineup): boolean => dopeState(l) === DOPE_BANNED;

/** Risiko des nächsten Einsatzes in Prozent. */
export function dopingRisk(apps: number): number {
  return Math.min(DOPING_RISK_MAX, DOPING_RISK + DOPING_RISK_STEP * Math.max(0, apps));
}

/**
 * Geldstrafe: 50.000 DM plus 5 % des Vermögens. Gezählt wird nur ein positiver Kontostand -
 * ein Minus soll die Strafe nicht kleiner machen. Die Liga wirkt damit über das Vermögen und
 * braucht keinen eigenen Faktor mehr (Regel von lhuno, GitLab #48).
 */
export function dopingFine(balance: number): number {
  return DOPING_FINE_BASE + div(Math.max(0, balance) * DOPING_FINE_PERCENT, 100);
}

/** Wie viele Kuren laufen gerade? */
export function dopeCures(g: GameState, manager: number): number {
  return g.squadOf(manager).filter((l) => isDoped(l)).length;
}

/**
 * Kur beginnen. Der Aufschlag wird so bemessen, dass kein Wert an die Obergrenze stößt - dann
 * lässt er sich später genau zurücknehmen.
 */
export function dopeStart(g: GameState, manager: number, place: number): { ok: boolean; error?: string } {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  const l = g.lineups.at(manager * 25 + place);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  if ((l.u8(9) & 3) !== 0) return { ok: false, error: "Gesperrte und verletzte Spieler nicht" };
  if (dopeState(l) !== DOPE_NONE) return { ok: false, error: "Kur l\u00e4uft schon" };
  if (dopeCures(g, manager) >= DOPING_MAX_CURES) return { ok: false, error: `H\u00f6chstens ${DOPING_MAX_CURES} Kuren gleichzeitig` };
  const hoch = Math.max(l.u8(16), l.u8(17), l.u8(18));
  const bonus = Math.max(0, Math.min(DOPING_BONUS, 99 - hoch));
  const fresh = Math.max(0, Math.min(DOPING_FRESH, 150 - l.u8(19)));
  for (const b of [16, 17, 18]) l.setU8(b, l.u8(b) + bonus);
  l.setU8(19, l.u8(19) + div(fresh, 2) * 2);
  setBonus(l, bonus, fresh);
  setState(l, DOPE_ON, 0);
  return { ok: true };
}

/** Aufschlag zurücknehmen und die Kur beenden. */
function abziehen(l: Lineup): void {
  const bonus = dopeBonus(l);
  const fresh = dopeFresh(l);
  for (const b of [16, 17, 18]) l.setU8(b, Math.max(0, l.u8(b) - bonus));
  l.setU8(19, Math.max(0, l.u8(19) - fresh));
  setBonus(l, 0, 0);
}

/** Kur beenden: die Werte fallen auf den Stand ohne Doping zurück. */
export function dopeStop(g: GameState, manager: number, place: number): { ok: boolean; error?: string } {
  if (!is2026(g)) return { ok: false, error: "Nur in der Version 2026" };
  const l = g.lineups.at(manager * 25 + place);
  if (!isDoped(l)) return { ok: false, error: "Keine Kur im Gange" };
  abziehen(l);
  setState(l, DOPE_NONE, 0);
  return { ok: true };
}

export interface DopingEvent {
  manager: number;
  place: number;
  playerIndex: number;
  kind: "erwischt";
  /** Sperre in Wochen */
  weeks: number;
  /** Geldstrafe in DM */
  fine: number;
  /** Einsätze unter Doping, den letzten mitgezählt */
  apps: number;
}

/**
 * Prüfung nach einem Spieltag: für jeden gedopten Spieler, der eingesetzt war, steigt der Zähler
 * und es wird gewürfelt. Wer auffliegt, ist 13 bis 39 Wochen gesperrt, die Werte fallen zurück,
 * die Form bekommt einen Malus, und der Verein zahlt 200.000 bis 500.000 DM mal Ligafaktor.
 *
 * `gespielt` sagt je Kaderplatz, ob der Spieler an diesem Spieltag zum Einsatz kam.
 */
export function dopeMatchday(g: GameState, manager: number, gespielt: (place: number) => boolean, rng: Rng): DopingEvent[] {
  const out: DopingEvent[] = [];
  if (!is2026(g)) return out;
  g.squadOf(manager).forEach((l, place) => {
    if (!isDoped(l) || !gespielt(place)) return;
    const apps = dopeApps(l);
    setState(l, DOPE_ON, apps + 1);
    if (rng(1, 100) > dopingRisk(apps)) return;
    abziehen(l);
    l.setU8(18, Math.max(1, l.u8(18) - DOPING_MALUS));
    const weeks = rng(DOPING_BAN[0], DOPING_BAN[1]);
    l.setU8(13, weeks);
    l.setU8(9, l.u8(9) | 2);
    l.setU8(23, 0);
    l.setU8(10, 0);
    setState(l, DOPE_BANNED, 0);
    const fine = dopingFine(g.managers.at(manager).balance);
    addBalance(g, manager, -fine);
    out.push({ manager, place, playerIndex: l.playerIndex, kind: "erwischt", weeks, fine, apps: apps + 1 });
  });
  return out;
}

/**
 * Abgelaufene Dopingsperren aufräumen: den Wochenzähler und das Flag räumt das Spiel selbst ab
 * (sim/training.ts), hier fällt nur das Kennzeichen weg.
 */
export function dopingCleanup(g: GameState): void {
  for (let i = 0; i < 100; i++) {
    const l = g.lineups.at(i);
    if (!isDopeBanned(l)) continue;
    if (l.isEmpty || l.u8(13) === 0 || (l.u8(9) & 2) === 0) setState(l, DOPE_NONE, 0);
  }
}

/** Zeilen für den Arztbildschirm: alle Kaderspieler mit Kur oder Dopingsperre. */
export function dopingRows(g: GameState, manager: number): { place: number; playerIndex: number; name: string; state: "kur" | "gesperrt"; apps: number; risk: number; weeks: number; bonus: number }[] {
  const out: ReturnType<typeof dopingRows> = [];
  g.squadOf(manager).forEach((l, place) => {
    const st = dopeState(l);
    if (st === DOPE_NONE) return;
    out.push({
      place,
      playerIndex: l.playerIndex,
      name: g.players.at(l.playerIndex).displayName,
      state: st === DOPE_ON ? "kur" : "gesperrt",
      apps: dopeApps(l),
      risk: st === DOPE_ON ? dopingRisk(dopeApps(l)) : 0,
      weeks: st === DOPE_BANNED ? l.u8(13) : 0,
      bonus: dopeBonus(l),
    });
  });
  return out;
}
