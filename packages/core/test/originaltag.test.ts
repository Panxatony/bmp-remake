/**
 * Bytegenauer Vergleich (GitLab #99): der Tageslauf in Originalreihenfolge würfelt Wurf für Wurf
 * wie ein präpariertes Original (tools/seed-patch.py "tag" + tools/kontrollpunkte.py), das
 * TEST4 einen Tag weitergespielt hat (tools/dosbox/KP-TEST4.MAN). Einträge der random-Spur
 * (Kennung 0x8000) tragen keinen Zustand und bleiben außen vor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, originalRng, originaltag, saisonwechseltag, TABLES, calendarFlag } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const KP = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4.MAN");

/** Würfe seit srand(0x1234) bis zum Zustand z. */
function wuerfe(z: number): number {
  let s = 0x1234;
  let n = 0;
  while (s !== z && n < 3_000_000) {
    s = (Math.imul(s, 214013) + 2531011) >>> 0;
    n++;
  }
  return s === z ? n : -1;
}

function protokoll(plain: Uint8Array): { punkt: number; wurf: number }[] {
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const out: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < w(0); i++) {
    if (w(2 + 8 * i) === 0x8000) continue;
    const n = wuerfe((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0);
    if (n >= 0) out.push({ punkt: w(2 + 8 * i), wurf: n });
  }
  return out;
}

// Die Vorlage ist ein Spielstand des Originals und liegt nur lokal vor (.gitignore)
test("Originaltag TEST4: die Würfe stimmen an jedem erreichten Kontrollpunkt", { skip: !existsSync(KP) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(KP))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  // Die Vorlage hat nur einen Teil der Kontrollpunkte eingebaut
  const ids = new Set(orig.map((p) => p.punkt));
  // Bis zu den Chancen der ersten Halbzeit: danach klickte der Treiber in diesem Lauf noch in die
  // Konferenz (vor der Korrektur in drive.py), das Original ließ dadurch Minuten aus
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt)).slice(0, 71);
  assert.equal(lauf.length, 71);
  lauf.forEach((p, i) => assert.deepEqual(p, orig[i], `Kontrollpunkt ${i + 1}`));
});

// Beide Halbzeiten (kontrollpunkte.py --still 7,10,12,13): Chancen, Neuauslosung,
// Chancenhandler und Halbzeitende, mit der Neuberechnung der Stärke in der Pause
const SPIEL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-SPIEL.MAN");
test("Originaltag TEST4: beide Halbzeiten bis zum Schlusspfiff", { skip: !existsSync(SPIEL) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(SPIEL))).plain);
  const ids = new Set(orig.map((p) => p.punkt));
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt));
  const bisSchluss = orig.slice(0, orig.findLastIndex((p) => p.punkt === 21) + 1);
  assert.ok(bisSchluss.length >= 79, `nur ${bisSchluss.length} Punkte bis zum Schlusspfiff`);
  assert.deepEqual(lauf.slice(0, bisSchluss.length), bisSchluss);
});

// Nach dem Schlusspfiff (kontrollpunkte.py mit 21, 22, 23, 8, 9): Tabelle mit Grundzuschlag,
// Torschützen der KI-Vereine, Stärke bei der Ergebnisübersicht, dann die Sportzeitung - die
// Finanzen des Saisontags (Punkt 8) beginnen genau dort, wo die Zeitung endet
const BUCHUNG = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-BUCHUNG.MAN");
test("Originaltag TEST4: Ligabuchung und Zeitung nach dem Schlusspfiff", { skip: !existsSync(BUCHUNG) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(BUCHUNG))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const punkte = originaltag(g, originalRng(0x1234)).punkte;
  const ids = new Set([1, 21, 22, 23]);
  const bisFinanzen = orig.slice(0, orig.findIndex((p) => p.punkt === 8));
  assert.deepEqual(punkte.filter((p) => ids.has(p.punkt)), bisFinanzen);
  const finanzen = orig.find((p) => p.punkt === 8);
  assert.equal(punkte.find((p) => p.punkt === 25)?.wurf, finanzen?.wurf, "Zeitung endet vor den Finanzen des Saisontags");
});

