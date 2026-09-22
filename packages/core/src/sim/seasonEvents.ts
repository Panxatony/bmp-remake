/**
 * Saisonende je Manager (0x0CB62) und Spielerjahrgang: Prämien, Jugendspieler,
 * Rücktritte, Abgänge bei Vertragsende. Siehe docs/SPIELMECHANIK.md, "Saisonwechsel".
 */
import type { GameState } from "../records.ts";
import { text as T, texte } from "../data/texte.ts";
import { is2026 } from "./regeln.ts";
import type { Rng } from "./match.ts";
import { playerValue } from "./value.ts";
import { removePlace } from "./transfer.ts";
import { sortIntoSquad } from "./lineup.ts";

const div = (a: number, b: number): number => Math.trunc(a / b);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface SeasonEvent {
  manager: number;
  text: string;
  /**
   * Version 2026: der Spieler ist ablösefrei und steht allen Managern offen (sim/abloesefrei.ts).
   * Der abgebende Verein bekommt dann keine Ablöse.
   */
  free?: { playerIndex: number; name: string; position: string; age: number; strength: number[]; salary: number; value: number; from: number };
  /** Zeilen für den Hinweiskasten, wenn das Original die Meldung dort zeigt (statt in der Liste). */
  kasten?: string[];
  /** Zeilen für die Meldungsliste, wenn das Original einen festen Zeilenschnitt hat. */
  meldung?: string[];
  /**
   * Vertrag abgelaufen, Verhandlung noch offen (0x0DB40 ruft je Spieler den Vertragsdialog
   * 0x251FF). Der Spieler bleibt bis zur Antwort im Kader; `releaseExpiring` gibt ihn frei.
   */
  vertrag?: { playerIndex: number; name: string };
}

function addBalance(g: GameState, manager: number, amount: number): void {
  const m = g.managers.at(manager);
  const v = m.i32(496) + amount;
  for (let i = 0; i < 4; i++) m.setU8(496 + i, (v >>> (8 * i)) & 0xff);
}

/** Torschützenkönig der Liga des Managers? (0x16515: bester Ligatorschütze, Spieler Byte 34) */
function hasTopScorer(g: GameState, manager: number): boolean {
  const club = g.managers.at(manager).clubIndex;
  const league = club < 18 ? 0 : club < 38 ? 1 : 2;
  const inLeague = (c: number) => (c < 18 ? 0 : c < 38 ? 1 : 2) === league;
  let best = 0;
  let bestClub = -1;
  for (const p of g.players.toArray()) {
    if (p.isEmpty || !inLeague(p.u8(36))) continue;
    if (p.u8(34) > best) {
      best = p.u8(34);
      bestClub = p.u8(36);
    }
  }
  return best > 0 && bestClub === club;
}

/** Freien Spielerdatensatz (Manager 5 = niemand) finden. */
function freePlayer(g: GameState, rng: Rng): number {
  for (let tries = 0; tries < 2000; tries++) {
    const i = rng(1, 150);
    if (g.players.at(i).u8(33) === 5) return i;
  }
  return -1;
}

function freePlace(g: GameState, manager: number): number {
  for (let i = 0; i < 25; i++) if (g.lineups.at(manager * 25 + i).isEmpty) return i;
  return -1;
}

/** Spieler in den Kader aufnehmen (0x224A8): Nummer 12+, Vertrag, Gehalt aus dem Marktwert. */
/**
 * Jugendspieler in den Kader setzen (0x0CE84): Rückennummer ab 12, Frische 100, Formtendenz 50,
 * Vertrag über zwei bis drei Jahre und **die Hälfte der üblichen Gehaltsbasis**. Die
 * Jugendarbeit der Version 2026 (sim/jugend.ts) benutzt denselben Weg.
 */
export function addToSquad(g: GameState, manager: number, playerIndex: number, rng: Rng): number {
  const place = freePlace(g, manager);
  if (place < 0) return -1;
  const l = g.lineups.at(manager * 25 + place);
  for (let i = 0; i < 52; i++) l.setU8(i, 0);
  l.setU8(15, playerIndex);
  let number = 12;
  const used = new Set(g.squadOf(manager).map((s) => s.number));
  while (used.has(number)) number++;
  l.setU8(10, number);
  const p = g.players.at(playerIndex);
  l.setU8(16, p.u8(28));
  l.setU8(17, p.u8(29));
  l.setU8(18, p.u8(30));
  l.setU8(19, 100);
  l.setU8(14, 50);
  l.setU8(25, p.u8(32));
  l.setU8(26, 7 - Math.min(7, div(p.u8(31), 10)));
  p.setU8(33, manager);
  p.setU8(36, g.managers.at(manager).clubIndex);
  const salary = div(playerValue(g, manager, place, 1) * 50, 100);
  for (let i = 0; i < 4; i++) l.setU8(40 + i, (salary >>> (8 * i)) & 0xff);
  l.setU8(11, rng(2, 3));
  // Der Kader bleibt nach Mannschaftsteil sortiert
  return sortIntoSquad(g, manager, place);
}

