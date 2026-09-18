import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SaveFile, GameState, setRuleSet, RULES_2026, addToSquad, poach, mulberryRng, marketEntries, playerValue, salaryDemand, dailyFinance } from "../src/index.ts";

const BMP_DIR = process.env.BMP_DIR ?? resolve(import.meta.dirname, "../../../../bmp");
const load = (name: string, regeln = false) => {
  const g = new GameState(SaveFile.decode(new Uint8Array(readFileSync(join(BMP_DIR, name)))));
  if (regeln) setRuleSet(g, RULES_2026);
  return g;
};
/** Mannschaftsteile des Kaders in Reihenfolge */
const teile = (g: GameState, manager: number) => g.squadOf(manager).map((l) => g.players.at(l.playerIndex).position);
const sortiert = (liste: string[]) => {
  const rang: Record<string, number> = { TOR: 0, ABW: 1, MIT: 2, ANG: 3 };
  return liste.every((p, i) => i === 0 || rang[liste[i - 1]] <= rang[p]);
};

test("Kader: die Spielstände des Originals sind nach Mannschaftsteil sortiert", () => {
  for (const datei of ["RIED-CLI.MAN", "TEST4.MAN", "RIED-6TE.MAN"]) {
    const g = load(datei);
    g.activeManagers().forEach((_, i) => assert.ok(sortiert(teile(g, i)), `${datei}, Manager ${i}: ${teile(g, i).join(" ")}`));
  }
});

test("Kader: ein aufgenommener Torwart steht vorn, nicht hinten", () => {
  const g = load("RIED-CLI.MAN");
  // Einen Torwart suchen, der keinem Manager gehört
  let spieler = -1;
  for (let i = 1; i < 150 && spieler < 0; i++) {
    const p = g.players.at(i);
    if (p.position === "TOR" && p.u8(33) > 3) spieler = i;
  }
  assert.ok(spieler > 0, "kein freier Torwart im Spielerpool");
  const vorher = teile(g, 0).length;
  const platz = addToSquad(g, 0, spieler, 2, mulberryRng(7));
  assert.equal(g.squadOf(0).length, vorher + 1);
  assert.equal(g.players.at(g.lineups.at(0 * 25 + platz).playerIndex).position, "TOR", "der Rückgabewert zeigt auf den neuen Platz");
  assert.ok(sortiert(teile(g, 0)), teile(g, 0).join(" "));
});

test("Abwerben: der abgeworbene Spieler wird einsortiert", () => {
  const g = load("RIED-CLI.MAN", true);
  // Einen Torwart eines anderen Managers abwerben (Zustimmung erzwungen)
  // Abgeworben wird nur nach oben (#1): LARS (Platz 13) bei BLACKY (Platz 6), beide 2. Liga
  const werber = 1;
  const owner = 2;
  const platz = g.squadOf(owner).findIndex((l) => g.players.at(l.playerIndex).position === "TOR");
  assert.ok(platz >= 0);
  const name = g.players.at(g.squadOf(owner)[platz].playerIndex).displayName;
  g.managers.at(werber).balance = 50_000_000;
  const res = poach(g, werber, owner, platz, 0, () => 0);
  assert.ok(res.ok && res.agreed, JSON.stringify(res));
  assert.ok(sortiert(teile(g, werber)), teile(g, werber).join(" "));
  const neu = g.squadOf(werber).findIndex((l) => g.players.at(l.playerIndex).displayName === name);
  assert.ok(neu >= 0 && g.players.at(g.squadOf(werber)[neu].playerIndex).position === "TOR");
});

test("Gehaltsforderung: im Original gemessen (1. Spieltag, Gehaltsbasis 1800 und 2100)", () => {
  // Messung im Original (DOSBox, erster Spieltag): ein Spieler mit 1.800 DM Gehaltsbasis
  // verlangt 2.052 DM für ein Jahr, 2.520 für drei und 2.772 für vier; mit 2.100 DM Basis
  // sind es 3.234 DM für vier Jahre. Die Forderung ist Basis·(q+4)/100 mit
  // q = ((t/6 + 122)·8)/10 und t = 100·(Jahre-1) + prog (0x25C27, Schiebehilfe 0x3BBC8 schiebt
  // nach links, nicht nach rechts - daran lag es).
  const g = load("SCHWARZ-.MAN");
  const erwartet: Record<number, number[]> = {
    1800: [2052, 2304, 2520, 2772],
    2100: [2394, 2688, 2940, 3234],
  };
  let geprueft = 0;
  g.squadOf(0).forEach((l, place) => {
    const basis = playerValue(g, 0, place, 1);
    const soll = erwartet[basis];
    if (!soll) return;
    geprueft++;
    const ist = [1, 2, 3, 4].map((y) => salaryDemand(g, 0, place, y));
    assert.deepEqual(ist, soll, `Basis ${basis}: ${ist.join("/")}`);
  });
  assert.ok(geprueft >= 2, `nur ${geprueft} Spieler mit passender Basis`);
});

