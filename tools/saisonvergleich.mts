// Ganzer Spielstand nach dem Saisonwechsel: Modell gegen Original (GitLab #100).
//
// Das Modell (originaltag.ts saisonwechseltag) rechnet ab PS0 (tools/dosbox/KP-SAISON-START.MAN);
// der Zufall wird bei Kontrollpunkt 37 auf die Wurfzahl des Originals gesetzt, weil der
// Spielerpool nicht Wurf für Wurf nachzubauen ist. Mit --tag0 kommt der Tagesbeginn des ersten
// Tages dazu (bis zum ersten Hauptmenü) - so steht es im gespeicherten Stand KP-SAISON.
// Ausgabe je Bereich der Speicherkarte: Zahl der abweichenden Bytes (Original/Remake).
//   node --import packages/core/test/setup.ts tools/saisonvergleich.mts [--tag0] [BEREICH SATZLÄNGE]
import { readFileSync } from "node:fs";
import { SaveFile, GameState, TABLES } from "../packages/core/src/index.ts";
import { saisonwechseltag, originaltag } from "../packages/core/src/sim/originaltag.ts";
import { originalRng } from "../packages/core/src/sim/match.ts";
const D = new URL("./dosbox/", import.meta.url).pathname;
const orig = SaveFile.decode(new Uint8Array(readFileSync(D + "KP-SAISON.MAN"))).plain;
// Wurfzahl bei KP37 im Original
const o = TABLES.lineups.offset + 75 * 52;
const w = (i: number) => orig[o + i] | (orig[o + i + 1] << 8);
const eintr: { punkt: number; z: number }[] = [];
for (let i = 0; i < w(0); i++) eintr.push({ punkt: w(2 + 8 * i), z: (w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0 });
const zaehle = (z: number) => { let s = 0x1234, n = 0; while (s !== z && n < 5e6) { s = (Math.imul(s, 214013) + 2531011) >>> 0; n++; } return n; };
let letzte9 = -1; eintr.forEach((e, i) => { if (e.punkt === 9) letzte9 = i; });
const kp37 = eintr.slice(letzte9 + 1).find((e) => e.punkt === 37)!;
const n37 = zaehle(kp37.z);
let inner = originalRng(0x1234);
const rng = Object.assign((lo: number, hi: number) => inner(lo, hi), { zaehler: () => inner.zaehler() });
let gesetzt = false;
const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(D + "KP-SAISON-START.MAN"))));
let vorAuslosung: Uint8Array | undefined; let wurfVor = 0;
saisonwechseltag(g, rng, [29, 21, 39, 34, -12, 16, -27, 42], (k) => {
  if (k === 98) { vorAuslosung = g.save.plain.slice(); wurfVor = rng.zaehler(); }
  if (k !== 37 || gesetzt) return;
  gesetzt = true; inner = originalRng(0x1234); for (let i = 0; i < n37; i++) inner(0, 0);
});
let p = g.save.plain;
// Tagesbeginn des ersten Tages (srand(0x1234), Finanzen, Schwankung, Aufstellung, Zug) bis zum
// ersten Hauptmenü: so steht es im gespeicherten Stand KP-SAISON
if (process.argv.includes("--tag0")) {
  let schnapp: Uint8Array | undefined;
  try {
    originaltag(g, originalRng(0x1234), undefined, (k) => { if (k === 12 && !schnapp) { schnapp = g.save.plain.slice(); throw new Error("halt"); } });
  } catch (e) { if ((e as Error).message !== "halt") throw e; }
  p = schnapp!;
}
// Bereiche aus der Speicherkarte
const karte: [number, number, string][] = [];
for (const z of readFileSync(new URL("../docs/MEMORY-MAP.md", import.meta.url), "utf8").split("\n")) {
  const m = z.match(/^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([0-9a-f]{4}:[0-9a-f]{4})\s*\|([^|]*)\|/);
  if (m) karte.push([+m[1], +m[2], `${m[3]} ${m[4].trim().slice(0, 30)}`]);
}
const log = TABLES.lineups.offset + 75 * 52;
for (const [s, n, name] of karte) {
  const diffs: number[] = [];
  for (let i = s; i < s + n && i < p.length; i++) if (p[i] !== orig[i] && !(i >= log && i < log + 1300)) diffs.push(i);
  if (!diffs.length) continue;
  if (process.argv[2] && !process.argv[2].startsWith("--") && name.startsWith(process.argv[2])) {
    const rec = Number(process.argv[3] ?? n);
    console.log(name, diffs.map((i) => `[${Math.floor((i - s) / rec)}]+${(i - s) % rec}:${orig[i]}/${p[i]}`).join(" "));
    continue;
  }
  const bsp = diffs.slice(0, 8).map((i) => `+${i - s}:${orig[i]}/${p[i]}`).join(" ");
  console.log(`${String(s).padStart(6)} ${String(n).padStart(5)} ${name.padEnd(40)} ${String(diffs.length).padStart(5)} Bytes  (Orig/Remake) ${bsp}`);
}

if (process.argv[2] === "auslosung" && vorAuslosung) {
  const { initialDraw, clearCupResults } = await import("../packages/core/src/sim/europa.ts");
  for (let d = -60; d <= 60; d++) {
    const h = new GameState(SaveFile.decode(new Uint8Array(readFileSync(D + "KP-SAISON-START.MAN"))));
    h.save.plain.set(vorAuslosung);
    const r = originalRng(0x1234); for (let i = 0; i < wurfVor + d; i++) r(0, 0);
    clearCupResults(h); h.save.plain[34367] = 0;
    initialDraw(h, 0, r);
    let gleich = 0; for (let i = 28009; i < 28137; i++) if (h.save.plain[i] === orig[i]) gleich++;
    const dfb = [...Array(64)].filter((_, i) => h.save.plain[28009 + i] === orig[28009 + i]).length;
    if (dfb > 20) console.log("Versatz", d, "gleich", gleich, "von 128, DFB", dfb, "von 64");
  }
  console.log("Wurf vor Auslosung", wurfVor);
}