// Der ganze Tag (Punkte 9 und 27): Tagesroutine aller Manager und das Tagesende vor dem srand des
// nächsten Tages. Die Lagerzeiten beim Laden stammen aus einer Messung (sie stehen nicht im Stand).
const TAG = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-TAG.MAN");
test("Originaltag TEST4: Tagesroutine und Tagesende", { skip: !existsSync(TAG) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(TAG))).plain);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const punkte = originaltag(g, originalRng(0x1234), [-40, 7, 56, -53, 11, 31, 60, 13]).punkte;
  assert.deepEqual(punkte.filter((p) => p.punkt === 9), orig.filter((p) => p.punkt === 9));
  const ende = orig.filter((p) => p.punkt === 27).at(-1);
  assert.equal(punkte.find((p) => p.punkt === 26)?.wurf, ende?.wurf, "Tagesende");
});

// Ringprotokoll (kontrollpunkte.py --ring 1 --halt 21): die letzten 160 Punkte der ersten
// Halbzeit - Karten, Verletzungen, Torwürfel, Chancenhandler - nach Wurfzahl geordnet
const RING = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST4-RING.MAN");
test("Originaltag TEST4: Minutenschleife der ersten Halbzeit Wurf für Wurf", { skip: !existsSync(RING) || !existsSync(join(BMP_DIR, "TEST4.MAN")) }, () => {
  const plain = SaveFile.decode(new Uint8Array(readFileSync(RING))).plain;
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const orig: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const punkt = w(2 + 8 * i);
    if (!punkt || punkt & 0x8000) continue;
    orig.push({ punkt, wurf: wuerfe((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0) });
  }
  orig.sort((a, b) => a.wurf - b.wurf);
  const ids = new Set(orig.map((p) => p.punkt));
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234)).punkte.filter((p) => ids.has(p.punkt) && p.wurf >= orig[0].wurf && p.wurf <= orig[orig.length - 1].wurf);
  assert.equal(orig.length, 160);
  assert.deepEqual(lauf, orig);
});

