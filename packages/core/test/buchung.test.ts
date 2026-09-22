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

test("Zuschauer 0x10BB0: mit der Spielmatrix im Vereinssatz passt die Streuung zu den Originalläufen RUNA/RUNB", async () => {
  const { attendance, matchStrength } = await import("../src/index.ts");
  const { readdirSync } = await import("node:fs");
  const t4 = load("TEST4.MAN");
  // Alle Läufe spielen denselben Spieltag ab TEST4; die Zuschauersumme von Manager 1 wächst um das Heimspiel
  const orig = [...new Set(readdirSync(BMP_DIR).filter((f) => /^RUN[AB]\d\.MAN$/.test(f)).map((f) => load(f).managers.at(1).i32(484) - t4.managers.at(1).i32(484)))].sort((a, b) => a - b);
  assert.ok(orig.length >= 8, `${orig.length} verschiedene Läufe`);
  const club = t4.managers.at(1).clubIndex;
  const [home, away] = t4.pairings(club < 18 ? 0 : 1).find(([h]) => h === club)!;
  const werte: number[] = [];
  for (let s = 1; s <= 300; s++) {
    const g = load("TEST4.MAN");
    const rng = mulberryRng(s);
    const staerkeHeim = matchStrength(g, 1, rng);
    werte.push(attendance(g, { manager: 1, home, away, level: g.save.plain[34062], staerkeHeim }, rng));
  }
  werte.sort((a, b) => a - b);
  for (const o of orig) assert.ok(o >= werte[0] && o <= werte[werte.length - 1], `${o} außerhalb ${werte[0]}..${werte[werte.length - 1]}`);
  const median = (a: number[]) => (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) / 2;
  assert.ok(Math.abs(median(werte) - median(orig)) < 300, `Median ${median(werte)} gegen ${median(orig)}`);
});

test("Zuschauer: Endspurt erst in den letzten fünf Spieltagen, Gästebonus nur mit Heimbonus (0x110EF, 0x11169)", async () => {
  const { attendance } = await import("../src/index.ts");
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.setU8(266, 12);
  const club = m.clubIndex;
  const liga = club < 18 ? 0 : 1;
  const tage = liga === 0 ? 34 : 38;
  const [home, away] = [club, g.pairings(liga).flat().find((c) => c !== club)!];
  const zu = (md: number, posH: number, posA: number) => {
    g.save.plain[28432 + liga] = md;
    g.standings.at(home).setU8(46, posH);
    g.standings.at(away).setU8(46, posA);
    return attendance(g, { manager: 0, home, away, level: 3 }, mulberryRng(9));
  };
  // Heim auf Platz 3 bekäme im Endspurt ein Viertel der Kapazität dazu
  assert.equal(zu(tage - 5, 3, 3), zu(tage - 6, 3, 3), "md + 5 = Spieltage: noch kein Endspurt");
  // Heim auf Platz 9, Gast auf 3: der Gästebonus allein greift nicht
  assert.equal(zu(tage - 3, 9, 3), zu(tage - 6, 9, 3));
});

test("Kaderteil vor dem Anpfiff: Moral bleibt, die Buchung mit Konferenz zählt nicht doppelt (#89 V10)", async () => {
  const { kaderVorbereitung } = await import("../src/index.ts");
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.setU8(317, 23);
  const starter = g.squadOf(0).filter((l) => l.number >= 1 && l.number <= 11);
  const vorher = starter.map((l) => l.u8(6));
  kaderVorbereitung(g, 0, 0, mulberryRng(2));
  assert.equal(m.u8(317), 23, "die Moral gilt im Spiel");
  assert.deepEqual(starter.map((l) => l.u8(6)), vorher.map((v) => v + 1));
  const club = m.clubIndex;
  playMatchday(g, club < 18 ? 0 : 1, mulberryRng(4), [], undefined, undefined, { forfeit: () => false, incidents: () => [], vorbereitet: true });
  assert.deepEqual(starter.map((l) => l.u8(6)), vorher.map((v) => v + 1), "kein zweiter Einsatz");
  assert.equal(m.u8(317), 0, "nach dem Spiel weg");
});
