/**
 * Saisonende 0x0CB62 (GitLab #82, Kapitel 6; #94).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, seasonEvents, newSeason, MARKET_MANAGER, LOAN_FLAG, saisonbilanz, saisonwechselStand, saisonwechselTeil1, setDayIndex, torschuetzenSchreiben, torschuetzenKoenige, updatePositions } from "../src/index.ts";
import { texte } from "../src/data/texte.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const u16 = (l: { u8(o: number): number }, o: number) => l.u8(o) | (l.u8(o + 1) << 8);

test("Saisonwechsel: Karrieresummen bleiben, Saisonwerte 0..8 der Managerkader gehen (0x0D9A6)", () => {
  const g = load("TEST4.MAN");
  const l = g.squadOf(0).find((x) => u16(x, 28) > 0)!;
  const idx = l.playerIndex;
  l.setU8(0, 1);
  l.setU8(2, 1);
  l.setU8(8, 3);
  l.setU8(11, 3);
  const vorher = [u16(l, 28), u16(l, 30), u16(l, 34)];
  newSeason(g, mulberryRng(5));
  const n = g.squadOf(0).find((x) => x.playerIndex === idx)!;
  assert.deepEqual([u16(n, 28), u16(n, 30), u16(n, 34)], vorher, "Karrieresummen");
  for (let b = 0; b <= 8; b++) assert.equal(n.u8(b), 0, `Byte ${b}`);
  assert.equal(n.u8(11), 2, "ein Vertragsjahr weniger");
});

test("Saisonende: Leihspieler geht zum verleihenden Manager zurück, mit seinem Kaderplatz (0x0D2BD)", () => {
  const g = load("TEST4.MAN");
  // TEST4, Manager 0 hat 15 Spieler auf den Plätzen 0..14. Spieler 62 auf Platz 5 gehört
  // Manager 1 und ist an Manager 0 verliehen (Leihmarke, liegendes Verlängerungsangebot 105)
  const l = g.lineups.at(5);
  const idx = l.playerIndex;
  assert.equal(idx, 62);
  g.players.at(idx).setU8(33, 1);
  l.setU8(12, 20 | LOAN_FLAG);
  l.setU8(11, 1);
  l.setU8(24, 105);
  // Marker bei den übrigen Spielern von Manager 0: Byte 24 = 7, Byte 12 = 1
  for (let k = 0; k < 15; k++) if (k !== 5) (g.lineups.at(k).setU8(24, 7), g.lineups.at(k).setU8(12, 1));
  const kader0 = g.squadOf(0).length;
  seasonEvents(g, [0, 0, 0], mulberryRng(3), true);
  assert.equal(g.squadOf(0).some((x) => x.playerIndex === idx), false, "nicht mehr beim Entleiher");
  const zurueck = g.squadOf(1).find((x) => x.playerIndex === idx);
  assert.ok(zurueck, "beim Besitzer");
  assert.equal(g.lineups.at(25 + 6).playerIndex, idx, "auf Platz 6 einsortiert");
  assert.equal(zurueck!.u8(11), 0, "Vertragsjahr schon abgezogen");
  assert.equal(g.players.at(idx).u8(33), 1);
  assert.equal(g.squadOf(0).length, kader0 - 1);
  // B14 (#128): gelöscht werden Byte 12 und 24 im Kader von Manager 0 am neuen Platz (0x0D3BC,
  // 304A = 0). Die Aufnahme 0x224A8 sortiert den Rückkehrer bei Manager 1 auf Platz 6 ein - bei
  // Manager 0 steht dort nach dem Aufschieben Spieler 66; der Rückkehrer behält Leihmarke und
  // Angebot
  assert.equal(zurueck!.u8(12), 20 | LOAN_FLAG, "Leihmarke bleibt beim Rückkehrer");
  assert.equal(zurueck!.u8(24), 105, "Vertragsgespräch bleibt beim Rückkehrer");
  for (const x of g.squadOf(0)) {
    const geloescht = x.playerIndex === 66;
    assert.equal(x.u8(24), geloescht ? 0 : 7, `Byte 24 von Spieler ${x.playerIndex}`);
    assert.equal(x.u8(12), geloescht ? 0 : 1, `Byte 12 von Spieler ${x.playerIndex}`);
  }
});

test("Saisonende: Rückkehrer auf Platz 4 schiebt nur bis Platz 12 auf (0x0D396, #128 B15)", () => {
  const kaderNach = (platz: number) => {
    const g = load("TEST4.MAN");
    g.players.at(g.lineups.at(platz).playerIndex).setU8(33, 1);
    seasonEvents(g, [0, 0, 0], mulberryRng(3), true);
    return Array.from({ length: 15 }, (_, k) => g.lineups.at(k).playerIndex);
  };
  // Vorher: 2 22 25 45 47 62 65 66 91 95 105 107 109 111 149. Platz 4 (Spieler 47): Länge
  // (2 - 1)·12 - die Plätze 5..12 rücken auf, Platz 12 verliert nur die Spielernummer, 13 und 14
  // bleiben stehen
  assert.deepEqual(kaderNach(4), [2, 22, 25, 45, 62, 65, 66, 91, 95, 105, 107, 109, 0, 111, 149]);
  // Platz 5 (Spieler 62): Länge 24, lückenlos
  assert.deepEqual(kaderNach(5), [2, 22, 25, 45, 47, 65, 66, 91, 95, 105, 107, 109, 111, 149, 0]);
});

test("Saisonende: eigener Spieler auf der Transferliste kommt in den Kader zurück", () => {
  const g = load("TEST4.MAN");
  let slot = -1;
  for (let k = 0; k < 12; k++) if (!g.lineups.at(100 + k).isEmpty) slot = k;
  const idx = g.lineups.at(100 + slot).playerIndex;
  g.players.at(idx).setU8(33, 2);
  seasonEvents(g, [0, 0, 0], mulberryRng(4), true);
  assert.ok(g.squadOf(2).some((x) => x.playerIndex === idx), "beim Manager");
  for (let k = 0; k < 12; k++) {
    const m = g.lineups.at(100 + k);
    assert.ok(m.isEmpty || m.playerIndex !== idx, "nicht mehr auf dem Markt");
  }
  // Ein Marktspieler ohne Besitzer bleibt, wo er ist
  assert.notEqual(MARKET_MANAGER, 2);
});

test("Torschützenkönig: bei gleich vielen Toren gewinnt, wer weniger Spiele hat; mindestens zwei Tore (0x16515)", () => {
  const g = load("TEST4.MAN");
  const club = g.managers.at(0).clubIndex;
  const liga = club < 18 ? 0 : 1;
  const basis = liga === 0 ? 0 : 18;
  // Alle Tore der Liga weg, dann zwei Spieler mit je 20 Toren
  for (let x = 1; x < 151; x++) g.players.at(x).setU8(34, 0);
  for (let m = 0; m < 3; m++) for (const l of g.squadOf(m)) l.setU8(3, 0);
  const eigener = g.squadOf(0)[3];
  eigener.setU8(3, 20);
  g.players.at(eigener.playerIndex).setU8(35, 30);
  let fremd = -1;
  for (let x = 1; x < 151 && fremd < 0; x++) {
    const c = g.players.at(x).u8(36);
    if (c >= basis && c < basis + (liga === 0 ? 18 : 20) && c !== club && g.players.at(x).u8(33) === 5) fremd = x;
  }
  assert.ok(fremd > 0);
  g.players.at(fremd).setU8(34, 20);
  g.players.at(fremd).setU8(35, 25);
  const probe = (eigeneSpiele: number) => {
    const h = new GameState(SaveFile.decode(g.save.encode()));
    h.players.at(eigener.playerIndex).setU8(35, eigeneSpiele);
    const konto = h.managers.at(0).balance;
    seasonEvents(h, [0, 0, 0], mulberryRng(2), true);
    return h.managers.at(0).balance - konto;
  };
  assert.equal(probe(30), 0, "der fremde Spieler hat weniger Spiele");
  assert.equal(probe(20), 250000, "jetzt hat der eigene weniger");
  // Mit nur einem Tor steht niemand in der Liste
  g.players.at(fremd).setU8(34, 1);
  eigener.setU8(3, 1);
  assert.equal(probe(10), 0, "unter zwei Toren kein Torschützenkönig");
});

test("Saisonbilanz (0x1DD03) und Stand des Saisonwechsels für den Server", () => {
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  const st = g.standings.at(m.clubIndex);
  st.setU8(30, 20);
  st.setU8(31, 18);
  st.setU8(38, 8);
  st.setU8(42, 3);
  const siege = m.u16(440);
  const unent = m.u16(448);
  setDayIndex(g, 92);
  assert.equal(saisonwechselStand(g), null, "am letzten Spieltag");
  setDayIndex(g, 93);
  assert.equal(saisonwechselStand(g), "zug", "danach");
  saisonbilanz(g);
  assert.equal(m.u16(440), siege + 8);
  assert.equal(m.u16(448), (unent + 20 - 3 - 8) & 0xffff);
  assert.equal(m.i32(484), 0);
  assert.equal(m.i32(492), 99999);
  saisonwechselTeil1(g, mulberryRng(4), true);
  assert.equal(saisonwechselStand(g), "vertraege");
});

/** Zufallsgenerator mit Protokoll: [lo, hi, Ergebnis] je Wurf. */
const protokollRng = (seed: number) => {
  const inner = mulberryRng(seed);
  const log: [number, number, number][] = [];
  const rng = (lo: number, hi: number) => {
    const v = inner(lo, hi);
    log.push([lo, hi, v]);
    return v;
  };
  return { rng, log };
};

