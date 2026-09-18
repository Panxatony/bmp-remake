import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, driftInterest, loanRate, LEVEL_OFFSET } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const rates = (g: GameState) => [0, 1, 2, 3, 4, 5].map((i) => loanRate(g, i));
const fixed = (v: number) => () => v;

test("Zinstabelle (0x112AA): Leitwert 7 ergibt 7/5/3/2/2/2, Leitwert 5 nur Fünfen, Leitwert 2 steigt auf 7", () => {
  const g = load("TEST4.MAN");
  g.save.plain[LEVEL_OFFSET] = 2;
  driftInterest(g, fixed(2), 6); // random(0,2) = 2 -> +1
  assert.deepEqual(rates(g), [7, 5, 3, 2, 2, 2]);
  driftInterest(g, fixed(1)); // Leitwert 7 - 1 + 1 = 7 -> unverändert
  assert.deepEqual(rates(g), [7, 5, 3, 2, 2, 2]);
  driftInterest(g, fixed(1), 5);
  assert.deepEqual(rates(g), [5, 5, 5, 5, 5, 5]);
  driftInterest(g, fixed(0), 2); // 2 - 1 -> 2 (Untergrenze), Schritt 3, 2, 1
  assert.deepEqual(rates(g), [2, 5, 7, 7, 7, 7]);
  // hoher Level: random(0,3) + 0, nie abwärts
  g.save.plain[LEVEL_OFFSET] = 3;
  driftInterest(g, fixed(0), 4);
  assert.deepEqual(rates(g), [4, 5, 6, 7, 7, 7]);
});
