import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, originalRng, originaltag, TABLES, parseMana, createGame, dayIndex, calendarFlag, playMatchday, playCupDay, cupPairs, dailyTraining, trainingInput, advertisingAmount } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");

test("Neues Spiel: Stammdaten lesen, Manager mit Wunschverein in der Oberliga, Kader aus den Vereinslisten", () => {
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  assert.equal(mana.names[0], "1.FC KAISERSLAUTERN");
  assert.equal(mana.players[0][0], "EHRMANN");
  assert.equal(mana.names.length, 200);
  assert.ok(mana.players.every((l) => l.length === 20));
  const template = new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")));
  const save = createGame(SaveFile.decode(template).plain, mana, { managers: [{ name: "Lars", club: 0, portrait: 2 }, { name: "Normi", club: 14, portrait: 1 }, { name: "Blacky", club: 5, portrait: 4 }], level: 3 }, mulberryRng(42));
  const g = new GameState(SaveFile.decode(save.encode()));
  const managers = g.activeManagers();
  assert.equal(managers.length, 3);
  assert.deepEqual(managers.map((m) => m.displayName), ["LARS", "NORMI", "BLACKY"]);
  assert.deepEqual([g.date.day, g.date.month, g.date.year], [29, 7, 1992]);
  assert.equal(dayIndex(g), 0);
  managers.forEach((m, i) => {
    assert.ok(m.clubIndex >= 38 && m.clubIndex < 58, `Oberliga ${m.clubIndex}`);
    const wanted = mana.names[[0, 14, 5][i]];
    assert.equal(g.clubs.at(m.clubIndex).name, wanted);
    const squad = g.squadOf(i);
    assert.equal(squad.length, 20);
    const names = squad.map((l) => g.players.at(l.playerIndex).name);
    assert.deepEqual(names, mana.players[[0, 14, 5][i]]);
    for (const l of squad) {
      assert.equal(g.players.at(l.playerIndex).u8(36), m.clubIndex);
      assert.ok(l.u8(16) >= 28 && l.u8(16) <= 33, `Kondition ${l.u8(16)}`);
      assert.ok(l.u8(11) === 2);
      assert.ok(l.number >= 0 && l.number <= 15);
    }
    // 0x22030 zu Spielbeginn: 1-4-4-2 mit Bank 12..15, die übrigen ohne Nummer
    assert.equal(squad.filter((l) => l.number >= 1 && l.number <= 11).length, 11);
    assert.deepEqual(squad.filter((l) => l.number >= 12).map((l) => l.number).sort(), [12, 13, 14, 15]);
    assert.equal(m.balance, 1500000);
    assert.equal(m.i32(358), 12000);
    assert.equal(m.u8(312), 2);
    assert.equal(m.u8(266), 10);
    assert.equal(m.u8(306), 1);
    // Vergleich mit TEST-LAS (frisches Spiel des Originals): Verlauf und Zuschauerreihe leer,
    // Europapokale auf 0, Werbeblock mit den Vorgaben aus dem Datensegment von BMMAIN.EXE
    for (let cup = 1; cup < 5; cup++) assert.equal(m.u8(306 + cup), 0);
    for (let k = 62; k < 262; k++) assert.equal(m.u8(k), 0, `Verlauf ${k}`);
    // Byte 267 = Platz zum Saisonstart (Spieltag 0), wie nach jedem Saisonwechsel (NG12, #100)
    assert.equal(m.u8(267), g.standings.at(m.clubIndex).u8(46));
    for (let k = 268; k < 305; k++) assert.equal(m.u8(k), 0, `Reihe ${k}`);
    assert.equal(advertisingAmount(g, i, 0), 50000);
    for (let b = 1; b <= 6; b++) assert.equal(advertisingAmount(g, i, b), 6000);
    assert.equal(advertisingAmount(g, i, 7), 10000);
    assert.equal(advertisingAmount(g, i, 8), 5000);
  });
  // unbesetzte Plätze: Porträt m+1, Verein 100
  for (let m = 3; m < 4; m++) {
    assert.equal(g.managers.at(m).u8(29), m + 1);
    assert.equal(g.managers.at(m).u8(30), 100);
  }
  const pairs = cupPairs(g, 0);
  assert.equal(pairs.length, 16);
  for (const m of managers) assert.ok(pairs.flat().includes(m.clubIndex));
  const market = Array.from({ length: 12 }, (_, i) => g.lineups.at(100 + i)).filter((l) => !l.isEmpty);
  assert.ok(market.length <= 12);
  for (const l of market) assert.equal(g.players.at(l.playerIndex).u8(33), 4);
  // Spielerpool: jeder Platz 1..150 hat einen Namen, Marktspieler ohne Kader sind vereinslos (0xFF)
  for (let i = 1; i < 151; i++) assert.ok(!g.players.at(i).isEmpty, `Spieler ${i} leer`);
  // erster Tag lässt sich spielen
  assert.equal(calendarFlag(g, 0), 7);
  const tr = trainingInput(g);
  managers.forEach((_, i) => dailyTraining(g, i, 0, tr, mulberryRng(1), false));
  for (let league = 0; league < 3; league++) assert.equal(playMatchday(g, league, mulberryRng(7 + league)).length, league === 0 ? 9 : 10);
  g.save.plain[28233] = 1;
  assert.equal(playCupDay(g, mulberryRng(3)).length, 16);
});

