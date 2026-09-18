/**
 * Zuschauer eines Heimspiels gegen das Original geprüft (GitLab #23).
 *
 * Die Zahl steht nur auf der Konferenztafel und wird nirgends gespeichert - prüfen lässt sie
 * sich deshalb nur durch Messen im Original. Am 16.9.2026 sind in DOSBox sieben Reihen zu je
 * fünf Läufen gefahren worden (Verfahren und Rohwerte: docs/REFERENZ-ZUSCHAUER.md,
 * Werkzeuge tools/dosbox/mess.py und reihe.sh). Dieser Test stellt die gemessenen Werte
 * gegen unsere Formel: jeder gemessene Wert muss im Band unserer Formel liegen, und die
 * Mittelwerte dürfen nicht weit auseinanderlaufen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, attendance, mulberryRng, fixtures, updatePositions } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");

/** Grundstellung der Messung: TEST4.MAN mit 30.000 Sitz- und 30.000 Stehplätzen. */
function basis(): GameState {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const m = g.managers.at(0);
  const w32 = (off: number, v: number) => {
    for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff);
  };
  w32(350, 30_000);
  w32(358, 30_000);
  return g;
}

/** Punkte und Tore so setzen, dass der Verein ganz oben oder ganz unten steht. */
function platzieren(g: GameState, club: number, wohin: "oben" | "unten"): void {
  const s = g.standings.at(club);
  const [h, a] = [s.homeGames, s.awayGames];
  if (wohin === "oben") {
    s.setU8(0, 2 * h); s.setU8(1, 2 * a);
    s.setU8(38, h); s.setU8(39, a);
    s.setU8(42, 0); s.setU8(43, 0);
    s.setU8(22, 3 * h); s.setU8(23, 3 * a);
    s.setU8(26, 0); s.setU8(27, 0);
  } else {
    s.setU8(0, 0); s.setU8(1, 0);
    s.setU8(38, 0); s.setU8(39, 0);
    s.setU8(42, h); s.setU8(43, a);
    s.setU8(22, 0); s.setU8(23, 0);
    s.setU8(26, 3 * h); s.setU8(27, 3 * a);
  }
  updatePositions(g, g.managers.at(0).u8(312));
}

const REIHEN: { name: string; stellen?: (g: GameState) => void; werte: number[] }[] = [
  { name: "ZA Preis 19", werte: [34_025, 28_077, 27_402, 31_509, 32_109] },
  { name: "ZB Preis 12", stellen: (g) => g.managers.at(0).setU8(266, 12), werte: [44_560, 46_692, 46_057, 45_558, 45_952] },
  { name: "ZC Preis 25", stellen: (g) => g.managers.at(0).setU8(266, 25), werte: [20_940, 15_845, 16_174, 14_595, 19_751] },
  { name: "ZD Fanwert 30", stellen: (g) => { g.managers.at(0).setU8(476, 30); g.managers.at(0).setU8(477, 0); }, werte: [29_919, 28_037, 25_359, 27_451, 28_805] },
  { name: "ZE Fanwert 90", stellen: (g) => { g.managers.at(0).setU8(476, 90); g.managers.at(0).setU8(477, 0); }, werte: [31_569, 31_166, 33_710, 28_733, 28_548] },
  { name: "ZH Gegner Platz 1", stellen: (g) => platzieren(g, 3, "oben"), werte: [29_603, 29_349, 32_986, 34_313] },
  { name: "ZI Gegner Platz 18", stellen: (g) => platzieren(g, 3, "unten"), werte: [24_412, 22_644, 19_960, 23_024, 22_376] },
];

test("Zuschauer: die im Original gemessenen Kulissen liegen im Band unserer Formel (#23)", () => {
  for (const reihe of REIHEN) {
    const g = basis();
    reihe.stellen?.(g);
    const liga = g.managers.at(0).u8(312);
    const paar = fixtures(liga, g.nextMatchday(liga)).find(([h]) => h === g.activeManagers()[0].clubIndex);
    assert.ok(paar, `${reihe.name}: kein Heimspiel`);
    const [home, away] = paar;
    const gezogen: number[] = [];
    for (let seed = 1; seed <= 3000; seed++) {
      gezogen.push(attendance(g, { manager: 0, home, away, level: g.save.plain[34062] }, mulberryRng(seed)));
    }
    const min = Math.min(...gezogen);
    const max = Math.max(...gezogen);
    const unser = gezogen.reduce((a, b) => a + b, 0) / gezogen.length;
    for (const wert of reihe.werte) {
      assert.ok(wert >= min && wert <= max, `${reihe.name}: gemessen ${wert} liegt nicht in ${min}..${max}`);
    }
    const gemessen = reihe.werte.reduce((a, b) => a + b, 0) / reihe.werte.length;
    const ab = Math.abs(gemessen - unser) / unser;
    assert.ok(ab < 0.15, `${reihe.name}: Mittel gemessen ${Math.round(gemessen)}, berechnet ${Math.round(unser)} (${Math.round(ab * 100)}% auseinander)`);
  }
});

test("Zuschauer: ist das Stadion zu klein, kommt genau die Kapazität heraus (#23)", () => {
  // Zehn Läufe im Original aus TEST4.MAN mit 8.000 Sitz- und 16.000 Stehplätzen ergaben
  // zehnmal genau 24.000.
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const liga = g.managers.at(0).u8(312);
  const paar = fixtures(liga, g.nextMatchday(liga)).find(([h]) => h === g.activeManagers()[0].clubIndex);
  assert.ok(paar);
  const [home, away] = paar;
  const kapazitaet = g.managers.at(0).i32(350) + g.managers.at(0).i32(358);
  assert.equal(kapazitaet, 24_000);
  for (let seed = 1; seed <= 200; seed++) {
    assert.equal(attendance(g, { manager: 0, home, away, level: g.save.plain[34062] }, mulberryRng(seed)), kapazitaet, `Wurf ${seed}`);
  }
});
