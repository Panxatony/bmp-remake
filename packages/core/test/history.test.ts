import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, statistics, allTimeTable, allTimeBalance, bookHistory, seriesCurrent, clubRecords, resultsAgainst } from "../src/index.ts";

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
