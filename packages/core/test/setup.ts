/**
 * Wird vor allen Tests geladen (`--import`): holt den Textkatalog aus assets/text/spiel.json.
 * Die Texte des Originals stehen nicht im Repo, sondern werden mit `npm run texte` erzeugt.
 */
import { ladeTexte, textPfad } from "../src/data/texte-node.ts";

if (!ladeTexte()) {
  console.error(`Textkatalog fehlt (${textPfad()}). Bitte 'npm run texte -- <Pfad>/BMMAIN.EXE' ausführen.`);
  process.exit(1);
}
