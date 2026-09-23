/**
 * Saisonende 0x0CB62 (GitLab #82, Kapitel 6; #94).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, seasonEvents, newSeason, MARKET_MANAGER, LOAN_FLAG, saisonbilanz, saisonwechselStand, saisonwechselTeil1, setDayIndex } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const u16 = (l: { u8(o: number): number }, o: number) => l.u8(o) | (l.u8(o + 1) << 8);

test("Saisonwechsel: Karrieresummen bleiben, Saisonwerte 0..8 der Managerkader gehen (0x0D9A6)", () => {
  const g = load("TEST4.MAN");
  const l = g.squadOf(0).find((x) => u16(x, 28) > 0)!;
  const idx = l.playerIndex;
  l.setU8(0, 1);
  l.setU8(2, 1);
  l.setU8(8, 3);
  l.setU8(11, 3);
  const vorher = [u16(l, 28), u16(l, 30), u16(l, 34)];
  newSeason(g, mulberryRng(5));
  const n = g.squadOf(0).find((x) => x.playerIndex === idx)!;
  assert.deepEqual([u16(n, 28), u16(n, 30), u16(n, 34)], vorher, "Karrieresummen");
  for (let b = 0; b <= 8; b++) assert.equal(n.u8(b), 0, `Byte ${b}`);
  assert.equal(n.u8(11), 2, "ein Vertragsjahr weniger");
});

test("Saisonende: Leihspieler geht zum verleihenden Manager zurück, mit seinem Kaderplatz (0x0D2BD)", () => {
  const g = load("TEST4.MAN");
  // Einen Spieler von Manager 1 an Manager 0 verliehen: er steht bei 0, gehört aber 1
  const l = g.squadOf(0).find((x) => x.number >= 12 || x.number === 0) ?? g.squadOf(0)[g.squadOf(0).length - 1];
  const idx = l.playerIndex;
  g.players.at(idx).setU8(33, 1);
  l.setU8(12, 20 | LOAN_FLAG);
  l.setU8(11, 1);
  l.setU8(24, 105);
  const kader0 = g.squadOf(0).length;
  seasonEvents(g, [0, 0, 0], mulberryRng(3), true);
  assert.equal(g.squadOf(0).some((x) => x.playerIndex === idx), false, "nicht mehr beim Entleiher");
  const zurueck = g.squadOf(1).find((x) => x.playerIndex === idx);
  assert.ok(zurueck, "beim Besitzer");
  assert.equal(zurueck!.u8(12), 0, "Leihmarke weg");
  assert.equal(zurueck!.u8(24), 0, "kein Vertragsgespräch");
  assert.equal(zurueck!.u8(11), 0, "Vertragsjahr schon abgezogen");
  assert.equal(g.players.at(idx).u8(33), 1);
  assert.equal(g.squadOf(0).length, kader0 - 1);
});

test("Saisonende: eigener Spieler auf der Transferliste kommt in den Kader zurück", () => {
  const g = load("TEST4.MAN");
  let slot = -1;
  for (let k = 0; k < 12; k++) if (!g.lineups.at(100 + k).isEmpty) slot = k;
  const idx = g.lineups.at(100 + slot).playerIndex;
  g.players.at(idx).setU8(33, 2);
  seasonEvents(g, [0, 0, 0], mulberryRng(4), true);
  assert.ok(g.squadOf(2).some((x) => x.playerIndex === idx), "beim Manager");
  for (let k = 0; k < 12; k++) {
    const m = g.lineups.at(100 + k);
    assert.ok(m.isEmpty || m.playerIndex !== idx, "nicht mehr auf dem Markt");
  }
  // Ein Marktspieler ohne Besitzer bleibt, wo er ist
  assert.notEqual(MARKET_MANAGER, 2);
});

test("Torschützenkönig: bei gleich vielen Toren gewinnt, wer weniger Spiele hat; mindestens zwei Tore (0x16515)", () => {
  const g = load("TEST4.MAN");
  const club = g.managers.at(0).clubIndex;
  const liga = club < 18 ? 0 : 1;
  const basis = liga === 0 ? 0 : 18;
  // Alle Tore der Liga weg, dann zwei Spieler mit je 20 Toren
  for (let x = 1; x < 151; x++) g.players.at(x).setU8(34, 0);
  for (let m = 0; m < 3; m++) for (const l of g.squadOf(m)) l.setU8(3, 0);
  const eigener = g.squadOf(0)[3];
  eigener.setU8(3, 20);
  g.players.at(eigener.playerIndex).setU8(35, 30);
  let fremd = -1;
  for (let x = 1; x < 151 && fremd < 0; x++) {
    const c = g.players.at(x).u8(36);
    if (c >= basis && c < basis + (liga === 0 ? 18 : 20) && c !== club && g.players.at(x).u8(33) === 5) fremd = x;
  }
  assert.ok(fremd > 0);
  g.players.at(fremd).setU8(34, 20);
  g.players.at(fremd).setU8(35, 25);
  const probe = (eigeneSpiele: number) => {
    const h = new GameState(SaveFile.decode(g.save.encode()));
    h.players.at(eigener.playerIndex).setU8(35, eigeneSpiele);
    const konto = h.managers.at(0).balance;
    seasonEvents(h, [0, 0, 0], mulberryRng(2), true);
    return h.managers.at(0).balance - konto;
  };
  assert.equal(probe(30), 0, "der fremde Spieler hat weniger Spiele");
  assert.equal(probe(20), 250000, "jetzt hat der eigene weniger");
  // Mit nur einem Tor steht niemand in der Liste
  g.players.at(fremd).setU8(34, 1);
  eigener.setU8(3, 1);
  assert.equal(probe(10), 0, "unter zwei Toren kein Torschützenkönig");
});

test("Saisonbilanz (0x1DD03) und Stand des Saisonwechsels für den Server", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const st = g.standings.at(m.clubIndex);
  st.setU8(30, 20);
  st.setU8(31, 18);
  st.setU8(38, 8);
  st.setU8(42, 3);
  const siege = m.u16(440);
  const unent = m.u16(448);
  setDayIndex(g, 92);
  assert.equal(saisonwechselStand(g), null, "am letzten Spieltag");
  setDayIndex(g, 93);
  assert.equal(saisonwechselStand(g), "zug", "danach");
  saisonbilanz(g);
  assert.equal(m.u16(440), siege + 8);
  assert.equal(m.u16(448), (unent + 20 - 3 - 8) & 0xffff);
  assert.equal(m.i32(484), 0);
  assert.equal(m.i32(492), 99999);
  saisonwechselTeil1(g, mulberryRng(4), true);
  assert.equal(saisonwechselStand(g), "vertraege");
});
