/**
 * Verträge in der Tagesroutine 0x0DF0D: Karriereankündigung (ab 0xE76F, Wert 0x16FC8,
 * Meldung Vorlage 4), Verlängerungsangebot (ab 0xE83E, Vorlage 0) und der Zähler in
 * Kaderbyte 24 (ab 0xE5DC). Zeile für Zeile belegt in docs/abgleich/0DF0D.md.
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
 * Karriereankündigung (Tagesroutine 0x0E76F bis 0x0E835): je Kaderplatz `random(32,45)` gegen
 * den Wert aus 0x16FC8, der mit dem Alter wächst; liegt der Wurf darunter und ist weder
 * Bit 7 noch ein Wert ab 100 in Kaderbyte 24 gesetzt, setzt das Original Bit 7 und meldet
 * mit Vorlage 4: "$ kündigt an, dass er seinen Vertrag nicht mehr verlängern wird." Eine
 * Verhandlung gibt es nicht. Läuft sein Vertrag am Saisonende aus, hängt er die Schuhe an den
 * Nagel (seasonEvents.ts, 0x0D511).
 *
 * Bis GitLab #81 war das hier ein Verlängerungsangebot mit Dialog - das Remake hatte die
 * beiden Meldungen der Tagesroutine vertauscht. In allen Originalspielständen sind die
 * Spieler mit Bit 7 zwischen 33 und 35 Jahre alt.
 */
export function retirementAnnouncements(g: GameState, manager: number, rng: Rng): { place: number; playerIndex: number; name: string; zeilen: string[] }[] {
  const out: { place: number; playerIndex: number; name: string; zeilen: string[] }[] = [];
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (l.isEmpty) continue;
    // Das Original würfelt vor der Prüfung von Byte 24 (0x0E788)
    if (rng(32, 45) >= contractScore(g, manager, place)) continue;
    const b24 = l.u8(24);
    if (b24 & 0x80 || b24 >= 100) continue;
    l.setU8(24, b24 | 0x80);
    const p = g.players.at(l.playerIndex);
    const t = texte("ui.keineverlaengerung");
    out.push({ place, playerIndex: l.playerIndex, name: p.displayName, zeilen: [`${p.displayName} ${t[0]}`, t[1], t[2]] });
  }
  return out;
}

/**
 * Verlängerungsangebot eines Spielers (Tagesroutine 0x0E83E bis 0x0E9D5): im letzten
 * Vertragsjahr bietet er an, von 1 auf 2, 3 oder 4 Jahre zu verlängern (Vorlage 0 "$ bietet an,
 * von # auf # Jahre zu verlängern"). Kaderbyte 24 wird 100 + Jahre; verhandelt wird im
 * Vertragsdialog, und ohne Antwort verfällt das Angebot mit einem Sechstel je Tag
 * (`contractCooldown`).
 *
 * Schwelle (0x0E83E bis 0x0E918): S = (Kondition + Technik + Form)/3, L = min(8, |25 - Alter|),
 * A = 100 - 100·L/8, N₀ = (40·A + 60·S)/100, T = min(5, (Einsätze 28 + 30 + 32)/36) und
 * **N = N₀ - N₀·T/10**: wer viele Einsätze hat, bietet eher an. T fehlte bis GitLab #83 (F3).
 * Angeboten wird bei `random(0,N) = 0` und `random(0,3) = 0`; Jahre: `random(0,100)` über 90
 * ergibt 4, über 70 ergibt 3, sonst 2 (0x0E96C).
 *
 * Geliehene Spieler (Kaderbyte 12) bieten nicht an: für sie endet die Schleife vorher
 * (0x0E650, GitLab #83, F4).
 *
 * Bis GitLab #81 stand hier die Ankündigung, nicht zu verlängern - vertauscht mit der
 * Karriereankündigung. In den Originalspielständen sind die Spieler mit 100 + Jahre zwischen
 * 29 und 31 und im letzten Vertragsjahr.
 */
export function contractOffers(g: GameState, manager: number, rng: Rng): ContractOffer[] {
  const out: ContractOffer[] = [];
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (l.isEmpty || l.u8(12) !== 0) continue;
    const p = g.players.at(l.playerIndex);
    const s = div(l.u8(16) + l.u8(17) + l.u8(18), 3);
    const lo = Math.min(8, Math.abs(25 - p.u8(26)));
    const a = 100 - div(100 * lo, 8);
    const n0 = div(40 * a + 60 * s, 100);
    const u16 = (o: number) => l.u8(o) | (l.u8(o + 1) << 8);
    const t = Math.min(5, div((u16(28) + u16(30) + u16(32)) & 0xffff, 36));
    const n = n0 - div(n0 * t * 10, 100);
    // Gewürfelt wird vor den übrigen Bedingungen (0x0E91F, 0x0E931)
    if (rng(0, n) !== 0 || rng(0, 3) !== 0) continue;
    // Kein liegendes Angebot (das Original prüft dessen Meldungszeiger in Feld 48), keine
    // Karriereankündigung, letztes Vertragsjahr
    const b24 = l.u8(24);
    if (b24 & 0x80 || b24 >= 100 || l.u8(11) !== 1) continue;
    const wurf = rng(0, 100);
    const jahre = wurf > 90 ? 4 : wurf > 70 ? 3 : 2;
    l.setU8(24, 100 + jahre);
    out.push({ manager, place, playerIndex: l.playerIndex, name: p.displayName, yearsFrom: l.u8(11), yearsTo: jahre, salary: salaryDemand(g, manager, place, jahre) });
  }
  return out;
}

