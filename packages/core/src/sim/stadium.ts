/**
 * Stadion (Bildschirm 0x0602, Ausbau 0x0000, Fertigstellung 0x20E1) und Bank (Bildschirm
 * 0x1291F, Kreditaufnahme 0x122D9).
 *
 * Managerfelder: je Ausbauart k = 1..7 ein i32 bei 350 + 8(k-1) (Bestand) und 354 + 8(k-1)
 * (im Bau), Restbautage u16 bei 404 + 2k. Arten: 1 Sitzplätze, 2 Stehplätze, 3 überdachte
 * Plätze (je 1000), 4 Flutlicht, 5 Anzeigetafel (Größe 0..3), 6 Zustand, 7 Komfort (0..6).
 * Preise 4cb3:0044 je 1000 bzw. je Punkt, Bauzeit-Basis 4cb3:0064.
 */
import type { GameState } from "../records.ts";
import { texte } from "../data/texte.ts";
import type { Rng } from "./match.ts";
import { DAYS_IN_MONTH, lenderDebt } from "./finance.ts";
import { LEVEL_OFFSET } from "./werbung.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/** Ausbauarten (0x11D0D): Preis und Grundwert; Namen und Kürzel stehen im Katalog. */
const KIND_DATA = [
  { kind: 1, price: 150000, perThousand: true, base: 15 },
  { kind: 2, price: 100000, perThousand: true, base: 15 },
  { kind: 3, price: 160000, perThousand: true, base: 20 },
  { kind: 4, price: 380000, perThousand: false, base: 10 },
  { kind: 5, price: 440000, perThousand: false, base: 10 },
  { kind: 6, price: 550000, perThousand: false, base: 8 },
  { kind: 7, price: 650000, perThousand: false, base: 4 },
] as const;

export const stadiumKinds = (): { kind: number; name: string; label: string; price: number; perThousand: boolean; base: number }[] => {
  const namen = texte("stadion.arten");
  const kuerzel = texte("stadion.kuerzel");
  return KIND_DATA.map((d, i) => ({ ...d, name: namen[i], label: kuerzel[i] }));
};
/** Absagen des Stadionbildschirms (0x0602/0x0000, Texte des Originals). */
export const stadiumMessages = (): string[] => texte("stadion.absagen");

export const sizeNames = (): string[] => texte("stadion.groessen");
export const statusNames = (): string[] => texte("stadion.zustand");
export const TOTAL_CAPACITY = 130000;
export const TICKET_RANGE = { min: 5, max: 25 } as const;

const valueOff = (kind: number) => 350 + 8 * (kind - 1);
const pendingOff = (kind: number) => 354 + 8 * (kind - 1);
const daysOff = (kind: number) => 404 + 2 * kind;

function writeI32(g: GameState, manager: number, off: number, v: number): void {
  const m = g.managers.at(manager);
  for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff);
}

export interface StadiumState {
  kind: number;
  value: number;
  pending: number;
  days: number;
  max: number;
  price: number;
}

export function stadiumState(g: GameState, manager: number): StadiumState[] {
  const m = g.managers.at(manager);
  const seats = m.i32(350);
  const seatsPending = m.i32(354);
  const standing = m.i32(358);
  const standingPending = m.i32(362);
  const roofed = m.i32(366);
  const roofedPending = m.i32(370);
  return stadiumKinds().map((k) => {
    let max: number;
    if (k.kind <= 2) max = TOTAL_CAPACITY - standing - standingPending - seatsPending - seats;
    else if (k.kind === 3) max = standing - roofedPending - roofed + seats;
    else max = k.kind <= 5 ? 3 : 6;
    return { kind: k.kind, value: m.i32(valueOff(k.kind)), pending: m.i32(pendingOff(k.kind)), days: m.u8(daysOff(k.kind)) | (m.u8(daysOff(k.kind) + 1) << 8), max: Math.max(0, max), price: k.price };
  });
}

/**
 * Gesamtkapazität, wie der Stadionbildschirm sie in beiden Spalten zeigt: nur Sitz- und
 * Stehplätze. Überdachte Plätze sind ein Teil davon und zählen nicht dazu - in DOSBox
 * nachgemessen: 8.000 Sitz- und 16.000 Stehplätze ergeben 24.000, ob die 2.000 überdachten
 * Plätze fertig sind oder noch gebaut werden (GitLab #55).
 */
