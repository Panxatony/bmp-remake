// Wert des obersten Marktspielers aus einem Spielstand lesen
import { readFileSync } from "node:fs";
import { SaveFile, GameState, marketEntries } from "../../packages/core/src/index.ts";
const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(process.argv[2]))));
const e = marketEntries(g).find((x) => x.slot === 0);
console.log(e ? `${e.name}\t${e.price}` : "-\t0");
