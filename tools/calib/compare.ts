/**
 * Vergleicht die Ergebnisverteilung eines Bundesliga-Spieltags aus N Original-Läufen
 * (RUN*.MAN, jeweils ein Tag nach BASE gespielt) mit der TypeScript-Simulation.
 *
 *   node tools/calib/compare.ts BASE.MAN RUN_PREFIX N [SIM_N]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, simulateMatch, mulberryRng, strengthInput, teamStrength } from "../../packages/core/src/index.ts";

const DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../bmp");
const [base, prefix, nStr, simStr] = process.argv.slice(2);
const load = (f: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(DIR, f)))));
const g0 = load(base);
const md = g0.nextMatchday(0) - 1; // 0-basiert
const pairs = g0.pairings(0).map(([home, away]) => ({ home, away }));
const names = (i: number) => g0.clubs.at(i).str(0, 20).trim();

type Stat = { n: number; hw: number; d: number; aw: number; hg: number; ag: number; goals: number[] };
const stat = (): Stat => ({ n: 0, hw: 0, d: 0, aw: 0, hg: 0, ag: 0, goals: [] });
const add = (s: Stat, h: number, a: number) => {
  s.n++; s.hg += h; s.ag += a; s.goals.push(h + a);
  if (h > a) s.hw++; else if (h === a) s.d++; else s.aw++;
};
const show = (label: string, s: Stat, perMatch?: Map<number, Stat>) => {
  const pct = (v: number) => ((100 * v) / s.n).toFixed(0).padStart(3);
  console.log(`${label.padEnd(10)} n=${s.n} Heim/Unent/Ausw ${pct(s.hw)}/${pct(s.d)}/${pct(s.aw)} %  Tore/Spiel ${(s.hg / s.n).toFixed(2)} : ${(s.ag / s.n).toFixed(2)} = ${((s.hg + s.ag) / s.n).toFixed(2)}`);
  if (perMatch)
    for (const [i, m] of perMatch)
      console.log(`  ${names(pairs[i].home).padEnd(16)} - ${names(pairs[i].away).padEnd(16)} ${(m.hg / m.n).toFixed(2)}:${(m.ag / m.n).toFixed(2)}  H/U/A ${((100 * m.hw) / m.n).toFixed(0)}/${((100 * m.d) / m.n).toFixed(0)}/${((100 * m.aw) / m.n).toFixed(0)}`);
};

// Original
const orig = stat();
const origPer = new Map<number, Stat>();
for (let i = 0; i < Number(nStr); i++) {
  const f = `${prefix}${i}.MAN`;
  if (!existsSync(join(DIR, f))) continue;
  const g = load(f);
  for (let m = 0; m < 9; m++) {
    const r = g.result(0, md, m);
    if (!r || r.postponed) continue;
    add(orig, r.home, r.away);
    if (!origPer.has(m)) origPer.set(m, stat());
    add(origPer.get(m)!, r.home, r.away);
  }
}
show("Original", orig, origPer);

// Simulation mit den Matrizen aus BASE (Managerverein über den Spielweg)
const simN = Number(simStr ?? 2000);
const rng = mulberryRng(12345);
const sim = stat();
const simPer = new Map<number, Stat>();
const managerClub = new Map<number, number>();
g0.activeManagers().forEach((m, mi) => managerClub.set(m.clubIndex, mi));
for (let k = 0; k < simN; k++) {
  for (let m = 0; m < 9; m++) {
    const p = pairs[m];
    const mat = (c: number) => (managerClub.has(c) ? teamStrength(strengthInput(g0, managerClub.get(c)!), rng, true) : g0.clubs.at(c).strengthMatrix);
    const r = simulateMatch(mat(p.home), mat(p.away), rng);
    add(sim, r.home, r.away);
    if (!simPer.has(m)) simPer.set(m, stat());
    add(simPer.get(m)!, r.home, r.away);
  }
}
show("Simulation", sim, simPer);