/** TEST4 mit einem Rücktritt bei Manager 0 (Spieler 25) und ohne Jugendkonto (kein Jugendspieler). */
const mitRuecktritt = () => {
  const g = load("TEST4.MAN");
  const l = g.lineups.at(2);
  assert.equal(l.playerIndex, 25);
  l.setU8(11, 1);
  l.setU8(24, 0x80);
  g.activeManagers().forEach((m) => (m.setU8(482, 0), m.setU8(483, 0)));
  for (let x = 0; x < 151; x++) g.players.at(x).setU8(32, 0x55);
  return g;
};

test("Karriereende: Meldungswurf random(0,3) vor dem Entfernen, Meldung im Kasten (0x0D55E, #128 H2)", () => {
  const g = mitRuecktritt();
  const { rng, log } = protokollRng(11);
  const events = seasonEvents(g, [0, 0, 0], rng, true);
  const nagel = texte("ui.karriereende");
  const ev = events.find((e) => e.manager === 0 && e.text.includes(nagel[2]));
  assert.ok(ev, "Karriereende gemeldet");
  assert.equal(ev!.kasten?.length, 3, "Meldungskasten mit festem Zeilenschnitt");
  // Der Rücktritt: nach dem Grenzwurf random(32,34) kommt random(0,3), dann die Neubelegung
  // random(18,25), random(30,92), jj±5, random(0,6), jj±5
  const i = log.findIndex((w, k) => w[0] === 0 && w[1] === 3 && log[k - 1]?.[0] === 32 && log[k + 1]?.[0] === 18);
  assert.ok(i > 0, "random(0,3) zwischen Grenzwurf und Neubelegung");
  assert.deepEqual([log[i + 1][0], log[i + 1][1]], [18, 25]);
  assert.deepEqual([log[i + 2][0], log[i + 2][1]], [30, 92]);
  assert.deepEqual([log[i + 4][0], log[i + 4][1]], [0, 6]);
  // Ohne Rücktritt fällt der Wurf weg
  const ohne = load("TEST4.MAN");
  ohne.activeManagers().forEach((m) => (m.setU8(482, 0), m.setU8(483, 0)));
  const p2 = protokollRng(11);
  seasonEvents(ohne, [0, 0, 0], p2.rng, true);
  assert.equal(p2.log.filter((w) => w[0] === 0 && w[1] === 3).length, log.filter((w) => w[0] === 0 && w[1] === 3).length - 1);
});

