/**
 * Vertragsverlängerungsangebote der Spieler (Tagesroutine 0x0DF0D ab 0xE76F, Zufriedenheit
 * 0x16FC8, Meldung 0x30AA0 Vorlage 4). Siehe docs/SPIELMECHANIK.md.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { playerValue } from "./value.ts";
import { LEAGUES } from "./fixtures.ts";
import { seasonDay, dayIndex } from "./calendar.ts";
import { texte } from "../data/texte.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);

/** Zufriedenheitswert (0x16FC8): Alter·w/100 mit w = 100 - 15·[Torwart] - max(0, Te - Ko)/2. */
export function contractScore(g: GameState, manager: number, place: number): number {
  const l = g.lineups.at(manager * 25 + place);
  const p = g.players.at(l.playerIndex);
  let w = 100 - (p.u8(31) < 25 ? 15 : 0);
  const d = l.u8(17) - l.u8(16);
  if (d > 0) w -= div(d, 2);
  return div(p.u8(26) * w, 100);
}

/**
 * Gehaltsforderung je Monat für einen Vertrag über `years` Jahre (Vertragsdialog 0x251FF ab 0x25C27):
 * v = Marktwert(Flags 5, also die Gehaltsbasis), prog = 100 - 100·nächsterSpieltag/Spieltage,
 * t = 100·(Jahre - 1) + prog (0x25C90 ff.), q = ((t/6 + 122) · 8)/10, Forderung = v·(q + 4)/100,
 * nach Saisontag 321 ·(152 - Alter)/100, mindestens das bisherige Gehalt (0x25D98 vergleicht mit
 * Byte 40 desselben Kaderplatzes).
 *
 * Weil q nur 1 oder 2 wird, liegt die Forderung bei rund 5 % der Gehaltsbasis - der Mindestwert
 * gewinnt also praktisch immer. Beim Kauf ist das im Original die Gehaltsbasis: der Spieler wird
 * erst in den Kader aufgenommen (0x23E86 -> 0x224A8 schreibt sie nach Byte 40) und erst danach
 * verhandelt (0x23ED8 ruft 0x251FF mit dem neuen Kaderplatz). Deshalb steht bei allen vier
 * Laufzeiten dieselbe Forderung, und schwache Marktspieler kosten fast kein Gehalt: die
 * Gehaltsbasis wächst mit der dritten Potenz von (Kondition + Technik)/2, der Ablösewert dagegen
 * linear mit Faktor 10.000.
 *
 * `source` nennt den Kaderplatz, dessen Daten gelten (Transfermarkt: Manager 4), die Liga ist die des Managers.
 */
export function salaryDemand(g: GameState, manager: number, place: number, years: number, source?: { manager: number; place: number }): number {
  const m = g.managers.at(manager);
  const src = source ?? { manager, place };
  const l = g.lineups.at(src.manager * 25 + src.place);
  const p = g.players.at(l.playerIndex);
  const league = m.u8(312);
  const v = playerValue(g, src.manager, src.place, 5);
  const prog = div(g.nextMatchday(league) * -100, LEAGUES[league].matchdays) + 100;
  const t = 100 * (years - 1) + prog;
  const q = div(((div(t, 6) + 122) << 3), 10);
  let demand = div(v * (q + 4), 100);
  if (seasonDay(dayIndex(g)) > 321) demand = div(demand * (152 - p.u8(26)), 100);
  // mindestens das bisherige Gehalt; bei einem Kauf vom Markt das Gehalt der Kaderaufnahme (Gehaltsbasis)
  const min = source ? playerValue(g, src.manager, src.place, 1) : l.i32(40);
  return Math.max(demand, min);
}

