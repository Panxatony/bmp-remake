/**
 * Sportzeitung gegen die Bildschirme des Originals (#100): TEST4 und RIED-4TE mit srand(0x1234)
 * je Tag in DOSBox gespielt (tools/dosbox/drive.py mit DRIVE_DEBUG), die Seiten abgelesen. Die
 * Erwartung in zeitung-original.json ist Wort für Wort mit diesen Bildern verglichen: drei Seiten
 * des TEST4-Tags und die erste des Derbytags (die zweite hat der Lauf ohne Bild weitergeklickt).
 * Das Foto (random(0,29)) ist nicht Teil des Vergleichs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, originalRng, originaltag } from "../src/index.ts";
import type { Zeitung } from "../src/sim/zeitung.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const soll = JSON.parse(readFileSync(resolve(import.meta.dirname, "zeitung-original.json"), "utf8")) as Record<string, Omit<Zeitung, "picture">[]>;
const LAGER: Record<string, number[]> = { "TEST4.MAN": [-40, 7, 56, -53, 11, 31, 60, 13], "RIED-4TE.MAN": [6, 60, 60, 60, -60, -60, 60, 60] };

for (const [datei, seiten] of Object.entries(soll)) {
  test(`Sportzeitung wie im Original: ${datei}`, { skip: !existsSync(join(BMP_DIR, datei)) }, () => {
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, datei)))));
    const z: Zeitung[] = [];
    originaltag(g, originalRng(0x1234), LAGER[datei], undefined, undefined, z);
    assert.deepEqual(z.slice(0, seiten.length).map(({ picture, ...rest }) => (void picture, rest)), seiten);
  });
}
