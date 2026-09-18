/**
 * Tabelle, Spielübersicht und Bestenliste gegen das Original (GitLab #55, Portion 4).
 * P4.MAN ist der Spielstand nach dem 10. Spieltag, mit dem in DOSBox verglichen wurde.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, tableOrder, clubStrength, matchdayDate, matchdayView, leagueScorers, playerScorers, statistics, allTimeTable, allTimeBalance } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Bundesligatabelle nach dem 10. Spieltag wie im Original (P4.MAN in DOSBox)", () => {
  const g = load("P4.MAN");
  const namen = tableOrder(g, 0).map((c) => g.clubs.at(c).displayName);
  assert.deepEqual(namen.slice(0, 5), ["1.FC NÜRNBERG", "SVW MANNHEIM", "VFB STUTTGART", "BORUSSIA DORTMUND", "FC BAYERN MÜNCHEN"]);
  assert.deepEqual(namen.slice(15), ["STUTTGARTER KICK.", "VFL BOCHUM", "1.FC KAISERSLAUTERN"]);
  const zeile = (club: number) => {
    const s = g.standings.at(club);
    const sp = s.homeGames + s.awayGames;
    const si = s.homeWins + s.awayWins;
    const ni = s.homeLosses + s.awayLosses;
    return [s.lastResults, sp, si, sp - si - ni, ni, s.homePoints + s.awayPoints, s.homeGoalsFor + s.awayGoalsFor, s.homeGoalsAgainst + s.awayGoalsAgainst];
  };
  // 1.FC Nürnberg: UsSsUsUs, 10 Spiele, 6-3-1, 15 Punkte, 13:6 Tore
  assert.deepEqual(zeile(tableOrder(g, 0)[0]), ["UsSsUsUs", 10, 6, 3, 1, 15, 13, 6]);
  // Schlusslicht Kaiserslautern: 2-3-5, 7 Punkte, 8:16
  assert.deepEqual(zeile(tableOrder(g, 0)[17]), ["uSuNuNnN", 10, 2, 3, 5, 7, 8, 16]);
});

test("Vereinsstärke mittelt alle neun Matrixwerte (in DOSBox nachgemessen)", () => {
  const g = load("P4.MAN");
  // 1.FC Nürnberg (72,86,54): das Original zeigt 71, das Mittel der drei Linienmittel wäre 70
  const nue = clubStrength(g, 15);
  assert.deepEqual([nue.ko, nue.te, nue.fo, nue.total], [72, 86, 54, 71]);
  // Hertha BSC (85,72,52): Original 70, Mittel der Mittel 69
  const her = clubStrength(g, 2);
  assert.deepEqual([her.ko, her.te, her.fo, her.total], [85, 72, 52, 70]);
  // 1.FC Kaiserslautern (65,80,48): Original 65, Mittel der Mittel 64
  assert.equal(clubStrength(g, 4).total, 65);
});

test("Spielübersicht: Datum des Spieltags und die Ergebnisse des 10. Spieltags", () => {
  const g = load("P4.MAN");
  // Überschrift des Originals: "SPIELE Bundesliga 11.SPIELTAG 7.10."
  assert.deepEqual(matchdayDate(g, 0, 11), { day: 7, month0: 9, year: 1997 });
  assert.deepEqual(matchdayDate(g, 0, 10), { day: 30, month0: 8, year: 1997 });
  const md = matchdayView(g, 0, 10);
  assert.deepEqual(
    md.map((r) => `${g.clubs.at(r.home).displayName} ${r.result!.home}:${r.result!.away} ${g.clubs.at(r.away).displayName}`),
    [
      "VFL BOCHUM 1:0 STUTTGARTER KICK.",
      "BW 90 BERLIN 1:1 WATTENSCHEID 09",
      "BAYER LEVERKUSEN 3:0 EINTRACHT FRANKFURT",
      "VFB OLDENBURG 1:1 SVW MANNHEIM",
      "MÖNCHENGLADBACH 0:1 BORUSSIA DORTMUND",
      "FC BAYERN MÜNCHEN 5:0 1.FC KAISERSLAUTERN",
      "VFB STUTTGART 0:0 HERTHA BSC",
      "FC ST.PAULI 1:0 SV WERDER BREMEN",
      "1.FC NÜRNBERG 3:0 FC SCHALKE 04",
    ],
  );
  // Tabellenplatz vor dem Vereinsnamen, nicht der Rang in der Stärkeliste
  assert.equal(md[8].homePlace, 1);
  assert.equal(md[8].awayPlace, 9);
});

test("Bestenliste: ab zwei Toren, SPIELER zeigt die Mitspielervereine mit den Ligaplätzen", () => {
  const g = load("P4.MAN");
  const liga = leagueScorers(g, 0);
  // Das Original listete genau elf Spieler - alle mit zwei und mehr Toren, keinen mit einem
  assert.equal(liga.length, 11);
  assert.ok(liga.every((r) => r.goals >= 2));
  assert.deepEqual(liga.map((r) => r.goals), [4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2]);
  assert.deepEqual(liga.slice(2, 5).map((r) => r.name), ["BREITENREITE", "ECKEL", "WIRSCHING"]);
  // Tore je Spiel abgeschnitten: Bäurle 3 Tore in 10 Spielen zeigt 0.3
  const baeurle = liga.find((r) => r.name === "BÄURLE")!;
  assert.deepEqual([baeurle.goals, baeurle.apps, Math.trunc((10 * baeurle.goals) / baeurle.apps)], [3, 10, 3]);
  // "Die Besten der Spieler": nur die Vereine der Mitspieler, Plätze aus der Ligaliste
  const meine = playerScorers(g, 0);
  assert.deepEqual(meine.map((r) => r.place), [5, 7, 9, 11]);
  assert.deepEqual(meine.map((r) => r.name), ["WIRSCHING", "BÄURLE", "L.SCHMIDT", "PFLIPSEN"]);
  assert.ok(meine.every((r) => r.club === 15));
});

test("Statistik: Serien, Rekorde, Zuschauer und der Guthabenzins der Monatsvorschau", () => {
  const g = load("P4.MAN");
  const st = statistics(g, 0);
  // Serien G/H/A mit Rekord in Klammern, wie im Original abgelesen
  assert.deepEqual(st.series[0], { current: [1, 16, 0], record: [8, 16, 4] });
  assert.deepEqual(st.series[4], { current: [9, 26, 4], record: [12, 26, 7] });
  assert.deepEqual(st.goalsPerGame, [1.3, 1.8, 0.8]);
  assert.deepEqual(st.againstPerGame, [0.6, 0.2, 1]);
  // Rekorde mit dem Gegner dahinter
  assert.equal(st.records[0].text, "7:0");
  assert.equal(g.clubs.at(st.records[0].opponent!).displayName, "ARMINIA BIELEFELD");
  assert.equal(st.records[5].text, "1:8");
  assert.equal(g.clubs.at(st.records[5].opponent!).displayName, "VFL OSNABRÜCK");
  // Zuschauer
  assert.equal(st.attendance.total, 100747);
  assert.equal(st.attendance.average, 20149);
  assert.equal(st.attendance.record, 24000);
  assert.equal(g.clubs.at(st.attendance.recordOpponent!).displayName, "FC SCHALKE 04");
  assert.equal(st.attendance.minus, 12747);
  assert.equal(g.clubs.at(st.attendance.minusOpponent!).displayName, "VFB STUTTGART");
  assert.equal(st.balance, 187675);
  assert.equal(st.expenses, 1139127);
  // Der Guthabenzins der Monatsabrechnung gehört in die Vorschau: Schnitt/75
  const mit = statistics(g, 0, { sum: 187675, tag: 4 });
  assert.equal(mit.income - st.income, Math.trunc(Math.trunc(187675 / 4) / 75));
  // Im Minus schlägt er stattdessen auf die Ausgaben
  const minus = statistics(g, 0, { sum: -750000, tag: 4 });
  assert.equal(minus.expenses - st.expenses, Math.trunc(-187500 / -10));
});

test("Gesamttabelle über alle Saisons und die Vereinsbilanz (P4.MAN in DOSBox abgelesen)", () => {
  const g = load("P4.MAN");
  const t = allTimeTable(g);
  assert.deepEqual(t.slice(0, 3).map((r) => [g.clubs.at(r.club).displayName, r.points]), [
    ["1.FC KAISERSLAUTERN", 385],
    ["VFB STUTTGART", 373],
    ["FC BAYERN MÜNCHEN", 366],
  ]);
  // Die Managervereine stehen auf 31, 33 und 37
  const eigene = new Set(g.activeManagers().map((m) => m.clubIndex));
  assert.deepEqual(t.map((r, i) => (eigene.has(r.club) ? i + 1 : 0)).filter(Boolean), [31, 33, 37]);
  const b = allTimeBalance(g, 0);
  assert.deepEqual(b.titles, [0, 0, 0, 0, 0]);
  assert.deepEqual(b.rows[0].columns, [[254, 126], [152, 38], [102, 88]]);
  assert.deepEqual(b.rows[1].columns, [[364, 226], [220, 72], [144, 154]]);
  assert.deepEqual(b.rows[2].columns, [[108, null], [67, null], [41, null]]);
  assert.deepEqual(b.rows[3].columns, [[44, null], [10, null], [34, null]]);
  assert.deepEqual(b.rows[4].columns, [[38, null], [18, null], [20, null]]);
});
