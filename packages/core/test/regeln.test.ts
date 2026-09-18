import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, parseMana, createGame, applyResult, tableOrder, ruleSet, setRuleSet, is2026, winPoints, substitutionLimits, ruleName, RULES_OFFSET, RULES_2026, RULES_ORIGINAL } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Regelwerk: Spielstände des Originals gelten als Original, die Wahl überlebt das Speichern", () => {
  const g = load("TEST4.MAN");
  assert.equal(ruleSet(g), RULES_ORIGINAL);
  assert.equal(is2026(g), false);
  assert.equal(winPoints(g), 2);
  assert.deepEqual(substitutionLimits(g), { goalkeeper: 1, field: 2, total: 3 });
  assert.equal(ruleName(g), "ORIGINAL");
  setRuleSet(g, RULES_2026);
  assert.equal(g.save.plain[RULES_OFFSET], 1);
  assert.equal(winPoints(g), 3);
  assert.deepEqual(substitutionLimits(g), { goalkeeper: 5, field: 5, total: 5 });
  assert.equal(ruleName(g), "VERSION 2026");
  const wieder = new GameState(SaveFile.decode(g.save.encode()));
  assert.equal(ruleSet(wieder), RULES_2026);
});

test("Regelwerk: drei Punkte je Sieg ändern Tabelle und Reihenfolge", () => {
  const g = load("TEST4.MAN");
  const [a, b] = [0, 1];
  const vorher = [g.standings.at(a).u8(0), g.standings.at(b).u8(1)];
  applyResult(g, a, b, 2, 1);
  assert.equal(g.standings.at(a).u8(0), vorher[0] + 2);
  assert.equal(g.standings.at(b).u8(1), vorher[1] + 0);
  const h = load("TEST4.MAN");
  setRuleSet(h, RULES_2026);
  const vor2 = [h.standings.at(a).u8(0), h.standings.at(b).u8(1)];
  applyResult(h, a, b, 2, 1);
  assert.equal(h.standings.at(a).u8(0), vor2[0] + 3);
  assert.equal(h.standings.at(b).u8(1), vor2[1] + 0);
  // Unentschieden bleibt in beiden Regelwerken ein Punkt für jeden
  applyResult(h, a, b, 1, 1);
  assert.equal(h.standings.at(a).u8(0), vor2[0] + 4);
  assert.equal(h.standings.at(b).u8(1), vor2[1] + 1);
  // Die Reihenfolge rechnet mit den gespeicherten Punkten, also mit den neuen Werten
  assert.ok(tableOrder(h, 0).includes(a));
});

test("Regelwerk: neues Spiel schreibt die Wahl in den Spielstand", () => {
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  const template = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))).plain;
  const managers = [{ name: "Lars", club: 0, portrait: 2 }];
  const alt = new GameState(SaveFile.decode(createGame(template, mana, { managers, level: 3 }, mulberryRng(7)).encode()));
  assert.equal(ruleSet(alt), RULES_ORIGINAL);
  const neu = new GameState(SaveFile.decode(createGame(template, mana, { managers, level: 3, rules: RULES_2026 }, mulberryRng(7)).encode()));
  assert.equal(ruleSet(neu), RULES_2026);
  // Sonst steht in beiden Spielständen dasselbe: Manager, Vereine, Spieler und die Kader sind
  // Byte für Byte gleich. Nur das Regelbyte und die Preise der Marktplätze unterscheiden sich -
  // die rechnet die Version 2026 ohne den 16-Bit-Überlauf des Originals (sim/value.ts), und mit
  // den Preisen ändert sich auch der weitere Zufallslauf.
  const x = alt.save.plain;
  const y = neu.save.plain;
  const gleich = (von: number, bis: number) => {
    for (let i = von; i < bis; i++) if (x[i] !== y[i]) return i;
    return -1;
  };
  assert.equal(gleich(2345, 5457), -1, "Manager");
  assert.equal(gleich(5557, 12357), -1, "Vereine");
  assert.equal(gleich(15813, 21400), -1, "Spieler");
  assert.equal(gleich(21400, 21400 + 100 * 52), -1, "Kader der Manager");
  assert.equal(x[RULES_OFFSET], RULES_ORIGINAL);
  assert.equal(y[RULES_OFFSET], RULES_2026);
});
