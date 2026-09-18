/**
 * Stromchiffre der Spielstände (*.MAN) von Bundesliga Manager Professional.
 *
 *   c   = (key + (key XOR p)) mod 256
 *   key = (key + 0xD7) mod 256
 *
 * Die Prüfsumme ist (K0 + Summe aller Klartextbytes) mod 256.
 * Unverschlüsselte Bytes (Prüfsummen, Endblock) verändern den Schlüssel nicht.
 */

export const KEY_STEP = 0xd7;

export class Cipher {
  key: number;
  checksum: number;

  constructor(key0: number) {
    this.key = key0 & 0xff;
    this.checksum = key0 & 0xff;
  }

  decrypt(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const p = ((data[i] - this.key) & 0xff) ^ this.key;
      out[i] = p;
      this.key = (this.key + KEY_STEP) & 0xff;
      this.checksum = (this.checksum + p) & 0xff;
    }
    return out;
  }

  encrypt(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      out[i] = (this.key + (this.key ^ p)) & 0xff;
      this.key = (this.key + KEY_STEP) & 0xff;
      this.checksum = (this.checksum + p) & 0xff;
    }
    return out;
  }
}
