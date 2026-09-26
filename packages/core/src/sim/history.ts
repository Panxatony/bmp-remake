/**
 * Historieblock (Spielstand 28435, 4238:9336, 5012 Bytes), fortgeschrieben nach jedem
 * Ligaspiel (0x2D182 ff., Rekorde 0x2DBDF) und gelesen vom Statistikbildschirm (0x26F88,
 * Rekordzeilen 0x2B31E) und der Zeitung (0x2AB35):
 *
 *   0..2559   Bilanz je Manager gegen jeden Verein: [(Manager·64 + Verein)·5 + k]·2 + Seite,
 *             Seite 0 = Heimspiele, 1 = Auswärtsspiele, k = 0..4 die letzten Spiele,
 *             Byte = Gegentore·16 + eigene Tore, 0xff = leer (0x2C483, Audit 2 G8)
 *   2560      Serien je Verein (21 Bytes): 7 Zeilen (gewonnen, verloren, unentschieden,
 *             nicht gewonnen, nicht verloren, ohne Gegentor, ohne Torerfolg) × 3 Spalten
 *             (gesamt, heim, auswärts), laufende Serie
 *   3904      Serienrekorde je Manager (21 Bytes, Höchstwerte)
 *   3988      Rekorde je Verein (8 Bytes): höchster Heimsieg, höchste Heimniederlage,
 *             erzielte/kassierte Heimtore, dasselbe auswärts; Byte = Heimtore·16 + Gasttore
 *             (die Torrekorde k = 2/7 im oberen, k = 3/6 im unteren Halbbyte)
 *   4500      Gegner der Rekorde je Verein (8 Bytes)
 */
import type { GameState } from "../records.ts";
import { texte } from "../data/texte.ts";

export const HISTORY = 28435;
const SERIES = 2560;
const SERIES_RECORD = 3904;
const RECORDS = 3988;
const RECORD_OPP = 4500;
export const seriesRows = (): string[] => texte("verlauf.serien");
export const recordRows = (): string[] => texte("verlauf.rekorde");

const seriesAt = (club: number) => HISTORY + SERIES + 21 * club;
const seriesRecordAt = (manager: number) => HISTORY + SERIES_RECORD + 21 * manager;

/** Laufende Serien eines Vereins: 7 Zeilen × [gesamt, heim, auswärts]. */
export function seriesCurrent(g: GameState, club: number): number[][] {
  const p = g.save.plain;
  const o = seriesAt(club);
  return Array.from({ length: 7 }, (_, r) => [p[o + 3 * r], p[o + 3 * r + 1], p[o + 3 * r + 2]]);
}

export function seriesRecord(g: GameState, manager: number): number[][] {
  const p = g.save.plain;
  const o = seriesRecordAt(manager);
  return Array.from({ length: 7 }, (_, r) => [p[o + 3 * r], p[o + 3 * r + 1], p[o + 3 * r + 2]]);
}

export interface ClubRecord {
  /** Anzeige: "7:0" bei Siegen/Niederlagen, sonst die Torzahl */
  text: string;
  opponent: number | null;
}

/** Rekorde eines Vereins (0x2B31E): Siege/Niederlagen als Ergebnis, Torzahlen als Zahl; leer = null. */
export function clubRecords(g: GameState, club: number): ClubRecord[] {
  const p = g.save.plain;
  const out: ClubRecord[] = [];
  for (let k = 0; k < 8; k++) {
    const b = p[HISTORY + RECORDS + 8 * club + k];
    if (b === 0) {
      out.push({ text: "", opponent: null });
      continue;
    }
    const hi = b >> 4;
    const lo = b & 15;
    let text: string;
    if (k === 0 || k === 1) text = `${hi}:${lo}`;
    else if (k === 4 || k === 5) text = `${lo}:${hi}`;
    else text = String(hi || lo);
    out.push({ text, opponent: p[HISTORY + RECORD_OPP + 8 * club + k] });
  }
  return out;
}

/** Die letzten fünf Ergebnisse eines Managers gegen einen Verein, je Heim und Auswärts (eigene Tore, Gegentore). */
export function resultsAgainst(g: GameState, manager: number, club: number): { home: [number, number][]; away: [number, number][] } {
  const p = g.save.plain;
  const home: [number, number][] = [];
  const away: [number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const o = HISTORY + ((manager << 6) + club) * 10 + 2 * k;
    if (p[o] !== 0xff) home.push([p[o] & 15, p[o] >> 4]);
    if (p[o + 1] !== 0xff) away.push([p[o + 1] & 15, p[o + 1] >> 4]);
  }
  return { home, away };
}

function bookSeries(g: GameState, club: number, cols: number[], gf: number, ga: number): void {
  const p = g.save.plain;
  const o = seriesAt(club);
  const set = (row: number, f: (v: number) => number) => {
    for (const c of cols) p[o + 3 * row + c] = f(p[o + 3 * row + c]) & 0xff;
  };
  const inc = (v: number) => v + 1;
  const zero = () => 0;
  if (gf > ga) {
    set(0, inc);
    set(1, zero);
    set(2, zero);
    set(3, zero);
    set(4, inc);
  } else if (gf < ga) {
    set(0, zero);
    set(1, inc);
    set(2, zero);
    set(3, inc);
    set(4, zero);
  } else {
    set(0, zero);
    set(1, zero);
    set(2, inc);
    set(3, inc);
    set(4, inc);
  }
  set(5, ga === 0 ? inc : zero);
  set(6, gf === 0 ? inc : zero);
}

