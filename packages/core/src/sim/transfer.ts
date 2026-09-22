/**
 * Transfermarkt: Bildschirm 0x22C15 mit Verkaufsdialog 0x242CF, KI-Entscheidung beim Kauf
 * 0x248E1, Vereinswahl für Angebote 0x16EFF, Stärkung des kaufenden KI-Vereins 0x16E1A,
 * Kaderplatz entfernen 0x1FDBE, wöchentliche Markterneuerung 0x245A8 und die Marktteile der
 * Tagesroutine 0x0DF0D. Siehe docs/SPIELMECHANIK.md, Abschnitt "Transfermarkt".
 *
 * Marktplätze sind die Aufstellungsplätze 100..111 (Manager 4). Je Platz:
 *   Byte 3   Ablehnungsbits je Manager (1 << Manager) und 0x80
 *   Byte 9   Bit 6 Angebot eines KI-Vereins für einen Kaderspieler, Bit 7 für einen eigenen
 *            Spieler auf dem Markt
 *   Byte 12  Leihe: entleihender Verein | 0x80
 *   Byte 22  Verein, der das Angebot macht
 *   Byte 40  i32 Preis (KI-Spieler: Marktwert mit Flag 4 bei der Aufnahme)
 * Spielerdatensatz Byte 33 = Besitzer (Manager, 4 = Markt, 5 = frei), Byte 36 = Verein.
 */
import { GameState, TABLES } from "../records.ts";
import type { Rng } from "./match.ts";
import { playerValue } from "./value.ts";
import { sortIntoSquad } from "./lineup.ts";
import { addToSquad } from "./newgame.ts";
import { salaryDemand } from "./contracts.ts";
import { texte } from "../data/texte.ts";

export const MARKET_MANAGER = 4;
export const MARKET_SIZE = 12;
export const OFFER_SQUAD = 0x40;
export const OFFER_MARKET = 0x80;
export const LOAN_FLAG = 0x80;
export const MAX_LISTED = 3;

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function writeI32(g: GameState, lineupIndex: number, off: number, v: number): void {
  const o = TABLES.lineups.offset + lineupIndex * 52 + off;
  for (let i = 0; i < 4; i++) g.save.plain[o + i] = (v >>> (8 * i)) & 0xff;
}

export function addBalance(g: GameState, manager: number, amount: number): void {
  const m = g.managers.at(manager);
  m.balance = m.balance + amount;
}

function isManagerClub(g: GameState, club: number): boolean {
  return g.activeManagers().some((m) => m.clubIndex === club);
}

export function slotBytes(g: GameState, lineupIndex: number): Uint8Array {
  const o = TABLES.lineups.offset + lineupIndex * 52;
  return g.save.plain.slice(o, o + 52);
}

export function setSlotBytes(g: GameState, lineupIndex: number, bytes: Uint8Array): void {
  g.save.plain.set(bytes, TABLES.lineups.offset + lineupIndex * 52);
}

/** Auf 100 DM abrunden wie das Original (·r/10000·100). */
const round100 = (v: number): number => div(v, 100) * 100;

/**
 * Kaderplatz entfernen (0x1FDBE mit Flag 1): die folgenden Plätze rücken auf, der letzte
 * Platz (Index `count - 1`) wird geleert. Kader: base = Manager·25, count 25; Markt: 100, 12.
 */
export function removePlace(g: GameState, base: number, place: number, count: number): void {
  const p = g.save.plain;
  const off = (i: number) => TABLES.lineups.offset + (base + i) * 52;
  for (let i = place; i < count - 1; i++) p.copyWithin(off(i), off(i + 1), off(i + 1) + 52);
  p.fill(0, off(count - 1), off(count - 1) + 52);
}

/** Freie Rückennummer ab 12 vergeben (0x224A8 vergibt Nummern ab 12). */
export function assignNumber(g: GameState, manager: number, place: number): void {
  const l = g.lineups.at(manager * 25 + place);
  if (l.u8(10) !== 0) return;
  const used = new Set(g.squadOf(manager).map((s) => s.number));
  let n = 12;
  while (used.has(n)) n++;
  l.setU8(10, n);
}

