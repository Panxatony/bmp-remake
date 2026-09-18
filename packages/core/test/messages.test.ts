import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, standingsMessages, isWinterBreakDay, bookChampion, bookCupTitle, tableOrder , text } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Kalendermeldungen (0x143ED): Winterpause am 2.12., gesichert/verspielt je einmal, nach dem 13.6. nichts", () => {
  assert.equal(isWinterBreakDay({ day: 2, month0: 11 }), true);
  assert.equal(isWinterBreakDay({ day: 3, month0: 11 }), false);
  const g = load("TEST4.MAN");
  // Manager 0 (Bundesliga) am 10. Spieltag: noch nichts entschieden
  const flags = { v: 0 };
  assert.deepEqual(standingsMessages(g, 0, flags, { day: 1, month0: 10 }), []);
  // Meisterschaft gesichert: eigene Punkte über allem, was die anderen noch erreichen können
  const my = g.managers.at(0).clubIndex;
  const s = g.standings.at(my);
  s.setU8(0, 90);
  s.setU8(1, 90);
  const msgs = standingsMessages(g, 0, flags, { day: 1, month0: 10 });
  assert.ok(msgs.some((l) => l[1] === text("quell.messages", 0) && l[2] === text("quell.messages", 4)), JSON.stringify(msgs));
  assert.ok(msgs.some((l) => l[1] === text("quell.messages", 1)));
  assert.ok(msgs.some((l) => l[1] === text("quell.messages", 3)));
  // keine Wiederholung
  assert.deepEqual(standingsMessages(g, 0, flags, { day: 2, month0: 10 }), []);
  // verspielt: eigene Punkte 0, alle Spiele gespielt, Tabellenführer weit vorn
  const h = load("TEST4.MAN");
  const hs = h.standings.at(h.managers.at(0).clubIndex);
  hs.setU8(0, 0);
  hs.setU8(1, 0);
  hs.setU8(30, 17);
  hs.setU8(31, 17);
  const lead = h.standings.at(tableOrder(h, 0)[0]);
  lead.setU8(0, 30);
  const f2 = { v: 0 };
  const lost = standingsMessages(h, 0, f2, { day: 1, month0: 3 });
  assert.ok(lost.some((l) => l[1] === text("quell.messages", 9) && l[2] === text("quell.messages", 5)), JSON.stringify(lost));
  assert.deepEqual(standingsMessages(h, 0, { v: 0 }, { day: 14, month0: 5 }), []);
});

test("Abschlussbild (0x1A36D): Meister- und Pokaltitel werden nur für Managervereine gezählt", () => {
  const g = load("TEST4.MAN");
  const champ = bookChampion(g);
  assert.equal(champ.club, tableOrder(g, 0)[0]);
  const m0 = g.managers.at(0);
  const before = m0.u8(57);
  // Manager 0 zum Tabellenführer machen: Verein tauschen
  m0.setU8(30, champ.club);
  const again = bookChampion(g);
  assert.equal(again.manager, 0);
  assert.equal(m0.u8(57), before + 1);
  const cupBefore = m0.u8(58);
  assert.equal(bookCupTitle(g, 0, champ.club), 0);
  assert.equal(m0.u8(58), cupBefore + 1);
  assert.equal(bookCupTitle(g, 0, 63), -1);
});