export function stadiumCapacity(g: GameState, manager: number): { jetzt: number; nachAusbau: number } {
  const st = stadiumState(g, manager);
  const jetzt = st[0].value + st[1].value;
  return { jetzt, nachAusbau: jetzt + st[0].pending + st[1].pending };
}

export type StadiumResult = { ok: true; cost: number; days: number } | { ok: false; error: string };

/**
 * Bauzeit würfeln (0x0000): random(80,120)·(7·Basis + Resttage·random(20,80)/100)/100 Tage.
 *
 * Das Original würfelt schon für die Rückfrage und nennt den gewürfelten Wert dort als
 * "BAUZEIT: CIRKA ... WOCHEN". In DOSBox nachgemessen: zweimal Grundwert 10 (Flutlicht und
 * Anzeigetafel, beide ohne laufenden Bau) ergab 9 und 10 Wochen - es ist also kein fester
 * Schätzwert, sondern die Bauzeit selbst (GitLab #55).
 */
export function buildDays(g: GameState, manager: number, kind: number, rng: Rng): number {
  const k = stadiumKinds()[kind - 1];
  const st = stadiumState(g, manager)[kind - 1];
  const prior = div(st.days * rng(20, 80), 100);
  return div(rng(80, 120) * (7 * k.base + prior), 100);
}

/**
 * Tage als Wochen, wie das Original sie zeigt: aufgerundet. In DOSBox nachgemessen, indem die
 * Restzeit im Spielstand gesetzt wurde: 72 Tage -> 11 Wochen, 83 -> 12, 84 -> 12.
 */
export function buildWeeks(days: number): number {
  return Math.ceil(days / 7);
}

/**
 * Ausbau (Bildschirm 0x0602 + Routine 0x0000). Plätze in Tausenderschritten bis zur freien
 * Gesamtkapazität, Kosten = Preis je 1000; Komfortarten als neue Stufe, Kosten = Preis je Punkt.
 * Die Bauzeit steht schon in der Rückfrage: `tage` übernimmt den dort gewürfelten Wert, ohne
 * ihn würfelt `buildDays` hier.
 */
export function extendStadium(g: GameState, manager: number, kind: number, amount: number, rng: Rng, tage?: number): StadiumResult {
  const k = stadiumKinds()[kind - 1];
  if (!k || !Number.isInteger(amount)) return { ok: false, error: "Ungültige Angabe" };
  const st = stadiumState(g, manager)[kind - 1];
  const m = g.managers.at(manager);
  let cost: number;
  let add: number;
  if (k.perThousand) {
    if (amount <= 0 || amount % 1000 !== 0 || amount > st.max) return { ok: false, error: `Höchstens ${st.max} Plätze in Tausenderschritten` };
    cost = div(amount, 1000) * k.price;
    add = amount;
  } else {
    const current = st.value + st.pending;
    if (amount <= current) return { ok: false, error: `${stadiumMessages()[6]} ${stadiumMessages()[7]}` };
    if (amount > st.max) return { ok: false, error: `Höchstens Stufe ${st.max}` };
    cost = (amount - current) * k.price;
    add = amount - current;
  }
  const abs = stadiumMessages();
  if (m.i32(496) < cost) return { ok: false, error: `${abs[0]} ${abs[1]}` };
  const days = tage ?? buildDays(g, manager, kind, rng);
  writeI32(g, manager, 496, m.i32(496) - cost);
  writeI32(g, manager, pendingOff(kind), st.pending + add);
  m.setU8(daysOff(kind), days & 0xff);
  m.setU8(daysOff(kind) + 1, (days >> 8) & 0xff);
  return { ok: true, cost, days };
}

