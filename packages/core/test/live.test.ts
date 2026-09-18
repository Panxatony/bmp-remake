import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, simulateMatch, LiveMatch, playMatchday } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Live-Simulation: minutenweise Schritte ergeben dieselbe Zufallsfolge wie simulateMatch", () => {
  const g = load("TEST4.MAN");
  for (let seed = 1; seed <= 20; seed++) {
    const h = g.clubs.at(seed % 18).strengthMatrix;
    const a = g.clubs.at((seed * 7) % 18).strengthMatrix;
    const batch = simulateMatch(h, a, mulberryRng(seed));
    const live = new LiveMatch(h, a, mulberryRng(seed));
    let steps = 0;
    while (!live.finished) {
      live.step();
      steps++;
    }
    assert.equal(steps, 90);
    assert.deepEqual(live.result(), batch);
  }
});

test("Spieltag mit vorgegebenen Ergebnissen: der Hook liefert die Resultate", () => {
  const g = load("TEST4.MAN");
  const pairs = g.pairings(0);
  const played = playMatchday(g, 0, mulberryRng(3), [], (home, away) => ({ home: (home + away) % 3, away: home % 2, events: [] }));
  played.forEach((p, i) => {
    assert.deepEqual([p.home, p.away], pairs[i]);
    assert.equal(p.result.home, (p.home + p.away) % 3);
  });
});
