import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, aiMask, isAi, setAi, aiList, AI_OFFSET } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Aufhören: Spielstände des Originals kennen keinen Rechnerverein, die Marke überlebt das Speichern", () => {
  const g = load("RIED-CLI.MAN");
  assert.equal(aiMask(g), 0);
  assert.deepEqual(aiList(g), []);
  assert.equal(isAi(g, 0), false);
  setAi(g, 1, true);
  assert.equal(isAi(g, 1), true);
  assert.equal(isAi(g, 0), false);
  assert.deepEqual(aiList(g), [1]);
  assert.equal(g.save.plain[AI_OFFSET], 2);
  setAi(g, 2, true);
  assert.deepEqual(aiList(g), [1, 2]);
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.deepEqual(aiList(wieder), [1, 2]);
  // Wieder übernehmen
  setAi(wieder, 1, false);
  assert.deepEqual(aiList(wieder), [2]);
  setAi(wieder, 2, false);
  assert.equal(aiMask(wieder), 0);
});
