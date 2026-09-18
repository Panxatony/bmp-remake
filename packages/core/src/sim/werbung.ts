/**
 * Werbung: Sponsorenangebote (0x176F4 mit Stadionwert 0x175FA), Vertragsabschluss im
 * Werbebildschirm (0x291CD Trikot, 0x29242 Banden), monatlicher Ablauf (0x11E42) und
 * Saisonende nach einem Aufstieg (0x0CC00). Alle Tabellen liegen im Spielstand:
 *
 *   33462  4238:0000  je Manager 2 Bytes: Restmonate Trikotvertrag, Sponsor
 *   33470  4238:4B9A  je Manager 6 x 2 Bytes: Restmonate Bande, Sponsor
 *   33518  4238:2EC2  Laufzeit in Jahren (1..3) je [(Manager*2 + Seite)*10 + Sponsor]
 *   33598  4238:002E  Angebot in DM (i32) je [(Manager*2 + Seite)*10 + Sponsor], 0 = kein Angebot
 *   33918  4cb3:066C  je Manager 9 x i32: Trikot, 6 Banden, TV, Werbeausgaben
 *
 * Seite 0 = Trikot, Seite 1 = Banden. Siehe docs/SPIELMECHANIK.md, Abschnitt "Werbung".
 */
import type { GameState } from "../records.ts";
import { texte } from "../data/texte.ts";
import type { Rng } from "./match.ts";

export const SHIRT_OFFSET = 33462;
export const BOARDS_OFFSET = 33470;
export const CAT_OFFSET = 33518;
export const OFFERS_OFFSET = 33598;
export const ADV_OFFSET = 33918;
export const LEVEL_OFFSET = 34062;

const div = (a: number, b: number): number => Math.trunc(a / b);

function readI32(p: Uint8Array, o: number): number {
  return (p[o] | (p[o + 1] << 8) | (p[o + 2] << 16) | (p[o + 3] << 24)) | 0;
}

function writeI32(p: Uint8Array, o: number, v: number): void {
  for (let i = 0; i < 4; i++) p[o + i] = (v >>> (8 * i)) & 0xff;
}

export const offerIndex = (manager: number, page: number, sponsor: number): number => (manager * 2 + page) * 10 + sponsor;

export function offerAmount(g: GameState, manager: number, page: number, sponsor: number): number {
  return readI32(g.save.plain, OFFERS_OFFSET + 4 * offerIndex(manager, page, sponsor));
}

/** Laufzeit eines Angebots in Jahren (1..3). */
export function offerYears(g: GameState, manager: number, page: number, sponsor: number): number {
  return g.save.plain[CAT_OFFSET + offerIndex(manager, page, sponsor)];
}

export function advertisingAmount(g: GameState, manager: number, slot: number): number {
  return readI32(g.save.plain, ADV_OFFSET + manager * 36 + 4 * slot);
}

/** Trikotvertrag: Restmonate und Sponsor. */
export function shirtContract(g: GameState, manager: number): { months: number; sponsor: number } {
  const p = g.save.plain;
  return { months: p[SHIRT_OFFSET + 2 * manager], sponsor: p[SHIRT_OFFSET + 2 * manager + 1] };
}

export function boardContract(g: GameState, manager: number, slot: number): { months: number; sponsor: number } {
  const p = g.save.plain;
  const o = BOARDS_OFFSET + 2 * (6 * manager + slot);
  return { months: p[o], sponsor: p[o + 1] };
}

/**
 * Stadionwert (0x175FA): Sitze + Stehplätze + Überdacht/2 (höchstens 80000)
 * + 1900*Komfort382 + 1500*Komfort374 + 1000*(2*Komfort398 + Komfort390), höchstens 100000,
 * geteilt durch 1000.
 */
export function stadiumValue(g: GameState, manager: number): number {
  const m = g.managers.at(manager);
  let cap = (m.i32(366) >> 1) + m.i32(358) + m.i32(350);
  if (cap > 80000) cap = 80000;
  let v = cap + 1900 * m.i32(382) + 1500 * m.i32(374) + 1000 * (2 * m.i32(398) + m.i32(390));
  if (v > 100000) v = 100000;
  return div(v, 1000);
}

/**
 * Sponsorenangebote eines Managers neu würfeln (0x176F4), je Seite zehn Sponsoren.
 * Die Rechnung folgt dem Original Schritt für Schritt (32-Bit-Ganzzahlen).
 */
export function generateOffers(g: GameState, manager: number, rng: Rng): void {
  const p = g.save.plain;
  const m = g.managers.at(manager);
  const fans = m.u8(476) | (m.u8(477) << 8);
  const level = p[LEVEL_OFFSET];
  const league = m.u8(312);
  const L = 2 - league;
  for (let page = 0; page < 2; page++) {
    for (let s = 0; s < 10; s++) {
      const o = OFFERS_OFFSET + 4 * offerIndex(manager, page, s);
      let base = stadiumValue(g, manager);
      if (base < 50 && fans > 29) base += 20;
      const r = rng(15, 20);
      let half = (base >> 1) + 50;
      const limit = half + r - 50;
      const k = div(half, 5) + 2 * s;
      let amount = rng(11 * k + 58, 12 * k + 62);
      writeI32(p, o, amount);
      if (page === 0) half *= 5;
      const q3 = 3 * (div(7 * s, 10) + 3);
      const t = 10 * s + rng(3, 20);
      if (t >= limit && rng(0, q3) !== 0) {
        writeI32(p, o, 0);
        continue;
      }
      const q = rng(div(fans, 7) + 100, div(fans, 5) + 100);
      amount = div(amount * half * q, 100);
      const cat = rng(0, 2);
      p[CAT_OFFSET + offerIndex(manager, page, s)] = cat + 1;
      if (L === 1) amount = div(amount * 107, 100);
      amount = div(amount * rng(10 * (cat + 9), 15 * cat + 92), 100);
      amount = div(amount * rng(20 * (L + 5), 23 * L + 102), 100);
      amount += level * 800 + 16500;
      if (page === 0) amount += level * 2000 - 11000;
      writeI32(p, o, amount);
    }
  }
}

