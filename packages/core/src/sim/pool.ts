/**
 * Spielerpool der KI-Vereine (Spielerbyte 36): Saisonende 0x0F2A6 mit den Helfern
 * 0x161D8 (Sollzahlen je Liga, Wertedrift, zufällige Vereinswechsel), 0x0F58B (Stärkeliste je
 * Liga, Ergebnis im Original ungenutzt) und 0x0F4D7 (Zielverein), dazu die Ligaverteilung zu
 * Spielbeginn 0x1643B. Siehe docs/SPIELMECHANIK.md, Abschnitt "Spielerpool".
 *
 * Ligagrenzen der Vereinsindizes (DGROUP 0x2272): 0..17, 18..37, 38..57, 58..255; Ligabasis
 * (DGROUP 0x226E): 0, 18, 38.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { wertAusDatensatz } from "./value.ts";
import { chooseOfferClub } from "./transfer.ts";

const LEAGUE_LO = [0, 18, 38, 58];
const LEAGUE_HI = [17, 37, 57, 255];
const LEAGUE_BASE = [0, 18, 38];
const PLAYERS = 150;

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function isManagerClub(g: GameState, club: number): boolean {
  return g.activeManagers().some((m) => m.clubIndex === club);
}

const isForeign = (club: number): boolean => club > 63 && club !== 0xff;

/**
 * Das Datensegment 4238 des Originals, soweit es im Spielstand steht (docs/MEMORY-MAP.md):
 * Spielertabelle, Ergebnisse, Pokalbereich, Kaderplätze. Anderes (Laufzeitspeicher wie der
 * Spielbericht) liest sich als 0.
 */
const SEGMENT_4238: [number, number, number][] = [
  [0x57dd, 15813, 5587],
  [0x6ddc, 59, 2280],
  [0x76ca, 28009, 128],
  [0x774a, 21400, 6500],
];
function segment4238(g: GameState, adresse: number): number {
  for (const [a, o, n] of SEGMENT_4238) if (adresse >= a && adresse < a + n) return g.save.plain[o + adresse - a];
  return 0;
}

/**
 * Wert/10000 für die Vereinswahl (0x161D8 -> 0x24D4E, #99): das Original übergibt die
 * Spielernummer als Kaderplatz, und zwar als vorzeichenbehaftetes Byte, zum aktuellen Manager
 * 4238:304A (`aktuell`) - der steht nach der Managerschleife des Saisonendes auf der
 * Managerzahl, beim neuen Spiel auf 0. Gelesen
 * wird also der "Kaderplatz" 25·Managerzahl + (int8) Spielernummer: leere Plätze eines
 * unbesetzten Managers, Marktplätze, dahinter Laufzeitspeicher (hier 0), für Nummern ab 128
 * Bytes vor der Kadertabelle (Ergebnisse, Pokalbereich). Bei angebotenen Spielern (Byte 9,
 * Bit 7) würfelt die Wertrechnung random(95,100) - auch hier.
 */
function poolValue(g: GameState, player: number, aktuell: number, rng: Rng): number {
  const platz = 25 * aktuell + ((player << 24) >> 24);
  const basis = 0x774a + 52 * platz;
  return div(wertAusDatensatz(g, (o) => segment4238(g, basis + o), 0, rng), 10000);
}

/**
 * 0x161D8: Sollzahl der Spieler je Liga. Kondition und Technik aller 150 Spieler driften um
 * random(1,7) - 4 (30..99); stehen mehr als vier Spieler bei fremden Vereinen (64..254), gehen
 * überzählige zu deutschen Vereinen zurück; danach wechseln random(5,15) Spieler, die nicht bei
 * einem Managerverein stehen, zu einem Verein passender Stärke (0x16EFF). Soll je Liga =
 * (Kaderspieler der Manager in der Liga · 100 / X) · (150 - X) / 100 mit X = Kaderspieler aller
 * Manager + verbliebene Auslandsspieler.
 */
export function poolTargets(g: GameState, rng: Rng, aktuell = g.activeManagers().length): number[] {
  const count = [0, 0, 0];
  let x = 0;
  for (let l = 0; l < 3; l++) {
    g.activeManagers().forEach((m, i) => {
      if (m.u8(312) === l) count[l] += g.squadOf(i).length;
    });
    x += count[l];
  }
  let foreign = 0;
  for (let i = 1; i <= PLAYERS; i++) {
    const p = g.players.at(i);
    for (const off of [28, 29]) p.setU8(off, clamp(p.u8(off) + rng(1, 7) - 4, 30, 99));
    if (isForeign(p.u8(36))) foreign++;
  }
  const moves = rng(5, 15);
  for (let n = 0; n < moves; ) {
    let pl = rng(1, PLAYERS);
    const club = g.players.at(pl).u8(36);
    if (foreign > 4 && isForeign(club)) {
      foreign--;
      g.players.at(pl).setU8(36, chooseOfferClub(g, poolValue(g, pl, aktuell, rng), false, rng));
      pl = 0;
    }
    if (isManagerClub(g, club) || pl === 0 || foreign > 4) continue;
    g.players.at(pl).setU8(36, chooseOfferClub(g, poolValue(g, pl, aktuell, rng), false, rng));
    n++;
  }
  for (let i = 1; i <= PLAYERS; i++) if (isForeign(g.players.at(i).u8(36))) x++;
  if (x === 0) x = 1;
  return count.map((c) => div(div(c * 100, x) * (PLAYERS - x), 100));
}

