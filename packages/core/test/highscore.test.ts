import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, placementPoints, highscoreEntry, decodeHighscore, encodeHighscore, insertHighscore, highscoreFile } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Highscore: Datei HIGH.02 lesen und byteidentisch zurückschreiben, Einordnung nach Punkten", () => {
  const file = join(BMP_DIR, "HIGH.02");
  if (existsSync(file)) {
    const data = new Uint8Array(readFileSync(file));
    const list = decodeHighscore(data);
    assert.equal(list.length, 3);
    assert.deepEqual(list.map((e) => [e.name, e.points]), [["NORMI", 230], ["BLACKY", 135], ["LARS", 104]]);
    // Das Original lässt Restbytes hinter den Namensenden stehen; die Felder bleiben gleich
    assert.deepEqual(decodeHighscore(encodeHighscore(list)), list);
    for (let i = 0; i < 3; i++) assert.deepEqual(Array.from(encodeHighscore(list).slice(58 * i + 49, 58 * i + 54)), Array.from(data.slice(58 * i + 49, 58 * i + 54)));
  }
  let list = insertHighscore([], { name: "A", club: "X", titles: [0, 0, 0], points: 100 });
  list = insertHighscore(list, { name: "B", club: "Y", titles: [1, 0, 0], points: 200 });
  list = insertHighscore(list, { name: "A", club: "X", titles: [0, 0, 0], points: 150 });
  assert.deepEqual(list.map((e) => [e.name, e.points]), [["B", 200], ["A", 150]]);
  for (let i = 0; i < 25; i++) list = insertHighscore(list, { name: "M" + i, club: "C", titles: [0, 0, 0], points: 10 + i });
  assert.equal(list.length, 20);
  assert.equal(list[0].points, 200);
  assert.ok(list.every((e, i) => i === 0 || list[i - 1].points >= e.points));
  assert.equal(highscoreFile(1993), "HIGH.00");
  assert.equal(highscoreFile(1995), "HIGH.01");
  assert.equal(highscoreFile(1997), "HIGH.02");
});

test("Highscore: Platzierungspunkte und Eintrag aus TEST4", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const pos = g.standings.at(m.clubIndex).u8(46);
  const p = placementPoints(g, 0);
  // Bundesliga: (57 - Platz)/2, dazu Pokalrunden, mal 10 (keine Vorsaisons im Verlauf)
  let expect = Math.trunc((57 - pos) / 2);
  for (let cup = 0; cup < 4; cup++) {
    const r = m.u8(306 + cup);
    if (r !== 0 && r < 7) expect += 2 * r;
  }
  let seasons = 0;
  for (let i = 0; i < 50 && m.u8(62 + 4 * i) !== 0; i++) {
    seasons++;
    const lg = m.u8(64 + 4 * i);
    expect += (58 - m.u8(62 + 4 * i)) >> 1;
    expect += lg & 0x80 ? 20 : 2 * (lg & 7);
    if (lg & 0xf8) expect += m.u8(65 + 4 * i) & 0x80 ? 25 : 3 * (m.u8(65 + 4 * i) & 7);
  }
  if (seasons > 0) expect = Math.trunc(expect / (seasons + 1));
  assert.equal(p, expect * 10);
  const e = highscoreEntry(g, 0);
  assert.equal(e.name, m.name);
  assert.ok(e.points >= 1 && e.points < 65536);
  // Ohne den Zuschlag von 300 frisst der Abzug von 500 alles auf und jeder landet bei 1 Punkt
  assert.ok(e.points > 1, `ohne Zuschlag bleibt nur ${e.points}`);
  assert.equal(highscoreEntry(g, 0, false).points, 1);
});

test("Highscore: P4 ergibt für NORMI genau die 232 aus HIGH.02 (GitLab #61)", () => {
  const datei = join(BMP_DIR, "P4.MAN");
  if (!existsSync(datei)) return;
  const g = load("P4.MAN");
  assert.equal(highscoreEntry(g, 0).points, 232);
});
