/**
 * Zeichenhilfen im Originallook: 320x240-Bildschirm, Bitmap-Schrift aus
 * BMLOADER.EXE, Bilder aus PIC/.
 */

import { setTexte, type Textkatalog } from "../../core/src/data/texte.ts";

const EIGEN = ["abwerben", "arzt", "jugend", "menu-scroll"];

export const W = 320;
export const H = 240;

export const COLORS = {
  panel: "#000071",
  panelDark: "#000050",
  text: "#d4b878",
  textDim: "#a08c58",
  white: "#f3f3f3",
  highlight: "#ffff70",
  frame: "#7c8cb4",
  frameLight: "#b4c0dc",
  frameDark: "#404c78",
  black: "#000000",
  red: "#e03030",
  green: "#60c060",
  paper: "#e8dcc0",
  paperText: "#616182",
  paperShadow: "#303051",
};

export interface FontData {
  height: number;
  first: number;
  widths: number[];
  glyphs: number[][];
  /** Breite eines Zeilenworts in Bit (8 bei den schmalen Schriften, 24 bei der großen) */
  bits?: number;
}

export class Font {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(readonly data: FontData) {}

  width(text: string): number {
    let w = 0;
    for (const ch of text) w += this.advance(ch);
    return w;
  }

  advance(ch: string): number {
    const i = ch.charCodeAt(0) - this.data.first;
    // Leerzeichen: die kleine Schrift hat 2 im Datensatz, bei der großen ist er unbrauchbar;
    // 4 ergibt die im Original gemessene Breite der Hinweiszeile des Trainingslagers.
    if (ch === " " && !this.data.bits) return this.data.height > 6 ? 4 : 2;
    if (i < 0 || i >= this.data.widths.length) return 0;
    return this.data.widths[i] || 0;
  }

  private glyph(ch: string, color: string): HTMLCanvasElement | null {
    const key = ch + color;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const i = ch.charCodeAt(0) - this.data.first;
    if (i < 0 || i >= this.data.glyphs.length) return null;
    const rows = this.data.glyphs[i];
    const bits = this.data.bits ?? 8;
    const c = document.createElement("canvas");
    c.width = bits;
    c.height = this.data.height;
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    rows.forEach((b, y) => {
      for (let x = 0; x < bits; x++) if (b & Math.pow(2, bits - 1 - x)) g.fillRect(x, y, 1, 1);
    });
    this.cache.set(key, c);
    return c;
  }

  /** Fettdruck wie im Spiel: Glyphe doppelt mit einem Pixel Versatz, gleicher Vorschub. */
  bold = false;

  /**
   * Der Schatten des Originals liegt **neben** der Schrift, nicht darunter: dieselbe Zeile,
   * einen Punkt nach rechts. Am Tabellenbildschirm nachgemessen (GitLab #56) - dort trägt die
   * Überschrift einen Schatten in Palettenfarbe 5 und die Bildunterschrift einen schwarzen,
   * und in beiden Fällen bleibt die Zeile unter der Schrift leer. Welche Farbe der Schatten
   * hat, hängt am Bildschirm: `shadow` nimmt deshalb auch eine Farbe statt nur true/false.
   */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = COLORS.text, shadow: boolean | string = true): number {
    let cx = x;
    for (const ch of text) {
      if (ch !== " ") {
        const g = this.glyph(ch, color);
        if (g) {
          if (shadow) {
            const s = this.glyph(ch, typeof shadow === "string" ? shadow : COLORS.black);
            if (s) {
              ctx.drawImage(s, cx + 1, y);
              if (this.bold) ctx.drawImage(s, cx + 2, y);
            }
          }
          ctx.drawImage(g, cx, y);
          if (this.bold) ctx.drawImage(g, cx + 1, y);
        }
      }
      cx += this.advance(ch);
    }
    return cx;
  }

  /** Text um sx/sy vergrößert, optional fett (Tageszahl im Kalender). */
  drawScaled(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sx: number, sy: number, color = COLORS.text, bold = false, shadow = true): void {
    let cx = x;
    for (const ch of text) {
      const g = this.glyph(ch, color);
      const s = this.glyph(ch, COLORS.black);
      if (g && s) {
        if (shadow) ctx.drawImage(s, cx + sx, y + sy, 8 * sx, this.data.height * sy);
        if (shadow && bold) ctx.drawImage(s, cx + 2 * sx, y + sy, 8 * sx, this.data.height * sy);
        ctx.drawImage(g, cx, y, 8 * sx, this.data.height * sy);
        if (bold) ctx.drawImage(g, cx + sx, y, 8 * sx, this.data.height * sy);
      }
      cx += (this.advance(ch) + (bold ? 1 : 0)) * sx;
    }
  }

  /** Fett mit einem Pixel Extra-Vorschub (Kalenderblatt in der kleinen Schrift). */
  drawBold(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = COLORS.text, shadow = true): number {
    const was = this.bold;
    this.bold = true;
    let cx = x;
    for (const ch of text) {
      const g = this.glyph(ch, color);
      if (g && ch !== " ") {
        const s = shadow ? this.glyph(ch, COLORS.black) : null;
        if (s) {
          ctx.drawImage(s, cx + 1, y);
          ctx.drawImage(s, cx + 2, y);
        }
        ctx.drawImage(g, cx, y);
        ctx.drawImage(g, cx + 1, y);
      }
      cx += this.advance(ch) + 1;
    }
    this.bold = was;
    return cx;
  }

  boldWidth(text: string): number {
    let w = 0;
    for (const ch of text) w += this.advance(ch) + 1;
    return w;
  }

  drawRight(ctx: CanvasRenderingContext2D, text: string, right: number, y: number, color = COLORS.text, shadow: boolean | string = true): void {
    this.draw(ctx, text, right - this.width(text), y, color, shadow);
  }

  drawCenter(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color = COLORS.text, shadow: boolean | string = true): void {
    this.draw(ctx, text, Math.round(cx - this.width(text) / 2), y, color, shadow);
  }
}

