/**
 * Bildschirm "Info über <Verein>" (0x2A41E) und das Restprogramm (0x028C4), Zweigbuch
 * docs/abgleich/2A41E.md und anzeigen.md. Beide liefern Zeichenbefehle mit den Koordinaten des
 * Originals: die Tafel steht bei x = 0x59 + 2 · Versatz, y = 0x37 (225 x 175); Texte der kleinen
 * Schrift stehen mit ihrer Oberkante bei (Grundlinie - 4), wie der Web-Client sie zeichnet.
 *
 * Beide Bildschirme würfeln nicht und schreiben nichts in den Spielstand. Der Knopf ANZEIGEN
 * kippt Bit 7 von Vereinsbyte 33 (0x2B282); das macht der Server (`markiereVerein`).
 */
import type { GameState } from "../records.ts";
import { texte, text as T } from "../data/texte.ts";
import { seriesCurrent, clubRecords } from "./history.ts";
import { clubStrength, matchdayView, matchdayDate } from "./display.ts";
import { LEAGUES } from "./fixtures.ts";
import { replays } from "./postpone.ts";
import { dateOfSeasonDay, seasonDay, seasonStartYear } from "./calendar.ts";

/** Farben: 1 = #a2a2c3 (Text), 2 = #8282a2 (gedämpft), 10 = #b2a282 (Knopf), 11 = #d3c3b2 (Titel), 17 = #920010 */
export type Farbe = 1 | 2 | 10 | 11 | 17;

export type InfoBefehl =
  /** kleine Schrift, Oberkante y; mit `bis` mittig zwischen x und bis */
  | { art: "text"; text: string; x: number; y: number; farbe: Farbe; bis?: number; schatten?: boolean }
  /** große Schrift mittig zwischen x und bis, Oberkante y, mit Schatten */
  | { art: "titel"; text: string; x: number; bis: number; y: number }
  | { art: "linie"; x: number; bis: number; y: number; farbe: Farbe }
  | { art: "knopf"; text: string; x: number; y: number; farbe: Farbe; aktion: "zu" | "rest" | "anzeigen" | "info" | "haelfte" };

/** Linke Kante der Tafel (0x2A44F). */
export const infoX = (versatz: number): number => 0x59 + 2 * (versatz ? 1 : 0);
export const INFO_Y = 0x37;
export const INFO_BREITE = 225;
export const INFO_HOEHE = 175;

/** Zahl wie 0x076B:0681 mit Mindestbreite 4cb3:079C: links mit '^' aufgefüllt. */
const zahl = (n: number, breite = 1): string => "^".repeat(Math.max(0, breite - String(n).length)) + n;

const ligaVon = (club: number): number => (club < 18 ? 0 : club < 38 ? 1 : 2);

/** Ist Bit 7 von Vereinsbyte 33 gesetzt (ANZEIGEN)? */
export function vereinMarkiert(g: GameState, club: number): boolean {
  return (g.clubs.at(club).u8(33) & 0x80) !== 0;
}

/** ANZEIGEN (0x2B282): Bit 7 von Vereinsbyte 33 kippen. */
export function markiereVerein(g: GameState, club: number): void {
  const c = g.clubs.at(club);
  c.setU8(33, c.u8(33) ^ 0x80);
}

/**
 * Tore je Spiel wie 0x284D1 mit Modus 2 ("T:G"): je Wert trunc(10 · Tore / Spiele) als "x.y",
 * ohne Spiele 0. Art 0 Heim, 1 Auswärts, 2 gesamt.
 */
export function toreJeSpiel(g: GameState, club: number, art: number): string {
  const s = g.standings.at(club);
  const h = art !== 1 ? 1 : 0;
  const a = art !== 0 ? 1 : 0;
  const spiele = h * s.u8(30) + a * s.u8(31);
  const wert = (tore: number) => {
    const z = spiele ? Math.trunc((10 * tore) / spiele) : 0;
    return `${Math.trunc(z / 10)}.${z % 10}`;
  };
  return `${wert(h * s.u8(22) + a * s.u8(23))}:${wert(h * s.u8(26) + a * s.u8(27))}`;
}