/**
 * Vertragsverhandlung (0x249E0, aus dem Vertragsdialog 0x251FF): prüft ein Angebot über `years`
 * Saisons und `salary` DM je Monat (0 = bisheriger Wert). Gleiche Laufzeit: mehr Gehalt wird
 * angenommen, weniger abgelehnt. Kürzere Laufzeit: über 120 % des bisherigen Gehalts angenommen,
 * bis 105 % abgelehnt. Sonst Schwelle v = Marktwert(Flags 5)·random(q-6, q+4)/100 mit
 * q = ((((Jahre-1)·100 + prog)/6 + 110) · 8)/10, prog = 100 - 100·nächster Spieltag/Spieltage;
 * nach Saisontag 321 zusätzlich ·random(132-Alter, 152-Alter)/100; Schwellen ab 100.000 DM
 * werden immer abgelehnt; angenommen wird ein Angebot über der Schwelle ("Ihr Angebot wurde
 * angenommen !", sonst "… ist nicht an Ihrem Angebot interessiert."). Der Dialog selbst lehnt
 * mehr als 4 Saisons ab ("Wer wird sich denn SO lange verpflichten ?"). Da q nur 1 oder 2 ist,
 * liegt die Schwelle bei längerer Laufzeit zwischen -5 % und +6 % des Marktwerts.
 * `source` nennt den Marktplatz beim Kauf (Manager 4); bisheriges Gehalt ist dann die Gehaltsbasis.
 */
export function contractCheck(g: GameState, manager: number, place: number, years: number, salary: number, rng: Rng, source?: { manager: number; place: number }): boolean {
  const m = g.managers.at(manager);
  const src = source ?? { manager, place };
  const l = g.lineups.at(src.manager * 25 + src.place);
  const p = g.players.at(l.playerIndex);
  const league = m.u8(312);
  const curYears = l.u8(11);
  const cur = source ? playerValue(g, src.manager, src.place, 1) : l.i32(40);
  if (years === 0) years = curYears;
  if (salary === 0) salary = cur;
  if (years === curYears) {
    if (salary > cur) return true;
    if (salary < cur) return false;
  }
  if (curYears > years) {
    if (salary > div(cur * 120, 100)) return true;
    if (salary <= div(cur * 105, 100)) return false;
  }
  const prog = div(g.nextMatchday(league) * -100, LEAGUES[league].matchdays) + 100;
  const t = (years - 1) * 100 + prog;
  const q = div(((div(t, 6) + 110) << 3), 10);
  let v = playerValue(g, src.manager, src.place, 5);
  v = div(v * rng(q - 6, q + 4), 100);
  if (seasonDay(dayIndex(g)) > 321) v = div(v * rng(132 - p.u8(26), 152 - p.u8(26)), 100);
  if (v >= 100000) return false;
  return salary > v;
}

/**
 * Absagen des Vertragsdialogs (0x251FF): ein ausgeliehener Spieler, einer der aufhört und einer,
 * der nach einem abgelehnten Angebot eine Weile nicht mehr verhandelt (Kaderbyte 24).
 */
export const contractRefusals = (): string[] => texte("ui.vertragsabsage");

export const MAX_CONTRACT_YEARS = 4;
export const tooLongText = (): string => texte("ui.zulange").join(" ");

export interface ContractOffer {
  manager: number;
  place: number;
  playerIndex: number;
  name: string;
  yearsFrom: number;
  yearsTo: number;
  /** Gehaltsforderung je Monat für die neue Laufzeit (salaryDemand) */
  salary: number;
}

/**
 * Tägliche Prüfung: je Kaderplatz ohne offenes Angebot (Byte 24 Bit 7) und Byte 24 < 100 wird
 * bei random(32,45) < Zufriedenheitswert ein Angebot erzeugt und Bit 7 gesetzt.
 */
export function contractOffers(g: GameState, manager: number, rng: Rng): ContractOffer[] {
  const out: ContractOffer[] = [];
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (l.isEmpty) continue;
    const b24 = l.u8(24);
    if (b24 & 0x80 || b24 >= 100) continue;
    if (rng(32, 45) >= contractScore(g, manager, place)) continue;
    l.setU8(24, b24 | 0x80);
    const p = g.players.at(l.playerIndex);
    const years = l.u8(11);
    const salary = salaryDemand(g, manager, place, years + 1);
    out.push({ manager, place, playerIndex: l.playerIndex, name: p.displayName, yearsFrom: years, yearsTo: years + 1, salary });
  }
  return out;
}