/**
 * 0x0F4D7: Zielverein in Liga l: Abstand r = random(0,3), mit 1/2 random(0,6), davon mit 1/6
 * random(0,12) von der Ligabasis, kein Managerverein. Ab Liga 3: random(58, 255).
 */
export function pickPoolClub(g: GameState, league: number, rng: Rng): number {
  if (league > 2) return rng(LEAGUE_LO[3], 255);
  for (;;) {
    let r = rng(0, 3);
    if (rng(0, 1) !== 0) r = rng(0, 6);
    if (rng(0, 5) === 0) r = rng(0, 12);
    const club = (LEAGUE_BASE[league] + r) & 0xff;
    if (!isManagerClub(g, club)) return club;
  }
}

/**
 * 0x0F2A6 (Saisonende, nach den Vertragsdialogen): Sollzahlen je Liga (0x161D8), Fehlbestand
 * = Soll minus vorhandene Spieler im Ligabereich; Kandidaten sind Spieler, die keinem Manager
 * gehören (Byte 33 > 3). Je Liga mit Fehlbestand werden zufällige Kandidaten aus den anderen
 * Ligen (in Ligareihenfolge) zu einem Verein der Liga versetzt (0x0F4D7). Zum Schluss läuft
 * 0x161D8 noch einmal (zweite Drift, weitere Wechsel).
 */
export function seasonPlayerPool(g: GameState, rng: Rng, vorZweitem?: () => void): void {
  const need = poolTargets(g, rng);
  need.push(0);
  const cand: number[][] = [[], [], [], []];
  for (let l = 0; l < 4; l++) {
    for (let i = 1; i <= PLAYERS; i++) {
      const p = g.players.at(i);
      const club = p.u8(36);
      if (club < LEAGUE_LO[l] || club > LEAGUE_HI[l]) continue;
      if (need[l] !== 0) need[l]--;
      if (p.u8(33) <= 3) continue;
      cand[l].push(i);
    }
  }
  const avail = cand.map((c) => c.length);
  for (let l = 0; l < 4; l++) {
    for (let src = 0; src < 4 && need[l] > 0; src++) {
      if (src === l) continue;
      while (avail[src] > 0 && need[l] > 0) {
        let r: number;
        do r = rng(0, cand[src].length - 1);
        while (cand[src][r] < 0);
        const pl = cand[src][r];
        cand[src][r] = -1;
        g.players.at(pl).setU8(36, pickPoolClub(g, l, rng));
        avail[src]--;
        need[l]--;
      }
    }
  }
  vorZweitem?.();
  poolTargets(g, rng);
}

/**
 * 0x1643B (Spielbeginn 0x943F): Sollzahlen je Liga (0x161D8), dann erhält jeder Spieler ohne
 * Verein (Byte 36 = 255) je Liga mit Restbedarf einen Verein (0x0F4D7) - die letzte Liga mit
 * Bedarf gewinnt. Spieler mit Verein nimmt die Routine nur mit, wenn das Jahr 4238:A7A0 gesetzt
 * ist (`alle`); beim neuen Spiel steht es dort noch auf 0, also bleiben die Spieler, die 0x161D8
 * gerade versetzt hat, bei ihrem Verein (NG4 gegen das Original: 125 statt 130 Auswahlen, #100).
 * `aktuell`: Manager am Zug 4238:304A für die Wertrechnung in 0x161D8 (neues Spiel: 0).
 */
export function distributePlayers(g: GameState, alle: boolean, rng: Rng, aktuell?: number): void {
  const need = poolTargets(g, rng, aktuell);
  for (let i = 1; i <= PLAYERS; i++) {
    const p = g.players.at(i);
    const club = p.u8(36);
    if (isManagerClub(g, club)) continue;
    if (club !== 0xff && !alle) continue;
    for (let l = 0; l < 3; l++) {
      if (need[l] === 0) continue;
      p.setU8(36, pickPoolClub(g, l, rng));
      need[l]--;
    }
  }
}
