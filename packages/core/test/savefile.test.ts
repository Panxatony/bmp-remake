import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, dosText, CHK1_OFF, createGame, parseMana, mulberryRng } from "../src/index.ts";

// Ordner mit den Original-Spielständen; standardmäßig ../bmp neben diesem Repo.
const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const files = readdirSync(BMP_DIR).filter((f) => f.toUpperCase().endsWith(".MAN")).sort();

test("Spielstände vorhanden", () => {
  assert.ok(files.length > 0, `keine *.MAN in ${BMP_DIR}`);
});

for (const f of files) {
  test(`${f}: entschlüsseln, Prüfsummen, Roundtrip`, () => {
    const data = new Uint8Array(readFileSync(join(BMP_DIR, f)));
    const save = SaveFile.decode(data);
    assert.equal(save.plain.length, data.length);
    assert.deepEqual(save.encode(), data);
  });
}

test("RIED-CLI.MAN: bekannte Inhalte", () => {
  const save = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN"))));
  const g = new GameState(save);
  assert.equal(save.managerCount, 3);
  assert.deepEqual(g.activeManagers().map((m) => m.name), ["NORMI", "LARS", "BLACKY"]);
  assert.equal(g.clubs.at(0).name, "SV WERDER BREMEN");
  assert.equal(g.clubs.at(4).name, "1.FC KAISERSLAUTERN");
  assert.deepEqual(g.date, { day: 11, month: 11, year: 1997 });
  assert.equal(g.tableOrder.bundesliga.length, 18);
  const names = g.players.toArray().filter((p) => !p.isEmpty).map((p) => p.name);
  assert.ok(names.includes("BENATELLI"));
  // Abgleich mit dem Bildschirm "IHRE MANNSCHAFT" im Original (Manager NORMI).
  const squad = g.squadOf(0);
  assert.equal(squad.length, 15);
  const koepke = squad[0];
  assert.equal(g.players.at(koepke.playerIndex).displayName, "KÖPKE");
  assert.deepEqual(koepke.strength, [89, 97, 55]);
  assert.equal(koepke.number, 1);
  assert.equal(koepke.yellowCards, 3);
  assert.equal(koepke.leagueApps + koepke.cupApps, 17);
  assert.equal(koepke.overall, 80);
  assert.equal(koepke.contractYears, 2);
  assert.equal(koepke.salary, 21605);
  assert.equal(g.players.at(koepke.playerIndex).age, 24);
  assert.equal(g.players.at(koepke.playerIndex).appearances, 15);
  assert.equal(squad[2].contractYears, 4); // Friedmann
  assert.equal(squad[2].salary, 33078);
  const posOf = (i: number) => g.players.at(squad[i].playerIndex).position;
  assert.deepEqual([posOf(0), posOf(1), posOf(6), posOf(12)], ["TOR", "ABW", "MIT", "ANG"]);
  assert.equal(g.players.toArray().find((p) => p.name === "GR\x9aNDEL")?.position, "MIT");
  const baeurle = squad[6];
  assert.equal(g.players.at(baeurle.playerIndex).displayName, "BÄURLE");
  assert.equal(baeurle.leagueGoals + baeurle.cupGoals, 5);
  // Werte laut Original, siehe docs/REFERENZ-RIED-CLI.md
  const normi = g.managers.at(0);
  assert.equal(normi.balance, 973860);
  assert.equal(normi.ticketPrice, 19);
  assert.deepEqual(normi.debt, { total: 0, monthlyInterest: 0 }); // Bank: Gesamtschulden 0, Zinsen 0
  assert.deepEqual(normi.stadium, { seats: 8000, seatsPlanned: 2000, standing: 16000, standingPlanned: 0, roofed: 0, roofedPlanned: 2000 });
  assert.equal(normi.attendanceTotal, 171302);
  assert.deepEqual(normi.history(5).map((h) => [h.place, h.league, h.dfb]), [[6, 2, 3], [2, 2, 3], [9, 1, 2], [6, 1, 2], [1, 1, 2]]);
  assert.equal(normi.attendanceLow.value, 12747);
  assert.equal(g.clubs.at(normi.attendanceLow.opponent).name, "VFB STUTTGART");
  const adv = g.advertising.at(0);
  assert.equal(adv.shirt, 279741);
  assert.equal(adv.boardsTotal, 371425);
  assert.equal(adv.tv, 124000);
  assert.equal(adv.expenses, 20000);
  // Tabelle GESAMT und HEIM laut Original
  const nbg = g.standings.at(15);
  assert.deepEqual(nbg.total, { games: 15, wins: 8, draws: 4, losses: 3, points: 20, pointsAgainst: 10, goalsFor: 23, goalsAgainst: 15 });
  assert.deepEqual([nbg.homeGames, nbg.homeWins, nbg.homeLosses, nbg.homePoints, nbg.homeGoalsFor, nbg.homeGoalsAgainst], [8, 7, 0, 15, 15, 3]);
  assert.equal(nbg.lastResults, "sUsNsNus");
  assert.deepEqual([nbg.awayGames, nbg.awayWins, nbg.awayLosses, nbg.awayPoints, nbg.awayGoalsFor, nbg.awayGoalsAgainst], [7, 1, 3, 5, 8, 12]);
  const dortmund = g.standings.at(6);
  assert.deepEqual([dortmund.awayGames, dortmund.awayWins, dortmund.awayLosses, dortmund.awayPoints, dortmund.awayGoalsFor, dortmund.awayGoalsAgainst], [8, 1, 1, 8, 13, 14]);
  assert.equal(nbg.allTimePoints, 154);
  assert.deepEqual([g.clubs.at(0).form, g.clubs.at(6).form, g.clubs.at(4).form], [51, 51, 50]);
  const werder = g.standings.at(0);
  assert.equal(werder.allTimePoints, 359);
  assert.deepEqual(werder.total, { games: 15, wins: 7, draws: 0, losses: 8, points: 14, pointsAgainst: 16, goalsFor: 24, goalsAgainst: 29 });
  assert.deepEqual([werder.homeGames, werder.homeWins, werder.homeLosses, werder.homeGoalsFor, werder.homeGoalsAgainst], [8, 5, 3, 15, 14]);
  // Ergebnistabelle: 15 gespielte Bundesliga-Spieltage, Spieltag 16 offen
  assert.deepEqual([g.nextMatchday(0), g.nextMatchday(1), g.nextMatchday(2)], [16, 19, 19]);
  assert.deepEqual(g.result(0, 0, 0), { home: 2, away: 1, postponed: false });
  assert.equal(g.result(0, 14, 3)?.postponed, true); // verlegtes Spiel am 15. Spieltag
  assert.equal(g.result(0, 15, 0), null);
  assert.equal(g.pairings(0).length, 9);
  // Summe der Bundesliga-Tore aus der Ergebnistabelle = Summe der Tabellentore
  let goals = 0;
  for (let d = 0; d < 15; d++) for (let m = 0; m < 9; m++) { const r = g.result(0, d, m)!; goals += r.home + r.away; }
  let tableGoals = 0;
  for (let c = 0; c < 18; c++) tableGoals += g.standings.at(c).total.goalsFor;
  assert.equal(goals, tableGoals);
  const msgs = save.messages();
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].manager, 2);
  assert.match(dosText(msgs[0].text), /BENATELLI bietet an/);
});