export interface MarketEntry {
  /** Marktplatz 0..11 */
  slot: number;
  playerIndex: number;
  name: string;
  position: string;
  age: number;
  strength: number[];
  /** Verein (Spielerbyte 36) */
  club: number;
  /** Besitzer: 4 = KI-Markt, sonst Manager */
  owner: number;
  /** Preis: KI-Spieler der gespeicherte Marktpreis, eigene Spieler der Marktwert */
  price: number;
  /** Angebot eines KI-Vereins liegt vor (Byte 9 Bit 7) */
  offer: boolean;
  /** Byte 22: anbietender Verein */
  offerClub: number;
  /** Mein Angebot wurde abgelehnt (Byte 3) */
  rejectedBy: number[];
  retiring: boolean;
}

/** Die belegten Marktplätze in Reihenfolge. */
export function marketEntries(g: GameState): MarketEntry[] {
  const out: MarketEntry[] = [];
  for (let s = 0; s < MARKET_SIZE; s++) {
    const l = g.lineups.at(100 + s);
    if (l.isEmpty) continue;
    const p = g.players.at(l.playerIndex);
    const owner = p.u8(33);
    const rejectedBy: number[] = [];
    for (let m = 0; m < 4; m++) if (l.u8(3) & (1 << m)) rejectedBy.push(m);
    out.push({
      slot: s,
      playerIndex: l.playerIndex,
      name: p.displayName,
      position: p.position,
      age: p.age,
      strength: l.strength,
      club: p.u8(36),
      owner,
      price: owner === MARKET_MANAGER ? l.i32(40) : playerValue(g, MARKET_MANAGER, s, 0),
      offer: (l.u8(9) & OFFER_MARKET) !== 0,
      offerClub: l.u8(22),
      rejectedBy,
      retiring: (l.u8(24) & 0x80) !== 0,
    });
  }
  return out;
}

/** Eigene Spieler eines Managers auf dem Markt. */
export function listedCount(g: GameState, manager: number): number {
  let n = 0;
  for (let s = 0; s < MARKET_SIZE; s++) {
    const l = g.lineups.at(100 + s);
    if (!l.isEmpty && g.players.at(l.playerIndex).u8(33) === manager) n++;
  }
  return n;
}

/**
 * Verein, der ein Angebot macht (0x16EFF): zufälliger Verein 0..63 (fremd: 64..199), kein
 * Managerverein, dessen Stärke s = (Σ Ko + Σ Te + 150)/9 zu v (Wert/10000) passt:
 * s - 2 < v < s + 20; nach 500 Versuchen der nächste beliebige.
 */
export function chooseOfferClub(g: GameState, v: number, foreign: boolean, rng: Rng): number {
  for (let tries = 0; ; tries++) {
    const c = foreign ? rng(64, 199) : rng(0, 63);
    if (isManagerClub(g, c)) continue;
    const club = g.clubs.at(c);
    let sum = 0;
    for (let i = 0; i < 3; i++) sum += club.u8(24 + i) + club.u8(27 + i) + 50;
    const s = div(sum, 9);
    if (tries > 500) return c;
    if (v >= s + 20) continue;
    if (v + 2 > s) return c;
  }
}

/**
 * Verkaufter Spieler stärkt den KI-Verein (0x16E1A): s = Σ Matrix(24..29)/6,
 * d = clamp((avg - s + 10)/3, 1, 10), eine zufällige Linie erhält Ko und Te + random(d-1, d+1).
 */
export function strengthenClub(g: GameState, club: number, avg: number, rng: Rng): void {
  if (club > 199) return;
  const c = g.clubs.at(club);
  let sum = 0;
  for (let i = 0; i < 3; i++) sum += c.u8(24 + i) + c.u8(27 + i);
  const s = div(sum, 6);
  const d = clamp(div(avg - s + 10, 3), 1, 10);
  const line = rng(0, 2);
  c.setU8(24 + line, (c.u8(24 + line) + rng(d - 1, d + 1)) & 0xff);
  c.setU8(27 + line, (c.u8(27 + line) + rng(d - 1, d + 1)) & 0xff);
}

