/**
 * Spielvorbereitung 0x1C632: Einnahmen, Zuschauer, Kaderteil (GitLab #82, Kapitel 3; #89).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SaveFile, GameState, mulberryRng, bookAttendance, pokalZuschlag, afterMatch, playMatchday, playCupMatch,
  FINALE_KULISSE, FINALE_PAUSCHALE, FORFEIT_FINE, CUP_ROUND, CUP_TABLE, MARKET_SIZE,
} from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Zuschauerrekord: die gleiche Zahl löst ihn ab (TEST4 -> RUNA0: 24000 gegen Schalke)", () => {
  const g = load("TEST4.MAN");
  const after = load("RUNA0.MAN");
  bookAttendance(g, 0, 24000, 3);
  assert.equal(g.managers.at(0).i32(500), 3);
  assert.equal(g.managers.at(0).i32(500), after.managers.at(0).i32(500));
});

test("Zuschauerhistorie ohne Grenze bei 16 Heimspielen", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.setU8(314, 17);
  bookAttendance(g, 0, 18000, 3);
  assert.equal(m.u8(330 + 17), 18);
  assert.equal(m.u8(314), 18);
});

test("Pokalzuschlag nur gegen höherklassige Gäste, zwischen Kulisse/(8-3d) und Kulisse, bis zur Stadiongröße", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const kap = m.i32(350) + m.i32(358);
  // Bundesligist gegen Bundesligist: kein Zuschlag
  m.setU8(312, 0);
  assert.equal(pokalZuschlag(g, 0, 3, 10000, mulberryRng(1)), 10000);
  // Zweitligist (d = 1) gegen Bundesligist: + random(2000, 10000)
  m.setU8(312, 1);
  for (let s = 1; s <= 30; s++) {
    const z = pokalZuschlag(g, 0, 3, 10000, mulberryRng(s));
    assert.ok(z >= Math.min(12000, kap) && z <= Math.min(20000, kap), `Zuschlag ${z}`);
  }
  // Oberligist (d = 2): + random(Kulisse/2, Kulisse), gedeckelt
  m.setU8(312, 2);
  for (let s = 1; s <= 30; s++) assert.ok(pokalZuschlag(g, 0, 3, kap, mulberryRng(s)) === kap);
});

test("Kaderteil: Europapokal zählt Einsätze in Byte 8 und Wort 32, Liga und Pokal wie bisher", () => {
  const g = load("TEST4.MAN");
  const starter = g.squadOf(0).find((l) => l.number >= 1 && l.number <= 11)!;
  const vorher = [starter.u8(6), starter.u8(7), starter.u8(8), starter.u8(32) | (starter.u8(33) << 8)];
  afterMatch(g, 0, 2, mulberryRng(3));
  assert.equal(starter.u8(8), vorher[2] + 1);
  assert.equal(starter.u8(32) | (starter.u8(33) << 8), vorher[3] + 1);
  assert.deepEqual([starter.u8(6), starter.u8(7)], [vorher[0], vorher[1]]);
});

test("Kaderteil Liga: eigene gesperrte Spieler auf dem Markt zählen die Sperre herunter", () => {
  const g = load("TEST4.MAN");
  // Einen belegten Marktplatz dem Manager 0 zuschlagen und sperren
  let slot = -1;
  for (let k = 0; k < MARKET_SIZE; k++) if (!g.lineups.at(100 + k).isEmpty) slot = k;
  assert.ok(slot >= 0);
  const l = g.lineups.at(100 + slot);
  g.players.at(l.playerIndex).setU8(33, 0);
  l.setU8(9, l.u8(9) | 1);
  l.setU8(13, 2);
  afterMatch(g, 0, 1, mulberryRng(1));
  assert.equal(l.u8(13), 2, "im Pokal nicht");
  afterMatch(g, 0, 0, mulberryRng(1));
  assert.equal(l.u8(13), 1);
  // Spieler eines anderen Managers bleiben unberührt
  g.players.at(l.playerIndex).setU8(33, 1);
  afterMatch(g, 0, 0, mulberryRng(1));
  assert.equal(l.u8(13), 1);
});

test("0:2-Wertung: wer zu wenige Spieler hat, bekommt weder Einnahmen noch Kaderteil", () => {
  const g = load("TEST4.MAN");
  const club = g.managers.at(0).clubIndex;
  const liga = club < 18 ? 0 : 1;
  const m = g.managers.at(0);
  const vorher = { konto: m.balance, spiele: m.u8(314), einsaetze: g.squadOf(0).map((l) => l.u8(6)) };
  const gespielt = playMatchday(g, liga, mulberryRng(4), [], undefined, undefined, { forfeit: (mi) => mi === 0, incidents: () => [] });
  const eigenes = gespielt.find((p) => p.home === club || p.away === club)!;
  assert.equal(eigenes.forfeit, 0);
  assert.equal(m.balance, vorher.konto - FORFEIT_FINE, "nur die Strafe");
  assert.equal(m.u8(314), vorher.spiele, "keine Zuschauerbuchung");
  assert.deepEqual(g.squadOf(0).map((l) => l.u8(6)), vorher.einsaetze, "keine Einsätze");
});

test("DFB-Pokalfinale: 76000 Zuschauer und 532000 DM für jeden beteiligten Manager", () => {
  const g = load("TEST4.MAN");
  const p = g.save.plain;
  const [a, b] = [g.managers.at(0).clubIndex, g.managers.at(1).clubIndex];
  p[CUP_ROUND] = 5;
  p[CUP_TABLE] = a;
  p[CUP_TABLE + 1] = b;
  const konto = [g.managers.at(0).balance, g.managers.at(1).balance];
  const spiele = g.managers.at(0).u8(314);
  const m = playCupMatch(g, 0, 0, false, 300, mulberryRng(7));
  assert.equal(m.attendance, FINALE_KULISSE);
  assert.equal(m.gate, FINALE_PAUSCHALE);
  assert.equal(g.managers.at(1).balance, konto[1] + FINALE_PAUSCHALE);
  // Heimmanager: Pauschale; Randale ändert den Kontostand hier nicht
  assert.equal(g.managers.at(0).balance, konto[0] + FINALE_PAUSCHALE);
  assert.equal(g.managers.at(0).u8(314), spiele, "keine Zuschauerhistorie im Pokal");
});
