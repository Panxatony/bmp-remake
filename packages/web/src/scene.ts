/**
 * Torszenen (TORE/*.T, *.V): Bildfolgen aus 27 Sprites je Bild (x, y, Bildnummer) auf dem
 * 320x112-Hintergrund 26.VGA, Sprites aus 27.VGA (Zellen 12x11, 24 je Zeile; Nummern ab 142
 * sind 4 Pixel breit ab Zellenspalte 4), Tore aus 29.VGA an festen Plätzen (Nummern 1000 und
 * 1024). Gezeigt wird ein Ausschnitt von 182x96 an Bildschirmposition (69,118); der
 * Ausschnitt (x 0..137, y 0..16) steht im Kopfwort jedes Bilds. Gespiegelte Wiedergabe
 * (Angriff nach links) tauscht die Bildnummern wie 0x14A93.
 */
export interface SceneData {
  header: number[];
  frames: [number, number[][]][];
  author: string;
}

export const SCENE_FRAME_MS = 70;
export const VIEW = { x: 69, y: 118, w: 182, h: 96 } as const;

function mirrorId(id: number): number {
  if (id >= 142) return id;
  if (id < 59) return id >= 25 && id < 33 ? id + 59 : 117 - id;
  if (id <= 117) return id >= 84 && id < 92 ? id - 59 : 117 - id;
  return 257 - id;
}

export class Scenes {
  data?: Record<string, SceneData>;
  pitch?: HTMLImageElement;
  sprites?: HTMLImageElement;
  goals?: HTMLImageElement;
  private buffer = document.createElement("canvas");
  private loading?: Promise<void>;

  load(base: string): Promise<void> {
    if (!this.loading) {
      const img = (src: string) =>
        new Promise<HTMLImageElement | undefined>((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = () => res(undefined);
          i.src = src;
        });
      this.loading = (async () => {
        const [data, eigene, pitch, sprites, goals] = await Promise.all([
          fetch(base + "assets/tore/scenes.json").then((r) => (r.ok ? (r.json() as Promise<Record<string, SceneData>>) : undefined)),
          // Selbstgebaute Szenen (GitLab #6): sie kommen zum Katalog des Originals dazu, das
          // Verzeichnis nennt sie beim Namen. Fehlt es, bleibt alles beim Original.
          fetch(base + "assets/eigen/tore/szenen.json")
            .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
            .catch(() => [] as string[]),
          img(base + "assets/tore/pitch.png"),
          img(base + "assets/tore/sprites.png"),
          img(base + "assets/tore/goals.png"),
        ]);
        for (const name of eigene ?? []) {
          const sc = await fetch(`${base}assets/eigen/tore/${name}.json`)
            .then((r) => (r.ok ? (r.json() as Promise<SceneData>) : undefined))
            .catch(() => undefined);
          if (sc && data) data[name] = sc;
        }
        this.data = data;
        this.pitch = pitch;
        this.sprites = sprites;
        this.goals = goals;
        this.buffer.width = 320;
        this.buffer.height = 112;
      })();
    }
    return this.loading;
  }

  /** Katalog neu holen, nachdem eine eigene Szene gespeichert wurde (GitLab #6). */
  neuLaden(base: string): Promise<void> {
    this.loading = undefined;
    return this.load(base);
  }

  get ready(): boolean {
    return !!(this.data && this.pitch && this.sprites && this.goals);
  }

  frames(id: string): number {
    return this.data?.[id]?.frames.length ?? 0;
  }

  /**
   * Kopfbytes der Szene (0x0C7C4 gegen DGROUP 0x52CC..0x52CF): die vier Bildnummern, bei denen
   * das Original die Klänge digi1..digi4 anwirft; 0xFF heißt "kein Klang".
   */
  kopf(id: string): number[] {
    return this.data?.[id]?.header ?? [];
  }

  /** Zeichnet Bild `frame` der Szene in den Ausschnitt; das letzte Bild bleibt stehen. */
  draw(ctx: CanvasRenderingContext2D, id: string, frame: number, mirror: boolean): boolean {
    const sc = this.data?.[id];
    return sc ? this.malen(ctx, sc, frame, mirror) : false;
  }

  /**
   * Dasselbe für eine Szene, die (noch) nicht im Katalog steht - der Torszenen-Editor baut seine
   * Szene im Browser und will sie sehen, wie sie später in der Konferenz läuft (GitLab #6).
   * `ziel` sagt, wohin der Ausschnitt kommt; Vorgabe ist der Platz der Konferenz.
   */
  malen(ctx: CanvasRenderingContext2D, sc: SceneData, frame: number, mirror: boolean, ziel: { x: number; y: number } = VIEW): boolean {
    if (!this.ready || !sc.frames.length) return false;
    const [hdr, sprites] = sc.frames[Math.max(0, Math.min(frame, sc.frames.length - 1))];
    const b = this.buffer.getContext("2d")!;
    b.imageSmoothingEnabled = false;
    b.drawImage(this.pitch!, 0, 0);
    // Tore (0x0C7C4): Nummer 1000 = linkes Tor aus 29.VGA Spalte 0 bei (0,54), 1024 = rechtes Tor
    // aus Spalte 24 bei (296,54); gezeichnet an ihrer Stelle in der Sprite-Reihenfolge, die
    // Koordinaten des Eintrags werden nicht benutzt
    for (const [x0, y, id0] of sprites) {
      if (id0 >= 1000) {
        if (id0 === 1000) b.drawImage(this.goals!, 0, 0, 24, 20, 0, 54, 24, 20);
        else b.drawImage(this.goals!, 24, 0, 22, 20, 296, 54, 22, 20);
        continue;
      }
      const id = mirror ? mirrorId(id0) : id0;
      const small = id >= 142;
      const w = small ? 4 : 12;
      const x = mirror ? 320 - x0 - (small ? 6 : 14) : x0;
      const col = id % 24;
      const row = Math.floor(id / 24);
      b.drawImage(this.sprites!, col * 12 + (small ? 4 : 0), row * 11, w, 11, x, y + 35, w, 11);
    }
    let cx = hdr & 0xff;
    const cy = Math.min(16, hdr >> 8);
    if (mirror) cx = 137 - cx;
    cx = Math.max(0, Math.min(138, cx));
    ctx.drawImage(this.buffer, cx, cy, VIEW.w, VIEW.h, ziel.x, ziel.y, VIEW.w, VIEW.h);
    return true;
  }
}
