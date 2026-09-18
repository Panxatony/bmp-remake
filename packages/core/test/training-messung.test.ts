/**
 * Trainingswirkung gegen das Original geprüft (GitLab #24).
 *
 * Wie stark eine Trainingseinheit wirkt, steht nirgends im Spielstand - die Werte danach aber
 * schon (Kaderplatz-Bytes 16/17/18 und die Frische in 19). Am 17.9.2026 sind in DOSBox drei
 * Reihen gefahren worden: derselbe Ausgangsstand, feste Trainingseinstellungen, je ein
 * Tageswechsel, danach die Werte aus dem gespeicherten Stand gelesen. Verfahren und Rohwerte:
 * docs/REFERENZ-TRAINING.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, dailyTraining, trainingInput, mulberryRng, dayIndex, seasonDay } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");

/** Ausgangsstand der Messung mit den Einstellungen der Reihe. */
function stand(balls: number, intens: number, level?: number): GameState {
  const save = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-4TE.MAN"))));
  const g = new GameState(save);
  const m = g.managers.at(0);
  for (const o of [321, 322, 323, 324]) m.setU8(o, balls);
  m.setU8(325, intens);
  for (const [o, v] of [[326, 3], [327, 3], [328, 2], [329, 2]] as const) m.setU8(o, balls > 1 ? v : 1);
  if (level !== undefined) save.plain[34062] = level;
  return g;
}

/** Mittlere Frischeänderung eines Tages über viele Würfe. */
function frischeMittel(bauen: () => GameState): number {
  let summe = 0;
  let n = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const g = bauen();
    const vorher = g.squadOf(0).map((l) => l.u8(19));
    // Ein Tageswechsel trainiert für den Tag, an dem er ankommt (0x1DBFE nach dem Hochzählen, #27)
    dailyTraining(g, 0, seasonDay(dayIndex(g) + 1), trainingInput(g), mulberryRng(seed), false);
    g.squadOf(0).forEach((l, i) => {
      summe += l.u8(19) - vorher[i];
      n++;
    });
  }
  return summe / n;
}

test("Training: die Frische ändert sich wie im Original gemessen (#24)", () => {
  // Gemessen: Level 3 mit Intensität 10 -> +5,03; mit Intensität 1 -> -8,78;
  // Level 1 mit Intensität 10 -> +4,81. Je Reihe 64 bzw. 48 Messwerte.
  const reihen: { name: string; bauen: () => GameState; gemessen: number }[] = [
    { name: "volles Budget, Intensität 10", bauen: () => stand(5, 10), gemessen: 5.03 },
    { name: "kleines Budget, Intensität 1", bauen: () => stand(1, 1), gemessen: -8.78 },
    { name: "Level 1, Intensität 10", bauen: () => stand(5, 10, 1), gemessen: 4.81 },
  ];
  for (const r of reihen) {
    const unser = frischeMittel(r.bauen);
    assert.ok(Math.abs(unser - r.gemessen) < 0.6, `${r.name}: unsere ${unser.toFixed(2)}, gemessen ${r.gemessen}`);
  }
});

test("Training: Stärken bewegen sich nur um wenige Punkte, die Form hört bei 55 auf (#24)", () => {
  // Im Original sprang jeder Formwert über 55, der sich änderte, genau auf 55 (AUMANN 59 -> 55,
  // KÖPKE 59 -> 55, BÄURLE 57 -> 55); Kondition und Technik änderten sich um höchstens 3.
  let maxKoTe = 0;
  let formUeber55 = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const g = stand(5, 10);
    const vorher = g.squadOf(0).map((l) => [l.u8(16), l.u8(17), l.u8(18)]);
    // Ein Tageswechsel trainiert für den Tag, an dem er ankommt (0x1DBFE nach dem Hochzählen, #27)
    dailyTraining(g, 0, seasonDay(dayIndex(g) + 1), trainingInput(g), mulberryRng(seed), false);
    g.squadOf(0).forEach((l, i) => {
      for (let k = 0; k < 2; k++) maxKoTe = Math.max(maxKoTe, Math.abs(l.u8(16 + k) - vorher[i][k]));
      const form = l.u8(18);
      if (form > 55) formUeber55++;
      if (form !== vorher[i][2]) assert.ok(form >= 45 && form <= 55, `Form ${vorher[i][2]} -> ${form}`);
    });
  }
  assert.ok(maxKoTe <= 3, `Kondition/Technik änderten sich um ${maxKoTe}`);
  assert.ok(formUeber55 > 0, "unveränderte Formwerte über 55 bleiben stehen");
});

