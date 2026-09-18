/**
 * Stammdaten MANA.DAT (Leser 0x299DC und Spielerpool 0x3260C):
 *   0..63     Logo/Status je deutschem Verein: (Byte + 0x30) & 0x7F
 *   64..663   je Verein 0..199 drei Bytes: Kondition = Technik je Linie (Form und Grundwert werden gewürfelt)
 *   664..983  übersprungen
 *   984..     je Verein 23 Bytes Name; deutsche Vereine (0..63) danach 20 Spielernamen zu 26 Bytes
 */
export interface ManaData {
  logos: number[];
  strength: number[][];
  names: string[];
  /** Spielernamen der 64 deutschen Vereine in Listenreihenfolge: 2 Torhüter, 5 Abwehr, 8 Mittelfeld, 5 Angriff */
  players: string[][];
}

function cstring(buf: Uint8Array, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = buf[off + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export function parseMana(buf: Uint8Array): ManaData {
  if (buf.length < 984 + 200 * 23 + 64 * 520) throw new Error("MANA.DAT zu kurz");
  const logos = Array.from(buf.subarray(0, 64), (b) => (b + 0x30) & 0x7f);
  const strength: number[][] = [];
  for (let c = 0; c < 200; c++) strength.push([buf[64 + 3 * c], buf[65 + 3 * c], buf[66 + 3 * c]]);
  const names: string[] = [];
  const players: string[][] = [];
  let o = 984;
  for (let c = 0; c < 200; c++) {
    names.push(cstring(buf, o, 23));
    o += 23;
    if (c < 64) {
      const list: string[] = [];
      for (let k = 0; k < 20; k++) list.push(cstring(buf, o + 26 * k, 26));
      players.push(list);
      o += 520;
    }
  }
  return { logos, strength, names, players };
}
