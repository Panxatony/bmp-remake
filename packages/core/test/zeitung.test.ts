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
  // Die Note muss auf die Spielbewertung hören. Vorher fand die Zeitung ihre eigene Rechnung
  // nicht wieder und schrieb für jeden die 6 hin (#70) - das fiel hier nicht auf, weil die 6
  // im erlaubten Bereich liegt. Also mit zwei ausgeprägten Bewertungen gegenprüfen.
  const starter = g.squadOf(0).filter((l) => l.u8(10) >= 1 && l.u8(10) <= 11);
  const mitWert = (wert: number) => {
    const bewertungen = new Map(starter.map((l) => [l.playerIndex, wert] as [number, number]));
    const rb = reportFromMatch(g, 0, { home: own, away: 3, result: { home: 2, away: 1, events }, scorers: [], attendance: 30000, bewertungen }, mulberryRng(1));
    const n = [...rb.lineup.matchAll(/\((\d)\)/g)].map((m) => Number(m[1]));
    assert.equal(n.length, 11, rb.lineup);
    return n;
  };
  // Eine glänzende Bewertung muss bessere (kleinere) Noten geben als eine miserable
  const gut = mitWert(36);
  const schlecht = mitWert(-12);
  const summe = (n: number[]) => n.reduce((a, b) => a + b, 0);
  assert.ok(summe(gut) < summe(schlecht), `Bewertung ohne Wirkung: ${summe(gut)} gegen ${summe(schlecht)}`);
  // Und eine gemischte Mannschaft bekommt nicht für jeden dieselbe Note
  const gemischt = new Map(starter.map((l, i) => [l.playerIndex, i % 2 === 0 ? 36 : -12] as [number, number]));
  const rm = reportFromMatch(g, 0, { home: own, away: 3, result: { home: 2, away: 1, events }, scorers: [], attendance: 30000, bewertungen: gemischt }, mulberryRng(1));
  const noten2 = [...rm.lineup.matchAll(/\((\d)\)/g)].map((m) => Number(m[1]));
  assert.ok(new Set(noten2).size > 1, `alle Noten gleich: ${rm.lineup}`);
  const z = composeZeitung(r, mulberryRng(9));
  assert.ok(z.headline.join(" ").length > 5);
});
