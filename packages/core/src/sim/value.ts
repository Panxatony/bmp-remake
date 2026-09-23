/**
 * Marktwert eines Kaderplatzes (0x24D4E). variant 0 = Ablösewert in DM, variant 1 =
 * Gehaltsbasis (Koeffizienten DGROUP 0x543E). Flags: Bit 0 Variante, Bit 1 Leihe (/3 und
 * ·random(75,95)/100), Bit 2 Transfermarktpreis (Zufallsaufschlag mit 16-Bit-Überlauf des
 * Originals). Siehe docs/SPIELMECHANIK.md, "Marktwert".
 */
import type { GameState } from "../records.ts";
import { is2026 } from "./regeln.ts";

const COEF = [
  [58, 4, 4, 5, 4, 25],
  [70, 8, 7, 5, 8, 2],
];
const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const int16 = (v: number): number => ((v & 0xffff) << 16) >> 16;

type Rng = (lo: number, hi: number) => number;

/**
 * random(lo, hi) des Originals mit 16-Bit-Argumenten: lo + rand % (hi - lo + 1). Bei
 * Marktpreisen über 327.670 DM läuft hi = v/10 über und das Ergebnis wird oft negativ.
 */
function random16(rng: Rng, lo: number, hi: number): number {
  const l = int16(lo);
  const n = int16(int16(hi) - l + 1);
  if (n === 0) return l;
  return int16(l + rng(0, Math.abs(n) - 1));
}

/** Marktwert des Kaderplatzes `manager*25 + place` (Transfermarkt: manager 4, place 0..11). */
export function playerValue(g: GameState, manager: number, place: number, flags = 0, rng?: Rng): number {
  const l = g.lineups.at(manager * 25 + place);
  return wertAusDatensatz(g, (o) => l.u8(o), flags, rng);
}

/** Datensatz eines Kaderplatzes (52 Bytes), gelesen über eine Funktion. */
export interface RohDatensatz {
  (offset: number): number;
}

/**
 * Marktwert auf einem beliebigen 52-Byte-Datensatz (0x24D4E). Das Original rechnet manchmal auf
 * Speicher, der gar kein Kaderplatz ist (Spielerpool, #99); der Spieler kommt aus Byte 15.
 */
export function wertAusDatensatz(g: GameState, byte: RohDatensatz, flags = 0, rng?: Rng): number {
  const l = { u8: byte };
  const idx = byte(15);
  const p = { u8: (o: number) => (idx <= 150 ? g.players.at(idx).u8(o) : 0) };
  const K = COEF[flags & 1];
  const u16 = (o: number) => l.u8(o) | (l.u8(o + 1) << 8);
  const s = Math.trunc((l.u8(16) + l.u8(17)) / 2);
  let v = div(s * K[0], 100);
  const gl = clamp(div((l.u8(3) + l.u8(4)) * 30 + 40 * l.u8(5), 100), 0, 20);
  const m = clamp(div(20 * u16(30) + 30 * u16(32) + 50 * u16(28), 100), 0, 200);
  v += div(K[1] * gl * 5, 100);
  v += div(div(m * 100, 200) * K[2], 100);
  v += div(K[3] * l.u8(14), 100);
  const z = clamp(6 * l.u8(0) + l.u8(1), 0, 20);
  v += div(K[4] * z * 5, 100);
  const a = clamp(45 - p.u8(26), 0, 27);
  v += div(div(a * 100, 27) * K[5], 100);
  const variant = flags & 1;
  if (variant === 1) {
    v = div(v * v * v, 1000);
    let t = l.u8(16) + l.u8(17);
    if (t > 100) t = 100 + div(t - 100, 2);
    if (t > 135) v = div(v * (t - 35), 100);
    if (v < 2) v = 2;
    v *= 85;
  } else {
    v *= 10000;
    if (v > 110000) v -= 100000;
  }
  if (flags & 2) v = div(v, 3);
  if (l.u8(9) & 0x80) {
    if (l.u8(22) > 63) v = div(v * 130, 100);
    else v = div(v * (rng ? rng(95, 100) : 97), 100);
  }
  v = div(v * 5, 3);
  if (flags & 4 && variant === 0) {
    // Zufallsaufschlag des Transfermarkts. Das Original rechnet ihn in 16 Bit und liefert über
    // 327.670 DM Unsinn (oft negative Preise); die Version 2026 rechnet ihn sauber aus
    // (sim/regeln.ts).
    const r = rng ? (is2026(g) ? rng(div(v, 20), div(v, 10)) : random16(rng, div(v, 20), div(v, 10))) : div(v, 15);
    v += r - div(v, 15);
  }
  if (flags & 2 && variant === 0) v = div(v * (rng ? rng(75, 95) : 85), 100);
  const unit = variant === 1 ? 100 : 1000;
  return div(v, unit) * unit;
}
