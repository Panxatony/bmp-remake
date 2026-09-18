#!/usr/bin/env node
/**
 * szene.mjs - Torszenen aus einer Beschreibung bauen (GitLab #6, Stufe 1).
 *
 *     node tools/szene.mjs pruefen  beschreibung.json
 *     node tools/szene.mjs bauen    beschreibung.json [ziel.json]
 *
 * Die Beschreibung sagt, was passiert (Laufwege, Ballflug, Kameraführung, Klänge); daraus
 * rechnet der Übersetzer die Bilder. Das Format steht in docs/SPIELMECHANIK.md unter
 * "Eigene Torszenen". Vorschau und Ausgabe im BM-Format macht tools/szene.py.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { baueSzene, alsFassung, pruefeBeschreibung } from "../packages/core/src/index.ts";

const [befehl, quelle, ziel] = process.argv.slice(2);
if (!befehl || !quelle) {
  console.error("Aufruf: szene.mjs pruefen|bauen BESCHREIBUNG.json [ZIEL.json]");
  process.exit(2);
}
const b = JSON.parse(readFileSync(quelle, "utf8"));
const fehler = pruefeBeschreibung(b);
if (fehler.length) {
  for (const f of fehler) console.error("Fehler:", f);
  process.exit(1);
}
if (befehl === "pruefen") {
  console.log(`"${b.name}": in Ordnung (${b.bilder} Bilder, ${b.figuren.length} Figuren)`);
  process.exit(0);
}
if (befehl !== "bauen") {
  console.error("Unbekannter Befehl:", befehl);
  process.exit(2);
}
const ordner = ziel ? dirname(ziel) : resolve(dirname(quelle), "..", "assets", "eigen", "tore");
mkdirSync(ordner, { recursive: true });
/** Tor- und Chancenfassung schreiben; im Original heißen sie NAME.T und NAME.V. */
const schreibe = (beschreibung, endung) => {
  const szene = baueSzene(beschreibung);
  const aus = ziel && endung === ".T" ? ziel : join(ordner, `${b.name}${endung}.json`);
  writeFileSync(aus, JSON.stringify(szene));
  const meist = Math.max(...szene.frames.map((f) => f[1].length));
  console.log(`"${b.name}${endung}": ${szene.frames.length} Bilder, höchstens ${meist} Einträge je Bild -> ${aus}`);
};
schreibe(b, ".T");
if (b.chance) schreibe(alsFassung(b, b.chance), ".V");
// Verzeichnis der eigenen Szenen fortschreiben, der Browser liest es beim Laden
const verzeichnis = join(ordner, "szenen.json");
let liste = [];
try {
  liste = JSON.parse(readFileSync(verzeichnis, "utf8"));
} catch {
  /* noch keins */
}
for (const endung of b.chance ? [".T", ".V"] : [".T"]) {
  const name = `${b.name}${endung}`;
  if (!liste.includes(name)) liste.push(name);
}
liste.sort();
writeFileSync(verzeichnis, JSON.stringify(liste, null, 2) + "\n");
console.log(`Verzeichnis: ${liste.length} eigene Szenen -> ${verzeichnis}`);
