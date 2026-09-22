// Einmaliger Umzug der Dopingangaben (Version 2026) aus Kaderbyte 5/8 nach 44/45 (GitLab #88).
// Aufruf bei gestopptem Server: node tools/migriere-doping.mjs <Stand.MAN> ...
// Schreibt vorher eine Sicherung <Stand.MAN>.vor-88 und rührt Stände ohne 2026-Regeln nicht an.
import { readFile, writeFile, copyFile, access } from "node:fs/promises";
import { SaveFile, GameState, is2026, migriereDopingBytes } from "../packages/core/src/index.ts";

for (const pfad of process.argv.slice(2)) {
  const save = SaveFile.decode(new Uint8Array(await readFile(pfad)));
  const g = new GameState(save);
  if (!is2026(g)) {
    console.log(`${pfad}: Regeln des Originals, nichts zu tun`);
    continue;
  }
  const sicherung = `${pfad}.vor-88`;
  try {
    await access(sicherung);
    console.log(`${pfad}: Sicherung ${sicherung} gibt es schon - schon umgezogen? Übersprungen`);
    continue;
  } catch {}
  const n = migriereDopingBytes(g);
  await copyFile(pfad, sicherung);
  await writeFile(pfad, save.encode());
  console.log(`${pfad}: ${n} Kaderplätze umgezogen, Sicherung ${sicherung}`);
}