test("Neubelegung: die Positionsart random(0,6) geht an Spieler -0x7c, nicht an den neuen (0x0D628, #128 B13)", () => {
  // Aufstieg: die Bandenschleife hinterlässt -0x7c = 6, jeder Wurf landet bei Spieler 6
  const g = mitRuecktritt();
  const { rng, log } = protokollRng(12);
  seasonEvents(g, [1, 1, 1], rng, true);
  const art = log.filter((w, k) => w[0] === 0 && w[1] === 6 && log[k - 2]?.[0] === 30 && log[k - 2]?.[1] === 92);
  assert.ok(art.length > 1, "Rücktritt und alte Vereinslose neu belegt");
  assert.equal(g.players.at(6).u8(32), art.at(-1)![2], "Spieler 6 trägt den jüngsten Wurf");
  for (let x = 1; x < 151; x++) if (x !== 6) assert.equal(g.players.at(x).u8(32), 0x55, `Spieler ${x} behält Byte 32`);
  // Ohne Aufstieg und ohne Jugendspieler ist -0x7c ein Stapelrest: kein Spieler bekommt den Wurf
  const h = mitRuecktritt();
  seasonEvents(h, [0, 0, 0], mulberryRng(12), true);
  for (let x = 0; x < 151; x++) assert.equal(h.players.at(x).u8(32), 0x55, `Spieler ${x} unverändert`);
});

