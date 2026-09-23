import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, simulateMatch, LiveMatch, playMatchday, extraTime, chanceCounts, chanceMinutes } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Live-Simulation: minutenweise Schritte ergeben dieselbe Zufallsfolge wie simulateMatch", () => {
  const g = load("TEST4.MAN");
  for (let seed = 1; seed <= 20; seed++) {
    const h = g.clubs.at(seed % 18).strengthMatrix;
    const a = g.clubs.at((seed * 7) % 18).strengthMatrix;
    const batch = simulateMatch(h, a, mulberryRng(seed));
    const live = new LiveMatch(h, a, mulberryRng(seed));
    let steps = 0;
    while (!live.finished) {
      live.step();
      steps++;
    }
    assert.equal(steps, 90);
    assert.deepEqual(live.result(), batch);
  }
});

test("Spieltag mit vorgegebenen Ergebnissen: der Hook liefert die Resultate", () => {
  const g = load("TEST4.MAN");
  const pairs = g.pairings(0);
  const played = playMatchday(g, 0, mulberryRng(3), [], (home, away) => ({ home: (home + away) % 3, away: home % 2, events: [] }));
  played.forEach((p, i) => {
    assert.deepEqual([p.home, p.away], pairs[i]);
    assert.equal(p.result.home, (p.home + p.away) % 3);
  });
});

test("Verlängerung in der Konferenz: dieselbe Zufallsfolge wie die Buchung (GitLab #72)", () => {
  const g = load("TEST4.MAN");
  for (let seed = 1; seed <= 20; seed++) {
    const h = g.clubs.at(seed % 18).strengthMatrix;
    const a = g.clubs.at((seed * 7) % 18).strengthMatrix;
    // So bucht der Kern: 90 Minuten am Stück, danach extraTime aus demselben Zufallsstrom
    const wuerfel = mulberryRng(seed);
    const gebucht = simulateMatch(h, a, wuerfel, true);
    extraTime(h, a, gebucht, wuerfel);
    // So zeigt es die Konferenz: Minute für Minute, ab der 91. weiter
    const live = new LiveMatch(h, a, mulberryRng(seed), undefined, true);
    while (!live.finished) live.step();
    assert.equal(live.minute, 90);
    const nach90 = { home: live.hg, away: live.ag };
    live.verlaengern();
    while (!live.finished) live.step();
    assert.equal(live.minute, 120);
    assert.deepEqual({ home: live.hg, away: live.ag }, { home: gebucht.home, away: gebucht.away }, `Wurf ${seed}`);
    assert.deepEqual(live.result().events, gebucht.events, `Wurf ${seed}: Chancen`);
    assert.ok(live.hg >= nach90.home && live.ag >= nach90.away);
    // Ein zweites Anhängen ändert nichts
    live.verlaengern();
    assert.equal(live.halves.length, 4);
  }
});

test("Pokal: Chancenminuten ohne Doppelprüfung, Liga mit (0x043FF, #82)", () => {
  // Gleicher Würfelstrom, der zweimal dieselbe Minute liefert
  const folge = [10, 10, 20];
  const wuerfel = () => folge.shift()!;
  assert.deepEqual(chanceMinutes(2, 1, 45, wuerfel, false), [10, 10]);
  const folge2 = [10, 10, 20];
  assert.deepEqual(chanceMinutes(2, 1, 45, () => folge2.shift()!), [10, 20]);
});

test("Neuauslosung nach Rot/Verletzung: Rechnung und Minutenfenster (0x0657F, #82, #87)", () => {
  for (const wieOriginal of [false, true]) {
  const g = load("TEST4.MAN");
  for (let seed = 1; seed <= 30; seed++) {
    const h = g.clubs.at(seed % 18).strengthMatrix;
    const a = g.clubs.at((seed * 7) % 18).strengthMatrix;
    const live = new LiveMatch(h, a, mulberryRng(seed));
    // Halbzeitchancen aus einem Parallelstrom nachrechnen
    const probe = mulberryRng(seed);
    const n0 = chanceCounts(h, a, 1, 45, probe);
    while (live.minute < 30) live.step();
    const gespielt = (s: "home" | "away") => live.events.filter((e) => e.side === s).length;
    const vorher = { home: gespielt("home"), away: gespielt("away") };
    live.beginMinute();
    // Gleicher Strom wie in neuAuslosen: erst die Zahl, dann je Seite die Minuten
    const kopie = mulberryRng(seed);
    const echt = new LiveMatch(h, a, kopie);
    while (echt.minute < 30) echt.step();
    echt.beginMinute();
    const n = chanceCounts(h, a, 1, 45, kopie);
    // Original: alt - gespielt + (neu - alt bzw. neu); geradegezogen (#87): neu - gespielt
    const rest = (alt: number, neu: number, gs: number) => (wieOriginal ? Math.max(0, alt - gs + (alt <= neu ? neu - alt : neu)) : Math.max(0, neu - gs));
    const erwartet = { home: Math.min(8, rest(n0.home, n.home, vorher.home)), away: Math.min(8, rest(n0.away, n.away, vorher.away)) };
    live.neuAuslosen(0, wieOriginal);
    live.chances();
    while (!live.finished) live.step();
    const danach = (s: "home" | "away") => live.events.filter((e) => e.side === s && e.minute >= 31 && e.minute <= 45).length;
    const inMinute31 = (s: "home" | "away") => live.events.filter((e) => e.side === s && e.minute === 31).length;
    // Die Liga zieht verschiedene Minuten: genau so viele Chancen zwischen 31 und 45
    assert.equal(danach("home"), erwartet.home, `Wurf ${seed} Heim`);
    assert.equal(danach("away"), erwartet.away, `Wurf ${seed} Gast`);
    assert.ok(inMinute31("home") <= 1 && inMinute31("away") <= 1);
  }
  }
});