/**
 * "Info über <Verein>" (0x2A41E). `modus` 0 Heim, 1 Auswärts, 2 gesamt (Tabelle über 4cb3:5538);
 * `platz` ist der angezeigte Platz: das Original liest Tabellenbyte 46, das die Heim- und
 * Auswärtssortierung vorher umgeschrieben hat - das Remake reicht den Platz der gezeigten
 * Tabelle durch. `manager` bestimmt den eigenen Verein für die historischen Ergebnisse.
 */
export function vereinsInfo(g: GameState, club: number, modus: number, versatz: number, manager: number, platz?: number): InfoBefehl[] {
  const t = texte("info.texte");
  const si = infoX(versatz);
  const aus: InfoBefehl[] = [];
  const name = (c: number) => g.clubs.at(c).name;
  const text = (s: string, x: number, grund: number, farbe: Farbe = 1) => aus.push({ art: "text", text: s, x, y: grund - 4, farbe });
  // Kopf: Titel in Farbe 11 mittig, darunter der Strich (0x2A4F7, 0x2A51E)
  aus.push({ art: "titel", text: t[0] + name(club), x: si, bis: si + 0xe0, y: INFO_Y + 2 });
  aus.push({ art: "linie", x: si + 1, bis: si + 0xdf, y: INFO_Y + 10, farbe: 11 });
  // Knöpfe (0x2A563 bis 0x2A66C); ANZEIGEN rot, wenn der Verein markiert ist (4cb3:54DC)
  aus.push({ art: "knopf", text: t[23], x: si + 4, y: INFO_Y + 0x9f, farbe: 10, aktion: "zu" });
  aus.push({ art: "knopf", text: t[1], x: si + 0x54, y: INFO_Y + 0x9f, farbe: 10, aktion: "rest" });
  aus.push({ art: "knopf", text: t[2], x: si + 0xa4, y: INFO_Y + 0x9f, farbe: vereinMarkiert(g, club) ? 17 : 10, aktion: "anzeigen" });
  const liga = ligaVon(club);
  const st = g.standings.at(club);
  // "<Platz>. PLATZ IN DER <LIGA>, STÄRKE: <Summe der neun Matrixbytes / 9>" mittig mit Schatten
  const kopf = `${platz ?? st.u8(46) + 1}.${t[3]}${texte("ui.ligen")[liga].toUpperCase()}${t[4]}${clubStrength(g, club).total}`;
  aus.push({ art: "text", text: kopf, x: si, bis: si + 0xe0, y: INFO_Y + 0x12 - 4, farbe: 1, schatten: true });
  let y = INFO_Y + 0x1c;
  const wert = si + 0x6b;
  // Bilanzen (Bytes 38/30/42 heim, 39/31/43 auswärts)
  const bilanz = (s: number, u: number, n: number) => `${s}${t[6]}${u}${t[7]}${n}${t[8]}`;
  text(t[5], si + 3, y);
  text(bilanz(st.u8(38), st.u8(30) - st.u8(38) - st.u8(42), st.u8(42)), wert, y);
  y += 8;
  text(t[9], si + 3, y);
  text(bilanz(st.u8(39), st.u8(31) - st.u8(39) - st.u8(43), st.u8(43)), wert, y);
  y += 8;
  // Die letzten Spiele: Tabellenbytes 4..11 einzeln im Abstand 7
  text(t[10], si + 3, y);
  for (let i = 0; i < 8; i++) {
    const b = st.u8(4 + i);
    if (b) text(String.fromCharCode(b), wert + 7 * i, y);
  }
  y += 8;
  const modusText = texte("info.modus")[modus];
  text(t[11] + modusText, si + 3, y);
  text(toreJeSpiel(g, club, modus), wert, y);
  // 0x284D1 lässt die Mindestbreite 2 stehen: die Serienlängen sind aufgefüllt
  y += 8;
  text(t[12] + modusText, si + 3, y);
  y += 8;
  const erste = y;
  const k = [1, 2, 0][modus];
  const serien = seriesCurrent(g, club);
  let zeilen = 0;
  for (let r = 0; r < 7 && zeilen < 4; r++) {
    const v = serien[r][k];
    if (v <= 1) continue;
    // Vor dem Zeilentext steht ein Text aus 4238:2F2C, der zur Laufzeit belegt wird; im Original
    // erscheint dort in allen drei Ansichten dasselbe Zeichen (das ß der Schrift)
    text(`${zahl(v, 2)}${t[13]}~${texte("info.serien")[r]}`, si + 3, y);
    y += 8;
    zeilen++;
  }
  if (y === erste) {
    text(t[14], si + 10, y, 2);
    y += 8;
  }
  y += 2;
  // Rekorde (0x2AD68): Heim 0..3, Auswärts 4..7, gesamt der bessere von Heim und Auswärts
  const rekorde = clubRecords(g, club);
  const roh = (i: number) => (rekorde[i].text === "" ? 0 : rohRekord(g, club, i));
  const rekordText = (i: number) => (rekorde[i].text === "" ? T("ui.statistik", 1) : `${rekorde[i].text} (${gegnerName(g, rekorde[i].opponent)})`);
  for (let i = modus === 0 ? 0 : 4; i < (modus === 0 ? 4 : 8); i++) {
    if (modus !== 2) {
      text(texte("info.rekorde")[i], si + 3, y);
      text(rekordText(i), wert, y);
    } else {
      text(texte("info.gesamtrekorde")[i - 4], si + 3, y);
      const [rh, ra] = [roh(i - 4), roh(i)];
      let s: string;
      if (rh === 0 && ra === 0) s = rekordText(i - 4);
      else {
        // Siege und Niederlagen nach Tordifferenz der gespeicherten Halbbytes (vorzeichenbehaftet,
        // ohne Betrag), Torrekorde nach dem Rohbyte; bei Gleichstand gewinnt Auswärts
        const d = (b: number) => (b >> 4) - (b & 15);
        const auswaerts = i < 6 ? d(ra) >= d(rh) : ra >= rh;
        s = auswaerts ? rekordText(i) + t[16] : rekordText(i - 4) + t[15];
      }
      text(s, wert, y);
    }
    y += 8;
  }
  y += 2;
  // Historische Ergebnisse gegen den eigenen Verein (0x2AEF5), nicht beim eigenen
  const eigener = g.managers.at(manager).clubIndex;
  if (club !== eigener) {
    text(t[17] + name(eigener), si + 3, y);
    y += 8;
    const p = g.save.plain;
    const basis = 28435 + ((manager << 6) + club) * 10;
    let s = t[18];
    for (const seite of [1, 0]) {
      for (let j = 0; j < 5; j++) {
        const b = p[basis + 2 * j + seite];
        if (b === 0xff) continue;
        if (j !== 0) s += ",";
        s += `${b >> 4}:${b & 15}`;
      }
      if (seite === 1) {
        if (s.length === 3) s += t[19];
        s += t[20];
      } else if (s.endsWith(" ")) s += t[19];
    }
    text(s, si + 3, y);
    y += 10;
  }
  // Punkte in der Ewigen Tabelle (Tabellenbyte 50), ohne Punkte ganz in Farbe 2
  const punkte = st.i32(50);
  text(t[21] + (punkte !== 0 ? String(punkte) : t[22]), si + 3, y, punkte !== 0 ? 1 : 2);
  return aus;
}

