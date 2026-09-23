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

// Nach dem Schlusspfiff (kontrollpunkte.py mit 21, 22, 23, 8, 9): Tabelle mit Grundzuschlag,
// Torschützen der KI-Vereine, Stärke bei der Ergebnisübersicht, dann die Sportzeitung - die
// Finanzen des Saisontags (Punkt 8) beginnen genau dort, wo die Zeitung endet
const BUCHUNG = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-BUCHUNG.MAN");
test("Originaltag TEST4: Ligabuchung und Zeitung nach dem Schlusspfiff", { skip: !existsSync(BUCHUNG) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(BUCHUNG))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const punkte = originaltag(g, originalRng(0x1234)).punkte;
  const ids = new Set([1, 21, 22, 23]);
  const bisFinanzen = orig.slice(0, orig.findIndex((p) => p.punkt === 8));
  assert.deepEqual(punkte.filter((p) => ids.has(p.punkt)), bisFinanzen);
  const finanzen = orig.find((p) => p.punkt === 8);
  assert.equal(punkte.find((p) => p.punkt === 25)?.wurf, finanzen?.wurf, "Zeitung endet vor den Finanzen des Saisontags");
});

// Der ganze Tag (Punkte 9 und 27): Tagesroutine aller Manager und das Tagesende vor dem srand des
// nächsten Tages. Die Lagerzeiten beim Laden stammen aus einer Messung (sie stehen nicht im Stand).
const TAG = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-TAG.MAN");
test("Originaltag TEST4: Tagesroutine und Tagesende", { skip: !existsSync(TAG) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(TAG))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const punkte = originaltag(g, originalRng(0x1234), [-40, 7, 56, -53, 11, 31, 60, 13]).punkte;
  assert.deepEqual(punkte.filter((p) => p.punkt === 9), orig.filter((p) => p.punkt === 9));
  const ende = orig.filter((p) => p.punkt === 27).at(-1);
  assert.equal(punkte.find((p) => p.punkt === 26)?.wurf, ende?.wurf, "Tagesende");
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

// DFB-Pokaltag (TEST1, Viertelfinale mit Verlängerung; kontrollpunkte.py --ohne 2,4,11,14,15,17,
// 18,19,20,22,23,24,28): Vorbereitung je Paar, vier Halbzeiten - die Verlängerung würfelt Chancen
// für alle Paare, den Torwürfel aber nur das offene -, Rundenabschluss und die Folgetage mit dem
// Sondertag 12.11. bis zum Tagesende. Die Lagerzeiten sind aus dem Abzug am Tagesende
// zurückgerechnet (der Abzug hält den letzten Punkt 27 fest, nicht den beim Laden).
const POKAL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST1-POKAL.MAN");
test("Originaltag TEST1: DFB-Pokaltag bis zum Tagesende", { skip: !existsSync(POKAL) || !existsSync(join(BMP_DIR, "TEST1.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(POKAL))).plain);
  // Das Protokoll läuft in den nächsten Tag hinein; es zählt bis zum ersten Tagesende
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST1.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [4, 44, 21, 35, -22, -30, 26, -38]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 57);
  assert.deepEqual(punkte, bisEnde);
});

// Europapokaltag ohne Managerverein (TEST2, Hinspiele aller drei Wettbewerbe; Punkte wie beim
// DFB-Pokaltag): 12 Paare, zwei Halbzeiten, der Rundenabschluss nach dem Hinspiel würfelt nicht.
// Der Abzug der Lagerzeiten ist hier vom Protokoll überschrieben; die Startwerte sind so gewählt,
// dass wie im Original beim 6. und 7. Aufruf neu gezogen wird.
const EUROPA = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST2-EUROPA.MAN");
test("Originaltag TEST2: Europapokaltag bis zum Tagesende", { skip: !existsSync(EUROPA) || !existsSync(join(BMP_DIR, "TEST2.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(EUROPA))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST2.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [6, 7, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 61);
  assert.deepEqual(punkte, bisEnde);
});

// Europapokal-Rückspieltag ohne Managerverein (RUNA0, 4.10.): offene Rückspiele gehen in die
// Verlängerung (0x19208), danach Elfmeterschießen und die Auslosung der nächsten Runde. An den
// Folgetagen zieht kein Lager neu; die Startwerte sind entsprechend gewählt.
const RUECKSPIEL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RUNA0-RUECKSPIEL.MAN");
test("Originaltag RUNA0: Europapokal-Rückspieltag bis zum Tagesende", { skip: !existsSync(RUECKSPIEL) || !existsSync(join(BMP_DIR, "RUNA0.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(RUECKSPIEL))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RUNA0.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [60, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 147);
  assert.deepEqual(punkte, bisEnde);
});

// Nachholtag ohne Managerverein (RUN0, 22.11., neun Nachholspiele; kontrollpunkte.py --ohne
// 3,5,11,14,15,17,18,19,20,22,23,24,28): Vorbereitung und Live-Schleife wie in der Liga, die Seite
// "NACHHOLSPIELE" rechnet zur Halbzeit und nach der 90. die Stärke aller Manager neu. Ein Lager
// zieht beim 2. Aufruf neu.
const NACHHOL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RUN0-NACHHOL.MAN");
test("Originaltag RUN0: Nachholtag bis zum Tagesende", { skip: !existsSync(NACHHOL) || !existsSync(join(BMP_DIR, "RUN0.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(NACHHOL))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RUN0.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [2, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 52);
  assert.deepEqual(punkte, bisEnde);
});
