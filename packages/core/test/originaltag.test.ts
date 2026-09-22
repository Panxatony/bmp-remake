/**
 * Bytegenauer Vergleich (GitLab #99): der Tageslauf in Originalreihenfolge würfelt Wurf für Wurf
 * wie ein präpariertes Original (tools/seed-patch.py "tag" + tools/kontrollpunkte.py), das
 * TEST4 einen Tag weitergespielt hat (tools/dosbox/KP-TEST4.MAN). Einträge der random-Spur
 * (Kennung 0x8000) tragen keinen Zustand und bleiben außen vor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, originalRng, originaltag, TABLES } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const KP = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4.MAN");

/** Würfe seit srand(0x1234) bis zum Zustand z. */
function wuerfe(z: number): number {
  let s = 0x1234;
  let n = 0;
  while (s !== z && n < 3_000_000) {
    s = (Math.imul(s, 214013) + 2531011) >>> 0;
    n++;
  }
  return s === z ? n : -1;
}

function protokoll(plain: Uint8Array): { punkt: number; wurf: number }[] {
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const out: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < w(0); i++) {
    if (w(2 + 8 * i) === 0x8000) continue;
    const n = wuerfe((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0);
    if (n >= 0) out.push({ punkt: w(2 + 8 * i), wurf: n });
  }
  return out;
}

// Die Vorlage ist ein Spielstand des Originals und liegt nur lokal vor (.gitignore)
test("Originaltag TEST4: die Würfe stimmen an jedem erreichten Kontrollpunkt", { skip: !existsSync(KP) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(KP))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  // Die Vorlage hat nur einen Teil der Kontrollpunkte eingebaut
  const ids = new Set(orig.map((p) => p.punkt));
  // Bis zu den Chancen der ersten Halbzeit: danach klickte der Treiber in diesem Lauf noch in die
  // Konferenz (vor der Korrektur in drive.py), das Original ließ dadurch Minuten aus
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt)).slice(0, 71);
  assert.equal(lauf.length, 71);
  lauf.forEach((p, i) => assert.deepEqual(p, orig[i], `Kontrollpunkt ${i + 1}`));
});

// Beide Halbzeiten (kontrollpunkte.py --still 7,10,12,13): Chancen, Neuauslosung,
// Chancenhandler und Halbzeitende, mit der Neuberechnung der Stärke in der Pause
const SPIEL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-SPIEL.MAN");
test("Originaltag TEST4: beide Halbzeiten bis zum Schlusspfiff", { skip: !existsSync(SPIEL) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(SPIEL))).plain);
  const ids = new Set(orig.map((p) => p.punkt));
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt));
  const bisSchluss = orig.slice(0, orig.findLastIndex((p) => p.punkt === 21) + 1);
  assert.ok(bisSchluss.length >= 79, `nur ${bisSchluss.length} Punkte bis zum Schlusspfiff`);
  assert.deepEqual(lauf.slice(0, bisSchluss.length), bisSchluss);
});

// Ringprotokoll (kontrollpunkte.py --ring 1 --halt 21): die letzten 160 Punkte der ersten
// Halbzeit - Karten, Verletzungen, Torwürfel, Chancenhandler - nach Wurfzahl geordnet
const RING = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-RING.MAN");
test("Originaltag TEST4: Minutenschleife der ersten Halbzeit Wurf für Wurf", { skip: !existsSync(RING) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const plain = SaveFile.decode(new Uint8Array(readFileSync(RING))).plain;
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const orig: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const punkt = w(2 + 8 * i);
    if (!punkt || punkt & 0x8000) continue;
    orig.push({ punkt, wurf: wuerfe((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0) });
  }
  orig.sort((a, b) => a.wurf - b.wurf);
  const ids = new Set(orig.map((p) => p.punkt));
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt) && p.wurf >= orig[0].wurf && p.wurf <= orig[orig.length - 1].wurf);
  assert.equal(orig.length, 160);
  assert.deepEqual(lauf, orig);
});
