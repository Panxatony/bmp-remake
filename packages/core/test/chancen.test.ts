import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, bookChance, bookEvents, minuteIncidents, newIncidentState } from "../src/index.ts";

// Chancenbuchung nach dem Zweigbuch docs/abgleich/1B223.md (GitLab #85)
const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const bewertung = (l: { u8(o: number): number }) => ((l.u8(21) << 24) >> 24);

test("Europapokaltor zählt in Kaderbyte 5 und Karrieresumme 38 (0x1BB29)", () => {
  const g = load("TEST4.MAN");
  const kader = g.squadOf(0);
  const vorher = kader.map((l) => [l.u8(5), l.u8(38) | (l.u8(39) << 8), g.players.at(l.playerIndex).u8(34)]);
  const rec = bookChance(g, 0, true, 2, mulberryRng(3))!;
  const l = g.squadOf(0)[rec.scorer];
  assert.equal(l.u8(5), vorher[rec.scorer][0] + 1, "Saisontore Europapokal");
  assert.equal(l.u8(38) | (l.u8(39) << 8), vorher[rec.scorer][1] + 1, "Karrieresumme Europapokal");
  assert.equal(g.players.at(l.playerIndex).u8(34), vorher[rec.scorer][2], "Torjägerliste nur in der Liga");
});

test("Vorlage: +10 bei Tor und bei vergebener Chance, nicht nach einer Elfmeterszene (0x1BD03)", () => {
  for (const tor of [true, false]) {
    for (const elfmeter of [false, true]) {
      const g = load("TEST4.MAN");
      for (const l of g.squadOf(0)) l.setU8(21, 0);
      const rec = bookChance(g, 0, tor, 0, mulberryRng(7), elfmeter)!;
      const kader = g.squadOf(0);
      assert.ok(rec.assist >= 0 && rec.assist !== rec.scorer, "Vorlage gezogen");
      assert.equal(bewertung(kader[rec.scorer]), tor ? 15 : -10, "Schütze");
      assert.equal(bewertung(kader[rec.assist]), elfmeter ? 0 : 10, `Vorlage (Tor ${tor}, Elfmeter ${elfmeter})`);
    }
  }
});

test("Abwehrbewertung nur gegen einen Rechnerverein als Angreifer (0x1BDFA)", () => {
  // Manager 0 greift Manager 1 an: Manager 1 bekommt keine Abwehrbewertung
  const g = load("TEST4.MAN");
  const [a, b] = [g.activeManagers()[0].clubIndex, g.activeManagers()[1].clubIndex];
  for (const i of [0, 1]) for (const l of g.squadOf(i)) l.setU8(21, 0);
  bookEvents(g, a, b, { home: 1, away: 0, events: [{ minute: 10, side: "home", goal: true }] }, 0, mulberryRng(1));
  assert.ok(g.squadOf(1).every((l) => bewertung(l) === 0), "Verteidiger im Managerduell unverändert");
  // Ein Rechnerverein greift Manager 1 an: jetzt bewertet das Original die Abwehr
  const rechner = [...Array(58).keys()].find((c) => !g.activeManagers().some((m) => m.clubIndex === c))!;
  bookEvents(g, rechner, b, { home: 1, away: 0, events: [{ minute: 20, side: "home", goal: true }] }, 0, mulberryRng(2));
  assert.ok(g.squadOf(1).some((l) => l.number >= 1 && l.number <= 11 && bewertung(l) < 0), "Gegentor gegen den Rechner kostet");
});

test("Gelb kostet 10 Bewertungspunkte (0x1C1AC)", () => {
  const g = load("TEST4.MAN");
  g.managers.at(0).setU8(317, 40);
  for (const l of g.squadOf(0)) l.setU8(21, 0);
  const st = newIncidentState();
  st.redUsed = true; // nur Gelb zulassen
  let gelb;
  for (let m = 1; m <= 90 && !gelb; m++) gelb = minuteIncidents(g, 0, m, st, mulberryRng(m)).find((i) => i.kind === "yellow");
  assert.ok(gelb, "eine Gelbe fällt");
  const l = g.squadOf(0)[gelb!.place];
  assert.equal(bewertung(l), -10);
});
