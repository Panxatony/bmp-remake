/**
 * Historieblock (Spielstand 28435, 4238:9336, 5012 Bytes), fortgeschrieben nach jedem
 * Ligaspiel (0x2D182 ff., Rekorde 0x2DBDF) und gelesen vom Statistikbildschirm (0x26F88,
 * Rekordzeilen 0x2B31E) und der Zeitung (0x2AB35):
 *
 *   0..2559   Bilanz je Manager gegen jeden Verein: [(Manager·64 + Verein)·5 + k]·2 + Seite,
 *             Seite 1 = Heimspiele, 0 = Auswärtsspiele, k = 0..4 die letzten Spiele,
 *             Byte = eigene Tore·16 + Gegentore, 0xff = leer
 *   2560      Serien je Verein (21 Bytes): 7 Zeilen (gewonnen, verloren, unentschieden,
 *             nicht gewonnen, nicht verloren, ohne Gegentor, ohne Torerfolg) × 3 Spalten
 *             (gesamt, heim, auswärts), laufende Serie
 *   3904      Serienrekorde je Manager (21 Bytes, Höchstwerte)
 *   3988      Rekorde je Verein (8 Bytes): höchster Heimsieg, höchste Heimniederlage,
 *             erzielte/kassierte Heimtore, dasselbe auswärts; Byte = Heimtore·16 + Gasttore
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

function bookRecord(g: GameState, club: number, k: number, value: number, stored: number, opponent: number): void {
  const p = g.save.plain;
  const o = HISTORY + RECORDS + 8 * club + k;
  const old = p[o];
  let oldValue: number;
  if (k === 0 || k === 4) oldValue = old === 0 ? -1 : Math.abs((old >> 4) - (old & 15));
  else if (k === 1 || k === 5) oldValue = old === 0 ? -1 : Math.abs((old >> 4) - (old & 15));
  else oldValue = old === 0 ? -1 : (old >> 4) || (old & 15);
  if (value <= oldValue) return;
  p[o] = stored & 0xff;
  p[HISTORY + RECORD_OPP + 8 * club + k] = opponent & 0xff;
}

/**
 * Historie nach einem Ligaspiel fortschreiben: Serien beider Vereine, Serienrekorde der
 * Manager, Vereinsrekorde (nur bei neuem Höchstwert, Tore auf 15 begrenzt) und die Bilanz
 * der Manager gegen den Gegner (Heimspiel im ungeraden, Auswärtsspiel im geraden Byte).
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
    const cur = seriesAt(club);
    const rec = seriesRecordAt(i);
    for (let k = 0; k < 21; k++) if (p[cur + k] > p[rec + k]) p[rec + k] = p[cur + k];
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
    // Byte = Gegentore·16 + eigene Tore (21 gegen 27 zu Hause 4:0 -> 0x04, 31 bei 23 1:4 -> 0x41)
    p[base + 2 * k + side] = ((Math.min(15, other) << 4) | Math.min(15, own)) & 0xff;
  });
  const h = Math.min(15, hg);
  const a = Math.min(15, ag);
  const stored = (h << 4) | a;
  if (hg > ag) {
    bookRecord(g, home, 0, hg - ag, stored, away);
    bookRecord(g, away, 5, hg - ag, stored, home);
  } else if (ag > hg) {
    bookRecord(g, home, 1, ag - hg, stored, away);
    bookRecord(g, away, 4, ag - hg, stored, home);
  }
  bookRecord(g, home, 2, h, h << 4, away);
  bookRecord(g, home, 3, a, a << 4, away);
  bookRecord(g, away, 6, a, a << 4, home);
  bookRecord(g, away, 7, h, h << 4, home);
}