/**
 * Spieler aus dem Kader entfernen (0x1FDBE) und auf den Transfermarkt geben. Das Original
 * schiebt die folgenden Kaderplätze auf (0x1FE61 kopiert Platz i+1 nach i, 0x1FEBC leert den
 * letzten) - der Kader hat also keine Lücken.
 */
function removeFromSquad(g: GameState, manager: number, place: number): void {
  const l = g.lineups.at(manager * 25 + place);
  g.players.at(l.playerIndex).setU8(33, 5);
  removePlace(g, manager * 25, place, 25);
}

/**
 * Spieler mit abgelaufenem Vertrag freigeben (0x0DB40 nach einem "kein Angebot" im
 * Vertragsdialog): der Spieler verlässt den Verein, der Verein bekommt den halben Marktwert
 * (0x0DCA1 ff.). In der Version 2026 ist er stattdessen ablösefrei und alle dürfen bieten.
 */
export function releaseExpiring(g: GameState, manager: number, place: number): SeasonEvent {
  const l = g.lineups.at(manager * 25 + place);
  const p = g.players.at(l.playerIndex);
  const name = p.displayName;
  const frei = is2026(g);
  const value = playerValue(g, manager, place, 0);
  const fee = frei ? 0 : div(value, 2);
  const daten = { playerIndex: l.playerIndex, name, position: p.position, age: p.age, strength: l.strength.slice(), salary: l.i32(40), value, from: manager };
  removeFromSquad(g, manager, place);
  if (fee > 0) addBalance(g, manager, fee);
  if (frei) return { manager, text: `${name} ist ablösefrei und verlässt Sie. Sie bekommen keine Ablöse.`, free: daten };
  return { manager, text: `${name} ${texte("ui.vertragsende").slice(0, 2).join(" ")} ${texte("ui.abloese")[1]} ${fee} DM.` };
}

