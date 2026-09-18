/**
 * Kaufentscheidung der KI gegen das Original geprüft (GitLab #22).
 *
 * Gemessen am 17.9.2026 in DOSBox: Angebote in Stufen des Marktwerts abgegeben und gezählt, wie
 * oft angenommen wurde. Verfahren und Rohwerte: docs/REFERENZ-TRANSFER.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiAccepts, mulberryRng } from "../src/index.ts";

/** Annahmequote unserer Fassung für ein Angebot von `prozent` des Werts. */
function quote(prozent: number, preis = 427_000, laeufe = 20_000): number {
  const rng = mulberryRng(12345);
  let ja = 0;
  for (let i = 0; i < laeufe; i++) if (aiAccepts(preis, Math.round((preis * prozent) / 100), rng)) ja++;
  return ja / laeufe;
}

test("Kaufangebot: die im Original gemessenen Annahmequoten (#22)", () => {
  // Stufe, Versuche, Annahmen im Original
  const messungen: [number, number, number][] = [
    [70, 8, 0],
    [80, 8, 0],
    [100, 50, 27],
    [115, 16, 14],
    [130, 8, 8],
  ];
  for (const [prozent, versuche, ja] of messungen) {
    const unser = quote(prozent);
    const gemessen = ja / versuche;
    // 95-%-Vertrauensbereich der Messung (Wald, mit Rand für die Randfälle)
    const rand = 1.96 * Math.sqrt(Math.max(gemessen * (1 - gemessen), 0.25 / versuche) / versuche);
    assert.ok(
      unser >= gemessen - rand - 0.02 && unser <= gemessen + rand + 0.02,
      `${prozent}%: unsere Quote ${(100 * unser).toFixed(1)} %, gemessen ${(100 * gemessen).toFixed(1)} % (${ja}/${versuche})`,
    );
  }
});

test("Kaufangebot: die beiden Schwellen sitzen (#22)", () => {
  // Unter 75 % des Werts nimmt niemand an, ab 130 % jeder - das ist im Original bestätigt
  assert.equal(quote(70), 0, "70 % wird nie angenommen");
  assert.equal(quote(74), 0, "74 % wird nie angenommen");
  assert.equal(quote(130), 1, "130 % wird immer angenommen");
  assert.equal(quote(140), 1, "140 % wird immer angenommen");
});