test("Neuer Kopf ergibt gültige Datei", () => {
  const save = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED.MAN"))));
  let n = 0;
  const fresh = save.withFreshHeader(() => ((n += 0.37) % 1));
  const again = SaveFile.decode(fresh.encode());
  // Prüfsummenbytes hängen vom Schlüssel ab, alles andere muss gleich bleiben.
  const end = save.messagesEnd();
  assert.deepEqual(again.plain.subarray(35, CHK1_OFF), save.plain.subarray(35, CHK1_OFF));
  assert.deepEqual(again.plain.subarray(CHK1_OFF + 1, end), save.plain.subarray(CHK1_OFF + 1, end));
  assert.notEqual(again.key0, save.key0);
});

test("Meldungen anhängen und löschen: Roundtrip über encode/decode", () => {
  const data = new Uint8Array(readFileSync(join(BMP_DIR, "TEST4.MAN")));
  const s = SaveFile.decode(data);
  const before = s.messages().length;
  const s2 = s.addMessage(1, "4. Oktober 1997^Verletzung im Training:^TESTSPIELER^ (Kapselri~)^");
  const back = SaveFile.decode(s2.encode());
  assert.equal(back.messages().length, before + 1);
  const mine = back.messages().filter((m) => m.manager === 1);
  assert.ok(mine[0].text.startsWith("4. Oktober 1997^Verletzung"));
  const s3 = back.clearMessages(1);
  assert.equal(SaveFile.decode(s3.encode()).messages().filter((m) => m.manager === 1).length, 0);
  assert.equal(SaveFile.decode(s3.encode()).messages().filter((m) => m.manager === 0).length, back.messages().filter((m) => m.manager === 0).length);
});

test("Neues Spiel aus einer Vorlage mit Meldungen: Spielstand bleibt lesbar (jede Managerzahl)", () => {
  const template = SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, "RIED-CLI.MAN"))));
  assert.ok(template.messages().length > 0, "Vorlage sollte Meldungen enthalten");
  const mana = parseMana(new Uint8Array(readFileSync(join(BMP_DIR, "MANA.DAT"))));
  for (const n of [1, 2, 3, 4]) {
    const opt = { managers: Array.from({ length: n }, (_, i) => ({ name: "M" + i, club: i + 2, portrait: 1 })), level: 3 };
    const save = createGame(template.plain, mana, opt, mulberryRng(7));
    const encoded = save.encode();
    const again = SaveFile.decode(encoded);
    assert.equal(again.plain.length, save.plain.length, `${n} Manager`);
    assert.equal(again.managerCount, n);
    assert.equal(again.messages().length, 0);
  }
});
