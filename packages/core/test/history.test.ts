import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, statistics, allTimeTable, allTimeBalance, bookHistory, seriesCurrent, clubRecords, resultsAgainst, seriesRecord, serienrekordeBuchen, playMatchday, mulberryRng, HISTORY } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Statistik: Serien, Rekorde, Zuschauer und Ewige Tabelle/Bilanz wie im Original (TEST4, Bildschirmfoto docs/original/buero-statistik.png)", () => {
  const g = load("TEST4.MAN");
  const st = statistics(g, 0);
  assert.deepEqual(st.series.map((r) => r.current), [[0, 15, 0], [0, 0, 0], [1, 0, 2], [1, 0, 2], [8, 25, 4], [0, 0, 0], [0, 0, 0]]);
  assert.deepEqual(st.series.map((r) => r.record), [[8, 15, 4], [4, 2, 4], [3, 3, 3], [7, 6, 6], [12, 25, 7], [5, 11, 2], [3, 1, 4]]);
  assert.equal(st.records[0].text, "7:0");
  assert.equal(g.clubs.at(st.records[0].opponent!).displayName, "ARMINIA BIELEFELD");
  assert.equal(st.records[1].text, "1:3");
  assert.equal(st.records[4].text, "4:0");
  // Tore je Spiel: das Original schneidet auf ein Zehntel ab (Bildschirmfoto buero-statistik.png)
  assert.deepEqual(st.goalsPerGame.map((v) => v.toFixed(1)), ["1.1", "1.5", "0.8"]);
  assert.deepEqual(st.againstPerGame.map((v) => v.toFixed(1)), ["0.6", "0.2", "1.0"]);
  assert.equal(st.attendance.total, 76747);
  assert.equal(st.attendance.average, 19186);
  assert.equal(st.attendance.record, 24000);
  assert.equal(g.clubs.at(st.attendance.recordOpponent!).displayName, "SV WERDER BREMEN");
  assert.equal(st.attendance.minus, 12747);
  assert.equal(st.balance, 405885);
  assert.equal(st.income, 801917);
  assert.equal(st.expenses, 1139127);
  const ewig = allTimeTable(g);
  assert.equal(g.clubs.at(ewig[0].club).displayName, "1.FC KAISERSLAUTERN");
  assert.equal(ewig[0].points, 385);
  assert.equal(ewig.length, 58);
  // Die Ewige Tabelle führt alle 58 Vereine, auch die ohne Punkte
  assert.equal(ewig.filter((r) => r.points === 0).length, 1);
  const bal = allTimeBalance(g, 0);
  assert.deepEqual(bal.titles, [0, 0, 0, 0, 0]);
  assert.deepEqual(bal.rows[0], { label: "PUN.", columns: [[254, 126], [152, 38], [102, 88]] });
  assert.deepEqual(bal.rows[1], { label: "TORE", columns: [[364, 226], [220, 72], [144, 154]] });
  assert.deepEqual(bal.rows[2], { label: "SIEGE", columns: [[108, null], [67, null], [41, null]] });
  // Fortschreibung: Heimsieg 9:1 des Managervereins gegen Verein 4
  const club = g.managers.at(0).clubIndex;
  bookHistory(g, club, 4, 9, 1);
  const cur = seriesCurrent(g, club);
  assert.deepEqual(cur[0], [1, 16, 0]);
  assert.deepEqual(cur[4], [9, 26, 4]);
  assert.deepEqual(cur[6], [0, 0, 0]);
  assert.equal(clubRecords(g, club)[0].text, "9:1");
  assert.equal(clubRecords(g, club)[0].opponent, 4);
  assert.equal(clubRecords(g, club)[2].text, "9");
  assert.deepEqual(resultsAgainst(g, 0, 4).home.at(-1), [9, 1]);
});

const rekordbyte = (g: GameState, club: number, k: number) => g.save.plain[HISTORY + 3988 + 8 * club + k];
const gegnerbyte = (g: GameState, club: number, k: number) => g.save.plain[HISTORY + 4500 + 8 * club + k];