export interface TransferEvent {
  manager: number;
  /** Meldungszeilen */
  lines: string[];
  kind: "offer-squad" | "offer-market";
  /** Marktplatz (offer-market) bzw. Kaderplatz (offer-squad) des Angebots */
  place: number;
}

/**
 * Marktteile der Tagesroutine 0x0DF0D für einen Manager (je Kalendertag, Saisontag `day`):
 * Frische der Marktspieler und Rücknahme von Angeboten (nur beim ersten Manager), Verfall
 * von Ablehnungen, KI-Angebote für eigene Spieler auf dem Markt (Bit 7) und für Kaderspieler
 * (Bit 6, bis Saisontag 321). Liefert die Meldungen.
 */
export function dailyTransfers(g: GameState, manager: number, day: number, rng: Rng): TransferEvent[] {
  const events: TransferEvent[] = [];
  const clubName = (c: number) => (c <= 199 ? g.clubs.at(c).displayName : `Verein ${c}`);
  if (manager === 0) {
    for (let s = 0; s < MARKET_SIZE; s++) {
      const l = g.lineups.at(100 + s);
      if (l.isEmpty) continue;
      if (l.u8(19) > 56) l.setU8(19, l.u8(19) - rng(3, 9));
      if (rng(0, 3) === 0 && l.u8(9) > 0x1f && (l.u8(9) & (OFFER_SQUAD | OFFER_MARKET)) !== 0) l.setU8(9, l.u8(9) & 0x1f);
    }
  }
  for (let s = 0; s < MARKET_SIZE; s++) {
    const l = g.lineups.at(100 + s);
    if (l.isEmpty) continue;
    if ((l.u8(3) & 0x7f) === 1 << manager && rng(0, 2) === 0) l.setU8(3, l.u8(3) ^ (1 << manager));
    const p = g.players.at(l.playerIndex);
    if (p.u8(33) !== manager) continue;
    // Sperre/Verletzung zählt wöchentlich herunter (0x0F6D8)
    const flags = l.u8(9);
    if ((flags & 2) === 2 && l.u8(13) > 0 && day % 7 === 0) l.setU8(13, l.u8(13) - 1);
    if ((l.u8(9) & 3) !== 0 && l.u8(13) === 0) l.setU8(9, l.u8(9) & 0xfc);
    if (l.u8(24) & 0x80) continue;
    const v = div(playerValue(g, MARKET_MANAGER, s, 0, rng), 10000);
    if (rng(0, 180) < v && rng(0, 2) !== 0 && (l.u8(9) & OFFER_MARKET) === 0) {
      l.setU8(9, l.u8(9) | OFFER_MARKET);
      const club = chooseOfferClub(g, v, false, rng);
      l.setU8(22, club);
      events.push({ manager, kind: "offer-market", place: s, lines: [clubName(club), texte("ui.interesse")[0], `${p.displayName} ${texte("ui.interesse")[1]}`] });
    }
  }
  const squad = g.squadOf(manager);
  squad.forEach((l) => {
    if (rng(0, 3) === 0 && l.u8(9) > 0x1f && (l.u8(9) & (OFFER_SQUAD | OFFER_MARKET)) !== 0) l.setU8(9, l.u8(9) & 0x1f);
  });
  if (day < 322) {
    squad.forEach((l, place) => {
      if (l.u8(12) !== 0 || l.u8(24) & 0x80) return;
      const v = div(playerValue(g, manager, place, 0, rng), 10000);
      if (rng(0, 200) >= v || rng(0, 450) !== 0 || (l.u8(9) & OFFER_SQUAD) !== 0) return;
      l.setU8(9, l.u8(9) | OFFER_SQUAD);
      const foreign = v > 90 && rng(0, 12) === 0;
      const club = chooseOfferClub(g, v, foreign, rng);
      l.setU8(22, club);
      const p = g.players.at(l.playerIndex);
      events.push({ manager, kind: "offer-squad", place, lines: [clubName(club), texte("ui.interesse")[0], `${p.displayName} ${texte("ui.interesse")[1]}`] });
    });
  }
  return events;
}

