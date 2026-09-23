// Liest das Kontrollprotokoll aus einem Spielstand der Testkopie (GitLab #99).
//   node tools/kontrollprotokoll.mjs STAND.MAN [K]
// Je Eintrag: Kennung des Kontrollpunkts und die Zahl der Würfe seit srand(K) - aus dem
// protokollierten Zustand des Zufallsgenerators zurückgerechnet (tools/kontrollpunkte.py).
import { readFileSync } from "node:fs";
import { SaveFile, TABLES } from "../packages/core/src/index.ts";

export const PUNKTE = {
  1: "Treiber (nach Stärke)",
  2: "Spielvorbereitung Liga",
  3: "Spielvorbereitung Pokal",
  4: "Chancen Halbzeit Liga",
  5: "Chancen Halbzeit Pokal",
  6: "Neuauslosung Rot/Verletzung",
  7: "Finanzen Tagesbeginn",
  8: "Finanzen Saisontag",
  9: "Tagesroutine",
  10: "Zug (Marktwurf)",
  11: "Markterneuerung",
  12: "Hauptmenü",
  13: "Spielstärke Flag 1",
  14: "Torwürfel Heim",
  15: "Torwürfel Gast",
  16: "Chancenhandler",
  17: "nach Chancenhandler",
  18: "Wurf Rot",
  19: "Wurf Gelb",
  20: "Wurf Verletzung",
  21: "Halbzeitende",
  22: "Tabelle nach 90",
  23: "KI-Torschützen",
  24: "Zeitung",
  27: "Tagesende (vor srand)",
};

/** Einträge des Protokolls: Kennung und Zustand des Generators. */
export function protokoll(plain) {
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i) => plain[o + i] | (plain[o + i + 1] << 8);
  const n = w(0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const punkt = w(2 + 8 * i);
    // Spur (tools/kontrollpunkte.py): random-Aufruf mit Rücksprungadresse statt Zustand
    if (punkt === 0x8000) out.push({ punkt, aufruf: { off: w(4 + 8 * i), seg: w(6 + 8 * i) } });
    else out.push({ punkt, zustand: (w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0 });
  }
  return out;
}

/** Zahl der Würfe von srand(k) bis zum Zustand z (höchstens `grenze`). */
export function wuerfeBis(k, z, grenze = 5_000_000) {
  let s = k >>> 0;
  for (let n = 0; n <= grenze; n++) {
    if (s === z) return n;
    s = (Math.imul(s, 214013) + 2531011) >>> 0;
  }
  return -1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plain = SaveFile.decode(new Uint8Array(readFileSync(process.argv[2]))).plain;
  const k = Number(process.argv[3] ?? 0x1234);
  let vorher = 0;
  for (const e of protokoll(plain)) {
    if (e.aufruf) {
      console.log(`   random aus ${e.aufruf.seg.toString(16)}:${e.aufruf.off.toString(16)} (Laufzeit)`);
      continue;
    }
    const n = wuerfeBis(k, e.zustand);
    console.log(`${String(e.punkt).padStart(2)} ${(PUNKTE[e.punkt] ?? "?").padEnd(28)} Wurf ${n} (+${n - vorher})`);
    if (n >= 0) vorher = n;
  }
}
