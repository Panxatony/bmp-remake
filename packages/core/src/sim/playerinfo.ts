/**
 * Spielerinfo-Tafel (0x15346, aus Kader, Markt und Vertragsliste): Texte und Werte wie im
 * Original; die Darstellung übernimmt der Client. Siehe docs/SPIELMECHANIK.md, "Spielerinfo".
 */
import type { GameState } from "../records.ts";
import { texte, text as T } from "../data/texte.ts";
import { injuries } from "./training.ts";
import { injuryKind } from "./medizin.ts";
import { isDopeBanned, isDoped } from "./doping.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const ageLabels = (): string[] => texte("spielerinfo.alter");
export const sideLabels = (): string[] => texte("spielerinfo.seiten");
export const dataLabels = (): string[] => texte("spielerinfo.zeilen");

export interface PlayerInfo {
  name: string;
  /** "<NAME> IST n JAHRE ALT, (…)" */
  ageLine: string;
  /** "STATUS: …" */
  status: string;
  /** Tore und Spiele: Liga, DFB-Pokal (Europacup führt das Remake nicht getrennt) */
  goals: [number, number];
  apps: [number, number];
  /** DATEN: neun Zeilen Bezeichner und Wert */
  data: [string, string][];
  /** TENDENZ 0..94 aus Trainingswert Byte 14, ERSCHÖPFUNG 0..94 aus Frische Byte 19 */
  tendency: number;
  exhaustion: number;
}

/** Seitenvorliebe aus Spielerbyte 32 (0..6): bis 1 LINKS, bis 4 MITTE, sonst RECHTS. */
export const sideLabel = (v: number): string => sideLabels()[v <= 1 ? 0 : v <= 4 ? 1 : 2];

export function playerInfo(g: GameState, lineupIndex: number): PlayerInfo {
  const l = g.lineups.at(lineupIndex);
  const p = g.players.at(l.playerIndex);
  const name = p.name;
  const age = p.u8(26);
  const ageLine = `${name} IST ${age} ${T("ui.vertragskasten", 3)}${ageLabels()[clamp(div(age - 18, 5), 0, 3)]}`;
  const flag = l.u8(9) & 3;
  const number = l.u8(10);
  let status: string;
  const gedopt = isDoped(l);
  if (number >= 1 && number <= 11) status = `${T("ui.eingeplant")} ${number})`;
  else if (number >= 12) status = T("quell.playerinfo", 0);
  else if (flag === 0) status = T("quell.playerinfo", 1);
  else if (flag === 1) status = `NOCH ${l.u8(13)} SPIELE GESPERRT.`;
  else if (isDopeBanned(l)) status = `NOCH ${l.u8(13)} WOCHEN GESPERRT (DOPING).`;
  else status = `NOCH ${l.u8(13)} SPIELE VERLETZT (${injuries()[injuryKind(l)]?.name ?? "verletzt"})`;
  if (gedopt) status = `${status} GEDOPT.`;
  const years = l.u8(11);
  const data: [string, string][] = [
    [dataLabels()[0], String(l.u8(16))],
    [dataLabels()[1], String(l.u8(17))],
    [dataLabels()[2], String(l.u8(18))],
    [dataLabels()[3], String(l.u8(0))],
    [dataLabels()[4], String(l.u8(1))],
    [dataLabels()[5], String(l.u8(2))],
    [dataLabels()[6], sideLabel(p.u8(32))],
    [dataLabels()[7], `${l.i32(40)} DM`],
    [dataLabels()[8], `${years} JAHR${years > 1 ? "E" : ""}`],
  ];
  return {
    name,
    ageLine,
    status: "STATUS: " + status,
    goals: [l.u8(3), l.u8(4)],
    apps: [l.u8(6), l.u8(7)],
    data,
    tendency: clamp(div((l.u8(14) - 30) * 100, 38), 0, 94),
    exhaustion: clamp(div((l.u8(19) - 50) * 94, 100), 0, 94),
  };
}