/**
 * Markterneuerung (0x245A8): KI-Spieler werden ausgetauscht, neue Spieler erhalten Stärken aus
 * ihrem Verein und den Marktpreis (Marktwert mit Flag 4). Das Original würfelt sie in der
 * Managerschleife des Tagesablaufs vor jedem Zug mit 1/(Manager + 4) (0x1E0E9), also nur an
 * Tagen mit Zug - der Server macht das in `nachTageswechsel` (GitLab #33).
 */
export function refreshMarket(g: GameState, rng: Rng): void {
  const managers = g.activeManagers();
  let kept = 0;
  for (let s = 0; s < MARKET_SIZE; s++) {
    const l = g.lineups.at(100 + s);
    if (l.isEmpty) continue;
    const p = g.players.at(l.playerIndex);
    if (p.u8(33) !== MARKET_MANAGER) {
      kept++;
      continue;
    }
    removePlace(g, 100, s, MARKET_SIZE);
    p.setU8(33, 5);
  }
  let free = MARKET_SIZE - kept;
  if (free === 0) return;
  free -= rng(0, free);
  for (let n = 0; n < free; n++) {
    const r = rng(0, 11);
    const slot = g.lineups.at(100 + r);
    if (!slot.isEmpty) {
      const p = g.players.at(slot.playerIndex);
      if (p.u8(33) !== MARKET_MANAGER) continue;
      removePlace(g, 100, r, MARKET_SIZE);
      p.setU8(33, 5);
    }
    let idx = rng(1, 150);
    for (let tries = 1; tries < 1500 && g.players.at(idx).u8(33) !== 5; tries++) idx = rng(1, 150);
    const pl = g.players.at(idx);
    pl.setU8(30, rng(45, 55));
    let club = pl.u8(36);
    if (club > 199 || managers.some((m) => m.clubIndex === club)) {
      const league = club < 18 ? 0 : club < 38 ? 1 : 2;
      const range = [[0, 17], [18, 37], [38, 57]][league];
      do club = rng(range[0], range[1]);
      while (managers.some((m) => m.clubIndex === club));
    }
    const c = g.clubs.at(club);
    pl.setU8(28, clamp(rng(0, 14) + c.u8(25) - 10, 10, 99));
    let te = rng(0, 14) + c.u8(28) - 10;
    if (rng(0, 4) === 0) te += rng(12, 20);
    pl.setU8(29, clamp(te, 10, 99));
    const place = addToSquad(g, MARKET_MANAGER, idx, 0, rng);
    if (place < 0) return;
    pl.setU8(33, MARKET_MANAGER);
    pl.setU8(36, club);
    writeI32(g, 100 + place, 40, playerValue(g, MARKET_MANAGER, place, 4, rng));
  }
}

export type MarketResult = { ok: true } | { ok: false; error: string };

/**
 * Eigenen Kaderspieler auf den Transfermarkt setzen (0x22C15 ab 0x23655): höchstens drei
 * eigene Spieler, keine Leihspieler, keine Spieler vor dem Karriereende. Der Platz wird
 * vollständig kopiert (Rückennummer 0), der Kaderplatz entfernt.
 */
