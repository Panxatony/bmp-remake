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
import { addToSquad as aufnehmen } from "./newgame.ts";
import { TABLES } from "../records.ts";
import { sortIntoSquad } from "./lineup.ts";
import { leagueScorers } from "./display.ts";

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

/**
 * Torschützenkönig aus dem eigenen Verein? Das Original fragt die Torschützenliste der eigenen
 * Liga (0x16515 mit Argument 1): Platz 1 - mindestens zwei Tore, bei Gleichstand weniger
 * Spiele vorn - muss für den Verein des Managers spielen (0x16A1B).
 */
function hasTopScorer(g: GameState, manager: number): boolean {
  const club = g.managers.at(manager).clubIndex;
  const league = club < 18 ? 0 : club < 38 ? 1 : 2;
  return leagueScorers(g, league, 1)[0]?.club === club;
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

/**
 * Aufnahme für die Jugendarbeit der Version 2026 (sim/jugend.ts): Rückennummer ab 12, Frische
 * 100, Trainingsfaktor 50, Vertrag über zwei bis drei Jahre und die Hälfte der Gehaltsbasis.
 * Der Jugendspieler des Originals am Saisonende läuft über `jugendInKader` (0x224A8).
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
  // Halber Marktwert, auf volle Tausend abgerundet (0x0DCB7..0x0DCC4)
  const fee = frei ? 0 : div(div(value, 2), 1000) * 1000;
  const daten = { playerIndex: l.playerIndex, name, position: p.position, age: p.age, strength: l.strength.slice(), salary: l.i32(40), value, from: manager };
  removeFromSquad(g, manager, place);
  if (fee > 0) addBalance(g, manager, fee);
  if (frei) return { manager, text: `${name} ist ablösefrei und verlässt Sie. Sie bekommen keine Ablöse.`, free: daten };
  return { manager, text: `${name} ${texte("ui.vertragsende").slice(0, 2).join(" ")} ${texte("ui.abloese")[1]} ${fee} DM.` };
}

/** Wo steht Spieler x? Managerkader 0..3 (25 Plätze) oder Transfermarkt (4, 12 Plätze). */
function fundort(g: GameState, x: number): { manager: number; place: number } | undefined {
  for (let mi = 0; mi < 5; mi++) {
    const n = mi === 4 ? 12 : 25;
    const basis = mi === 4 ? 100 : mi * 25;
    for (let place = 0; place < n; place++) {
      const l = g.lineups.at(basis + place);
      if (!l.isEmpty && l.playerIndex === x) return { manager: mi, place };
    }
  }
  return undefined;
}

/**
 * Jugendspieler aufnehmen wie das Original: Aufnahmeroutine 0x224A8 (Frische random(80,120),
 * Trainingsfaktor 0x2277A, keine Rückennummer, Gehaltsbasis), danach setzt 0x0D0A6 das Gehalt
 * auf die Hälfte und den Vertrag auf random(2,3) Jahre.
 */
function jugendInKader(g: GameState, manager: number, idx: number, rng: Rng): number {
  const place = aufnehmen(g, manager, idx, 0, rng);
  if (place < 0) return -1;
  const l = g.lineups.at(manager * 25 + place);
  const salary = div(playerValue(g, manager, place, 1, rng) * 50, 100);
  for (let i = 0; i < 4; i++) l.setU8(40 + i, (salary >>> (8 * i)) & 0xff);
  l.setU8(11, rng(2, 3));
  return place;
}

/**
 * Jahrgangswechsel (0x0D288 bis 0x0D472), einmal beim ersten Manager: alle 150 Spieler ein
 * Jahr älter; wer auf einem Kader- oder Marktplatz steht, verliert die Angebotsmarken (Byte 9
 * Bits 6/7) und ein Vertragsjahr. Gehört er nicht dem, bei dem er steht (Spielerbyte 33) - ein
 * Leihspieler oder ein eigener Spieler auf der Transferliste -, geht er zurück: zu einem
 * Manager über die Aufnahme 0x224A8, deren Platz dann den ganzen alten Kaderplatz bekommt
 * (0x0D35D), ohne Leihmarke (Byte 12) und Vertragsgespräch (Byte 24); gehörte er niemandem
 * (Markt), ist er frei (Byte 33 = 5). Der alte Platz wird aufgeschoben (0x1FDBE).
 * Im Modus "Spiele automatisch" (4cb3:05D4) würfelt das Original stattdessen das Alter neu -
 * den Modus gibt es hier nicht.
 */
function jahrgangswechsel(g: GameState, rng: Rng): void {
  const plain = g.save.plain;
  for (let x = 1; x < 151; x++) {
    const p = g.players.at(x);
    p.setU8(26, (p.u8(26) + 1) & 0xff);
    const wo = fundort(g, x);
    if (!wo) continue;
    const basis = wo.manager === 4 ? 100 : wo.manager * 25;
    const l = g.lineups.at(basis + wo.place);
    l.setU8(9, l.u8(9) & 0x3f);
    // Ohne Prüfung (0x0D46E: decb): Marktspieler mit 0 Jahren stehen danach auf 255, wie im
    // Original (KP-SAISON, #100)
    l.setU8(11, (l.u8(11) - 1) & 0xff);
    const besitzer = p.u8(33);
    if (besitzer === wo.manager) continue;
    const alt = plain.slice(TABLES.lineups.offset + (basis + wo.place) * 52, TABLES.lineups.offset + (basis + wo.place + 1) * 52);
    removePlace(g, basis, wo.place, wo.manager === 4 ? 12 : 25);
    if (besitzer < 4) {
      const neu = aufnehmen(g, besitzer, x, 1, rng);
      if (neu >= 0) {
        const o = TABLES.lineups.offset + (besitzer * 25 + neu) * 52;
        plain.set(alt, o);
        plain[o + 24] = 0;
        plain[o + 12] = 0;
        p.setU8(33, besitzer);
        continue;
      }
    }
    p.setU8(33, 5);
  }
}

/**
 * Saisonende-Ereignisse aller Manager (0x0CB62); flags je Manager: 1 Aufstieg, 2 Abstieg,
 * 4 Lizenz, 8 Neustart. Die Reihenfolge ist die des Originals: je Manager Prämien, Jugend und
 * Karriereende; **beim ersten Manager** zwischen Jugend und Karriereende einmal für alle
 * 150 Spieler Alter, Vertragsjahr und die Rückkehr verliehener und gelisteter Spieler
 * (0x0D288 bis 0x0D472). Der Jugendspieler des ersten Managers altert und verliert also
 * gleich ein Vertragsjahr, die der anderen nicht. Danach die Saisonwerte der Kader
 * (0x0D9A6) und die Vertragsenden (0x0DB40).
 */
export function seasonEvents(g: GameState, flags: number[], rng: Rng, verlaengerung = false): SeasonEvent[] {
  const events: SeasonEvent[] = [];
  const managers = g.activeManagers();
  const neuBelegen = (p: ReturnType<typeof g.players.at>) => {
    // Reihenfolge der Würfel wie bei 0x0D5BE: erst das Alter, dann der Grundwert
    p.setU8(26, rng(18, 25));
    const jj = rng(30, 92);
    p.setU8(28, rng(jj - 5, jj + 5));
    p.setU8(32, rng(0, 6));
    p.setU8(29, rng(jj - 5, jj + 5));
  };
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
    // Jugend (0x0CE84): J = Konto/12, Konto auf zwei Drittel; bei J > 30, 1/3 Chance und unter
    // 23 Spielern ein Jugendspieler mit J/2
    let j = div(m.u8(482) | (m.u8(483) << 8), 12);
    j = j + div(j, -3);
    const account = j * 12;
    m.setU8(482, account & 0xff);
    m.setU8(483, (account >> 8) & 0xff);
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
        // Byte 36 bekommt zuerst den Managerindex (0x0D05D), erst die Aufnahme setzt den Verein
        // und löscht dabei die alten Saisonwerte des Datensatzes (0x22750) - der Positionswert
        // (Byte 31) des früheren Spielers bleibt stehen
        p.setU8(36, i);
        const place = jugendInKader(g, i, idx, rng);
        p.setU8(33, i);
        if (place >= 0) events.push({ manager: i, text: `${T("ui.jugendaufstieg").slice(0, -1)}: ${p.displayName}.` });
      }
    }
    // Aprilscherz (0x0D161): bei gleichen Kennungen 4cb3:224E/2252 - im Original stets -
    // random(0,4), bei 0 nur ein Text (nicht portiert). Der Wurf zählt (#99).
    rng(0, 4);
    if (i === 0) jahrgangswechsel(g, rng);

    // Karriereende (0x0D475 bis 0x0D65B): eine Schleife über alle 150 Spieler je Manager.
    // * Kaderspieler dieses Managers hängen die Schuhe an den Nagel, wenn ihr Vertrag ausläuft
    //   (Byte 11 = 0) **und** sie ihr Karriereende angekündigt haben (Byte 24 Bit 7) - ohne
    //   Ablöse, der Datensatz wird neu belegt (0x0D511 bis 0x0D5B8).
    // * Spieler ohne Verein gehen bei Alter > random(32,34), in jedem Durchgang neu gewürfelt.
    // * Spieler anderer Manager und des Transfermarkts überspringt der Durchgang (0x0D4D4).
    for (let x = 1; x < 151; x++) {
      const p = g.players.at(x);
      if (p.isEmpty) continue;
      const wo = fundort(g, x);
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
      // Wortlaut und Zeilenschnitt des Originals (Meldungsvorlage 3 bei 0x4E0AE, GitLab #58)
      const nagel = texte("ui.karriereende");
      events.push({ manager: i, text: `${name} ${nagel[0]} ${nagel[1]} ${alter} ${nagel[2]}`, meldung: [`${name} ${nagel[0]}`, nagel[1], `${alter} ${nagel[2]}`] });
    }
  });

  // Saisonwerte der Managerkader (0x0D9A6): Karten (Byte 0..2), Tore und Einsätze der Saison
  // (3..8) auf den Plätzen 0..23. Die Karrieresummen (Wörter 28..38) bleiben - in RIED-2TE bis
  // RIED-6TE wachsen sie über jeden Saisonwechsel weiter.
  managers.forEach((_, i) => {
    for (let place = 0; place < 24; place++) {
      const l = g.lineups.at(i * 25 + place);
      for (let b = 0; b <= 8; b++) l.setU8(b, 0);
    }
  });

  // Anzeigeoptionen je Liga an die neuen Ligen der Manager anpassen (0x0DA40)
  optionenImStandAnpassen(g);

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