/**
 * Angebot annehmen: Vertragsjahre und Gehalt setzen. Danach sperrt der Vertragsdialog weitere
 * Gespräche: Kaderbyte 24 = random(10,18) (0x26195), das löscht auch die Rücktrittsmarke (Bit 7)
 * und die 100 + Jahre des Angebots. Die Meldung des Spielers räumt das Original dabei weg
 * (0x2617A); unsere Meldungen hängen nicht am Kaderplatz.
 */
export function acceptOffer(g: GameState, offer: ContractOffer, rng: Rng): void {
  const l = g.lineups.at(offer.manager * 25 + offer.place);
  l.setU8(11, offer.yearsTo);
  for (let i = 0; i < 4; i++) l.setU8(40 + i, (offer.salary >>> (8 * i)) & 0xff);
  vertragsgespraechSperren(g, offer.manager, offer.place, rng);
}

/** Eigenes Angebot vom Spieler abgelehnt (0x251FF ab 0x2616F): Angebot erlischt, Byte 24 = random(10,18). */
export function rejectOffer(g: GameState, offer: ContractOffer, rng: Rng): void {
  vertragsgespraechSperren(g, offer.manager, offer.place, rng);
}

/**
 * Angebot ablehnen, also den Dialog ohne Einigung verlassen: auch das endet bei 0x26165 mit
 * Byte 24 = random(10,18). (Bis #95 stand hier 100, das dann nur mit 1/6 je Tag verfiel.)
 */
export function declineOffer(g: GameState, offer: ContractOffer, rng: Rng): void {
  vertragsgespraechSperren(g, offer.manager, offer.place, rng);
}

/**
 * Ende jedes Vertragsdialogs außer dem Sonderzustand 3 (0x26165 bis 0x261A8): Kaderbyte 24 =
 * random(10,18) - ob mit Einigung oder ohne. Der Wert zählt täglich herunter (0x0E5DC); erst
 * bei 0 bietet der Spieler wieder an.
 */
export function vertragsgespraechSperren(g: GameState, manager: number, place: number, rng: Rng): void {
  g.lineups.at(manager * 25 + place).setU8(24, rng(10, 18));
}

/**
 * Tägliche Pflege des Verhandlungszählers (Kaderbyte 24) in der Tagesroutine, 0x0E5DC bis
 * 0x0E64C:
 *
 * * Steht dort ein Wert **über 99** - ein liegendes Verlängerungsangebot (100 + Jahre) -,
 *   **verfällt** es mit `random(0,5) = 0`, also einem Sechstel je Tag:
 *   der Wert geht auf `random(9,17)`, und der Spieler kann wieder anbieten. (In #80 hatte ich
 *   das als "Absage" gedeutet; das Verhalten stimmte, die Deutung nicht - siehe #81.)
 * * Sonst zählt der Wert täglich um eins herunter, bis er 0 erreicht.
 *
 * Nicht nachgebaut: Das Original knüpft die Rückkehr daran, dass zu dem Spieler noch ein
 * Meldungszeiger im Kaderfeld 48/50 steht (ein Fernzeiger auf den Meldungstext, 0x0E5FC), und
 * räumt die Meldung dabei weg (0x30954). Unsere Meldungen hängen nicht am Kaderplatz, deshalb
 * gilt die Rückkehr hier ohne diese Bedingung - der Hinweis bleibt stehen (GitLab #80).
 *
 * Liefert die Kaderplätze, die wieder verhandeln.
 */
export function contractCooldown(g: GameState, manager: number, rng: Rng): number[] {
  const zurueck: number[] = [];
  for (let place = 0; place < 25; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (l.isEmpty) continue;
    const b = l.u8(24);
    if (b & 0x80) continue;
    if (b > 99) {
      if (rng(0, 5) === 0) {
        l.setU8(24, rng(9, 17));
        zurueck.push(place);
      }
    } else if (b !== 0) l.setU8(24, b - 1);
  }
  return zurueck;
}
