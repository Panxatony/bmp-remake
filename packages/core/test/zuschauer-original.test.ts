/**
 * Zuschauerformel 0x10BB0 wie das Original (#102): die Routine im x86-Emulator (Unicorn) auf dem
 * Abbild mit übersetzten Gleitkommabefehlen (tools/fpu.py), also mit echter 80-Bit-Rechnung,
 * je Fall Manager, Heim, Gast und Zufallszustand. Erwartung in zuschauer-original.json:
 * "orig" = TEST4 wie gespeichert (meist an der Stadiongrenze), "15"/"25"/"40" = alle drei Manager
 * mit Eintrittspreis 15/25/40 DM und je 40.000 Steh- und Sitzplätzen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState } from "../src/index.ts";
import { originalRng } from "../src/sim/match.ts";
import { attendance } from "../src/sim/attendance.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const TEST4 = join(BMP_DIR, "TEST4.MAN");
const soll = JSON.parse(readFileSync(resolve(import.meta.dirname, "zuschauer-original.json"), "utf8")) as Record<string, number[][]>;

test("Zuschauerformel 0x10BB0 mit 80-Bit-Gleitkomma wie das Original (Emulator, 240 Fälle)", { skip: !existsSync(TEST4) }, () => {
  for (const [variante, faelle] of Object.entries(soll)) {
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(TEST4))));
    if (variante !== "orig") {
      for (let m = 0; m < 3; m++) {
        const mg = g.managers.at(m);
        mg.setU8(266, Number(variante));
        mg.setI32(350, 40000);
        mg.setI32(358, 40000);
      }
    }
    for (const [m, home, away, z, zuschauer] of faelle) {
      assert.equal(attendance(g, { manager: m, home, away, level: g.save.plain[34062], importance: 1 }, originalRng(z)), zuschauer, `${variante}: Manager ${m}, ${home} gegen ${away}, Zustand ${z}`);
    }
  }
});