export function listPlayer(g: GameState, manager: number, place: number): MarketResult {
  const l = g.lineups.at(manager * 25 + place);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  const p = g.players.at(l.playerIndex);
  if (l.u8(24) & 0x80) return { ok: false, error: texte("ui.hoertauf").join(" ") };
  if (listedCount(g, manager) >= MAX_LISTED) return { ok: false, error: texte("ui.dreiaufmarkt").join(" ") };
  if (p.u8(33) !== manager || l.u8(12) !== 0) return { ok: false, error: texte("ui.leihspieler").join(" ") };
  let slot = 0;
  while (slot < MARKET_SIZE && !g.lineups.at(100 + slot).isEmpty) slot++;
  if (slot >= MARKET_SIZE) return { ok: false, error: "Der Transfermarkt ist voll" };
  const bytes = slotBytes(g, manager * 25 + place);
  bytes[10] = 0;
  setSlotBytes(g, 100 + slot, bytes);
  removePlace(g, manager * 25, place, 25);
  return { ok: true };
}

/** Eigenen Spieler ohne Angebot vom Markt zurückholen (Pfad -0xa in 0x22C15). */
export function takeBack(g: GameState, manager: number, slot: number): MarketResult {
  const l = g.lineups.at(100 + slot);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  const p = g.players.at(l.playerIndex);
  if (p.u8(33) !== manager) return { ok: false, error: "Nicht Ihr Spieler" };
  let place = 0;
  while (place < 25 && !g.lineups.at(manager * 25 + place).isEmpty) place++;
  if (place >= 25) return { ok: false, error: texte("ui.keintransfer").join(" ") };
  const bytes = slotBytes(g, 100 + slot);
  bytes[9] &= 0x3f;
  setSlotBytes(g, manager * 25 + place, bytes);
  assignNumber(g, manager, place);
  // Der Kader bleibt nach Mannschaftsteil sortiert - wie bei jeder anderen Aufnahme auch
  sortIntoSquad(g, manager, place);
  removePlace(g, 100, slot, MARKET_SIZE);
  return { ok: true };
}

export interface SaleOffer {
  manager: number;
  /** "squad": Kaderplatz, "market": Marktplatz */
  where: "squad" | "market";
  place: number;
  playerIndex: number;
  name: string;
  club: number;
  amount: number;
  /** Ablöse = Angebot - Angebot/7·Vertragsjahre (Dialog 0x242CF) */
  fee: number;
  years: number;
}

/**
 * Angebot eines KI-Vereins beziffern (beim Anklicken gewürfelt): Kaderspieler
 * Marktwert·random(85,150)/100, eigener Marktspieler Marktwert·random(67,110)/100, jeweils
 * auf 100 DM abgerundet. Liefert null, wenn kein Angebot vorliegt.
 */
export function saleOffer(g: GameState, manager: number, where: "squad" | "market", place: number, rng: Rng): SaleOffer | null {
  const idx = where === "squad" ? manager * 25 + place : 100 + place;
  const l = g.lineups.at(idx);
  if (l.isEmpty) return null;
  const p = g.players.at(l.playerIndex);
  if (p.u8(33) !== manager) return null;
  const bit = where === "squad" ? OFFER_SQUAD : OFFER_MARKET;
  if ((l.u8(9) & bit) === 0) return null;
  const value = playerValue(g, where === "squad" ? manager : MARKET_MANAGER, place, 0, rng);
  const amount = round100(div(value * (where === "squad" ? rng(85, 150) : rng(67, 110)), 100));
  const years = l.u8(11);
  return { manager, where, place, playerIndex: l.playerIndex, name: p.displayName, club: l.u8(22), amount, fee: amount - div(amount, 7) * years, years };
}

/**
 * Entscheidung im Verkaufsdialog: BEHALTEN löscht das Angebot; VERKAUFEN bucht die Ablöse,
 * gibt den Spieler an den anbietenden Verein (Spielerbyte 36, Besitzer 5) und stärkt ihn.
 */
