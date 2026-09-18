import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, contractCheck, contractRefusalAnnouncements, contractOffers, salaryDemand, playerValue, LEAGUES } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const mid = (lo: number, hi: number) => Math.trunc((lo + hi) / 2);

test("Vertragsverhandlung (0x249E0): gleiche Laufzeit nach Gehalt, kürzere Laufzeit 105/120 %, sonst Schwelle unter der Forderung", () => {
  const g = load("TEST4.MAN");
  const l = g.lineups.at(0);
  const years = l.u8(11);
  const cur = l.i32(40);
  assert.ok(years >= 1 && cur > 0);
  assert.equal(contractCheck(g, 0, 0, years, cur + 1, mid), true);
  assert.equal(contractCheck(g, 0, 0, years, cur - 1, mid), false);
  if (years > 1) {
    assert.equal(contractCheck(g, 0, 0, years - 1, Math.trunc(cur * 1.2) + 1, mid), true);
    assert.equal(contractCheck(g, 0, 0, years - 1, Math.trunc(cur * 1.05), mid), false);
  }
  // Längere Laufzeit: die Forderung (0x25C27, +122) liegt über der Annahmeschwelle (+110)
  const longer = years + 1;
  const demand = salaryDemand(g, 0, 0, longer);
  assert.equal(contractCheck(g, 0, 0, longer, demand, mid), true);
  // Schwellenband: v·(q-6)/100 .. v·(q+4)/100
  const league = g.managers.at(0).u8(312);
  const prog = Math.trunc((g.nextMatchday(league) * -100) / LEAGUES[league].matchdays) + 100;
  // Schiebehilfe 0x3BBC8 schiebt nach links (·8), nicht nach rechts
  const q = Math.trunc(((Math.trunc(((longer - 1) * 100 + prog) / 6) + 110) << 3) / 10);
  const v = playerValue(g, 0, 0, 5);
  const lo = Math.trunc((v * (Math.trunc(q) - 6)) / 100);
  const hi = Math.trunc((v * (Math.trunc(q) + 4)) / 100);
  assert.ok(hi < demand, `Schwelle ${hi} unter Forderung ${demand}`);
  const rng = mulberryRng(21);
  let accepted = 0;
  for (let i = 0; i < 200; i++) if (contractCheck(g, 0, 0, longer, Math.max(1, Math.trunc((lo + hi) / 2)), rng)) accepted++;
  assert.ok(accepted > 0 && accepted < 200, `angenommen ${accepted}`);
  for (let i = 0; i < 50; i++) assert.equal(contractCheck(g, 0, 0, longer, lo, rng), false);
  for (let i = 0; i < 50; i++) assert.equal(contractCheck(g, 0, 0, longer, hi + 1, rng), true);
  assert.equal(contractCheck(g, 0, 0, longer, 200000, mid), true);
});

test("Absage: im letzten Vertragsjahr kündigt der Spieler an, nicht zu verlängern (0x0E9C1)", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 3);
  const p = g.players.at(l.playerIndex);
  l.setU8(11, 1); // letztes Vertragsjahr
  l.setU8(24, 0);
  p.setU8(26, 34); // alt: |25 - 34| = 9 -> gedeckelt 8 -> A = 0, also kleine Schwelle
  // Immer der kleinste Wurf: die Absage kommt sofort
  const ereignisse = contractRefusalAnnouncements(g, 0, (lo: number) => lo);
  assert.equal(ereignisse.length >= 1, true, "Absage kommt");
  const a = ereignisse.find((x) => x.place === 3)!;
  assert.equal(a.zeilen.length, 3);
  assert.match(a.zeilen[0], /k\}ndigt an,$/);
  assert.ok(l.u8(24) >= 100 && l.u8(24) <= 104, "Byte 24 trägt die Absage");
  // Danach macht der Spieler kein Vertragsangebot mehr (Byte 24 >= 100)
  assert.equal(contractOffers(g, 0, (lo: number) => lo).some((o) => o.place === 3), false);
  // Und die Absage kommt nur einmal
  assert.equal(contractRefusalAnnouncements(g, 0, (lo: number) => lo).some((x) => x.place === 3), false);
});

test("Absage: nur im letzten Vertragsjahr", () => {
  const g = load("RIED-CLI.MAN");
  const l = g.lineups.at(0 * 25 + 4);
  l.setU8(11, 2);
  l.setU8(24, 0);
  assert.equal(contractRefusalAnnouncements(g, 0, (lo: number) => lo).some((x) => x.place === 4), false);
});
