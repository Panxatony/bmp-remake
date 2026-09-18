/**
 * Ereignisse im Spiel eines Managervereins (Minutenschleife 0x05FE5, Chancenhandler 0x1B223
 * ab 0x1BF6D, Spielerwahl 0x04E45, Verletzung 0x17B0F, Spielvorbereitung 0x1C632/0x1C5D1):
 *
 *   x = 40 - Zufriedenheit (Managerbyte 305, auf 0..40 begrenzt), L = Level (Spielstand 34062)
 *   Rote Karte:   höchstens einmal je Spiel, je Minute random(0, 70x + 50(L+5)) = 0
 *   Gelbe Karte:  Foulbudget 6 je Spiel, je Minute random(0, 5L + 2x + 37) = 0
 *   Verletzung:   je Minute random(0, 55x + 60L + 200) = 0
 *   Spielerwahl:  zufälliger Kaderplatz, nur Starter (Nummer 1..11) ohne Sperre/Verletzung;
 *                 d = Technik - Kondition: bei d > 0 angenommen, wenn d > random(0,3), sonst mit 1/11
 *   Rote Karte:   Byte 0 + 1 (Gelb-Rot: Byte 2 + 1, Byte 1 - 1), Nummer 0, Flag-Bit 0,
 *                 Sperre Byte 13 = random(1, 7) Spiele (Gelb-Rot: 1), Bewertung Byte 21 - 10
 *   Gelbe Karte:  Byte 1 + 1; die zweite Gelbe im selben Spiel ist Gelb-Rot
 *   Verletzung:   wie im Training (0x17B0F): Form - random(12,19), Art random(0,17), Wochen
 *   0:2-Wertung:  weniger als acht einsatzfähige Starter (0x0F9D2 setzt Byte 317 = 100):
 *                 Spiel verloren 0:2, 200.000 DM Strafe (0x1C5D1)
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { injurePlayer, injuries } from "./training.ts";
import { injuryKind } from "./medizin.ts";

const LEVEL_OFFSET = 34062;
export const FORFEIT_FINE = 200000;
export const FOULS_PER_MATCH = 6;

export interface Incident {
  minute: number;
  manager: number;
  place: number;
  playerIndex: number;
  name: string;
  kind: "yellow" | "red" | "yellowred" | "injury";
  /** Sperre in Spielen (Karten) bzw. Wochen (Verletzung) */
  duration: number;
  /** Zahl, die das Original in Klammern zeigt: die Karten dieses Spielers */
  count?: number;
  injury?: string;
}

export interface IncidentState {
  foulsLeft: number;
  redUsed: boolean;
  yellows: Set<number>;
  /** Karten und Verletzungen dieses Spiels */
  incidents: Incident[];
}

