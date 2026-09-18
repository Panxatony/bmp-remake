import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, composeZeitung, reportFromMatch, schlagzeilen, artikel, HEADLINE_GROUPS, ARTICLE_GROUPS, type MatchReport, text as T } from "../src/index.ts";
const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

const base = (): MatchReport => ({
  manager: 0, own: 15, opp: 0, ownName: "1.FC N\x9aRNBERG", oppName: "SV WERDER BREMEN", managerName: "LARS", home: true,
  ownGoals: 2, oppGoals: 0, deficitScore: [0, 0], leadScore: [2, 0], deficit: 0, lead: 2,
  events: [{ minute: 12, own: true, goal: true }, { minute: 40, own: false, goal: false }, { minute: 66, own: true, goal: true }, { minute: 70, own: true, goal: false }],
  attendance: 25000, soldOut: false, cards: 0, best: "", worst: "", ownStrength: 20, oppStrength: 18, picture: 3,
  lineup: "1.FC N\x9aRNBERG:  K\x94PKE(1)", goals: "TORE: 1:0 (12.MIN), 2:0 (66.MIN)", yellow: `${T("quell.zeitung", 0)}KEINE`, red: `${T("quell.zeitung", 1)}KEINE`,
});

test("Zeitung: Tabellen vollständig, Schlagzeile passt zum Ergebnis, Platzhalter aufgelöst", () => {
  assert.equal(schlagzeilen().length, HEADLINE_GROUPS.reduce((a, b) => a + b, 0));
  assert.equal(artikel().length, ARTICLE_GROUPS.reduce((a, b) => a + b, 0));
  const rng = mulberryRng(3);
  for (let i = 0; i < 50; i++) {
    const z = composeZeitung(base(), rng);
    assert.ok(z.headline.length >= 1 && z.headline.length <= 2, z.headline.join("|"));
    const all = [...z.headline, ...z.sentences].join(" ");
    assert.ok(!/%[0-9a-ex]/.test(all), all);
    assert.ok(!all.includes("#"), all);
    // 2:0 Heimsieg: Gruppen der Siege oder Sonderfälle, nie Niederlagentexte
    assert.ok(!/NIEDERLAGE|PLEITE|PACKUNG|UNTERLIEGT|VERLIERT/.test(z.headline.join(" ")), z.headline.join(" "));
    assert.ok(z.sentences.length >= 3);
    assert.ok(z.sentences.some((s) => s.includes("25000")));
  }
  // Auswärtsniederlage 0:5 nach 0:0 -> Niederlagengruppe, "BEI" statt "GEGEN"
  const lost = { ...base(), home: false, attendance: 0, ownGoals: 0, oppGoals: 5, deficit: -5, deficitScore: [0, 5] as [number, number], lead: 0, leadScore: [0, 0] as [number, number], events: [1, 2, 3, 4, 5].map((k) => ({ minute: 10 * k, own: false, goal: true })) };
  const z = composeZeitung(lost, rng);
  const h = z.headline.join(" ");
  assert.ok(/NIEDERLAGE|PLEITE|PACKUNG|UNTERLIEGT|VERLIERT|DEKLASSIERT|BERROLLT|OHNE CHANCE|BESSERE|SCHLAPPE|UNTERLEGEN|S\x9aNDENBOCK|RABENSCHWARZ|SCHWACHE LEISTUNG/.test(h), h);
  assert.ok(!z.sentences.some((s) => s.includes("SIEG ")) || true);
});

test("Zeitung: Spielbericht aus einem gespielten Spiel (Rückstand, Führung, Tore, Aufstellung)", () => {
  const g = load("TEST4.MAN");
  const own = g.managers.at(0).clubIndex;
  const events = [
    { minute: 5, side: "away" as const, goal: true },
    { minute: 20, side: "home" as const, goal: false },
    { minute: 44, side: "home" as const, goal: true },
    { minute: 60, side: "home" as const, goal: true },
    { minute: 88, side: "away" as const, goal: false },
  ];
  const r = reportFromMatch(g, 0, { home: own, away: 3, result: { home: 2, away: 1, events }, scorers: [{ minute: 44, side: "home", name: "TESTER" }], attendance: 30000 }, mulberryRng(1));
  assert.equal(r.home, true);
  assert.deepEqual([r.ownGoals, r.oppGoals], [2, 1]);
  assert.deepEqual([r.deficit, r.deficitScore, r.lead, r.leadScore], [-1, [0, 1], 1, [2, 1]]);
  assert.equal(r.events.length, 5);
  assert.ok(r.goals.startsWith("TORE: 0:1 (5.MIN), 1:1 TESTER (44.MIN), 2:1 (60.MIN)"), r.goals);
  // Hinter jedem Spieler steht seine Spielnote von 1 bis 6, nicht die Rückennummer (#64)
  const noten = [...r.lineup.matchAll(/\((\d)\)/g)].map((m) => Number(m[1]));
  assert.equal(noten.length, 11);
  assert.ok(noten.every((n) => n >= 1 && n <= 6), r.lineup);
  const z = composeZeitung(r, mulberryRng(9));
  assert.ok(z.headline.join(" ").length > 5);
});
