/**
 * Lesen und Schreiben der Spielstände (*.MAN).
 *
 * Aufbau: siehe bmp/SPIELSTAND-FORMAT.md und docs/MEMORY-MAP.md.
 *
 * Hinter dem Schluss der Datei darf ein **Anhang** stehen, den nur das Remake liest (Version
 * 2026, siehe sim/jugend.ts). Das Original lädt einen Stand mit Anhang unverändert - im
 * DOSBox-Versuch geprüft -, überschreibt ihn aber beim Speichern. Der Anhang wird hier nur
 * durchgereicht: `decode` hebt ihn auf, `encode` hängt ihn wieder an.
 * Die entschlüsselte Form hat dieselbe Länge und dieselben Offsets wie die
 * Originaldatei. `SaveFile.plain` ist das Speicherabbild, auf dem die
 * typisierten Datensätze (records.ts) arbeiten.
 */
import { Cipher } from "./cipher.ts";

export const SIGNATURE = "WeRnEr_krahe~&~JeNs_onnen>V2\0";
export const HDR_LEN = 35; // Signatur 29 + Spiel-ID 4 + Zufall 1 + Schlüssel 1
export const KEY_OFF = 34;
export const CHK1_OFF = 28006;
export const FIXED_END = 34368;
export const TRAILER_LEN = 12;
export const NMAN_OFF = 2339;
export const MSGCOUNT_OFF = 41;

export interface Message {
  manager: number;
  /** Text in der DOS-Zeichenbelegung des Spiels, Zeilenumbruch = '^'. */
  text: string;
}

export class SaveError extends Error {}

function ascii(b: Uint8Array): string {
  let s = "";
  for (const c of b) s += String.fromCharCode(c);
  return s;
}

function bytesOf(s: string): Uint8Array {
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 0xff);
}

export class SaveFile {
  /** Entschlüsseltes Abbild in Originallänge. */
  plain: Uint8Array;
  /** Anhang hinter dem Dateiende (Version 2026), unverschlüsselt und unangetastet. */
  anhang: Uint8Array = new Uint8Array(0);

  constructor(plain: Uint8Array) {
    this.plain = plain;
  }

  get gameId(): number {
    return new DataView(this.plain.buffer, this.plain.byteOffset).getUint32(29, true);
  }

  get key0(): number {
    return this.plain[KEY_OFF];
  }

  get managerCount(): number {
    return this.plain[NMAN_OFF];
  }

  /** Byteposition des zweiten Prüfsummen-Bytes (Ende der Meldungsliste). */
  messagesEnd(): number {
    let pos = FIXED_END;
    for (let m = 0; m < this.managerCount; m++) {
      const n = this.plain[MSGCOUNT_OFF + m];
      for (let j = 0; j < n; j++) {
        const len = this.plain[pos + 4];
        pos += 5 + len;
      }
    }
    return pos;
  }

  messages(): Message[] {
    const out: Message[] = [];
    let pos = FIXED_END;
    for (let m = 0; m < this.managerCount; m++) {
      const n = this.plain[MSGCOUNT_OFF + m];
      for (let j = 0; j < n; j++) {
        const len = this.plain[pos + 4];
        const raw = this.plain.subarray(pos + 5, pos + 5 + len);
        const end = raw.indexOf(0);
        out.push({ manager: m, text: ascii(end < 0 ? raw : raw.subarray(0, end)) });
        pos += 5 + len;
      }
    }
    return out;
  }

  /** Entschlüsselt eine Originaldatei. Prüft Signatur und beide Prüfsummen. */
  static decode(data: Uint8Array): SaveFile {
    if (ascii(data.subarray(0, SIGNATURE.length)) !== SIGNATURE) {
      throw new SaveError("Keine Bundesliga-Manager-Datei (Signatur fehlt)");
    }
    if (data.length < FIXED_END + 1 + TRAILER_LEN) {
      throw new SaveError("Datei zu kurz");
    }
    const plain = new Uint8Array(data.length);
    plain.set(data.subarray(0, HDR_LEN));
    const c = new Cipher(data[KEY_OFF]);
    plain.set(c.decrypt(data.subarray(HDR_LEN, CHK1_OFF)), HDR_LEN);
    if (c.checksum !== data[CHK1_OFF]) {
      throw new SaveError(`Prüfsumme 1 falsch: ${data[CHK1_OFF]} statt ${c.checksum}`);
    }
    plain[CHK1_OFF] = data[CHK1_OFF];
    plain.set(c.decrypt(data.subarray(CHK1_OFF + 1, FIXED_END)), CHK1_OFF + 1);

    // Meldungsliste: Längen sind selbst verschlüsselt, daher schrittweise.
    let pos = FIXED_END;
    for (let m = 0; m < plain[NMAN_OFF]; m++) {
      const n = plain[MSGCOUNT_OFF + m];
      for (let j = 0; j < n; j++) {
        const head = c.decrypt(data.subarray(pos, pos + 5));
        plain.set(head, pos);
        const len = head[4];
        plain.set(c.decrypt(data.subarray(pos + 5, pos + 5 + len)), pos + 5);
        pos += 5 + len;
      }
    }
    if (c.checksum !== data[pos]) {
      throw new SaveError(`Prüfsumme 2 falsch: ${data[pos]} statt ${c.checksum}`);
    }
    const ende = pos + 1 + TRAILER_LEN;
    if (data.length < ende) {
      throw new SaveError(`Unerwartete Dateilänge ${data.length}, erwartet ${ende}`);
    }
    plain.set(data.subarray(pos, ende), pos);
    const datei = new SaveFile(plain.subarray(0, ende));
    // Alles hinter dem Schluss ist unser Anhang (Version 2026); das Original ignoriert ihn.
    if (data.length > ende) datei.anhang = Uint8Array.from(data.subarray(ende));
    return datei;
  }