/** Tägliche Baufortschritte (0x20E1): Resttage herunter, bei 0 wird der Bau übernommen. Liefert die fertigen Arten. */
export function dailyConstruction(g: GameState, manager: number): number[] {
  const m = g.managers.at(manager);
  const done: number[] = [];
  for (const k of stadiumKinds()) {
    const o = daysOff(k.kind);
    let days = m.u8(o) | (m.u8(o + 1) << 8);
    if (days === 0) continue;
    days--;
    m.setU8(o, days & 0xff);
    m.setU8(o + 1, (days >> 8) & 0xff);
    if (days === 0) {
      writeI32(g, manager, valueOff(k.kind), m.i32(valueOff(k.kind)) + m.i32(pendingOff(k.kind)));
      writeI32(g, manager, pendingOff(k.kind), 0);
      done.push(k.kind);
    }
  }
  return done;
}

export function setTicketPrice(g: GameState, manager: number, price: number): string | null {
  if (!Number.isInteger(price) || price < TICKET_RANGE.min || price > TICKET_RANGE.max) return `Eintrittspreis ${TICKET_RANGE.min} bis ${TICKET_RANGE.max} DM`;
  const m = g.managers.at(manager);
  m.setU8(266, price);
  m.setU8(348, price & 0xff);
  m.setU8(349, (price >> 8) & 0xff);
  return null;
}

// ---- Bank ----

export const BANK = 4;
/** Kreditgrenze je Geldgeber (0x132FE bzw. 0x132B8): 4 Mio. bei der Bank, 1 Mio. bei Mitspielern. */
export const LOAN_MAX_BANK = 4000000;
export const LOAN_MAX_MANAGER = 1000000;
/** Laufzeiten der Kreditliste der Bank in Monaten (0x12CE5: (Zeile + 1) * 3). */
export const LOAN_MONTHS = [3, 6, 9, 12, 15, 18];
/** Mitspielerkredit: Laufzeit hoechstens 24 Monate (0x1340A), Zinssatz 3 bis 13 Prozent. */
export const LOAN_MONTHS_MAX = 24;
export const LOAN_RATE_MIN = 3;
export const LOAN_RATE_MAX = 13;

export function loanRate(g: GameState, durationIndex: number): number {
  return g.save.plain[35 + durationIndex];
}

/**
 * Zinstabelle der Bank (0x112AA; Konfigurationsbytes 35..40 = DGROUP 0x60E). Der Leitwert
 * (DGROUP 0x630, im Original nur im Speicher, zu Programmstart 5; hier Byte 35, das nach jedem
 * Lauf gleich dem Leitwert ist) ändert sich um random(0, L + 2) + L - 1 mit L = 1 bei
 * Spiel-Level > 2, sonst 0, begrenzt auf 2..7. Die Sätze der sechs Laufzeiten laufen vom
 * Leitwert mit Schrittweite 5 - Leitwert weiter (Schritte über 1 werden je Laufzeit um 1
 * kleiner, Schritt 1 bleibt), jeder Wert begrenzt auf 2..7: 7 -> 7/5/3/2/2/2, 5 -> 5/5/5/5/5/5,
 * 4 -> 4/5/6/7/7/7, 2 -> 2/5/7/7/7/7. Aufruf zu Spielbeginn (0xAD44) und in der täglichen
 * Finanzroutine mit 1/61 (0x11DA2), also je Manager und Saisontag - nicht am Monatsende
 * (GitLab #34).
 */
export function driftInterest(g: GameState, rng: Rng, base = g.save.plain[35]): void {
  const p = g.save.plain;
  const L = p[LEVEL_OFFSET] > 2 ? 1 : 0;
  const lim = (v: number): number => Math.max(2, Math.min(7, v));
  let cur = lim(base + rng(0, L + 2) + L - 1);
  let step = 5 - cur;
  for (let i = 0; i < 6; i++) {
    p[35 + i] = cur;
    cur = lim(cur + step);
    if (step > 1) step--;
  }
}

/**
 * Kredit aufnehmen (0x122D9 mit den Pruefungen aus 0x1320B): freier Platz unter drei je
 * Geldgeber, Zins je Monat = Summe * Satz / 100, Aufnahmedatum, Faelligkeit nach `months`
 * Monaten am selben Tag (hoechstens Monatslaenge). Bei einem Mitspieler als Geldgeber wandert
 * die Summe von dessen Konto auf das eigene.
 *
 * Die Meldungstexte sind die des Originals (4cb3:4E58 ff.).
 */