/**
 * Ankündigung, dass ein Spieler seinen Vertrag nicht verlängert (0x0E8xx bis 0x0E9C1, GitLab #59).
 * Im letzten Vertragsjahr kündigt das Original an, dass der Spieler geht - die Vorwarnung zum
 * Vertragsende. Danach steht Kaderbyte 24 auf 100 + Stufe (0x0E98C), und weil die Tagesroutine
 * nur unter 100 Angebote macht (0x0E1xx), verhandelt der Spieler nicht mehr.
 *
 * Die Schwelle (0x0E8B1 bis 0x0E8FA): L = min(8, |25 - Alter|) (Absolutbetrag über 0x319E5),
 * A = 100 - 100·L/8, S = (Kondition + Technik + Form)/3, N = (40·A + 60·S)/100. Je näher an 25
 * und je stärker, desto größer N - und desto unwahrscheinlicher die Absage, denn es braucht
 * random(0, N) = 0 **und** random(0, 3) = 0. Ein dritter Summand des Originals (0x0E900, aus
 * Kaderbytes 28/30/32) ist noch nicht entschlüsselt; er verschiebt die Schwelle leicht.
 *
 * Die Stufe: random(0,100) über 90 ergibt 4, über 70 ergibt 3, sonst 2 (0x0E96C).
 */
export function contractRefusalAnnouncements(g: GameState, manager: number, rng: Rng): { place: number; playerIndex: number; name: string; zeilen: string[] }[] {
  const out: { place: number; playerIndex: number; name: string; zeilen: string[] }[] = [];
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (l.isEmpty) continue;
    const b24 = l.u8(24);
    if (b24 & 0x80 || b24 >= 100) continue;
    if (l.u8(11) !== 1) continue;
    const p = g.players.at(l.playerIndex);
    const lo = Math.min(8, Math.abs(25 - p.u8(26)));
    const a = 100 - div(100 * lo, 8);
    const s = div(l.u8(16) + l.u8(17) + l.u8(18), 3);
    const n = div(40 * a + 60 * s, 100);
    if (rng(0, n) !== 0 || rng(0, 3) !== 0) continue;
    const wurf = rng(0, 100);
    l.setU8(24, 100 + (wurf > 90 ? 4 : wurf > 70 ? 3 : 2));
    const t = texte("ui.keineverlaengerung");
    out.push({ place, playerIndex: l.playerIndex, name: p.displayName, zeilen: [`${p.displayName} ${t[0]}`, t[1], t[2]] });
  }
  return out;
}

/** Angebot annehmen: Vertragsjahre und Gehalt setzen, Bit 7 löschen. */
export function acceptOffer(g: GameState, offer: ContractOffer): void {
  const l = g.lineups.at(offer.manager * 25 + offer.place);
  l.setU8(11, offer.yearsTo);
  for (let i = 0; i < 4; i++) l.setU8(40 + i, (offer.salary >>> (8 * i)) & 0xff);
  l.setU8(24, l.u8(24) & 0x7f);
}

/** Eigenes Angebot vom Spieler abgelehnt (0x251FF ab 0x2616F): Angebot erlischt, Byte 24 = random(10,18). */
export function rejectOffer(g: GameState, offer: ContractOffer, rng: Rng): void {
  const l = g.lineups.at(offer.manager * 25 + offer.place);
  l.setU8(24, rng(10, 18));
}

/** Angebot ablehnen: Bit 7 löschen, Byte 24 = 100 (kein weiteres Angebot). */
export function declineOffer(g: GameState, offer: ContractOffer): void {
  const l = g.lineups.at(offer.manager * 25 + offer.place);
  l.setU8(24, 100);
}
