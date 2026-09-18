import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, playMatchday, playReplays, scheduleReplays, replays, removeReplays, fixtures, calendarFlag, dayIndex } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
const paar = (l: number, m: number, i: number) => fixtures(l, m)[i];

test("Nachholtermine: Tabelle des Originals lesen (Byte 5458, fünf Bytes je Eintrag)", () => {
  // TEST1 hat sieben verlegte Spiele, alle auf Tag 33; die Tabelle muss genau sie enthalten
  const g = load("TEST1.MAN");
  const r = replays(g);
  assert.equal(r.length, 7);
  assert.ok(r.every((e) => e.dayIndex === 33));
  const verlegt = new Set<string>();
  for (let liga = 0; liga < 3; liga++) {
    const teams = liga === 0 ? 18 : 20;
    for (let md = 0; md < (teams - 1) * 2; md++) for (let m = 0; m < teams / 2; m++) if (g.result(liga, md, m)?.postponed) verlegt.add(`${liga}/${md + 1}/${m}`);
  }
  assert.deepEqual(new Set(r.map((e) => `${e.league}/${e.matchday}/${e.match}`)), verlegt);
  // RIED hat zwei, RIED-4TE zwanzig - die Tabelle fasst genau zwanzig Plätze
  assert.equal(replays(load("RIED.MAN")).length, 2);
  assert.equal(replays(load("RIED-4TE.MAN")).length, 20);
});

test("Nachholspiele: verlegen, Termin vergeben, am Nachholtag austragen", () => {
  const g = load("CLAUDE4.MAN");
  const rng = mulberryRng(42);
  const k = dayIndex(g);
  const liga = 0;
  const md = g.nextMatchday(liga);
  const verlegt = [1, 4];
  const heim = verlegt.map((m) => paar(liga, md, m)[0]);
  playMatchday(g, liga, rng, verlegt);
  for (const m of verlegt) assert.equal(g.result(liga, md - 1, m)?.postponed, true, "Marke 30");

  const neu = scheduleReplays(g, k, liga, md, verlegt, paar);
  assert.equal(neu.length, 2);
  for (const e of neu) {
    assert.ok(e.dayIndex > k, "Nachholtag liegt nach dem Spieltag");
    assert.ok(calendarFlag(g, e.dayIndex) & 0x80, "Kalendermarke 0x80");
  }
  assert.deepEqual(
    replays(g).map((e) => `${e.league}/${e.matchday}/${e.match}`),
    verlegt.map((m) => `${liga}/${md}/${m}`),
  );

  const tag = neu[0].dayIndex;
  const faellig = replays(g).filter((e) => e.dayIndex === tag);
  const platzVorher = heim.map((c) => g.standings.at(c).u8(46));
  const out = playReplays(g, faellig, rng);
  removeReplays(g, faellig);
  assert.equal(out.length, faellig.length);
  for (const m of verlegt) {
    const r = g.result(liga, md - 1, m);
    assert.equal(r?.postponed, false, "Ergebnis steht jetzt");
  }
  assert.equal(replays(g).filter((e) => e.dayIndex === tag).length, 0, "Termin abgetragen");
  assert.notDeepEqual(
    heim.map((c) => g.standings.at(c).u8(46)),
    platzVorher,
    "die Tabelle hat sich bewegt",
  );
  // Der Spieltag der Liga ist durch das Nachholen nicht weitergerückt
  assert.equal(g.nextMatchday(liga), md + 1);
});
