// Vergleicht das Kontrollprotokoll eines Originallaufs mit dem Tageslauf des Remakes (#99).
//   node tools/originalvergleich.mjs START.MAN ORIGINAL_NACH.MAN [K]
// START ist der Stand vor dem Tag (derselbe, den drive.py geladen hat), ORIGINAL_NACH der vom
// präparierten Original gespeicherte Stand danach.
import { readFileSync } from "node:fs";
import { SaveFile, GameState, originalRng, originaltag } from "../packages/core/src/index.ts";
import { protokoll, wuerfeBis, PUNKTE } from "./kontrollprotokoll.mjs";

const [, , start, nach, kArg] = process.argv;
const k = Number(kArg ?? 0x1234);
const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(nach))).plain)
  .map((e) => ({ punkt: e.punkt, wurf: wuerfeBis(k, e.zustand) }))
  .filter((e) => e.wurf >= 0);
const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(start))));
const lauf = originaltag(g, originalRng(k));
let gleich = 0;
for (let i = 0; i < lauf.punkte.length; i++) {
  const r = lauf.punkte[i];
  const o = orig[i];
  const ok = o && o.punkt === r.punkt && o.wurf === r.wurf;
  if (!ok) {
    console.log(`Abweichung beim ${i + 1}. Kontrollpunkt: Original ${o ? `${PUNKTE[o.punkt]} Wurf ${o.wurf}` : "-"}, Remake ${PUNKTE[r.punkt]} Wurf ${r.wurf}`);
    for (let j = Math.max(0, i - 3); j < Math.min(lauf.punkte.length, i + 3); j++) console.log(`  ${j + 1}: Original ${orig[j]?.punkt}/${orig[j]?.wurf}  Remake ${lauf.punkte[j].punkt}/${lauf.punkte[j].wurf}`);
    break;
  }
  gleich++;
}
console.log(`${gleich} von ${lauf.punkte.length} Kontrollpunkten gleich (Original hat ${orig.length}). Lauf bis: ${lauf.bis}`);