// DFB-Pokaltag (TEST1, Viertelfinale mit Verlängerung; kontrollpunkte.py --ohne 2,4,11,14,15,17,
// 18,19,20,22,23,24,28): Vorbereitung je Paar, vier Halbzeiten - die Verlängerung würfelt Chancen
// für alle Paare, den Torwürfel aber nur das offene -, Rundenabschluss und die Folgetage mit dem
// Sondertag 12.11. bis zum Tagesende. Die Lagerzeiten sind aus dem Abzug am Tagesende
// zurückgerechnet (der Abzug hält den letzten Punkt 27 fest, nicht den beim Laden).
const POKAL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST1-POKAL.MAN");
test("Originaltag TEST1: DFB-Pokaltag bis zum Tagesende", { skip: !existsSync(POKAL) || !existsSync(join(BMP_DIR, "TEST1.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(POKAL))).plain);
  // Das Protokoll läuft in den nächsten Tag hinein; es zählt bis zum ersten Tagesende
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST1.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [4, 44, 21, 35, -22, -30, 26, -38]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 57);
  assert.deepEqual(punkte, bisEnde);
});

// Derselbe DFB-Pokaltag mit srand(12) (seed-patch.py ... 12 tag, gleiche Kontrollpunkte): eine
// Verletzung bei Nürnberg - danach würfelt der Chancenhandler die Trage (0x1C3AC) -, Hertha gegen
// Braunschweig geht ohne Managerverein in Verlängerung und Elfmeterschießen. Dort gibt es keine
// Vorfälle für die entschiedenen Managerspiele (4cb3:2E99), und 0x666D würfelt den ersten Schützen
// auch im kurzen Zweig. KP-K12-VERLETZUNG hält nach der Neuauslosung an (--halt 6, mit 3, 5, 18-20).
function protokollK(plain: Uint8Array, k: number): { punkt: number; wurf: number }[] {
  const o = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => plain[o + i] | (plain[o + i + 1] << 8);
  const zaehle = (z: number) => {
    let s = k;
    let n = 0;
    while (s !== z && n < 3_000_000) {
      s = (Math.imul(s, 214013) + 2531011) >>> 0;
      n++;
    }
    return s === z ? n : -1;
  };
  const out: { punkt: number; wurf: number }[] = [];
  for (let i = 0; i < w(0); i++) {
    if (w(2 + 8 * i) === 0x8000) continue;
    const n = zaehle((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0);
    if (n >= 0) out.push({ punkt: w(2 + 8 * i), wurf: n });
  }
  return out;
}
for (const [datei, bisTagesende] of [["KP-K12-POKAL", true], ["KP-K12-VERLETZUNG", false]] as const) {
  const pfad = resolve(import.meta.dirname, `../../../tools/dosbox/${datei}.MAN`);
  test(`Originaltag TEST1 mit srand(12): ${datei}`, { skip: !existsSync(pfad) || !existsSync(join(BMP_DIR, "TEST1.MAN")) }, () => {
    const orig = protokollK(SaveFile.decode(new Uint8Array(readFileSync(pfad))).plain, 12);
    const ende = orig.findIndex((p) => p.punkt === 27 && p.wurf > 0);
    const soll = bisTagesende ? orig.slice(0, ende + 1) : orig;
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST1.MAN")))));
    const ids = new Set(soll.map((p) => p.punkt));
    const lauf = originaltag(g, originalRng(12), [4, 44, 21, 35, -22, -30, 26, -38]).punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
    assert.equal(soll.length, bisTagesende ? 38 : 47);
    assert.deepEqual(lauf.slice(0, soll.length), soll);
  });
}

// Europapokaltag ohne Managerverein (TEST2, Hinspiele aller drei Wettbewerbe; Punkte wie beim
// DFB-Pokaltag): 12 Paare, zwei Halbzeiten, der Rundenabschluss nach dem Hinspiel würfelt nicht.
// Der Abzug der Lagerzeiten ist hier vom Protokoll überschrieben; die Startwerte sind so gewählt,
// dass wie im Original beim 6. und 7. Aufruf neu gezogen wird.
const EUROPA = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST2-EUROPA.MAN");
test("Originaltag TEST2: Europapokaltag bis zum Tagesende", { skip: !existsSync(EUROPA) || !existsSync(join(BMP_DIR, "TEST2.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(EUROPA))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST2.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [6, 7, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 61);
  assert.deepEqual(punkte, bisEnde);
});

// Europapokal-Rückspieltag ohne Managerverein (RUNA0, 4.10.): offene Rückspiele gehen in die
// Verlängerung (0x19208), danach Elfmeterschießen und die Auslosung der nächsten Runde. An den
// Folgetagen zieht kein Lager neu; die Startwerte sind entsprechend gewählt.
const RUECKSPIEL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RUNA0-RUECKSPIEL.MAN");
test("Originaltag RUNA0: Europapokal-Rückspieltag bis zum Tagesende", { skip: !existsSync(RUECKSPIEL) || !existsSync(join(BMP_DIR, "RUNA0.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(RUECKSPIEL))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RUNA0.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [60, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 147);
  assert.deepEqual(punkte, bisEnde);
});

// Nachholtag ohne Managerverein (RUN0, 22.11., neun Nachholspiele; kontrollpunkte.py --ohne
// 3,5,11,14,15,17,18,19,20,22,23,24,28): Vorbereitung und Live-Schleife wie in der Liga, die Seite
// "NACHHOLSPIELE" rechnet zur Halbzeit und nach der 90. die Stärke aller Manager neu. Ein Lager
// zieht beim 2. Aufruf neu.
const NACHHOL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RUN0-NACHHOL.MAN");
test("Originaltag RUN0: Nachholtag bis zum Tagesende", { skip: !existsSync(NACHHOL) || !existsSync(join(BMP_DIR, "RUN0.MAN")) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(NACHHOL))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RUN0.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [2, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 52);
  assert.deepEqual(punkte, bisEnde);
});

// Ligaspieltag im Winterfenster (TEST3, 18.11.; Punkte wie beim Nachholtag): Verlegungen je Liga
// (0x3563/0x36F1) vor dem Treiber, verlegte Paarungen laufen in der Konferenz ohne Würfel mit, die
// seltene Jubelszene würfelt ihre Nummer. Dazu die Tabellen aller Vereine nach dem Spieltag (ohne
// den Tabellenplatz, Byte 46, den der Vergleichslauf nicht fortschreibt). Lager ziehen beim 3., 8.
// und 11. Aufruf neu.
const WINTER = resolve(import.meta.dirname, "../../../tools/dosbox/KP-TEST3-WINTER.MAN");
test("Originaltag TEST3: Wintertag mit Verlegungen bis zum Tagesende", { skip: !existsSync(WINTER) || !existsSync(join(BMP_DIR, "TEST3.MAN")) }, () => {
  const plain = SaveFile.decode(new Uint8Array(readFileSync(WINTER))).plain;
  const orig = protokoll(plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST3.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [3, 8, 11, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 125);
  assert.deepEqual(punkte, bisEnde);
  const T = TABLES.standings;
  for (let i = 0; i < 58; i++)
    for (let k = 0; k < T.record; k++) if (k !== 46) assert.equal(g.save.plain[T.offset + i * T.record + k], plain[T.offset + i * T.record + k], `Tabelle Verein ${i} Byte ${k}`);
  // Verlegt wie im Original: dieselben Nachholtermine
  assert.deepEqual(g.save.plain.subarray(5458, 5558), plain.subarray(5458, 5558));
});

// Nachholtag mit Managerderby (RIED-4TE, 4.4.: 35 gegen 34): Vorbereitung, Karten, Chancenhandler
// und die beiden Zeitungen - der Bericht zählt nur die Karten des eigenen Managers. Danach ist die
// Nachholmarke im Kalender gelöscht, und die Tagesroutine hält den Tag für spielfrei (Trainings-
// verletzung mit dem Zuschlag). Ein Lager zieht beim 6. Aufruf neu.
const DERBY = resolve(import.meta.dirname, "../../../tools/dosbox/KP-RIED4-NACHHOL.MAN");
test("Originaltag RIED-4TE: Nachholtag mit Managerderby bis zum Tagesende", { skip: !existsSync(DERBY) || !existsSync(join(BMP_DIR, "RIED-4TE.MAN")) }, () => {
  const plain = SaveFile.decode(new Uint8Array(readFileSync(DERBY))).plain;
  const orig = protokoll(plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-4TE.MAN")))));
  const lauf = originaltag(g, originalRng(0x1234), [6, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 58);
  assert.deepEqual(punkte, bisEnde);
  assert.deepEqual(g.save.plain.subarray(5458, 5558), plain.subarray(5458, 5558), "Nachholtabelle");
  assert.equal(calendarFlag(g, 71), calendarFlag(new GameState(SaveFile.decode(new Uint8Array(readFileSync(DERBY)))), 71), "Kalendermarke gelöscht");
});

// DFB-Pokalfinale ohne Managerverein (aus RIED2017 zwei Tage mit festem Zufall weitergespielt,
// 26.5.): feste Kulisse, keine Auslosung danach. Dabei gefunden: der Transfermarkt bleibt nach
// Spielernummer geordnet (0x224A8), neue Spieler werden einsortiert - sonst trifft die
// Markterneuerung mit random(0,11) andere Plätze.
const FINALE = resolve(import.meta.dirname, "../../../tools/dosbox/KP-FINALE.MAN");
const FINALE_START = resolve(import.meta.dirname, "../../../tools/dosbox/KP-FINALE-START.MAN");
test("Originaltag FA0: DFB-Pokalfinale bis zum Tagesende", { skip: !existsSync(FINALE) || !existsSync(FINALE_START) }, () => {
  const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(FINALE))).plain);
  const bisEnde = orig.slice(0, orig.findIndex((p) => p.punkt === 27 && p.wurf > 0) + 1);
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(FINALE_START))));
  const lauf = originaltag(g, originalRng(0x1234), [60, 60, 60, 60, -60, -60, 60, 60]);
  const ids = new Set(bisEnde.map((p) => p.punkt));
  const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
  assert.equal(bisEnde.length, 31);
  assert.deepEqual(punkte, bisEnde);
  const markt = [...Array(12).keys()].map((s) => g.lineups.at(100 + s).playerIndex).filter((x) => x > 0);
  assert.deepEqual(markt, markt.slice().sort((a, b) => a - b), "Markt nach Spielernummer");
});

// Relegation (Flag 0x10, aus RIED2017 mit festem Zufall weitergespielt): Hin- und Rückspiel
// Bundesliga-16. gegen Zweitliga-3. über Pokalbereich 1, Abschluss ohne Auslosung. Nach dem
// Rückspiel kommt kein normaler Tagesbeginn mehr (Saisonwechsel), das Protokoll endet mit den
// Tagesroutinen, die ab Saisontag 322 nicht mehr würfeln.
for (const [name, start, lager, anzahl] of [
  ["KP-RELEG1", "KP-RELEG1-START", [6, 60, 60, 60, -60, -60, 60, 60], 28],
  ["KP-RELEG2", "KP-RELEG2-START", [1, 9, 10, 60, -60, -60, 60, 60], 30],
] as const) {
  const vorlage = resolve(import.meta.dirname, `../../../tools/dosbox/${name}.MAN`);
  const stand = resolve(import.meta.dirname, `../../../tools/dosbox/${start}.MAN`);
  test(`Originaltag ${name}: Relegationstag`, { skip: !existsSync(vorlage) || !existsSync(stand) }, () => {
    const orig = protokoll(SaveFile.decode(new Uint8Array(readFileSync(vorlage))).plain);
    const ende = orig.findIndex((p) => p.punkt === 27 && p.wurf > 0);
    const bisEnde = ende < 0 ? orig : orig.slice(0, ende + 1);
    const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(stand))));
    const lauf = originaltag(g, originalRng(0x1234), [...lager]);
    const ids = new Set(bisEnde.map((p) => p.punkt));
    const punkte = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => ids.has(p.punkt));
    assert.equal(bisEnde.length, anzahl);
    assert.deepEqual(punkte.slice(0, anzahl), bisEnde);
  });
}