// Neues Spiel im Original (tools/dosbox/neuesspiel.sh, seed-patch.py 1 tag, Kontrollpunkte 7, 10-13,
// 54, 56, 58, 59): ein Manager TEST mit Dynamo Dresden, ein Klick auf das Wappen (Leiste 1),
// gespeichert im ersten Zug. Das neue Spiel beginnt beim Zufallszustand 1 (randomize ist
// überbrückt), der Tagesbeginn danach wieder bei srand(1).
const NEUES_SPIEL = resolve(import.meta.dirname, "../../../tools/dosbox/KP-NEUESSPIEL.MAN");
test("Neues Spiel wie das Original: Würfe und ganzer Spielstand (KP-NEUESSPIEL)", { skip: !existsSync(NEUES_SPIEL) }, () => {
  const orig = SaveFile.decode(new Uint8Array(readFileSync(NEUES_SPIEL))).plain;
  const log = TABLES.lineups.offset + 75 * 52;
  const w = (i: number) => orig[log + i] | (orig[log + i + 1] << 8);
  const zaehle = (z: number) => {
    let s = 1;
    let n = 0;
    while (s !== z && n < 100_000) {
      s = (Math.imul(s, 214013) + 2531011) >>> 0;
      n++;
    }
    return s === z ? n : -1;
  };
  const protokoll = Array.from({ length: w(0) }, (_, i) => ({ punkt: w(2 + 8 * i), wurf: zaehle((w(4 + 8 * i) | (w(6 + 8 * i) << 16)) >>> 0) }));
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  const template = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))).plain;
  const dresden = mana.names.findIndex((n) => n.startsWith("DYNAMO DRES"));
  const rng = originalRng(1);
  const lauf: { punkt: number; wurf: number }[] = [];
  const save = createGame(template, mana, { managers: [{ name: "TEST", club: dresden, portrait: 1 }], level: orig[34062], leiste: 1, kp: (k) => { if ([54, 56, 58].includes(k)) lauf.push({ punkt: k, wurf: rng.zaehler() }); } }, rng);
  const g = new GameState(save);
  const tag = originalRng(1);
  try {
    originaltag(g, tag, undefined, (k) => {
      if ([7, 10, 12].includes(k)) lauf.push({ punkt: k, wurf: tag.zaehler() });
      if (k === 12) throw new Error("Zug");
    });
  } catch (e) {
    if ((e as Error).message !== "Zug") throw e;
  }
  // 59: Aufstellung im Zug, nach dem Speicherpunkt des Modells
  assert.deepEqual(lauf, protokoll.filter((p) => p.punkt !== 59));
  // Ganzer Stand ab der Speicherkarte (davor der Kopf mit der beim Speichern gewürfelten Kennung);
  // ausgenommen das Protokoll selbst, die Prüfsumme 56DC, die Öffnungszeiten der Trainingslager
  // (4cb3:0620, Laufzeit) und der Monat vor der Datumsrechnung (4238:4BCE)
  const p = g.save.plain;
  const anders: string[] = [];
  for (let i = 35; i < 34368; i++) {
    if (i >= log && i < log + 2 + 8 * w(0)) continue;
    if (i === 28006 || (i >= 34322 && i < 34339)) continue;
    if (p[i] !== orig[i]) anders.push(`${i}:${orig[i]}/${p[i]}`);
  }
  assert.deepEqual(anders, []);
});

test("Neues Spiel: Wunschverein 58 wird getauscht, die Tabellensätze bleiben stehen (0xC6D9, 0xAB84)", () => {
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  const tpl = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")))).plain;
  const neu = (club: number) => new GameState(SaveFile.decode(createGame(tpl, mana, { managers: [{ name: "Lars", club, portrait: 2 }], level: 3 }, mulberryRng(42)).encode()));
  // Welcher Verein nach dem Mischen auf Platz 58 steht, hängt nicht am Wunsch
  const name = neu(0).clubs.at(58).name;
  const g = neu(mana.names.indexOf(name));
  const y = g.managers.at(0).clubIndex;
  // Nur bis Verein 57 (4cb3:2277) bleibt ein Oberligist stehen - 58 wird gegen 38..57 getauscht
  assert.ok(y >= 38 && y <= 57, `Verein ${y}`);
  assert.equal(g.clubs.at(y).name, name);
  // Die Tabellensätze tauscht 0xAB84 zurück: Platz 58 behält die halbe Vorlage der Vereine
  // außerhalb der Ligen, der Platz des Managers die volle
  const bytes = (c: number) => Array.from({ length: 18 }, (_, i) => g.standings.at(c).u8(4 + i));
  assert.deepEqual(bytes(58), [64, 64, 64, 64, 64, 64, 64, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(bytes(y), [64, 64, 64, 64, 64, 64, 64, 64, 0, 64, 64, 64, 64, 64, 64, 64, 64, 0]);
});