  /**
   * Kopie mit neuer Meldungsliste. Jeder Eintrag: 4 Byte Zeiger (Laufzeit, 0), Längenbyte,
   * Text "Datum^Zeile^...^" mit Nullabschluss (Länge zählt den Nullabschluss mit).
   */
  withMessages(messages: Message[]): SaveFile {
    // Der Schluss (Prüfsumme 2 und Anhang) steht immer am Dateiende. Ihn von dort zu nehmen
    // statt ab messagesEnd() hält den Puffer auch dann stimmig, wenn die Meldungszähler nicht
    // zum Inhalt passen (etwa nach einem neuen Spiel mit weniger Managern als in der Vorlage).
    const trailer = this.plain.subarray(this.plain.length - (TRAILER_LEN + 1));
    const chunks: Uint8Array[] = [];
    const counts = [0, 0, 0, 0];
    for (let m = 0; m < this.managerCount; m++) {
      for (const msg of messages) {
        if (msg.manager !== m) continue;
        let text = msg.text;
        if (!text.endsWith("^")) text += "^";
        const bytes = new Uint8Array(5 + text.length + 1);
        bytes[4] = text.length + 1;
        for (let i = 0; i < text.length; i++) bytes[5 + i] = text.charCodeAt(i) & 0xff;
        chunks.push(bytes);
        counts[m]++;
      }
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const plain = new Uint8Array(FIXED_END + total + trailer.length);
    plain.set(this.plain.subarray(0, FIXED_END));
    for (let m = 0; m < 4; m++) plain[MSGCOUNT_OFF + m] = counts[m];
    let pos = FIXED_END;
    for (const c of chunks) {
      plain.set(c, pos);
      pos += c.length;
    }
    plain.set(trailer, pos);
    const kopie = new SaveFile(plain);
    kopie.anhang = this.anhang;
    return kopie;
  }

  /** Kopie mit einer zusätzlichen Meldung für einen Manager (Text im DOS-Zeichensatz, Zeilen mit '^'). */
  addMessage(manager: number, text: string): SaveFile {
    return this.withMessages([...this.messages(), { manager, text }]);
  }

  /** Kopie ohne die Meldungen eines Managers. */
  clearMessages(manager: number): SaveFile {
    return this.withMessages(this.messages().filter((m) => m.manager !== manager));
  }

  /** Verschlüsselt das Abbild wieder, Prüfsummen werden neu berechnet. */
  encode(): Uint8Array {
    const p = this.plain;
    const out = new Uint8Array(p.length);
    out.set(p.subarray(0, HDR_LEN));
    const c = new Cipher(p[KEY_OFF]);
    out.set(c.encrypt(p.subarray(HDR_LEN, CHK1_OFF)), HDR_LEN);
    out[CHK1_OFF] = c.checksum;
    const end = this.messagesEnd();
    out.set(c.encrypt(p.subarray(CHK1_OFF + 1, end)), CHK1_OFF + 1);
    out[end] = c.checksum;
    out.set(p.subarray(end + 1), end + 1);
    if (this.anhang.length === 0) return out;
    const mit = new Uint8Array(out.length + this.anhang.length);
    mit.set(out);
    mit.set(this.anhang, out.length);
    return mit;
  }

  /** Erzeugt eine Kopie mit neuer Spiel-ID und neuem Schlüssel. */
  withFreshHeader(random: () => number = Math.random): SaveFile {
    const plain = new Uint8Array(this.plain);
    const dv = new DataView(plain.buffer);
    dv.setUint32(29, Math.floor(random() * 0xffffffff) >>> 0, true);
    plain[33] = Math.floor(random() * 256);
    plain[34] = (Math.floor(random() * 256) + 0x78) & 0xff;
    const kopie = new SaveFile(plain);
    kopie.anhang = this.anhang;
    return kopie;
  }
}

/**
 * Zeichen der DOS-Version in Unicode. Meldungstexte nutzen { } | ~ [ ] \ für
 * ä ü ö ß Ä Ü Ö, Spielernamen die Codepage 437 (0x84 ä, 0x94 ö, 0x81 ü, ...).
 */
export function dosText(s: string): string {
  const map: Record<string, string> = {
    "{": "ä", "}": "ü", "|": "ö", "~": "ß", "[": "Ä", "]": "Ü", "\\": "Ö",
    "\x84": "ä", "\x94": "ö", "\x81": "ü", "\x8e": "Ä", "\x99": "Ö", "\x9a": "Ü", "\xe1": "ß",
  };
  return s.replace(/[{}|~\[\]\\\x84\x94\x81\x8e\x99\x9a\xe1]/g, (ch) => map[ch]);
}

export function toDosText(s: string): string {
  const map: Record<string, string> = {
    ä: "{", ü: "}", ö: "|", ß: "~", Ä: "[", Ü: "]", Ö: "\\",
  };
  return s.replace(/[äüößÄÜÖ]/g, (ch) => map[ch]);
}

export { bytesOf as dosBytes };