test("Torrekorde: kassiert heim (k = 3) und erzielt auswärts (k = 6) im unteren Halbbyte (0x2DBDF, #128 G1)", () => {
  // In allen Spielständen des Originals: k = 2/7 nur oben, k = 3/6 nur unten
  const dateien = readdirSync(BMP_DIR).filter((f) => /\.man$/i.test(f));
  assert.ok(dateien.length >= 9);
  for (const f of dateien) {
    const g = load(f);
    for (let club = 0; club < 58; club++) {
      for (const k of [2, 7]) assert.equal(rekordbyte(g, club, k) & 15, 0, `${f} Verein ${club} k=${k}`);
      for (const k of [3, 6]) assert.equal(rekordbyte(g, club, k) >> 4, 0, `${f} Verein ${club} k=${k}`);
    }
  }
  // Fortschreibung: 2:5 zwischen zwei Vereinen ohne Rekorde
  const g = load("TEST4.MAN");
  for (const c of [4, 5]) for (let k = 0; k < 8; k++) g.save.plain[HISTORY + 3988 + 8 * c + k] = 0;
  bookHistory(g, 4, 5, 2, 5);
  assert.deepEqual([0, 1, 2, 3].map((k) => rekordbyte(g, 4, k)), [0, 0x25, 0x20, 0x05]);
  assert.deepEqual([4, 5, 6, 7].map((k) => rekordbyte(g, 5, k)), [0x25, 0, 0x05, 0x20]);
  assert.deepEqual(clubRecords(g, 4).map((r) => r.text), ["", "2:5", "2", "5", "", "", "", ""]);
  assert.deepEqual(clubRecords(g, 5).map((r) => r.text), ["", "", "", "", "5:2", "", "5", "2"]);
  // Ein kleinerer Wert ersetzt nichts, ein größerer schon
  bookHistory(g, 4, 6, 1, 3);
  assert.equal(rekordbyte(g, 4, 3), 0x05);
  bookHistory(g, 4, 6, 1, 7);
  assert.equal(rekordbyte(g, 4, 3), 0x07);
  assert.equal(gegnerbyte(g, 4, 3), 6);
});

test("Leerer Torrekord: ein Spiel ohne Tore schreibt weder Byte noch Gegner (0x2DC61, #128 G2)", () => {
  const g = load("TEST4.MAN");
  for (const c of [4, 5]) {
    for (let k = 0; k < 8; k++) {
      g.save.plain[HISTORY + 3988 + 8 * c + k] = 0;
      g.save.plain[HISTORY + 4500 + 8 * c + k] = 0x33;
    }
  }
  bookHistory(g, 4, 5, 0, 0);
  for (const c of [4, 5]) {
    for (let k = 0; k < 8; k++) {
      assert.equal(rekordbyte(g, c, k), 0);
      assert.equal(gegnerbyte(g, c, k), 0x33, `Verein ${c} k=${k}: Gegner bleibt`);
    }
  }
});

test("Serienrekorde aller Manager nach der Buchung einer Liga (0x2D812, #128 G3)", () => {
  const g = load("TEST4.MAN");
  // Manager 1 (Verein 21, 2. Liga) hat eine laufende Serie über seinem Rekord, etwa nach einem
  // Vereinswechsel
  const verein = g.managers.at(1).clubIndex;
  assert.equal(verein, 21);
  g.save.plain[HISTORY + 2560 + 21 * verein] = 60;
  // Ein Spiel ohne seinen Verein bucht nur die Serien der beiden Vereine
  bookHistory(g, 4, 5, 1, 0);
  assert.ok(seriesRecord(g, 1)[0][0] < 60);
  serienrekordeBuchen(g);
  assert.equal(seriesRecord(g, 1)[0][0], 60);
  // Der Bundesligaspieltag übernimmt sie ebenso, obwohl Verein 21 nicht spielt
  const h = load("TEST4.MAN");
  h.save.plain[HISTORY + 2560 + 21 * verein] = 60;
  playMatchday(h, 0, mulberryRng(3));
  assert.equal(seriesRecord(h, 1)[0][0], 60);
});