export function newIncidentState(): IncidentState {
  return { foulsLeft: FOULS_PER_MATCH, redUsed: false, yellows: new Set(), incidents: [] };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Spielerwahl 0x04E45: zufälliger Starter, technisch starke Spieler bevorzugt; -1 wenn keiner spielt. */
export function pickStarter(g: GameState, manager: number, rng: Rng): number {
  const squad = g.squadOf(manager);
  const eligible = squad.filter((l) => l.number >= 1 && l.number <= 11 && (l.u8(9) & 3) === 0);
  if (eligible.length === 0) return -1;
  for (let tries = 0; tries < 200; tries++) {
    const i = rng(0, squad.length - 1);
    const l = squad[i];
    if (l.number < 1 || l.number > 11 || (l.u8(9) & 3) !== 0) continue;
    const d = l.u8(17) - l.u8(16);
    if (d > 0 ? d > rng(0, 3) : rng(0, 10) === 0) return i;
  }
  return squad.indexOf(eligible[0]);
}

/** Einsatzfähige Starter (Nummer 1..11 ohne Sperre/Verletzung). */
export function fitStarters(g: GameState, manager: number): number {
  return g.squadOf(manager).filter((l) => l.number >= 1 && l.number <= 11 && (l.u8(9) & 3) === 0).length;
}

/** 0:2-Wertung, wenn weniger als acht Starter einsatzfähig sind (0x0F9D2 Byte 317 = 100, 0x1C5D1). */
export function isForfeit(g: GameState, manager: number): boolean {
  return fitStarters(g, manager) < 8;
}

export function bookForfeit(g: GameState, manager: number): void {
  const m = g.managers.at(manager);
  m.balance = m.balance - FORFEIT_FINE;
}

/**
 * Ereignisse einer Spielminute für einen Managerverein; gebucht werden sie sofort im Kader
 * (Karten, Sperre, Verletzung, Nummer 0). Liefert die neuen Ereignisse.
 */
export function minuteIncidents(g: GameState, manager: number, minute: number, st: IncidentState, rng: Rng): Incident[] {
  const m = g.managers.at(manager);
  const level = g.save.plain[LEVEL_OFFSET];
  const x = clamp(40 - m.u8(305), 0, 40);
  const out: Incident[] = [];
  const squad = g.squadOf(manager);
  const record = (i: number, kind: Incident["kind"], duration: number, injury?: string) => {
    const l = squad[i];
    // Das Original zeigt hinter dem Namen die Kartenzahl des Spielers (Kaderbytes 0/1/2)
    const count = kind === "yellow" ? l.u8(1) : kind === "red" ? l.u8(0) : kind === "yellowred" ? l.u8(2) : undefined;
    const inc: Incident = { minute, manager, place: i, playerIndex: l.playerIndex, name: g.players.at(l.playerIndex).displayName, kind, duration, count, injury };
    st.incidents.push(inc);
    out.push(inc);
  };
  // Rote Karte (0x05FE5 Block 1, einmal je Spiel)
  if (!st.redUsed && rng(0, 70 * x + 50 * (level + 5)) === 0) {
    st.redUsed = true;
    const i = pickStarter(g, manager, rng);
    if (i >= 0) {
      const l = squad[i];
      l.setU8(0, l.u8(0) + 1);
      l.setU8(10, 0);
      l.setU8(9, l.u8(9) | 1);
      const games = rng(1, 7);
      l.setU8(13, games);
      l.setU8(21, (l.u8(21) - 10) & 0xff);
      record(i, "red", games);
    }
  }
  // Gelbe Karte (Block 2, Foulbudget)
  if (st.foulsLeft > 0 && rng(0, 5 * level + 2 * x + 37) === 0) {
    st.foulsLeft--;
    const i = pickStarter(g, manager, rng);
    if (i >= 0) {
      const l = squad[i];
      if (st.yellows.has(i)) {
        // Gelb-Rot: zweite Gelbe im selben Spiel (0x1BF8E)
        l.setU8(2, l.u8(2) + 1);
        l.setU8(1, Math.max(0, l.u8(1) - 1));
        l.setU8(10, 0);
        l.setU8(9, l.u8(9) | 1);
        l.setU8(13, 1);
        l.setU8(21, (l.u8(21) - 10) & 0xff);
        st.yellows.delete(i);
        record(i, "yellowred", 1);
      } else {
        l.setU8(1, l.u8(1) + 1);
        st.yellows.add(i);
        record(i, "yellow", 0);
      }
    }
  }
  // Verletzung (Block 3)
  if (rng(0, 55 * x + 60 * level + 200) === 0) {
    const i = pickStarter(g, manager, rng);
    if (i >= 0) {
      const l = squad[i];
      injurePlayer(g, l, rng);
      record(i, "injury", l.u8(13), injuries()[injuryKind(l)]?.name);
    }
  }
  return out;
}

/** Karten und Verletzungen eines ganzen Spiels ohne Konferenz (Minuten 1..90). */
export function matchIncidents(g: GameState, manager: number, rng: Rng, minutes = 90): Incident[] {
  const st = newIncidentState();
  for (let minute = 1; minute <= minutes; minute++) minuteIncidents(g, manager, minute, st, rng);
  return st.incidents;
}
