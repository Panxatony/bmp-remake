/**
 * Textkatalog: alle Texte, die aus dem Original stammen.
 *
 * Im Repo steht keiner dieser Texte. Sie werden beim Einrichten aus der eigenen Installation
 * gelesen (`tools/texte.py` schreibt `assets/text/spiel.json`, gesteuert von
 * `tools/texte-manifest.json` - dort stehen nur Fundstelle, Länge und Prüfsumme). Server und
 * Browser laden die Datei beim Start und geben sie mit `setTexte` hier hinein; der Spielkern
 * fragt sie über `texte(gruppe)` ab.
 *
 * Fehlt der Katalog, bricht der Aufruf mit einem Hinweis ab - ohne die Dateien des Originals
 * lässt sich das Spiel nicht betreiben, und genau das ist beabsichtigt.
 */
export type Textkatalog = Record<string, string[]>;

let katalog: Textkatalog | null = null;

export function setTexte(k: Textkatalog): void {
  katalog = k;
}

export function texteGeladen(): boolean {
  return katalog !== null;
}

/** Alle Texte einer Gruppe. */
export function texte(gruppe: string): string[] {
  if (!katalog) {
    throw new Error("Textkatalog fehlt: assets/text/spiel.json aus dem Original erzeugen (npm run texte)");
  }
  const g = katalog[gruppe];
  if (!g) throw new Error(`Textgruppe fehlt im Katalog: ${gruppe}`);
  return g;
}

/** Ein Text aus einer Gruppe. */
export function text(gruppe: string, i = 0): string {
  const g = texte(gruppe);
  const t = g[i];
  if (t === undefined) throw new Error(`Text ${gruppe}[${i}] fehlt im Katalog`);
  return t;
}
