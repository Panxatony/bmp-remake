// Bytegenauer Vergleich zweier Spielstände (GitLab #99).
//   node tools/standvergleich.mjs A.MAN B.MAN [max]
// Entschlüsselt beide Stände und listet die Abweichungen, zugeordnet zu den Tabellen der
// Speicherkarte (Manager, Vereine, Tabellen, Spieler, Kaderplätze, Rest).
import { readFileSync } from "node:fs";
import { SaveFile, TABLES } from "../packages/core/src/index.ts";

const [, , a, b, maxArg] = process.argv;
const max = Number(maxArg ?? 60);
const pa = SaveFile.decode(new Uint8Array(readFileSync(a))).plain;
const pb = SaveFile.decode(new Uint8Array(readFileSync(b))).plain;

const tabellen = Object.entries(TABLES).map(([name, t]) => ({ name, offset: t.offset, record: t.record, length: t.length }));
function wo(o) {
  for (const t of tabellen) {
    if (o >= t.offset && o < t.offset + t.length) {
      const i = Math.floor((o - t.offset) / t.record);
      return `${t.name}[${i}]+${(o - t.offset) % t.record}`;
    }
  }
  return `@${o}`;
}

const diffs = [];
for (let o = 0; o < Math.max(pa.length, pb.length); o++) if (pa[o] !== pb[o]) diffs.push(o);
console.log(`${diffs.length} abweichende Bytes (Längen ${pa.length}/${pb.length})`);
const gruppen = new Map();
for (const o of diffs) {
  const w = wo(o).replace(/\+\d+$/, "").replace(/\[\d+\]/, "[]");
  gruppen.set(w, (gruppen.get(w) ?? 0) + 1);
}
for (const [w, n] of [...gruppen].sort((x, y) => y[1] - x[1])) console.log(`  ${w}: ${n}`);
for (const o of diffs.slice(0, max)) console.log(`${String(o).padStart(6)} ${wo(o).padEnd(22)} ${pa[o]} -> ${pb[o]}`);