/** Umlaute in die Schriftbelegung des Spiels umsetzen. */
export function toGame(s: string): string {
  const map: Record<string, string> = { ä: "{", ü: "}", ö: "|", ß: "~", Ä: "[", Ü: "]", Ö: "\\" };
  return s.replace(/[äüößÄÜÖ]/g, (c) => map[c]);
}

/**
 * Großschreiben wie die Kopierroutine 0x3196D des Originals: a..z werden groß, ä ö ü zu Ä Ö Ü,
 * ß bleibt stehen. Die Zeichen stehen dabei schon in der Schriftbelegung des Spiels.
 */
export function upperGame(s: string): string {
  const map: Record<string, string> = { "{": "[", "|": "\\", "}": "]" };
  return s.replace(/[a-z{|}]/g, (c) => map[c] ?? c.toUpperCase());
}

/** Codepage-437-Umlaute der Spielernamen in die Schriftbelegung umsetzen. */
export function cp437ToGame(s: string): string {
  const map: Record<string, string> = { "\x84": "{", "\x94": "|", "\x81": "}", "\x8e": "[", "\x99": "\\", "\x9a": "]", "\xe1": "~" };
  return s.replace(/[\x84\x94\x81\x8e\x99\x9a\xe1]/g, (c) => map[c]);
}

/**
 * Klänge des Originals: SOUND/DIGI.VOC enthält fünf aneinandergehängte Creative-Voice-Dateien,
 * hier als digi0..digi4 entpackt. Der Browser lässt Klänge erst nach der ersten Eingabe zu -
 * das Spiel wird ohnehin geklickt, deshalb reicht es, den ersten Versuch verfallen zu lassen.
 */
export class Sounds {
  private puffer = new Map<string, HTMLAudioElement>();
  private spur?: HTMLAudioElement;
  private laufend?: HTMLAudioElement;
  private basis = "";
  private wartet = false;
  an = true;
  musikAn = true;

  laden(base: string, namen: string[]): void {
    this.basis = base;
    for (const n of namen) {
      const a = new Audio(base + "assets/sound/" + n + ".wav");
      a.preload = "auto";
      this.puffer.set(n, a);
    }
  }

  /**
   * Einen Klang anwerfen. Der Sound Blaster gibt jeweils nur eine Aufnahme aus, deshalb löst
   * ein neuer Klang den laufenden ab (im Original 0x76b:0x182).
   */
  spiele(name: string): void {
    if (!this.an) return;
    const a = this.puffer.get(name);
    if (!a) return;
    const k = a.cloneNode() as HTMLAudioElement;
    this.laufend?.pause();
    this.laufend = k;
    void k.play().catch(() => undefined);
  }

  /**
   * Titelmusik (SOUND/BM2TITLE.CMF, mit tools/cmf/cmf2wav.c über einen OPL2-Emulator gewandelt).
   * Läuft in einer Schleife, solange der Titelbildschirm steht. Browser lassen Musik erst nach
   * der ersten Eingabe zu; schlägt das Abspielen fehl, wird es beim nächsten Klick nachgeholt.
   */
  musik(datei: string): void {
    if (!this.musikAn) return;
    if (!this.spur) {
      this.spur = new Audio(this.basis + "assets/sound/" + datei);
      this.spur.loop = true;
      this.spur.volume = 0.6;
    }
    void this.spur.play().catch(() => {
      if (this.wartet) return;
      this.wartet = true;
      const nach = () => {
        this.wartet = false;
        document.removeEventListener("pointerdown", nach);
        if (this.spur && this.musikAn) void this.spur.play().catch(() => undefined);
      };
      document.addEventListener("pointerdown", nach);
    });
  }

