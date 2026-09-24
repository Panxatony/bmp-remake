/**
 * Kader mit Lücke (RUNA0, Manager 2: Platz 14 leer, Platz 15 mit Nummer 11). Das Original zählt
 * die belegten Plätze (0x31A19) und würfelt dann random(0, Anzahl - 1) direkt als Kaderplatz -
 * der leere Platz kann fallen, der letzte Spieler nie (#100). Erwartung je Zufallszustand: Platz
 * und Wurfzahl aus dem x86-Emulator (0x4E45 bzw. 0x5D9A auf dem entschlüsselten RUNA0).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, originaltag } from "../src/index.ts";
import { originalRng } from "../src/sim/match.ts";
import { pickStarter } from "../src/sim/incidents.ts";
import { pickPlayer } from "../src/sim/goals.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const RUNA0 = join(BMP_DIR, "RUNA0.MAN");
const laden = () => new GameState(SaveFile.decode(new Uint8Array(readFileSync(RUNA0))));

test("Vorfall-Spieler 0x4E45 mit Lücke im Kader wie das Original", { skip: !existsSync(RUNA0) }, () => {
  const g = laden();
  const soll: [number, number, number][] = [[1, 11, 2], [7, 11, 6], [99, 8, 12], [1234, 3, 2], [4711, 2, 2], [31337, 3, 2], [65535, 11, 11], [222222, 11, 2]];
  for (const [z, platz, wuerfe] of soll) {
    const r = originalRng(z);
    assert.deepEqual([pickStarter(g, 2, r), r.zaehler()], [platz, wuerfe], `Zustand ${z}`);
  }
});

test("Schütze und Vorlage 0x5D9A mit Lücke im Kader wie das Original", { skip: !existsSync(RUNA0) }, () => {
  const g = laden();
  const soll: Record<string, [number, number, number][]> = {
    "0,0": [[1, 11, 3], [7, 7, 4], [99, 7, 8], [1234, 13, 6], [4711, 2, 20], [31337, 4, 19]],
    "0,1": [[1, 11, 2], [7, 7, 3], [99, 7, 10], [1234, 3, 2], [4711, 6, 8], [31337, 11, 6]],
    "1,1": [[1, 11, 2], [7, 7, 3], [99, 8, 12], [1234, 3, 2], [4711, 6, 8], [31337, 11, 6]],
  };
  for (const [art, faelle] of Object.entries(soll)) {
    const [mode, flag] = art.split(",").map(Number);
    for (const [z, platz, wuerfe] of faelle) {
      const r = originalRng(z);
      assert.deepEqual([pickPlayer(g, 2, mode, flag, r), r.zaehler()], [platz, wuerfe], `Modus ${mode}, Flag ${flag}, Zustand ${z}`);
    }
  }
});

// Nach Spieltag und Tagesbeginn des Folgetags (wie im Ganzstandvergleich) trägt Platz 15 die
// Nummer 11. Diese Zustände ziehen Platz 14: der alte Code nahm dafür den Spieler auf Platz 15.
const MESSUNG = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RUNA0-RUECKSPIEL.MAN");
test("Vorfall-Spieler und Schütze mit Lücke: Zustände, die den leeren Platz treffen", { skip: !existsSync(RUNA0) || !existsSync(MESSUNG) }, () => {
  const orig = SaveFile.decode(new Uint8Array(readFileSync(MESSUNG))).plain;
  const g = laden();
  const summen = g.activeManagers().map(() => ({ sum: 0 }));
  const t1 = originaltag(g, originalRng(0x1234), [60, 60, 60, 60, -60, -60, 60, 60], undefined, summen);
  for (const off of [27972, 27973, 28432, 28433, 28434, 34226]) g.save.plain[off] = orig[off];
  try {
    originaltag(g, originalRng(0x1234), t1.lager, (k) => {
      if (k === 12) throw new Error("Zug");
    }, summen);
  } catch (e) {
    if ((e as Error).message !== "Zug") throw e;
  }
  assert.equal(g.lineups.at(2 * 25 + 15).number, 11);
  for (const [z, platz, wuerfe] of [[5, 2, 8], [6, 11, 10], [11, 3, 3]]) {
    const r = originalRng(z);
    assert.deepEqual([pickStarter(g, 2, r), r.zaehler()], [platz, wuerfe], `0x4E45, Zustand ${z}`);
  }
  for (const [z, platz, wuerfe] of [[11, 3, 3], [13, 10, 15], [16, 13, 15]]) {
    const r = originalRng(z);
    assert.deepEqual([pickPlayer(g, 2, 0, 1, r), r.zaehler()], [platz, wuerfe], `0x5D9A, Zustand ${z}`);
  }
});
