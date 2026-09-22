import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, mulberryRng, matchIncidents, minuteIncidents, newIncidentState, matchStrength, pickStarter, fitStarters, isForfeit, playMatchday, FORFEIT_FINE } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string) => new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));

test("Spielereignisse: Spielerwahl nur Starter, Karten und Verletzungen in plausibler Häufigkeit, Sperren gebucht", () => {
  const g = load("TEST4.MAN");
  const rng = mulberryRng(3);
  for (let i = 0; i < 50; i++) {
    const p = pickStarter(g, 0, rng);
    const l = g.squadOf(0)[p];
    assert.ok(l.number >= 1 && l.number <= 11);
  }
  let yellow = 0, red = 0, injury = 0;
  const N = 200;
  for (let n = 0; n < N; n++) {
    const h = load("TEST4.MAN");
    for (const inc of matchIncidents(h, 0, mulberryRng(100 + n))) {
      if (inc.kind === "yellow") yellow++;
      else if (inc.kind === "injury") injury++;
      else {
        red++;
        const l = h.squadOf(0)[inc.place];
        assert.equal(l.number, 0);
        assert.equal(l.u8(9) & 1, 1);
        assert.ok(l.u8(13) >= 1 && l.u8(13) <= 7);
      }
    }
  }
  // je Spiel etwa 1 Gelbe (1/(5L+2x+38) je Minute), Rote und Verletzungen deutlich seltener
  assert.ok(yellow / N > 0.3 && yellow / N < 3, `Gelbe je Spiel ${yellow / N}`);
  assert.ok(red / N < 0.5, `Rote je Spiel ${red / N}`);
  assert.ok(injury / N < 0.6, `Verletzungen je Spiel ${injury / N}`);
  assert.ok(red > 0 && injury > 0);
});

test("0:2-Wertung bei weniger als acht einsatzfähigen Startern", () => {
  const g = load("TEST4.MAN");
  assert.equal(isForfeit(g, 0), false);
  const squad = g.squadOf(0);
  // vier Starter sperren
  let n = 0;
  for (const l of squad) if (l.number >= 1 && l.number <= 11 && n < 4) { l.setU8(9, l.u8(9) | 1); l.setU8(13, 2); n++; }
  assert.equal(fitStarters(g, 0), 7);
  assert.ok(isForfeit(g, 0));
  const m = g.managers.at(0);
  const bal = m.balance;
  const played = playMatchday(g, 0, mulberryRng(5));
  const mine = played.find((p) => p.home === m.clubIndex || p.away === m.clubIndex)!;
  assert.equal(mine.forfeit, 0);
  const own = mine.home === m.clubIndex ? mine.result.home : mine.result.away;
  const other = mine.home === m.clubIndex ? mine.result.away : mine.result.home;
  assert.deepEqual([own, other], [0, 2]);
  assert.equal(m.balance, bal - FORFEIT_FINE + (mine.gate ?? 0));
});

test("Moral: die Stärkerechnung schreibt Byte 317, Karten und Verletzungen hängen daran (GitLab #73)", () => {
  // Vor dem Spiel setzt das Original Managerbyte 317 aus Einsatzregler und Stärkeverhältnis
  // (0x0FFA8); bis #73 blieb der Wert liegen und die Ereignisse rechneten mit Byte 305.
  const g = load("TEST4.MAN");
  const m = g.managers.at(0);
  m.setU8(317, 0);
  m.setU8(305, 16); // Einsatzregler in der Mitte
  const s = matchStrength(g, 0, mulberryRng(5));
  assert.equal(m.u8(317), s.moralNeu, "Moral steht im Managersatz");
  assert.ok(m.u8(317) >= 16 && m.u8(317) <= 20, `Moral ${m.u8(317)} liegt nicht bei Einsatz + Zuschlag`);
  // Der Regler verschiebt sie mit
  m.setU8(317, 0);
  m.setU8(305, 34);
  const hoch = matchStrength(g, 0, mulberryRng(5)).moralNeu;
  assert.ok(hoch > s.moralNeu, `${hoch} nicht über ${s.moralNeu}`);
  assert.ok(hoch <= 40, "auf 40 begrenzt");
  // Die 100 der 0:2-Wertung bleibt stehen
  m.setU8(317, 100);
  matchStrength(g, 0, mulberryRng(5));
  assert.equal(m.u8(317), 100, "die Wertungsmarke wird nicht überschrieben");

  // Der Wert geht als x = 40 - Byte 317 in die Würfe ein, und getroffen wird bei random(0, ...)
  // gleich 0: je höher er steht, desto enger das Fenster und desto mehr Karten und
  // Verletzungen. Wer voll draufgeht, holt sich also mehr ab - das passt zum Regler.
  const zaehle = (moral: number): number => {
    let n = 0;
    for (let seed = 0; seed < 60; seed++) {
      const h = load("TEST4.MAN");
      h.managers.at(0).setU8(317, moral);
      n += matchIncidents(h, 0, mulberryRng(300 + seed)).length;
    }
    return n;
  };
  const vollerEinsatz = zaehle(40);
  const verhalten = zaehle(0);
  assert.ok(vollerEinsatz > verhalten, `Byte 317 wirkt nicht: ${vollerEinsatz} gegen ${verhalten}`);
});

test("Moral bleibt nicht im Spielstand stehen: nach dem Spieltag steht Byte 317 wieder auf 0 (#73)", () => {
  // Im Original hat jeder Spielstand hier eine 0 - wir dürfen also nichts zurücklassen
  const g = load("TEST4.MAN");
  playMatchday(g, 0, mulberryRng(4), []);
  for (let i = 0; i < g.activeManagers().length; i++) {
    assert.equal(g.managers.at(i).u8(317), 0, `Manager ${i}`);
  }
});

test("Höchstens ein Platzverweis je Spiel, Gelb-Rot eingeschlossen (0x0618F, 0x06177, #84)", () => {
  let mitGelbRot = 0;
  for (let seed = 0; seed < 400; seed++) {
    const g = load("TEST4.MAN");
    g.managers.at(0).setU8(317, 40); // x = 0: Karten so häufig wie möglich
    const inc = matchIncidents(g, 0, mulberryRng(1000 + seed));
    const verweise = inc.filter((i) => i.kind === "red" || i.kind === "yellowred").length;
    assert.ok(verweise <= 1, `Spiel ${seed}: ${verweise} Platzverweise`);
    if (inc.some((i) => i.kind === "yellowred")) mitGelbRot++;
  }
  assert.ok(mitGelbRot > 0, "Gelb-Rot kommt überhaupt vor");
});

test("Unter vier Spielern auf dem Platz keine Ereignisse mehr (0x06319, #84)", () => {
  const g = load("TEST4.MAN");
  const kader = g.squadOf(0);
  let aufDemPlatz = 0;
  for (const l of kader) {
    if (l.number >= 1 && l.number <= 11) {
      if (aufDemPlatz >= 3) l.setU8(10, 0);
      else aufDemPlatz++;
    }
  }
  const st = newIncidentState();
  assert.equal(minuteIncidents(g, 0, 10, st, (lo: number) => lo).length, 0);
});