export type SignResult = { ok: true } | { ok: false; error: string };

/** Trikotsponsor annehmen (0x291CD): Laufzeit 12 * Jahre Monate, Betrag in die Werbetabelle. */
export function signShirt(g: GameState, manager: number, sponsor: number): SignResult {
  const p = g.save.plain;
  if (!(sponsor >= 0 && sponsor < 10)) return { ok: false, error: "Sponsor ungültig" };
  if (p[SHIRT_OFFSET + 2 * manager] !== 0) return { ok: false, error: texte("ui.unterVertrag").join(" ") };
  const idx = offerIndex(manager, 0, sponsor);
  const amount = readI32(p, OFFERS_OFFSET + 4 * idx);
  if (amount === 0) return { ok: false, error: "Kein Interesse" };
  p[SHIRT_OFFSET + 2 * manager + 1] = sponsor;
  p[SHIRT_OFFSET + 2 * manager] = (12 * p[CAT_OFFSET + idx]) & 0xff;
  writeI32(p, ADV_OFFSET + manager * 36, amount);
  return { ok: true };
}

/** Bandensponsor für einen Platz 0..5 annehmen (0x29242); das Angebot erlischt. */
export function signBoard(g: GameState, manager: number, slot: number, sponsor: number): SignResult {
  const p = g.save.plain;
  if (!(sponsor >= 0 && sponsor < 10) || !(slot >= 0 && slot < 6)) return { ok: false, error: "Angabe ungültig" };
  const o = BOARDS_OFFSET + 2 * (6 * manager + slot);
  if (p[o] !== 0) return { ok: false, error: texte("ui.unterVertrag").join(" ") };
  const idx = offerIndex(manager, 1, sponsor);
  const amount = readI32(p, OFFERS_OFFSET + 4 * idx);
  if (amount === 0) return { ok: false, error: "Kein Interesse" };
  p[o + 1] = sponsor;
  p[o] = (12 * p[CAT_OFFSET + idx]) & 0xff;
  writeI32(p, ADV_OFFSET + manager * 36 + 4 * (1 + slot), amount);
  writeI32(p, OFFERS_OFFSET + 4 * idx, 0);
  return { ok: true };
}

/**
 * Monatsende (0x11E42): laufende Verträge zählen einen Monat herunter; läuft ein
 * Vertrag ab, sinkt der eingetragene Betrag auf ein Zehntel.
 */
export function monthlyAdvertising(g: GameState, manager: number): void {
  const p = g.save.plain;
  const tick = (o: number, slot: number) => {
    if (p[o] === 0) return;
    p[o]--;
    if (p[o] === 0) {
      const a = ADV_OFFSET + manager * 36 + 4 * slot;
      writeI32(p, a, div(readI32(p, a), 10));
    }
  };
  tick(SHIRT_OFFSET + 2 * manager, 0);
  for (let i = 0; i < 6; i++) tick(BOARDS_OFFSET + 2 * (6 * manager + i), 1 + i);
}

/**
 * Saisonende (0x0CC00 bis 0x0CCED), **nur nach einem Aufstieg**: ohne Aufstieg springt das
 * Original über den ganzen Block (0x0D924 -> 0x0CCF1), die Verträge laufen also einfach weiter.
 *
 * Nach einem Aufstieg endet jeder laufende Vertrag (Restmonate auf 0), der eingetragene Betrag
 * bleibt aber stehen - die Einnahmen fließen weiter, und weil die Plätze frei sind, lassen sich
 * in der höheren Liga sofort neue, bessere Verträge abschließen. Genau das erklärt der
 * Hinweiskasten ("Ihre Werbepartner erlauben es, die Verträge jederzeit zu kündigen. Die
 * Einnahmen bleiben solange erhalten.", 0x0CC77), den das Original zeigt, wenn der
 * Trikotvertrag noch lief. War ein Vertrag dagegen schon abgelaufen (Restmonate 0), sinkt sein
 * Betrag auf ein Zehntel (0x3BA18 teilt den Eintrag durch 10) - zusätzlich zu dem Zehntel, das
 * `monthlyAdvertising` beim Ablauf schon genommen hat.
 *
 * Rückgabe: ob der Hinweiskasten fällig ist (der Trikotvertrag lief noch).
 */
export function seasonEndAdvertising(g: GameState, manager: number): boolean {
  const p = g.save.plain;
  const zehntel = (slot: number): void => {
    const a = ADV_OFFSET + manager * 36 + 4 * slot;
    writeI32(p, a, div(readI32(p, a), 10));
  };
  const shirt = SHIRT_OFFSET + 2 * manager;
  let hinweis = false;
  if (p[shirt] === 0) zehntel(0);
  else {
    p[shirt] = 0;
    hinweis = true;
  }
  for (let i = 0; i < 6; i++) {
    const o = BOARDS_OFFSET + 2 * (6 * manager + i);
    if (p[o] === 0) zehntel(1 + i);
    p[o] = 0;
  }
  return hinweis;
}