export function decideSale(g: GameState, offer: SaleOffer, sell: boolean, rng: Rng): MarketResult {
  const idx = offer.where === "squad" ? offer.manager * 25 + offer.place : 100 + offer.place;
  const l = g.lineups.at(idx);
  if (l.isEmpty || l.playerIndex !== offer.playerIndex) return { ok: false, error: "Der Spieler ist nicht mehr da" };
  const bit = offer.where === "squad" ? OFFER_SQUAD : OFFER_MARKET;
  l.setU8(9, l.u8(9) & ~bit & 0xff);
  if (!sell) return { ok: true };
  const p = g.players.at(l.playerIndex);
  const avg = div(l.u8(16) + l.u8(17) + l.u8(18), 3);
  const club = l.u8(22);
  l.setU8(22, 0);
  addBalance(g, offer.manager, offer.fee);
  if (offer.where === "squad") removePlace(g, offer.manager * 25, offer.place, 25);
  else removePlace(g, 100, offer.place, MARKET_SIZE);
  p.setU8(36, club);
  strengthenClub(g, club, avg, rng);
  p.setU8(33, 5);
  return { ok: true };
}

/**
 * KI-Entscheidung über ein Kaufangebot (0x248E1): Preis = Marktpreis des Platzes (Leihe: /3).
 * Unter Preis·random(75,85)/100 abgelehnt, ab Preis·random(120,130)/100 angenommen, sonst
 * angenommen, wenn Angebot·100/Preis > random(80,120).
 */
export function aiAccepts(price: number, amount: number, rng: Rng): boolean {
  if (amount < div(price * rng(75, 85), 100)) return false;
  if (amount >= div(price * rng(120, 130), 100)) return true;
  const pct = div(amount * 100, price);
  return pct > rng(80, 120);
}

export type BuyResult =
  | { ok: false; error: string }
  /** KI hat angenommen, Vertrag muss noch ausgehandelt werden (Kauf) */
  | { ok: true; state: "contract"; demands: number[] }
  /** Angebot an einen anderen Manager, der entscheiden muss */
  | { ok: true; state: "pending" }
  /** Leihe abgeschlossen */
  | { ok: true; state: "done"; place: number };

/**
 * Kaufangebot für einen Marktspieler (0x22C15 ab 0x23816 / 0x23B90). Bei KI-Spielern
 * entscheidet aiAccepts; danach folgt für einen Kauf die Vertragsverhandlung
 * (completePurchase), eine Leihe wird sofort abgeschlossen. Spieler anderer Manager:
 * Angebot muss zwischen 60 % und 140 % des Marktwerts liegen, der Besitzer entscheidet.
 */
export function buyOffer(g: GameState, manager: number, slot: number, amount: number, loan: boolean, rng: Rng): BuyResult {
  const l = g.lineups.at(100 + slot);
  if (l.isEmpty) return { ok: false, error: "Kein Spieler" };
  const p = g.players.at(l.playerIndex);
  const owner = p.u8(33);
  if (owner === manager) return { ok: false, error: "Das ist Ihr eigener Spieler" };
  if (l.u8(3) & (1 << manager)) return { ok: false, error: texte("ui.schonabgelehnt").join(" ") };
  if (!(amount > 0)) return { ok: false, error: "Ihr Angebot?" };
  if (g.managers.at(manager).balance < amount) return { ok: false, error: texte("ui.zuwenig").join(" ") };
  if (owner !== MARKET_MANAGER) {
    let value = playerValue(g, MARKET_MANAGER, slot, 0, rng);
    if (loan) value = div(value, 3);
    if (amount < div(value * 60, 100) || amount >= div(value * 140, 100)) return { ok: false, error: "Dieser Betrag liegt au\u00dferhalb des Erlaubten !" };
    return { ok: true, state: "pending" };
  }
  let price = l.i32(40);
  if (loan) price = div(price, 3);
  if (!aiAccepts(price, amount, rng)) {
    l.setU8(3, l.u8(3) | (1 << manager) | 0x80);
    return { ok: false, error: texte("ui.angebotabgelehnt").slice(0, 2).join(" ") };
  }
  if (loan) {
    const place = completeLoan(g, manager, slot, amount, owner, rng);
    if (place < 0) return { ok: false, error: texte("ui.keintransfer").join(" ") };
    return { ok: true, state: "done", place };
  }
  let free = 0;
  while (free < 24 && !g.lineups.at(manager * 25 + free).isEmpty) free++;
  if (free >= 24) return { ok: false, error: texte("ui.keintransfer").join(" ") };
  const demands = [1, 2, 3, 4].map((years) => salaryDemand(g, manager, free, years, { manager: MARKET_MANAGER, place: slot }));
  return { ok: true, state: "contract", demands };
}