  musikAus(): void {
    if (!this.spur) return;
    this.spur.pause();
    this.spur.currentTime = 0;
  }
}

export function dm(n: number): string {
  const neg = n < 0;
  let s = Math.abs(n).toString();
  s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + s + " DM";
}

export class Assets {
  images = new Map<string, HTMLImageElement>();
  /** Überschriften, Menü, Kalender (8 Zeilen, Strichstärke 2 Pixel) */
  font!: Font;
  /** Schrift 3 des Originals (16 Zeilen): die Tageszahl im Kalenderblatt */
  gross!: Font;
  /** Tabellen (6 Zeilen), 4 Pixel je Zeichen, Schatten statt Fettdruck wie im Spiel */
  micro!: Font;

  async load(base: string): Promise<void> {
    // Textkatalog: die Texte des Originals stehen nicht im Quelltext, sondern werden beim
    // Einrichten aus der eigenen Installation gezogen (tools/texte.py)
    const katalog = await fetch(base + "assets/text/spiel.json");
    if (katalog.ok) setTexte((await katalog.json()) as Textkatalog);
    this.font = new Font((await (await fetch(base + "assets/font/normal.json")).json()) as FontData);
    this.micro = new Font((await (await fetch(base + "assets/font/micro.json")).json()) as FontData);
    this.gross = new Font((await (await fetch(base + "assets/font/gross.json")).json()) as FontData);
    const names = ["0.VGA", "2.VGA", "3.VGA", "4.VGA", "5.VGA", "22.CP", "23.VGA", "21.VGA", "7.VGA", "9.VGA", "30.VGA", "36.VGA", "38.VGA"];
    for (let i = 80; i <= 147; i++) names.push(i + ".VGA");
    names.push("44.VGA"); // Zeitungskopf
    names.push("41.VGA"); // Bild der Scherztage (0x1CF86, #120)
    // Pokale des Abschlussbilds: Meisterschale, DfB-Pokal, Landesmeister, Pokalsieger, UEFA
    for (let i = 50; i <= 54; i++) names.push(i + ".VGA");
    names.push("47.VGA"); // Auslosungstafel
    names.push("46.CP"); // Werbebildschirm
    names.push("45.CP"); // Highscore-Bildschirm mit Kasten und Zeilen (GitLab #60)
    names.push("32.VGA"); // Sponsorenlogos
    names.push("31.VGA"); // Pfeile und Schaltflächen
    names.push("37.VGA"); // Einsatz- und Jugendregler
    names.push("24.VGA", "25.VGA"); // Rahmen der Symbolknöpfe, gedrückt
    names.push("menu-scroll"); // Pfeil hoch / X / Pfeil runter der Meldungen im Hauptmenü
    names.push("43.VGA.a", "3.VGA.a"); // Spinnweben (Lager gesperrt, Menüpunkt gesperrt)
    names.push("40.VGA.a"); // Flutlichtmasten und Anzeigetafeln des Stadionbilds (GitLab #63)
    names.push("1.VGA", "1.VGA.a"); // Trainingsbildschirm: Leisten, Balken, Ball (mit Alpha)
    names.push("6.VGA"); // Spielfeld mit Systemsymbolen
    // Karten, Verletzung, "TOR!" und der Ball neben der Minutenzeile der Konferenz. Das Bild
    // fehlte in dieser Liste, deshalb blieben all diese Symbole unsichtbar (GitLab #56).
    names.push("8.VGA");
    names.push("28.VGA"); // Trainingslager: der Kopf im Kasten (0x119E4 lädt Bild 28)
    names.push("33.VGA"); // Einstellungen: Geschwindigkeitsregler und die Schalter AN/AUS
    names.push("abwerben", "arzt", "jugend"); // eigene Symbole der Version 2026 (tools/icon_*.py)
    for (let i = 9; i <= 18; i++) names.push(i + ".VGA"); // Stadionbilder nach Kapazität und Zustand
    for (let i = 200; i <= 229; i++) names.push(i + ".VGA"); // Zeitungsfotos
    await Promise.all(
      names.map(
        (n) =>
          new Promise<void>((res) => {
            const img = new Image();
            img.onload = () => {
              this.images.set(n, img);
              res();
            };
            img.onerror = () => res();
            // Eigene Bilder (nicht aus dem Original) liegen in assets/eigen
            img.src = base + (EIGEN.includes(n) ? "assets/eigen/" : "assets/pic/") + n + ".png";
          }),
      ),
    );
  }

  img(name: string): HTMLImageElement | undefined {
    return this.images.get(name);
  }

  private masks = new Map<string, HTMLCanvasElement>();

