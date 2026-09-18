/**
 * Torszenen aus einer Beschreibung bauen (GitLab #6, Stufe 1).
 *
 * Eine Szene des Originals ist eine Folge von Bildern; jedes Bild hat einen Kameraausschnitt und
 * 27 Einträge aus x, y und Sprite-Nummer (siehe docs/SPIELMECHANIK.md, "Live-Konferenz und
 * Torszenen"). Bild für Bild zu setzen ist Handarbeit - deshalb beschreibt man hier, **was
 * passiert**, und der Übersetzer rechnet die Bilder aus:
 *
 *     Spieler läuft von (40,60) nach (150,55), Laufphasen, bis Bild 30
 *     Ball folgt ihm bis Bild 30, fliegt dann nach (300,40)
 *     Kamera folgt dem Ball ab Bild 25
 *     Klang "Jubel" ab Bild 44
 *
 * Das ist dasselbe, was der Amiga-Editor mit seinen Animationsphasen gemacht hat, nur lesbar
 * und versionierbar. Aus der Beschreibung entsteht dieselbe Datenstruktur wie aus den Dateien
 * des Originals, sie läuft also ohne Weiteres in der Konferenz.
 */

/** Ein Eintrag im Bild: x, y, Sprite-Nummer. */
export type SzenenSprite = [number, number, number];
/** Ein Bild: Kopfwort (Kamera x im niedrigen, y im hohen Byte) und die Einträge. */
export type SzenenBild = [number, SzenenSprite[]];

export interface Szene {
  header: number[];
  frames: SzenenBild[];
  author: string;
}

/** Grenzen des Formats. */
export const SZENE_GRENZEN = {
  /** Einträge je Bild, harte Grenze des Formats (die Tore zählen mit) */
  sprites: 27,
  /** Bildzahl: im Kopf steht Bildzahl - 1 in einem Byte */
  bilder: 256,
  /** Sprite-Blatt 27.VGA: 168 Zellen, benutzt werden 0..145 */
  sprite: 145,
  breite: 319,
  /** Der Rasen ist 112 hoch, Sprites sitzen bei y + 35 und sind 11 hoch */
  hoehe: 76,
  kameraX: 137,
  kameraY: 16,
} as const;

/** Nummern der beiden Tore; sie stehen an festen Plätzen, die Koordinaten zählen nicht. */
export const TOR_LINKS = 1000;
export const TOR_RECHTS = 1024;
/** y-Wert für unbenutzte Plätze beim Ausfüllen auf 27 Einträge: unterhalb des Rasens. */
export const UNSICHTBAR = 77;

export type Abschnitt =
  /** Stehenbleiben bis einschließlich Bild `bis`. */
  | { art: "halt"; bis: number }
  /** Geradlinig nach `nach` laufen; `phasen` sind die Sprite-Nummern der Laufanimation. */
  | { art: "lauf"; bis: number; nach: [number, number]; phasen?: number[]; takt?: number }
  /** Flugbahn nach `nach` mit Scheitelhöhe `hoehe`; `schatten` ist die Sprite-Nummer am Boden. */
  | { art: "flug"; bis: number; nach: [number, number]; hoehe?: number; schatten?: number }
  /** Einer anderen Figur folgen. */
  | { art: "folgt"; bis: number; wem: string; versatz?: [number, number] };

export interface Figur {
  name: string;
  /** Sprite-Nummer, solange keine Laufphasen greifen. */
  sprite: number;
  /** Startpunkt. */
  pos: [number, number];
  /** Erst ab diesem Bild sichtbar (Vorgabe 0). */
  ab?: number;
  /** Nur bis zu diesem Bild sichtbar. */
  bis?: number;
  bahn?: Abschnitt[];
}

export type Kamera =
  | { art: "fest"; x: number; y?: number }
  | { art: "folgt"; wem: string; ab?: number; y?: number };

/**
 * Zweite Fassung derselben Szene (im Original liegt jede Szene einmal als Tor und einmal als
 * vergebene Chance vor, meist unterscheiden sie sich nur in den letzten Bildern). `ab` sagt, bis
 * wohin alles gleich bleibt; die genannten Figuren bekommen von dort an die angegebene Bahn.
 */
export interface Fassung {
  ab: number;
  figuren: Record<string, Abschnitt[]>;
  klaenge?: (number | null)[];
}

export interface Beschreibung {
  name: string;
  autor?: string;
  bilder: number;
  /** Bis zu vier Bildnummern für die Klänge (null = keiner). */
  klaenge?: (number | null)[];
  kamera?: Kamera;
  /** Beide Tore mitzeichnen (Vorgabe: ja). */
  tore?: boolean;
  figuren: Figur[];
  /** Beschreibung der vergebenen Chance, abgeleitet aus dieser Szene. */
  chance?: Fassung;
}