// Übergangstag zur neuen Saison (aus RIED2017 weitergespielt; der Stand steht nach dem letzten
// Kalendertag): Tagesbeginn, ein Zug, dann Auf- und Abstieg (random(61,62) für die Oberliga),
// Schwankung, Fans, Sponsorenangebote, Mischen, Saisonende je Manager (Jugend, Aprilscherz,
// Karriereende), Vertragsdialog mit ABBRUCH und der Beginn des Spielerpools. Der Pool selbst
// weicht noch ab (#99).
const SAISON = resolve(import.meta.dirname, "../../../tools/dosbox/KP-SAISON.MAN");
const SAISON_POOL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-SAISON-POOL.MAN");
const SAISON_START = resolve(import.meta.dirname, "../../../tools/dosbox/KP-SAISON-START.MAN");
test("Saisonwechseltag: bis zum Spielerpool wie das Original", { skip: !existsSync(SAISON) || !existsSync(SAISON_POOL) || !existsSync(SAISON_START) }, () => {
  const neuerTag = (datei: string) => {
    const alle = protokoll(SaveFile.decode(new Uint8Array(readFileSync(datei))).plain);
    // Der Stand trägt das Protokoll seines eigenen Laufs (bis zu dessen Tagesroutinen, Punkt 9);
    // der neue Tag beginnt danach
    return alle.slice(alle.findLastIndex((p) => p.punkt === 9) + 1);
  };
  const lauf = saisonwechseltag(new GameState(SaveFile.decode(new Uint8Array(readFileSync(SAISON_START)))), originalRng(0x1234), [60, 60, 60, 60, -60, -60, 60, 60]).punkte;
  for (const [datei, ids, anzahl] of [[SAISON, [7, 10, 12, 30, 31, 33, 34, 35, 36], 13], [SAISON_POOL, [38, 41], 2]] as const) {
    const orig = neuerTag(datei).filter((p) => (ids as readonly number[]).includes(p.punkt)).slice(0, anzahl);
    const remake = lauf.filter((p) => (ids as readonly number[]).includes(p.punkt)).slice(0, anzahl);
    assert.deepEqual(remake, orig);
  }
});

