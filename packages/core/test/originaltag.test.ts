/**
 * Bytegenauer Vergleich (GitLab #99): der Tageslauf in Originalreihenfolge würfelt Wurf für Wurf
 * wie ein präpariertes Original (tools/seed-patch.py "zug" + tools/kontrollpunkte.py), das
 * TEST4 einen Tag weitergespielt hat (tools/dosbox/KP-TEST4.MAN).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, originalRng, originaltag, TABLES } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const KP = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4.MAN");

function protokoll(plain: Uint8Array): { punkt: number; wurf: number }[] {
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const out: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < w(0); i++) {
    const z = (w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0;
    let s = 0x1234;
    let n = 0;
    while (s !== z && n < 3_000_000) {
      s = (Math.imul(s, 214013) + 2531011) >>> 0;
      n++;
    }
    if (s === z) out.push({ punkt: w(2 + 8 * i), wurf: n });
  }
  return out;
}

test("Originaltag TEST4: die Würfe stimmen an jedem erreichten Kontrollpunkt", () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(KP))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234));
  assert.ok(lauf.punkte.length >= 31, `nur ${lauf.punkte.length} Kontrollpunkte`);
  lauf.punkte.forEach((p, i) => assert.deepEqual(p, orig[i], `Kontrollpunkt ${i + 1}`));
});
