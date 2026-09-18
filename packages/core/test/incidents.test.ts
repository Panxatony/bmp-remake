import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, matchIncidents, pickStarter, fitStarters, isForfeit, playMatchday, FORFEIT_FINE } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Spielereignisse: Spielerwahl nur Starter, Karten und Verletzungen in plausibler Häufigkeit, Sperren gebucht", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(3);
  for (let i = 0; i < 50; i++) {
    const p = pickStarter(g, 0, rng);
    const l = g.squadOf(0)[p];
    assert.ok(l.number >= 1 && l.number <= 11);
  }
  let yellow = 0, red = 0, injury = 0;
  const N = 200;
  for (let n = 0; n < N; n++) {
    const h = load("TEST4.MAN");
    for (const inc of matchIncidents(h, 0, mulberryRng(100 + n))) {
      if (inc.kind === "yellow") yellow++;
      else if (inc.kind === "injury") injury++;
      else {
        red++;
        const l = h.squadOf(0)[inc.place];
        assert.equal(l.number, 0);
        assert.equal(l.u8(9) & 1, 1);
        assert.ok(l.u8(13) >= 1 && l.u8(13) <= 7);
      }
    }
  }
  // je Spiel etwa 1 Gelbe (1/(5L+2x+38) je Minute), Rote und Verletzungen deutlich seltener
  assert.ok(yellow / N > 0.3 && yellow / N < 3, `Gelbe je Spiel ${yellow / N}`);
  assert.ok(red / N < 0.5, `Rote je Spiel ${red / N}`);
  assert.ok(injury / N < 0.6, `Verletzungen je Spiel ${injury / N}`);
  assert.ok(red > 0 && injury > 0);
});

test("0:2-Wertung bei weniger als acht einsatzfähigen Startern", () => {
  const g = load("TEST4.MAN");
  assert.equal(isForfeit(g, 0), false);
  const squad = g.squadOf(0);
  // vier Starter sperren
  let n = 0;
  for (const l of squad) if (l.number >= 1 && l.number <= 11 && n < 4) { l.setU8(9, l.u8(9) | 1); l.setU8(13, 2); n++; }
  assert.equal(fitStarters(g, 0), 7);
  assert.ok(isForfeit(g, 0));
  const m = g.managers.at(0);
  const bal = m.balance;
  const played = playMatchday(g, 0, mulberryRng(5));
  const mine = played.find((p) => p.home === m.clubIndex || p.away === m.clubIndex)!;
  assert.equal(mine.forfeit, 0);
  const own = mine.home === m.clubIndex ? mine.result.home : mine.result.away;
  const other = mine.home === m.clubIndex ? mine.result.away : mine.result.home;
  assert.deepEqual([own, other], [0, 2]);
  assert.equal(m.balance, bal - FORFEIT_FINE + (mine.gate ?? 0));
});
