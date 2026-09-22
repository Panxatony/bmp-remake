import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, simulateMatch, mulberryRng, strength, postponementCount } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));

test("Stärkefunktion liefert plausible Werte", () => {
  const nbg = g.clubs.at(15).strengthMatrix;
  const s0 = strength(nbg, 1, 0);
  const s90 = strength(nbg, 1, 90);
  assert.ok(s0 > 100 && s0 < 300, `Stärke ${s0}`);
  assert.ok(s90 < s0, "Ermüdung senkt die Stärke");
});

test("Torschnitt der Simulation passt zu den 135 echten Bundesligaspielen", () => {
  let goals = 0;
  let games = 0;
  for (let c = 0; c < 18; c++) {
    const t = g.standings.at(c).total;
    goals += t.goalsFor;
    games += t.games;
  }
  const realAvg = goals / (games / 2);
  const rng = mulberryRng(12345);
  let simGoals = 0;
  let simGames = 0;
  let homeWins = 0;
  for (let round = 0; round < 40; round++) {
    for (let h = 0; h < 18; h++) {
      for (let a = 0; a < 18; a++) {
        if (h === a) continue;
        const r = simulateMatch(g.clubs.at(h).strengthMatrix, g.clubs.at(a).strengthMatrix, rng);
        simGoals += r.home + r.away;
        simGames++;
        if (r.home > r.away) homeWins++;
      }
    }
  }
  const simAvg = simGoals / simGames;
  console.log(`echt ${realAvg.toFixed(2)} Tore/Spiel, Simulation ${simAvg.toFixed(2)} Tore/Spiel, Heimsiege ${(100 * homeWins / simGames).toFixed(0)} %`);
  assert.ok(Math.abs(simAvg - realAvg) < 1.0, `Abweichung zu groß: echt ${realAvg}, sim ${simAvg}`);
});

test("Mannschaftsstärke aus der Aufstellung trifft Nürnbergs gespeicherte Matrix", async () => {
  const { teamStrength, strengthInput } = await import("../src/index.ts");
  // Der Spielstand enthält die Anzeigewerte (Flag 0): reine Durchschnitte, Technik mit Startwert 8
  for (const name of ["TEST1.MAN", "TEST2.MAN", "RIED-CLI.MAN"]) {
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
    const inp = strengthInput(g, 0);
    assert.equal(inp.starters.length, 11);
    const shown = teamStrength(inp, mulberryRng(1), false);
    const stored = g.clubs.at(g.managers.at(0).clubIndex).strengthMatrix;
    assert.deepEqual([shown.ko, shown.te, shown.fo], [stored.ko, stored.te, stored.fo], name);
    // Spielwerte weichen davon nur maßvoll ab
    const m = teamStrength(inp, mulberryRng(1), true);
    for (let l = 0; l < 3; l++) {
      assert.ok(Math.abs(m.ko[l] - stored.ko[l]) <= 25, `${name} Kondition Linie ${l}: ${m.ko[l]} vs ${stored.ko[l]}`);
      assert.ok(Math.abs(m.te[l] - stored.te[l]) <= 25, `${name} Technik Linie ${l}: ${m.te[l]} vs ${stored.te[l]}`);
      assert.equal(m.fo[l], stored.fo[l], `${name} Form Linie ${l}`);
    }
    console.log(name, "Anzeige", shown.ko, shown.te, "Spiel", m.ko, m.te, "Einsatz", inp.einsatz, "-> Moral", m.moralNeu);
  }
});

test("Verlegungen: keine außerhalb des Winters, im Winter bis zu 8", () => {
  const rng = mulberryRng(7);
  assert.equal(postponementCount(18, rng), 0);
  assert.equal(postponementCount(80, rng), 0);
  let max = 0;
  for (let i = 0; i < 2000; i++) max = Math.max(max, postponementCount(44, rng));
  assert.ok(max >= 7 && max <= 8, `max ${max}`);
  let sum = 0;
  for (let i = 0; i < 2000; i++) sum += postponementCount(32, rng);
  assert.ok(sum / 2000 > 1.5 && sum / 2000 < 3, `Mittel ${sum / 2000}`);
});