/**
 * Anzeigeoptionen am Saisonende (0x0DA40 bis 0x0DADE): Halbzeitstände, Ergebnisse und Tabelle je
 * Liga (3 × 3 Schalter, 4cb3:05FE + 3 · Liga + Spalte). In einer Liga ohne Manager gehen alle aus;
 * in einer Liga mit Manager geht ein Schalter an, wenn er in irgendeiner Liga an war - so sieht ein
 * Aufsteiger seine neue Liga (gegen KP-SAISON geprüft, #100).
 */
export function optionenNachLigen(schalter: boolean[], managerJeLiga: number[]): boolean[] {
  const spalte = [0, 1, 2].map((j) => [0, 1, 2].some((i) => schalter[3 * i + j]));
  const neu = schalter.slice();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (neu[3 * i + j] && managerJeLiga[i] === 0) neu[3 * i + j] = false;
      if (!neu[3 * i + j] && managerJeLiga[i] > 0 && spalte[j]) neu[3 * i + j] = true;
    }
  }
  return neu;
}

/** Dieselbe Anpassung auf den Bytes im Spielstand (4cb3:05FE, Spielstand 33447). */
export function optionenImStandAnpassen(g: GameState): void {
  const p = g.save.plain;
  const managerJeLiga = [0, 0, 0];
  for (const m of g.activeManagers()) managerJeLiga[m.u8(312)]++;
  const neu = optionenNachLigen([...Array(9).keys()].map((k) => p[33447 + k] !== 0), managerJeLiga);
  neu.forEach((v, k) => {
    if (v !== (p[33447 + k] !== 0)) p[33447 + k] = v ? 1 : 0;
  });
}
