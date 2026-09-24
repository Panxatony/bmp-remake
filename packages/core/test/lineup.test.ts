import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, autoLineup, autoLineupIfEnabled, setSystem, systemOf, groupOf, FORMATIONS } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

const numbered = (g: GameState, m: number) => g.squadOf(m).filter((l) => l.u8(10) > 0).map((l) => ({ n: l.u8(10), grp: groupOf(g, l.playerIndex), fit: (l.u8(9) & 3) === 0, s: Math.trunc((l.u8(16) + l.u8(17) + l.u8(18)) / 3) }));

test("Automatische Aufstellung (0x22030): Nummern 1..11 nach System, nur einsatzfähige Spieler, Bank 12/13", () => {
  const g = load("TEST4.MAN");
  for (let system = 2; system <= 4; system++) {
    autoLineup(g, 0, system);
    const rows = numbered(g, 0);
    const starters = rows.filter((r) => r.n <= 11);
    assert.equal(starters.length, 11, `System ${system}: ${starters.length} Starter`);
    assert.deepEqual([...new Set(starters.map((r) => r.n))].length, 11);
    assert.ok(starters.every((r) => r.fit));
    // je Gruppe mindestens min(einsatzfähige Spieler der Gruppe, Sollzahl); fehlende Spieler kommen aus Nachbargruppen
    const fitPerGroup = [0, 1, 2, 3].map((grp) => g.squadOf(0).filter((l) => groupOf(g, l.playerIndex) === grp && (l.u8(9) & 3) === 0).length);
    const perGroup = [0, 1, 2, 3].map((grp) => starters.filter((r) => r.grp === grp).length);
    perGroup.forEach((n, grp) => assert.ok(n >= Math.min(fitPerGroup[grp], FORMATIONS[system - 2][grp]), `System ${system}: ${perGroup} bei ${fitPerGroup}`));
    // Nummer 1 ist ein Torwart
    assert.equal(starters.find((r) => r.n === 1)!.grp, 0);
    const bench = rows.filter((r) => r.n >= 12).map((r) => r.n).sort();
    assert.deepEqual(bench, [12, 13]);
  }
});

test("Automatische Aufstellung: verletzte Spieler bleiben draußen, ein Torwart im Tor, Bank zu Spielbeginn 12..15", () => {
  const g = load("TEST4.MAN");
  // die stärksten zwei Abwehrspieler verletzen
  const defenders = g.squadOf(0).filter((l) => groupOf(g, l.playerIndex) === 1);
  defenders.sort((a, b) => b.u8(16) + b.u8(17) + b.u8(18) - (a.u8(16) + a.u8(17) + a.u8(18)));
  defenders.slice(0, 2).forEach((l) => l.setU8(9, l.u8(9) | 2));
  autoLineup(g, 0, 2, true);
  const rows = numbered(g, 0);
  assert.ok(rows.filter((r) => r.n <= 11).every((r) => r.fit));
  assert.equal(rows.filter((r) => r.n <= 11 && r.grp === 0).length, 1);
  // Bank zu Spielbeginn: je Gruppe einer, Abbruch bei der ersten Gruppe ohne Spieler (Original)
  const bench = rows.filter((r) => r.n >= 12).map((r) => r.n).sort();
  assert.ok(bench.length >= 1 && bench.length <= 4);
  assert.deepEqual(bench, bench.map((_, i) => 12 + i));
  // System 1 (manuell) lässt die Aufstellung unverändert
  setSystem(g, 0, 1);
  assert.equal(systemOf(g, 0), 1);
  const before = g.squadOf(0).map((l) => l.u8(10));
  assert.equal(autoLineupIfEnabled(g, 0), false);
  assert.deepEqual(g.squadOf(0).map((l) => l.u8(10)), before);
});

// Die Aufstellung des Originals (0x22030 mit 0x0F125 und 0x2119D), im x86-Emulator auf den
// Kadern von vier Spielständen ausgeführt, je Manager und System (#103): Nummer, Spalte, Reihe
// je Kaderplatz. Bank mit vier Ersatzspielern (4238:56EE = 15, wie im Hauptmenü gesetzt).
test("Automatik-Aufstellung wie das Original (Emulator, #103)", () => {
  const erwartet = JSON.parse(readFileSync(resolve(import.meta.dirname, "aufstellung-original.json"), "utf8")) as Record<string, number[][]>;
  let geprueft = 0;
  for (const [key, want] of Object.entries(erwartet)) {
    const [datei, m, system] = key.split("|");
    const pfad = join(BMP_DIR, datei);
    if (!existsSync(pfad)) continue;
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(pfad))));
    autoLineup(g, Number(m), Number(system), true);
    const got = want.map((_, p) => { const l = g.lineups.at(Number(m) * 25 + p); return [l.u8(10), l.u8(25), l.u8(26)]; });
    assert.deepEqual(got, want, key);
    geprueft++;
  }
  assert.ok(geprueft === 0 || geprueft === Object.keys(erwartet).length);
});

// Drei Torhüter, nur sechs gesunde Feldspieler (TEST4, Manager 0, 1-4-4-2): Die Suche für eine
// Feldgruppe lässt den ersten Torhüter stehen und nimmt den nächsten mit Stärke 1 (0x22450).
// Erwartung aus dem Emulator (tools/emu-aufstellung.py, #100).
test("Automatik-Aufstellung: ab dem zweiten Torhüter darf einer ins Feld (Original 0x22305)", { skip: !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const g = load("TEST4.MAN");
  const feld = g.squadOf(0).filter((l) => groupOf(g, l.playerIndex) !== 0);
  g.players.at(feld[0].playerIndex).setU8(31, 5);
  g.players.at(feld[1].playerIndex).setU8(31, 6);
  feld.slice(2).forEach((l, i) => {
    if (i >= 6) l.setU8(9, l.u8(9) | 2);
  });
  autoLineup(g, 0, 2, true);
  const got = Array.from({ length: 15 }, (_, p) => {
    const l = g.lineups.at(p);
    return [l.u8(10), l.u8(25), l.u8(26)];
  });
  assert.deepEqual(got, [[1, 3, 7], [12, 1, 6], [2, 0, 3], [3, 2, 6], [4, 4, 6], [5, 5, 5], [6, 1, 5], [7, 2, 3], [0, 6, 3], [0, 6, 3], [0, 0, 3], [0, 5, 0], [0, 2, 0], [0, 3, 2], [0, 4, 0]]);
});