/**
 * Vereinsrekord setzen (0x2DBDF) mit den Argumenten des Originals: Tore a (Heim) und b (Gast),
 * Modus, Faktoren p und q. Neuer Wert p·a - q·b, alter Wert hi·p - lo·q aus den Halbbytes;
 * Modus 0 schreibt nur, wenn der alte Wert **echt kleiner** ist (0x2DC61 `jge`), Modus 1 nur,
 * wenn der neue kleiner ist. Gespeichert wird (p·a)<<4 + |q|·b in 8 Bit (0x2DC70-0x2DC8E, ohne
 * Grenze auf 15). Die Torrekorde "kassiert heim" (k = 3) und "erzielt auswärts" (k = 6) laufen
 * mit p = 0, q = -1 und stehen daher im **unteren** Halbbyte - so in allen Spielständen des
 * Originals (#128, Audit 2 G1). Ein leerer Rekord zählt als 0: ein Spiel ohne Tore schreibt dort
 * weder das Byte noch den Gegner (#128, Audit 2 G2; bis dahin -1).
 */
function bookRecord(g: GameState, club: number, k: number, a: number, b: number, modus: 0 | 1, pf: number, q: number, opponent: number): void {
  const p = g.save.plain;
  const o = HISTORY + RECORDS + 8 * club + k;
  const hi = p[o] >> 4;
  const lo = p[o] & 15;
  const neu = pf * a - q * b;
  const alt = hi * pf - lo * q;
  if (modus === 0 ? alt >= neu : neu >= alt) return;
  if (q < 0) q = 1;
  p[o] = ((((pf * a) << 4) & 0xff) + ((q * b) & 0xff)) & 0xff;
  p[HISTORY + RECORD_OPP + 8 * club + k] = opponent & 0xff;
}

/**
 * Serienrekorde der Manager (0x2D812 bis 0x2D8B3): nach der Buchung einer Liga für **alle**
 * Manager, je Manager mit dem Verein aus Managerbyte 30 - jede laufende Serie über dem Rekord
 * wird Rekord. Die Bundesliga bucht zuerst; die Manager der anderen Ligen vergleichen dann mit
 * dem Stand ihres Vereins vor dessen eigenem Spiel. Bis #128 lief der Vergleich nur für die
 * Manager der beiden Vereine eines Spiels (Audit 2 G3).
 */
export function serienrekordeBuchen(g: GameState): void {
  const p = g.save.plain;
  g.activeManagers().forEach((m, i) => {
    const club = m.clubIndex;
    if (club > 57) return;
    const cur = seriesAt(club);
    const rec = seriesRecordAt(i);
    for (let k = 0; k < 21; k++) if (p[cur + k] > p[rec + k]) p[rec + k] = p[cur + k];
  });
}

/**
 * Historie nach einem Ligaspiel fortschreiben: Serien beider Vereine, Vereinsrekorde (nur bei
 * neuem Höchstwert) und die Bilanz der Manager gegen den Gegner (Heimspiel im geraden,
 * Auswärtsspiel im ungeraden Byte). Die Serienrekorde der Manager bucht `serienrekordeBuchen`
 * nach allen Spielen der Liga.
 */
export function bookHistory(g: GameState, home: number, away: number, hg: number, ag: number): void {
  const p = g.save.plain;
  if (home > 57 || away > 57) return;
  bookSeries(g, home, [0, 1], hg, ag);
  bookSeries(g, away, [0, 2], ag, hg);
  const managers = g.activeManagers();
  managers.forEach((m, i) => {
    const club = m.clubIndex;
    if (club !== home && club !== away) return;
    const opp = club === home ? away : home;
    const own = club === home ? hg : ag;
    const other = club === home ? ag : hg;
    const base = HISTORY + ((i << 6) + opp) * 10;
    // Heimspiel ins gerade, Auswärtsspiel ins ungerade Byte (KP-TEST4-TAG gegen TEST4, #100)
    const side = club === home ? 0 : 1;
    let k = 0;
    while (k < 5 && p[base + 2 * k + side] !== 0xff) k++;
    if (k === 5) {
      for (let j = 0; j < 4; j++) p[base + 2 * j + side] = p[base + 2 * (j + 1) + side];
      k = 4;
    }
    // Byte = Gegentore·16 + eigene Tore (21 gegen 27 zu Hause 4:0 -> 0x04, 31 bei 23 1:4 -> 0x41),
    // ohne Begrenzung als 8-Bit-Summe (0x2C549 bis 0x2C553): ab 16 Toren läuft es über
    p[base + 2 * k + side] = ((other << 4) + own) & 0xff;
  });
  // Reihenfolge und Argumente wie 0x2D256 bis 0x2D2D8 und 0x2D434/0x2D681 (Verein, k, a, b,
  // Modus, p, q, Gegner)
  bookRecord(g, home, 2, hg, ag, 0, 1, 0, away);
  bookRecord(g, away, 7, hg, ag, 0, 1, 0, home);
  bookRecord(g, home, 3, hg, ag, 0, 0, -1, away);
  bookRecord(g, away, 6, hg, ag, 0, 0, -1, home);
  if (hg > ag) {
    bookRecord(g, home, 0, hg, ag, 0, 1, 1, away);
    bookRecord(g, away, 5, hg, ag, 0, 1, 1, home);
  } else if (ag > hg) {
    bookRecord(g, home, 1, hg, ag, 1, 1, 1, away);
    bookRecord(g, away, 4, hg, ag, 1, 1, 1, home);
  }
}