  /**
   * Bild mit einer durchsichtigen Schlüsselfarbe. Das Original blittet mit einer Maskenfarbe
   * (letztes Argument 0xC0 des Blitters 0x3930:0991); in PIC/32.VGA ist das bei den kleinen
   * Sponsorenlogos das reine Gelb rings um das Logo.
   */
  maskedImg(name: string, r: number, g: number, b: number): HTMLCanvasElement | undefined {
    const key = `${name}:${r},${g},${b}`;
    const done = this.masks.get(key);
    if (done) return done;
    const src = this.images.get(name);
    if (!src) return undefined;
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const cx = c.getContext("2d")!;
    cx.drawImage(src, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i] === r && d.data[i + 1] === g && d.data[i + 2] === b) d.data[i + 3] = 0;
    }
    cx.putImageData(d, 0, 0);
    this.masks.set(key, c);
    return c;
  }
}

/** Ausschnitt aus der Symbolsammlung 3.VGA: 6 Spalten x 33 Pixel, 7 Zeilen x 24 Pixel. */
export const ICON = {
  buero: [0, 0], wappen: [1, 0], trikots: [2, 0], pokal: [3, 0], diskette: [4, 0], manager: [5, 0],
  statistik: [0, 1], ewige: [1, 1], verlauf: [2, 1], stadion: [3, 1], bank: [4, 1], werbung: [5, 1],
  tabBL: [0, 2], tab2: [1, 2], tab3: [2, 2], spBL: [3, 2], sp2: [4, 2], sp3: [5, 2],
  staBL: [0, 3], sta2: [1, 3], sta3: [2, 3], taktik: [3, 3], vertrag: [4, 3], transfer: [5, 3],
  training: [0, 4], lager: [1, 4], beste: [2, 4], dfb: [3, 4], landesmeister: [4, 4], pokalsieger: [5, 4],
  uefa: [0, 5], laden: [1, 5], speichern: [2, 5], highscore: [3, 5], optionen: [4, 5], hauptmenu: [5, 5],
  weiter: [0, 6], spielfeld: [1, 6], neu: [2, 6], rechts: [3, 6], links: [4, 6], leer: [5, 6],
  // Verträglichkeit mit älteren Aufrufen
  tabelle: [1, 1], pokale: [2, 1], trikotsAlt: [2, 0], wechsel: [5, 3],
} as const;

export function drawIcon(ctx: CanvasRenderingContext2D, a: Assets, name: keyof typeof ICON, x: number, y: number): void {
  const sheet = a.img("3.VGA");
  if (!sheet) return;
  const [c, r] = ICON[name];
  ctx.drawImage(sheet, c * 33, r * 24, 32, 23, x, y, 32, 23);
}

/**
 * Symbol mit durchsichtiger Farbe 0 über ein vorhandenes legen (Maskenblitter 0x76b:0x2e4). Das
 * Original nimmt das für die Spinnwebe (Symbol 41) auf gesperrten Menüpunkten.
 */
export function drawIconOver(ctx: CanvasRenderingContext2D, a: Assets, name: keyof typeof ICON, x: number, y: number): void {
  const sheet = a.img("3.VGA.a");
  if (!sheet) return;
  const [c, r] = ICON[name];
  ctx.drawImage(sheet, c * 33, r * 24, 32, 23, x, y, 32, 23);
}

/** Rahmenkasten wie im Spiel: heller Rand oben/links, dunkler unten/rechts. */
export function bevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill?: string, inset = false): void {
  const light = inset ? COLORS.frameDark : COLORS.frameLight;
  const dark = inset ? COLORS.frameLight : COLORS.frameDark;
  ctx.fillStyle = COLORS.frame;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  }
}

/** Blaues Textfeld mit Rahmen. */
/**
 * Blauer Kasten wie die Fenster des Originals (am Bildschirm Stärketabelle vermessen): ein
 * Pixel Rand in den Palettenfarben 1 links, 2 oben, 7 rechts und 6 unten, darin Farbe 8, dazu
 * zwei Pixel schwarzer Schatten rechts und unten.
 */
export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = COLORS.panel): void {
  const x1 = x + w - 1;
  const y1 = y + h - 1;
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(x1 + 1, y, 2, h + 2);
  ctx.fillRect(x + 2, y1 + 1, w, 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#a2a2c3";
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "#8282a2";
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillStyle = "#303051";
  ctx.fillRect(x1, y, 1, h - 1);
  ctx.fillStyle = "#414161";
  ctx.fillRect(x, y1, w, 1);
}

/** Schaltfläche mit schwarzem Feld und Beschriftung. */
export function button(ctx: CanvasRenderingContext2D, f: Font, label: string, x: number, y: number, w: number, active = false): void {
  bevel(ctx, x, y, w, 16, COLORS.black);
  f.drawCenter(ctx, label, x + w / 2, y + 4, active ? COLORS.red : COLORS.white);
}

export function hline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color = COLORS.white): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}
