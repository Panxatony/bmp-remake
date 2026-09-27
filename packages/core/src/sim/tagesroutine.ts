/**
 * Tagesroutine 0x0DF0D für einen Manager, in der Reihenfolge des Originals (Zweigbuch
 * docs/abgleich/0DF0D.md). Sie läuft einmal am Ankunftstag eines Zugs, nicht für die
 * übersprungenen Kalendertage dazwischen, und ab Saisontag 322 gar nicht (0x0DF4F).
 *
 *   B, D  Transfermarkt: Frische und Angebotsbits der Marktspieler (nur Manager 0), eigene
 *         Spieler auf dem Markt (Leihbit, Sperre, Angebote fremder Vereine)
 *   E, F  Stadion: Krawallschaden, Komfortabnutzung
 *   G     Kaderschleife je Platz: Trainingsverletzung, Karriereankündigung, Angebotsbits,
 *         Verhandlungszähler, Verlängerungsangebot (nicht für Leihspieler)
 *   H     Angebote fremder Vereine für Kaderspieler
 *   I-L   Training und Frische, am Ende die Automatik-Aufstellung
 *
 * Bis #99 verteilte der Server diese Teile auf eigene Schleifen in anderer Reihenfolge, und den
 * Stadionteil würfelte er an jedem übersprungenen Kalendertag.
 */
import type { GameState } from "../records.ts";
import type { Rng } from "./match.ts";
import { dailyTransfers, angebotsbitsVerfallen, type TransferEvent } from "./transfer.ts";
import { stadionTag, type FinanceEvent } from "./finance.ts";
import { trainingsverletzung, dailyTraining, type TrainingInput } from "./training.ts";
import { karriereAnkuendigung, vertragszaehler, verlaengerungsangebot, type ContractOffer, type Karriereende } from "./contracts.ts";
import { autoLineupIfEnabled } from "./lineup.ts";

export interface Tagesergebnis {
  transfers: TransferEvent[];
  stadion: FinanceEvent[];
  /** Verletzte Kaderplätze mit dem Rückversatz ihrer Meldung */
  verletzt: { place: number; zurueck: number }[];
  karriereende: (Karriereende & { zurueck: number })[];
  verfallen: number[];
  angebote: (ContractOffer & { zurueck: number })[];
  /**
   * Alle Meldungen in der Reihenfolge, in der das Original sie über 0x30AA0 anlegt: Marktinteresse
   * (0x0E1CD), Krawall und Komfort (0x0E43C, 0x0E530), dann je Kaderplatz Verletzung (0x0E762),
   * Karriereankündigung (0x0E7F0) und Verlängerungsangebot (0x0E9C1), zuletzt das Interesse an
   * Kaderspielern (0x0EA61) - Audit 2 H3.
   */
  reihe: Tagesmeldung[];
}

export type Tagesmeldung =
  | { art: "transfer"; ev: TransferEvent }
  | { art: "stadion"; ev: FinanceEvent }
  | { art: "verletzt"; place: number; playerIndex: number; zurueck: number }
  | { art: "karriere"; ev: Karriereende & { zurueck: number } }
  | { art: "angebot"; ev: ContractOffer & { zurueck: number } };

/**
 * Jede Meldung läuft durch 0x30AA0, und die datiert sie um random(0,3) Tage zurück - ein Wurf
 * im Spielstrom je Meldung, an der Stelle, an der sie entsteht.
 */
export const meldungsWurf = (rng: Rng) => (): number => rng(0, 3);

export function tagesroutine(g: GameState, manager: number, seasonDay: number, tr: TrainingInput, rng: Rng, spielfrei: boolean): Tagesergebnis {
  const aus: Tagesergebnis = { transfers: [], stadion: [], verletzt: [], karriereende: [], verfallen: [], angebote: [], reihe: [] };
  if (seasonDay > 321) return aus;
  const meldung = meldungsWurf(rng);
  const markt = dailyTransfers(g, manager, seasonDay, rng, "markt", undefined, meldung);
  aus.transfers.push(...markt);
  aus.reihe.push(...markt.map((ev) => ({ art: "transfer" as const, ev })));
  const stadion = stadionTag(g, manager, rng, "alles", meldung);
  aus.stadion.push(...stadion);
  aus.reihe.push(...stadion.map((ev) => ({ art: "stadion" as const, ev })));
  // Das Original zählt die belegten Plätze (0x31A19) und geht dann die Plätze 0..Anzahl-1 durch -
  // hat der Kader eine Lücke, kommt die leere Stelle dran und der letzte Spieler nicht
  const n = g.squadOf(manager).length;
  for (let place = 0; place < n; place++) {
    const l = g.lineups.at(manager * 25 + place);
    if (trainingsverletzung(g, l, tr.level, spielfrei, rng)) {
      const v = { place, zurueck: meldung() };
      aus.verletzt.push(v);
      aus.reihe.push({ art: "verletzt", ...v, playerIndex: l.playerIndex });
    }
    const k = karriereAnkuendigung(g, manager, place, rng, true);
    if (k) {
      const ev = { ...k, zurueck: meldung() };
      aus.karriereende.push(ev);
      aus.reihe.push({ art: "karriere", ev });
    }
    angebotsbitsVerfallen(l, rng);
    if (vertragszaehler(g, manager, place, rng, true)) aus.verfallen.push(place);
    const o = verlaengerungsangebot(g, manager, place, rng, true);
    if (o) {
      const ev = { ...o, zurueck: meldung() };
      aus.angebote.push(ev);
      aus.reihe.push({ art: "angebot", ev });
    }
  }
  const kader = dailyTransfers(g, manager, seasonDay, rng, "kader", n, meldung);
  aus.transfers.push(...kader);
  aus.reihe.push(...kader.map((ev) => ({ art: "transfer" as const, ev })));
  dailyTraining(g, manager, seasonDay, tr, rng, spielfrei, true, n);
  autoLineupIfEnabled(g, manager);
  return aus;
}
