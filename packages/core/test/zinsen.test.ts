/**
 * Kreditzinsen in der täglichen Finanzroutine 0x11D0D (GitLab #82, Kapitel 10; #98).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, dailyFinance } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Kreditzinsen: im kürzeren Monat zusätzlich am Monatsletzten (0x12151)", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  // Alle Kredite weg, dann einer bei der Bank (Geldgeber 4, Platz 0): 100.000 DM, 1.000 DM Zins,
  // Termin am 15., Rückzahlung im Juli 2099
  for (let i = 508; i < 508 + 15 * 18; i++) m.setU8(i, 0);
  const o = 508 + (4 * 3 + 0) * 18;
  const w32 = (off: number, v: number) => { for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff); };
  w32(o, 100000);
  w32(o + 4, 1000);
  m.setU8(o + 9, 15);
  m.setU8(o + 11, 6);
  m.setU8(o + 16, 2099 & 0xff);
  m.setU8(o + 17, 2099 >> 8);
  const zinsen = (day: number, month0: number) =>
    dailyFinance(g, 0, { day, month0, year: 1997 }, mulberryRng(1), undefined, false).filter((e) => e.kind === "interest").length;
  assert.equal(zinsen(15, 1), 1, "Februar, Termin");
  assert.equal(zinsen(28, 1), 1, "Februar, Monatsletzter: noch einmal");
  assert.equal(zinsen(15, 7), 1, "August, Termin");
  assert.equal(zinsen(31, 7), 0, "August ist so lang wie der Juli: kein zweites Mal");
  assert.equal(zinsen(30, 8), 1, "September (30 Tage): noch einmal");
});