/** Saisonende-Ereignisse aller Manager; flags je Manager: 1 Aufstieg, 2 Abstieg, 4 Lizenz, 8 Neustart. */
export function seasonEvents(g: GameState, flags: number[], rng: Rng, verlaengerung = false): SeasonEvent[] {
  const events: SeasonEvent[] = [];
  const managers = g.activeManagers();
  managers.forEach((m, i) => {
    const f = flags[i] ?? 0;
    if (f & 1) {
      const bonus = m.u8(312) === 0 ? 1600000 : 800000;
      addBalance(g, i, bonus);
      events.push({ manager: i, text: texte("ui.aufstieg")[bonus === 1600000 ? 0 : 1] });
    }
    if (f & 2) events.push({ manager: i, text: texte("ui.aufstieg")[2] });
    if (f & 4) events.push({ manager: i, text: T("quell.seasonevents", 0) });
    if (f & 8) events.push({ manager: i, text: T("quell.seasonevents", 1) });
    if (hasTopScorer(g, i)) {
      addBalance(g, i, 250000);
      events.push({ manager: i, text: "Torschützenkönig aus Ihrem Team (250.000 DM)." });
    }
    // Jugend (0x0CE84): J = Konto/12, Konto auf zwei Drittel; bei J > 30, 1/3 Chance und unter 23 Spielern ein Jugendspieler mit J/2
    let j = div(m.u8(482) | (m.u8(483) << 8), 12);
    j = j + div(j, -3);
    let account = j * 12;
    if (j > 30 && rng(0, 2) === 0 && g.squadOf(i).length < 23) {
      j >>= 1;
      const idx = freePlayer(g, rng);
      if (idx >= 0) {
        const p = g.players.at(idx);
        const jj = clamp(j, 10, 90);
        p.setU8(32, rng(0, 6));
        p.setU8(26, rng(17, 19));
        p.setU8(30, rng(45, 55));
        p.setU8(29, rng(jj - 3, jj + 3));
        p.setU8(28, rng(jj - 3, jj + 3));
        p.setU8(31, clamp(p.u8(32) * 14 + rng(0, 10), 0, 99));
        if (addToSquad(g, i, idx, rng) >= 0) events.push({ manager: i, text: `${T("ui.jugendaufstieg").slice(0, -1)}: ${p.displayName}.` });
      }
    }
    m.setU8(482, account & 0xff);
    m.setU8(483, (account >> 8) & 0xff);
  });

  // Karriereende (0x0D475 bis 0x0D65B): eine Schleife über alle 150 Spieler, einmal je Manager.
  //
  // * Kaderspieler des Managers, der gerade dran ist, hängen die Schuhe an den Nagel, wenn ihr
  //   Vertrag ausläuft (Byte 11 = 0) **und** sie ihr Karriereende angekündigt haben (Byte 24
  //   Bit 7, `retirementAnnouncements`) - ohne Ablöse, der Datensatz wird neu belegt
  //   (0x0D511 bis 0x0D5B8). Nach dem Alter allein geht kein Kaderspieler: in den
  //   Originalspielständen stehen 58 35-Jährige in Managerkadern.
  // * Spieler ohne Verein gehen bei Alter > random(32,34). Das wird in jedem Durchgang neu
  //   gewürfelt, und es gibt so viele Durchgänge wie Manager (0x0D4E6, 0x0D50C) - im Pool der
  //   Originalspielstände ist keiner älter als 34.
  // * Spieler anderer Manager und des Transfermarkts überspringt der Durchgang (0x0D4D4).
  //
  // Bis GitLab #81 gingen bei uns Kaderspieler nach dem Alter und Spieler ohne Verein nie.
  // Unmittelbar davor werden alle Spieler ein Jahr älter (0x0D3F0 bis 0x0D472): das
  // Karriereende vergleicht also schon das neue Alter. Deshalb ist in den Originalspielständen
  // kein Spieler ohne Verein älter als 34 - ein 35-Jähriger liegt immer über random(32,34).
  for (let x = 1; x < 151; x++) {
    const p = g.players.at(x);
    if (!p.isEmpty) p.setU8(26, p.u8(26) + 1);
  }
  const neuBelegen = (p: ReturnType<typeof g.players.at>) => {
    // Reihenfolge der Würfel wie bei 0x0D5BE: erst das Alter, dann der Grundwert
    p.setU8(26, rng(18, 25));
    const jj = rng(30, 92);
    p.setU8(28, rng(jj - 5, jj + 5));
    p.setU8(32, rng(0, 6));
    p.setU8(29, rng(jj - 5, jj + 5));
  };
  const fundort = (x: number): { manager: number; place: number } | undefined => {
    for (let mi = 0; mi < 5; mi++) {
      const n = mi === 4 ? 12 : 25;
      const basis = mi === 4 ? 100 : mi * 25;
      for (let place = 0; place < n; place++) {
        const l = g.lineups.at(basis + place);
        if (!l.isEmpty && l.playerIndex === x) return { manager: mi, place };
      }
    }
    return undefined;
  };
  managers.forEach((_, i) => {
    for (let x = 1; x < 151; x++) {
      const p = g.players.at(x);
      if (p.isEmpty) continue;
      const wo = fundort(x);
      if (wo && wo.manager !== i) continue;
      const grenze = rng(32, 34);
      if (!wo) {
        if (p.u8(26) > grenze) neuBelegen(p);
        continue;
      }
      const l = g.lineups.at(i * 25 + wo.place);
      if (l.u8(11) !== 0 || !(l.u8(24) & 0x80)) continue;
      const name = p.displayName;
      const alter = p.u8(26);
      removeFromSquad(g, i, wo.place);
      neuBelegen(p);
      // Wortlaut und Zeilenschnitt des Originals (Meldungsvorlage 3 bei 0x4E0AE, GitLab #58):
      // "<Name> hängt den / Fußballjob im Alter von / <Alter> Jahren an den Nagel."
      const nagel = texte("ui.karriereende");
      events.push({ manager: i, text: `${name} ${nagel[0]} ${nagel[1]} ${alter} ${nagel[2]}`, meldung: [`${name} ${nagel[0]}`, nagel[1], `${alter} ${nagel[2]}`] });
    }
  });

  // Abgänge (0x0DB40): Vertrag abgelaufen -> Verhandlung, ohne Einigung geht der Spieler und
  // bringt den halben Marktwert als Ablöse. In der Version 2026 ist er stattdessen ablösefrei:
  // der Verein bekommt nichts, dafür können alle Manager um ihn bieten (sim/abloesefrei.ts).
  //
  // `verlaengerung` schiebt die Verhandlung auf: der Spieler bleibt mit 0 Vertragsjahren im
  // Kader, und der Aufrufer (Server) führt den Dialog des Originals im nächsten Zug. Das
  // Original hält den Saisonwechsel dafür an; im Mehrspielerbetrieb geht das nicht.
  managers.forEach((_, i) => {
    for (let place = 0; place < 25; place++) {
      const l = g.lineups.at(i * 25 + place);
      if (l.isEmpty || l.u8(11) !== 0) continue;
      const name = g.players.at(l.playerIndex).displayName;
      if (verlaengerung) {
        events.push({ manager: i, text: name, vertrag: { playerIndex: l.playerIndex, name } });
        continue;
      }
      events.push(releaseExpiring(g, i, place));
      place--; // aufgeschobener Kader: derselbe Platz, nächster Spieler
    }
  });
  return events;
}
