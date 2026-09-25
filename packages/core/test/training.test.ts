import { test } from "node:test";
import { texte } from "../src/data/texte.ts";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, trainingSettings, setTraining, trainingBars, TRAINING_BUDGET, trainingCamp, campCost, campCountdown, advanceCampOpen, camps, CAMP_OPEN_START, trainingInjuries } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Training: Bälle, Budgets und die Balken K/T/E des Trainingsbildschirms", () => {
  const file = join(BMP_DIR, "CLAUDE.MAN");
  if (existsSync(file)) {
    const g = load("CLAUDE.MAN");
    // Im Original am 2.8.1992 abgelesen: 5/4/6/5 Bereiche, 6 Intensität, 1/3/3/3 Positionen
    const st = trainingSettings(g, 0);
    assert.deepEqual(st.balls, [5, 4, 6, 5]);
    assert.equal(st.intensityBalls, 6);
    assert.deepEqual(st.positions, [1, 3, 3, 3]);
    assert.equal(st.slider, 0);
    assert.equal(st.balls.reduce((a, b) => a + b, 0), TRAINING_BUDGET.categories);
    assert.equal(st.positions.reduce((a, b) => a + b, 0), TRAINING_BUDGET.positions);
    // Balken im Original: K 18, T 19 (E hängt an der Frische des laufenden Spiels)
    const bars = trainingBars(g, 0);
    assert.deepEqual(bars.slice(0, 2), [18, 19]);
    assert.ok(bars[2] >= 0 && bars[2] <= 38);
  }
  const g = load("TEST4.MAN");
  assert.equal(setTraining(g, 0, { balls: [10, 5, 3, 2], intensityBalls: 5, positions: [3, 3, 2, 2], slider: 34 }), null);
  assert.deepEqual(trainingSettings(g, 0), { balls: [10, 5, 3, 2], intensityBalls: 5, positions: [3, 3, 2, 2], slider: 34 });
  assert.ok(setTraining(g, 0, { balls: [10, 10, 3, 2], intensityBalls: 5, positions: [3, 3, 2, 2], slider: 0 }));
  assert.ok(setTraining(g, 0, { balls: [1, 1, 1, 1], intensityBalls: 5, positions: [5, 5, 2, 2], slider: 0 }));
  assert.ok(setTraining(g, 0, { balls: [1, 1, 1, 1], intensityBalls: 5, positions: [1, 1, 1, 1], slider: 35 }));
  // Ohne aufgestellte Spieler bleiben die Balken bei 0 statt zu teilen
  for (const l of g.squadOf(1)) l.setU8(10, 0);
  assert.deepEqual(trainingBars(g, 1), [0, 0, 0]);
});

test("Trainingslager: Preis nach Kadergröße, Sperre, Öffnungszeiten", () => {
  const g = load("TEST4.MAN");
  const squad = g.squadOf(0).length;
  assert.equal(campCost(g, 0, 3), 10 * squad * 2000);
  assert.equal(camps().length, 8);
  assert.deepEqual(camps().map((c) => c.base), [5, 6, 7, 10, 11, 10, 13, 15]);
  const m = g.managers.at(0);
  // Genug Geld: Lager läuft, danach ist der Menüpunkt 7..18 Tage gesperrt
  for (let i = 0; i < 4; i++) m.setU8(496 + i, (50_000_000 >>> (8 * i)) & 0xff);
  m.setU8(313, 0);
  const rng = mulberryRng(7);
  const res = trainingCamp(g, 0, 3, rng);
  assert.equal(typeof res, "object");
  assert.equal((res as { cost: number }).cost, 10 * squad * 2000);
  assert.ok(m.u8(313) >= 7 && m.u8(313) <= 18);
  assert.equal(trainingCamp(g, 0, 3, rng), texte("ui.lagerzuoft").join(" "));
  const sperre = m.u8(313);
  campCountdown(g, 0);
  assert.equal(m.u8(313), sperre - 1);
  m.setU8(313, 1);
  campCountdown(g, 0);
  campCountdown(g, 0);
  assert.equal(m.u8(313), 0);
  // Öffnungszeiten: Beträge laufen auf 0 zu und kippen dann das Vorzeichen
  assert.deepEqual([...CAMP_OPEN_START], [-80, -50, -100, -60, 80, 50, 70, 60]);
  const open = [-2, 3, 0, -1, 1, -1, 1, -1];
  advanceCampOpen(open, rng);
  assert.equal(open[0], -1);
  assert.equal(open[1], 2);
  assert.equal(open[2], 0);
  assert.ok(open[3] >= 20 && open[3] <= 70, String(open[3]));
  assert.ok(open[4] <= -20 && open[4] >= -70, String(open[4]));
  // Kein Geld: Meldung wie im Original
  m.setU8(313, 0);
  for (let i = 0; i < 4; i++) m.setU8(496 + i, 0);
  assert.equal(trainingCamp(g, 0, 7, rng), texte("ui.keinGeld").join(" "));
});

test("Trainingsverletzung nur ohne jeden Merker in Kaderbyte 9 (0x0E6D1, #83 F5)", () => {
  const g = load("RIED-CLI.MAN");
  const kader = g.squadOf(0);
  for (const l of kader) { l.setU8(13, 0); l.setU8(9, 0); }
  // Kleinster Wurf: jeder in Frage kommende Spieler verletzt sich
  const alle = trainingInjuries(g, 0, 2, false, (lo: number) => lo);
  assert.equal(alle.length, kader.length, "ohne Merker trifft es jeden");
  const h = load("RIED-CLI.MAN");
  const k2 = h.squadOf(0);
  for (const l of k2) { l.setU8(13, 0); l.setU8(9, 0x40); } // Angebot eines fremden Vereins
  assert.equal(trainingInjuries(h, 0, 2, false, (lo: number) => lo).length, 0, "mit Angebotsbit keiner");
});

test("Trainingsbalken wie 0x10AF2 über die Plätze 0..Anzahl-1: Starter hinter einer Lücke zählen nicht", () => {
  // Manager 2 hat in beiden Ständen eine Lücke im Kader; nach 0x10AF2 gerechnet ergibt das
  // Technik 17 und Frische 7 bzw. 12 (vorher zählte der Starter hinter der Lücke mit: 18/6, 18/11)
  for (const [f, soll] of [["RIED-6TE.MAN", [19, 17, 7]], ["RUNA5.MAN", [19, 17, 12]]] as const) {
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, f)))));
    assert.deepEqual(trainingBars(g, 2), soll, f);
  }
});