test("Gehaltsforderung: Marktspieler, Mindestwert ist die Gehaltsbasis", () => {
  const g = load("TEST4.MAN");
  const markt = marketEntries(g).filter((e) => e.owner === 4);
  assert.ok(markt.length > 0);
  for (const e of markt) {
    const basis = playerValue(g, 4, e.slot, 1);
    const forderungen = [1, 2, 3, 4].map((y) => salaryDemand(g, 1, g.squadOf(1).length, y, { manager: 4, place: e.slot }));
    assert.ok(forderungen.every((f) => f >= basis), `${e.name}: ${forderungen.join(",")} unter der Basis ${basis}`);
    assert.ok(forderungen[3] > forderungen[0], `${e.name}: längere Laufzeit kostet nicht mehr`);
  }
});

test("Randalierer: Schaden = (Stehplätze·4 + Sitzplätze/2)·random(2,5), auf 1000 abgerundet", () => {
  const g = load("RIED-CLI.MAN");
  const m = g.managers.at(0);
  const sitz = m.i32(350);
  const steh = m.i32(358);
  m.setU8(318, m.u8(318) | 1);
  const vorher = m.i32(496);
  const events = dailyFinance(g, 0, { day: 5, month0: 8, year: 1997 }, () => 3);
  const schaden = events.find((e) => e.kind === "riot");
  assert.ok(schaden, "kein Schaden gebucht");
  const soll = Math.trunc(((steh * 4 + (sitz >> 1)) * 3) / 1000) * 1000;
  assert.equal(schaden!.amount, soll, `${schaden!.amount} statt ${soll}`);
  assert.equal(m.i32(496), vorher - soll);
  assert.equal(m.u8(318) & 1, 0, "Merker nicht gelöscht");
});

/**
 * Am Original nachgemessen (GitLab #26, 17.9.2026): Spielstand mit gesetztem Krawall-Merker
 * (Managerbyte 318 Bit 0) und runden Platzzahlen geladen und je einen Tag weitergeschaltet,
 * der Betrag aus der Meldung abgelesen. Sechs Läufe, sechs Treffer - siehe
 * docs/SPIELMECHANIK.md, Abschnitt "Randalierer".
 */
test("Randalierer: die im Original gemessenen Beträge (#26)", () => {
  const messungen: { sitz: number; steh: number; betrag: number }[] = [
    { sitz: 10_000, steh: 20_000, betrag: 170_000 },
    { sitz: 10_000, steh: 20_000, betrag: 340_000 },
    { sitz: 10_000, steh: 20_000, betrag: 425_000 },
    { sitz: 5_000, steh: 30_000, betrag: 245_000 },
    { sitz: 5_000, steh: 30_000, betrag: 367_000 },
  ];
  for (const mess of messungen) {
    // Jeder gemessene Betrag muss einem der vier möglichen Würfe entsprechen
    const moeglich = [2, 3, 4, 5].map((r) => {
      const g = load("RIED-CLI.MAN");
      const m = g.managers.at(0);
      const w32 = (off: number, v: number) => {
        for (let i = 0; i < 4; i++) m.setU8(off + i, (v >>> (8 * i)) & 0xff);
      };
      w32(350, mess.sitz);
      w32(358, mess.steh);
      m.setU8(318, m.u8(318) | 1);
      return dailyFinance(g, 0, { day: 5, month0: 8, year: 1997 }, () => r).find((e) => e.kind === "riot")!.amount;
    });
    assert.ok(moeglich.includes(mess.betrag), `${mess.steh} Steh / ${mess.sitz} Sitz: gemessen ${mess.betrag}, möglich ${moeglich.join(", ")}`);
  }
});

test("Kaderbildschirm: RK zeigt nur glatt Rot, Gelb-Rot bleibt außen vor (TEST4 in DOSBox)", () => {
  const g = load("TEST4.MAN");
  const wirsching = g.squadOf(0).find((l) => g.players.at(l.playerIndex).displayName === "WIRSCHING")!;
  assert.equal(wirsching.u8(2), 1, "hat eine Gelb-Rote");
  assert.equal(wirsching.u8(0), 0, "keine glatt Rote");
  assert.equal(wirsching.redCards, 0, "die Spalte RK bleibt bei 0 wie im Original");
  assert.equal(wirsching.yellowRedCards, 1);
  assert.equal(wirsching.yellowCards, 2);
});