/**
 * Die zweite Fassung aus der Vorlage ableiten: alles bis `ab` bleibt, danach gelten die
 * angegebenen Bahnen. Abschnitte, die über `ab` hinausreichen, fallen weg.
 */
export function alsFassung(b: Beschreibung, f: Fassung): Beschreibung {
  return {
    ...b,
    klaenge: f.klaenge ?? b.klaenge,
    chance: undefined,
    figuren: b.figuren.map((figur) => {
      const neu = f.figuren[figur.name];
      if (!neu) return figur;
      const behalten = (figur.bahn ?? []).filter((a) => a.bis <= f.ab);
      return { ...figur, bahn: [...behalten, ...neu] };
    }),
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

/** Ort einer Figur in Bild `f`, dazu die Sprite-Nummer. */
function ortVon(figur: Figur, f: number, orte: Map<string, [number, number]>): { x: number; y: number; sprite: number } {
  let x = figur.pos[0];
  let y = figur.pos[1];
  let sprite = figur.sprite;
  let start = 0;
  for (const a of figur.bahn ?? []) {
    const bis = a.bis;
    if (f <= start) break;
    const laenge = Math.max(1, bis - start);
    const t = Math.min(1, (f - start) / laenge);
    if (a.art === "halt") {
      // nichts zu tun, der Ort bleibt
    } else if (a.art === "lauf") {
      const x0 = x;
      const y0 = y;
      x = x0 + (a.nach[0] - x0) * t;
      y = y0 + (a.nach[1] - y0) * t;
      if (a.phasen && a.phasen.length > 0) {
        const takt = a.takt && a.takt > 0 ? a.takt : 2;
        const schritt = Math.floor((f - start) / takt);
        sprite = a.phasen[((schritt % a.phasen.length) + a.phasen.length) % a.phasen.length];
      }
      if (f >= bis) {
        x = a.nach[0];
        y = a.nach[1];
      }
    } else if (a.art === "flug") {
      const x0 = x;
      const y0 = y;
      const hoehe = a.hoehe ?? 12;
      x = x0 + (a.nach[0] - x0) * t;
      y = y0 + (a.nach[1] - y0) * t - hoehe * 4 * t * (1 - t);
      if (f >= bis) {
        x = a.nach[0];
        y = a.nach[1];
      }
    } else if (a.art === "folgt") {
      const ziel = orte.get(a.wem);
      if (ziel) {
        x = ziel[0] + (a.versatz?.[0] ?? 0);
        y = ziel[1] + (a.versatz?.[1] ?? 0);
      }
    }
    if (f <= bis) break;
    start = bis;
  }
  return { x, y, sprite };
}

/** Bodenpunkt einer Flugbahn (für den Schatten). */
function bodenVon(figur: Figur, f: number, orte: Map<string, [number, number]>): number | null {
  let y = figur.pos[1];
  let start = 0;
  for (const a of figur.bahn ?? []) {
    if (f <= start) break;
    const t = Math.min(1, (f - start) / Math.max(1, a.bis - start));
    if (a.art === "flug") {
      const y0 = y;
      y = y0 + (a.nach[1] - y0) * t;
      if (f <= a.bis) return y;
    } else if (a.art === "lauf") {
      y = y + (a.nach[1] - y) * t;
    } else if (a.art === "folgt") {
      const ziel = orte.get(a.wem);
      if (ziel) y = ziel[1] + (a.versatz?.[1] ?? 0);
    }
    if (f <= a.bis) break;
    start = a.bis;
  }
  return null;
}

/** Läuft in Bild `f` gerade ein Flugabschnitt mit Schatten? */
function schattenVon(figur: Figur, f: number): number | null {
  let start = 0;
  for (const a of figur.bahn ?? []) {
    if (f > start && f <= a.bis && a.art === "flug" && a.schatten !== undefined) return a.schatten;
    if (f <= a.bis) break;
    start = a.bis;
  }
  return null;
}

/** Die Beschreibung auf die Grenzen des Formats prüfen; leere Liste heißt in Ordnung. */
export function pruefeBeschreibung(b: Beschreibung): string[] {
  const fehler: string[] = [];
  if (!b.name) fehler.push("Die Szene braucht einen Namen");
  if (!Number.isInteger(b.bilder) || b.bilder < 2 || b.bilder > SZENE_GRENZEN.bilder) {
    fehler.push(`Bildzahl ${b.bilder}: erlaubt sind 2 bis ${SZENE_GRENZEN.bilder}`);
  }
  const namen = new Set<string>();
  for (const f of b.figuren) {
    if (namen.has(f.name)) fehler.push(`Figur "${f.name}" gibt es zweimal`);
    namen.add(f.name);
    if (f.sprite < 0 || f.sprite > SZENE_GRENZEN.sprite) fehler.push(`Figur "${f.name}": Sprite ${f.sprite} gibt es nicht (0 bis ${SZENE_GRENZEN.sprite})`);
    for (const a of f.bahn ?? []) {
      if (a.bis < 0 || a.bis >= b.bilder) fehler.push(`Figur "${f.name}": Abschnitt bis Bild ${a.bis}, die Szene hat ${b.bilder}`);
      if (a.art === "lauf" && a.phasen) {
        for (const p of a.phasen) if (p < 0 || p > SZENE_GRENZEN.sprite) fehler.push(`Figur "${f.name}": Laufphase ${p} gibt es nicht`);
      }
      if (a.art === "flug" && a.schatten !== undefined && (a.schatten < 0 || a.schatten > SZENE_GRENZEN.sprite)) {
        fehler.push(`Figur "${f.name}": Schattensprite ${a.schatten} gibt es nicht`);
      }
      if (a.art === "folgt" && !b.figuren.some((x) => x.name === a.wem)) fehler.push(`Figur "${f.name}" soll "${a.wem}" folgen, die es nicht gibt`);
    }
  }
  if (b.kamera?.art === "folgt" && !b.figuren.some((x) => x.name === b.kamera!.wem)) {
    fehler.push(`Die Kamera soll "${(b.kamera as { wem: string }).wem}" folgen, die es nicht gibt`);
  }
  for (const k of b.klaenge ?? []) {
    if (k !== null && (k < 0 || k >= b.bilder)) fehler.push(`Klang bei Bild ${k}, die Szene hat ${b.bilder}`);
  }
  // Höchstzahl der Einträge je Bild abschätzen: Figuren + Schatten + Tore
  const schatten = b.figuren.filter((f) => (f.bahn ?? []).some((a) => a.art === "flug" && a.schatten !== undefined)).length;
  const tore = b.tore === false ? 0 : 2;
  const meist = b.figuren.length + schatten + tore;
  if (meist > SZENE_GRENZEN.sprites) fehler.push(`Bis zu ${meist} Einträge je Bild, erlaubt sind ${SZENE_GRENZEN.sprites}`);
  return fehler;
}

/**
 * Beschreibung in eine Szene übersetzen. Die Einträge stehen in der Reihenfolge der Figuren;
 * die Tore kommen ans Ende, damit sie vor nichts liegen, was davor gezeichnet wird.
 */
export function baueSzene(b: Beschreibung): Szene {
  const fehler = pruefeBeschreibung(b);
  if (fehler.length) throw new Error(`Beschreibung "${b.name}": ${fehler.join("; ")}`);
  const frames: SzenenBild[] = [];
  for (let f = 0; f < b.bilder; f++) {
    const orte = new Map<string, [number, number]>();
    const sprites: SzenenSprite[] = [];
    for (const figur of b.figuren) {
      const { x, y, sprite } = ortVon(figur, f, orte);
      orte.set(figur.name, [x, y]);
      const sichtbar = f >= (figur.ab ?? 0) && (figur.bis === undefined || f <= figur.bis);
      if (!sichtbar) continue;
      const sn = schattenVon(figur, f);
      if (sn !== null) {
        const boden = bodenVon(figur, f, orte);
        if (boden !== null) sprites.push([clamp(x, 0, SZENE_GRENZEN.breite), clamp(boden, 0, SZENE_GRENZEN.hoehe), sn]);
      }
      sprites.push([clamp(x, 0, SZENE_GRENZEN.breite), clamp(y, 0, SZENE_GRENZEN.hoehe), sprite]);
    }
    if (b.tore !== false) {
      sprites.push([0, 54, TOR_LINKS]);
      sprites.push([296, 54, TOR_RECHTS]);
    }
    if (sprites.length > SZENE_GRENZEN.sprites) {
      throw new Error(`Bild ${f}: ${sprites.length} Einträge, erlaubt sind ${SZENE_GRENZEN.sprites}`);
    }
    // Kamera
    let kx = 0;
    let ky = 0;
    const k = b.kamera;
    if (k?.art === "fest") {
      kx = k.x;
      ky = k.y ?? 0;
    } else if (k?.art === "folgt") {
      const ziel = orte.get(k.wem);
      const ab = k.ab ?? 0;
      kx = ziel && f >= ab ? ziel[0] - 91 : 0;
      ky = k.y ?? 0;
    }
    kx = clamp(kx, 0, SZENE_GRENZEN.kameraX);
    ky = clamp(ky, 0, SZENE_GRENZEN.kameraY);
    frames.push([kx | (ky << 8), sprites]);
  }
  const klaenge = (b.klaenge ?? []).slice(0, 4);
  while (klaenge.length < 4) klaenge.push(null);
  return {
    header: klaenge.map((x) => (x === null ? 255 : x)),
    frames,
    author: (b.autor ?? "REMAKE").slice(0, 24),
  };
}
