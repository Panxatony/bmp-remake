/**
 * Mannschaftsstärke eines Managers aus der Aufstellung (0x0F9D2),
 * siehe docs/routines/mannschaftsstaerke.md. Ergebnis ist die Stärkematrix
 * des Vereins (Kondition, Technik, Form je Linie), die die Spielsimulation
 * verwendet.
 */
import type { GameState, Lineup, Player } from "../records.ts";
import type { Rng, TeamStrength } from "./match.ts";

/** Feldlinie (7 - Kaderplatz Byte 26) -> Gruppe 0 Abwehr, 1 Mittelfeld, 2 Angriff (DGROUP 0x2A2). */
const LINE_GROUP = [0, 0, 0, 1, 1, 1, 2, 2];

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface StrengthInput {
  starters: { squad: Lineup; player: Player }[];
  /** Regler "Einsatz" (DGROUP 0x4A28, Save-Offset 34062) */
  einsatz: number;
  /** Manager Byte 305 */
  zufriedenheit: number;
  /** Manager Byte 317 (100 = fixiert) */
  moral: number;
  /** Vereinsbyte 23 */
  base: number;
}

export function strengthInput(g: GameState, manager: number): StrengthInput {
  const m = g.managers.at(manager);
  const starters = g
    .squadOf(manager)
    .filter((l) => l.number >= 1 && l.number <= 11)
    .map((squad) => ({ squad, player: g.players.at(squad.playerIndex) }));
  return {
    starters,
    einsatz: g.save.plain[34062],
    zufriedenheit: m.u8(305),
    moral: m.u8(317),
    base: g.clubs.at(m.clubIndex).u8(23),
  };
}

/**
 * Rechnet die Matrix; verändert keine Daten.
 *
 * `forMatch` entspricht dem Schreibflag des Originals: Mit 0 (Anzeige in den
 * Bildschirmen) werden nur die reinen Durchschnitte gebildet und in den
 * Vereinsdatensatz geschrieben; nur vor einem Spiel (Flag 1) kommen
 * Frische, Einsätze, Tore, Fehlbesetzungen, Torwart, Einsatzregler und
 * Zufriedenheit dazu. Der Spielstand enthält deshalb fast immer die Anzeigewerte.
 */
