/**
 * Sponsorenangebote gegen das Original geprüft (GitLab #25).
 *
 * Die Angebote würfelt das Original beim Saisonwechsel - und legt sie im Spielstand ab
 * (Beträge ab 33598, Laufzeiten ab 33518). Jeder Spielstand des Originals trägt damit einen
 * Satz echter, vom Original erzeugter Angebote. Dieser Test stellt sie gegen das Band unserer
 * Erzeugung. Auswertung über alle 40 Stände: docs/REFERENZ-WERBUNG.md.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, offerAmount, generateOffers, mulberryRng } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const STAENDE = ["TEST4.MAN", "RIED-CLI.MAN", "RIED.MAN", "TEST3.MAN", "TEST5.MAN", "RIED-2TE.MAN"];

/**
 * Angebote eines Managers gegen das Band unserer Erzeugung halten. Die Zahl der Würfe muss
 * groß genug sein: mit 200 statt 400 fällt ein Bandenangebot aus dem Band, weil die Grenzen
 * dann noch nicht ausgereizt sind.
 */
function pruefe(datei: string, laeufe = 400) {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, datei)))));
  const plain = Uint8Array.from(g.save.plain);
  const bilanz = { trikot: { drin: 0, aus: 0 }, bande: { drin: 0, aus: 0 } };
  g.activeManagers().forEach((_, manager) => {
    const echt: [number, number, number][] = [];
    for (let page = 0; page < 2; page++)
      for (let s = 0; s < 10; s++) {
        const v = offerAmount(g, manager, page, s);
        if (v > 0) echt.push([page, s, v]);
      }
    if (echt.length === 0) return;
    const band: number[][][] = [
      Array.from({ length: 10 }, () => [] as number[]),
      Array.from({ length: 10 }, () => [] as number[]),
    ];
    for (let seed = 1; seed <= laeufe; seed++) {
      g.save.plain.set(plain);
      generateOffers(g, manager, mulberryRng(seed));
      for (let page = 0; page < 2; page++)
        for (let s = 0; s < 10; s++) {
          const v = offerAmount(g, manager, page, s);
          if (v > 0) band[page][s].push(v);
        }
    }
    g.save.plain.set(plain);
    for (const [page, s, v] of echt) {
      const liste = band[page][s];
      const drin = liste.length > 0 && v >= Math.min(...liste) && v <= Math.max(...liste);
      const eintrag = page === 0 ? bilanz.trikot : bilanz.bande;
      if (drin) eintrag.drin++;
      else eintrag.aus++;
    }
  });
  return bilanz;
}

test("Werbung: die Angebote der Originalspielstände liegen im Band unserer Erzeugung (#25)", () => {
  let trikotDrin = 0;
  let trikotAus = 0;
  let bandeDrin = 0;
  let bandeAus = 0;
  for (const datei of STAENDE) {
    if (!existsSync(join(BMP_DIR, datei))) continue;
    const b = pruefe(datei);
    trikotDrin += b.trikot.drin;
    trikotAus += b.trikot.aus;
    bandeDrin += b.bande.drin;
    bandeAus += b.bande.aus;
  }
  assert.ok(trikotDrin + bandeDrin > 100, `zu wenige Angebote geprüft (${trikotDrin + bandeDrin})`);
  // Bandenwerbung: über alle 40 Stände lagen 421 von 421 im Band
  assert.equal(bandeAus, 0, `${bandeAus} Bandenangebote außerhalb des Bandes`);
  // Trikotwerbung: über alle 40 Stände 457 von 486; die Abweichler liegen bis auf einen unter
  // einem Prozent neben der Grenze und erklären sich aus dem Fanwert zur Zeit der Auslosung
  const quote = trikotDrin / (trikotDrin + trikotAus);
  assert.ok(quote >= 0.9, `nur ${(100 * quote).toFixed(1)} % der Trikotangebote im Band`);
});