// Nach dem Spielerpool (der am Laufzeitspeicher des Originals hängt, #99) setzt der Test den
// Generator auf den Stand des Originals beim ersten Finanztag: danach stimmen die 38 Tage bis
// 28.7. (ab 21.6., mit der Monatsbuchung am 30.6.) und die Auslosung bis zum Tagesende. Die
// Lagerzeiten am Tagesbeginn sind gemessen (kontrollpunkte.py --dump 7 --dump-einmal 1).
test("Saisonwechseltag: Finanztage und Auslosung nach dem Spielerpool", { skip: !existsSync(SAISON) || !existsSync(SAISON_START) }, () => {
  const alle = protokoll(SaveFile.decode(new Uint8Array(readFileSync(SAISON))).plain);
  const orig = alle.slice(alle.findLastIndex((p) => p.punkt === 9) + 1);
  const ab37 = orig.slice(orig.findIndex((p) => p.punkt === 37));
  let inner = originalRng(0x1234);
  const rng = Object.assign((lo: number, hi: number) => inner(lo, hi), { zaehler: () => inner.zaehler() });
  let gesetzt = false;
  const lauf = saisonwechseltag(new GameState(SaveFile.decode(new Uint8Array(readFileSync(SAISON_START)))), rng, [29, 21, 39, 34, -12, 16, -27, 42], (k) => {
    if (k !== 37 || gesetzt) return;
    gesetzt = true;
    inner = originalRng(0x1234);
    for (let i = 0; i < ab37[0].wurf; i++) inner(0, 0);
  });
  const remake = lauf.punkte.map((p) => (p.punkt === 26 ? { ...p, punkt: 27 } : p)).filter((p) => p.punkt === 37 || p.punkt === 27);
  const nach = remake.slice(remake.findIndex((p) => p.punkt === 37) + 1);
  assert.equal(ab37.length, 115);
  assert.deepEqual(nach, ab37.slice(1));
});