export function teamStrength(inp: StrengthInput, rng: Rng, forMatch = true): TeamStrength & { zufriedenheitNeu: number } {
  const sumKo = [0, 0, 0];
  const sumTe = [8, 8, 8];
  const sumFo = [0, 0, 0];
  const count = [0, 0, 0];
  const malus = [0, 0, 0];
  const plus = [-9, -8, -5]; // Besetzung Abwehr, Mittelfeld, Angriff
  let teMinusKo = 0;
  let torwartModus = 1;
  let tw = 0;
  let starters = 0;

  for (const { squad, player } of inp.starters) {
    starters++;
    const line = 7 - squad.fieldLine; // 0 = Tor/Abwehr ... 7 = Sturm
    const grp = LINE_GROUP[line];
    const role = squad.u8(25);
    const ko = squad.u8(16);
    const te = squad.u8(17);
    const fo = squad.u8(18);
    const positionFit = Math.abs(player.u8(32) - role);
    const lineDist = Math.abs(player.positionValue - (div((7 - squad.fieldLine) * 75, 7) + 5));

    if (!forMatch) {
      sumKo[grp] += ko;
      sumTe[grp] += te;
      sumFo[grp] += fo;
      count[grp] += 1;
      continue;
    }
    if (role === 1 || role === 5) tw += 1;
    if (role === 0 || role === 6) tw += 2;
    if (line >= 3) {
      if (line === 3) {
        plus[0] += 1;
        plus[1] += 1;
        if (role >= 2 && role <= 4 && positionFit < 2 && te - 10 > ko) sumTe[grp] += 15;
      } else if (line < 6) plus[1] += 2;
      else if (line === 6) {
        plus[1] += 1;
        plus[2] += 1;
      } else plus[2] += 2;
    } else {
      plus[0] += 2;
      if (line === 1 && role === 3 && positionFit < 2 && te - 10 > ko) sumTe[grp] += 15;
      if (line === 0 && role === 3) torwartModus = div(player.positionValue, 25) === 0 ? 0 : 2;
    }
    if (positionFit > 2) malus[grp] += rng(2, 6);
    if (lineDist > 25) malus[grp] += rng(2, 6);
    teMinusKo += te - ko;
    sumKo[grp] += ko + div(squad.leagueApps, 6) - div(squad.freshness, 20) + 3;
    sumTe[grp] += te + squad.leagueGoals - 1;
    sumFo[grp] += fo;
    count[grp] += 1;
  }

  for (let l = 0; l < 3; l++) sumTe[l] += div((inp.einsatz - 5) * malus[l] * 20, 100);
  if (starters === 0) sumTe[0] = sumTe[1] = sumTe[2] = 0;
  // fehlende Starter zählen reihum
  for (let i = starters, l = 0; i < 11; i++, l = (l + 1) % 3) count[l]++;
  if (!forMatch) return finish(inp, sumKo, sumTe, sumFo, count, inp.zufriedenheit);
  if (inp.einsatz === 0 && tw > 8) sumTe[2] += -100 * teMinusKo; // Torwart-Sonderfall (0xFD40), Bedeutung offen
  if (torwartModus > 0) {
    const k = torwartModus - 1;
    sumTe[0] = Math.trunc((sumTe[0] * rng(10 * k + 5, 20 * k + 5)) / 100);
    sumTe[1] = Math.trunc((sumTe[1] * rng(10, 40)) / 100);
    sumKo[0] = Math.trunc((sumKo[0] * rng(5 * (k + 2), 30 * k + 20)) / 100);
  }
  for (let l = 0; l < 3; l++) {
    sumTe[l] = clamp(sumTe[l], 0, 32000);
    sumKo[l] = clamp(sumKo[l], 0, 32000);
  }
  if (plus[1] < 1 && plus[0] > 0) plus[2] += plus[1] - 1;
  if (plus[2] > 0) plus[0] += plus[1] - 1;
  if (plus[0] < -1 && rng(7, 10) > plus[0] + 10) plus[1] -= rng(3, 5);
  for (let l = 0; l < 3; l++) {
    sumTe[l] += inp.einsatz;
    if (sumKo[l] !== 0) sumKo[l] += inp.zufriedenheit - 16;
    if (sumTe[l] !== 0 && inp.einsatz < 4) {
      const t = plus[l] * count[l];
      // Tabelle 4238:90C6[manager] liegt außerhalb des Spielstands (nur Laufzeit), hier 0
      sumTe[l] += (t + 3 * 0) * 10;
      sumKo[l] += 5 * t;
    }
    if (sumTe[l] < 0) sumTe[l] = 0;
    if (sumKo[l] < 0) sumKo[l] = 0;
  }
  let z = clamp(div(teMinusKo, 9), -4, 4);
  if (z < 0) z = 0;
  return finish(inp, sumKo, sumTe, sumFo, count, clamp(z + inp.zufriedenheit, 0, 40));
}

function finish(
  inp: StrengthInput,
  sumKo: number[],
  sumTe: number[],
  sumFo: number[],
  count: number[],
  zufriedenheitNeu: number,
): TeamStrength & { zufriedenheitNeu: number } {
  const ko: [number, number, number] = [0, 0, 0];
  const te: [number, number, number] = [0, 0, 0];
  const fo: [number, number, number] = [0, 0, 0];
  for (let l = 0; l < 3; l++) {
    if (count[l] <= 1) continue;
    ko[l] = div(sumKo[l], count[l]);
    te[l] = div(sumTe[l], count[l]);
    fo[l] = div(sumFo[l], count[l]);
  }
  return { base: inp.base, ko, te, fo, zufriedenheitNeu };
}