/** Rohbyte eines Vereinsrekords (Historie + 3988, 0x2B4D6 gibt es zurück). */
function rohRekord(g: GameState, club: number, i: number): number {
  return g.save.plain[28435 + 3988 + 8 * club + i];
}

function gegnerName(g: GameState, c: number | null): string {
  return c === null ? "" : g.clubs.at(c).name;
}

/**
 * Restprogramm (0x028C4): die Spiele einer Saisonhälfte mit Gegner, dessen Platz und Stärke
 * ("n. (t)", 0x2C128 kurz), Ergebnis oder Datum. `rueck` wählt die Rückrunde; zu Anfang zeigt
 * das Original die Hälfte, in der der nächste Spieltag liegt (0x2911).
 */
export function restprogramm(g: GameState, club: number, versatz: number, rueck: boolean): InfoBefehl[] {
  const t = texte("rest.texte");
  const si = infoX(versatz);
  const aus: InfoBefehl[] = [];
  const liga = ligaVon(club);
  const halb = LEAGUES[liga].matchdays / 2;
  aus.push({ art: "titel", text: `${rueck ? t[1] : t[0]}${t[2]}${g.clubs.at(club).name}`, x: si, bis: si + 0xe0, y: INFO_Y + 2 });
  aus.push({ art: "linie", x: si + 1, bis: si + 0xdf, y: INFO_Y + 10, farbe: 11 });
  aus.push({ art: "knopf", text: texte("info.texte")[23], x: si + 4, y: INFO_Y + 0x9f, farbe: 10, aktion: "zu" });
  aus.push({ art: "knopf", text: t[3], x: si + 0x54, y: INFO_Y + 0x9f, farbe: 10, aktion: "info" });
  aus.push({ art: "knopf", text: rueck ? t[11] : t[10], x: si + 0xa4, y: INFO_Y + 0x9f, farbe: 10, aktion: "haelfte" });
  const x = si + 5;
  let grund = INFO_Y + 17;
  const kopf = (s: string, xx: number) => aus.push({ art: "text", text: s, x: xx, y: grund - 4, farbe: 1 });
  kopf(t[4], x + 0xa);
  kopf(t[5], x + 0x60);
  aus.push({ art: "text", text: t[6], x: x + 0xaa, bis: x + 0xaa, y: grund - 4, farbe: 1 });
  kopf(t[7], x + 0xb7);
  aus.push({ art: "linie", x: x - 4, bis: x + 0xda, y: grund + 2, farbe: 1 });
  grund += 9;
  const nachhol = replays(g);
  const erster = rueck ? halb + 1 : 1;
  for (let md = erster; md < erster + halb; md++) {
    const reihe = matchdayView(g, liga, md);
    const i = reihe.findIndex((r) => r.home === club || r.away === club);
    if (i < 0) continue;
    const r = reihe[i];
    const heim = r.home === club;
    const gegner = heim ? r.away : r.home;
    const farbe: Farbe = heim ? 1 : 2;
    aus.push({ art: "text", text: (heim ? t[8] : t[9]) + g.clubs.at(gegner).name, x, y: grund - 4, farbe });
    const gs = g.standings.at(gegner);
    aus.push({ art: "text", text: `${zahl(gs.u8(46) + 1, 2)}. (${clubStrength(g, gegner).total})`, x: x + 0x69, y: grund - 4, farbe });
    if (r.result) {
      // Die Tore des Vereins stehen vorn, auch auswärts (im Original nachgesehen)
      const [eigene, fremde] = heim ? [r.result.home, r.result.away] : [r.result.away, r.result.home];
      aus.push({ art: "text", text: String(eigene), x: x + 0xbd, y: grund - 4, farbe });
      aus.push({ art: "text", text: ":", x: x + 0xc2, y: grund - 4, farbe });
      aus.push({ art: "text", text: String(fremde), x: x + 0xc7, y: grund - 4, farbe });
    } else {
      // Datum des Spieltags, bei einem verlegten Spiel der Nachholtag
      const n = nachhol.find((e) => e.league === liga && e.matchday === md && e.match === i);
      const d = n ? dateOfSeasonDay(seasonDay(n.dayIndex), seasonStartYear(g)) : matchdayDate(g, liga, md);
      if (d) aus.push({ art: "text", text: `${d.day}.${d.month0 + 1}.`, x: x + 0xac, bis: x + 0xac, y: grund - 4, farbe });
    }
    grund += 7;
  }
  return aus;
}

/** Hälfte, die das Restprogramm zu Anfang zeigt: Rückrunde, wenn der gespielte Spieltag + P über der Hälfte liegt. */
export function restStartRueck(g: GameState, club: number, p = 0): boolean {
  const liga = ligaVon(club);
  return g.nextMatchday(liga) - 1 + p > LEAGUES[liga].matchdays / 2;
}