/**
 * Prüfung einer Kreditanfrage an einen Mitspieler ohne Laufzeit und Zins (Version 2026): dort
 * fragt der Borger nur nach der Summe, die Bedingungen setzt der Geldgeber (sim/regeln.ts).
 * Liefert einen Fehlertext oder null.
 */
export function loanRequestCheck(g: GameState, manager: number, amount: number, lender: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "Betrag ung\u00fcltig";
  if (lender < 0 || lender >= g.save.managerCount || lender === manager) return "Geldgeber ung\u00fcltig";
  if (g.managers.at(lender).i32(496) < amount) return `${texte("ui.kreditabsage")[0]} ${texte("ui.kreditabsage")[1]} ${g.managers.at(lender).displayName} ${texte("ui.kreditabsage")[2]}`;
  if (lenderDebt(g, manager, lender) + amount > LOAN_MAX_MANAGER) return "Sie k\u00f6nnen nur maximal 1 Mio. DM Kredit von einem Mitspieler aufnehmen.";
  const m = g.managers.at(manager);
  let frei = false;
  for (let s = 0; s < 3; s++) if (m.i32(508 + (lender * 3 + s) * 18) === 0) frei = true;
  if (!frei) return texte("ui.dreikredite").join(" ");
  return null;
}

export function takeLoan(
  g: GameState,
  manager: number,
  amount: number,
  months: number,
  rate: number,
  date: { day: number; month0: number; year: number },
  lender = BANK,
): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return "Betrag ung\u00fcltig";
  if (!Number.isInteger(months) || months <= 0) return "Laufzeit ung\u00fcltig";
  if (!Number.isInteger(rate) || rate <= 0) return "Zinssatz ung\u00fcltig";
  const m = g.managers.at(manager);
  if (lender !== BANK) {
    if (lender < 0 || lender >= g.save.managerCount || lender === manager) return "Geldgeber ung\u00fcltig";
    if (months > LOAN_MONTHS_MAX) return `Maximal ${LOAN_MONTHS_MAX} Monate.`;
    if (rate > LOAN_RATE_MAX) return texte("ui.wucher").join(" ");
    if (rate < LOAN_RATE_MIN) return texte("ui.mindestzins").slice(1).join(" ");
    if (g.managers.at(lender).i32(496) < amount) return `${texte("ui.kreditabsage")[0]} ${texte("ui.kreditabsage")[1]} ${g.managers.at(lender).displayName} ${texte("ui.kreditabsage")[2]}`;
  }
  const max = lender === BANK ? LOAN_MAX_BANK : LOAN_MAX_MANAGER;
  if (lenderDebt(g, manager, lender) + amount > max) {
    const grenze = texte("ui.kreditgrenze");
    return lender === BANK ? [grenze[0], ...grenze.slice(4)].join(" ") : grenze.slice(0, 4).join(" ");
  }
  let slot = -1;
  for (let s = 0; s < 3; s++) {
    if (m.i32(508 + (lender * 3 + s) * 18) === 0) {
      slot = s;
      break;
    }
  }
  if (slot < 0) return texte("ui.dreikredite").join(" ");
  const o = 508 + (lender * 3 + slot) * 18;
  writeI32(g, manager, o, amount);
  m.setU8(o + 12, rate);
  writeI32(g, manager, o + 4, div(amount * rate, 100));
  m.setU8(o + 8, date.day);
  m.setU8(o + 10, date.month0);
  m.setU8(o + 14, date.year & 0xff);
  m.setU8(o + 15, date.year >> 8);
  let dueYear = date.year;
  let dueMonth = date.month0 + months;
  while (dueMonth > 11) {
    dueMonth -= 12;
    dueYear++;
  }
  m.setU8(o + 11, dueMonth);
  m.setU8(o + 16, dueYear & 0xff);
  m.setU8(o + 17, dueYear >> 8);
  m.setU8(o + 9, Math.min(date.day, DAYS_IN_MONTH[dueMonth]));
  writeI32(g, manager, 496, m.i32(496) + amount);
  if (lender !== BANK) writeI32(g, lender, 496, g.managers.at(lender).i32(496) - amount);
  return null;
}
