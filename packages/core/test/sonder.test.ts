import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, sponsorSubsidy, acceptSubsidy, christmasPresents } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Sponsor-Zuschuss (0x0272D): 1/7 Angebot, random(20,65) % des Preises auf 10.000 DM abgerundet", () => {
  const seq = (vals: number[]) => { let i = 0; return () => vals[i++]; };
  assert.equal(sponsorSubsidy(1234567, seq([1])), 0);
  assert.equal(sponsorSubsidy(1234567, seq([0, 20])), 240000); // 12345·20 = 246900 -> 240000
  assert.equal(sponsorSubsidy(1234567, seq([0, 65])), 800000); // 12345·65 = 802425 -> 800000
  const rng = mulberryRng(11);
  let offers = 0;
  for (let i = 0; i < 7000; i++) if (sponsorSubsidy(500000, rng) > 0) offers++;
  assert.ok(offers > 800 && offers < 1200, `Angebote ${offers}`);
  const g = load("TEST4.MAN");
  const before = g.managers.at(0).i32(496);
  acceptSubsidy(g, 0, 240000);
  assert.equal(g.managers.at(0).i32(496), before + 240000);
});

test("Weihnachten (0x1CF86): Gruß mit 1/4, Pakete mit 1/2, Kosten Grundbetrag/(Liga+1)", () => {
  const g = load("TEST4.MAN");
  const seq = (vals: number[]) => { let i = 0; return () => vals[i++]; };
  assert.equal(christmasPresents(g, seq([1])), null);
  const greeting = christmasPresents(g, seq([0, 0]));
  assert.deepEqual(greeting, { base: 0, amounts: [0, 0, 0] });
  const before = g.activeManagers().map((m) => m.i32(496));
  const x = christmasPresents(g, seq([0, 1, 30]));
  assert.ok(x && x.base === 300000);
  // Ligen 0, 1, 1: 300000, 150000, 150000
  assert.deepEqual(x!.amounts, [300000, 150000, 150000]);
  g.activeManagers().forEach((m, i) => assert.equal(m.i32(496), before[i] - x!.amounts[i]));
});