/** Vertragsverhandlung nach einem abgelehnten Kauf (0x2411C): Ablehnungsbit setzen. */
export function cancelPurchase(g: GameState, manager: number, slot: number): void {
  const l = g.lineups.at(100 + slot);
  if (!l.isEmpty) l.setU8(3, l.u8(3) | (1 << manager) | 0x80);
}

/**
 * Kauf abschließen (0x23E58 ff.): neuer Kaderplatz (0x224A8), Flags, Verletzung und Karten
 * vom Marktplatz, Vertrag und Gehalt aus der Verhandlung, Kaufpreis vom Konto (an den
 * Vorbesitzer, wenn ein Manager), Spieler gehört dem Käufer.
 */
export function completePurchase(g: GameState, manager: number, slot: number, amount: number, years: number, salary: number, rng: Rng): number {
  const l = g.lineups.at(100 + slot);
  if (l.isEmpty) return -1;
  const market = slotBytes(g, 100 + slot);
  const p = g.players.at(l.playerIndex);
  const owner = p.u8(33);
  if (owner !== MARKET_MANAGER) {
    p.setU8(28, market[16]);
    p.setU8(29, market[17]);
    p.setU8(30, market[18]);
  }
  const place = addToSquad(g, manager, l.playerIndex, years, rng);
  if (place < 0) return -1;
  const n = g.lineups.at(manager * 25 + place);
  n.setU8(9, market[9] & 0x3f);
  n.setU8(23, market[23]);
  n.setU8(13, market[13]);
  n.setU8(0, market[0]);
  n.setU8(1, market[1]);
  n.setU8(2, market[2]);
  n.setU8(11, years);
  writeI32(g, manager * 25 + place, 40, salary);
  assignNumber(g, manager, place);
  removePlace(g, 100, slot, MARKET_SIZE);
  addBalance(g, manager, -amount);
  if (owner !== MARKET_MANAGER) addBalance(g, owner, amount);
  p.setU8(33, manager);
  p.setU8(36, g.managers.at(manager).clubIndex);
  return place;
}

/**
 * Leihe abschließen (0x23F7E ff.): Marktplatz wird kopiert, Vertrag 1 Jahr, Byte 12 =
 * Verein | 0x80, Gehalt aus dem Marktwert, Karten/Tore gelöscht; der Spieler bleibt
 * Eigentum des Verleihers.
 */
export function completeLoan(g: GameState, manager: number, slot: number, amount: number, owner: number, rng: Rng): number {
  const l = g.lineups.at(100 + slot);
  if (l.isEmpty) return -1;
  const market = slotBytes(g, 100 + slot);
  const p = g.players.at(l.playerIndex);
  const club = p.u8(36);
  // Leihe: das Gehalt kommt mit dem Abschlag des Originals (Modus 3, ein Drittel)
  const place = addToSquad(g, manager, l.playerIndex, 1, rng, true);
  if (place < 0) return -1;
  const idx = manager * 25 + place;
  const salary = g.lineups.at(idx).i32(40);
  const bytes = market.slice();
  bytes[9] &= 0x3f;
  setSlotBytes(g, idx, bytes);
  const n = g.lineups.at(idx);
  n.setU8(11, 1);
  n.setU8(12, (club | LOAN_FLAG) & 0xff);
  writeI32(g, idx, 40, salary);
  n.setU8(3, 0);
  n.setU8(4, 0);
  n.setU8(5, 0);
  assignNumber(g, manager, place);
  p.setU8(33, owner);
  removePlace(g, 100, slot, MARKET_SIZE);
  addBalance(g, manager, -amount);
  if (owner !== MARKET_MANAGER) addBalance(g, owner, amount);
  return place;
}
