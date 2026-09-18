import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, poolTargets, seasonPlayerPool, distributePlayers, pickPoolClub } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

const LO = [0, 18, 38, 58];
const HI = [17, 37, 57, 255];
const perLeague = (g: GameState): number[] => {
  const n = [0, 0, 0, 0];
  for (let i = 1; i < 151; i++) {
    const c = g.players.at(i).u8(36);
    for (let l = 0; l < 4; l++) if (c >= LO[l] && c <= HI[l]) n[l]++;
  }
  return n;
};

test("Sollzahlen je Liga (0x161D8): TEST4 mit Kadern 15/13/13 in den Ligen 0/1/1 ergibt 37/69/0", () => {
  const g = load("TEST4.MAN");
  assert.deepEqual(g.activeManagers().map((m) => m.u8(312)), [0, 1, 1]);
  assert.deepEqual(perLeague(g), [37, 61, 43, 9]);
  assert.deepEqual(g.activeManagers().map((_, i) => g.squadOf(i).length), [15, 12, 15]);
  const targets = poolTargets(g, mulberryRng(1));
  // X = 42, (1500/42 = 35)·108/100 = 37, (2700/42 = 64)·108/100 = 69
  assert.deepEqual(targets, [37, 69, 0]);
  for (let i = 1; i < 151; i++) {
    const p = g.players.at(i);
    assert.ok(p.u8(28) >= 30 && p.u8(28) <= 99 && p.u8(29) >= 30 && p.u8(29) <= 99);
  }
});

test("Saisonende (0x0F2A6): Managerspieler behalten ihren Verein, Ligen mit Managern füllen sich auf", () => {
  const g = load("TEST4.MAN");
  const owned = new Map<number, number>();
  for (let i = 1; i < 151; i++) {
    const p = g.players.at(i);
    if (p.u8(33) <= 3) owned.set(i, p.u8(36));
  }
  seasonPlayerPool(g, mulberryRng(5));
  for (const [i, c] of owned) assert.equal(g.players.at(i).u8(36), c, `Spieler ${i}`);
  const n = perLeague(g);
  assert.equal(n.reduce((a, b) => a + b, 0), 150);
  // Oberliga (ohne Manager) gibt Spieler an die 2. Liga ab
  assert.ok(n[1] >= 65 && n[2] < 43, `Ligen ${n}`);
  for (let i = 1; i < 151; i++) {
    const c = g.players.at(i).u8(36);
    assert.ok(c < 64 || c === 0xff, `Verein ${c}`);
  }
});

test("Zielverein (0x0F4D7): nahe der Ligabasis, nie ein Managerverein", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(3);
  const managers = new Set(g.activeManagers().map((m) => m.clubIndex));
  for (let k = 0; k < 500; k++) {
    for (let l = 0; l < 3; l++) {
      const c = pickPoolClub(g, l, rng);
      assert.ok(c >= LO[l] && c <= LO[l] + 12, `Liga ${l}: ${c}`);
      assert.ok(!managers.has(c));
    }
  }
});

test("Spielbeginn (0x1643B): Spieler ohne Verein bekommen Vereine der Managerligen", () => {
  const g = load("TEST4.MAN");
  const free: number[] = [];
  for (let i = 1; i < 151; i++) {
    const p = g.players.at(i);
    if (p.u8(33) > 3 && i % 3 === 0) {
      p.setU8(36, 0xff);
      free.push(i);
    }
  }
  distributePlayers(g, false, mulberryRng(7));
  // einzelne freie Spieler wechseln schon in 0x161D8 zu einem Verein passender Stärke (0..63)
  let inManagerLeagues = 0;
  for (const i of free) {
    const c = g.players.at(i).u8(36);
    assert.ok(c < 64, `Spieler ${i}: Verein ${c}`);
    if (c < 38) inManagerLeagues++;
  }
  assert.ok(inManagerLeagues >= free.length * 0.8, `${inManagerLeagues} von ${free.length}`);
});
