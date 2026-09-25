/**
 * Auswechslung im Kaderbildschirm wie 0x20230: eingewechselt wird nur ein Spieler von der Bank
 * (0x208E1), und schon der Auszuwechselnde braucht ein freies Kontingent seiner Gruppe (0x2092A).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, texte } from "../src/index.ts";
import { applySubstitutions, type LiveState } from "../../server/live.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const laden = () => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN")))));
const block = (g: GameState) => g.save.plain.slice(21400, 21400 + 1300);
const tausch = (g: GameState, a: number, b: number) => {
  const [x, y] = [g.lineups.at(a), g.lineups.at(b)];
  const n = x.number;
  x.number = y.number;
  y.number = n;
};

test("Einwechseln nur von der Bank: ein Spieler ohne Nummer ist nicht aufgestellt (0x208E1)", () => {
  const g = laden();
  g.lineups.at(11).number = 0; // Platz 11 (bisher Nummer 15) ohne Nummer
  const vorher = block(g);
  tausch(g, 1, 11);
  const st = { subs: [], news: [], entries: [] } as unknown as LiveState;
  assert.deepEqual(applySubstitutions(st, g, 0, vorher, mulberryRng(1)), { ok: false, error: texte("ui.spielerist").join(" ") });
  // Von der Bank (Platz 2, Nummer 12) geht es
  const g2 = laden();
  const v2 = block(g2);
  tausch(g2, 1, 2);
  assert.equal(applySubstitutions({ subs: [], news: [], entries: [] } as unknown as LiveState, g2, 0, v2, mulberryRng(1)).ok, true);
});

test("Kontingent zählt schon beim Auszuwechselnden: Torwartwechsel verbraucht, Torwart raus geht nicht mehr (0x2092A)", () => {
  const g = laden();
  const vorher = block(g);
  // Torwart (Platz 0, Nummer 1) für einen Feldspieler von der Bank (Platz 2, Nummer 12)
  tausch(g, 0, 2);
  const st = { subs: [{ goalkeeper: 1, field: 0 }], news: [], entries: [] } as unknown as LiveState;
  assert.deepEqual(applySubstitutions(st, g, 0, vorher, mulberryRng(1)), { ok: false, error: texte("ui.keinwechsel").join(" ") });
  // Mit freiem Torwartwechsel geht es, gezählt wird nach dem Eingewechselten (Feldspieler)
  const g2 = laden();
  const v2 = block(g2);
  tausch(g2, 0, 2);
  const st2 = { subs: [{ goalkeeper: 0, field: 0 }], news: [], entries: [] } as unknown as LiveState;
  assert.equal(applySubstitutions(st2, g2, 0, v2, mulberryRng(1)).ok, true);
  assert.deepEqual(st2.subs[0], { goalkeeper: 0, field: 1 });
});
