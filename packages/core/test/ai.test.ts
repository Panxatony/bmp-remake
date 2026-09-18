import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, creditAiGoals, bookBaseBonus, driftClubs, playMatchday, leagueScorers } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("KI-Torschützen: Tore und Einsätze der KI-Spieler wachsen, Managerverein bleibt unberührt", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(9);
  const club = 0; // SV Werder Bremen (KI)
  const before = leagueScorers(g, 0, 50).filter((r) => r.club === club).reduce((a, r) => a + r.goals, 0);
  for (let i = 0; i < 20; i++) creditAiGoals(g, club, 3, rng);
  const after = leagueScorers(g, 0, 50).filter((r) => r.club === club).reduce((a, r) => a + r.goals, 0);
  assert.ok(after > before + 20, `Tore ${before} -> ${after}`);
  const mine = g.managers.at(0).clubIndex;
  const own = g.squadOf(0).map((l) => g.players.at(l.playerIndex).u8(34));
  creditAiGoals(g, mine, 5, rng);
  assert.deepEqual(g.squadOf(0).map((l) => g.players.at(l.playerIndex).u8(34)), own);
  // über einen Spieltag hinweg
  const h = load("TEST4.MAN");
  const total = () => { let t = 0, a = 0; for (let i = 1; i < 151; i++) { const p = h.players.at(i); if (p.u8(36) < 18 && p.u8(33) > 3) { t += p.u8(34); a += p.u8(35); } } return [t, a]; };
  const [t0, a0] = total();
  for (let md = 0; md < 4; md++) playMatchday(h, 0, mulberryRng(4 + md));
  const [t1, a1] = total();
  assert.ok(a1 > a0, `Einsätze ${a0} -> ${a1}`);
  assert.ok(t1 > t0, `Tore ${t0} -> ${t1}`);
});

test("Grundzuschlag 47..53 und Monatsschwankung innerhalb der Bänder", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(2);
  for (let i = 0; i < 30; i++) bookBaseBonus(g, 3, 5, rng);
  assert.equal(g.clubs.at(3).u8(23), 53);
  for (let i = 0; i < 30; i++) bookBaseBonus(g, 3, -5, rng);
  assert.equal(g.clubs.at(3).u8(23), 47);
  const before = Array.from({ length: 9 }, (_, k) => g.clubs.at(5).u8(24 + k));
  driftClubs(g, 1, rng);
  const after = Array.from({ length: 9 }, (_, k) => g.clubs.at(5).u8(24 + k));
  assert.notDeepEqual(before, after);
  for (let c = 0; c < 58; c++) for (let k = 0; k < 3; k++) {
    const fo = g.clubs.at(c).u8(30 + k);
    assert.ok(fo >= 45 && fo <= 55, `Form ${fo}`);
  }
  driftClubs(g, 10, rng);
  for (let c = 1; c < 18; c++) for (let k = 0; k < 6; k++) {
    const v = g.clubs.at(c).u8(24 + k);
    assert.ok(v >= 70 && v <= 93, `Bundesliga ${c}: ${v}`);
  }
});