/**
 * Zweite Messung (GitLab #27): ein Tageswechsel über die ganze Winterpause. Ausgangsstand WINT
 * ist RIED-5TE, im Original zwei Tage bis zum 2.12. vorgespult (Kalendertag 36); ein Tageswechsel
 * führt von dort bis zum 21.2. (Kalendertag 59). Unterwegs trainiert das Original an jedem
 * Kalendertag 37..59, 21 davon liegen im Winterfenster (Saisontag 131..206).
 *
 * Die Frische hängt nur an Byte 19, Intensität, Level und Saisontag - der Test setzt deshalb die
 * gemessenen Ausgangswerte in den Kader von RIED-5TE und rechnet dieselben Tage nach.
 */
const WINT_FRISCHE = [60, 60, 60, 75, 123, 60, 69, 73, 84, 60, 105, 60, 64, 84, 122];

function winterpause(balls: number, intens: number, seed: number): number[] {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-5TE.MAN")))));
  const m = g.managers.at(0);
  for (const o of [321, 322, 323, 324]) m.setU8(o, balls);
  m.setU8(325, intens);
  for (const [o, v] of [[326, 3], [327, 3], [328, 2], [329, 2]] as const) m.setU8(o, balls > 1 ? v : 1);
  const kader = g.squadOf(0);
  kader.forEach((l, i) => l.setU8(19, WINT_FRISCHE[i] ?? l.u8(19)));
  for (let k = 37; k <= 59; k++) dailyTraining(g, 0, seasonDay(k), trainingInput(g), mulberryRng(seed * 100 + k), false);
  return g.squadOf(0).map((l) => l.u8(19));
}

test("Training: über die Winterpause erholt sich die Frische wie im Original gemessen (#27)", () => {
  // Intensität 10: in beiden Läufen des Originals standen danach alle 15 Spieler auf genau 150.
  // Mit dem Abreisetag (Kalendertage 36..58) kam der letzte Zuschlag nach der Begrenzung und
  // hob Werte bis 156 - das ist der Befund, der den Ankunftstag festgelegt hat.
  for (let seed = 1; seed <= 40; seed++) assert.deepEqual(winterpause(5, 10, seed), WINT_FRISCHE.map(() => 150), `Lauf ${seed}`);

  // Intensität 1: vier Läufe im Original, Mittel -8,62 je Spieler (die Läufe streuen zwischen
  // etwa -7 und -10). Ohne Winterfenster fielen alle Spieler auf 60 (Mittel -17,3).
  const gemessen = [
    [63, 60, 62, 64, 107, 60, 60, 60, 70, 60, 98, 60, 60, 60, 114],
    [60, 63, 60, 60, 96, 60, 60, 67, 60, 65, 90, 60, 60, 63, 124],
    [60, 60, 62, 60, 95, 61, 60, 60, 76, 62, 73, 60, 62, 60, 89],
    [60, 60, 60, 62, 97, 60, 60, 60, 60, 63, 73, 66, 60, 60, 112],
  ];
  const mittel = (reihen: number[][]) => reihen.flat().reduce((s, v) => s + v, 0) / reihen.flat().length - WINT_FRISCHE.reduce((s, v) => s + v, 0) / WINT_FRISCHE.length;
  const original = mittel(gemessen);
  const unser = mittel(Array.from({ length: 200 }, (_, seed) => winterpause(1, 1, seed + 1)));
  assert.ok(Math.abs(original - -8.62) < 0.01);
  assert.ok(Math.abs(unser - original) < 2.5, `unsere ${unser.toFixed(2)}, gemessen ${original.toFixed(2)}`);
  // Die hohen Werte halten sich über den Winter, statt auf 60 zu fallen
  assert.ok(Math.min(...Array.from({ length: 50 }, (_, seed) => winterpause(1, 1, seed + 1)[4])) > 70);
});
