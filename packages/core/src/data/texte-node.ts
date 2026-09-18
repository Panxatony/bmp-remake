/**
 * Textkatalog unter Node laden (Server und Tests). Der Browser holt dieselbe Datei über das Netz
 * und ruft `setTexte` selbst auf - deshalb steht der Dateizugriff hier und nicht in texte.ts.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTexte, type Textkatalog } from "./texte.ts";

/** Voreinstellung: assets/text/spiel.json im Projektordner. */
export function textPfad(): string {
  return process.env.BMP_TEXTE ?? resolve(import.meta.dirname, "../../../../assets/text/spiel.json");
}

/**
 * Katalog laden. Fehlt die Datei, bleibt der Katalog leer - der erste Zugriff auf einen Text
 * bricht dann mit einem Hinweis ab (siehe texte.ts).
 */
export function ladeTexte(pfad = textPfad()): boolean {
  if (!existsSync(pfad)) return false;
  setTexte(JSON.parse(readFileSync(pfad, "utf8")) as Textkatalog);
  return true;
}