test("Bestenliste schreibt die Kadertore in Spielerbyte 34 (0x16543, #128 D2)", () => {
  const g = load("TEST4.MAN");
  // Spieler 62 (Manager 0, Platz 5) kam im Lauf der Saison: im Kader 4 Tore, in der Tabelle 9
  g.lineups.at(5).setU8(3, 4);
  g.players.at(62).setU8(34, 9);
  // Hinter einer Lücke zählt das Original nicht weiter (Kaderzahl 0x31A19 über die Plätze 0..23)
  g.lineups.at(3).setU8(15, 0);
  g.lineups.at(14).setU8(3, 2);
  g.players.at(149).setU8(34, 7);
  torschuetzenSchreiben(g);
  assert.equal(g.players.at(62).u8(34), 4, "Kadertore übernommen");
  assert.equal(g.players.at(149).u8(34), 7, "Platz 14 liegt hinter der Kaderzahl 14");
});

test("Torschützenkönig vor dem Auf- und Abstieg, mit der alten Liga (0x1E1B0, #128 B12)", () => {
  const g = load("TEST4.MAN");
  // Manager 1 (Verein 21) steigt als Erster der 2. Liga auf (wie im Werbetest europa.test.ts)
  const spitze = g.standings.at(21);
  for (const [off, v] of [[0, 99], [1, 99], [22, 99], [23, 99], [26, 0], [27, 0]] as [number, number][]) spitze.setU8(off, v);
  updatePositions(g, 1);
  for (let x = 1; x < 151; x++) g.players.at(x).setU8(34, 0);
  for (let m = 0; m < 3; m++) for (const l of g.squadOf(m)) l.setU8(3, 0);
  // Sein Stürmer führt die 2. Liga mit 20 Toren an; in der Bundesliga hat ein Spieler des
  // Rechners 30
  const stuermer = g.squadOf(1)[3];
  stuermer.setU8(3, 20);
  let fremd = -1;
  for (let x = 1; x < 151 && fremd < 0; x++) {
    const c = g.players.at(x).u8(36);
    if (c < 18 && c !== g.managers.at(0).clubIndex && g.players.at(x).u8(33) === 5) fremd = x;
  }
  g.players.at(fremd).setU8(34, 30);
  assert.deepEqual(torschuetzenKoenige(g), [false, true, false]);
  assert.equal(g.players.at(stuermer.playerIndex).u8(34), 20, "Kadertore geschrieben");
  const { events } = saisonwechselTeil1(g, mulberryRng(7), true);
  assert.equal(g.managers.at(1).u8(312), 0, "aufgestiegen");
  assert.ok(events.some((e) => e.manager === 1 && e.text.startsWith("Torschützenkönig")), "Prämie mit der Liste der alten Liga");
});
