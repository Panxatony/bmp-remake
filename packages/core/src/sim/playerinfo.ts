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

/** Großschreiben wie 0x3196D: a..z und die Codepage-437-Umlaute ä ö ü. */
const gross = (t: string): string => t.replace(/[a-z\x81\x84\x94]/g, (c) => ({ "\x81": "\x9a", "\x84": "\x8e", "\x94": "\x99" })[c] ?? c.toUpperCase());
/** Zahl wie 0x26D8F mit Mindestbreite 2: vorn mit dem leeren '^' aufgefüllt, 0 als "^@". */
const zahl = (n: number): string => (n === 0 ? "^@" : `${n < 10 ? "^" : ""}${n}`);

export const ageLabels = (): string[] => texte("spielerinfo.alter");
export const sideLabels = (): string[] => texte("spielerinfo.seiten");
export const dataLabels = (): string[] => texte("spielerinfo.zeilen");

export interface PlayerInfo {
  name: string;
  /** "<NAME> IST n JAHRE ALT, (…)" */
  ageLine: string;
  /** "STATUS: …" */
  status: string;
  /**
   * Tore und Spiele je Spalte LIGA, DFB-POKAL, EUROPACUP als "Saison(Gesamt)" (0x157FE-0x159A9):
   * Saison aus Kaderbyte 3 + k bzw. 6 + k, Gesamt aus Wort 34 + 2k bzw. 28 + 2k; Zahlen mit
   * Mindestbreite 2 (4cb3:079C), eine 0 als "^@" (0x26D8F) - Audit 2 C4
   */
  goals: [string, string, string];
  apps: [string, string, string];
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
  // Den Zähler gibt es nur bei der Sperre; die Verletzung steht mit ihrer Art in Großbuchstaben
  // (0x15656-0x1573A, 0x3196D), Flag 3 mit dem Text 4cb3:24E8 (Audit 2 C3)
  else if (flag === 1) status = `${texte("ui.kaderstatus")[4]}${l.u8(13)}${texte("ui.kaderstatus")[5]}${texte("ui.spielerstatus")[1]}`;
  else if (isDopeBanned(l)) status = `NOCH ${l.u8(13)} WOCHEN GESPERRT (DOPING).`;
  else if (flag === 3) status = texte("pokal.namen")[3];
  else status = `${texte("ui.spielerstatus")[0]}(${gross(injuries()[injuryKind(l)]?.name ?? "")})`;
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
    goals: [0, 1, 2].map((k) => `${zahl(l.u8(3 + k))}(${zahl(l.u16(34 + 2 * k))})`) as [string, string, string],
    apps: [0, 1, 2].map((k) => `${zahl(l.u8(6 + k))}(${zahl(l.u16(28 + 2 * k))})`) as [string, string, string],
    data,
    tendency: clamp(div((l.u8(14) - 30) * 100, 38), 0, 94),
    exhaustion: clamp(div((l.u8(19) - 50) * 94, 100), 0, 94),
  };
}
